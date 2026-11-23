'use client';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { DataGrid } from '@/components/ui/data-grid/data-grid';

export const tableWidgets=[{id:'won-leads',title:'Won Leads',module:'leads'},{id:'open-leads',title:'Open Leads (pipeline)',module:'leads'},{id:'accounts',title:'Accounts',module:'accounts'},{id:'contacts',title:'Contacts',module:'contacts'},{id:'campaigns',title:'Campaigns',module:'campaigns'},{id:'won-opportunities',title:'Closed Won Opportunities',module:'opportunities'}] as const;
const contract=z.object({columns:z.array(z.string()),rows:z.array(z.object({id:z.string()}).catchall(z.unknown())),missing:z.array(z.string()),has_more:z.boolean(),total_count:z.number()});
const labels:Record<string,string>={first_name:'First Name',last_name:'Last Name',email:'Email',lead_source:'Lead Source',name:'Name',campaign_name:'Campaign Name',account_type:'Account Type',account_source:'Account Source',annual_revenue:'Annual Revenue',title:'Title',contact_source:'Contact Source',campaign_type:'Campaign Type',status:'Status',amount:'Amount',stage:'Stage'};
const emptyMessages:Record<string,string>={accounts:'No accounts found.',contacts:'No contacts found.',campaigns:'No campaigns found.','won-leads':'No won leads found.','open-leads':'No open leads found.','won-opportunities':'No closed won opportunities found.'};

export function DashboardTable({id,title,module,dateFrom,dateTo,register}:{id:string;title:string;module:string;dateFrom:string|null;dateTo:string|null;register:(id:string,lines:string[]|null)=>void}){
 const {user,permissions,roleIds}=useAuth();const [search,setSearch]=useState('');const [sort,setSort]=useState('created_at');const [direction,setDirection]=useState<'asc'|'desc'>('desc');
 const sentinel=useRef<HTMLDivElement>(null);
 const query=useInfiniteQuery({
  queryKey:['crm',user?.id,[...roleIds,...permissions].sort().join('|'),'dashboard','table',id,dateFrom,dateTo,search,sort,direction],
  enabled:!!user,initialPageParam:1,
  queryFn:async({pageParam})=>{const r=await createClient().rpc('dashboard_home_table_page',{widget:id,page_number:pageParam,date_from:dateFrom||null,date_to:dateTo||null,search_query:search,sort_field:sort,sort_direction:direction});if(r.error)throw Error('Table unavailable');return contract.parse(r.data);},
  getNextPageParam:(last,pages)=>last.has_more?pages.length+1:undefined,
 });
 const first=query.data?.pages[0];const rows=query.data?.pages.flatMap(page=>page.rows)??[];
 useEffect(()=>{const element=sentinel.current;if(!element||!query.hasNextPage||query.isFetchingNextPage)return;const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)void query.fetchNextPage();},{rootMargin:'120px'});observer.observe(element);return()=>observer.disconnect();},[query.hasNextPage,query.isFetchingNextPage,query.fetchNextPage]);
 useEffect(()=>{const d=query.isFetching||query.isError?undefined:first;register(id,d?[...(d.missing.length?['Some columns are unavailable.']:[]),d.columns.join(' | '),...(rows.length?[]:[emptyMessages[id]]),...rows.map(row=>d.columns.map(c=>String(row[c]??'')).join(' | '))]:null);return()=>register(id,null);},[id,first,rows,query.isFetching,query.isError,register]);
 return <div className="flex min-h-0 flex-1 flex-col">
  <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold text-gray-900">{title}</h2><span className="shrink-0 text-xs font-medium text-[#737ac9]">Records ({first?.total_count??'—'})</span></div>
  {((first?.total_count??0)>0||!!search)&&<div className="flex flex-wrap items-center gap-2 mb-3"><label className="sr-only" htmlFor={'dashboard-search-'+id}>Search {id}</label><input id={'dashboard-search-'+id} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search" className="min-w-0 max-w-32 rounded border border-slate-200 px-2 py-1 text-xs"/><label className="sr-only" htmlFor={'dashboard-sort-'+id}>Sort {id}</label><select id={'dashboard-sort-'+id} value={sort} onChange={e=>setSort(e.target.value)} className="max-w-32 rounded border border-slate-200 px-1 py-1 text-xs"><option value="created_at">Newest</option>{first?.columns.map(c=><option key={c} value={c}>{labels[c]??c}</option>)}</select><button type="button" onClick={()=>setDirection(value=>value==='asc'?'desc':'asc')} aria-label="Reverse sort" className="text-xs">{direction==='asc'?'↑':'↓'}</button></div>}
  {query.isError&&<p role="alert">Records unavailable. <button onClick={()=>void query.refetch()}>Retry</button></p>}{!!first?.missing.length&&<p role="status">Some columns are unavailable.</p>}
  {first&&rows.length===0?<p className="text-center text-sm text-gray-500 py-4">{emptyMessages[id]}</p>:<div className="max-h-[370px] overflow-auto"><DataGrid<z.infer<typeof contract>['rows'][number]> data={rows} keyExtractor={r=>r.id} isLoading={query.isLoading} columns={(first?.columns??[]).map((c,i)=>({id:c,header:labels[c]??c,cell:row=>i===0?<Link href={'/'+module+'/'+row.id} className="hover:text-indigo-600">{String(row[c]??'')}</Link>:String(row[c]??'')}))}/><div ref={sentinel} className="h-1" aria-hidden="true"/>{query.isFetchingNextPage&&<p role="status" className="text-center text-xs">Loading more records…</p>}</div>}
 </div>;
}
