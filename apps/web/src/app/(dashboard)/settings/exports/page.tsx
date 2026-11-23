'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import type { CentralExportColumn, ExportModule } from '@/lib/exports/contract';

type Catalog = { module: ExportModule; label: string; columns: CentralExportColumn[] };
async function loadCatalog(modules: ExportModule[] = []): Promise<Catalog[]> {
  const query = new URLSearchParams(); for (const module of modules) query.append('module', module);
  const response = await fetch('/api/exports' + (query.size ? '?' + query.toString() : ''));
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Export options could not be loaded.');
  return result.modules;
}
export default function ExportPage() {
  const { user, profile, permissions, isLoading, hasPermission } = useAuth();
  const [selected, setSelected] = useState<ExportModule[]>([]);
  const [columns, setColumns] = useState<Partial<Record<ExportModule, string[]>>>({});
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('xlsx');
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [notice, setNotice] = useState('');
  const enabled = !isLoading && !!user && !!profile?.is_active && hasPermission('exports.view');
  const key = ['crm', user?.id, 'central-export', [...permissions].sort().join('|')];
  const catalog = useQuery({ queryKey: [...key, 'modules'], enabled, queryFn: () => loadCatalog() });
  const fields = useQuery({ queryKey: [...key, 'fields', [...selected].sort()], enabled: enabled && selected.length > 0, queryFn: () => loadCatalog(selected) });
  useEffect(() => { setSelected([]); setColumns({}); setNotice(''); }, [user?.id]);
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
  return <PageContainer>
    <Link href="/settings" className="text-sm text-blue-700">Settings</Link>
    <PageHeader title="Export Data" subtitle="Select modules, columns and an export format." />
    <PermissionGate action="exports.view" showAccessDenied>
      {catalog.isLoading && <p role="status">Loading export modules…</p>}
      {catalog.error && <p role="alert">{catalog.error.message} <button onClick={() => void catalog.refetch()}>Retry</button></p>}
      {catalog.data?.length === 0 && <p>No modules are available for export with your current permissions.</p>}
      <form className="space-y-5" onSubmit={event => { event.preventDefault(); setNotice(''); download.mutate(); }}>
        <fieldset disabled={download.isPending}><legend className="mb-2 font-semibold">Select Modules</legend><div className="flex flex-wrap gap-5">{catalog.data?.map(module => <label key={module.module}><input type="checkbox" checked={selected.includes(module.module)} onChange={event => { setSelected(current => event.target.checked ? [...current, module.module] : current.filter(value => value !== module.module)); setNotice(''); }} /> {module.label}</label>)}</div></fieldset>
        {fields.isFetching && selected.length > 0 && <p role="status">Loading permitted columns…</p>}
        {fields.error && <p role="alert">{fields.error.message} <button type="button" onClick={() => void fields.refetch()}>Retry</button></p>}
        {fields.data?.filter(module => selected.includes(module.module)).map(module => <fieldset key={module.module} disabled={download.isPending} className="rounded-lg border bg-white p-4"><legend className="px-2 font-semibold">{module.label} — Columns</legend><div className="mb-3 flex gap-4 text-sm"><button type="button" onClick={() => setColumns(current => ({ ...current, [module.module]: module.columns.map(column => column.key) }))}>Select All</button><button type="button" onClick={() => setColumns(current => ({ ...current, [module.module]: [] }))}>Unselect All</button></div><div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{module.columns.map(column => <label key={column.key}><input type="checkbox" checked={columns[module.module]?.includes(column.key) ?? false} onChange={event => setColumns(current => ({ ...current, [module.module]: event.target.checked ? [...(current[module.module] ?? []), column.key] : current[module.module]?.filter(key => key !== column.key) ?? [] }))} /> {column.label}</label>)}</div>{module.columns.length === 0 && <p>No exportable columns available.</p>}</fieldset>)}
        <label className="block text-sm">Export Format<select value={format} onChange={event => setFormat(event.target.value as typeof format)} disabled={download.isPending} className="ml-3 rounded border p-2"><option value="xlsx">Excel (XLSX)</option><option value="csv">CSV</option><option value="pdf">PDF</option></select></label>
        <label className="block text-sm">Time Zone<input value={timeZone} onChange={event => setTimeZone(event.target.value)} disabled={download.isPending} required className="ml-3 rounded border p-2" /></label>
        {selected.length > 1 && <p className="text-sm text-slate-600">Multiple module files will be downloaded together in a ZIP archive.</p>}
        {download.error && <p role="alert" className="text-red-700">{download.error.message}</p>}
        {notice && <p role="status" className="text-green-800">{notice}</p>}
        <button disabled={download.isPending || !selected.length || fields.isFetching || fields.isError || selected.some(module => !columns[module]?.length)} className="rounded bg-blue-600 px-5 py-2 text-white">{download.isPending ? 'Exporting…' : 'Export'}</button>
      </form>
    </PermissionGate>
  </PageContainer>;
}
