'use client';
import { useEffect,useRef } from 'react';
import type { ECharts } from 'echarts';
export type ChartData={id:string;title:string;kind:string;status:string;data:{label:string;value:number}[]};
export function DashboardChart({chart,register}:{chart:ChartData;register:(id:string,instance:ECharts|null)=>void}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{const element=host.current;if(!element||chart.status!=='ready'||!chart.data.length)return;let disposed=false;let instance:ECharts|undefined;
 const observer=new ResizeObserver(()=>{if(instance)instance.resize();else void initialize();});
 async function initialize(){if(disposed||instance||!element||element.clientWidth===0||element.clientHeight===0)return;const echarts=await import('echarts');if(disposed||instance||!element.clientWidth||!element.clientHeight)return;instance=echarts.init(element);register(chart.id,instance);
 const circular=chart.kind==='pie'||chart.kind==='donut';
 instance.setOption({
  color: ['#4361ee', '#3a86ff', '#f72585', '#7209b7', '#4cc9f0', '#06d6a0'],
  tooltip: {
    trigger: circular || chart.kind === 'funnel' ? 'item' : 'axis',
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    textStyle: { color: '#ffffff', fontSize: 12 }
  },
  legend: { type: 'scroll', bottom: 0, textStyle: { color: '#64748b', fontSize: 11 } },
  grid: { left: 45, right: 20, top: 20, bottom: 70 },
  ...(circular || chart.kind === 'funnel'
    ? {}
    : {
        xAxis: {
          type: 'category',
          data: chart.data.map(d => d.label),
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          axisLabel: { color: '#94a3b8', fontSize: 11, interval: 0, rotate: 20 },
        },
        yAxis: {
          type: 'value',
          minInterval: 1,
          splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 },
        },
      }),
  series: [
    {
      name: chart.title,
      type: circular ? 'pie' : chart.kind === 'funnel' ? 'funnel' : 'bar',
      smooth: true,
      itemStyle: {
        borderRadius: circular ? 0 : [6, 6, 0, 0],
      },
      ...(circular ? { radius: chart.kind === 'donut' ? ['50%', '75%'] : '65%' } : {}),
      data: chart.data.map(d => ({ name: d.label, value: d.value })),
      label: { show: circular || chart.kind === 'funnel' },
    },
  ],
 });}
 observer.observe(element);void initialize();return()=>{disposed=true;observer.disconnect();register(chart.id,null);instance?.dispose();};
 },[chart,register]);
 const empty:Record<string,string>={'accounts.account_type':'No accounts found.','leads.lead_source':'No leads found.','leads.status':'No leads found.','campaigns.campaign_type':'No campaigns found.','opportunities.lead_source':'No opportunities found.'};
 return <div className="flex min-h-0 flex-1 flex-col">{chart.status!=='ready'?<p role="alert">This chart is unavailable.</p>:chart.data.length===0?<p className="py-6 text-center text-sm text-gray-500">{empty[chart.id]??'Nothing to show yet.'}</p>:<div ref={host} className="min-h-[390px] w-full flex-1" aria-label={chart.title}/>}</div>;
}
