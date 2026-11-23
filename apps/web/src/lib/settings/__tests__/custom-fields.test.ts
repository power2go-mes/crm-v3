import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { customFieldInput, putCustomField, archiveCustomField } from '../custom-fields';
const input = { id: 'c0de0000-0000-4000-8000-000000000621', module: 'leads', key: 'custom_choice', label: 'Choice', type: 'single_choice', required: false, order: 0, choices: ['A', 'B'] };
describe('Custom Field editing safety', () => {
  it('validates real source choice types, unique options and label safety', () => {
    expect(customFieldInput.safeParse(input).success).toBe(true);
    expect(customFieldInput.safeParse({ ...input, choices: [] }).success).toBe(false);
    expect(customFieldInput.safeParse({ ...input, choices: ['A', 'A'] }).success).toBe(false);
    expect(customFieldInput.safeParse({ ...input, label: '<script>' }).success).toBe(false);
    expect(customFieldInput.safeParse({ ...input, order: -1 }).success).toBe(false);
  });
  it('uses existing definition and archival RPCs without destructive table deletes', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: input.id, error: null });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    await putCustomField(client, input);
    await archiveCustomField(client, input.id);
    expect(rpc).toHaveBeenCalledWith('crm_shared_put_definition', { payload: input });
    expect(rpc).toHaveBeenCalledWith('crm_shared_delete_definition', { fid: input.id });
  });
  it('surfaces existing-value migration requirements instead of reporting success', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'Migrate existing values before changing field type/choices' } });
    await expect(putCustomField({ rpc } as unknown as SupabaseClient<Database>, input)).rejects.toThrow('Migrate existing values');
  });
});
