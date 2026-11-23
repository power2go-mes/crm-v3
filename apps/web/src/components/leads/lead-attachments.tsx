'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { leadQueryKey } from '@/lib/leads/query-contract';
import { createClient } from '@/lib/supabase/client';

import { leadAttachmentPath } from '@/lib/leads/attachment-path';
const pageSize = 25;
const previewTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

function filename(name: string) {
  return name.replace(/^[a-f0-9-]{36}_/i, '');
}

export function LeadAttachments({ leadId }: { leadId: string }) {
  const { user, hasPermission, permissions, roleIds } = useAuth();
  const cache = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ url: string; name: string }>();
  const [removal, setRemoval] = useState<string>();
  const client = () => createClient().storage.from('lead-attachments');
  const prefix = leadQueryKey(user?.id, 'attachments', leadId);
  const canUpdate = hasPermission('leads.update');

  const files = useQuery({
    queryKey: [...prefix, [...permissions, ...roleIds].sort(), page],
    enabled: Boolean(user && hasPermission('leads.view')),
    queryFn: async () => {
      const response = await client().list(leadId, { limit: pageSize + 1, offset: page * pageSize, sortBy: { column: 'name', order: 'asc' } });
      if (response.error) throw response.error;
      return response.data;
    },
  });
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  async function refreshAfterChange() {
    setPage(0);
    await Promise.all([
      cache.invalidateQueries({ queryKey: prefix }),
      cache.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'history', leadId) }),
    ]);
  }

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = leadAttachmentPath(leadId, file, crypto.randomUUID());
      const result = await client().upload(path, file, { upsert: false, cacheControl: '0' });
      if (result.error) throw new Error('Upload failed. Check your access and try again.');
    },
    onSuccess: refreshAfterChange,
    onError: error => setError(error.message),
  });
  const remove = useMutation({
    mutationFn: async (name: string) => {
      const path = `${leadId}/${name}`;
      const storage = client();
      const prepared = await createClient().rpc('prepare_lead_attachment_removal', { p_lead_id: leadId, p_name: name });
      if (prepared.error) throw new Error('Attachment removal could not be prepared.');
      const result = await storage.remove([path]);
      if (result.error) throw new Error('Removal could not be confirmed. Refresh the attachment list before retrying.');
      const remaining = await storage.exists(path);
      if (remaining.data !== false) throw new Error('The attachment is still available. Try removing it again.');
      if (!result.data?.length) {
        // Storage also reports an empty result for rows hidden by RLS.
        const lead = await createClient().from('leads').select('id').eq('id', leadId).maybeSingle();
        if (lead.error || !lead.data) {
          throw new Error('Removal could not be confirmed because Lead access changed.');
        }
      }
    },
    onSuccess: async () => { setRemoval(undefined); setPreview(undefined); await refreshAfterChange(); },
    onError: error => {
      setError(error.message);
      void refreshAfterChange();
    },
  });
  const download = useMutation({
    mutationFn: async ({ name, show }: { name: string; show: boolean }) => {
      const result = await client().download(`${leadId}/${name}`, { cacheNonce: crypto.randomUUID() });
      if (result.error) throw new Error('Attachment could not be opened.');
      if (show && !previewTypes.includes(result.data.type)) throw new Error('Preview is unavailable. Download the attachment to view it.');
      const url = URL.createObjectURL(result.data);
      if (show) {
        setPreview({ url, name: filename(name) });
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename(name);
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
    onError: error => setError(error.message),
  });

  return <section className="space-y-3 border-t border-slate-200 pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-medium">Attachments</h3>
      {canUpdate && <>
        <input ref={input} type="file" hidden aria-label="Attachment file" onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) { setError(''); upload.mutate(file); }
        }} />
        <button type="button" disabled={upload.isPending} className="rounded bg-indigo-100 px-3 py-2 text-sm text-indigo-700" onClick={() => input.current?.click()}>
          {upload.isPending ? 'Uploading…' : 'Upload File'}
        </button>
      </>}
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {files.isPending ? <p role="status">Loading attachments…</p>
      : files.isError ? <p role="alert">Attachments unavailable. <button type="button" className="underline" onClick={() => void files.refetch()}>Retry</button></p>
      : !files.data.length ? <p className="text-sm text-slate-500">No attachments found.</p>
      : <ul className="divide-y">{files.data.slice(0, pageSize).map(file => <li key={file.id ?? file.name} className="flex flex-wrap items-center gap-3 py-2 text-sm">
        <span className="min-w-0 flex-1 break-all">{filename(file.name)}</span>
        {previewTypes.includes(String(file.metadata?.mimetype)) && <button type="button" disabled={download.isPending} onClick={() => { setError(''); download.mutate({ name: file.name, show: true }); }}>View</button>}
        <button type="button" disabled={download.isPending} onClick={() => { setError(''); download.mutate({ name: file.name, show: false }); }}>Download</button>
        {canUpdate && <button type="button" className="text-red-700" onClick={() => { setError(''); setRemoval(file.name); }}>Remove</button>}
      </li>)}</ul>}
    {(page > 0 || (files.data?.length ?? 0) > pageSize) && <div className="flex gap-3 text-sm">
      <button type="button" disabled={page === 0 || files.isFetching} onClick={() => setPage(page - 1)}>Previous attachments</button>
      <button type="button" disabled={(files.data?.length ?? 0) <= pageSize || files.isFetching} onClick={() => setPage(page + 1)}>Next attachments</button>
    </div>}
    {preview && <figure className="space-y-2 rounded border p-3">
      {/* Blob URLs are local and do not go through the Next.js image optimizer. */}
      <img src={preview.url} alt={preview.name} className="max-h-96 max-w-full" />
      <button type="button" onClick={() => setPreview(undefined)}>Close preview</button>
    </figure>}
    {removal && <div className="flex flex-wrap items-center gap-3 rounded border p-3">
      <p>Remove {filename(removal)}?</p>
      <button type="button" disabled={remove.isPending} className="text-red-700" onClick={() => remove.mutate(removal)}>Confirm removal</button>
      <button type="button" disabled={remove.isPending} onClick={() => setRemoval(undefined)}>Cancel</button>
    </div>}
  </section>;
}
