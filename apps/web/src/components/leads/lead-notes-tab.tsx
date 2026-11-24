'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { useLeadActivities } from '@/hooks/use-leads';
import { leadQueryKey } from '@/lib/leads/query-contract';
import { leadAttachmentPath } from '@/lib/leads/attachment-path';
import { createClient } from '@/lib/supabase/client';
import { LeadAttachments } from './lead-attachments';

function NoteBody({ body }: { body: string }) {
  // React escapes each fragment. Note content never becomes executable HTML.
  return <p className="whitespace-pre-wrap break-words text-sm">{body.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((text, index) =>
    text.startsWith('**') && text.endsWith('**') && text.length > 4
      ? <strong key={index}>{text.slice(2, -2)}</strong>
      : text.startsWith('*') && text.endsWith('*') && text.length > 2
        ? <em key={index}>{text.slice(1, -1)}</em>
        : text)}</p>;
}

const blank = { id: '', title: '', body: '' };

export function LeadNotesTab({ leadId }: { leadId: string }) {
  const { user, hasPermission, roleIds, permissions } = useAuth();
  const cache = useQueryClient();
  const canEdit = hasPermission('leads.update');
  const legacy = useLeadActivities(leadId);
  const key = leadQueryKey(user?.id, 'notes', leadId, [...roleIds, ...permissions].sort());
  const [draft, setDraft] = useState<typeof blank>();
  const [file, setFile] = useState<File>();
  const retry = useRef<{ id: string; path: string; uploaded: boolean } | null>(null);
  const [removal, setRemoval] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editor = useRef<HTMLTextAreaElement>(null);
  const notes = useQuery({
    queryKey: key,
    enabled: Boolean(user && hasPermission('leads.view')),
    queryFn: async () => {
      const result = await createClient().from('lead_notes').select('id,title,body').eq('lead_id', leadId)
        .order('created_at', { ascending: false }).order('id').limit(100);
      if (result.error) throw result.error;
      return result.data;
    },
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || busy || !draft.title.trim()) return;
    setBusy(true);
    setError('');
    try {
      const client = createClient();
      const table = client.from('lead_notes');
      const storage = client.storage.from('lead-attachments');
      const values = { title: draft.title.trim(), body: draft.body };
      if (draft.id) {
        const result = await table.update(values).eq('id', draft.id).eq('lead_id', leadId).select('id').single();
        if (result.error) throw result.error;
      } else if (file) {
        const id = retry.current?.id ?? crypto.randomUUID();
        const attempt = retry.current ?? { id, path: leadAttachmentPath(leadId, file, id), uploaded: false };
        retry.current = attempt;
        if (!attempt.uploaded) {
          const pending = await client.rpc('begin_lead_pending_attachment', {
            p_submission_id: id, p_lead_id: leadId, p_name: attempt.path.slice(leadId.length + 1),
          });
          if (pending.error) throw new Error('The combined submission could not be prepared.');

          const upload = await storage.upload(attempt.path, file, { upsert: false, cacheControl: '0' });
          if (upload.error && (await storage.info(attempt.path)).error) {
            throw new Error('Upload could not be confirmed. Retry Save before leaving the form.');
          }
          attempt.uploaded = true;
        }
        const inserted = await table.insert({ id, ...values, lead_id: leadId }).select('id').single();
        if (inserted.error) {
          const existing = await table.select('id,title,body').eq('id', id).eq('lead_id', leadId).maybeSingle();
          if (existing.error || (inserted.status === 0 && !existing.data)) {
            throw new Error('Note save could not be confirmed. Retry Save before leaving the form.');
          }
          if (existing.data && (existing.data.title !== values.title || existing.data.body !== values.body)) {
            throw new Error('The existing note differs from this submission. Refresh the Lead before trying again.');
          }
          if (!existing.data) {
            const prepared = await client.rpc('prepare_lead_attachment_removal', {
              p_lead_id: leadId, p_name: attempt.path.slice(leadId.length + 1),
            });
            if (prepared.error) throw new Error('File cleanup could not be prepared. Retry Save before leaving the form.');
            const removal = await storage.remove([attempt.path]);
            if (removal.error || !removal.data?.length) {
              throw new Error('Note save failed and file cleanup could not be confirmed. Retry Save before leaving the form.');
            }
            retry.current = null;
            throw new Error('Note could not be saved. The uploaded file was removed.');
          }
        }
      } else {
        const result = await table.insert({ ...values, lead_id: leadId }).select('id').single();
        if (result.error) throw result.error;
      }
      retry.current = null;
      setFile(undefined);
      setDraft(undefined);
      await Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        cache.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'attachments', leadId) }),
        cache.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'history', leadId) }),
      ]);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Note could not be saved.'); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true);
    setError('');
    try {
      const result = await createClient().from('lead_notes').delete().eq('id', id).eq('lead_id', leadId).select('id').single();
      if (result.error) throw result.error;
      setRemoval(undefined);
      await Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        cache.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'history', leadId) }),
      ]);
    } catch { setError('Note could not be removed.'); }
    finally { setBusy(false); }
  }

  function format(marker: string) {
    if (!draft || !editor.current) return;
    const { selectionStart, selectionEnd } = editor.current;
    const selected = draft.body.slice(selectionStart, selectionEnd);
    const body = draft.body.slice(0, selectionStart) + marker + selected + marker + draft.body.slice(selectionEnd);
    if (body.length <= 20000) setDraft({ ...draft, body });
  }

  return <div className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold">Notes and Attachments</h2>
      {canEdit && !draft && <button type="button" onClick={() => { setError(''); setDraft(blank); }}>Add Note</button>}
    </div>
    {canEdit && draft && <form onSubmit={event => void save(event)} className="space-y-3 rounded-lg border p-4">
      <label className="block">Title<input required maxLength={255} value={draft.title}
        disabled={busy || Boolean(retry.current)} onChange={event => setDraft({ ...draft, title: event.target.value })} className="block w-full rounded border p-2" /></label>
      {!draft.id && <label className="block">Attachment<input type="file" disabled={busy || Boolean(retry.current)}
        onChange={event => setFile(event.target.files?.[0])} className="block" /></label>}
      <div className="flex gap-4 text-sm">
        <button type="button" disabled={busy || Boolean(retry.current)} onMouseDown={event => event.preventDefault()} onClick={() => format('**')}>Bold</button>
        <button type="button" disabled={busy || Boolean(retry.current)} onMouseDown={event => event.preventDefault()} onClick={() => format('*')}>Italic</button>
      </div>
      <label className="block">Notes<textarea ref={editor} maxLength={20000} value={draft.body}
        disabled={busy || Boolean(retry.current)} onChange={event => setDraft({ ...draft, body: event.target.value })} className="block w-full rounded border p-2" /></label>
      <NoteBody body={draft.body} />
      <button disabled={busy || !draft.title.trim()} className="mr-4 rounded bg-emerald-600 px-3 py-2 text-white">Save Note</button>
      <button type="button" disabled={busy || Boolean(retry.current)} onClick={() => { setFile(undefined); setDraft(undefined); }}>Cancel</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {(notes.isError || legacy.isError) && <p role="alert">Some notes could not be loaded.</p>}
    {notes.isPending && <p role="status">Loading notesâ€¦</p>}
    {notes.data?.map(note => <article key={note.id} className="space-y-2 rounded border p-4">
      <h3 className="font-medium">{note.title}</h3><NoteBody body={note.body} />
      {canEdit && <div className="flex gap-4 text-sm">
        <button type="button" disabled={busy || Boolean(draft)} onClick={() => { setError(''); setDraft(note); }}>Edit Note</button>
        <button type="button" disabled={busy} onClick={() => setRemoval(note.id)}>Remove Note</button>
      </div>}
      {removal === note.id && <div className="flex gap-4 text-sm">
        <button type="button" disabled={busy} onClick={() => void remove(note.id)}>Confirm removal</button>
        <button type="button" disabled={busy} onClick={() => setRemoval(undefined)}>Cancel removal</button>
      </div>}
    </article>)}
    {legacy.data?.filter(item => item.activity_type === 'note').map(item => <article key={item.id} className="rounded border p-4">
      <h3>{item.subject}</h3><p className="whitespace-pre-wrap text-sm">{item.description}</p>
    </article>)}
    <LeadAttachments leadId={leadId} />
  </div>;
}
