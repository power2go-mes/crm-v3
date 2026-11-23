import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';

export async function loadAuditLog(client: SupabaseClient<Database>, module: string, page: number) {
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('Invalid audit page.');
  let query = client.from('crm_history_events').select('*', { count: 'exact' });
  if (module !== 'all') query = query.eq('module', module);
  const { data, count, error } = await query.order('occurred_at', { ascending: false }).order('id').range((page - 1) * 50, page * 50 - 1);
  if (error) throw new Error('Audit history could not be loaded. Check access or retry.');
  return { rows: data ?? [], count: count ?? 0 };
}
