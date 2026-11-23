import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';

export const catalogKind = z.enum(['customer', 'team', 'partner']);
export type CatalogKind = z.infer<typeof catalogKind>;
export const roleCatalogs = {
  customer: { title: 'Customer Roles', singular: 'Customer Role', description: 'Define roles for the customer contacts you work with.' },
  team: { title: 'Team Roles', singular: 'Team Role', description: 'Define roles for members collaborating on team-selling deals.' },
  partner: { title: 'Partner Roles', singular: 'Partner Role', description: 'Define roles for the partner contacts you work with.' },
} as const;
export const catalogRoleInput = z.object({ kind: catalogKind, id: z.string().uuid().nullable(), name: z.string().trim().min(1).max(50), description: z.string().nullable() }).strict();
const catalogRow = z.object({ id: z.string().uuid(), name: z.string(), description: z.string().nullable() });
export type CatalogRole = z.infer<typeof catalogRow>;
export async function listCatalogRoles(client: SupabaseClient<Database>, kind: CatalogKind, search: string, page: number, sort: 'name' | 'description', ascending: boolean) {
  const input = z.object({ kind: catalogKind, search: z.string().max(200), page: z.number().int().min(1).max(100000), sort: z.enum(['name', 'description']), ascending: z.boolean() }).parse({kind,search,page,sort,ascending});
  const { data, error } = await client.rpc('settings_role_catalog', {p_kind: input.kind,p_search: input.search,p_page: input.page,p_sort: input.sort,p_ascending: input.ascending});
  if (error) throw new Error(error.message);
  return z.object({rows: z.array(catalogRow).max(20),count: z.number().int().nonnegative()}).parse(data);
}
export async function saveCatalogRole(client: SupabaseClient<Database>, input: z.input<typeof catalogRoleInput>) {
  const value = catalogRoleInput.parse(input);
  const {data,error} = await client.rpc('save_settings_role', {p_kind:value.kind,p_id:value.id,p_name:value.name,p_description:value.description});
  if (error) throw new Error(error.message);
  return data;
}
export async function deleteCatalogRole(client: SupabaseClient<Database>, kind: CatalogKind, id: string, confirmRelationships = false) {
  catalogKind.parse(kind); z.string().uuid().parse(id);
  const {error} = await client.rpc('delete_settings_role', {p_kind:kind,p_id:id,p_confirm_relationships:confirmRelationships});
  if (error) throw new Error(error.message);
}
