import { describe, expect, it } from 'vitest';
import type { AuthenticatedUserContext } from '../src/auth.js';
import { crmTools } from '../src/tools.js';

function createContext(permissions: string[]) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const supabase = {
    from(table: string) {
      const result = { data: [], error: null, count: 0 };
      const query: any = {};
      for (const method of ['select', 'or', 'ilike', 'limit', 'eq', 'order', 'range', 'insert', 'update', 'delete']) {
        query[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return query;
        };
      }
      query.single = async () => ({ data: { id: 'record-id' }, error: null });
      query.then = (resolve: (value: typeof result) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
      return query;
    },
  };

  const context = {
    userId: 'user-id',
    email: 'user@example.test',
    fullName: 'Test User',
    roles: ['BDO'],
    primaryRole: 'BDO',
    managerId: null,
    permissions,
    supabase,
  } as unknown as AuthenticatedUserContext;

  return { context, calls };
}

function getTool(name: string) {
  const tool = crmTools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Missing MCP tool ${name}`);
  return tool;
}

describe('MCP tool database schema compatibility', () => {
  it('searches using columns that exist on the CRM tables', async () => {
    const { context, calls } = createContext(['leads.view', 'accounts.view', 'contacts.view', 'opportunities.view']);

    await getTool('crm_search_records').handler({ query: 'example' }, context);

    expect(calls.filter((call) => call.method === 'select').map((call) => call.args[0])).toEqual([
      'id, first_name, last_name, company_name, email, status',
      'id, name, industry, website, contact_number, account_type',
      'id, first_name, last_name, email, contact_number, title',
      'id, name, stage, amount, probability',
    ]);
    expect(calls.find((call) => call.table === 'leads' && call.method === 'or')?.args[0])
      .toContain('company_name.ilike.');
    expect(calls.find((call) => call.table === 'contacts_readable' && call.method === 'or')?.args[0])
      .toContain('email.ilike.');
    expect(calls.filter((call) => call.method === 'ilike').map((call) => [call.table, call.args[0]])).toEqual([
      ['accounts_readable', 'name'],
      ['opportunities_readable', 'name'],
    ]);
  });

  it('creates leads using the database column names and a required title', async () => {
    const { context, calls } = createContext(['leads.create']);

    await getTool('crm_create_lead').handler(
      { firstName: 'Ada', lastName: 'Lovelace', company: 'Analytical Engines' },
      context
    );

    const insert = calls.find((call) => call.table === 'leads' && call.method === 'insert');
    expect(insert?.args[0]).toEqual([
      expect.objectContaining({
        title: expect.any(String),
        company_name: 'Analytical Engines',
        lead_source: 'AI_AGENT_MCP',
        lead_owner_id: 'user-id',
        created_by_id: 'user-id',
      }),
    ]);
  });

  it('creates task records through activities with the application task fields', async () => {
    const { context, calls } = createContext(['tasks.create']);

    await getTool('crm_create_task').handler({ title: 'Follow up', leadId: 'lead-id' }, context);

    const insert = calls.find((call) => call.table === 'activities' && call.method === 'insert');
    expect(insert?.args[0]).toEqual([
      expect.objectContaining({
        activity_type: 'task',
        subject: 'Follow up',
        assigned_to_id: 'user-id',
        created_by_id: 'user-id',
        related_to_type: 'lead',
        related_to_id: 'lead-id',
        status: 'not_started',
        priority: 'medium',
      }),
    ]);
  });

  it('requires an opportunity close date and uses the database name field', async () => {
    const tool = getTool('crm_create_opportunity');
    const { context, calls } = createContext(['opportunities.create']);

    expect(tool.inputSchema.required).toContain('closeDate');
    await tool.handler(
      { title: 'New deal', accountId: 'account-id', amount: 10, closeDate: '2027-01-31' },
      context
    );

    const insert = calls.find((call) => call.table === 'opportunities' && call.method === 'insert');
    expect(insert?.args[0]).toEqual([
      expect.objectContaining({
        name: 'New deal',
        close_date: '2027-01-31',
      }),
    ]);
  });

  it('maps opportunity deletes to the actual table and permission', async () => {
    const { context, calls } = createContext(['opportunities.delete']);
    const prepared = await getTool('crm_prepare_delete_record').handler(
      { entityType: 'opportunity', recordId: 'record-id' },
      context
    );

    await getTool('crm_execute_delete_record').handler(
      {
        entityType: 'opportunity',
        recordId: 'record-id',
        confirmationToken: prepared.confirmationToken,
      },
      context
    );

    expect(calls.filter((call) => call.table === 'opportunities').some((call) => call.method === 'delete')).toBe(true);
    expect(calls.some((call) => call.table === 'opportunitys')).toBe(false);
  });
});
