import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { createImport, importDraftInput, importRunInput, runImport } from '../service';
const id = 'c0de0000-0000-4000-8000-000000000701';
const rpc = vi.fn();
const getUser = vi.fn();
const client = { auth: { getUser }, rpc } as unknown as SupabaseClient<Database>;
beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id } }, error: null }); rpc.mockImplementation(async (name: string) => ({ data: name === 'has_effective_permission' ? true : id, error: null })); });
describe('Import authorization and configuration', () => {
  it('retains an unfinished update-mode draft but rejects execution without match fields', () => {
    const draft = { job: id, mode: 'update', mapping: { email: 0 }, match: [] };
    expect(importDraftInput.safeParse(draft).success).toBe(true);
    expect(importRunInput.safeParse(draft).success).toBe(false);
  });
  it('rejects owner IDs, unmapped matches and update without matches', () => {
    expect(importRunInput.safeParse({ job: id, mode: 'create', mapping: { lead_owner_id: 0 }, match: [] }).success).toBe(false);
    expect(importRunInput.safeParse({ job: id, mode: 'update', mapping: { email: 0 }, match: [] }).success).toBe(false);
    expect(importRunInput.safeParse({ job: id, mode: 'both', mapping: { email: 0 }, match: ['phone'] }).success).toBe(false);
  });
  it('prepares real parsed rows without a browser actor or owner', async () => {
    const output = await createImport(client, ' Test ', 'test.csv', 'First Name,Last Name\nA,B');
    expect(output.total).toBe(1);
    expect(rpc).toHaveBeenCalledWith('create_lead_import', { p_name: 'Test', p_filename: 'test.csv', p_csv: 'First Name,Last Name\nA,B', p_headers: ['First Name', 'Last Name'], p_rows: [['A', 'B']] });
  });
  it('denies execution before mutation when any feature permission is missing', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(runImport(client, { job: id, mode: 'create', mapping: { email: 0 }, match: [] })).rejects.toThrow('Permission denied');
    expect(rpc.mock.calls.every(([name]) => name === 'has_effective_permission')).toBe(true);
  });
  it('does not fake processing when database rejects a job', async () => {
    rpc.mockImplementation(async (name: string) => name === 'has_effective_permission' ? { data: true, error: null } : { data: null, error: { code: '42501' } });
    await expect(runImport(client, { job: id, mode: 'create', mapping: { email: 0 }, match: [] })).rejects.toThrow('Permission denied');
  });
});
