import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { loadSalesRegions, setSalesRegionActive } from '../sales-regions';
describe('Sales region read and update feedback', () => {
  it('bounds the database page and preserves totals', async () => {
    const range = vi.fn().mockResolvedValue({ data: [], count: 51, error: null });
    const order = vi.fn(); order.mockReturnValue({ order, range });
    const client = { from: () => ({ select: () => ({ order }) }) } as unknown as SupabaseClient<Database>;
    expect((await loadSalesRegions(client, 2)).count).toBe(51); expect(range).toHaveBeenCalledWith(20, 39);
  });
  it('shows query failures instead of an empty list', async () => {
    const order = vi.fn(); order.mockReturnValue({ order, range: async () => ({ error: { code: '42501' } }) });
    const client = { from: () => ({ select: () => ({ order }) }) } as unknown as SupabaseClient<Database>;
    await expect(loadSalesRegions(client, 1)).rejects.toThrow('could not be loaded');
  });
  it('rejects a zero-row/unauthorized toggle response', async () => {
    const client = { from: () => ({ update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ error: { code: 'PGRST116' } }) }) }) }) }) } as unknown as SupabaseClient<Database>;
    await expect(setSalesRegionActive(client, 'fixture', false)).rejects.toThrow('Check permission');
  });
});
