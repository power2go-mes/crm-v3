'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {Pencil,Trash2} from 'lucide-react';
import {useAuth} from '@/components/providers/auth-provider';
import {PermissionGate} from '@/components/auth/permission-gate';
import {PageContainer} from '@/components/shell/page-container';
import {PageHeader} from '@/components/shell/page-header';
import {DataGrid,type ColumnDef} from '@/components/ui/data-grid/data-grid';
import {HolidayFormFields} from '@/components/settings/holiday-form-fields';
import {SettingsUserNames,SettingsUserSelector} from '@/components/settings/settings-user-selector';
import {createClient} from '@/lib/supabase/client';
import {deleteHoliday,holidayRecurrence,holidayRow,initialHoliday,saveHoliday,type Holiday} from '@/lib/settings/holidays';

export default function HolidaysPage(){const {user,permissions}=useAuth();return <Holidays key={`${user?.id}:${[...permissions].sort().join('|')}`}/>;}
function Holidays(){
 const {user,profile,permissions,hasPermission,isLoading}=useAuth();const client=createClient();const cache=useQueryClient();const key=['crm',user?.id,'holidays'];
 const [search,setSearch]=useState('');const [page,setPage]=useState(1);const [sort,setSort]=useState<'name'|'start_date'|'end_date'|'is_recurring'>('start_date');const [ascending,setAscending]=useState(false);
 const [editing,setEditing]=useState<Holiday|null|undefined>();const [detail,setDetail]=useState<Holiday|null>(null);const [removing,setRemoving]=useState<Holiday|null>(null);const [form,setForm]=useState(initialHoliday);const [selected,setSelected]=useState<string[]>([]);const [opening,setOpening]=useState(false);const [notice,setNotice]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);const detailDialog=useRef<HTMLDialogElement>(null);const deleteDialog=useRef<HTMLDialogElement>(null);const trigger=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{if(editing!==undefined)dialog.current?.showModal();else dialog.current?.close();},[editing]);
 useEffect(()=>{if(detail)detailDialog.current?.showModal();else detailDialog.current?.close();},[detail]);
 useEffect(()=>{if(removing)deleteDialog.current?.showModal();else deleteDialog.current?.close();},[removing]);
 const enabled=!isLoading&&!!user&&!!profile?.is_active&&hasPermission('holidays.view');
 const list=useQuery({queryKey:[...key,[...permissions].sort().join('|'),search,page,sort,ascending],enabled,queryFn:async()=>{
  let query=client.from('crm_holidays').select('id,definition,start_date,end_date',{count:'exact'});
  if(search.trim())query=query.ilike('name',`%${search.trim().replace(/[\\%_]/g,'\\$&')}%`);
  const {data,count,error}=await query.order(sort,{ascending}).order('id').range((page-1)*20,page*20-1);
  if(error)throw new Error('Holidays could not be loaded.');return {rows:z.array(holidayRow).parse(data),count:count??0};
 }});
 const detailUsers=useQuery({queryKey:[...key,'detail-users',detail?.id],enabled:enabled&&!!detail&&!detail.definition.all_users,queryFn:async()=>{const {data,error}=await client.from('crm_holiday_users').select('user_id').eq('holiday_id',detail!.id).limit(201);if(error)throw new Error('Holiday users could not be loaded.');if(data.length>200)throw new Error('Holiday user selection exceeds this editor limit.');return data;}});
 async function invalidate(){await Promise.all([cache.invalidateQueries({queryKey:key}),cache.invalidateQueries({queryKey:['crm',user?.id,'business-hours']})]);}
 function close(){setEditing(undefined);trigger.current?.focus();}
 const save=useMutation({mutationFn:async(keepOpen:boolean)=>{await saveHoliday(client,{id:editing?.id??null,definition:form,specific_users:selected});return keepOpen;},onSuccess:async keepOpen=>{await invalidate();setNotice('Holiday saved successfully.');setDetail(null);if(keepOpen){setForm(initialHoliday());setSelected([]);dialog.current?.querySelector('input')?.focus();}else close();}});
 const deletion=useMutation({mutationFn:()=>{if(!removing)throw new Error('Select a holiday.');return deleteHoliday(client,removing.id);},onSuccess:async()=>{await invalidate();setNotice('Holiday deleted successfully.');setRemoving(null);setDetail(null);setPage(1);trigger.current?.focus();}});
 async function open(record:Holiday|null,button:HTMLButtonElement){
  trigger.current=button;setOpening(true);save.reset();try{
   let ids:string[]=[];if(record){const {data,error}=await client.from('crm_holiday_users').select('user_id').eq('holiday_id',record.id).limit(201);if(error)throw new Error('Holiday users could not be loaded.');if(data.length>200)throw new Error('Holiday exceeds this editor user limit; no truncated edit opened.');ids=data.map(item=>item.user_id);}
   setForm(record?structuredClone(record.definition):initialHoliday());setSelected(ids);setEditing(record);
  }catch(error){setNotice(error instanceof Error?error.message:'Holiday could not be opened.');}finally{setOpening(false);}
 }
 function askDelete(row:Holiday,button:HTMLButtonElement){trigger.current=button;deletion.reset();setRemoving(row);}
 const columns:ColumnDef<Holiday>[]=[
  {id:'name',header:'Holiday Name',sortable:true,cell:row=><button className="text-emerald-800" onClick={event=>{trigger.current=event.currentTarget;setDetail(row);}}>{row.definition.name}</button>},
  {id:'start_date',header:'Start Date',sortable:true,cell:row=>new Date(row.start_date).toLocaleString()},
  {id:'end_date',header:'End Date',sortable:true,cell:row=>new Date(row.end_date).toLocaleString()},
  {id:'is_recurring',header:'Recurring',sortable:true,cell:row=>row.definition.is_recurring?'Yes':'No'},
  {id:'actions',header:'Actions',cell:row=><div className="flex gap-3">{hasPermission('holidays.update')&&<button disabled={opening} aria-label={`Edit ${row.definition.name}`} onClick={event=>void open(row,event.currentTarget)}><Pencil className="h-4 w-4"/></button>}{hasPermission('holidays.delete')&&<button aria-label={`Delete ${row.definition.name}`} onClick={event=>askDelete(row,event.currentTarget)}><Trash2 className="h-4 w-4"/></button>}</div>},
 ];
 return <PageContainer><Link href="/settings" className="text-sm text-emerald-800">Settings</Link><PageHeader title="Holidays" subtitle="Manage the holidays observed by your company." actions={hasPermission('holidays.create')?<button disabled={opening} className="rounded bg-emerald-600 px-4 py-2 text-white" onClick={event=>void open(null,event.currentTarget)}>Add Holidays</button>:undefined}/>
  <PermissionGate action="holidays.view" showAccessDenied><label className="mb-4 block text-sm">Search <input type="search" maxLength={200} value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}} className="rounded border p-2"/></label>{notice&&<p role="status" className="mb-3">{notice}</p>}
   {list.isError?<p role="alert">{list.error.message} <button onClick={()=>void list.refetch()}>Retry</button></p>:<DataGrid columns={columns} data={list.data?.rows??[]} keyExtractor={row=>row.id} isLoading={list.isLoading} sortField={sort} sortDirection={ascending?'asc':'desc'} onSort={field=>{if(field==='name'||field==='start_date'||field==='end_date'||field==='is_recurring'){setSort(field);setAscending(field===sort?!ascending:true);setPage(1);}}} emptyState={<div><p>No Holidays found.</p>{hasPermission('holidays.create')&&<button disabled={opening} className="mt-2 rounded border px-3 py-1" onClick={event=>void open(null,event.currentTarget)}>Add</button>}</div>}/>}
   <nav aria-label="Holiday pagination" className="mt-4 flex gap-4 text-sm"><button disabled={page===1||list.isFetching} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} · {list.data?.count??0} Holidays</span><button disabled={list.isFetching||page*20>=(list.data?.count??0)} onClick={()=>setPage(page+1)}>Next</button></nav>
  </PermissionGate>
  <dialog ref={dialog} aria-labelledby="holiday-form-title" onCancel={event=>{if(save.isPending)event.preventDefault();else close();}} className="max-h-[90vh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-xl p-6 backdrop:bg-black/40"><form className="space-y-4" onSubmit={event=>{event.preventDefault();save.mutate(((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null)?.value==='new');}}><h2 id="holiday-form-title" className="text-lg font-semibold">Holiday Form</h2><HolidayFormFields value={form} onChange={next=>{setForm(next);if(next.all_users)setSelected([]);}} specificUsers={<SettingsUserSelector ids={selected} onChange={setSelected} label="Specific Users *"/>}/>
   {save.error&&<p role="alert" className="text-red-700">{save.error.message}</p>}<div className="flex justify-end gap-3 border-t pt-4"><button type="button" disabled={save.isPending} onClick={close}>Cancel</button>{editing===null&&<button type="submit" value="new" disabled={save.isPending} className="rounded border px-4 py-2">Save &amp; New</button>}<button type="submit" value="save" disabled={save.isPending||!form.all_users&&!selected.length} className="rounded bg-emerald-600 px-4 py-2 text-white">{save.isPending?'Saving…':'Save'}</button></div>
  </form></dialog>
  <dialog ref={detailDialog} aria-labelledby="holiday-detail-title" onCancel={()=>{setDetail(null);trigger.current?.focus();}} className="w-[calc(100%_-_2rem)] max-w-xl rounded-xl p-6 backdrop:bg-black/40">{detail&&<><h2 id="holiday-detail-title" className="mb-4 text-lg font-semibold">{detail.definition.name}</h2><dl className="grid grid-cols-2 gap-3 text-sm"><dt>Start Date</dt><dd>{new Date(detail.start_date).toLocaleString()}</dd><dt>End Date</dt><dd>{new Date(detail.end_date).toLocaleString()}</dd><dt>Specific Users</dt><dd>{detail.definition.all_users?'All users are included':detailUsers.isError?<span role="alert">Users could not be loaded. <button onClick={()=>void detailUsers.refetch()}>Retry</button></span>:detailUsers.isPending?'Loading users…':<SettingsUserNames ids={detailUsers.data?.map(item=>item.user_id)??[]}/>}</dd><dt>Recurring</dt><dd>{holidayRecurrence(detail.definition)}</dd></dl><div className="mt-5 flex justify-end gap-3">{hasPermission('holidays.update')&&<button disabled={opening} className="rounded bg-emerald-600 px-4 py-2 text-white" onClick={event=>void open(detail,event.currentTarget)}>Edit</button>}{hasPermission('holidays.delete')&&<button className="rounded border px-4 py-2" onClick={event=>askDelete(detail,event.currentTarget)}>Delete</button>}<button onClick={()=>{setDetail(null);trigger.current?.focus();}}>Close</button></div></>}</dialog>
  <dialog ref={deleteDialog} aria-labelledby="holiday-delete-title" onCancel={event=>{if(deletion.isPending)event.preventDefault();else setRemoving(null);}} className="w-[calc(100%_-_2rem)] max-w-lg rounded-xl p-6 backdrop:bg-black/40"><h2 id="holiday-delete-title" className="mb-4 text-lg font-semibold">Delete Holiday</h2><p>Delete {removing?.definition.name}?</p>{deletion.error&&<p role="alert" className="text-red-700">{deletion.error.message}</p>}<div className="mt-5 flex justify-end gap-3"><button disabled={deletion.isPending} onClick={()=>setRemoving(null)}>Cancel</button><button disabled={deletion.isPending} className="rounded bg-red-600 px-4 py-2 text-white" onClick={()=>deletion.mutate()}>{deletion.isPending?'Deleting…':'Delete'}</button></div></dialog>
 </PageContainer>;
}
