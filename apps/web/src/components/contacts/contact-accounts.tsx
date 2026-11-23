'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
const links = z.array(z.object({account_id:z.string().uuid(),name:z.string(),role_id:z.string().nullable(),role:z.string().nullable(),legacy:z.boolean()}));
const roles = z.array(z.object({id:z.string().uuid(),name:z.string()}));
export function ContactAccounts({id}:{id:string}) {
 const {user,hasPermission,profile,isLoading}=useAuth(); const cache=useQueryClient();
 const [search,setSearch]=useState(''); const [account,setAccount]=useState(''); const [role,setRole]=useState(''); const [pending,setPending]=useState(false); const [error,setError]=useState('');
 const enabled=!isLoading&&!!user&&!!profile?.is_active&&hasPermission('contacts.view');
 const key=['crm',user?.id,'contacts','relationships',id];
 const related=useQuery({queryKey:key,enabled,queryFn:async()=>{const r=await createClient().rpc('contact_accounts',{cid:id});if(r.error)throw Error('Unavailable');return links.parse(r.data);}});
 const choices=useQuery({queryKey:['crm',user?.id,'contact-account-options',search],enabled:enabled&&hasPermission('accounts.view')&&hasPermission('contacts.update'),queryFn:async()=>{
 const term=search.trim().slice(0,100).replace(/[\\%_]/g,'\\$&'); const c=createClient(); const [a,r]=await Promise.all([c.from('accounts').select('id,name').ilike('name',`%${term}%`).order('name').limit(50),c.rpc('contact_account_roles',{})]);if(a.error||r.error)throw Error('Unavailable');return {accounts:a.data,roles:roles.parse(r.data)};}});
 async function save(aid:string,rid:string|null,remove=false){setPending(true);setError('');try{const r=await createClient().rpc('set_contact_account',{cid:id,aid,rid,remove_link:remove});if(r.error)throw Error('Relationship could not be saved. Check access and the selected records.');await cache.invalidateQueries({queryKey:key});}catch{setError('Relationship could not be saved. Check access and the selected records.');}finally{setPending(false);}}
 return <section className="mt-6 rounded border bg-white p-4"><h2 className="font-semibold">Related Accounts</h2>
 {related.isLoading&&<p role="status">Loading accounts...</p>}{related.isError&&<p role="alert">Related Accounts unavailable.</p>}
 <ul>{related.data?.map(a=><li key={a.account_id} className="flex flex-wrap gap-3 py-2"><span>{a.name}</span><span>{a.role??'No role'}</span>{hasPermission('contacts.update')&&<>
 <select aria-label={'Role for '+a.name} disabled={pending} value={a.role_id??''} onChange={e=>void save(a.account_id,e.target.value||null)}><option value="">No role</option>{choices.data?.roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>
 <button disabled={pending||a.legacy} onClick={()=>void save(a.account_id,null,true)}>Remove</button>{a.legacy&&<span>Existing account association</span>}</>}</li>)}</ul>
 {hasPermission('contacts.update')&&<form onSubmit={e=>{e.preventDefault();void save(account,role||null);}} className="flex flex-wrap gap-2 mt-3">
 <input aria-label="Search Accounts" placeholder="Search Accounts" value={search} onChange={e=>setSearch(e.target.value)} />
 <select aria-label="Account" required value={account} onChange={e=>setAccount(e.target.value)}><option value="">Select Account</option>{choices.data?.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
 <select aria-label="Relationship Role" value={role} onChange={e=>setRole(e.target.value)}><option value="">No role</option>{choices.data?.roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>
 <button disabled={pending||!account||choices.isError}>Add Account</button>{choices.isError&&<p role="alert">Account choices unavailable.</p>}</form>}{error&&<p role="alert">{error}</p>}</section>;
}
