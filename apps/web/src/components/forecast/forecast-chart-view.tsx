'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type { OpportunityWithRelations } from '@/types/opportunities';
import { normalizeOpportunityStage, STAGE_CONFIG_MAP } from '@/lib/forecast/forecast-utils';
import type { ECharts } from 'echarts';

const kinds = ['column', 'line', 'pie', 'funnel', 'bar', 'donut', 'area'] as const;
const kindLabels: Record<string, string> = {
  column: 'Column Chart',
  line: 'Line Chart',
  pie: 'Pie Chart',
  funnel: 'Funnel',
  bar: 'Bar Chart',
  donut: 'Donut',
  area: 'Area Chart',
};

const dimensions = [
  ['stage', 'Pipeline Stage'],
  ['owner', 'Sales Rep'],
  ['close_date', 'Close Date'],
] as const;

const valueOptions = [
  ['weighted', 'Weighted Forecast ($)'],
  ['amount', 'Unweighted Deal Amount ($)'],
  ['count', 'Deal Count'],
] as const;

type Kind = (typeof kinds)[number];

export function ForecastChartView({
  opportunities,
  isLoading = false,
}: {
  opportunities: OpportunityWithRelations[];
  isLoading?: boolean;
}) {
  const [group, setGroup] = useState('stage');
  const [value, setValue] = useState('weighted');
  const [kind, setKind] = useState<Kind>('column');
  const host = useRef<HTMLDivElement>(null);
  const [drawError, setDrawError] = useState('');

  const points = useMemo(() => {
    if (!opportunities.length) return [];

    const map = new Map<string, number>();

    opportunities.forEach((opp) => {
      let rawKey = 'Unassigned';
      if (group === 'stage') {
        const canonical = normalizeOpportunityStage(opp.stage);
        rawKey = canonical !== 'unassigned' ? STAGE_CONFIG_MAP[canonical].label : opp.stage || 'Unassigned';
      } else if (group === 'owner') {
        rawKey = opp.owner ? `${opp.owner.first_name} ${opp.owner.last_name}` : 'Unassigned';
      } else if (group === 'close_date') {
        rawKey = opp.close_date ? opp.close_date.slice(0, 7) : 'No Date';
      }

      const amount = Number(opp.amount || 0);
      const canonical = normalizeOpportunityStage(opp.stage);
      const defaultProb = canonical !== 'unassigned' ? STAGE_CONFIG_MAP[canonical].defaultProbability : 0;
      const prob = opp.probability != null && !isNaN(Number(opp.probability)) ? Number(opp.probability) : defaultProb;
      const weighted = canonical === 'closed_won' ? amount : canonical === 'closed_lost' ? 0 : (amount * prob) / 100;

      let numVal = 1;
      if (value === 'weighted') {
        numVal = Math.round(weighted);
      } else if (value === 'amount') {
        numVal = amount;
      }

      map.set(rawKey, (map.get(rawKey) || 0) + numVal);
    });

    const result: { label: string; value: number }[] = [];
    map.forEach((val, label) => {
      result.push({ label, value: val });
    });

    return result.sort((a, b) => b.value - a.value);
  }, [opportunities, group, value]);

  useEffect(() => {
    const element = host.current as HTMLDivElement;
    if (!element || !points.length) return;
    let disposed = false;
    let instance: ECharts | undefined;

    const observer = new ResizeObserver(() => {
      if (instance) instance.resize();
      else void initialize();
    });

    async function initialize() {
      if (disposed || instance || !element.clientWidth || !element.clientHeight) return;
      try {
        const echarts = await import('echarts');
        if (disposed || instance) return;
        instance = echarts.init(element);
        const circular = kind === 'pie' || kind === 'donut' || kind === 'funnel';
        instance.setOption({
          color: ['#a5b4fc', '#818cf8', '#c4b5fd', '#93c5fd'],
          tooltip: { trigger: circular ? 'item' : 'axis' },
          legend: { bottom: 0, type: 'scroll' },
          grid: { left: 70, right: 28, top: 35, bottom: 95, containLabel: true },
          ...(!circular
            ? kind === 'bar'
              ? {
                  xAxis: { type: 'value' },
                  yAxis: { type: 'category', data: points.map((d) => d.label) },
                }
              : {
                  xAxis: {
                    type: 'category',
                    name: group === 'stage' ? 'Stage' : group === 'owner' ? 'Sales Rep' : 'Close Month',
                    data: points.map((d) => d.label),
                  },
                  yAxis: { type: 'value', minInterval: value === 'count' ? 1 : undefined },
                }
            : {}),
          series: [
            {
              type: kind === 'column' || kind === 'bar' ? 'bar' : kind === 'area' ? 'line' : kind === 'donut' ? 'pie' : kind,
              name: value === 'count' ? 'Deal Count' : value === 'weighted' ? 'Weighted Forecast' : 'Deal Amount',
              smooth: kind === 'line' || kind === 'area',
              areaStyle: kind === 'area' ? {} : undefined,
              radius: kind === 'donut' ? ['45%', '70%'] : kind === 'pie' ? '65%' : undefined,
              data: circular ? points.map((d) => ({ name: d.label, value: d.value })) : points.map((d) => d.value),
              label: { show: circular },
            },
          ],
        });
        setDrawError('');
      } catch {
        setDrawError('Chart could not be drawn.');
      }
    }

    observer.observe(element);
    void initialize();
    return () => {
      disposed = true;
      observer.disconnect();
      instance?.dispose();
    };
  }, [points, kind, group, value]);

  return (
    <div className="space-y-4 bg-[#f7f9fc] min-h-[690px] p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="self-center text-base font-medium text-slate-900">Chart view</h2>
        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
          <label className="grid gap-1">
            X-axis (Group by)
            <select
              aria-label="X-axis (Group by)"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="min-w-48 rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900"
            >
              {dimensions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Y-axis (Value)
            <select
              aria-label="Y-axis (Value)"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="min-w-48 rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900"
            >
              {valueOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Chart type
            <select
              aria-label="Chart type"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="min-w-48 rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900"
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {kindLabels[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="min-h-[620px] rounded-xl bg-white p-7 shadow-sm">
        {isLoading ? (
          <p role="status" className="text-slate-500">Loading forecast chart...</p>
        ) : points.length === 0 ? (
          <p className="text-center text-slate-500">No forecast deals found.</p>
        ) : (
          <div ref={host} aria-label="Forecast chart" className="h-[560px] w-full" />
        )}
        {drawError && <p role="alert" className="text-red-500 text-sm mt-2">{drawError}</p>}
      </div>
    </div>
  );
}
