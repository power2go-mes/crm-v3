import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { requirementInput, saveFieldRequirement, removeFieldRequirement } from '../field-requirements';
const id = 'c0de0000-0000-4000-8000-000000000611';
describe('Field Requirement API boundary', () => {
  it('rejects truthy string booleans and forged metadata fields', () => {
    expect(requirementInput.safeParse({ definition_id: id, required: 'false' }).success).toBe(false);
    expect(requirementInput.safeParse({ definition_id: id, required: false, relaxable: true }).success).toBe(false);
  });
  it('preserves a real false value and waits for a persisted record', async () => {
    const single = vi.fn().mockResolvedValue({ data: { definition_id: id, required: false }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    const client = { from: vi.fn().mockReturnValue({ upsert }) } as unknown as SupabaseClient<Database>;
    await expect(saveFieldRequirement(client, { definition_id: id, required: false })).resolves.toEqual({ definition_id: id, required: false });
    expect(upsert).toHaveBeenCalledWith({ definition_id: id, required: false }, { onConflict: 'definition_id' });
  });
  it('surfaces zero-row/unauthorized deletion rather than fake success', async () => {
    const single = vi.fn().mockResolvedValue({ error: { message: 'No authorized record' } });
    const eq = vi.fn().mockReturnValue({ select: () => ({ single }) });
    const client = { from: () => ({ delete: () => ({ eq }) }) } as unknown as SupabaseClient<Database>;
    await expect(removeFieldRequirement(client, id)).rejects.toThrow('No authorized record');
    expect(eq).toHaveBeenCalledWith('definition_id', id);
  });
});
