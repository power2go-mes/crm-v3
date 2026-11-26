import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { createImport, importDraftInput, importRunInput, runImport, runImportBatches } from '../service';
const id = 'c0de0000-0000-4000-8000-000000000701';
const rpc = vi.fn();
const getUser = vi.fn();
const client = { auth: { getUser }, rpc } as unknown as SupabaseClient<Database>;
const batchProgress = { total_rows: 500, processed_rows: 250, complete: false, created_count: 250, updated_count: 0, error_count: 0, success_rate: 100, duration_seconds: 1, errors: [] };
beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id } }, error: null }); rpc.mockImplementation(async (name: string) => ({ data: name === 'has_effective_permission' ? true : name === 'run_lead_import' ? batchProgress : id, error: null })); });
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
  it('requests a bounded batch from the authenticated import job', async () => {
    await runImport(client, { job: id, mode: 'create', mapping: { email: 0 }, match: [] });
    expect(rpc).toHaveBeenCalledWith('run_lead_import', {
      p_job: id, p_mapping: { email: 0 }, p_mode: 'create', p_match: [], p_limit: 250,
    });
  });
  it('resumes bounded batches until the database reports completion', async () => {
    const runBatch = vi.fn()
      .mockResolvedValueOnce(batchProgress)
      .mockResolvedValueOnce({ ...batchProgress, processed_rows: 500, complete: true });
    const onProgress = vi.fn();
    const result = await runImportBatches(runBatch, 0, onProgress);
    expect(runBatch).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ complete: true, processed_rows: 500 });
  });
  it('stops if a resumable batch does not advance', async () => {
    await expect(runImportBatches(vi.fn().mockResolvedValue(batchProgress), 250, vi.fn()))
      .rejects.toThrow('did not advance');
  });
});
