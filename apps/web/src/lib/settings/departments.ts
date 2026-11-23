import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';

export const departmentInput = z.object({
  id: z.string().uuid().nullable(),
  department_name: z.string().trim().min(1, 'Department Name is required').max(50),
  description: z.string().nullable(),
}).strict();
export type Department = Database['public']['Tables']['departments']['Row'];

export async function saveDepartment(client: SupabaseClient<Database>, input: z.input<typeof departmentInput>) {
  const value = departmentInput.parse(input);
  const { data, error } = await client.rpc('save_department', {
    p_id: value.id, p_name: value.department_name, p_description: value.description,
  });
  if (error) throw new Error(error.code === '23505' ? 'A Department with this name already exists.' : error.message);
  return data;
}

export async function setDepartmentDeleted(client: SupabaseClient<Database>, id: string, deleted: boolean) {
  z.string().uuid().parse(id);
  const { error } = await client.rpc('set_department_deleted', { p_id: id, p_deleted: deleted });
  if (error) throw new Error(error.code === '23505' ? 'Another active Department uses this name. Rename it before restoring.' : error.message);
}
