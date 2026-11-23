'use server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
const input = z.object({
  id: z.string().uuid().optional(), title: z.string().trim().max(100),
  first_name: z.string().trim().min(1).max(80), last_name: z.string().trim().min(1).max(80),
  email: z.string().email().max(100),
  contact_number: z.string().trim().max(40), secondary_contact_number: z.string().trim().max(40),
  parent_contact_id: z.union([z.string().uuid(),z.literal('')]).optional(),
  is_primary: z.boolean().optional(),
  relationships: z.array(z.object({account_id:z.string().uuid(),role_id:z.string().uuid().nullable().optional()}).strict()).max(100).optional(),
}).strict();
export async function saveContact(value: unknown): Promise<{ id?: string; error?: string }> {
  const parsed = input.safeParse(value);
  if (!parsed.success) return { error: 'Check required names, email and field lengths.' };
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { error: 'Authentication required.' };
  const { id, relationships, ...fields } = parsed.data;
  const permission = await client.rpc('has_effective_permission', { p_user_id: user.id, p_permission_id: id ? 'contacts.update' : 'contacts.create' });
  if (permission.error || permission.data !== true) return { error: 'Permission denied.' };
  const result = await client.rpc('save_contact_atomic', {cid:id ?? null,fields,relationships:relationships ?? null});
  if (result.error) return { error: 'Contact could not be saved. Check access and try again.' };
  return { id: result.data };
}
