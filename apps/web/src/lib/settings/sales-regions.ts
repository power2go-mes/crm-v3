import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
export async function loadSalesRegions(client: SupabaseClient<Database>, page: number) {
  if (!Number.isInteger(page) || page < 1) throw new Error('Invalid region page.');
  const { data, count, error } = await client.from('sales_regions').select('*', { count: 'exact' }).order('name').order('id').range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error('Sales regions could not be loaded.');
  return { rows: data ?? [], count: count ?? 0 };
}
export async function setSalesRegionActive(client: SupabaseClient<Database>, id: string, active: boolean) {
  const { error } = await client.from('sales_regions').update({ is_active: active }).eq('id', id).select('id').single();
  if (error) throw new Error('Region could not be updated. Check permission and retry.');
}
