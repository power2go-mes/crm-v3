import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
export async function loadLoginHistory(client: SupabaseClient<Database>, page: number, userId?: string) {
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('Invalid history page.');
  if (userId && !z.string().uuid().safeParse(userId).success) throw new Error('Invalid user filter.');
  let query = client.from('crm_login_history').select('id,user_id,login_at,user_agent,ip,expires_at,ended_at,event_type', { count: 'exact' });
  if (userId) query = query.eq('user_id', userId);
  const result = await query.order('login_at', { ascending: false }).order('id').range((page - 1) * 20, page * 20 - 1);
  if (result.error) throw new Error('Login history could not be loaded.');
  return { rows: result.data ?? [], count: result.count ?? 0 };
}
export function browserLabel(agent: string | null) {
  if (!agent) return 'Not available';
  for (const [pattern, name] of [[/Edg(?:e|A|iOS)?\/([\d.]+)/,'Edge'],[/OPR\/([\d.]+)/,'Opera'],[/(?:Firefox|FxiOS)\/([\d.]+)/,'Firefox'],[/(?:Chrome|CriOS)\/([\d.]+)/,'Chrome'],[/Version\/([\d.]+).*Safari/,'Safari']] as const) {
    const match = agent.match(pattern); if (match) { const prefix = agent.indexOf(')'); return `${name} ${match[1].split('.')[0]}${prefix >= 0 ? ' — ' + agent.slice(0, prefix + 1) : ''}`; }
  }
  return agent.length > 80 ? agent.slice(0, 77) + '…' : agent;
}
export function sessionIsActive(row: { ended_at: string | null; expires_at: string | null }, now = Date.now()) {
  return !row.ended_at && (!row.expires_at || Date.parse(row.expires_at) > now);
}
export function formatLoginTime(value: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).formatToParts(new Date(value));
  const get = (kind: string) => parts.find(part => part.type === kind)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toLowerCase() === 'am' ? 'a.m.' : 'p.m.'}`.toLowerCase();
}
