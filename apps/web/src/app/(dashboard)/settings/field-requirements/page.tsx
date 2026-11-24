'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { createClient } from '@/lib/supabase/client';
import { saveFieldRequirement, removeFieldRequirement } from '@/lib/settings/field-requirements';

type RequirementRow = { id: string; module: string; label: string; required: boolean };
export default function FieldRequirementsPage() {
  const { user, profile, permissions, isLoading, hasPermission } = useAuth();
  const client = createClient();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [field, setField] = useState('');
  const [required, setRequired] = useState(true);
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [notice, setNotice] = useState('');
  const modal = useRef<HTMLDialogElement>(null);
  const origin = useRef<HTMLButtonElement | null>(null);
  const key = ['crm', user?.id, 'field-requirements'];
  const query = useQuery({
    queryKey: [...key, [...permissions].sort().join('|')],
    enabled: !isLoading && !!user && !!profile?.is_active && hasPermission('settings.view'),
    queryFn: async () => {
      const [definitions, requirements] = await Promise.all([
        client.from('crm_field_definitions').select('id,module,label,key,required,relaxable').eq('archived', false).eq('sensitive', false).order('module').order('position').limit(501),
        client.from('crm_field_requirements').select('definition_id,required').limit(501),
      ]);
      if (definitions.error || requirements.error) throw new Error('Field requirements could not be loaded.');
      if (definitions.data.length > 500 || requirements.data.length > 500) throw new Error('Metadata exceeds the current 500-field editor limit. No truncated configuration is shown.');
      return { fields: definitions.data, requirements: requirements.data };
    },
  });
  useEffect(() => { if (editing !== undefined) modal.current?.showModal(); else if (modal.current?.open) modal.current.close(); }, [editing]);
  function close() { setEditing(undefined); origin.current?.focus(); }
  async function changed(message: string) {
    await cache.invalidateQueries({ queryKey: ['crm', user?.id] });
    setNotice(message);
  }
  const save = useMutation({ mutationFn: async (keepOpen: boolean) => { await saveFieldRequirement(client, { definition_id: field, required }); return keepOpen; }, onSuccess: async keepOpen => { await changed('Field Requirement saved.'); if (keepOpen) { setField(''); setRequired(true); modal.current?.querySelector('select')?.focus(); } else close(); } });
  const remove = useMutation({ mutationFn: (id: string) => removeFieldRequirement(client, id), onSuccess: () => changed('Field Requirement deleted. The original field requirement now applies.') });
  const fields = query.data?.fields ?? [];
  const rows: RequirementRow[] = (query.data?.requirements ?? []).flatMap(item => {
    const definition = fields.find(f => f.id === item.definition_id);
    return definition && `${definition.module} ${definition.label}`.toLowerCase().includes(search.toLowerCase()) ? [{ id: definition.id, module: definition.module, label: definition.label, required: item.required }] : [];
  });
  const selected = fields.find(f => f.id === field);
  function open(row: RequirementRow | null, button: HTMLButtonElement) {
    origin.current = button; save.reset(); setModule(row?.module ?? ''); setField(row?.id ?? ''); setRequired(row?.required ?? true); setEditing(row?.id ?? null);
  }
  const columns: ColumnDef<RequirementRow>[] = [
    { id: 'module', header: 'Model', accessorKey: 'module' },
    { id: 'label', header: 'Field', accessorKey: 'label' },
    { id: 'required', header: 'Requirement', cell: row => row.required ? 'Required' : 'Optional' },
    { id: 'actions', header: 'Actions', cell: row => hasPermission('settings.update') && <div className="flex gap-3"><button aria-label={`Edit ${row.label}`} onClick={e => open(row, e.currentTarget)}><Pencil className="h-4 w-4" /></button><button disabled={remove.isPending} aria-label={`Delete ${row.label}`} onClick={() => { if (window.confirm(`Delete the requirement override for ${row.label}? The original requirement will apply.`)) remove.mutate(row.id); }}><Trash2 className="h-4 w-4" /></button></div> },
  ];
  return <PageContainer>
    <Link href="/settings" className="text-sm text-emerald-800">Settings</Link>
    <PageHeader title="Field Requirements" subtitle="Choose which fields your team must fill in when creating or editing records." actions={hasPermission('settings.update') ? <button className="rounded bg-emerald-600 px-4 py-2 text-white" onClick={e => open(null, e.currentTarget)}><Plus className="mr-1 inline h-4 w-4" />New</button> : undefined} />
    <PermissionGate action="settings.view" showAccessDenied>
      <label className="mb-4 block text-sm">Search <input value={search} onChange={e => setSearch(e.target.value)} className="rounded border p-2" /></label>
      {notice && <p role="status" className="mb-3 text-green-800">{notice}</p>}
      {remove.error && <p role="alert" className="text-red-700">{remove.error.message}</p>}
      {query.isError ? <p role="alert">{query.error.message} <button onClick={() => void query.refetch()}>Retry</button></p> : <DataGrid columns={columns} data={rows} keyExtractor={row => row.id} isLoading={query.isLoading} emptyState={<p>No Field Requirements found.</p>} />}
    </PermissionGate>
    <dialog ref={modal} aria-labelledby="requirement-title" onCancel={event => { if (save.isPending) event.preventDefault(); else close(); }} className="w-[calc(100%_-_2rem)] max-w-lg rounded-xl p-6 backdrop:bg-black/40">
      <form onSubmit={event => { event.preventDefault(); save.mutate(((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === 'new'); }}>
        <h2 id="requirement-title" className="mb-4 text-lg font-semibold">Field Requirement</h2>
        <label className="mb-4 block">Model<select autoFocus required disabled={!!editing} className="block w-full rounded border p-2" value={module} onChange={e => { setModule(e.target.value); setField(''); setRequired(true); }}><option value="">Select Model</option>{[...new Set(fields.map(f => f.module))].map(m => <option key={m} value={m}>{m}</option>)}</select></label>
        <label className="mb-4 block">Field<select required disabled={!module || !!editing} className="block w-full rounded border p-2" value={field} onChange={e => { setField(e.target.value); setRequired(true); }}><option value="">Select Field</option>{fields.filter(f => f.module === module && (f.id === editing || !(query.data?.requirements ?? []).some(r => r.definition_id === f.id))).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
        <label className="block"><input type="checkbox" checked={required} disabled={!!selected?.required && !selected.relaxable} onChange={e => setRequired(e.target.checked)} /> Required</label>
        <p className="mt-2 text-sm text-slate-600">When enabled the field must be filled in. When disabled the field becomes optional on create and edit forms.</p>
        {selected?.required && !selected.relaxable && <p className="mt-2 text-sm">This field cannot be made optional.</p>}
        {save.error && <p role="alert" className="text-red-700">{save.error.message}</p>}
        <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={close} disabled={save.isPending}>Cancel</button>{editing === null && <button type="submit" value="new" disabled={save.isPending || !field} className="rounded border border-emerald-200 px-4 py-2 text-emerald-800">Save &amp; New</button>}<button type="submit" value="save" className="rounded bg-emerald-600 px-4 py-2 text-white" disabled={save.isPending || !field}>{save.isPending ? 'Saving…' : 'Save'}</button></div>
      </form>
    </dialog>
  </PageContainer>;
}
