'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { leadQueryKey } from '@/lib/leads/query-contract';

export function LeadRecovery({ onClose }: { onClose: () => void }) {
  const { user, hasPermission } = useAuth();
  const cache = useQueryClient();
  const [page, setPage] = useState(0);
  const archived = useQuery({
    queryKey: leadQueryKey(user?.id, 'archived', page),
    queryFn: async () => {
      const { data, error } = await createClient().rpc('lead_archived_list', { p_offset: page * 25 });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user && hasPermission('recycle_bin.view')),
  });
  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().rpc('lead_restore', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'list').slice(0, 3) }),
  });
  return <section className="space-y-3 rounded border bg-white p-4" aria-label="Deleted Leads">
    <div className="flex justify-between"><h2 className="font-semibold">Deleted Leads</h2><button type="button" onClick={onClose}>Close</button></div>
    {archived.isPending && <p role="status">Loading deleted Leads…</p>}
    {archived.isError && <p role="alert">Could not load deleted Leads.</p>}
    {restore.isError && <p role="alert">Could not restore this Lead.</p>}
    {archived.data?.length === 0 && <p>No deleted Leads on this page.</p>}
    <ul className="divide-y">
      {archived.data?.slice(0, 25).map(lead => <li key={lead.id} className="flex items-center justify-between gap-3 py-2">
        <span>{lead.title} <time className="ml-2 text-sm text-slate-600" dateTime={lead.archived_at}>{new Date(lead.archived_at).toLocaleDateString()}</time></span>
        {hasPermission('recycle_bin.restore') && <button type="button" disabled={restore.isPending}
          onClick={() => { if (window.confirm('Restore this Lead?')) restore.mutate(lead.id); }}>Restore</button>}
      </li>)}
    </ul>
    <div className="flex gap-4 text-sm">
      <button type="button" disabled={page === 0 || archived.isFetching} onClick={() => setPage(page - 1)}>Previous</button>
      <button type="button" disabled={(archived.data?.length ?? 0) <= 25 || archived.isFetching} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  </section>;
}
