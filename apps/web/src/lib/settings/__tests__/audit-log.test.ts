import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { loadAuditLog } from '../audit-log';
function fixture(error: unknown = null) {
  const range = vi.fn().mockResolvedValue({ data: [], count: 101, error });
  const order = vi.fn(); order.mockReturnValue({ order, range });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq, order });
  return { client: { from: () => ({ select }) } as unknown as SupabaseClient<Database>, range, eq };
}
describe('Audit history errors and pagination', () => {
  it('loads only a stable server-side page and keeps total count', async () => {
    const f = fixture();
    expect((await loadAuditLog(f.client, 'leads', 3)).count).toBe(101);
    expect(f.range).toHaveBeenCalledWith(100, 149); expect(f.eq).toHaveBeenCalledWith('module', 'leads');
  });
  it('throws on query failures rather than returning a fake empty history', async () => {
    await expect(loadAuditLog(fixture({ code: '42501' }).client, 'all', 1)).rejects.toThrow('could not be loaded');
    await expect(loadAuditLog(fixture().client, 'all', 0)).rejects.toThrow('Invalid');
  });
});
