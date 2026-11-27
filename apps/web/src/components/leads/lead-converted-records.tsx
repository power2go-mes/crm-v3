'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { leadQueryKey } from '@/lib/leads/query-contract';
import type { LeadWithRelations } from '@/types/leads';

export function LeadConvertedRecords({ lead }: { lead: LeadWithRelations }) {
  const { user, hasPermission } = useAuth();
  const { converted_account_id: accountId, converted_contact_id: contactId, converted_opportunity_id: opportunityId } = lead;
  const account = Boolean(accountId && hasPermission('accounts.view'));
  const contact = Boolean(contactId && hasPermission('contacts.view'));
  const opportunity = Boolean(opportunityId && hasPermission('opportunities.view'));
  const related = useQuery({
    queryKey: leadQueryKey(user?.id, 'conversion-records', lead.id, accountId, contactId, opportunityId, account, contact, opportunity),
    enabled: Boolean(user && lead.is_convert && (account || contact || opportunity)),
    queryFn: async () => {
      const client = createClient();
      const [a, c, o] = await Promise.all([
        account && accountId ? client.from('accounts').select('id,name').eq('id', accountId).maybeSingle() : null,
        contact && contactId ? client.from('contacts').select('id,first_name,last_name').eq('id', contactId).maybeSingle() : null,
        opportunity && opportunityId ? client.from('opportunities').select('id,name').eq('id', opportunityId).maybeSingle() : null,
      ]);
      return {
        failed: Boolean(a?.error || c?.error || o?.error),
        records: [
          ...(a?.data ? [{path:'accounts', label:'Account', id:a.data.id, name:a.data.name}] : []),
          ...(c?.data ? [{path:'contacts', label:'Contact', id:c.data.id, name:[c.data.first_name,c.data.last_name].filter(Boolean).join(' ')}] : []),
          ...(o?.data ? [{path:'opportunities', label:'Opportunity', id:o.data.id, name:o.data.name}] : []),
        ],
      };
    },
  });

  return <div className="space-y-4 rounded-xl bg-white p-6">
    {!lead.is_convert ? <p>This Lead has not been converted.</p>
      : !accountId && !contactId && !opportunityId ? <p>No conversion records were recorded for this Lead.</p>
      : related.isFetching && !related.data ? <p role="status">Loading related records…</p>
      : <>
        {related.data?.failed && <p role="alert">Some related records could not be loaded. <button type="button" className="underline" onClick={() => void related.refetch()}>Retry</button></p>}
        {related.data?.records.length ? <ul className="grid gap-3 sm:grid-cols-3">
          {related.data.records.map(record => <li key={record.path} className="rounded-lg border p-4">
            <div className="text-sm text-slate-600">{record.label}</div>
            <Link className="text-[#4361ee] hover:underline" href={`/${record.path}/${record.id}`}>{record.name || record.label}</Link>
          </li>)}
        </ul> : !related.data?.failed && <p>No conversion records are available to view.</p>}
      </>}
  </div>;
}
