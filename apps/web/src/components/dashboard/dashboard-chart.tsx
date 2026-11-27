'use client';
import { useEffect, useRef } from 'react';
import type { ECharts } from 'echarts';

export type ChartData = {
  id: string;
  title: string;
  kind: string;
  status: string;
  data: { label: string; value: number }[];
};

export function DashboardChart({
  chart,
  register,
}: {
  chart: ChartData;
  register: (id: string, instance: ECharts | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element || chart.status !== 'ready' || !chart.data.length) return;
    let disposed = false;
    let instance: ECharts | undefined;

    const observer = new ResizeObserver(() => {
      if (instance) instance.resize();
      else void initialize();
    });

    async function initialize() {
      if (disposed || instance || !element || element.clientWidth === 0 || element.clientHeight === 0) return;
      const echarts = await import('echarts');
      if (disposed || instance || !element.clientWidth || !element.clientHeight) return;
      instance = echarts.init(element);
      register(chart.id, instance);

      const isOpportunitiesByUser = chart.id.includes('opportunities') || chart.id.includes('user') || chart.kind === 'area';
      const isDonut = chart.kind === 'pie' || chart.kind === 'donut' || chart.id.includes('source');
      const isBar = chart.kind === 'bar' || (!isDonut && !isOpportunitiesByUser);

      // Color scheme exactly matching CRMHUB
      const crmhubPalette = ['#4361ee', '#ff6b6b', '#fca311', '#06d6a0', '#3a86ff', '#8338ec'];

      if (isDonut) {
        const total = chart.data.reduce((sum, d) => sum + d.value, 0);
        instance.setOption({
          color: crmhubPalette,
          tooltip: {
            trigger: 'item',
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            textStyle: { color: '#ffffff', fontSize: 12 },
            formatter: '{b}: {c} ({d}%)',
          },
          legend: {
            bottom: '2%',
            left: 'center',
            icon: 'circle',
            itemWidth: 8,
            itemHeight: 8,
            textStyle: { color: '#64748b', fontSize: 11, fontWeight: 500 },
          },
          series: [
            {
              name: chart.title,
              type: 'pie',
              radius: ['55%', '78%'],
              center: ['50%', '45%'],
              avoidLabelOverlap: false,
              itemStyle: {
                borderRadius: 8,
                borderColor: '#ffffff',
                borderWidth: 3,
              },
              label: {
                show: true,
                position: 'center',
                formatter: () => `{val|${total.toLocaleString()}}\n{sub|Total 100%}`,
                rich: {
                  val: {
                    fontSize: 20,
                    fontWeight: 800,
                    color: '#1e293b',
                    lineHeight: 26,
                  },
                  sub: {
                    fontSize: 11,
                    color: '#94a3b8',
                    fontWeight: 500,
                  },
                },
              },
              labelLine: { show: false },
              data: chart.data.map((d) => ({ name: d.label, value: d.value })),
            },
          ],
        });
      } else if (isOpportunitiesByUser || chart.id.includes('status')) {
        // CRMHUB Smooth Wave Area Chart with subtle glow gradient
        instance.setOption({
          color: ['#4361ee'],
          tooltip: {
            trigger: 'axis',
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            textStyle: { color: '#ffffff', fontSize: 12 },
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '8%',
            top: '12%',
            containLabel: true,
          },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: chart.data.map((d) => d.label),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#94a3b8', fontSize: 11 },
          },
          yAxis: {
            type: 'value',
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: {
              lineStyle: { color: '#f1f5f9', type: 'dashed' },
            },
            axisLabel: { color: '#94a3b8', fontSize: 11 },
          },
          series: [
            {
              name: chart.title,
              type: 'line',
              smooth: 0.45,
              symbol: 'circle',
              symbolSize: 6,
              showSymbol: false,
              lineStyle: {
                width: 3.5,
                color: '#4361ee',
                shadowColor: 'rgba(67, 97, 238, 0.3)',
                shadowBlur: 10,
              },
              areaStyle: {
                color: new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(67, 97, 238, 0.35)' },
                  { offset: 0.8, color: 'rgba(67, 97, 238, 0.02)' },
                  { offset: 1, color: 'rgba(255, 255, 255, 0)' },
                ]),
              },
              data: chart.data.map((d) => d.value),
            },
          ],
        });
      } else {
        // CRMHUB Rounded Pillar Columns
        instance.setOption({
          color: ['#4361ee'],
          tooltip: {
            trigger: 'axis',
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            textStyle: { color: '#ffffff', fontSize: 12 },
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '8%',
            top: '12%',
            containLabel: true,
          },
          xAxis: {
            type: 'category',
            data: chart.data.map((d) => d.label),
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisTick: { show: false },
            axisLabel: { color: '#94a3b8', fontSize: 11, interval: 0, rotate: chart.data.length > 5 ? 20 : 0 },
          },
          yAxis: {
            type: 'value',
            splitLine: {
              lineStyle: { color: '#f1f5f9', type: 'dashed' },
            },
            axisLabel: { color: '#94a3b8', fontSize: 11 },
          },
          series: [
            {
              name: chart.title,
              type: 'bar',
              barWidth: '32%',
              itemStyle: {
                borderRadius: [8, 8, 4, 4],
                color: new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#4361ee' },
                  { offset: 1, color: '#3a86ff' },
                ]),
              },
              data: chart.data.map((d) => d.value),
            },
          ],
        });
      }
    }

    observer.observe(element);
    void initialize();
    return () => {
      disposed = true;
      observer.disconnect();
      register(chart.id, null);
      instance?.dispose();
    };
  }, [chart, register]);

  const empty: Record<string, string> = {
    'accounts.account_type': 'No accounts found.',
    'leads.lead_source': 'No leads found.',
    'leads.status': 'No leads found.',
    'campaigns.campaign_type': 'No campaigns found.',
    'opportunities.lead_source': 'No opportunities found.',
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {chart.status !== 'ready' ? (
        <p role="alert" className="text-xs text-rose-500 py-6 text-center">This chart is unavailable.</p>
      ) : chart.data.length === 0 ? (
        <p className="py-12 text-center text-xs text-slate-400 font-medium">{empty[chart.id] ?? 'Nothing to show yet.'}</p>
      ) : (
        <div ref={host} className="min-h-[340px] w-full flex-1" aria-label={chart.title} />
      )}
    </div>
  );
}
