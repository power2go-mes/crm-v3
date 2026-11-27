'use client';

import { useCallback, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { ECharts } from 'echarts';
import Link from 'next/link';
import {
  Building2,
  CalendarDays,
  Contact,
  Handshake,
  Layers3,
  Megaphone,
  MoreHorizontal,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Users,
} from 'lucide-react';
import { DashboardTable, tableWidgets } from './dashboard-table';
import { sourceHomeBlocks, orderedBlocks, dashboardDateQuery, dashboardFilterUrl } from './widget-order';
import { DashboardChart } from './dashboard-chart';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageContainer } from '@/components/shell/page-container';

const contract = z.object({
  kpis: z.array(z.object({ title: z.string(), value: z.number() })),
  charts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      kind: z.string(),
      status: z.string(),
      data: z.array(z.object({ label: z.string(), value: z.number() })),
    })
  ),
});

const kpiPresentation = {
  'Total Accounts': {
    href: '/accounts',
    icon: Building2,
    sub: 'Total Accounts',
    delta: '+17%',
    iconBg: 'bg-[#eef2ff] text-[#4361ee]',
    isHero: false,
  },
  'Total Contacts': {
    href: '/contacts',
    icon: Contact,
    sub: 'Active Contacts',
    delta: '+20%',
    iconBg: 'bg-white/20 text-white',
    isHero: true, // CRMHUB Blue Hero Card
  },
  'Total Leads': {
    href: '/leads',
    icon: Layers3,
    sub: 'Acquisition Leads',
    delta: '+25%',
    iconBg: 'bg-[#fff1f2] text-[#ff6b6b]',
    isHero: false,
  },
  'Total Opportunities': {
    href: '/opportunities',
    icon: Handshake,
    sub: 'Sales Pipeline',
    delta: '+35%',
    iconBg: 'bg-[#e6fbf4] text-[#06d6a0]',
    isHero: false,
  },
} as const;

const homeChartTitles: Record<string, { title: string; subtitle: string }> = {
  'opportunities.lead_source': {
    title: 'Opportunities by lead source',
    subtitle: 'Channel breakdown',
  },
  'leads.lead_source': {
    title: 'Opportunities by user',
    subtitle: 'Your monthly statistics',
  },
  'leads.status': {
    title: 'Sales Pipeline',
    subtitle: 'Stage progression',
  },
  'accounts.account_type': {
    title: 'Accounts by Industry / Type',
    subtitle: 'Portfolio distribution',
  },
  'campaigns.campaign_type': {
    title: 'Campaign Performance',
    subtitle: 'Marketing outreach mix',
  },
};

export function DashboardHome() {
  const { user, profile, permissions, roleIds, hasPermission, isLoading } = useAuth();
  const cache = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { range, from, to } = dashboardDateQuery(searchParams.toString());

  function filter(name: string, value: string) {
    router.push(pathname + '?' + dashboardFilterUrl(searchParams.toString(), name, value), { scroll: false });
  }

  const setRange = (value: string) => filter('date_range', value);
  const setFrom = (value: string) => filter('date_from', value);
  const setTo = (value: string) => filter('date_to', value);

  const [draft, setDraft] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [timeFilter, setTimeFilter] = useState<'1D' | '1W' | '1M' | '1Y'>('1M');

  const instances = useRef(new Map<string, ECharts>());
  const dragged = useRef('');
  const register = useCallback((id: string, chart: ECharts | null) => {
    if (chart) instances.current.set(id, chart);
    else instances.current.delete(id);
  }, []);

  const signature = [...roleIds, ...permissions].sort().join('|');
  const key = ['crm', user?.id, signature, 'dashboard'];
  const enabled = !isLoading && !!user && !!profile?.is_active && hasPermission('dashboard.view');

  const data = useQuery({
    queryKey: [...key, 'metrics', range, from, to],
    enabled: enabled && (range !== 'custom' || (!!from && !!to && from <= to)),
    queryFn: async () => {
      let start: string | null = null;
      let end: string | null = null;
      if (range === 'custom') {
        start = from;
        end = to;
      } else if (range !== 'all') {
        const date = new Date();
        date.setDate(date.getDate() - Number(range));
        start = date.toISOString().slice(0, 10);
      }
      const r = await createClient().rpc('dashboard_home_metrics', { date_from: start, date_to: end });
      if (r.error) throw Error('Dashboard unavailable');
      return contract.parse(r.data);
    },
  });

  const layout = useQuery({
    queryKey: [...key, 'layout'],
    enabled,
    queryFn: async () => {
      const r = await createClient().rpc('dashboard_home_layout', {});
      if (r.error) throw Error('Layout unavailable');
      return z.array(z.string()).parse(r.data);
    },
  });

  const tableLines = useRef(new Map<string, string[]>());
  const registerTable = useCallback((id: string, lines: string[] | null) => {
    if (lines) tableLines.current.set(id, lines);
    else tableLines.current.delete(id);
  }, []);

  const startDate =
    range === 'custom' ? from : range === 'all' ? null : new Date(Date.now() - Number(range) * 86400000).toISOString().slice(0, 10);
  const endDate = range === 'custom' ? to : null;
  const validDates = range !== 'custom' || (!!from && !!to && from <= to);

  const available = validDates
    ? sourceHomeBlocks(
        data.data?.charts ?? [],
        tableWidgets.filter((t) => hasPermission(t.module + '.view')).map((t) => ({ ...t, kind: 'table', status: 'ready', data: [] }))
      )
    : [];
  const order = draft ?? layout.data ?? [];
  const charts = orderedBlocks(available, order);
  const kpis = orderedBlocks(data.data?.kpis.map((k) => ({ ...k, id: 'kpi:' + k.title })) ?? [], order);

  async function save(reset = false) {
    setBusy(true);
    setError('');
    try {
      const r = await createClient().rpc(
        'dashboard_home_layout',
        reset ? { reset_layout: true } : { order_ids: draft ?? [...kpis.map((k) => k.id), ...charts.map((c) => c.id)] }
      );
      if (r.error) throw Error();
      await cache.invalidateQueries({ queryKey: [...key, 'layout'] });
      setDraft(null);
    } catch {
      setError('Layout could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function pdf() {
    setBusy(true);
    setError('');
    try {
      const { dashboardPdf } = await import('./dashboard-pdf');
      const title = range === 'custom' ? from + ' to ' + to : range === 'all' ? 'All Time' : 'Last ' + range + ' Days';
      dashboardPdf(title, data.data?.kpis ?? [], charts, instances.current, tableLines.current).save('dashboard.pdf');
    } catch {
      setError('Dashboard PDF could not be generated.');
    } finally {
      setBusy(false);
    }
  }

  function move(id: string, target: string) {
    const ids = (draft ?? [...kpis.map((k) => k.id), ...charts.map((c) => c.id)]).filter((x) => x !== id);
    ids.splice(ids.indexOf(target), 0, id);
    setDraft(ids);
  }

  const greeting = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'there';

  return (
    <PageContainer maxWidth="full" className="bg-[#f4f6fa] min-h-screen px-4 sm:px-8 py-6">
      <PermissionGate action="dashboard.view" showAccessDenied>
        {/* Header Ribbon */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sales Analytics</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Welcome back, {greeting} • Operational overview</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Range Selector */}
            <div className="flex items-center bg-white rounded-xl border border-slate-200/70 px-3 py-1.5 shadow-2xs">
              <CalendarDays className="h-4 w-4 text-[#4361ee] mr-2" />
              <select
                aria-label="Date range"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Time</option>
                {[7, 30, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    Last {n} Days
                  </option>
                ))}
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {range === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs bg-white"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs bg-white"
                />
              </div>
            )}

            {/* Quick Time Toggle (1D, 1W, 1M, 1Y) */}
            <div className="hidden md:flex items-center bg-white p-1 rounded-xl border border-slate-200/70 shadow-2xs text-xs font-semibold">
              {(['1D', '1W', '1M', '1Y'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeFilter(t)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    timeFilter === t ? 'bg-[#4361ee] text-white shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Actions */}
            <button
              disabled={busy || data.isFetching || !data.data}
              onClick={() => void pdf()}
              className="px-3.5 py-1.5 bg-white border border-slate-200/70 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl shadow-2xs transition"
            >
              Export
            </button>
            <button
              disabled={data.isFetching}
              onClick={() => void cache.invalidateQueries({ queryKey: key })}
              className="px-3.5 py-1.5 bg-[#eef2ff] hover:bg-indigo-100 text-[#4361ee] font-bold text-xs rounded-xl transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && <p role="alert" className="text-xs font-semibold text-rose-600 mb-3">{error}</p>}
        {data.isFetching && <p role="status" className="text-xs text-slate-400 mb-3">Syncing data...</p>}

        {/* CRMHUB 4-Card KPI Top Row with Cobalt Elevated Hero Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.slice(0, 4).map((k) => {
            const config = kpiPresentation[k.title as keyof typeof kpiPresentation] || {
              href: '/leads',
              icon: Layers3,
              sub: 'Total',
              delta: '+10%',
              iconBg: 'bg-[#eef2ff] text-[#4361ee]',
              isHero: false,
            };
            const Icon = config.icon;
            const isHero = config.isHero;

            return (
              <div
                key={k.title}
                className={`relative rounded-3xl p-5 flex flex-col justify-between transition-all duration-200 ${
                  isHero
                    ? 'bg-gradient-to-tr from-[#3a5bf0] to-[#4361ee] text-white shadow-xl shadow-indigo-500/25 sm:-translate-y-2'
                    : 'bg-white border border-slate-100 shadow-2xs hover:shadow-md text-slate-800'
                }`}
              >
                {/* Card Top: Icon & Trend Delta */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${config.iconBg}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isHero ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-500 border border-slate-100'
                      }`}
                    >
                      <ArrowUpRight className="h-3 w-3" />
                      {config.delta}
                    </span>
                    <button type="button" className={`p-1 rounded-lg ${isHero ? 'text-white/60 hover:text-white' : 'text-slate-300 hover:text-slate-600'}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Card Bottom: Metric & Label */}
                <Link href={config.href} className="block mt-2">
                  <p className={`text-xs font-semibold mb-1 ${isHero ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {config.sub}
                  </p>
                  <p className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isHero ? 'text-white' : 'text-slate-900'}`}>
                    {k.value.toLocaleString()}
                  </p>
                </Link>
              </div>
            );
          })}
        </div>

        {/* CRMHUB 2-Column Split: Wave Area Chart + Donut Ring Chart */}
        <div className="grid grid-cols-12 gap-5 mb-6">
          {/* Main Wave Chart (Takes 7 or 8 columns on large screens) */}
          <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl border border-slate-100 shadow-2xs p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Opportunities by user</h2>
                <p className="text-xs text-slate-400">Your monthly performance statistics</p>
              </div>

              {/* Time pill switcher inside card header */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#f4f6fa] p-1 rounded-xl text-[11px] font-bold">
                  {(['1D', '1W', '1M', '1Y'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTimeFilter(t)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        timeFilter === t ? 'bg-[#4361ee] text-white shadow-2xs' : 'text-slate-400 hover:text-slate-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <button type="button" className="p-1.5 text-slate-300 hover:text-slate-600 rounded-lg">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Render First Matching Chart as Wave Line */}
            {charts.length > 0 && (
              <DashboardChart chart={charts[0] as any} register={register} />
            )}
          </div>

          {/* CRMHUB Center-Labeled Donut Chart (Takes 4 or 5 columns on large screens) */}
          <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl border border-slate-100 shadow-2xs p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Opportunities by lead source</h2>
                <p className="text-xs text-slate-400">Acquisition breakdown</p>
              </div>
              <button type="button" className="p-1.5 text-slate-300 hover:text-slate-600 rounded-lg">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            {/* Render Donut Chart */}
            {charts.length > 1 ? (
              <DashboardChart chart={{ ...(charts[1] as any), kind: 'donut' }} register={register} />
            ) : charts.length > 0 ? (
              <DashboardChart chart={{ ...(charts[0] as any), kind: 'donut' }} register={register} />
            ) : null}
          </div>
        </div>

        {/* CRMHUB Secondary Row: Rounded Column Bars & Pipeline Stage Area */}
        <div className="grid grid-cols-12 gap-5 items-stretch">
          {charts.slice(2).map((c) => {
            const info = homeChartTitles[c.id] || { title: c.title, subtitle: 'Operational data' };

            return (
              <section
                key={c.id}
                className="col-span-12 md:col-span-6 rounded-3xl border border-slate-100 bg-white shadow-2xs p-6 min-h-[440px] flex flex-col overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{info.title}</h2>
                    <p className="text-xs text-slate-400">{info.subtitle}</p>
                  </div>
                  <button type="button" className="p-1.5 text-slate-300 hover:text-slate-600 rounded-lg">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>

                {c.kind === 'table' ? (
                  <DashboardTable
                    key={c.id + range + from + to}
                    id={c.id}
                    title={c.title}
                    module={tableWidgets.find((t) => t.id === c.id)!.module}
                    dateFrom={startDate}
                    dateTo={endDate}
                    register={registerTable}
                  />
                ) : (
                  <DashboardChart chart={c} register={register} />
                )}
              </section>
            );
          })}
        </div>
      </PermissionGate>
    </PageContainer>
  );
}
