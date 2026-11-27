'use client';
import {useCallback,useRef,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import type {ECharts} from 'echarts';
import {createClient} from '@/lib/supabase/client';
import {useAuth} from '@/components/providers/auth-provider';
import {PermissionGate} from '@/components/auth/permission-gate';
import {PageContainer} from '@/components/shell/page-container';
import {DashboardChart,type ChartData} from '@/components/dashboard/dashboard-chart';
import {DashboardTable,tableWidgets} from '@/components/dashboard/dashboard-table';
import type {Database} from '@finlonexa/database';

type Component=Database['public']['Tables']['saved_dashboard_components']['Row'];
type ComponentType=Component['component_type'];
const metricsContract=z.object({kpis:z.array(z.object({title:z.string(),value:z.number()})),charts:z.array(z.object({id:z.string(),title:z.string(),kind:z.string(),status:z.string(),data:z.array(z.object({label:z.string(),value:z.number()}))}))});
const choices=[
 {type:'chart',id:'accounts.account_type',title:'Accounts by Account Type',module:'accounts'},
 {type:'chart',id:'leads.lead_source',title:'Leads by Source',module:'leads'},
 {type:'chart',id:'leads.status',title:'Leads by Stage',module:'leads'},
 {type:'chart',id:'campaigns.campaign_type',title:'Campaigns by Type',module:'campaigns'},
 {type:'chart',id:'opportunities.lead_source',title:'Opportunities by Lead Source',module:'opportunities'},
 ...tableWidgets.map(item=>({type:'table_data',id:item.id,title:item.title,module:item.module})),
 ...['Accounts','Campaigns','Contacts','Leads','Opportunities'].map(module=>({type:'kpi',id:'Total '+module,title:'Total '+module,module:module.toLowerCase()})),
] as const;

export default function SavedDashboardDetailPage(){
 const {id}=useParams<{id:string}>();const {user,hasPermission,permissions,roleIds}=useAuth();const cache=useQueryClient();const client=createClient();
 const key=['crm',user?.id,[...roleIds,...permissions].sort().join('|'),'saved-dashboard',id];
 const dashboard=useQuery({queryKey:[...key,'record'],enabled:!!user&&!!id&&hasPermission('dashboard.view'),queryFn:async()=>{const r=await client.from('saved_dashboards').select('*').eq('id',id).eq('is_active',true).single();if(r.error)throw r.error;return r.data;}});
 const components=useQuery({queryKey:[...key,'components'],enabled:!!dashboard.data,queryFn:async()=>{const r=await client.from('saved_dashboard_components').select('*').eq('dashboard_id',id).order('sequence').order('created_at');if(r.error)throw r.error;return r.data;}});
 const metrics=useQuery({queryKey:[...key,'metrics'],enabled:!!dashboard.data,queryFn:async()=>{const r=await client.rpc('dashboard_home_metrics',{});if(r.error)throw r.error;return metricsContract.parse(r.data);}});
 const [selected,setSelected]=useState('');const [name,setName]=useState('');const [editing,setEditing]=useState<Component|null>(null);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
 const chartInstances=useRef(new Map<string,ECharts>());const tableLines=useRef(new Map<string,string[]>());
 const registerChart=useCallback((componentId:string,instance:ECharts|null)=>{if(instance)chartInstances.current.set(componentId,instance);else chartInstances.current.delete(componentId);},[]);
 const registerTable=useCallback((componentId:string,lines:string[]|null)=>{if(lines)tableLines.current.set(componentId,lines);else tableLines.current.delete(componentId);},[]);
 const available=choices.filter(item=>hasPermission(item.module+'.view'));
 const save=useMutation({mutationFn:async()=>{const choice=available.find(item=>item.id===selected);if(!choice)throw Error('Select an authorized component.');const trimmed=name.trim();if(!trimmed)throw Error('Component Name is required.');
  if(editing){const r=await client.from('saved_dashboard_components').update({name:trimmed,component_type:choice.type as ComponentType,source_id:choice.id}).eq('id',editing.id);if(r.error)throw r.error;}
  else{const r=await client.from('saved_dashboard_components').insert({dashboard_id:id,name:trimmed,component_type:choice.type as ComponentType,source_id:choice.id,sequence:(components.data?.length??0)+1});if(r.error)throw r.error;}
 },onSuccess:async()=>{setSelected('');setName('');setEditing(null);setNotice('Component saved.');await cache.invalidateQueries({queryKey:[...key,'components']});},onError:cause=>setError(cause.message)});
 const remove=useMutation({mutationFn:async(componentId:string)=>{const r=await client.from('saved_dashboard_components').delete().eq('id',componentId);if(r.error)throw r.error;},onSuccess:async()=>{setNotice('Component removed.');await cache.invalidateQueries({queryKey:[...key,'components']});},onError:cause=>setError(cause.message)});
 function edit(item:Component){setEditing(item);setSelected(item.source_id);setName(item.name);setError('');}
 async function exportPdf(){setBusy(true);setError('');try{const {dashboardPdf}=await import('@/components/dashboard/dashboard-pdf');const widgets:ChartData[]=(components.data??[]).filter(item=>item.component_type!=='kpi'&&available.some(choice=>choice.id===item.source_id)).map(item=>{
  if(item.component_type==='table_data')return {id:item.id,title:item.name,kind:'table',status:'ready',data:[]};
  const chart=metrics.data?.charts.find(candidate=>candidate.id===item.source_id);return chart?{...chart,id:item.id,title:item.name}:{id:item.id,title:item.name,kind:'bar',status:'unavailable',data:[]};
 });
 const kpis=(components.data??[]).filter(item=>item.component_type==='kpi').flatMap(item=>{const k=metrics.data?.kpis.find(candidate=>candidate.title===item.source_id);return k?[{title:item.name,value:k.value}]:[];});
 dashboardPdf(dashboard.data?.name??'Dashboard',kpis,widgets,chartInstances.current,tableLines.current).save('dashboard.pdf');
 }catch{setError('Dashboard PDF could not be generated.');}finally{setBusy(false);}}
 return <PageContainer maxWidth="full" className="bg-[#f7f9fc] min-h-full"><PermissionGate action="dashboard.view" showAccessDenied><div className="space-y-5">
  <div className="flex flex-wrap justify-between gap-3"><div><Link href="/dashboards" className="text-sm text-[#4361ee]">← Dashboards</Link><h1 className="text-2xl font-bold">{dashboard.data?.name??'Dashboard'}</h1><p className="text-sm text-slate-500">{dashboard.data?.description}</p></div><button onClick={()=>void exportPdf()} disabled={busy||metrics.isFetching||components.isFetching} className="rounded border bg-white px-3 py-2 text-sm">Export PDF</button></div>
  {error&&<p role="alert" className="text-red-700">{error}</p>}{notice&&<p role="status" className="text-green-700">{notice}</p>}
  {dashboard.isError?<p role="alert">Dashboard unavailable or access denied.</p>:dashboard.isPending?<p role="status">Loading Dashboard...</p>:null}
  {hasPermission('dashboard.update')&&dashboard.data&&<form onSubmit={event=>{event.preventDefault();setError('');void save.mutateAsync().catch(()=>{});}} className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-4 shadow-sm"><label className="text-sm">Component<select required value={selected} onChange={event=>{const choice=available.find(item=>item.id===event.target.value);setSelected(event.target.value);if(!editing)setName(choice?.title??'');}} className="mt-1 block rounded border p-2"><option value="">Select component</option>{available.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="text-sm">Component Name<input required maxLength={255} value={name} onChange={event=>setName(event.target.value)} className="mt-1 block rounded border p-2"/></label><button type="submit" disabled={save.isPending} className="rounded bg-[#4361ee] px-4 py-2 text-white">{editing?'Save Changes':'Add Component'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setSelected('');setName('');}} className="rounded border px-4 py-2">Cancel</button>}</form>}
  {components.isError||metrics.isError?<p role="alert">Dashboard content unavailable. Retry after checking access.</p>:components.isPending||metrics.isPending?<p role="status">Loading components...</p>:components.data?.length===0?<p className="rounded-xl bg-white p-6 text-sm text-slate-500">No components found. Add a chart, table, or KPI.</p>:<div className="grid grid-cols-12 gap-3">{components.data?.map(item=>{
   const choice=choices.find(candidate=>candidate.id===item.source_id);if(!choice||!hasPermission(choice.module+'.view'))return null;
   const chart=metrics.data?.charts.find(candidate=>candidate.id===item.source_id);const kpi=metrics.data?.kpis.find(candidate=>candidate.title===item.source_id);
   return <section key={item.id} className={`rounded-xl bg-white p-5 shadow-sm ${item.component_type==='kpi'?'col-span-12 sm:col-span-6 lg:col-span-3':'col-span-12 lg:col-span-4 min-h-[400px]'}`}><div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{item.name}</h2>{hasPermission('dashboard.update')&&<div className="flex gap-2 text-xs"><button onClick={()=>edit(item)}>Edit</button><button onClick={()=>{if(window.confirm('Remove this component?'))void remove.mutateAsync(item.id).catch(()=>{});}} className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100">Remove</button></div>}</div>
    {item.component_type==='kpi'?<p className="mt-3 text-2xl font-bold">{kpi?kpi.value.toLocaleString():'Unavailable'}</p>:item.component_type==='chart'?(chart?<DashboardChart chart={{...chart,id:item.id,title:item.name}} register={registerChart}/>:<p>Chart unavailable.</p>):<DashboardTable id={item.source_id} title={item.name} module={choice.module} dateFrom={null} dateTo={null} register={(_,lines)=>registerTable(item.id,lines)}/>}</section>;
  })}</div>}
 </div></PermissionGate></PageContainer>;
}
