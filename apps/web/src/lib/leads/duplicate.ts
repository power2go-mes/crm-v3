import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import type { LeadInsert, LeadWithRelations } from '@/types/leads';

const fields = ['title', 'first_name', 'last_name', 'email', 'phone', 'fax', 'lead_source',
  'company_name', 'no_of_employees', 'industry', 'annual_revenue', 'country', 'state',
  'city', 'zip_code', 'requirements'] as const satisfies readonly (keyof LeadInsert)[];

export async function leadDuplicateDraft(lead: LeadWithRelations) {
  const client = createClient();
  const [registry, visible] = await Promise.all([
    client.from('crm_field_definitions').select('key').eq('module', 'leads'),
    client.rpc('crm_shared_metadata', { m: 'leads' }),
  ]);
  if (registry.error || visible.error) throw new Error('Lead field permissions could not be loaded.');
  const registered = new Set(registry.data.map(row => row.key));
  const allowed = new Set(z.object({ fields: z.array(z.object({ key: z.string(), access: z.string() })) })
    .parse(visible.data).fields.filter(field => field.access === 'write').map(field => field.key));
  const draft: Record<string, string> = {};
  for (const key of fields) {
    const value = lead[key];
    if (value != null && (!registered.has(key) || allowed.has(key))) draft[key] = String(value);
  }
  return draft;
}
