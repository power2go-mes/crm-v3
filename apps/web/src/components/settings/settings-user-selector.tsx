'use client';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/components/providers/auth-provider';
import {createClient} from '@/lib/supabase/client';
export function SettingsUserNames({ids}:{ids:string[]}){
 const {user,permissions}=useAuth();const query=useQuery({queryKey:['crm',user?.id,'settings-user-labels',[...permissions].sort().join('|'),[...ids].sort().join('|')],enabled:!!user&&ids.length>0&&ids.length<=200,queryFn:async()=>{const {data,error}=await createClient().from('user_profiles').select('id,first_name,last_name').in('id',ids).limit(200);if(error)throw new Error('User names could not be loaded.');return data;}});
 if(!ids.length)return <>—</>;if(query.isError)return <span role="alert">{query.error.message}</span>;if(query.isPending)return <>Loading users…</>;
 return <>{ids.map(id=>{const person=query.data.find(person=>person.id===id);return person?`${person.first_name} ${person.last_name}`:'User unavailable';}).join(', ')}</>;
}
export function SettingsUserSelector({ids,onChange,label='Assigned Users'}:{ids:string[];onChange:(ids:string[])=>void;label?:string}){
 const {user,permissions,hasPermission}=useAuth();const [search,setSearch]=useState('');
 const query=useQuery({queryKey:['crm',user?.id,'settings-user-options',[...permissions].sort().join('|'),search],enabled:!!user&&hasPermission('users.view'),queryFn:async()=>{
  let q=createClient().from('user_profiles').select('id,first_name,last_name').order('first_name').order('id').limit(50);if(search.trim())q=q.ilike('first_name',`%${search.trim().replace(/[\\%_]/g,'\\$&')}%`);const {data,error}=await q;if(error)throw new Error('Users could not be loaded.');return data;
 }});
 return <fieldset className="space-y-2 rounded border p-3"><legend>{label}</legend>{!hasPermission('users.view')?<p className="text-sm">User selection requires Users view permission.</p>:<><label className="block text-sm">Search Users by First Name<input className="ml-2 rounded border p-2" maxLength={100} value={search} onChange={event=>setSearch(event.target.value)}/></label>{query.isError?<p role="alert">{query.error.message} <button type="button" onClick={()=>void query.refetch()}>Retry</button></p>:query.isLoading?<p role="status">Loading users…</p>:<div className="max-h-40 overflow-y-auto">{query.data?.map(person=><label key={person.id} className="mb-2 block text-sm"><input type="checkbox" checked={ids.includes(person.id)} disabled={!ids.includes(person.id)&&ids.length>=200} onChange={event=>onChange(event.target.checked?[...ids,person.id]:ids.filter(id=>id!==person.id))}/> {person.first_name} {person.last_name}</label>)}</div>}</>}
  <p className="text-xs">{ids.length} selected · up to 50 matching users shown.</p><div className="text-sm"><SettingsUserNames ids={ids}/></div>{ids.map(id=><button type="button" key={id} className="mr-2 text-xs text-emerald-800" aria-label={`Remove selected user ${id}`} onClick={()=>onChange(ids.filter(value=>value!==id))}>Remove {id}</button>)}
 </fieldset>;
}
