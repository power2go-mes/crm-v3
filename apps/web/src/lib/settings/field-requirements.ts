import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';

export const requirementInput = z.object({ definition_id: z.string().uuid(), required: z.boolean() }).strict();
export async function saveFieldRequirement(client: SupabaseClient<Database>, input: z.input<typeof requirementInput>) {
  const value = requirementInput.parse(input);
  const { data, error } = await client.from('crm_field_requirements').upsert(value, { onConflict: 'definition_id' }).select('definition_id,required').single();
  if (error) throw new Error(error.message);
  return data;
}
export async function removeFieldRequirement(client: SupabaseClient<Database>, id: string) {
  z.string().uuid().parse(id);
  const { error } = await client.from('crm_field_requirements').delete().eq('definition_id', id).select('definition_id').single();
  if (error) throw new Error(error.message);
}
