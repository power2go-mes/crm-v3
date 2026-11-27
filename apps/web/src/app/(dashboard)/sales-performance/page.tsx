'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useSalesPerformance, exportLeaderboardToCSV, type RepPerformance } from '@/hooks/use-sales-performance';
import { DataGrid } from '@/components/ui/data-grid/data-grid';
import { Target } from 'lucide-react';

export default function SalesPerformancePage() {
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly'>('monthly');

  const { data: performance, isLoading, isError, refetch } = useSalesPerformance({ periodType });

  const reps = performance?.reps || [];

  const filteredReps = reps.filter((r) => {
    if (selectedRole !== 'all' && r.roleId !== selectedRole) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(term) ||
        r.email.toLowerCase().includes(term) ||
        (r.designation && r.designation.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const getRoleBadgeColor = (roleId: string) => {
    switch (roleId) {
      case 'SUPER_ADMIN':
        return 'bg-[#eef2ff] text-[#4361ee] dark:bg-[#4361ee]/30 dark:text-[#4361ee]';
      case 'HEAD_OF_SALES':
        return 'bg-[#eef2ff] text-[#4361ee] dark:bg-[#4361ee]/30 dark:text-[#4361ee]';
      case 'RSM':
        return 'bg-[#eef2ff] text-[#4361ee] dark:bg-[#4361ee]/30 dark:text-[#4361ee]';
      case 'SSM':
        return 'bg-[#eef2ff] text-[#4361ee] dark:bg-[#4361ee]/30 dark:text-[#4361ee]';
      case 'ASM':
        return 'bg-[#eef2ff] text-[#4361ee] dark:bg-indigo-900/30 dark:text-indigo-200';
      case 'BDO':
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    }
  };

  const getAttainmentColor = (pct: number) => {
    if (pct >= 100) return 'text-[#4361ee] dark:text-[#4361ee]';
    if (pct >= 75) return 'text-[#4361ee] dark:text-[#4361ee]';
    if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const getProgressBarColor = (pct: number) => {
    if (pct >= 100) return 'bg-[#4361ee]';
    if (pct >= 75) return 'bg-[#4361ee]';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <PageContainer>
      <PageHeader
        title="Sales Performance"
        subtitle="Regional hierarchy attainment, team velocity, and quota pacing leaderboard."
        actions={
          <div className="flex items-center gap-2.5">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={() => setPeriodType('monthly')}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${
                  periodType === 'monthly'
                    ? 'bg-white text-[#4361ee] shadow-xs dark:bg-slate-800 dark:text-[#4361ee]'
                    : 'text-slate-600 hover:text-slate-900 '
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('quarterly')}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${
                  periodType === 'quarterly'
                    ? 'bg-white text-[#4361ee] shadow-xs dark:bg-slate-800 dark:text-[#4361ee]'
                    : 'text-slate-600 hover:text-slate-900 '
                }`}
              >
                Quarterly
              </button>
            </div>

            <Link
              href="/settings/sales-targets"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4361ee] hover:bg-[#3a5bf0] text-white rounded-lg text-xs font-semibold shadow-xs transition dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Target className="h-3.5 w-3.5" />
              <span>Manage Quotas</span>
            </Link>
          </div>
        }
      />

      <PermissionGate action="sales_performance.view" showAccessDenied>
        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-transparent" />
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
            <p>Sales performance metrics could not be loaded.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 rounded bg-red-600 px-4 py-1.5 text-xs font-medium text-white"
            >
              Retry
            </button>
          </div>
        )}

        {performance && (
          <div className="space-y-6">
            {/* Top KPI Metric Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Total Closed Won</span>
                <p className="mt-1 text-2xl font-bold text-[#4361ee] dark:text-[#4361ee]">
                  ${performance.totalTeamWon.toLocaleString()}
                </p>
                <span className="text-xs text-slate-400">
                  Across {performance.activeRepsCount} active personnel
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Aggregate Team Quota</span>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  ${performance.totalTeamQuota.toLocaleString()}
                </p>
                <span className="text-xs text-slate-400">Current fiscal cycle</span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Overall Attainment</span>
                <p className={`mt-1 text-2xl font-bold ${getAttainmentColor(performance.overallAttainment)}`}>
                  {performance.overallAttainment}%
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full ${getProgressBarColor(performance.overallAttainment)}`}
                    style={{ width: `${Math.min(performance.overallAttainment, 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Open Pipeline</span>
                <p className="mt-1 text-2xl font-bold text-[#4361ee] dark:text-[#4361ee]">
                  ${performance.totalOpenPipeline.toLocaleString()}
                </p>
                <span className="text-xs text-slate-400">Supporting remaining target</span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm focus:border-indigo-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="all">All Roles in Hierarchy</option>
                  <option value="HEAD_OF_SALES">Head of Sales</option>
                  <option value="RSM">Regional Sales Managers (RSM)</option>
                  <option value="SSM">Senior Sales Managers (SSM)</option>
                  <option value="ASM">Assistant Sales Managers (ASM)</option>
                  <option value="BDO">Business Development Officers (BDO)</option>
                </select>

                <input
                  type="text"
                  placeholder="Filter representative..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs shadow-sm focus:border-indigo-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800 sm:w-64"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => refetch()}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  ↻ Refresh
                </button>
                <button
                  onClick={() => exportLeaderboardToCSV(filteredReps)}
                  className="rounded-lg bg-[#4361ee] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4361ee]"
                >
                  ↓ Export Leaderboard
                </button>
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">
                  Attainment Leaderboard ({filteredReps.length})
                </h3>
              </div>

              <DataGrid<RepPerformance>
                data={filteredReps}
                keyExtractor={(r) => r.id}
                columns={[
                  {
                    id: 'rank',
                    header: 'Rank',
                    cell: (r) => (
                      <span className="font-semibold text-slate-500">
                        #{filteredReps.indexOf(r) + 1}
                      </span>
                    ),
                  },
                  {
                    id: 'name',
                    header: 'Representative',
                    cell: (r) => (
                      <div>
                        <p className="font-medium text-slate-900">{r.name}</p>
                        <p className="text-xs text-slate-400">{r.designation || r.email}</p>
                      </div>
                    ),
                  },
                  {
                    id: 'role',
                    header: 'Role',
                    cell: (r) => (
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${getRoleBadgeColor(
                          r.roleId
                        )}`}
                      >
                        {r.roleName}
                      </span>
                    ),
                  },
                  {
                    id: 'manager',
                    header: 'Reports To',
                    cell: (r) => (
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {r.managerName || '—'}
                      </span>
                    ),
                  },
                  {
                    id: 'wonRevenue',
                    header: 'Closed Won',
                    cell: (r) => (
                      <span className="font-semibold text-[#4361ee] dark:text-[#4361ee]">
                        ${r.wonRevenue.toLocaleString()}
                        <span className="ml-1 text-xs text-slate-400 font-normal">
                          ({r.wonDealsCount} won)
                        </span>
                      </span>
                    ),
                  },
                  {
                    id: 'quota',
                    header: 'Quota Target',
                    cell: (r) => (
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        ${r.quota.toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    id: 'attainment',
                    header: 'Attainment',
                    cell: (r) => (
                      <div className="w-32">
                        <div className="flex justify-between text-xs">
                          <span className={`font-bold ${getAttainmentColor(r.attainmentPercent)}`}>
                            {r.attainmentPercent}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={`h-full ${getProgressBarColor(r.attainmentPercent)}`}
                            style={{ width: `${Math.min(r.attainmentPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'pipeline',
                    header: 'Open Pipeline',
                    cell: (r) => (
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        ${r.openPipelineValue.toLocaleString()}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}
      </PermissionGate>
    </PageContainer>
  );
}
