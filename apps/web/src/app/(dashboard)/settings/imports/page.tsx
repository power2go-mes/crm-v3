'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { createClient } from '@/lib/supabase/client';
import { importMatchFields, leadImportFields, suggestedMappings, IMPORT_MAX_BYTES } from '@/lib/imports/csv';
import { importDraftInput, importRunInput } from '@/lib/imports/service';

type Draft = { job: string; mode: 'create' | 'update' | 'both'; mapping: Record<string, number>; match: (typeof importMatchFields)[number][] };
type ImportResult = { total_rows: number; created_count: number; updated_count: number; error_count: number; success_rate: number; duration_seconds: number; errors: { row: number; message: string }[] };
async function postImport(body: FormData | Draft) {
  const response = await fetch('/api/imports', body instanceof FormData ? { method: 'POST', body } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Import failed.');
  return data as { id?: string; result?: ImportResult };
}
function ImportScreen() {
  const { user, profile, permissions, isLoading, hasPermission } = useAuth();
  const client = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const cache = useQueryClient();
  const jobId = params.get('job') ?? '';
  const history = params.get('tab') === 'history';
  const step = Math.max(1, Math.min(4, Number(params.get('step')) || 1));
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [draft, setDraft] = useState<Draft>({ job: '', mode: 'create', mapping: {}, match: [] });
  const key = ['crm', user?.id, 'imports', [...permissions].sort().join('|')];
  const canRead = !isLoading && !!user && !!profile?.is_active && hasPermission('imports.view') && hasPermission('leads.view');
  const canRun = canRead && hasPermission('imports.create') && hasPermission('leads.create');
  const jobs = useQuery({
    queryKey: [...key, 'history', historyPage], enabled: canRead && history,
    queryFn: async () => {
      const result = await client.from('crm_import_jobs').select('id,import_name,filename,status,result,created_at', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range((historyPage - 1) * 20, historyPage * 20 - 1);
      if (result.error) throw new Error('Import history could not be loaded.');
      return { rows: result.data, count: result.count ?? 0 };
    },
  });
  const job = useQuery({
    queryKey: [...key, 'job', jobId], enabled: canRead && !!jobId,
    queryFn: async () => {
      const result = await client.from('crm_import_jobs').select('id,import_name,filename,headers,rows,configuration,status,result,completed_at').eq('id', jobId).single();
      if (result.error) throw new Error('Import unavailable. Check access or open Import History.');
      return result.data;
    },
  });
  const headers = (job.data?.headers ?? []) as string[];
  const sample = ((job.data?.rows ?? []) as string[][]).slice(0, 3);
  const total = ((job.data?.rows ?? []) as string[][]).length;
  const result = job.data?.result as unknown as ImportResult | null;
  useEffect(() => {
    if (!job.data || !user) return;
    let next: Draft = { job: job.data.id, mode: 'create', mapping: suggestedMappings(job.data.headers as string[]), match: [] };
    try {
      const saved = sessionStorage.getItem(`crm:${user.id}:import:${job.data.id}`);
      const parsed = saved && importDraftInput.safeParse(JSON.parse(saved));
      if (parsed && parsed.success && parsed.data.job === job.data.id) next = parsed.data;
    } catch { /* Storage is optional; server-owned upload is retained. */ }
    setDraft(next);
  }, [job.data, user]);
  useEffect(() => {
    if (!user || !draft.job || draft.job !== jobId) return;
    try { sessionStorage.setItem(`crm:${user.id}:import:${draft.job}`, JSON.stringify(draft)); } catch { /* No sensitive record data is stored here. */ }
  }, [draft, user, jobId]);
  const upload = useMutation({
    mutationFn: async () => {
      if (!file || file.size > IMPORT_MAX_BYTES) throw new Error('Choose a CSV file up to 2 MB.');
      const form = new FormData(); form.set('name', name); form.set('file', file);
      return postImport(form);
    },
    onSuccess: data => router.push(`/settings/imports?job=${data.id}&step=2`),
  });
  const run = useMutation({
    mutationFn: () => postImport(importRunInput.parse(draft)),
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: ['crm', user?.id] }); await cache.invalidateQueries({ queryKey: ['leads', user?.id] }); },
  });
  function go(next: number) { router.push(`/settings/imports?job=${jobId}&step=${next}`); }
  const valid = importRunInput.safeParse(draft);
  return <PageContainer>
    <Link href="/settings" className="text-sm text-emerald-800">Settings</Link>
    <PageHeader title="Import Data" subtitle="Upload, map, review and import your records." />
    <PermissionGate action="imports.view" showAccessDenied>
      <nav className="mb-5 flex gap-5 border-b pb-3" aria-label="Import sections"><Link href="/settings/imports" aria-current={!history ? 'page' : undefined}>Import Data</Link><Link href="/settings/imports?tab=history" aria-current={history ? 'page' : undefined}>Import History</Link></nav>
      {!hasPermission('leads.view') && <p role="alert">Lead view permission is required.</p>}
      {history ? <>
        {jobs.isError && <p role="alert">{jobs.error.message} <button onClick={() => void jobs.refetch()}>Retry</button></p>}
        {jobs.isLoading ? <p role="status">Loading import history…</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Import Name', 'Module', 'Original Filename', 'Status', 'Success Rate', 'Created', 'Files'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{jobs.data?.rows.map(row => {
          const summary = row.result as unknown as ImportResult | null;
          return <tr key={row.id} className="border-t"><td className="p-2"><Link className="text-emerald-800" href={`/settings/imports?job=${row.id}&step=${row.status === 'ready' ? 2 : 4}`}>{row.import_name}</Link></td><td className="p-2">Leads</td><td className="p-2">{row.filename}</td><td className="p-2">{row.status}</td><td className="p-2">{summary ? `${summary.success_rate}%` : '—'}</td><td className="p-2">{new Date(row.created_at).toLocaleString()}</td><td className="flex gap-3 p-2"><a href={`/api/imports?id=${row.id}`}>Original</a>{!!summary?.error_count && <a href={`/api/imports?id=${row.id}&errors=1`}>Errors</a>}</td></tr>;
        })}</tbody></table>{jobs.data?.count === 0 && <p>No import history found.</p>}</div>}
        <nav aria-label="Import history pagination" className="mt-4 flex gap-4"><button disabled={historyPage === 1} onClick={() => setHistoryPage(historyPage - 1)}>Previous</button><span>Page {historyPage}</span><button disabled={historyPage * 20 >= (jobs.data?.count ?? 0)} onClick={() => setHistoryPage(historyPage + 1)}>Next</button></nav>
      </> : <>
        {!canRun && !isLoading && <p role="alert">Import creation and Lead creation permissions are required to prepare or execute imports.</p>}
        {!jobId ? <form onSubmit={event => { event.preventDefault(); upload.mutate(); }} className="max-w-xl space-y-4 rounded-lg border bg-white p-5">
          <p className="font-semibold">Step 1 — Upload File</p>
          <label className="block">Select Module<select className="mt-1 block w-full rounded border p-2" defaultValue="leads"><option value="leads">Leads</option></select></label>
          <label className="block">Import Name<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
          <label className="block">Upload File<input type="file" accept=".csv,text/csv" required onChange={event => setFile(event.target.files?.[0] ?? null)} className="mt-1 block" /></label>
          <p className="text-sm text-slate-600">Current support: UTF-8 CSV, up to 2 MB, 1,000 rows and 50 columns.</p>
          <a className="block text-sm text-emerald-800" href="/api/imports?template=leads">Download Template</a>
          {upload.error && <p role="alert" className="text-red-700">{upload.error.message}</p>}
          <button disabled={!canRun || upload.isPending} className="rounded bg-emerald-600 px-4 py-2 text-white">{upload.isPending ? 'Uploading…' : 'Next'}</button>
        </form> : job.isLoading ? <p role="status">Loading import…</p> : job.isError ? <p role="alert">{job.error.message} <button onClick={() => void job.refetch()}>Retry</button></p> : result ? <section className="space-y-4 rounded border p-5">
          <h2 className="text-lg font-semibold">Import Results — {job.data?.import_name}</h2><p>{result.created_count} created · {result.updated_count} updated · {result.error_count} errors · {result.total_rows} rows</p><p>{result.success_rate}% success · {result.duration_seconds.toFixed(3)} seconds</p>
          <div className="flex gap-4"><a href={`/api/imports?id=${jobId}`}>Download Imported File</a>{result.error_count > 0 && <a href={`/api/imports?id=${jobId}&errors=1`}>Download Error File</a>}<Link href="/settings/imports">Import Another File</Link></div>
          {result.errors.map(error => <p key={error.row} className="text-sm text-red-700">Row {error.row}: {error.message}</p>)}
        </section> : <section className="space-y-5 rounded border bg-white p-5">
          <p className="font-semibold">{job.data?.import_name} — Step {step} of 4</p>
          {step === 1 && <><h2 className="text-lg">Upload File</h2><p>Module: Leads</p><p>Import Name: {job.data?.import_name}</p><p>File already uploaded: {job.data?.filename}</p><div className="flex gap-4"><a href={`/api/imports?id=${jobId}`}>Download Uploaded File</a><Link href="/settings/imports">Choose Another File</Link></div></>}
          {step === 2 && <>
            <h2 className="text-lg">Map Fields</h2><div className="grid gap-3 sm:grid-cols-2">{leadImportFields.map(([key, label]) => <label key={key}>{label}<select value={draft.mapping[key] ?? ''} className="ml-2 rounded border p-2" onChange={event => setDraft(old => { const mapping = { ...old.mapping }; if (event.target.value === '') delete mapping[key]; else mapping[key] = Number(event.target.value); return { ...old, mapping, match: old.match.filter(field => mapping[field] !== undefined) }; })}><option value="">Not mapped</option>{headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></label>)}</div>
            <h3 className="font-semibold">Sample Data</h3><div className="overflow-x-auto"><table className="text-sm"><thead><tr>{headers.map(header => <th key={header} className="border p-2">{header}</th>)}</tr></thead><tbody>{sample.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border p-2">{cell}</td>)}</tr>)}</tbody></table></div>
          </>}
          {step === 3 && <><h2 className="text-lg">Import Options</h2>{(['create', 'update', 'both'] as const).map(mode => <label key={mode} className="block"><input type="radio" name="mode" checked={draft.mode === mode} disabled={mode !== 'create' && !hasPermission('leads.update')} onChange={() => setDraft(old => ({ ...old, mode }))} /> {mode === 'both' ? 'Create and Update' : mode === 'create' ? 'Create New Records' : 'Update Existing Records'}</label>)}<h3 className="font-semibold">Match Fields</h3>{importMatchFields.map(field => <label key={field} className="mr-4 inline-block"><input type="checkbox" disabled={draft.mapping[field] === undefined} checked={draft.match.includes(field)} onChange={event => setDraft(old => ({ ...old, match: event.target.checked ? [...old.match, field] : old.match.filter(value => value !== field) }))} /> {leadImportFields.find(([key]) => key === field)?.[1]}</label>)}{draft.mode !== 'create' && !draft.match.length && <p role="alert">Select at least one field to match records for update operations.</p>}</>}
          {step === 4 && <><h2 className="text-lg">Review Import</h2><p>Module: Leads · File: {job.data?.filename} · Rows: {total}</p><p>Mapped fields: {Object.keys(draft.mapping).length} · Mapped columns: {new Set(Object.values(draft.mapping)).size} · Unmapped columns: {headers.length - new Set(Object.values(draft.mapping)).size}</p><p>Mode: {draft.mode} · Match fields: {draft.match.join(', ') || 'None'}</p><p className="text-sm">Valid rows will be imported; invalid rows will be reported separately. Converted Leads and owner reassignment are excluded from this import.</p></>}
          {run.error && <p role="alert" className="text-red-700">{run.error.message}</p>}
          <div className="flex gap-4"><Link href="/settings/imports">Cancel</Link>{step > 1 && <button disabled={run.isPending} onClick={() => go(step - 1)}>Back</button>}{step < 4 ? <button disabled={(step >= 2 && !Object.keys(draft.mapping).length) || (step === 3 && !valid.success)} className="rounded bg-emerald-600 px-4 py-2 text-white" onClick={() => go(step + 1)}>Next</button> : <button disabled={!canRun || !valid.success || run.isPending} className="rounded bg-emerald-600 px-4 py-2 text-white" onClick={() => run.mutate()}>{run.isPending ? 'Importing…' : 'Import'}</button>}</div>
        </section>}
      </>}
    </PermissionGate>
  </PageContainer>;
}
export default function ImportsPage() { return <Suspense fallback={<p role="status">Loading Import Data…</p>}><ImportScreen /></Suspense>; }
