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
const kpiPresentation = {
  'Total Accounts': { href: '/accounts', icon: Building2, background: 'bg-[#eef2ff]', foreground: 'text-[#4361ee]', delta: '+12%', highlight: true },
  'Total Campaigns': { href: '/campaigns', icon: Megaphone, background: 'bg-[#ffeedd]', foreground: 'text-[#f97316]', delta: '+18%' },
  'Total Contacts': { href: '/contacts', icon: Contact, background: 'bg-[#e0f7ef]', foreground: 'text-[#06d6a0]', delta: '+25%' },
  'Total Leads': { href: '/leads', icon: Layers3, background: 'bg-[#e6f4ff]', foreground: 'text-[#0ea5e9]', delta: '+15%' },
  'Total Opportunities': { href: '/opportunities', icon: Handshake, background: 'bg-[#f4ebff]', foreground: 'text-[#8b5cf6]', delta: '+32%' },
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
 return <PageContainer maxWidth="full" className="bg-[#f4f6fa] min-h-full"><PermissionGate action="dashboard.view" showAccessDenied><div className="flex flex-wrap justify-between gap-3 items-center mb-5"><div className="space-y-0.5"><h1 className="text-xl font-bold tracking-tight text-slate-900">Welcome, {greeting}</h1><p className="text-xs text-slate-500">Here is your sales performance and operational overview today.</p></div><div className="flex flex-wrap items-center gap-2.5">
 <label className="inline-flex items-center gap-2 border border-slate-200/80 bg-white rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:border-indigo-200 transition"><CalendarDays size={15} className="text-[#4361ee]" aria-hidden="true"/><select aria-label="Date range" value={range} onChange={e=>setRange(e.target.value)} className="bg-transparent min-w-[130px] outline-none font-semibold cursor-pointer"><option value="all">All Time</option>{[7,30,60,90].map(n=><option key={n} value={n}>Last {n} Days</option>)}<option value="custom">Custom Range</option></select></label>
 {range==='custom'&&<><label className="text-xs text-slate-500 font-medium">Start<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="ml-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs bg-white"/></label><label className="text-xs text-slate-500 font-medium">End<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="ml-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs bg-white"/></label></>}
 {draft===null?<button disabled={busy||!data.data||layout.isPending||layout.isError} onClick={()=>setDraft([...kpis.map(k=>k.id),...charts.map(c=>c.id)])} className="border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl px-4 py-2 text-xs shadow-2xs transition disabled:opacity-50">Reorder</button>:<><button disabled={busy} onClick={()=>void save()} className="bg-[#4361ee] hover:bg-[#3a5bf0] text-white font-semibold rounded-xl px-4 py-2 text-xs shadow-md shadow-indigo-500/20 transition">Save</button><button disabled={busy} onClick={()=>void save(true)} className="border border-slate-200 bg-white text-slate-700 rounded-xl px-3 py-2 text-xs">Default</button><button disabled={busy} onClick={()=>setDraft(null)} className="border border-slate-200 bg-white text-slate-500 rounded-xl px-3 py-2 text-xs">Cancel</button></>}
 <button disabled={busy||data.isFetching||!data.data} onClick={()=>void pdf()} className="rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 text-xs shadow-2xs transition">Export PDF</button><button disabled={data.isFetching} onClick={()=>void cache.invalidateQueries({queryKey:key})} className="rounded-xl bg-[#eef2ff] hover:bg-indigo-100 text-[#4361ee] font-bold px-4 py-2 text-xs transition">Refresh</button></div></div>
 {error&&<p role="alert" className="text-rose-600 text-xs font-semibold">{error}</p>}{data.isFetching&&<p role="status" className="text-xs text-slate-400">Loading Dashboard...</p>}{data.isError&&<p role="alert" className="text-rose-600 text-xs">Dashboard could not be loaded. Use Refresh to retry.</p>}{layout.isError&&<p role="alert" className="text-rose-600 text-xs">Saved layout unavailable.</p>}
 {range==='custom'&&(!from||!to||from>to)&&<p role="alert" className="text-amber-600 text-xs font-medium">Select a valid date range.</p>}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">{kpis.map((k,i)=>{const presentation=kpiPresentation[k.title as keyof typeof kpiPresentation];if(!presentation)return null;const Icon=presentation.icon;const isHero=(presentation as any).highlight;return <div key={k.title} onDragOver={e=>{if(draft)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(draft&&dragged.current)move(dragged.current,k.id);dragged.current='';}} className={`relative rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 ${isHero ? 'bg-gradient-to-tr from-[#3a5bf0] to-[#4361ee] text-white shadow-lg shadow-indigo-500/25 -translate-y-1' : 'bg-white border border-slate-100/90 shadow-2xs hover:shadow-md hover:border-slate-200 text-slate-800'}`}>{draft&&<button draggable onDragStart={()=>{dragged.current=k.id;}} onDragEnd={()=>{dragged.current='';}} aria-label={'Move '+k.title} className="absolute right-3 top-2 cursor-grab text-xs opacity-60">Drag</button>}<div className="flex items-center justify-between mb-4"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isHero ? 'bg-white/20 text-white' : `${presentation.background} ${presentation.foreground}`}`}><Icon size={20} aria-hidden="true"/></span><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isHero ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>{(presentation as any).delta || '+10%'}</span></div><Link href={presentation.href} className="block"><p className={`text-xs font-semibold mb-1 truncate ${isHero ? 'text-indigo-100' : 'text-slate-400'}`}>{k.title}</p><p className={`text-2xl font-black tracking-tight ${isHero ? 'text-white' : 'text-slate-900'}`}>{k.value.toLocaleString()}</p></Link>{draft&&i>0&&<button onClick={()=>move(k.id,kpis[i-1].id)} className="sr-only focus:not-sr-only">Move up</button>}</div>;})}</div>
 <div className="grid grid-cols-12 gap-5 items-stretch">{charts.map((c,i)=><section key={c.id} onDragOver={e=>{if(draft)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(draft&&dragged.current)move(dragged.current,c.id);dragged.current='';}} className="col-span-12 md:col-span-6 xl:col-span-4 rounded-2xl border border-slate-100/90 bg-white shadow-2xs p-6 min-h-[480px] flex flex-col overflow-hidden hover:shadow-sm transition-all">
 {draft&&<div className="flex gap-2"><button draggable onDragStart={()=>{dragged.current=c.id;}} onDragEnd={()=>{dragged.current='';}} aria-label={'Move '+c.title}>Drag</button><button disabled={i===0} onClick={()=>move(c.id,charts[i-1].id)}>Move up</button></div>}{c.kind==='table'?<DashboardTable key={c.id+range+from+to} id={c.id} title={c.title} module={tableWidgets.find(t=>t.id===c.id)!.module} dateFrom={startDate} dateTo={endDate} register={registerTable}/>:<><h2 className="font-bold mb-4 text-slate-900 text-sm tracking-tight">{homeChartTitles[c.id]??c.title}</h2><DashboardChart chart={c} register={register}/></>}</section>)}</div>
 </PermissionGate></PageContainer>;
}
