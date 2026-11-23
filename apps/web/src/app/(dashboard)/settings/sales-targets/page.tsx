'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useSalesPerformance, type RepPerformance } from '@/hooks/use-sales-performance';
import { useSalesQuotas, useUpsertSalesQuotaMutation } from '@/hooks/use-sales-quotas';
import {
  Target,
  Calendar,
  Save,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  User,
  Users,
  Search,
  Filter,
} from 'lucide-react';

export default function SalesTargetsPage() {
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly'>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-indexed
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.floor(new Date().getMonth() / 3) + 1);
  const [search, setSearch] = useState('');
  const [editingQuotas, setEditingQuotas] = useState<Record<string, number>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calculate start and end dates based on selection
  const { periodStart, periodEnd, periodLabel } = useMemo(() => {
    if (periodType === 'monthly') {
      const start = new Date(selectedYear, selectedMonth, 1).toISOString().slice(0, 10);
      const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().slice(0, 10);
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return { periodStart: start, periodEnd: end, periodLabel: `${monthNames[selectedMonth]} ${selectedYear}` };
    } else {
      const startMonth = (selectedQuarter - 1) * 3;
      const start = new Date(selectedYear, startMonth, 1).toISOString().slice(0, 10);
      const end = new Date(selectedYear, startMonth + 3, 0).toISOString().slice(0, 10);
      return { periodStart: start, periodEnd: end, periodLabel: `Q${selectedQuarter} ${selectedYear}` };
    }
  }, [periodType, selectedYear, selectedMonth, selectedQuarter]);

  // Fetch performance data with real database calculation
  const { data: performance, isLoading, refetch } = useSalesPerformance({
    periodStart,
    periodEnd,
    periodType,
  });

  const upsertMutation = useUpsertSalesQuotaMutation();

  const reps = performance?.reps || [];

  const filteredReps = reps.filter((r) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(term) ||
      r.email.toLowerCase().includes(term) ||
      (r.roleName && r.roleName.toLowerCase().includes(term)) ||
      (r.department && r.department.toLowerCase().includes(term))
    );
  });

  const handleQuotaChange = (userId: string, val: number) => {
    setEditingQuotas((prev) => ({
      ...prev,
      [userId]: val,
    }));
  };

  const handleSaveAll = async () => {
    try {
      setErrorMessage(null);
      setSaveSuccess(false);

      const promises = Object.entries(editingQuotas).map(([userId, targetAmount]) =>
        upsertMutation.mutateAsync({
          userId,
          periodType,
          periodStart,
          periodEnd,
          targetAmount: Number(targetAmount),
        })
      );

      await Promise.all(promises);
      setSaveSuccess(true);
      setEditingQuotas({});
      await refetch();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update sales quotas.');
    }
  };

  const getRoleBadgeColor = (roleId: string) => {
    switch (roleId) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'HEAD_OF_SALES':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'RSM':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'SSM':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
      case 'ASM':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'BDO':
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-2 text-xs">
        <Link href="/settings" className="text-slate-500 hover:text-blue-600 transition flex items-center gap-1">
          <span>Settings</span>
          <span>›</span>
          <span className="text-blue-600 font-medium">Sales Targets &amp; Quotas</span>
        </Link>
      </div>

      <PageHeader
        title="Sales Targets & Quota Management"
        subtitle="Configure monthly and quarterly revenue quotas across individual representatives and sales hierarchies."
        actions={
          <PermissionGate action="sales_targets.manage">
            <button
              onClick={handleSaveAll}
              disabled={Object.keys(editingQuotas).length === 0 || upsertMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>
                {upsertMutation.isPending
                  ? 'Saving Quotas...'
                  : `Save Changes (${Object.keys(editingQuotas).length})`}
              </span>
            </button>
          </PermissionGate>
        }
      />

      <PermissionGate action="sales_targets.view" showAccessDenied>
        {/* Period Selector Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-xs dark:bg-slate-900 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Period Type Buttons */}
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setPeriodType('monthly')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  periodType === 'monthly'
                    ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-800 dark:text-blue-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('quarterly')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  periodType === 'quarterly'
                    ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-800 dark:text-blue-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Quarterly
              </button>
            </div>

            {/* Year Select */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {[2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>

            {/* Month / Quarter Select */}
            {periodType === 'monthly' ? (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ].map((m, idx) => (
                  <option key={idx} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value={1}>Q1 (Jan - Mar)</option>
                <option value={2}>Q2 (Apr - Jun)</option>
                <option value={3}>Q3 (Jul - Sep)</option>
                <option value={4}>Q4 (Oct - Dec)</option>
              </select>
            )}
          </div>

          {/* Search Reps */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search personnel or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-slate-800 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Feedback Alerts */}
        {saveSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Sales quotas successfully updated and synced with forecast leaderboards.</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Top Summary Rollups */}
        {!isLoading && reps.length > 0 && !reps.some((r) => r.quotaId) && (
          <div className="mb-5 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200">
            <Target className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">Unconfigured Period Targets (Role Baselines Active)</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                No custom quota records have been configured in database table <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/60 rounded text-[10px]">crm_sales_quotas</code> for {periodLabel}. Standardized organizational role defaults are active. Adjust any representative target below and click <strong>Save Changes</strong> to persist custom targets.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs dark:bg-slate-900 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-medium">Selected Period</span>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{periodLabel}</p>
            <span className="text-[11px] text-slate-400">{periodStart} to {periodEnd}</span>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs dark:bg-slate-900 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-medium">Total Team Quota</span>
            <p className="mt-1 text-lg font-bold text-blue-600 dark:text-blue-400">
              ${(performance?.totalTeamQuota || 0).toLocaleString()}
            </p>
            <span className="text-[11px] text-slate-400">
              {reps.some((r) => r.quotaId) ? 'Custom configured targets' : 'Role baseline defaults'}
            </span>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs dark:bg-slate-900 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-medium">Closed Won Revenue</span>
            <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
              ${(performance?.totalTeamWon || 0).toLocaleString()}
            </p>
            <span className="text-[11px] text-slate-400">No double-counting splits</span>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs dark:bg-slate-900 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-medium">Overall Attainment</span>
            <p className="mt-1 text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {performance?.overallAttainment || 0}%
            </p>
            <span className="text-[11px] text-slate-400">Total won vs quota pacing</span>
          </div>
        </div>

        {/* Reps Quota Grid */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 flex items-center justify-between">
            <span>Personnel Quota Allocations ({filteredReps.length})</span>
            <span className="text-[11px] font-normal lowercase text-slate-400">
              Changes auto-stage; click 'Save Changes' to commit to database.
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Loading sales personnel and quota records...
            </div>
          ) : filteredReps.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No sales personnel found matching your filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-900/50">
                    <th className="py-3 px-4 text-left font-semibold">Representative</th>
                    <th className="py-3 px-4 text-left font-semibold">Role &amp; Hierarchy</th>
                    <th className="py-3 px-4 text-left font-semibold">Manager</th>
                    <th className="py-3 px-4 text-left font-semibold">Won Revenue</th>
                    <th className="py-3 px-4 text-left font-semibold">Quota Target ($)</th>
                    <th className="py-3 px-4 text-left font-semibold">Attainment %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredReps.map((rep) => {
                    const currentQuota =
                      editingQuotas[rep.id] !== undefined ? editingQuotas[rep.id] : rep.quota;
                    const calculatedAttainment =
                      currentQuota > 0 ? Math.round((rep.wonRevenue / currentQuota) * 100) : 0;
                    const isDirty = editingQuotas[rep.id] !== undefined;

                    return (
                      <tr
                        key={rep.id}
                        className={`hover:bg-slate-50/70 transition dark:hover:bg-slate-800/40 ${
                          isDirty ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{rep.name}</div>
                          <div className="text-[11px] text-slate-500">{rep.email}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getRoleBadgeColor(
                              rep.roleId
                            )}`}
                          >
                            {rep.roleName}
                          </span>
                          {rep.designation && (
                            <span className="block text-[11px] text-slate-400 mt-0.5">
                              {rep.designation}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {rep.managerName || <span className="text-slate-400 italic">None</span>}
                        </td>

                        <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                          ${rep.wonRevenue.toLocaleString()}
                        </td>

                        <td className="py-3 px-4">
                          <PermissionGate
                            action="sales_targets.manage"
                            fallback={
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  ${currentQuota.toLocaleString()}
                                </span>
                                {rep.quotaId ? (
                                  <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900 font-medium">
                                    Saved
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900 font-medium">
                                    Role Default
                                  </span>
                                )}
                              </div>
                            }
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 max-w-[140px]">
                                <span className="text-slate-400">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  value={currentQuota}
                                  onChange={(e) =>
                                    handleQuotaChange(rep.id, Number(e.target.value) || 0)
                                  }
                                  className={`w-full px-2.5 py-1 text-xs rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 ${
                                    isDirty
                                      ? 'border-blue-500 ring-1 ring-blue-500'
                                      : 'border-slate-300 dark:border-slate-700'
                                  }`}
                                />
                              </div>
                              {isDirty ? (
                                <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900 font-medium shrink-0">
                                  Staged
                                </span>
                              ) : rep.quotaId ? (
                                <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900 font-medium shrink-0">
                                  Saved
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900 font-medium shrink-0">
                                  Role Default
                                </span>
                              )}
                            </div>
                          </PermissionGate>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold ${
                                calculatedAttainment >= 100
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : calculatedAttainment >= 75
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : calculatedAttainment >= 50
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {calculatedAttainment}%
                            </span>
                            <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  calculatedAttainment >= 100
                                    ? 'bg-emerald-500'
                                    : calculatedAttainment >= 75
                                    ? 'bg-blue-500'
                                    : calculatedAttainment >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(calculatedAttainment, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PermissionGate>
    </PageContainer>
  );
}
