'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, RotateCcw, Plus, Columns3 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { createClient } from '@/lib/supabase/client';
import { saveDepartment, setDepartmentDeleted, type Department } from '@/lib/settings/departments';

export default function DepartmentsPage() {
  const { user, profile, permissions, isLoading, hasPermission } = useAuth();
  const client = createClient();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'department_name' | 'description'>('department_name');
  const [ascending, setAscending] = useState(true);
  const [trash, setTrash] = useState(false);
  const [showDescription, setShowDescription] = useState(true);
  const [showColumns, setShowColumns] = useState(false);
  const [editing, setEditing] = useState<Department | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const key = ['crm', user?.id, 'departments'];
  const authKey = [...permissions].sort().join('|');
  useEffect(() => {
    if (editing !== undefined) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [editing]);
  useEffect(() => {
    const stored = localStorage.getItem(`crm:${user?.id}:departments:description`);
    setShowDescription(stored !== 'false');
  }, [user?.id]);
  const list = useQuery({
    queryKey: [...key, authKey, search, page, sort, ascending, trash],
    enabled: !isLoading && !!user && !!profile?.is_active && hasPermission('departments.view') && (!trash || hasPermission('departments.restore')),
    queryFn: async () => {
      let query = client.from('departments').select('*', { count: 'exact' });
      query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
      if (search.trim()) query = query.ilike('department_name', `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`);
      const { data, count, error } = await query.order(sort, { ascending }).order('id').range((page - 1) * 20, page * 20 - 1);
      if (error) throw new Error('Departments could not be loaded.');
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
  function close() { setEditing(undefined); trigger.current?.focus(); }
  const save = useMutation({
    mutationFn: async (keepOpen: boolean) => { await saveDepartment(client, { id: editing?.id ?? null, department_name: name, description }); return keepOpen; },
    onSuccess: async keepOpen => { await cache.invalidateQueries({ queryKey: key }); setNotice('Department saved successfully.'); if (keepOpen) { setName(''); setDescription(''); dialog.current?.querySelector('input')?.focus(); } else close(); },
  });
  const deletion = useMutation({
    mutationFn: ({ id, deleted }: { id: string; deleted: boolean }) => setDepartmentDeleted(client, id, deleted),
    onSuccess: async (_, action) => { setNotice(action.deleted ? 'Department moved to recovery.' : 'Department restored.'); await cache.invalidateQueries({ queryKey: key }); },
  });
  function open(record: Department | null, button: HTMLButtonElement) {
    trigger.current = button; save.reset(); setName(record?.department_name ?? ''); setDescription(record?.description ?? ''); setEditing(record);
  }
  const columns: ColumnDef<Department>[] = [
    { id: 'department_name', header: 'Department Name', accessorKey: 'department_name', sortable: true },
    ...(showDescription ? [{ id: 'description', header: 'Description', accessorKey: 'description', sortable: true } satisfies ColumnDef<Department>] : []),
    { id: 'actions', header: 'Actions', cell: row => <div className="flex gap-3">
      {!trash && hasPermission('departments.update') && <button aria-label={`Edit ${row.department_name}`} onClick={e => open(row, e.currentTarget)}><Pencil className="h-4 w-4" /></button>}
      {!trash && hasPermission('departments.delete') && <button disabled={deletion.isPending} aria-label={`Delete ${row.department_name}`} onClick={() => {
        if (window.confirm(`Move ${row.department_name} to recovery? Departments referenced by users cannot be deleted.`)) deletion.mutate({ id: row.id, deleted: true });
      }}><Trash2 className="h-4 w-4" /></button>}
      {trash && hasPermission('departments.restore') && <button disabled={deletion.isPending} onClick={() => deletion.mutate({ id: row.id, deleted: false })}><RotateCcw className="inline h-4 w-4" /> Restore</button>}
    </div> },
  ];
  return <PageContainer>
    <Link href="/settings" className="text-sm text-[#4361ee]">Settings</Link>
    <PageHeader title="Departments" subtitle="Organize employees into departments across your company." actions={!trash && hasPermission('departments.create') ? <button className="rounded bg-[#4361ee] px-4 py-2 text-white" onClick={e => open(null, e.currentTarget)}><Plus className="mr-1 inline h-4 w-4" />New</button> : undefined} />
    <PermissionGate action="departments.view" showAccessDenied>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">Search <input className="rounded border p-2" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
        <button className="rounded border p-2 text-sm" aria-expanded={showColumns} onClick={() => setShowColumns(!showColumns)}><Columns3 className="mr-1 inline h-4 w-4" />Add Column to List</button>
        {showColumns && <label className="text-sm"><input type="checkbox" checked={showDescription} onChange={e => { setShowDescription(e.target.checked); localStorage.setItem(`crm:${user?.id}:departments:description`, String(e.target.checked)); }} /> Description</label>}
        {hasPermission('departments.restore') && <button className="rounded border p-2 text-sm" onClick={() => { setTrash(!trash); setPage(1); }}>{trash ? 'Back to Departments' : 'Deleted Departments'}</button>}
      </div>
      {notice && <p role="status" className="mb-3 text-green-800">{notice}</p>}
      {deletion.error && <p role="alert" className="mb-3 text-red-700">{deletion.error.message}</p>}
      {list.isError ? <p role="alert">{list.error.message} <button onClick={() => void list.refetch()}>Retry</button></p> : <DataGrid columns={columns} data={list.data?.rows ?? []} keyExtractor={row => row.id} isLoading={list.isLoading} sortField={sort} sortDirection={ascending ? 'asc' : 'desc'} onSort={field => { if (field === 'department_name' || field === 'description') { setSort(field); setAscending(field === sort ? !ascending : true); setPage(1); } }} emptyState={<p>{trash ? 'No deleted Departments.' : 'No Departments found.'}</p>} />}
      <nav aria-label="Department pagination" className="mt-4 flex items-center gap-4 text-sm"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {list.data?.count ?? 0} Departments</span><button disabled={page * 20 >= (list.data?.count ?? 0)} onClick={() => setPage(page + 1)}>Next</button></nav>
    </PermissionGate>
    <dialog ref={dialog} aria-labelledby="department-form-title" onCancel={event => { if (save.isPending) event.preventDefault(); else close(); }} className="w-[calc(100%_-_2rem)] max-w-lg rounded-xl p-6 backdrop:bg-black/20 backdrop:backdrop-blur-xs">
      <form onSubmit={event => { event.preventDefault(); save.mutate(((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === 'new'); }}>
        <h2 id="department-form-title" className="mb-4 text-lg font-semibold">Department</h2>
        <label className="mb-4 block text-sm">Department Name <span aria-hidden="true">*</span><input autoFocus required maxLength={50} value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
        <label className="mb-4 block text-sm">Description<textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
        {save.error && <p role="alert" className="text-red-700">{save.error.message}</p>}
        <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={save.isPending} onClick={close}>Cancel</button>{editing === null && <button type="submit" value="new" disabled={save.isPending || !name.trim()} className="rounded border border-indigo-100 px-4 py-2 text-[#4361ee]">Save &amp; New</button>}<button type="submit" value="save" disabled={save.isPending || !name.trim()} className="rounded bg-[#4361ee] px-4 py-2 text-white">{save.isPending ? 'Saving…' : 'Save'}</button></div>
      </form>
    </dialog>
  </PageContainer>;
}
