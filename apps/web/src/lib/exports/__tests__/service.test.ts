import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { availableExportColumns, centralExportCatalog, runCentralExport } from '../service';
import { centralExportRequest } from '../contract';
type Options = { denied?: string[]; hidden?: boolean; sensitive?: boolean; archive?: boolean; failRead?: boolean; revokeField?: boolean; many?: boolean };
function fixture(options: Options = {}) {
  let metadataCalls = 0;
  const selections: string[] = [];
  const pages: number[] = [];
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'has_effective_permission') return { data: !options.denied?.includes(String(args.p_permission_id)), error: null };
    metadataCalls++;
    return { data: { fields: options.hidden || (options.revokeField && metadataCalls > 1) ? [] : [{ key: 'email', access: 'readonly' }] }, error: null };
  });
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'fixture' } }, error: null }) }, rpc,
    from: (table: string) => ({ select: (selection: string) => {
      if (table === 'crm_field_definitions') return { eq: () => ({ limit: async () => ({ data: [{ key: 'email', sensitive: !!options.sensitive, archived: !!options.archive }], error: null }) }) };
      selections.push(`${table}:${selection}`);
      let cursor: string | undefined;
      const chain = { order: () => chain, gt: (_: string, value: string) => { cursor = value; return chain; }, limit: async (size: number) => {
        pages.push(size);
        const start = cursor ? Number.parseInt(cursor.slice(-12), 16) + 1 : 1;
        const length = options.many ? 250 : 1;
        return { data: Array.from({ length }, (_, i) => ({ id: `c0de0000-0000-4000-8000-${(start + i).toString(16).padStart(12, '0')}`, name: 'Account fixture', first_name: 'Lead fixture', email: 'fixture@example.invalid' })), error: options.failRead ? { code: '42501' } : null };
      } };
      return chain;
    } }),
  } as unknown as SupabaseClient<Database>;
  return { client, selections, pages, rpc };
}
describe('Central export authorization, fields and scope adapter', () => {
  it('rejects unknown tables, unapproved columns and duplicate module selections', () => {
    expect(centralExportRequest.safeParse({ modules: [{ module: 'user_profiles', columns: ['email'] }], format: 'csv' }).success).toBe(false);
    expect(centralExportRequest.safeParse({ modules: [{ module: 'leads', columns: ['created_by_id'] }], format: 'csv' }).success).toBe(false);
    expect(centralExportRequest.safeParse({ modules: [{ module: 'leads', columns: ['email'] }, { module: 'leads', columns: ['email'] }], format: 'csv' }).success).toBe(false);
  });
  it('requires both global and module export features, without SUPER_ADMIN assumptions', async () => {
    await expect(runCentralExport(fixture({ denied: ['exports.view'] }).client, { modules: [{ module: 'leads', columns: ['email'] }], format: 'csv' })).rejects.toThrow('Permission denied');
    const f = fixture({ denied: ['leads.export'] });
    await expect(runCentralExport(f.client, { modules: [{ module: 'leads', columns: ['email'] }], format: 'csv' })).rejects.toThrow('permission denied');
    expect(f.selections).toHaveLength(0);
    expect((await centralExportCatalog(f.client)).some(item => item.module === 'leads')).toBe(false);
  });
  it.each([{ hidden: true }, { sensitive: true }, { archive: true }])('denies configured hidden/sensitive/archived fields: %j', async options => {
    const f = fixture(options);
    expect((await availableExportColumns(f.client, 'fixture', 'leads')).some(column => column.key === 'email')).toBe(false);
    await expect(runCentralExport(f.client, { modules: [{ module: 'leads', columns: ['email'] }], format: 'csv' })).rejects.toThrow('field is unavailable');
    expect(f.selections).toHaveLength(0);
  });
  it('exports readonly readable fields and only explicitly selected scalar columns', async () => {
    const f = fixture();
    const file = await runCentralExport(f.client, { modules: [{ module: 'leads', columns: ['email'] }], format: 'csv' });
    expect(file.bytes.toString()).toContain('fixture@example.invalid'); expect(file.rows).toBe(1);
    expect(f.selections).toEqual(['leads:id,email']); expect(f.pages).toEqual([250]);
  });
  it('does not download a file after field revocation or failed scoped reads', async () => {
    await expect(runCentralExport(fixture({ revokeField: true }).client, { modules: [{ module: 'leads', columns: ['email'] }], format: 'csv' })).rejects.toThrow('permission changed');
    await expect(runCentralExport(fixture({ failRead: true }).client, { modules: [{ module: 'accounts', columns: ['name'] }], format: 'csv' })).rejects.toThrow('could not be loaded');
  });
  it('creates real multi-module ZIP output and rejects over-limit exports without truncation', async () => {
    const file = await runCentralExport(fixture().client, { modules: [{ module: 'accounts', columns: ['name'] }, { module: 'leads', columns: ['email'] }], format: 'xlsx' });
    expect(file.contentType).toBe('application/zip'); expect(file.bytes.readUInt32LE(0)).toBe(0x04034b50); expect(file.rows).toBe(2);
    await expect(runCentralExport(fixture({ many: true }).client, { modules: [{ module: 'accounts', columns: ['name'] }], format: 'csv' })).rejects.toThrow('no truncated file');
  });
});
