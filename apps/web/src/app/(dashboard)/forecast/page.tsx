'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useOpportunities } from '@/hooks/use-opportunities';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { PaginationBar } from '@/components/ui/data-grid/pagination-bar';
import { ListToolbar } from '@/components/ui/data-grid/list-toolbar';
import { OpportunityStageBadge } from '@/components/opportunities/opportunity-stage-badge';
import { ForecastChartView } from '@/components/forecast/forecast-chart-view';
import { ForecastSplitView } from '@/components/forecast/forecast-split-view';
import type { ViewMode } from '@/types/leads';
import {
  TrendingUp,
  DollarSign,
  Target,
  Download,
  Filter,
  CheckCircle2,
  Search,
  AlertCircle,
  Calendar,
  Users,
} from 'lucide-react';
import type { OpportunityWithRelations } from '@/types/opportunities';
import {
  APPROVED_FORECAST_STAGES,
  normalizeOpportunityStage,
  calculateForecastStats,
  STAGE_CONFIG_MAP,
  type CanonicalStageId,
} from '@/lib/forecast/forecast-utils';

type PeriodRange = 'all' | 'month' | 'quarter' | 'year';

export default function ForecastPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodRange>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isExporting, setIsExporting] = useState(false);

  const supabase = createClient();

  // Query users/sales reps for rep filter
  const { data: salesReps } = useQuery({
    queryKey: ['sales-reps-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .eq('is_active', true)
        .order('first_name', { ascending: true });
      if (error) return [];
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Calculate period dates
  const periodDates = useMemo(() => {
    if (period === 'all') return { from: null, to: null };
    const now = new Date();
    const year = now.getFullYear();

    if (period === 'month') {
      const month = now.getMonth();
      const firstDay = new Date(year, month, 1).toISOString().slice(0, 10);
      const lastDay = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      return { from: firstDay, to: lastDay };
    } else if (period === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const firstDay = new Date(year, currentQuarter * 3, 1).toISOString().slice(0, 10);
      const lastDay = new Date(year, (currentQuarter + 1) * 3, 0).toISOString().slice(0, 10);
      return { from: firstDay, to: lastDay };
    } else if (period === 'year') {
      const firstDay = new Date(year, 0, 1).toISOString().slice(0, 10);
      const lastDay = new Date(year, 11, 31).toISOString().slice(0, 10);
      return { from: firstDay, to: lastDay };
    }
    return { from: null, to: null };
  }, [period]);

  // 1. Authenticated database-side aggregation RPC (Zero client-side full-table scanning)
  const { data: metricsData, isLoading: isAggLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['forecast-pipeline-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('forecast_pipeline_metrics');
      if (error) throw error;
      return data as {
        summary: {
          unweighted_pipeline: number;
          weighted_pipeline: number;
          closed_won_revenue: number;
          closed_lost_revenue: number;
          total_commit_volume: number;
          open_deals_count: number;
          won_deals_count: number;
          lost_deals_count: number;
          unassigned_deals_count: number;
          unassigned_deals_amount: number;
          blended_confidence: number;
        };
        breakdown: Array<{
          id: CanonicalStageId;
          label: string;
          default_probability: number;
          count: number;
          total_amount: number;
          weighted_amount: number;
          is_won?: boolean;
          is_lost?: boolean;
        }>;
      };
    },
    staleTime: 1000 * 30,
  });

  const stats = useMemo(() => ({
    unweightedPipeline: metricsData?.summary?.unweighted_pipeline ?? 0,
    weightedPipeline: metricsData?.summary?.weighted_pipeline ?? 0,
    closedWonRevenue: metricsData?.summary?.closed_won_revenue ?? 0,
    closedLostRevenue: metricsData?.summary?.closed_lost_revenue ?? 0,
    totalCommitVolume: metricsData?.summary?.total_commit_volume ?? 0,
    openDealsCount: metricsData?.summary?.open_deals_count ?? 0,
    wonDealsCount: metricsData?.summary?.won_deals_count ?? 0,
    lostDealsCount: metricsData?.summary?.lost_deals_count ?? 0,
    unassignedDealsCount: metricsData?.summary?.unassigned_deals_count ?? 0,
    unassignedDealsAmount: metricsData?.summary?.unassigned_deals_amount ?? 0,
    blendedConfidence: metricsData?.summary?.blended_confidence ?? 0,
  }), [metricsData?.summary]);

  const stageBreakdown = useMemo(() => {
    if (!metricsData?.breakdown) {
      return APPROVED_FORECAST_STAGES.map((s) => ({
        id: s.id,
        label: s.label,
        defaultProbability: s.defaultProbability,
        count: 0,
        totalAmount: 0,
        weightedAmount: 0,
        isWon: s.isWon,
        isLost: s.isLost,
      }));
    }
    return metricsData.breakdown.map((b) => ({
      id: b.id,
      label: b.label,
      defaultProbability: b.default_probability,
      count: b.count,
      totalAmount: b.total_amount,
      weightedAmount: b.weighted_amount,
      isWon: b.is_won,
      isLost: b.is_lost,
    }));
  }, [metricsData?.breakdown]);

  // Determine ownerId for queries
  const activeOwnerId = selectedRep === 'all' ? undefined : selectedRep === 'my' ? user?.id : selectedRep;

  // 2. Paginated & Filtered Opportunities for the DataGrid table view
  const { data: tableData, isLoading: isTableLoading, refetch: refetchTable } = useOpportunities({
    page,
    pageSize,
    search,
    ownerId: activeOwnerId,
    filters: {
      closeDateFrom: periodDates.from,
      closeDateTo: periodDates.to,
    },
  });

  // Client-side stage filter on the table rows
  const opportunities = useMemo(() => {
    const list = tableData?.opportunities || [];
    if (selectedStage === 'all') return list;
    if (selectedStage === 'open') {
      return list.filter((opp) => {
        const id = normalizeOpportunityStage(opp.stage);
        return id !== 'closed_won' && id !== 'closed_lost';
      });
    }
    return list.filter((opp) => normalizeOpportunityStage(opp.stage) === selectedStage);
  }, [tableData?.opportunities, selectedStage]);

  const totalCount = selectedStage === 'all' ? (tableData?.totalCount || 0) : opportunities.length;

  const exportForecastCSV = async () => {
    setIsExporting(true);
    try {
      const { data: opps, error } = await supabase
        .from('opportunities')
        .select(`
          id,
          name,
          stage,
          amount,
          probability,
          close_date
        `)
        .order('created_at', { ascending: false });

      if (error || !opps || opps.length === 0) return;

      const headers = [
        'Opportunity Name',
        'Stage (Canonical)',
        'Raw Stage In DB',
        'Amount ($)',
        'Probability (%)',
        'Weighted Value ($)',
        'Close Date',
      ];

      const rows = opps.map((opp) => {
        const canonical = normalizeOpportunityStage(opp.stage);
        const amount = Number(opp.amount || 0);
        const prob = opp.probability != null && !isNaN(Number(opp.probability))
          ? Number(opp.probability)
          : canonical !== 'unassigned'
          ? STAGE_CONFIG_MAP[canonical].defaultProbability
          : 0;
        const weighted = canonical === 'closed_won' ? amount : canonical === 'closed_lost' ? 0 : (amount * prob) / 100;

        return [
          opp.name,
          canonical !== 'unassigned' ? STAGE_CONFIG_MAP[canonical].label : 'Unassigned',
          opp.stage || '—',
          amount,
          prob,
          Math.round(weighted),
          opp.close_date || '—',
        ];
      });

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `finlonexa_forecast_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExporting(false);
    }
  };

  const columns: ColumnDef<OpportunityWithRelations>[] = [
    {
      id: 'name',
      header: 'Opportunity Name',
      cell: (opp) => (
        <Link
          href={`/opportunities/${opp.id}`}
          className="font-medium text-slate-900 hover:text-blue-600 transition"
        >
          {opp.name}
        </Link>
      ),
      sortable: true,
    },
    {
      id: 'account',
      header: 'Account',
      cell: (opp) => (
        <span className="text-slate-700 text-xs">
          {opp.account ? (
            <Link href={`/accounts/${opp.account.id}`} className="hover:underline text-slate-800 font-medium">
              {opp.account.name}
            </Link>
          ) : (
            '—'
          )}
        </span>
      ),
    },
    {
      id: 'stage',
      header: 'Stage',
      cell: (opp) => {
        const stageId = normalizeOpportunityStage(opp.stage);
        let color = 'bg-slate-100 text-slate-700';
        let label = opp.stage || 'Unassigned';

        if (stageId === 'closed_won') {
          color = 'bg-emerald-100 text-emerald-800 font-bold';
          label = 'Closed Won';
        } else if (stageId === 'closed_lost') {
          color = 'bg-rose-100 text-rose-800';
          label = 'Closed Lost';
        } else if (stageId === 'negotiation') {
          color = 'bg-pink-100 text-pink-800';
          label = 'Negotiation';
        } else if (stageId === 'proposal_quote') {
          color = 'bg-amber-100 text-amber-800';
          label = 'Proposal/Quote';
        } else if (stageId === 'needs_analysis') {
          color = 'bg-indigo-100 text-indigo-800';
          label = 'Needs Analysis';
        } else if (stageId === 'qualification') {
          color = 'bg-purple-100 text-purple-800';
          label = 'Qualification';
        } else if (stageId === 'prospecting') {
          color = 'bg-blue-100 text-blue-800';
          label = 'Prospecting';
        }

        return (
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${color}`}>
            {label}
          </span>
        );
      },
    },
    {
      id: 'amount',
      header: 'Deal Amount',
      cell: (opp) => (
        <span className="font-semibold text-slate-900">
          ${Number(opp.amount || 0).toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: 'weighted',
      header: 'Weighted Value',
      cell: (opp) => {
        const stageId = normalizeOpportunityStage(opp.stage);
        const isWon = stageId === 'closed_won';
        const isLost = stageId === 'closed_lost';
        const defaultProb = stageId !== 'unassigned' ? STAGE_CONFIG_MAP[stageId].defaultProbability : 0;
        const prob = opp.probability != null && !isNaN(Number(opp.probability)) ? Number(opp.probability) : defaultProb;
        const amount = Number(opp.amount) || 0;
        const weighted = isWon ? amount : isLost ? 0 : (amount * prob) / 100;

        return (
          <div className="flex flex-col">
            <span className="font-semibold text-emerald-700">${Math.round(weighted).toLocaleString()}</span>
            <span className="text-[10px] text-slate-400">{prob}% probability</span>
          </div>
        );
      },
    },
    {
      id: 'close_date',
      header: 'Target Close',
      cell: (opp) => <span className="text-xs text-slate-600">{opp.close_date || '—'}</span>,
      sortable: true,
    },
    {
      id: 'owner',
      header: 'Opportunity Owner',
      cell: (opp) => (
        <span className="text-xs text-slate-600">
          {opp.owner ? `${opp.owner.first_name} ${opp.owner.last_name}` : '—'}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PermissionGate action="opportunities.view" showAccessDenied>
        <div className="space-y-6">
          <ListToolbar
            title="Sales Forecast"
            viewType={period}
            viewTypeOptions={[
              { label: 'All Time', value: 'all' },
              { label: 'This Month', value: 'month' },
              { label: 'This Quarter', value: 'quarter' },
              { label: 'This Year', value: 'year' },
            ]}
            onViewTypeChange={(p) => {
              setPeriod(p as PeriodRange);
              setPage(1);
            }}
            viewMode={viewMode}
            showLeadViews={true}
            showKanban={false}
            onViewModeChange={setViewMode}
            searchValue={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            onReload={() => {
              void refetchMetrics();
              void refetchTable();
            }}
            onExportAll={exportForecastCSV}
          />

          {/* Sub-toolbar controls for Sales Rep and Stage filtering */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Sales Rep Selector */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-2xs">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedRep}
                  onChange={(e) => {
                    setSelectedRep(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="all">All Sales Reps</option>
                  <option value="my">My Forecast</option>
                  {salesReps?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.first_name} {r.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stage Quick Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                {[
                  { id: 'all', label: 'All Deals' },
                  { id: 'open', label: 'Open Pipeline' },
                  { id: 'closed_won', label: 'Closed Won' },
                  { id: 'closed_lost', label: 'Closed Lost' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSelectedStage(tab.id);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md transition ${
                      selectedStage === tab.id
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <select
                value={selectedStage}
                onChange={(e) => {
                  setSelectedStage(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Individual Stages...</option>
                {APPROVED_FORECAST_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.defaultProbability}%)
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={exportForecastCSV}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-slate-50 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>

          {/* Top KPI Cards (Aggregate across full dataset) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unweighted Open Pipeline</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  ${Math.round(stats.unweightedPipeline).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{stats.openDealsCount} active open opportunities</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Weighted Forecast</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  ${Math.round(stats.weightedPipeline).toLocaleString()}
                </p>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                  {Math.round(stats.blendedConfidence)}% blended win confidence
                </p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <Target className="w-6 h-6" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Closed Won Revenue</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  ${Math.round(stats.closedWonRevenue).toLocaleString()}
                </p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                  {stats.wonDealsCount} won deals (100% attained)
                </p>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Commit Volume</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  ${Math.round(stats.totalCommitVolume).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Won Revenue + Weighted Open</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Missing / Unassigned Stage Data Notice */}
          {stats.unassignedDealsCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Notice:</strong> {stats.unassignedDealsCount} deal(s) (${Math.round(stats.unassignedDealsAmount).toLocaleString()}) have unassigned or non-standard stages and are monitored separately from the 7 approved stages.
              </span>
            </div>
          )}

          {/* Render Views based on viewMode */}
          {viewMode === 'chart' && (
            <ForecastChartView opportunities={opportunities} isLoading={isTableLoading || isAggLoading} />
          )}

          {viewMode === 'split' && (
            <ForecastSplitView opportunities={opportunities} isLoading={isTableLoading || isAggLoading} />
          )}

          {viewMode === 'card' && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {opportunities.map((opp) => {
                  const canonical = normalizeOpportunityStage(opp.stage);
                  const amount = Number(opp.amount || 0);
                  const defaultProb = canonical !== 'unassigned' ? STAGE_CONFIG_MAP[canonical].defaultProbability : 0;
                  const prob = opp.probability != null && !isNaN(Number(opp.probability)) ? Number(opp.probability) : defaultProb;
                  const weighted = canonical === 'closed_won' ? amount : canonical === 'closed_lost' ? 0 : (amount * prob) / 100;

                  return (
                    <article key={opp.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/opportunities/${opp.id}`}
                          className="text-base font-semibold text-slate-900 hover:text-indigo-600 transition truncate"
                        >
                          {opp.name}
                        </Link>
                        <OpportunityStageBadge stage={opp.stage} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500 truncate">
                        {opp.account ? opp.account.name : 'No account'}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Deal Amount</span>
                          <span className="font-semibold text-slate-900 text-sm">
                            ${amount.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Weighted Value</span>
                          <span className="font-bold text-emerald-600 text-sm">
                            ${Math.round(weighted).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                        <span>Close: {opp.close_date || '—'}</span>
                        <span>{opp.owner ? `${opp.owner.first_name} ${opp.owner.last_name}` : '—'}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!isTableLoading && opportunities.length === 0 && (
                <p className="rounded-xl bg-white p-8 text-center text-slate-500">No deals found.</p>
              )}
              <PaginationBar
                currentPage={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
              />
            </>
          )}

          {viewMode === 'table' && (
            <>
              {/* Interactive 7-Stage Pipeline Breakdown Bars */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Approved 7-Stage Opportunity Pipeline Distribution
                  </h2>
                  {selectedStage !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedStage('all')}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Clear stage filter ({selectedStage})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
                  {stageBreakdown.map((stage) => {
                    const isSelected = selectedStage === stage.id;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => {
                          setSelectedStage(isSelected ? 'all' : stage.id);
                          setPage(1);
                        }}
                        className={`p-3 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-400/20 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div>
                          <p className={`text-[11px] font-bold truncate ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>
                            {stage.label}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {stage.defaultProbability}% default • {stage.count} deals
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-200/80">
                          <p className="text-sm font-bold text-slate-900">${Math.round(stage.totalAmount).toLocaleString()}</p>
                          <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                            {stage.isLost ? '0% Lost' : stage.isWon ? '100% Realized' : `Wt: $${Math.round(stage.weightedAmount).toLocaleString()}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DataGrid */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
                <DataGrid
                  data={opportunities}
                  columns={columns}
                  keyExtractor={(opp) => opp.id}
                  isLoading={isTableLoading || isAggLoading}
                />

                <PaginationBar
                  currentPage={page}
                  pageSize={pageSize}
                  totalCount={totalCount}
                  onPageChange={setPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setPage(1);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </PermissionGate>
    </PageContainer>
  );
}
