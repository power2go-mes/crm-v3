import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';

export const customFieldInput = z.object({
  id: z.string().uuid(), module: z.string().regex(/^[a-z][a-z0-9_]*$/),
  key: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/),
  label: z.string().trim().min(1).max(255).refine(value => !/[<>]/.test(value), 'HTML is not allowed in Field Name.'),
  type: z.enum(['small_text', 'large_text', 'number', 'choice', 'single_choice', 'date', 'datetime']),
  required: z.boolean(), order: z.number().int().min(0),
  choices: z.array(z.string().trim().min(1).max(255)).max(200),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.choices).size !== value.choices.length) ctx.addIssue({ code: 'custom', message: 'Choices must be unique.' });
  if (['choice', 'single_choice'].includes(value.type) && !value.choices.length) ctx.addIssue({ code: 'custom', message: 'Choices are required for choice fields.' });
});
export async function putCustomField(client: SupabaseClient<Database>, input: unknown) {
  const value = customFieldInput.parse(input);
  const { data, error } = await client.rpc('crm_shared_put_definition', { payload: value });
  if (error) throw new Error(error.message);
  return data;
}
export async function archiveCustomField(client: SupabaseClient<Database>, id: string) {
  z.string().uuid().parse(id);
  const { error } = await client.rpc('crm_shared_delete_definition', { fid: id });
  if (error) throw new Error(error.message);
}
