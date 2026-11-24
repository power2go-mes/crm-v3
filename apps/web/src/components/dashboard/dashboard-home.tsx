'use client';
import { useCallback,useRef,useState } from 'react';
import { usePathname,useRouter,useSearchParams } from 'next/navigation';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { ECharts } from 'echarts';
import Link from 'next/link';
import {Building2, CalendarDays, Contact, Handshake, Layers3, Megaphone} from 'lucide-react';
import { DashboardTable,tableWidgets } from './dashboard-table';
import { sourceHomeBlocks,orderedBlocks,dashboardDateQuery,dashboardFilterUrl } from './widget-order';
import { DashboardChart } from './dashboard-chart';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageContainer } from '@/components/shell/page-container';
const contract=z.object({kpis:z.array(z.object({title:z.string(),value:z.number()})),charts:z.array(z.object({id:z.string(),title:z.string(),kind:z.string(),status:z.string(),data:z.array(z.object({label:z.string(),value:z.number()}))}))});
const kpiPresentation={
 'Total Accounts':{href:'/accounts',icon:Building2,background:'bg-[#e0e7ff]',foreground:'text-[#4f46e5]'},
 'Total Campaigns':{href:'/campaigns',icon:Megaphone,background:'bg-[#ffedd5]',foreground:'text-[#c2410c]'},
 'Total Contacts':{href:'/contacts',icon:Contact,background:'bg-[#dcfce7]',foreground:'text-[#15803d]'},
 'Total Leads':{href:'/leads',icon:Layers3,background:'bg-[#dbeafe]',foreground:'text-[#2563eb]'},
 'Total Opportunities':{href:'/opportunities',icon:Handshake,background:'bg-[#f3e8ff]',foreground:'text-[#7e22ce]'},
} as const;
const homeChartTitles:Record<string,string>={'accounts.account_type':'Accounts','campaigns.campaign_type':'Campaigns','opportunities.lead_source':'Opportunities'};
export function DashboardHome(){
 const {user,profile,permissions,roleIds,hasPermission,isLoading}=useAuth();const cache=useQueryClient();
 const searchParams=useSearchParams();const router=useRouter();const pathname=usePathname();
 const {range,from,to}=dashboardDateQuery(searchParams.toString());
 function filter(name:string,value:string){router.push(pathname+'?'+dashboardFilterUrl(searchParams.toString(),name,value),{scroll:false});}
 const setRange=(value:string)=>filter('date_range',value);const setFrom=(value:string)=>filter('date_from',value);const setTo=(value:string)=>filter('date_to',value);
const [draft,setDraft]=useState<string[]|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const instances=useRef(new Map<string,ECharts>());const dragged=useRef('');
 const register=useCallback((id:string,chart:ECharts|null)=>{if(chart)instances.current.set(id,chart);else instances.current.delete(id);},[]);
 const signature=[...roleIds,...permissions].sort().join('|');const key=['crm',user?.id,signature,'dashboard'];
 const enabled=!isLoading&&!!user&&!!profile?.is_active&&hasPermission('dashboard.view');
 const data=useQuery({queryKey:[...key,'metrics',range,from,to],enabled:enabled&&(range!=='custom'||!!from&&!!to&&from<=to),queryFn:async()=>{
 let start:string|null=null;let end:string|null=null;
 if(range==='custom'){start=from;end=to;}else if(range!=='all'){const date=new Date();date.setDate(date.getDate()-Number(range));start=date.toISOString().slice(0,10);}
 const r=await createClient().rpc('dashboard_home_metrics',{date_from:start,date_to:end});if(r.error)throw Error('Dashboard unavailable');return contract.parse(r.data);}});
 const layout=useQuery({queryKey:[...key,'layout'],enabled,queryFn:async()=>{const r=await createClient().rpc('dashboard_home_layout',{});if(r.error)throw Error('Layout unavailable');return z.array(z.string()).parse(r.data);}});
 const tableLines=useRef(new Map<string,string[]>());
 const registerTable=useCallback((id:string,lines:string[]|null)=>{if(lines)tableLines.current.set(id,lines);else tableLines.current.delete(id);},[]);
 const startDate=range==='custom'?from:range==='all'?null:new Date(Date.now()-Number(range)*86400000).toISOString().slice(0,10);const endDate=range==='custom'?to:null;
 const validDates=range!=='custom'||!!from&&!!to&&from<=to;
 const available=validDates?sourceHomeBlocks(data.data?.charts??[],tableWidgets.filter(t=>hasPermission(t.module+'.view')).map(t=>({...t,kind:'table',status:'ready',data:[]}))):[];const order=draft??layout.data??[];
 const charts=orderedBlocks(available,order);
 const kpis=orderedBlocks(data.data?.kpis.map(k=>({...k,id:'kpi:'+k.title}))??[],order);
 async function save(reset=false){setBusy(true);setError('');try{const r=await createClient().rpc('dashboard_home_layout',reset?{reset_layout:true}:{order_ids:draft??[...kpis.map(k=>k.id),...charts.map(c=>c.id)]});if(r.error)throw Error();await cache.invalidateQueries({queryKey:[...key,'layout']});setDraft(null);}catch{setError('Layout could not be saved.');}finally{setBusy(false);}}
 async function pdf(){setBusy(true);setError('');try{const {dashboardPdf}=await import('./dashboard-pdf');const title=range==='custom'?from+' to '+to:range==='all'?'All Time':'Last '+range+' Days';dashboardPdf(title,data.data?.kpis??[],charts,instances.current,tableLines.current).save('dashboard.pdf');}catch{setError('Dashboard PDF could not be generated.');}finally{setBusy(false);}}
 function move(id:string,target:string){const ids=(draft??[...kpis.map(k=>k.id),...charts.map(c=>c.id)]).filter(x=>x!==id);ids.splice(ids.indexOf(target),0,id);setDraft(ids);}
 const greeting=[profile?.first_name,profile?.last_name].filter(Boolean).join(' ')||'there';
 return <PageContainer maxWidth="full" className="bg-[#f8fafc] min-h-full"><PermissionGate action="dashboard.view" showAccessDenied><div className="flex flex-wrap justify-between gap-3 items-center mb-2"><div className="space-y-0.5"><h1 className="text-xl font-bold tracking-tight text-slate-900">Welcome, {greeting}</h1><p className="text-xs text-slate-500">Get started by exploring your operational overview below.</p></div><div className="flex flex-wrap items-center gap-2">
 <label className="inline-flex items-center gap-2 border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-sm text-slate-700 shadow-2xs hover:border-emerald-300 transition"><CalendarDays size={16} className="text-emerald-600" aria-hidden="true"/><select aria-label="Date range" value={range} onChange={e=>setRange(e.target.value)} className="bg-transparent min-w-[145px] outline-none font-medium cursor-pointer"><option value="all">All Time</option>{[7,30,60,90].map(n=><option key={n} value={n}>Last {n} Days</option>)}<option value="custom">Custom Range</option></select></label>
 {range==='custom'&&<><label className="text-xs text-slate-500 font-medium">Start<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="ml-1 rounded border border-slate-200 px-2 py-1 text-sm bg-white"/></label><label className="text-xs text-slate-500 font-medium">End<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="ml-1 rounded border border-slate-200 px-2 py-1 text-sm bg-white"/></label></>}
 {draft===null?<button disabled={busy||!data.data||layout.isPending||layout.isError} onClick={()=>setDraft([...kpis.map(k=>k.id),...charts.map(c=>c.id)])} className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg px-3.5 py-1.5 text-sm shadow-2xs transition disabled:opacity-50">Reorder</button>:<><button disabled={busy} onClick={()=>void save()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg px-3.5 py-1.5 text-sm shadow-2xs transition">Save</button><button disabled={busy} onClick={()=>void save(true)} className="border border-slate-200 bg-white text-slate-700 rounded-lg px-3 py-1.5 text-sm">Default</button><button disabled={busy} onClick={()=>setDraft(null)} className="border border-slate-200 bg-white text-slate-500 rounded-lg px-3 py-1.5 text-sm">Cancel</button></>}
 <Link href="/dashboards" className="rounded-lg px-4 py-1.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition">View Dashboards</Link><button disabled={busy||data.isFetching||!data.data} onClick={()=>void pdf()} className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium px-3 py-1.5 text-sm shadow-2xs transition">Export PDF</button><button disabled={data.isFetching} onClick={()=>void cache.invalidateQueries({queryKey:key})} className="rounded-lg border border-orange-200 bg-orange-50/60 hover:bg-orange-100 text-orange-800 font-semibold px-3 py-1.5 text-sm transition">Refresh</button></div></div>
 {error&&<p role="alert">{error}</p>}{data.isFetching&&<p role="status">Loading Dashboard...</p>}{data.isError&&<p role="alert">Dashboard could not be loaded. Use Refresh to retry.</p>}{layout.isError&&<p role="alert">Saved layout unavailable.</p>}
 {range==='custom'&&(!from||!to||from>to)&&<p role="alert">Select a valid date range.</p>}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">{kpis.map((k,i)=>{const presentation=kpiPresentation[k.title as keyof typeof kpiPresentation];if(!presentation)return null;const Icon=presentation.icon;return <div key={k.title} onDragOver={e=>{if(draft)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(draft&&dragged.current)move(dragged.current,k.id);dragged.current='';}} className="relative rounded-xl border border-slate-100 bg-white shadow-xs min-h-[120px] p-4 flex items-center gap-3.5 hover:border-emerald-200 transition">{draft&&<button draggable onDragStart={()=>{dragged.current=k.id;}} onDragEnd={()=>{dragged.current='';}} aria-label={'Move '+k.title} className="absolute right-3 top-2 cursor-grab text-sm text-gray-500">Drag</button>}<span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700`}><Icon size={20} aria-hidden="true"/></span><Link href={presentation.href} className="min-w-0 flex-1"><p className="text-slate-500 text-xs font-medium truncate">{k.title}</p><p className="text-xl font-bold text-slate-900">{k.value.toLocaleString()}</p></Link>{draft&&i>0&&<button onClick={()=>move(k.id,kpis[i-1].id)} className="sr-only focus:not-sr-only">Move up</button>}</div>;})}</div>
 <div className="grid grid-cols-12 gap-4 items-stretch">{charts.map((c,i)=><section key={c.id} onDragOver={e=>{if(draft)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(draft&&dragged.current)move(dragged.current,c.id);dragged.current='';}} className="col-span-12 md:col-span-6 xl:col-span-4 rounded-xl border border-slate-100 bg-white shadow-xs p-5 min-h-[480px] flex flex-col overflow-hidden">
 {draft&&<div className="flex gap-2"><button draggable onDragStart={()=>{dragged.current=c.id;}} onDragEnd={()=>{dragged.current='';}} aria-label={'Move '+c.title}>Drag</button><button disabled={i===0} onClick={()=>move(c.id,charts[i-1].id)}>Move up</button></div>}{c.kind==='table'?<DashboardTable key={c.id+range+from+to} id={c.id} title={c.title} module={tableWidgets.find(t=>t.id===c.id)!.module} dateFrom={startDate} dateTo={endDate} register={registerTable}/>:<><h2 className="font-semibold mb-4 text-slate-900">{homeChartTitles[c.id]??c.title}</h2><DashboardChart chart={c} register={register}/></>}</section>)}</div>
 </PermissionGate></PageContainer>;
}
