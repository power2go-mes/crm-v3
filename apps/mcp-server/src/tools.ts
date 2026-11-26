import { AuthenticatedUserContext } from './auth';
import {
  requirePermission,
  createPendingConfirmation,
  consumeConfirmationToken,
  maskSensitiveFields,
  checkRateLimit,
  recordAudit,
} from './guardrails';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any, ctx: AuthenticatedUserContext) => Promise<any>;
}

const deletableEntities: Record<string, { table: string; permission: string }> = {
  lead: { table: 'leads', permission: 'leads.delete' },
  opportunity: { table: 'opportunities', permission: 'opportunities.delete' },
  contact: { table: 'contacts', permission: 'contacts.delete' },
  account: { table: 'accounts', permission: 'accounts.delete' },
};

function getDeletableEntity(entityType: string) {
  const entity = deletableEntities[entityType];
  if (!entity) throw new Error(`Unsupported entity type: ${entityType}`);
  return entity;
}

export const ALLOWED_LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'lost', 'convert'] as const;
export type AllowedLeadStatus = typeof ALLOWED_LEAD_STATUSES[number];

export const ALLOWED_OPPORTUNITY_STAGES = [
  'prospecting',
  'qualification',
  'needs_analysis',
  'proposal_quote',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const;
export type AllowedOpportunityStage = typeof ALLOWED_OPPORTUNITY_STAGES[number];

async function assertAccessibleAssignee(ctx: AuthenticatedUserContext, targetUserId: string) {
  if (targetUserId === ctx.userId) return;
  // Super admin can assign to anyone
  if (ctx.primaryRole === 'SUPER_ADMIN' || ctx.roles.includes('SUPER_ADMIN')) return;

  const { data: accessible, error } = await ctx.supabase.rpc('get_accessible_user_ids', {
    p_acting_user_id: ctx.userId,
  });
  if (error || !accessible) {
    throw new Error('Access Denied: Unable to verify organizational assignment hierarchy.');
  }

  const allowedIds = new Set(accessible.map((r: any) => r.accessible_user_id));
  if (!allowedIds.has(targetUserId)) {
    throw new Error('Access Denied: Target assignee is outside your authorized organizational hierarchy.');
  }
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
    description: 'Search across Leads, Accounts, Contacts, and Opportunities respecting user RLS visibility and module permissions.',
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

      // Verify module permissions before querying each entity
      const searchLeads = ctx.permissions.includes('leads.view')
        ? ctx.supabase.from('leads').select('id, first_name, last_name, company_name, email, status').or(`first_name.ilike.${q},last_name.ilike.${q},company_name.ilike.${q},email.ilike.${q}`).limit(limit)
        : Promise.resolve({ data: [], error: null });

      const searchAccounts = ctx.permissions.includes('accounts.view')
        ? ctx.supabase.from('accounts_readable').select('id, name, industry, website, contact_number, account_type').ilike('name', q).limit(limit)
        : Promise.resolve({ data: [], error: null });

      const searchContacts = ctx.permissions.includes('contacts.view')
        ? ctx.supabase.from('contacts_readable').select('id, first_name, last_name, email, contact_number, title').or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`).limit(limit)
        : Promise.resolve({ data: [], error: null });

      const searchOpps = ctx.permissions.includes('opportunities.view')
        ? ctx.supabase.from('opportunities_readable').select('id, name, stage, amount, probability').ilike('name', q).limit(limit)
        : Promise.resolve({ data: [], error: null });

      const [leadsRes, accountsRes, contactsRes, oppsRes] = await Promise.all([
        searchLeads,
        searchAccounts,
        searchContacts,
        searchOpps,
      ]);

      const queryError = leadsRes.error || accountsRes.error || contactsRes.error || oppsRes.error;
      if (queryError) throw new Error(`Failed to search CRM records: ${queryError.message}`);

      return {
        leads: (leadsRes.data ?? []).map(r => maskSensitiveFields(r, ctx.primaryRole)),
        accounts: (accountsRes.data ?? []).map(r => maskSensitiveFields(r, ctx.primaryRole)),
        contacts: (contactsRes.data ?? []).map(r => maskSensitiveFields(r, ctx.primaryRole)),
        opportunities: (oppsRes.data ?? []).map(r => maskSensitiveFields(r, ctx.primaryRole)),
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
        status: { type: 'string', description: 'Filter by lead status (e.g., new, contacted, qualified)' },
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
        title: { type: 'string', description: 'Lead title (optional; generated if omitted)' },
        email: { type: 'string', description: 'Lead email address' },
        phone: { type: 'string', description: 'Lead phone number' },
        company: { type: 'string', description: 'Company or organization' },
        status: { type: 'string', enum: ALLOWED_LEAD_STATUSES as any, description: 'Initial status (default new)' },
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
        await assertAccessibleAssignee(ctx, args.assignedTo);
        assignedTo = args.assignedTo;
      }

      const status = (args.status || 'new').toLowerCase().trim();
      if (!ALLOWED_LEAD_STATUSES.includes(status as AllowedLeadStatus)) {
        throw new Error(`Invalid lead status "${args.status}". Authoritative allowed values: ${ALLOWED_LEAD_STATUSES.join(', ')}`);
      }

      const leadPayload = {
        first_name: args.firstName.trim(),
        last_name: args.lastName.trim(),
        title: args.title?.trim() || `${args.company || ''}/${args.firstName}/${ctx.email}`,
        email: args.email?.trim() || null,
        phone: args.phone?.trim() || null,
        company_name: args.company?.trim() || null,
        status,
        lead_source: args.source?.trim() || 'AI_AGENT_MCP',
        lead_owner_id: assignedTo,
        created_by_id: ctx.userId,
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
        status: { type: 'string', enum: ALLOWED_LEAD_STATUSES as any, description: 'New lead status' },
        phone: { type: 'string', description: 'Updated phone' },
        email: { type: 'string', description: 'Updated email' },
        company: { type: 'string', description: 'Updated company' },
        assignedTo: { type: 'string', description: 'Reassign lead owner (requires leads.assign)' },
      },
      required: ['leadId'],
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'leads.update');

      // Verify lead is accessible under caller's RLS before updating
      const { data: existingLead, error: lookupError } = await ctx.supabase
        .from('leads')
        .select('id, lead_owner_id, status')
        .eq('id', args.leadId)
        .single();

      if (lookupError || !existingLead) {
        throw new Error(`Lead ${args.leadId} not found or inaccessible under your organizational scope.`);
      }

      const updates: Record<string, any> = {};

      if (args.status) {
        const normStatus = args.status.toLowerCase().trim();
        if (!ALLOWED_LEAD_STATUSES.includes(normStatus as AllowedLeadStatus)) {
          throw new Error(`Invalid lead status "${args.status}". Authoritative allowed values: ${ALLOWED_LEAD_STATUSES.join(', ')}`);
        }
        updates.status = normStatus;
      }

      if (args.phone !== undefined) updates.phone = args.phone?.trim() || null;
      if (args.email !== undefined) updates.email = args.email?.trim() || null;
      if (args.company !== undefined) updates.company_name = args.company?.trim() || null;

      if (args.assignedTo && args.assignedTo !== existingLead.lead_owner_id) {
        requirePermission(ctx, 'leads.assign');
        await assertAccessibleAssignee(ctx, args.assignedTo);
        updates.lead_owner_id = args.assignedTo;
      }

      if (Object.keys(updates).length === 0) {
        return existingLead;
      }

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
        .from('accounts_readable')
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

      let query = ctx.supabase.from('contacts_readable').select('*').limit(limit);
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

      let query = ctx.supabase.from('opportunities_readable').select('*').limit(limit);
      if (args.stage) {
        query = query.eq('stage', args.stage);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to list opportunities: ${error.message}`);
      return (data || []).map(opp => maskSensitiveFields(opp, ctx.primaryRole));
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
        amount: { type: 'number', minimum: 0, description: 'Deal value amount' },
        stage: { type: 'string', enum: ALLOWED_OPPORTUNITY_STAGES as any, description: 'Stage (default prospecting)' },
        closeDate: { type: 'string', format: 'date', description: 'Expected close date (YYYY-MM-DD)' },
        assignedTo: { type: 'string', description: 'Opportunity owner ID (requires hierarchy access)' },
      },
      required: ['title', 'accountId', 'amount', 'closeDate'],
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'opportunities.create');

      // 1. Stage Validation
      const rawStage = (args.stage || 'prospecting').toLowerCase().trim();
      if (!ALLOWED_OPPORTUNITY_STAGES.includes(rawStage as AllowedOpportunityStage)) {
        throw new Error(`Invalid opportunity stage "${args.stage}". Authoritative allowed values: ${ALLOWED_OPPORTUNITY_STAGES.join(', ')}`);
      }

      // 2. Account verification under caller scope
      const { data: account, error: accError } = await ctx.supabase
        .from('accounts_readable')
        .select('id, name')
        .eq('id', args.accountId)
        .single();

      if (accError || !account) {
        throw new Error(`Account ${args.accountId} not found or inaccessible under your organizational scope.`);
      }

      // 3. Ownership Hierarchy Verification
      let ownerId = ctx.userId;
      if (args.assignedTo && args.assignedTo !== ctx.userId) {
        await assertAccessibleAssignee(ctx, args.assignedTo);
        ownerId = args.assignedTo;
      }

      // 4. Amount Validation
      const amount = Number(args.amount);
      if (isNaN(amount) || amount < 0) {
        throw new Error('Opportunity amount must be a positive number.');
      }

      const payload = {
        name: args.title.trim(),
        account_id: args.accountId,
        amount,
        stage: rawStage,
        close_date: args.closeDate,
        owner_id: ownerId,
      };

      // Opportunities table requires insert with select('id') due to selective column grants
      const { data: insertRes, error: insertError } = await ctx.supabase
        .from('opportunities')
        .insert([payload])
        .select('id')
        .single();

      if (insertError || !insertRes) {
        throw new Error(`Opportunity creation failed: ${insertError?.message || 'Insert rejected by RLS.'}`);
      }

      // Read back through authorized readable view
      const { data: oppRecord, error: readError } = await ctx.supabase
        .from('opportunities_readable')
        .select('*')
        .eq('id', insertRes.id)
        .single();

      if (readError || !oppRecord) {
        return { id: insertRes.id, ...payload };
      }

      return maskSensitiveFields(oppRecord, ctx.primaryRole);
    },
  },

  // 6. TASKS & ACTIVITIES
  {
    name: 'crm_list_my_tasks',
    description: 'List pending tasks and action items assigned to the authenticated user.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['not_started', 'in_progress', 'completed', 'cancelled'], description: 'Optional task status filter' },
        limit: { type: 'number', minimum: 1, maximum: 100, description: 'Max tasks to return (default 50, max 100)' },
      },
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'tasks.view');
      const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
      let query = ctx.supabase
        .from('activities')
        .select('*')
        .eq('activity_type', 'task')
        .eq('assigned_to_id', ctx.userId)
        .limit(limit);

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
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority' },
        leadId: { type: 'string', description: 'Associated lead ID' },
        assignedTo: { type: 'string', description: 'User ID to assign the task to (requires hierarchy access)' },
      },
      required: ['title'],
    },
    handler: async (args, ctx) => {
      requirePermission(ctx, 'tasks.create');

      let assignedTo = ctx.userId;
      if (args.assignedTo && args.assignedTo !== ctx.userId) {
        await assertAccessibleAssignee(ctx, args.assignedTo);
        assignedTo = args.assignedTo;
      }

      if (args.leadId) {
        // Validate lead accessibility under caller scope
        const { data: lead, error: leadError } = await ctx.supabase
          .from('leads')
          .select('id')
          .eq('id', args.leadId)
          .single();

        if (leadError || !lead) {
          throw new Error(`Associated lead ${args.leadId} not found or inaccessible under your organizational scope.`);
        }
      }

      const payload = {
        activity_type: 'task',
        subject: args.title.trim(),
        due_date: args.dueDate || null,
        priority: args.priority || 'medium',
        related_to_type: args.leadId ? 'lead' : null,
        related_to_id: args.leadId || null,
        assigned_to_id: assignedTo,
        created_by_id: ctx.userId,
        status: 'not_started',
      };

      const { data, error } = await ctx.supabase
        .from('activities')
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
    description: 'Get high-level CRM metrics scoped to user hierarchy and role via server-side aggregation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, ctx) => {
      // 1. Try server-side RPC for scalable aggregation
      const { data: rpcData, error: rpcError } = await ctx.supabase.rpc('get_dashboard_summary_stats');

      if (!rpcError && rpcData) {
        return {
          roleScope: ctx.primaryRole,
          totalLeadsInScope: Number(rpcData.totalLeadsInScope) || 0,
          activeOpportunities: Number(rpcData.activeOpportunities) || 0,
          totalPipelineValue: Number(rpcData.totalPipelineValue) || 0,
          closedWonRevenue: Number(rpcData.closedWonRevenue) || 0,
          pendingTasks: Number(rpcData.pendingTasks) || 0,
        };
      }

      // 2. Fallback if RPC migration not yet applied
      const [leadsCount, oppsData, tasksCount] = await Promise.all([
        ctx.supabase.from('leads').select('*', { count: 'exact', head: true }),
        ctx.supabase.from('opportunities_readable').select('amount, stage'),
        ctx.supabase.from('activities').select('*', { count: 'exact', head: true }).eq('activity_type', 'task').eq('assigned_to_id', ctx.userId).eq('status', 'not_started'),
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
      const entity = getDeletableEntity(args.entityType);
      const permKey = entity.permission;
      requirePermission(ctx, permKey);

      // Verify the record exists and is accessible before generating confirmation
      const { data, error } = await ctx.supabase.from(entity.table).select('id').eq('id', args.recordId).single();
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
      const entity = getDeletableEntity(args.entityType);
      const permKey = entity.permission;
      requirePermission(ctx, permKey);

      // Validates token ownership, expiration, and single-use
      consumeConfirmationToken(ctx.userId, args.confirmationToken, 'delete_record', { entityType: args.entityType, recordId: args.recordId });

      const { error } = await ctx.supabase.from(entity.table).delete().eq('id', args.recordId);
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
