'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface RepPerformance {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  hierarchyRank: number;
  department: string | null;
  designation: string | null;
  managerName: string | null;
  wonRevenue: number;
  wonDealsCount: number;
  openPipelineValue: number;
  openDealsCount: number;
  quota: number;
  quotaId?: string | null;
  attainmentPercent: number;
}

export interface SalesPerformanceSummary {
  period_start?: string;
  period_end?: string;
  period_type?: string;
  totalTeamWon: number;
  totalTeamQuota: number;
  overallAttainment: number;
  totalOpenPipeline: number;
  activeRepsCount: number;
  topPerformer: RepPerformance | null;
  reps: RepPerformance[];
}

export function computePeriodBounds(
  periodType: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
  refDate: Date = new Date()
) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  let startStr = '';
  let endStr = '';

  if (periodType === 'quarterly') {
    const qStartMonth = Math.floor(month / 3) * 3;
    const start = new Date(Date.UTC(year, qStartMonth, 1));
    const end = new Date(Date.UTC(year, qStartMonth + 3, 0));
    startStr = start.toISOString().slice(0, 10);
    endStr = end.toISOString().slice(0, 10);
  } else if (periodType === 'yearly') {
    startStr = `${year}-01-01`;
    endStr = `${year}-12-31`;
  } else {
    // monthly
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));
    startStr = start.toISOString().slice(0, 10);
    endStr = end.toISOString().slice(0, 10);
  }
  return { periodStart: startStr, periodEnd: endStr };
}

export function useSalesPerformance(params: {
  periodStart?: string | null;
  periodEnd?: string | null;
  periodType?: 'monthly' | 'quarterly' | 'yearly';
} = {}) {
  const supabase = createClient();
  const { periodType = 'monthly' } = params;
  const computed = computePeriodBounds(periodType);
  const periodStart = params.periodStart || computed.periodStart;
  const periodEnd = params.periodEnd || computed.periodEnd;

  return useQuery<SalesPerformanceSummary>({
    queryKey: ['sales-performance', { periodStart, periodEnd, periodType }],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_sales_performance_leaderboard', {
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_period_type: periodType,
      });

      if (error) throw error;
      return data as SalesPerformanceSummary;
    },
    staleTime: 1000 * 30,
  });
}

export function exportLeaderboardToCSV(reps: RepPerformance[]) {
  if (!reps.length) return;

  const headers = [
    'Name',
    'Email',
    'Role',
    'Designation',
    'Reports To',
    'Won Revenue',
    'Won Deals',
    'Open Pipeline',
    'Quota Target',
    'Attainment %',
  ];

  const rows = reps.map((r) => [
    `"${r.name.replace(/"/g, '""')}"`,
    `"${r.email.replace(/"/g, '""')}"`,
    `"${r.roleName.replace(/"/g, '""')}"`,
    `"${(r.designation || '').replace(/"/g, '""')}"`,
    `"${(r.managerName || '').replace(/"/g, '""')}"`,
    r.wonRevenue,
    r.wonDealsCount,
    r.openPipelineValue,
    r.quota,
    `${r.attainmentPercent}%`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `sales-performance-leaderboard-${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
