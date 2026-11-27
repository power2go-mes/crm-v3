'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import type { CentralExportColumn, ExportModule } from '@/lib/exports/contract';

type Catalog = { module: ExportModule; label: string; columns: CentralExportColumn[] };
type ExportJob = { id: string; status: string; processed_rows: number; part_count: number; error_message: string | null; created_at: string; completed_at: string | null };
async function loadCatalog(modules: ExportModule[] = []): Promise<Catalog[]> {
  const query = new URLSearchParams(); for (const module of modules) query.append('module', module);
  const response = await fetch('/api/exports' + (query.size ? '?' + query.toString() : ''));
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Export options could not be loaded.');
  return result.modules;
}
async function loadJobs(): Promise<ExportJob[]> {
  const response = await fetch('/api/exports/jobs');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Export jobs could not be loaded.');
  return result.jobs;
}
export default function ExportPage() {
  const { user, profile, permissions, isLoading, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ExportModule[]>([]);
  const [columns, setColumns] = useState<Partial<Record<ExportModule, string[]>>>({});
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('xlsx');
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [notice, setNotice] = useState('');
  const [jobProgress, setJobProgress] = useState('');
  const enabled = !isLoading && !!user && !!profile?.is_active && hasPermission('exports.view');
  const key = ['crm', user?.id, 'central-export', [...permissions].sort().join('|')];
  const catalog = useQuery({ queryKey: [...key, 'modules'], enabled, queryFn: () => loadCatalog() });
  const fields = useQuery({ queryKey: [...key, 'fields', [...selected].sort()], enabled: enabled && selected.length > 0, queryFn: () => loadCatalog(selected) });
  const jobs = useQuery({ queryKey: [...key, 'jobs'], enabled, queryFn: loadJobs });
  useEffect(() => { setSelected([]); setColumns({}); setNotice(''); setJobProgress(''); }, [user?.id]);
  useEffect(() => {
    if (!fields.data) return;
    setColumns(current => {
      const next = { ...current };
      for (const module of fields.data) {
        const available = module.columns.map(column => column.key);
        next[module.module] = current[module.module] === undefined ? available : current[module.module]!.filter(key => available.includes(key));
      }
      return next;
    });
  }, [fields.data]);
  const download = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/exports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modules: selected.map(module => ({ module, columns: columns[module] ?? [] })), format, timeZone }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? 'Export failed.'); }
      const filename = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `export.${selected.length > 1 ? 'zip' : format}`;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      try { const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
      return Number(response.headers.get('x-export-rows') ?? 0);
    },
    onSuccess: count => setNotice(`Export completed successfully. ${count} records exported.`),
  });
  const processJob = useMutation({
    mutationFn: async (id: string) => {
      for (;;) {
        const response = await fetch(`/api/exports/jobs/${id}`, { method: 'POST' });
        if (response.status === 202) {
          setJobProgress('Another worker is processing this export. Waiting to resume…');
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Export processing failed.');
        setJobProgress(`Exported ${result.processedRows.toLocaleString()} leads…`);
        if (result.status === 'completed') return result.processedRows as number;
      }
    },
    onSuccess: async count => {
      setNotice(`CSV export completed successfully. ${count.toLocaleString()} leads exported.`);
      setJobProgress('');
      await jobs.refetch();
    },
    onError: async error => {
      setJobProgress('');
      setNotice(error.message);
      await jobs.refetch();
    },
  });
  const createJob = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/exports/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'leads', columns: columns.leads ?? [], timeZone }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Export job could not be created.');
      return result.id as string;
    },
    onSuccess: async id => {
      await queryClient.invalidateQueries({ queryKey: [...key, 'jobs'] });
      processJob.mutate(id);
    },
    onError: error => setNotice(error.message),
  });
  const canRunJob = format === 'csv' && selected.length === 1 && selected[0] === 'leads';
  const busy = download.isPending || createJob.isPending || processJob.isPending;
  return <PageContainer>
    <Link href="/settings" className="text-sm text-[#4361ee]">Settings</Link>
    <PageHeader title="Export Data" subtitle="Select modules, columns and an export format." />
    <PermissionGate action="exports.view" showAccessDenied>
      {catalog.isLoading && <p role="status">Loading export modules…</p>}
      {catalog.error && <p role="alert">{catalog.error.message} <button onClick={() => void catalog.refetch()}>Retry</button></p>}
      {catalog.data?.length === 0 && <p>No modules are available for export with your current permissions.</p>}
      <form className="space-y-5" onSubmit={event => { event.preventDefault(); setNotice(''); if (canRunJob) createJob.mutate(); else download.mutate(); }}>
        <fieldset disabled={busy}><legend className="mb-2 font-semibold">Select Modules</legend><div className="flex flex-wrap gap-5">{catalog.data?.map(module => <label key={module.module}><input type="checkbox" checked={selected.includes(module.module)} onChange={event => { setSelected(current => event.target.checked ? [...current, module.module] : current.filter(value => value !== module.module)); setNotice(''); }} /> {module.label}</label>)}</div></fieldset>
        {fields.isFetching && selected.length > 0 && <p role="status">Loading permitted columns…</p>}
        {fields.error && <p role="alert">{fields.error.message} <button type="button" onClick={() => void fields.refetch()}>Retry</button></p>}
        {fields.data?.filter(module => selected.includes(module.module)).map(module => <fieldset key={module.module} disabled={busy} className="rounded-lg border bg-white p-4"><legend className="px-2 font-semibold">{module.label} — Columns</legend><div className="mb-3 flex gap-4 text-sm"><button type="button" onClick={() => setColumns(current => ({ ...current, [module.module]: module.columns.map(column => column.key) }))}>Select All</button><button type="button" onClick={() => setColumns(current => ({ ...current, [module.module]: [] }))}>Unselect All</button></div><div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{module.columns.map(column => <label key={column.key}><input type="checkbox" checked={columns[module.module]?.includes(column.key) ?? false} onChange={event => setColumns(current => ({ ...current, [module.module]: event.target.checked ? [...(current[module.module] ?? []), column.key] : current[module.module]?.filter(key => key !== column.key) ?? [] }))} /> {column.label}</label>)}</div>{module.columns.length === 0 && <p>No exportable columns available.</p>}</fieldset>)}
        <label className="block text-sm">Export Format<select value={format} onChange={event => setFormat(event.target.value as typeof format)} disabled={busy} className="ml-3 rounded border p-2"><option value="xlsx">Excel (XLSX)</option><option value="csv">CSV</option><option value="pdf">PDF</option></select></label>
        <label className="block text-sm">Time Zone<input value={timeZone} onChange={event => setTimeZone(event.target.value)} disabled={busy} required className="ml-3 rounded border p-2" /></label>
        {selected.length > 1 && <p className="text-sm text-slate-600">Multiple module files will be downloaded together in a ZIP archive.</p>}
        {canRunJob && <p className="text-sm text-slate-600">Lead CSVs process in resumable batches of 250, up to 100,000 leads or 50 MB. Resume interrupted jobs below.</p>}
        {download.error && <p role="alert" className="text-red-700">{download.error.message}</p>}
        {notice && <p role="status" className="text-[#4361ee]">{notice}</p>}
        {jobProgress && <p role="status">{jobProgress}</p>}
        <button disabled={busy || !selected.length || fields.isFetching || fields.isError || selected.some(module => !columns[module]?.length)} className="rounded bg-[#4361ee] px-5 py-2 text-white">{busy ? 'Exporting…' : canRunJob ? 'Start Resumable CSV Export' : 'Export'}</button>
      </form>
      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Recent lead CSV exports</h2>
        {jobs.isLoading && <p role="status">Loading export jobs…</p>}
        {jobs.error && <p role="alert">{jobs.error.message} <button onClick={() => void jobs.refetch()}>Retry</button></p>}
        {jobs.data?.map(job => <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4">
          <div><p className="font-medium">{job.status} — {job.processed_rows.toLocaleString()} leads</p><p className="text-sm text-slate-600">{new Date(job.created_at).toLocaleString()}</p>{job.error_message && <p className="text-sm text-red-700">{job.error_message}</p>}</div>
          {job.status === 'completed' ? <a className="rounded border px-3 py-2 text-sm" href={`/api/exports/jobs/${job.id}/download`}>Download CSV</a>
            : job.status !== 'failed' && <button disabled={busy} onClick={() => { setNotice(''); processJob.mutate(job.id); }} className="rounded border px-3 py-2 text-sm">{job.status === 'processing' ? 'Resume / Check status' : 'Resume export'}</button>}
        </div>)}
      </section>
    </PermissionGate>
  </PageContainer>;
}
