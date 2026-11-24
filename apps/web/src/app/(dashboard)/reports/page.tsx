'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useAuth } from '@/components/providers/auth-provider';
import { REPORT_CATALOG, useReport, exportReportToCSV } from '@/hooks/use-reports';
import { useCustomReports } from '@/hooks/use-custom-reports';
import type { ReportCategory, ReportDefinition } from '@/types/reports';
import { DataGrid } from '@/components/ui/data-grid/data-grid';
import { Plus, BarChart3, FileSpreadsheet, Trash2, ExternalLink, Share2 } from 'lucide-react';

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const [mainTab, setMainTab] = useState<'standard' | 'custom'>('standard');
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | 'all'>('all');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [searchTable, setSearchTable] = useState('');

  const { reports: customReports, isLoading: isLoadingCustom, deleteReport } = useCustomReports();

  const filteredCatalog = REPORT_CATALOG.filter((r) =>
    selectedCategory === 'all' ? true : r.category === selectedCategory
  );

  const { data: reportResult, isLoading, isError, refetch } = useReport(activeReportId || '');

  const filteredRows = (reportResult?.rows || []).filter((row) => {
    if (!searchTable.trim()) return true;
    const term = searchTable.toLowerCase();
    return Object.values(row).some((val) =>
      val !== null && val !== undefined && String(val).toLowerCase().includes(term)
    );
  });

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Executive Reports"
          subtitle="Standard analytics catalog, pipeline distribution, custom report builder, and performance exports."
        />
        <Link
          href="/reports/builder"
          className="flex items-center gap-1.5 self-start rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Build Custom Report
        </Link>
      </div>

      <PermissionGate action="reports.view" showAccessDenied>
        {/* Main Section Navigation: Standard vs Custom */}
        <div className="mb-6 flex gap-4 border-b border-slate-200">
          <button
            onClick={() => {
              setMainTab('standard');
              setActiveReportId(null);
            }}
            className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${
              mainTab === 'standard'
                ? 'border-emerald-200 text-emerald-800 dark:border-emerald-200 dark:text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800  dark:hover:text-slate-200'
            }`}
          >
            Standard Reports Catalog
          </button>
          <button
            onClick={() => {
              setMainTab('custom');
              setActiveReportId(null);
            }}
            className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition-colors ${
              mainTab === 'custom'
                ? 'border-emerald-200 text-emerald-800 dark:border-emerald-200 dark:text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800  dark:hover:text-slate-200'
            }`}
          >
            Custom Reports
            {customReports.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800">
                {customReports.length}
              </span>
            )}
          </button>
        </div>

        {/* CUSTOM REPORTS TAB */}
        {mainTab === 'custom' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Sales Organization Custom Reports
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Ad-hoc custom reports created with custom fields, filters, and chart distributions.
                </p>
              </div>
              <Link
                href="/reports/builder"
                className="flex items-center gap-1.5 self-start rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                Create Report
              </Link>
            </div>

            {isLoadingCustom && (
              <div className="flex h-48 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-transparent" />
              </div>
            )}

            {!isLoadingCustom && customReports.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
                <BarChart3 className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                <h4 className="mt-3 text-sm font-semibold text-slate-900">
                  No custom reports created yet
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Build custom cross-object tabular views, stage breakdowns, and activity summaries.
                </p>
                <Link
                  href="/reports/builder"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  <Plus className="h-4 w-4" /> Create Your First Custom Report
                </Link>
              </div>
            )}

            {!isLoadingCustom && customReports.length > 0 && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {customReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:bg-emerald-600/30 dark:text-emerald-600">
                          {report.primary_module}
                        </span>
                        {report.is_shared && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Share2 className="h-3 w-3" /> Shared
                          </span>
                        )}
                      </div>
                      <h4 className="mt-3 text-base font-bold text-slate-900">
                        {report.name}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {report.description || 'No description provided.'}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span>Columns: {report.selected_columns?.length || 0}</span>
                        <span>•</span>
                        <span>Format: {report.chart_type}</span>
                        <span>•</span>
                        <span>Created: {new Date(report.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t pt-3">
                      <Link
                        href={`/reports/builder?id=${report.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-800 dark:text-emerald-600"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Run / Edit
                      </Link>

                      <button
                        onClick={async () => {
                          if (confirm(`Delete custom report "${report.name}"?`)) {
                            await deleteReport(report.id);
                          }
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                        title="Delete report"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STANDARD REPORTS TAB */}
        {mainTab === 'standard' && (
          <>
            {/* If no report is selected, show Catalog */}
            {!activeReportId && (
              <div>
                {/* Category Filter Tabs */}
                <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                  {(
                    [
                      { id: 'all', label: 'All Reports' },
                      { id: 'leads', label: 'Lead Reports' },
                      { id: 'opportunities', label: 'Pipeline & Deals' },
                      { id: 'accounts', label: 'Accounts & Clients' },
                      { id: 'activities', label: 'Sales Engagement' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedCategory(tab.id)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        selectedCategory === tab.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Catalog Cards Grid */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCatalog.map((report) => (
                    <div
                      key={report.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:bg-emerald-600/30 dark:text-emerald-600">
                            {report.category}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-slate-900">
                          {report.title}
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">
                          {report.description}
                        </p>
                      </div>

                      <div className="mt-6 border-t pt-4">
                        <button
                          onClick={() => setActiveReportId(report.id)}
                          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                        >
                          View Report →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* If a report is selected, show Interactive Execution & Results */}
            {activeReportId && (
              <div className="space-y-6">
                {/* Action Bar */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={() => {
                      setActiveReportId(null);
                      setSearchTable('');
                    }}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:hover:text-white"
                  >
                    ← Back to Reports Catalog
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => refetch()}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      ↻ Refresh
                    </button>
                    {reportResult && (
                      <button
                        onClick={() => exportReportToCSV(reportResult)}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                      >
                        ↓ Export CSV
                      </button>
                    )}
                  </div>
                </div>

                {isLoading && (
                  <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-transparent" />
                  </div>
                )}

                {isError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
                    <p>Failed to execute report. Please check your permissions and try again.</p>
                    <button
                      onClick={() => refetch()}
                      className="mt-3 rounded bg-red-600 px-4 py-1.5 text-xs font-medium text-white"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {reportResult && (
                  <>
                    {/* Report Info & Summary KPI Cards */}
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">
                          {reportResult.title}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">{reportResult.description}</p>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
                        {reportResult.summaryMetrics.map((metric, idx) => (
                          <div key={idx}>
                            <span className="text-xs text-slate-500">{metric.label}</span>
                            <p className="mt-1 text-xl font-bold text-slate-900">
                              {metric.value}
                            </p>
                            {metric.subtext && (
                              <span className="text-xs text-slate-400">{metric.subtext}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Visual Category Breakdown if available */}
                    {reportResult.breakdown.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                          Segment Distribution
                        </h3>
                        <div className="space-y-3">
                          {reportResult.breakdown.map((item, idx) => (
                            <div key={idx}>
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {item.label}
                                </span>
                                <span className="text-slate-500">
                                  {item.count} {item.value !== undefined ? `($${item.value.toLocaleString()})` : ''} • {item.percent}%
                                </span>
                              </div>
                              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div
                                  className="h-full bg-emerald-600 dark:bg-emerald-600"
                                  style={{ width: `${Math.min(item.percent || 0, 100)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tabular Records Preview */}
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-base font-semibold text-slate-900">
                          Report Dataset Records ({filteredRows.length})
                        </h3>
                        <input
                          type="text"
                          placeholder="Search within report results..."
                          value={searchTable}
                          onChange={(e) => setSearchTable(e.target.value)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800 sm:w-64"
                        />
                      </div>

                      <DataGrid<Record<string, any>>
                        data={filteredRows}
                        keyExtractor={(r) => r.id || String(r.name || r.title || r.subject || Math.random())}
                        columns={reportResult.columns.map((col) => ({
                          id: col.id,
                          header: col.header,
                          accessorKey: col.accessorKey,
                          cell: (row: any) => (
                            <span className="text-xs text-slate-800 dark:text-slate-200">
                              {row[col.accessorKey] !== null && row[col.accessorKey] !== undefined
                                ? String(row[col.accessorKey])
                                : '—'}
                            </span>
                          ),
                        }))}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </PermissionGate>
    </PageContainer>
  );
}
