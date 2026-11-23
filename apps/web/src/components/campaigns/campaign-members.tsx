'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import type {CampaignMemberRecord} from '@finlonexa/database';
import {useAuth} from '@/components/providers/auth-provider';
import {createClient} from '@/lib/supabase/client';
import {addCampaignMember,updateCampaignMember,removeCampaignMember} from '@/lib/campaigns/members';
import {DataGrid} from '@/components/ui/data-grid/data-grid';
const statuses=[['planned','Planned'],['sent','Sent'],['recieved','Recieved'],['responded','Responded']] as const;
export function CampaignMembers({campaignId}:{campaignId:string}){
 const {user,profile,permissions,roleIds,hasPermission,isLoading}=useAuth();const cache=useQueryClient();const [page,setPage]=useState(1);const [kind,setKind]=useState<'lead'|'contact'>('lead');const [term,setTerm]=useState('');const [chosen,setChosen]=useState('');const [status,setStatus]=useState('');const [pending,setPending]=useState(false);const [error,setError]=useState('');
 const signature=[...roleIds,...permissions].sort().join('|');const enabled=!isLoading&&!!user&&!!profile?.is_active&&hasPermission('campaigns.view');
 const members=useQuery({queryKey:['crm',user?.id,'campaigns','members',campaignId,page,signature],enabled,queryFn:async()=>{
 const c=createClient();const r=await c.from('campaign_members').select('*',{count:'exact'}).eq('campaign_id',campaignId).order('created_at',{ascending:false}).order('id').range((page-1)*20,page*20-1);if(r.error)throw Error('Members unavailable');
 const leadIds=r.data.flatMap(m=>m.lead_id?[m.lead_id]:[]),contactIds=r.data.flatMap(m=>m.contact_id?[m.contact_id]:[]);
 const [leads,contacts]=await Promise.all([leadIds.length?c.from('leads').select('id,title,first_name,last_name').in('id',leadIds):Promise.resolve({data:[],error:null}),contactIds.length?c.from('contacts').select('id,first_name,last_name').in('id',contactIds):Promise.resolve({data:[],error:null})]);if(leads.error||contacts.error)throw Error('Member labels unavailable');
 const names=new Map([...(leads.data??[]).map(l=>[l.id,l.title||l.first_name+' '+l.last_name] as const),...(contacts.data??[]).map(c=>[c.id,c.first_name+' '+c.last_name] as const)]);
 return {rows:r.data,count:r.count??0,names};}});
 const options=useQuery({queryKey:['crm',user?.id,'campaigns','member-options',kind,term,signature],enabled:enabled&&hasPermission('campaigns.update')&&hasPermission(kind==='lead'?'leads.view':'contacts.view'),queryFn:async()=>{const t=term.trim().slice(0,100).replace(/[\\%_]/g,'\\$&');const c=createClient();if(kind==='lead'){const r=await c.from('leads').select('id,title,first_name,last_name').ilike('title',`%${t}%`).order('title').limit(50);if(r.error)throw Error();return r.data.map(l=>({id:l.id,label:l.title||l.first_name+' '+l.last_name}));}const r=await c.from('contacts').select('id,first_name,last_name').ilike('first_name',`%${t}%`).order('first_name').limit(50);if(r.error)throw Error();return r.data.map(c=>({id:c.id,label:c.first_name+' '+c.last_name}));}});
 async function mutate(operation:()=>PromiseLike<{error:unknown;data:unknown}>){if(!hasPermission('campaigns.update'))return;setPending(true);setError('');try{const r=await operation();if(r.error||!r.data)throw Error();await cache.invalidateQueries({queryKey:['crm',user?.id]});}catch{setError('Member change could not be saved. Check permissions, record access, and duplicate membership.');}finally{setPending(false);}}
 return <section className="mt-6 border rounded-xl bg-white p-4"><h2 className="font-semibold">Campaign Members</h2>
 {members.isError&&<p role="alert">Campaign members unavailable. <button onClick={()=>void members.refetch()}>Retry</button></p>}
 <DataGrid<CampaignMemberRecord> data={members.data?.rows??[]} keyExtractor={m=>m.id} isLoading={members.isLoading} columns={[{id:'member',header:'Member',cell:m=><Link href={(m.member_type==='lead'?'/leads/':'/contacts/')+(m.lead_id??m.contact_id)}>{members.data?.names.get(m.lead_id??m.contact_id??'')??'Unavailable'}</Link>},{id:'member_type',header:'Type',accessorKey:'member_type'},{id:'member_status',header:'Member Status',cell:m=>hasPermission('campaigns.update')?<select aria-label="Member Status" disabled={pending} value={m.member_status} onChange={e=>void mutate(()=>updateCampaignMember(createClient(),campaignId,m.id,e.target.value))}>{statuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:statuses.find(([v])=>v===m.member_status)?.[1]??m.member_status},{id:'actions',header:'',cell:m=>hasPermission('campaigns.update')?<button disabled={pending} onClick={()=>{if(window.confirm('Remove this campaign member?'))void mutate(()=>removeCampaignMember(createClient(),campaignId,m.id));}}>Remove</button>:null}]}/>
 <div className="flex justify-between mt-2"><button disabled={page===1||members.isFetching} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page}</span><button disabled={page*20>=(members.data?.count??0)||members.isFetching} onClick={()=>setPage(p=>p+1)}>Next</button></div>
 {hasPermission('campaigns.update')&&<form className="flex flex-wrap gap-2 mt-4" onSubmit={e=>{e.preventDefault();void mutate(()=>addCampaignMember(createClient(),campaignId,kind,chosen,status));}}>
 <select aria-label="Member Type" value={kind} onChange={e=>{setKind(e.target.value as 'lead'|'contact');setChosen('');}}><option value="lead">Lead</option><option value="contact">Contact</option></select>
 <input aria-label="Search Members" placeholder="Search Members" value={term} onChange={e=>setTerm(e.target.value)}/>
 <select required aria-label="Member" value={chosen} onChange={e=>setChosen(e.target.value)}><option value="">Select Member</option>{options.data?.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select>
 <select required aria-label="Member Status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Select Status</option>{statuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
 <button disabled={pending||!chosen||!status}>Add Member</button>{options.isError&&<p role="alert">Member choices unavailable.</p>}</form>}{error&&<p role="alert">{error}</p>}</section>;
}
