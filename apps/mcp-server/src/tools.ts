import { z } from 'zod';
import { AuthenticatedUserContext } from './auth.js';
import {
  requirePermission,
  createPendingConfirmation,
  consumeConfirmationToken,
  maskSensitiveFields,
  checkRateLimit,
  recordAudit,
} from './guardrails.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any, ctx: AuthenticatedUserContext) => Promise<any>;
}

export const crmTools: ToolDefinition[] = [
  // 1. IDENTITY & CAPABILITY TOOLS
  {
    name: 'crm_whoami',
    description: 'Returns the currently authenticated CRM user context, assigned canonical role, hierarchy scope, and permissions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, ctx) => {
      return {
        userId: ctx.userId,
        email: ctx.email,
        fullName: ctx.fullName,
        primaryRole: ctx.primaryRole,
        roles: ctx.roles,
        managerId: ctx.managerId,
        permissionsCount: ctx.permissions.length,
        status: 'AUTHENTICATED_AND_ACTIVE',
      };
    },
  },
  {
    name: 'crm_get_my_permissions',
    description: 'Lists all effective permissions configured for the authenticated user based on their active roles.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, ctx) => {
      return {
        userId: ctx.userId,
        role: ctx.primaryRole,
        permissions: ctx.permissions.sort(),
      };
    },
  },

  // 2. UNIFIED SEARCH
  {
    name: 'crm_search_records',
    description: 'Search across Leads, Accounts, Contacts, and Opportunities respecting user RLS visibility.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or query string' },
        limit: { type: 'number', description: 'Max results per entity type (default 10)' },
      },
      required: ['query'],
    },
    handler: async (args, ctx) => {
      const q = `%${args.query}%`;
      const limit = Math.min(args.limit || 10, 50);

      // Runs under delegated client -> Supabase RLS automatically applies!
      const [leadsRes, accountsRes, contactsRes, oppsRes] = await Promise.all([
        ctx.supabase.from('leads').select('id, first_name, last_name, company, email, status').or(`first_name.ilike.${q},last_name.ilike.${q},company.ilike.${q},email.ilike.${q}`).limit(limit),
        ctx.supabase.from('accounts').select('id, name, industry, website, phone').ilike('name', q).limit(limit),
        ctx.supabase.from('contacts').select('id, first_name, last_name, email, phone').or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`).limit(limit),
        ctx.supabase.from('opportunities').select('id, title, stage, amount, probability').ilike('title', q).limit(limit),
      ]);

      return {
        leads: leadsRes.data || [],
        accounts: accountsRes.data || [],
        contacts: contactsRes.data || [],
        opportunities: oppsRes.data || [],
      };
    },
  },

  // 3. LEADS TOOLS
  {
    name: 'crm_list_leads',
    description: 'List leads accessible to the authenticated user with optional filtering by status and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by lead status (e.g., NEW, CONTACTED, QUALIFIED)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 20, max 100)' },
      },
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'leads.view');
      const page = Math.max(args.page || 1, 1);
      const pageSize = Math.min(args.pageSize || 20, 100);
      const offset = (page - 1) * pageSize;

      let query = ctx.supabase
        .from('leads')
        .select('*', { count: 'exact' });

      if (args.status) {
        query = query.eq('status', args.status);
      }

      const { data, count, error } = await query
        .range(offset, offset + pageSize - 1)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to list leads: ${error.message}`);

      return {
        total: count,
        page,
        pageSize,
        leads: (data || []).map(lead => maskSensitiveFields(lead, ctx.primaryRole)),
      };
    },
  },
  {
    name: 'crm_get_lead',
    description: 'Get complete details for a single Lead by ID, provided the user has view access.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'UUID of the lead' },
      },
      required: ['leadId'],
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'leads.view');
      const { data, error } = await ctx.supabase
        .from('leads')
        .select('*')
        .eq('id', args.leadId)
        .single();

      if (error || !data) {
        throw new Error(`Lead not found or inaccessible under your organizational scope: ${args.leadId}`);
      }

      return maskSensitiveFields(data, ctx.primaryRole);
    },
  },
  {
    name: 'crm_create_lead',
    description: 'Create a new Lead record. The lead will be assigned to the user unless user possesses leads.assign permissions.',
    inputSchema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'Lead first name' },
        lastName: { type: 'string', description: 'Lead last name' },
        email: { type: 'string', description: 'Lead email address' },
        phone: { type: 'string', description: 'Lead phone number' },
        company: { type: 'string', description: 'Company or organization' },
        status: { type: 'string', description: 'Initial status (default NEW)' },
        source: { type: 'string', description: 'Lead source' },
        assignedTo: { type: 'string', description: 'User ID to assign the lead to (requires leads.assign)' },
      },
      required: ['firstName', 'lastName'],
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'leads.create');

      let assignedTo = ctx.userId;
      if (args.assignedTo && args.assignedTo !== ctx.userId) {
        requirePermission(ctx, 'leads.assign');
        assignedTo = args.assignedTo;
      }

      const leadPayload = {
        first_name: args.firstName,
        last_name: args.lastName,
        email: args.email || null,
        phone: args.phone || null,
        company: args.company || null,
        status: args.status || 'NEW',
        source: args.source || 'AI_AGENT_MCP',
        assigned_to: assignedTo,
        created_by: ctx.userId,
      };

      const { data, error } = await ctx.supabase
        .from('leads')
        .insert([leadPayload])
        .select()
        .single();

      if (error) throw new Error(`Lead creation failed: ${error.message}`);
      return data;
    },
  },
  {
    name: 'crm_update_lead',
    description: 'Update existing lead fields (status, company, phone, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'UUID of the lead' },
        status: { type: 'string', description: 'New lead status' },
        phone: { type: 'string', description: 'Updated phone' },
        email: { type: 'string', description: 'Updated email' },
        company: { type: 'string', description: 'Updated company' },
      },
      required: ['leadId'],
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'leads.update');

      const updates: Record<string, any> = {};
      if (args.status) updates.status = args.status;
      if (args.phone) updates.phone = args.phone;
      if (args.email) updates.email = args.email;
      if (args.company) updates.company = args.company;

      const { data, error } = await ctx.supabase
        .from('leads')
        .update(updates)
        .eq('id', args.leadId)
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Failed to update lead: ${error?.message || 'Lead not found or inaccessible.'}`);
      }

      return data;
    },
  },

  // 4. ACCOUNTS & CONTACTS
  {
    name: 'crm_list_accounts',
    description: 'List business accounts accessible under current user permissions.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max records (default 25)' },
      },
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'accounts.view');
      const limit = Math.min(args.limit || 25, 100);

      const { data, error } = await ctx.supabase
        .from('accounts')
        .select('*')
        .limit(limit)
        .order('name');

      if (error) throw new Error(`Failed to list accounts: ${error.message}`);
      return (data || []).map(acc => maskSensitiveFields(acc, ctx.primaryRole));
    },
  },
  {
    name: 'crm_list_contacts',
    description: 'List contacts within user scope, optionally filtered by accountId.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Optional account UUID' },
        limit: { type: 'number', description: 'Max records (default 25)' },
      },
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'contacts.view');
      const limit = Math.min(args.limit || 25, 100);

      let query = ctx.supabase.from('contacts').select('*').limit(limit);
      if (args.accountId) {
        query = query.eq('account_id', args.accountId);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list contacts: ${error.message}`);
      return (data || []).map(c => maskSensitiveFields(c, ctx.primaryRole));
    },
  },

  // 5. OPPORTUNITIES & DEALS
  {
    name: 'crm_list_opportunities',
    description: 'List sales opportunities/pipeline deals accessible to the authenticated user.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string', description: 'Optional stage filter' },
        limit: { type: 'number', description: 'Max records (default 25)' },
      },
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'opportunities.view');
      const limit = Math.min(args.limit || 25, 100);

      let query = ctx.supabase.from('opportunities').select('*').limit(limit);
      if (args.stage) {
        query = query.eq('stage', args.stage);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to list opportunities: ${error.message}`);
      return data || [];
    },
  },
  {
    name: 'crm_create_opportunity',
    description: 'Create a new sales opportunity under an account.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Opportunity title' },
        accountId: { type: 'string', description: 'Account UUID' },
        amount: { type: 'number', description: 'Deal value amount' },
        stage: { type: 'string', description: 'Stage (default PROSPECTING)' },
        closeDate: { type: 'string', description: 'Expected close date (YYYY-MM-DD)' },
      },
      required: ['title', 'accountId', 'amount'],
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'opportunities.create');

      const payload = {
        title: args.title,
        account_id: args.accountId,
        amount: args.amount,
        stage: args.stage || 'PROSPECTING',
        close_date: args.closeDate || null,
        owner_id: ctx.userId,
      };

      const { data, error } = await ctx.supabase
        .from('opportunities')
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(`Opportunity creation failed: ${error.message}`);
      return data;
    },
  },

  // 6. TASKS & ACTIVITIES
  {
    name: 'crm_list_my_tasks',
    description: 'List pending tasks and action items assigned to the authenticated user.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by task status (e.g. PENDING, COMPLETED)' },
      },
    },
    handler: async (args, ctx) => {
      let query = ctx.supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', ctx.userId);

      if (args.status) {
        query = query.eq('status', args.status);
      }

      const { data, error } = await query.order('due_date', { ascending: true });
      if (error) throw new Error(`Failed to list tasks: ${error.message}`);
      return data || [];
    },
  },
  {
    name: 'crm_create_task',
    description: 'Create a new task or follow-up item.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        dueDate: { type: 'string', description: 'Due date in ISO format or YYYY-MM-DD' },
        priority: { type: 'string', description: 'Priority: LOW, MEDIUM, HIGH' },
        leadId: { type: 'string', description: 'Associated lead ID' },
      },
      required: ['title'],
    },
    handler: async (args, ctx) => {
      const payload = {
        title: args.title,
        due_date: args.dueDate || null,
        priority: args.priority || 'MEDIUM',
        lead_id: args.leadId || null,
        assigned_to: ctx.userId,
        status: 'PENDING',
      };

      const { data, error } = await ctx.supabase
        .from('tasks')
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(`Task creation failed: ${error.message}`);
      return data;
    },
  },

  // 7. DASHBOARD & REPORTING TOOLS
  {
    name: 'crm_get_dashboard_summary',
    description: 'Get high-level CRM metrics scoped to user hierarchy and role.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, ctx) => {
      // Counts are executed through delegated client, so RLS restricts to authorized scope
      const [leadsCount, oppsData, tasksCount] = await Promise.all([
        ctx.supabase.from('leads').select('*', { count: 'exact', head: true }),
        ctx.supabase.from('opportunities').select('amount, stage'),
        ctx.supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', ctx.userId).eq('status', 'PENDING'),
      ]);

      const opps = oppsData.data || [];
      const totalPipelineValue = opps.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      return {
        roleScope: ctx.primaryRole,
        totalLeadsInScope: leadsCount.count || 0,
        activeOpportunities: opps.length,
        totalPipelineValue,
        pendingTasks: tasksCount.count || 0,
      };
    },
  },

  // 8. HIGH-IMPACT / DESTRUCTIVE TOOLS REQUIRING TWO-STEP CONFIRMATION
  {
    name: 'crm_prepare_delete_record',
    description: 'Phase 1 of destructive delete operation. Generates a one-time 5-minute confirmation token with impact summary.',
    inputSchema: {
      type: 'object',
      properties: {
        entityType: { type: 'string', enum: ['lead', 'opportunity', 'contact', 'account'], description: 'Type of record to delete' },
        recordId: { type: 'string', description: 'UUID of the record to delete' },
      },
      required: ['entityType', 'recordId'],
    },
    handler: async (args, ctx) => {
      const permKey = `${args.entityType}s.delete`;
      requirePermission(ctx, permKey);

      // Verify the record exists and is accessible before generating confirmation
      const tableName = `${args.entityType}s`;
      const { data, error } = await ctx.supabase.from(tableName).select('id').eq('id', args.recordId).single();
      if (error || !data) {
        throw new Error(`Record ${args.recordId} not found or inaccessible.`);
      }

      const token = createPendingConfirmation(ctx.userId, 'delete_record', {
        entityType: args.entityType,
        recordId: args.recordId,
      });

      return {
        status: 'CONFIRMATION_REQUIRED',
        warning: `DESTRUCTIVE ACTION: Deleting ${args.entityType} with ID ${args.recordId} cannot be undone.`,
        confirmationToken: token,
        expiresInSeconds: 300,
        instruction: 'To proceed, invoke "crm_execute_delete_record" with this confirmationToken and recordId.',
      };
    },
  },
  {
    name: 'crm_execute_delete_record',
    description: 'Phase 2 of destructive delete operation. Validates the one-time token and executes deletion.',
    inputSchema: {
      type: 'object',
      properties: {
        confirmationToken: { type: 'string', description: 'One-time confirmation token from crm_prepare_delete_record' },
        entityType: { type: 'string', enum: ['lead', 'opportunity', 'contact', 'account'] },
        recordId: { type: 'string', description: 'UUID of record' },
      },
      required: ['confirmationToken', 'entityType', 'recordId'],
    },
    handler: async (args, ctx) => {
      const permKey = `${args.entityType}s.delete`;
      requirePermission(ctx, permKey);

      // Validates token ownership, expiration, and single-use
      consumeConfirmationToken(ctx.userId, args.confirmationToken, 'delete_record');

      const tableName = `${args.entityType}s`;
      const { error } = await ctx.supabase.from(tableName).delete().eq('id', args.recordId);
      if (error) {
        throw new Error(`Deletion failed: ${error.message}`);
      }

      return {
        success: true,
        message: `Successfully deleted ${args.entityType} record ${args.recordId}.`,
      };
    },
  },

  // 9. SUPER ADMIN PROTECTED TOOLS
  {
    name: 'crm_admin_list_roles',
    description: 'Lists all organizational roles and permission matrices. Restricted strictly to SUPER_ADMIN.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, ctx) => {
      requirePermission(ctx, 'roles.manage');

      const { data, error } = await ctx.supabase
        .from('role_permissions')
        .select('*');

      if (error) throw new Error(`Failed to list roles: ${error.message}`);
      return data || [];
    },
  },
];
