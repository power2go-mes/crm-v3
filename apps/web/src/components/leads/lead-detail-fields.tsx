'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/components/providers/auth-provider';
import { useLeadPreferences } from '@/hooks/use-lead-preferences';
import { leadQueryKey } from '@/lib/leads/query-contract';
import { createClient } from '@/lib/supabase/client';
import type { LeadWithRelations } from '@/types/leads';
import { INDUSTRY_CHOICES, LEAD_SOURCES } from '@/types/leads';

function person(value: LeadWithRelations['lead_owner']) {
  return value ? [value.first_name, value.last_name].filter(Boolean).join(' ') : '';
}

function standardFields(lead: LeadWithRelations) {
  return [
    ['title', 'Title', lead.title], ['first_name', 'First Name', lead.first_name], ['last_name', 'Last Name', lead.last_name],
    ['lead_owner', 'Lead Owner', person(lead.lead_owner)], ['sub_owner', 'Assigned BDO', person(lead.sub_owner)],
    ['email', 'Email', lead.email], ['phone', 'Contact Number', lead.phone], ['fax', 'Fax', lead.fax],
    ['lead_source', 'Lead Source', LEAD_SOURCES.find(choice => choice.value === lead.lead_source)?.label ?? lead.lead_source],
    ['company_name', 'Lead Company', lead.company_name], ['no_of_employees', 'Total Employees', lead.no_of_employees],
    ['industry', 'Industry', INDUSTRY_CHOICES.find(choice => choice.value === lead.industry)?.label ?? lead.industry],
    ['annual_revenue', 'Annual Revenue', lead.annual_revenue], ['country', 'Country', lead.country], ['state', 'State', lead.state],
    ['city', 'City', lead.city], ['zip_code', 'Zip', lead.zip_code], ['requirements', 'Requirements', lead.requirements],
    ['lead_score', 'Lead Score', lead.lead_score],
  ] as const;
}
const metadataSchema = z.object({ fields: z.array(z.object({ key: z.string(), label: z.string(), is_custom: z.boolean() })) });

export function LeadDetailFields({ lead, onEdit }: { lead: LeadWithRelations; onEdit: () => void }) {
  const { user, hasPermission, permissions, roleIds } = useAuth();
  const cache = useQueryClient();
  const preferences = useLeadPreferences();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [message, setMessage] = useState('');
  const canView = Boolean(user && hasPermission('leads.view'));
  const fields = useQuery({
    queryKey: leadQueryKey(user?.id, 'detail-fields', lead.id, [...permissions, ...roleIds].sort()),
    enabled: canView,
    queryFn: async () => {
      const client = createClient();
      const [definitions, allowed, values] = await Promise.all([
        client.from('crm_field_definitions').select('key').eq('module', 'leads'),
        client.rpc('crm_shared_metadata', { m: 'leads' }),
        client.rpc('crm_shared_values', { m: 'leads', rid: lead.id }),
      ]);
      if (definitions.error || allowed.error || values.error) throw new Error('Lead field configuration is unavailable.');
      return { registered: definitions.data.map(row => row.key), allowed: metadataSchema.parse(allowed.data).fields,
        values: z.record(z.unknown()).parse(values.data) };
    },
  });
  const preference = preferences.data?.preferences.find(row => row.context === '' && row.url_name === 'leads_detail')?.state;
  const stored = z.array(z.string()).safeParse(preference?.hiddenFields);
  const hidden = stored.success ? stored.data : [];
  const save = useMutation({
    mutationFn: async (hiddenFields: string[]) => {
      const result = await createClient().rpc('crm_shared_preferences', {
        m: 'leads', ctx: '', url: 'leads_detail', s: { hiddenFields },
      });
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'preferences') });
      setDraft(null);
      setMessage('Fields saved.');
    },
  });
  const registry = fields.data;
  const visibleFields = registry ? [
    ...standardFields(lead).filter(([key]) => !registry.registered.includes(key) || registry.allowed.some(field => field.key === key)),
    ...registry.allowed.filter(field => field.is_custom).map(field => [field.key, field.label, registry.values[field.key]] as const),
  ] : [];

  return <div className="space-y-5 rounded-xl bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <span>Last edited {new Date(lead.updated_at).toLocaleString()}</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!registry || !preferences.isSuccess} onClick={() => { setMessage(''); save.reset(); setDraft(hidden); }} className="inline-flex items-center gap-2 rounded bg-emerald-50 px-3 py-2 text-emerald-800"><SlidersHorizontal size={14}/>Fields</button>
        {hasPermission('leads.update') && <button type="button" onClick={onEdit} className="rounded bg-emerald-50 px-4 py-2 text-emerald-800">Edit Details</button>}
      </div>
    </div>
    {message && <p role="status">{message}</p>}
    {fields.isPending && <p role="status">Loading Lead fields…</p>}
    {fields.isError && <p role="alert">Lead fields unavailable. <button type="button" className="underline" onClick={() => void fields.refetch()}>Retry</button></p>}
    {draft && <fieldset className="space-y-3 rounded border p-4">
      <legend className="px-1 font-medium">Show fields</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleFields.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={save.isPending} checked={!draft.includes(key)}
            onChange={event => setDraft(event.target.checked ? draft.filter(value => value !== key) : [...draft, key])} />{label}
        </label>)}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <button type="button" disabled={save.isPending} className="text-emerald-800" onClick={() => save.mutate(draft)}>Save</button>
        <button type="button" disabled={save.isPending} onClick={() => setDraft([])}>Reset</button>
        <button type="button" disabled={save.isPending} onClick={() => setDraft(null)}>Cancel</button>
      </div>
      {save.isError && <p role="alert">Field preferences could not be saved.</p>}
    </fieldset>}
    <dl className="grid gap-x-5 gap-y-6 sm:grid-cols-2">
      {visibleFields.filter(([key]) => !hidden.includes(key)).map(([key, label, value]) => <div key={key}>
        <dt className="mb-2 text-sm text-slate-800">{label}</dt>
        <dd className="min-h-10 break-words whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">{Array.isArray(value) ? value.join(', ') : value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
      </div>)}
    </dl>
  </div>;
}
