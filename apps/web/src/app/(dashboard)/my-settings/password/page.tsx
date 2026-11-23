'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { createClient } from '@/lib/supabase/client';
import { changePasswordAction, requestPasswordVerification } from './actions';

export default function PasswordManagementPage() {
  const { user, profile, isLoading } = useAuth();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [verification, setVerification] = useState(false);
  const [fields, setFields] = useState({ current_password: '', new_password: '', confirm_password: '', nonce: '' });
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const canUse = !isLoading && !!user && !!profile?.is_active;
  const history = useQuery({
    queryKey: ['crm', user?.id, 'password-changed-at'], enabled: canUse,
    queryFn: async () => {
      const response = await createClient().from('user_password_changes').select('changed_at').eq('user_id', user!.id).maybeSingle();
      if (response.error) throw new Error('Password update history could not be loaded.');
      return response.data?.changed_at ?? null;
    },
  });
  useEffect(() => { if (open) dialog.current?.showModal(); else if (dialog.current?.open) dialog.current.close(); }, [open]);
  useEffect(() => { setOpen(false); setFields({ current_password: '', new_password: '', confirm_password: '', nonce: '' }); setVisible({}); setVerification(false); setError(''); setNotice(''); }, [user?.id]);
  function close() { setOpen(false); setFields({ current_password: '', new_password: '', confirm_password: '', nonce: '' }); setVisible({}); setError(''); setVerification(false); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      const result = await changePasswordAction(fields);
      if (!result.success) { setError(result.error ?? 'Password could not be changed.'); setVerification(!!result.needsVerification); return; }
      await cache.invalidateQueries({ queryKey: ['crm', user?.id, 'password-changed-at'] });
      close(); setNotice('Your password has been changed successfully.');
    } catch { setError('Password could not be changed. Retry after checking your session.'); }
    finally { setFields({ current_password: '', new_password: '', confirm_password: '', nonce: '' }); setBusy(false); }
  }
  const labels = { current_password: 'Current Password', new_password: 'New Password', confirm_password: 'Confirm New Password' } as const;
  return <PageContainer>
    <PageHeader title="Password Management" subtitle="Update your password to keep your account secure." />
    {isLoading && <p role="status">Loading account…</p>}
    {!isLoading && !canUse && <p role="alert">Sign in with an active account to manage your password.</p>}
    {canUse && <section className="rounded-md bg-[#f1f1f1] p-4"><div className="flex items-center justify-between"><h2 className="text-base font-semibold">Password</h2><button onClick={() => { setNotice(''); setOpen(true); }} className="rounded border bg-blue-600 px-4 py-2 text-xs text-white">Change Password</button></div><p className="mt-2 text-sm">Last Updated: {history.isLoading ? 'Loading…' : history.data ? new Date(history.data).toLocaleString() : 'Not available'}</p>{history.error && <p role="alert">{history.error.message} <button onClick={() => void history.refetch()}>Retry</button></p>}</section>}
    {notice && <p role="status" className="mt-4 text-green-800">{notice}</p>}
    <dialog ref={dialog} aria-labelledby="password-modal-title" onCancel={event => { if (busy) event.preventDefault(); else close(); }} className="w-[calc(100%_-_2rem)] max-w-lg rounded-lg p-5 backdrop:bg-black/40">
      <div className="mb-4 flex items-center justify-between"><h2 id="password-modal-title" className="font-semibold">Change Your Password</h2><button type="button" disabled={busy} onClick={close} aria-label="Close"><X className="h-5 w-5" /></button></div>
      <form onSubmit={submit} className="space-y-4">
        {(Object.keys(labels) as (keyof typeof labels)[]).map(key => <label key={key} className="block text-xs">{labels[key]} *<div className="relative mt-1"><input required autoFocus={key === 'current_password'} autoComplete={key === 'current_password' ? 'current-password' : 'new-password'} type={visible[key] ? 'text' : 'password'} maxLength={1024} disabled={busy} value={fields[key]} onChange={event => setFields(current => ({ ...current, [key]: event.target.value }))} className="w-full rounded border p-2 pr-10 text-sm" /><button type="button" className="absolute right-2 top-2" disabled={busy} aria-label={`${visible[key] ? 'Hide' : 'Show'} ${labels[key]}`} onClick={() => setVisible(current => ({ ...current, [key]: !current[key] }))}>{visible[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>)}
        {verification && <><label className="block text-xs">Verification Code<input value={fields.nonce} onChange={event => setFields(current => ({ ...current, nonce: event.target.value }))} maxLength={100} autoComplete="one-time-code" className="mt-1 block w-full rounded border p-2 text-sm" /></label><button type="button" disabled={busy} className="text-sm text-blue-700" onClick={async () => { setBusy(true); try { const result = await requestPasswordVerification(); if (!result.success) setError(result.error ?? 'Verification failed.'); else { setError(''); setNotice('Verification sent. Enter the code and re-enter your passwords.'); } } catch { setError('Verification could not be sent.'); } finally { setBusy(false); } }}>Send Verification Code</button></>}
        {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end"><button disabled={busy || !canUse} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">{busy ? 'Changing…' : 'Change Password'}</button></div>
      </form>
    </dialog>
  </PageContainer>;
}
