'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Columns3, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { createClient } from '@/lib/supabase/client';
import { deleteCatalogRole, listCatalogRoles, roleCatalogs, saveCatalogRole, type CatalogKind, type CatalogRole } from '@/lib/settings/relationship-roles';

export function RelationshipRoleManager({ kind }: { kind: CatalogKind }) {
  const { user, permissions } = useAuth();
  return <CatalogManager key={`${user?.id}:${[...permissions].sort().join('|')}:${kind}`} kind={kind} />;
}
function CatalogManager({ kind }: { kind: CatalogKind }) {
  const { user, profile, permissions, hasPermission, isLoading } = useAuth();
  const config = roleCatalogs[kind];
  const client = createClient();
  const cache = useQueryClient();
  const key = ['crm', user?.id, 'settings-role-catalog', kind];
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'name' | 'description'>('name');
  const [ascending, setAscending] = useState(true);
  const [showColumns, setShowColumns] = useState(false);
  const [showDescription, setShowDescription] = useState(true);
  const [editing, setEditing] = useState<CatalogRole | null | undefined>();
  const [removing, setRemoving] = useState<CatalogRole | null>(null);
  const [confirmRelationships, setConfirmRelationships] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('');
  const formDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    try { setShowDescription(localStorage.getItem(`crm:${user?.id}:${kind}-roles:description`) !== 'false'); } catch { /* Storage may be disabled. */ }
  }, [user?.id, kind]);
  useEffect(() => { if (editing !== undefined) formDialog.current?.showModal(); else formDialog.current?.close(); }, [editing]);
  useEffect(() => { if (removing) deleteDialog.current?.showModal(); else deleteDialog.current?.close(); }, [removing]);
  const list = useQuery({
    queryKey: [...key, [...permissions].sort().join('|'), search, page, sort, ascending],
    enabled: !isLoading && !!user && !!profile?.is_active && hasPermission('settings.view'),
    queryFn: () => listCatalogRoles(client, kind, search, page, sort, ascending),
  });
  function close() { setEditing(undefined); setRemoving(null); trigger.current?.focus(); }
  async function invalidate() {
    // Role names also appear in already-open Contact relationships; avoid stale labels.
    await cache.invalidateQueries({queryKey: ['crm', user?.id]});
  }
  const save = useMutation({
    mutationFn: async (keepOpen: boolean) => { await saveCatalogRole(client, {kind,id:editing?.id ?? null,name,description}); return keepOpen; },
    onSuccess: async keepOpen => { await invalidate(); setNotice(`${config.singular} saved successfully.`); if (keepOpen) {setName('');setDescription('');formDialog.current?.querySelector('input')?.focus();} else close(); },
  });
  const deletion = useMutation({
    mutationFn: () => { if (!removing) throw new Error('Select a role.'); return deleteCatalogRole(client,kind,removing.id,confirmRelationships); },
    onSuccess: async () => { await invalidate(); setNotice(`${config.singular} deleted successfully.`); setPage(1); close(); },
  });
  function open(record: CatalogRole | null, button: HTMLButtonElement) {
    trigger.current=button; save.reset(); setName(record?.name ?? ''); setDescription(record?.description ?? ''); setEditing(record);
  }
  const columns: ColumnDef<CatalogRole>[] = [
    {id:'name',header:`${config.singular} Name`,accessorKey:'name',sortable:true},
    ...(showDescription ? [{id:'description',header:'Description',accessorKey:'description',sortable:true} satisfies ColumnDef<CatalogRole>] : []),
    {id:'actions',header:'Actions',cell: row => hasPermission('settings.update') ? <div className="flex gap-3">
      <button aria-label={`Edit ${row.name}`} onClick={event => open(row,event.currentTarget)}><Pencil className="h-4 w-4" /></button>
      <button aria-label={`Delete ${row.name}`} onClick={event => { trigger.current=event.currentTarget; deletion.reset(); setConfirmRelationships(false); setRemoving(row); }}><Trash2 className="h-4 w-4" /></button>
    </div> : null},
  ];
  return <PageContainer>
    <Link href="/settings" className="text-sm text-emerald-800">Settings</Link>
    <PageHeader title={config.title} subtitle={config.description} actions={hasPermission('settings.update') ? <button className="rounded bg-emerald-600 px-4 py-2 text-white" onClick={event => open(null,event.currentTarget)}><Plus className="mr-1 inline h-4 w-4" />New</button> : undefined} />
    <PermissionGate action="settings.view" showAccessDenied>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">Search <input type="search" maxLength={200} className="rounded border p-2" value={search} onChange={event => {setSearch(event.target.value);setPage(1);}} /></label>
        <button className="rounded border p-2 text-sm" aria-expanded={showColumns} onClick={() => setShowColumns(!showColumns)}><Columns3 className="mr-1 inline h-4 w-4" />Add Column to List</button>
        {showColumns && <label className="text-sm"><input type="checkbox" checked={showDescription} onChange={event => {setShowDescription(event.target.checked);try {localStorage.setItem(`crm:${user?.id}:${kind}-roles:description`,String(event.target.checked));} catch { /* Optional preference only. */ }}} /> Description</label>}
      </div>
      {notice && <p role="status" className="mb-3 text-green-800">{notice}</p>}
      {list.isError ? <p role="alert">{list.error.message} <button onClick={() => void list.refetch()}>Retry</button></p> : <DataGrid columns={columns} data={list.data?.rows ?? []} keyExtractor={row => row.id} isLoading={list.isLoading} sortField={sort} sortDirection={ascending ? 'asc' : 'desc'} onSort={field => {if(field==='name'||field==='description'){setSort(field);setAscending(field===sort?!ascending:true);setPage(1);}}} emptyState={<div><p>No {config.title} found.</p>{hasPermission('settings.update') && <button className="mt-2 rounded border px-3 py-1" onClick={event => open(null,event.currentTarget)}>Add</button>}</div>} />}
      <nav aria-label={`${config.title} pagination`} className="mt-4 flex gap-4 text-sm"><button disabled={page===1||list.isFetching} onClick={() => setPage(page-1)}>Previous</button><span>Page {page} · {list.data?.count ?? 0} {config.title}</span><button disabled={list.isFetching||page*20 >= (list.data?.count ?? 0)} onClick={() => setPage(page+1)}>Next</button></nav>
    </PermissionGate>
    <dialog ref={formDialog} aria-labelledby="role-form-title" onCancel={event => {if(save.isPending)event.preventDefault();else close();}} className="w-[calc(100%_-_2rem)] max-w-lg rounded-xl p-6 backdrop:bg-black/40">
      <form onSubmit={event => {event.preventDefault();save.mutate(kind!=='customer' && editing===null && ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value==='new');}}>
        <h2 id="role-form-title" className="mb-4 text-lg font-semibold">{config.singular}</h2>
        <label className="mb-4 block text-sm">{config.singular} Name <span aria-hidden="true">*</span><input autoFocus required maxLength={50} value={name} onChange={event => setName(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
        <label className="mb-4 block text-sm">Description<textarea value={description} onChange={event => setDescription(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
        {save.error && <p role="alert" className="text-red-700">{save.error.message}</p>}
        <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={save.isPending} onClick={close}>Cancel</button>{kind!=='customer' && editing===null && <button type="submit" value="new" disabled={save.isPending||!name.trim()} className="rounded border border-emerald-200 px-4 py-2 text-emerald-800">Save &amp; New</button>}<button type="submit" value="save" disabled={save.isPending||!name.trim()} className="rounded bg-emerald-600 px-4 py-2 text-white">{save.isPending?'Saving…':'Save'}</button></div>
      </form>
    </dialog>
    <dialog ref={deleteDialog} aria-labelledby="role-delete-title" onCancel={event => {if(deletion.isPending)event.preventDefault();else close();}} className="w-[calc(100%_-_2rem)] max-w-lg rounded-xl p-6 backdrop:bg-black/40">
      <h2 id="role-delete-title" className="mb-4 text-lg font-semibold">Delete {config.singular}</h2><p>Delete {removing?.name}?</p>
      {kind==='customer' && <label className="my-4 block text-sm"><input type="checkbox" checked={confirmRelationships} onChange={event => setConfirmRelationships(event.target.checked)} /> If this role is used, remove its role labels while retaining all Contact and Account associations.</label>}
      {deletion.error && <p role="alert" className="text-red-700">{deletion.error.message}</p>}
      <div className="mt-5 flex justify-end gap-3"><button disabled={deletion.isPending} onClick={close}>Cancel</button><button disabled={deletion.isPending} className="rounded bg-red-600 px-4 py-2 text-white" onClick={() => deletion.mutate()}>{deletion.isPending?'Deleting…':'Delete'}</button></div>
    </dialog>
  </PageContainer>;
}
