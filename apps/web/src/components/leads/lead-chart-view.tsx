'use client';
import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/client';
import {useAuth} from '@/components/providers/auth-provider';
import {leadQueryKey} from '@/lib/leads/query-contract';
import {INDUSTRY_CHOICES, LEAD_SOURCES} from '@/types/leads';
import type {LeadFilterState} from '@/types/leads';
import type {ECharts} from 'echarts';
import {secondaryChartOptions, secondaryChartTypes} from './lead-chart-secondary';

const result=z.array(z.object({label:z.string(),secondary:z.string().optional(),value:z.number()}));
const kinds=['column','line','pie','funnel','bar','donut','stacked_vertical','stacked_horizontal','scatter','treemap','area','heatmap','sankey','radar'] as const;
const kindLabels:Record<string,string>={column:'Column Chart',line:'Line Chart',pie:'Pie Chart',funnel:'Funnel',bar:'Bar Chart',donut:'Donut',area:'Area Chart',scatter:'Scatter',treemap:'Treemap',stacked_vertical:'Stacked Vertical',stacked_horizontal:'Stacked Horizontal',heatmap:'Heatmap',sankey:'Sankey',radar:'Radar Chart'};
const numericFields=[['no_of_employees','Total Employees'],['annual_revenue','Annual Revenue'],['lead_score','Lead Score']] as const;
const metrics=[['sum','Sum'],['avg','Average'],['min','Minimum'],['max','Maximum']] as const;
const dimensions=[['is_active','Is Active'],['company','Company'],['created_at','Created At'],['created_by_id','Created By'],['updated_at','Updated At'],['updated_by_id','Updated By'],['sub_owner_id','Assigned BDO'],['lead_source','Lead Source'],['status','Lead Stage'],['industry','Industry']] as const;
type Kind=typeof kinds[number];
export type LeadChartSelection = {group:string;value:string;kind:Kind;stackBy?:string};
function labelFor(group:string, value:string) {
 const choices=group==='lead_source'?LEAD_SOURCES:group==='industry'?INDUSTRY_CHOICES:[];
 return choices.find(choice=>choice.value===value)?.label??value;
}
export function LeadChartView({filters,search,viewType,selection,onSelectionChange}:{filters:LeadFilterState;search:string;viewType:string;selection:LeadChartSelection;onSelectionChange:(value:LeadChartSelection)=>void}){
 const {user,profile,hasPermission,isLoading,permissions,roleIds}=useAuth();
 const {group,value,kind}=selection;
 const secondaryKind=secondaryChartTypes.find(type=>type===kind);
 const secondaryChoices=dimensions.filter(([key])=>key!==group);
 const stackBy=secondaryKind ? (secondaryChoices.some(([key])=>key===selection.stackBy)
  ? selection.stackBy : kind==='radar' ? undefined : secondaryChoices[0]?.[0]) : undefined;
 const setGroup=(group:string)=>onSelectionChange({...selection,group});
 const setValue=(value:string)=>onSelectionChange({...selection,value});
 const setKind=(kind:Kind)=>onSelectionChange({...selection,kind});
 const host=useRef<HTMLDivElement>(null);const [drawError,setDrawError]=useState('');
 const selectedFilters={...filters,search,...(stackBy?{stackBy}:{})};
 const chart=useQuery({queryKey:leadQueryKey(user?.id,'chart',group,value,selectedFilters,viewType,[...roleIds,...permissions].sort()),enabled:!isLoading&&!!user&&!!profile?.is_active&&hasPermission('leads.view'),queryFn:async()=>{
  const client=createClient();
  let recentIds: string[] | undefined;
  if(viewType==='recently_viewed'){
   const recent=await client.rpc('crm_shared_personalization',{m:'leads'});
   if(recent.error)throw recent.error;
   recentIds=z.object({recent:z.array(z.object({record_id:z.string().uuid()}))}).parse(recent.data).recent.map(record=>record.record_id);
   if(!recentIds.length)return [];
  }
  const response=await client.rpc('leads_chart_aggregate',{p_group:group,p_value:value,p_filters:{...selectedFilters,...(recentIds?{recordIds:recentIds}:{})},p_converted:viewType==='converted'});
  if(response.error)throw Error('Lead chart data could not be loaded.');return result.parse(response.data);
 }});
 useEffect(()=>{const element=host.current as HTMLDivElement;const points=chart.data??[];if(!element||!points.length)return;let disposed=false;let instance:ECharts|undefined;const observer=new ResizeObserver(()=>{if(instance)instance.resize();else void initialize();});
  async function initialize(){
   if(disposed||instance||!element.clientWidth||!element.clientHeight)return;
   try{
    const echarts=await import('echarts');
    if(disposed||instance)return;
    instance=echarts.init(element);
    if(secondaryKind){
     instance.setOption({color:['#a5b4fc','#818cf8','#c4b5fd','#93c5fd'],
      grid:{left:48,right:32,top:36,bottom:85,containLabel:true},
      ...secondaryChartOptions(secondaryKind,points.map(point=>({...point,label:labelFor(group,point.label),
       secondary:stackBy&&point.secondary!==undefined?labelFor(stackBy,point.secondary):undefined}))),
     });
     setDrawError('');
     return;
    }
    const labels=points.map(point=>labelFor(group,point.label));
    const namedPoints=points.map((point,index)=>({name:labels[index],value:point.value}));
    const groupLabel=dimensions.find(([key])=>key===group)?.[1];
    const metricLabel=value==='count'?'Record count':numericFields.find(([key])=>key===value.split('__')[1])?.[1];
    const hasAxes=!['pie','donut','funnel','treemap'].includes(kind);
    const categoryAxis={type:'category',data:labels,axisTick:{alignWithLabel:true}};
    const valueAxis={type:'value',splitLine:{lineStyle:{type:'dashed',color:'#e2e8f0'}}};
    const categorySeries=kind==='column'||kind==='bar'||kind==='scatter';
    instance.setOption({
     color:['#a5b4fc','#818cf8','#c4b5fd','#93c5fd'],
     tooltip:{trigger:hasAxes&&kind!=='scatter'?'axis':'item',renderMode:'richText'},
     legend:{bottom:0,type:'scroll',...(kind==='treemap'?{show:false}:{})},
     grid:{left:48,right:28,top:44,bottom:85,containLabel:true},
     ...(hasAxes?(kind==='bar'?{xAxis:valueAxis,yAxis:categoryAxis}:{xAxis:{...categoryAxis,name:groupLabel,nameLocation:'middle',nameGap:34},yAxis:valueAxis}):{}),
     series:categorySeries?points.map((point,index)=>({
      type:kind==='scatter'?'scatter':'bar',name:labels[index],stack:'groups',
      data:labels.map((_,position)=>position===index?point.value:null),
      itemStyle:{borderRadius:kind==='column'?[4,4,0,0]:0},
     })):[{
      type:kind==='area'?'line':kind==='donut'?'pie':kind,
      name:metricLabel,areaStyle:kind==='area'?{}:undefined,
      radius:kind==='donut'?['45%','70%']:kind==='pie'?'65%':undefined,
      data:hasAxes?points.map(point=>point.value):namedPoints,
      label:{show:!hasAxes},
     }],
    });
    setDrawError('');
   }catch{if(!disposed)setDrawError('Chart could not be drawn.');}
  }
  observer.observe(element);void initialize();return()=>{disposed=true;observer.disconnect();instance?.dispose();};
 },[chart.data,kind,group,value,secondaryKind,stackBy]);
 return <div className="space-y-4 bg-[#f7f9fc] min-h-[690px] p-4">
  <div className="flex flex-wrap items-end justify-between gap-4"><h2 className="self-center text-base font-medium text-slate-900">Chart view</h2><div className="flex flex-wrap gap-4 text-sm text-slate-500">
   <label className="grid gap-1">X-axis (Group by)<select aria-label="X-axis (Group by)" value={group} onChange={e=>setGroup(e.target.value)} className="min-w-48 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-slate-900 xl:w-[17rem]">{dimensions.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label className="grid gap-1">Y-axis (Value)<select aria-label="Y-axis (Value)" value={value} onChange={e=>setValue(e.target.value)} className="min-w-48 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-slate-900 xl:w-[17rem]"><option value="count">Record count</option>{numericFields.flatMap(([field,label])=>metrics.map(([metric,metricLabel])=><option key={metric+'__'+field} value={metric+'__'+field}>{metricLabel} of {label}</option>))}</select></label>
   <label className="grid gap-1">Chart type<select aria-label="Chart type" value={kind} onChange={e=>setKind(e.target.value as Kind)} className="min-w-48 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-slate-900 xl:w-[17rem]">{kinds.map(k=><option key={k} value={k}>{kindLabels[k]}</option>)}</select></label>
   {secondaryKind && <label className="grid gap-1">Secondary grouping<select value={stackBy??''} onChange={e=>onSelectionChange({...selection,stackBy:e.target.value})} className="min-w-48 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-slate-900 xl:w-[17rem]">{kind==='radar'&&<option value="">Single dimension</option>}{secondaryChoices.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
  </div></div>
  <div className="mt-5 min-h-[430px] rounded-xl bg-white p-4 shadow-sm md:min-h-[620px] md:p-7">{chart.isPending?<p role="status">Loading chart...</p>:chart.isError?<p role="alert">Lead chart unavailable. <button onClick={()=>void chart.refetch()} className="underline">Retry</button></p>:chart.data?.length===0?<p className="text-center text-slate-500">No leads found.</p>:<div ref={host} aria-label="Leads chart" className="h-[390px] w-full md:h-[560px]"/>}{drawError&&<p role="alert">{drawError}</p>}</div>
 </div>;
}
