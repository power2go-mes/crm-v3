'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { CampaignFilterState } from '@/types/campaigns';
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
  ['status', 'Status'],
  ['campaign_type', 'Campaign Type'],
  ['start_date', 'Start Date'],
  ['end_date', 'End Date'],
] as const;

const numericFields = [
  ['expected_revenue', 'Expected Revenue'],
  ['budget_cost', 'Budget Cost'],
  ['actual_cost', 'Actual Cost'],
  ['expected_response', 'Expected Response (%)'],
] as const;

const metrics = [
  ['sum', 'Sum'],
  ['avg', 'Average'],
  ['min', 'Minimum'],
  ['max', 'Maximum'],
] as const;

type Kind = (typeof kinds)[number];

export function CampaignChartView({
  filters,
  search,
}: {
  filters: CampaignFilterState;
  search: string;
}) {
  const { user, profile, hasPermission, isLoading } = useAuth();
  const [group, setGroup] = useState('status');
  const [value, setValue] = useState('count');
  const [kind, setKind] = useState<Kind>('column');
  const host = useRef<HTMLDivElement>(null);
  const [drawError, setDrawError] = useState('');

  const supabase = createClient();

  const { data: campaigns = [], isLoading: isDataLoading, isError, refetch } = useQuery<Record<string, unknown>[]>({
    queryKey: ['crm', user?.id, 'campaigns', 'chart-data', filters, search],
    enabled: !isLoading && !!user && !!profile?.is_active && hasPermission('campaigns.view'),
    queryFn: async () => {
      let query = (supabase as any).from('campaigns_readable').select('*');

      if (search) {
        query = query.ilike('campaign_name', `%${search}%`);
      }
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters.campaignType && filters.campaignType.length > 0) {
        query = query.in('campaign_type', filters.campaignType);
      }
      if (filters.startDateFrom) {
        query = query.gte('start_date', filters.startDateFrom);
      }
      if (filters.startDateTo) {
        query = query.lte('start_date', filters.startDateTo);
      }
      if (filters.endDateFrom) {
        query = query.gte('end_date', filters.endDateFrom);
      }
      if (filters.endDateTo) {
        query = query.lte('end_date', filters.endDateTo);
      }
      if (filters.minExpectedRevenue != null) {
        query = query.gte('expected_revenue', filters.minExpectedRevenue);
      }
      if (filters.maxExpectedRevenue != null) {
        query = query.lte('expected_revenue', filters.maxExpectedRevenue);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const points = useMemo(() => {
    if (!campaigns.length) return [];

    const map = new Map<string, number[]>();

    campaigns.forEach((c) => {
      let rawKey = String((c as Record<string, unknown>)[group] || 'Unassigned');
      if (group === 'status') {
        rawKey = rawKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      } else if (group === 'campaign_type') {
        rawKey = rawKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      }

      let numVal = 1;
      if (value !== 'count') {
        const parts = value.split('__');
        const field = parts[1];
        const val = Number((c as Record<string, unknown>)[field]);
        numVal = isNaN(val) ? 0 : val;
      }

      if (!map.has(rawKey)) {
        map.set(rawKey, []);
      }
      map.get(rawKey)!.push(numVal);
    });

    const result: { label: string; value: number }[] = [];
    map.forEach((vals, label) => {
      let finalVal = 0;
      if (value === 'count') {
        finalVal = vals.length;
      } else {
        const op = value.split('__')[0];
        if (op === 'sum') {
          finalVal = vals.reduce((a, b) => a + b, 0);
        } else if (op === 'avg') {
          finalVal = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0;
        } else if (op === 'min') {
          finalVal = Math.min(...vals);
        } else if (op === 'max') {
          finalVal = Math.max(...vals);
        }
      }
      result.push({ label, value: finalVal });
    });

    return result.sort((a, b) => b.value - a.value);
  }, [campaigns, group, value]);

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
                  name: group === 'status' ? 'Status' : group === 'campaign_type' ? 'Type' : 'Date',
                  data: points.map((d) => d.label),
                },
                yAxis: { type: 'value', minInterval: value === 'count' ? 1 : undefined },
              }
            : {}),
          series: [
            {
              type: kind === 'column' || kind === 'bar' ? 'bar' : kind === 'area' ? 'line' : kind === 'donut' ? 'pie' : kind,
              name: value === 'count' ? 'Record count' : value.replace('__', ' of '),
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
              <option value="count">Record count</option>
              {numericFields.flatMap(([field, label]) =>
                metrics.map(([metric, metricLabel]) => (
                  <option key={metric + '__' + field} value={metric + '__' + field}>
                    {metricLabel} of {label}
                  </option>
                ))
              )}
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
        {isDataLoading ? (
          <p role="status" className="text-slate-500">Loading chart...</p>
        ) : isError ? (
          <p role="alert" className="text-red-600">
            Campaign chart unavailable.{' '}
            <button onClick={() => void refetch()} className="underline text-[#4361ee]">
              Retry
            </button>
          </p>
        ) : points.length === 0 ? (
          <p className="text-center text-slate-500">No campaigns found.</p>
        ) : (
          <div ref={host} aria-label="Campaigns chart" className="h-[560px] w-full" />
        )}
        {drawError && <p role="alert" className="text-red-500 text-sm mt-2">{drawError}</p>}
      </div>
    </div>
  );
}
