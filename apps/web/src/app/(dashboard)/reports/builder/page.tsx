'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  REPORT_MODULE_OPTIONS,
  MODULE_COLUMNS_MAP,
  type ReportPrimaryModule,
  type ReportChartType,
  type ReportFilter,
  type CrmCustomReport,
} from '@/types/custom-reports';
import { useCustomReports, useExecuteCustomReport } from '@/hooks/use-custom-reports';
import { DataGrid } from '@/components/ui/data-grid/data-grid';
import {
  BarChart3,
  PieChart,
  Table as TableIcon,
  Download,
  Save,
  Plus,
  Trash2,
  Play,
  ArrowLeft,
  Share2,
  Check,
  FileText,
} from 'lucide-react';
import { jsPDF } from 'jspdf';

function CustomReportBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams?.get('id');

  const { reports, saveReport, isSaving } = useCustomReports();

  // Builder State
  const [name, setName] = useState('New Custom Report');
  const [description, setDescription] = useState('');
  const [primaryModule, setPrimaryModule] = useState<ReportPrimaryModule>('opportunities');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'name',
    'amount',
    'stage',
    'close_date',
    'created_at',
  ]);
  const [chartType, setChartType] = useState<ReportChartType>('table');
  const [groupByField, setGroupByField] = useState<string>('stage');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [isShared, setIsShared] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // If editing an existing report, pre-populate state
  useEffect(() => {
    if (reportId && reports.length > 0) {
      const existing = reports.find((r) => r.id === reportId);
      if (existing) {
        setName(existing.name);
        setDescription(existing.description || '');
        setPrimaryModule(existing.primary_module);
        setSelectedColumns(existing.selected_columns || []);
        setChartType(existing.chart_type || 'table');
        setGroupByField(existing.group_by_field || '');
        setSortField(existing.sort_field || 'created_at');
        setSortDirection(existing.sort_direction || 'desc');
        setFilters(existing.filters || []);
        setIsShared(existing.is_shared || false);
      }
    }
  }, [reportId, reports]);

  // When module changes, reset columns and groupBy to sensible defaults
  const handleModuleChange = (newModule: ReportPrimaryModule) => {
    setPrimaryModule(newModule);
    const cols = MODULE_COLUMNS_MAP[newModule] || [];
    setSelectedColumns(cols.slice(0, 5).map((c) => c.key));
    setSortField('created_at');
    setGroupByField(cols[1]?.key || '');
  };

  // Build current report config for live execution
  const currentConfig = useMemo(
    () => ({
      primary_module: primaryModule,
      selected_columns: selectedColumns,
      filters,
      sort_field: sortField,
      sort_direction: sortDirection,
      group_by_field: groupByField || null,
      chart_type: chartType,
    }),
    [primaryModule, selectedColumns, filters, sortField, sortDirection, groupByField, chartType]
  );

  const { data: execResult, isLoading: isExecuting, isError, refetch } = useExecuteCustomReport(
    currentConfig,
    true
  );

  const availableColumns = useMemo(
    () => MODULE_COLUMNS_MAP[primaryModule] || [],
    [primaryModule]
  );

  const toggleColumn = (key: string) => {
    if (selectedColumns.includes(key)) {
      if (selectedColumns.length > 1) {
        setSelectedColumns(selectedColumns.filter((c) => c !== key));
      }
    } else {
      setSelectedColumns([...selectedColumns, key]);
    }
  };

  const addFilter = () => {
    const defaultField = availableColumns[0]?.key || 'name';
    setFilters([...filters, { field: defaultField, operator: 'equals', value: '' }]);
  };

  const removeFilter = (idx: number) => {
    setFilters(filters.filter((_, i) => i !== idx));
  };

  const updateFilter = (idx: number, updates: Partial<ReportFilter>) => {
    const next = [...filters];
    next[idx] = { ...next[idx], ...updates };
    setFilters(next);
  };

  const handleSave = async () => {
    try {
      const saved = await saveReport({
        id: reportId || undefined,
        name,
        description,
        primary_module: primaryModule,
        selected_columns: selectedColumns,
        filters,
        sort_field: sortField,
        sort_direction: sortDirection,
        group_by_field: groupByField || null,
        chart_type: chartType,
        is_shared: isShared,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      if (!reportId && saved?.id) {
        router.replace(`/reports/builder?id=${saved.id}`);
      }
    } catch (err) {
      console.error('Failed to save custom report:', err);
      alert('Failed to save report. Please verify your permissions.');
    }
  };

  const handleExportCSV = () => {
    if (!execResult || !execResult.rows || execResult.rows.length === 0) return;
    const cols = selectedColumns.length > 0 ? selectedColumns : availableColumns.map((c) => c.key);
    const headers = cols.join(',');
    const rows = execResult.rows.map((row) =>
      cols
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${name.toLowerCase().replace(/\s+/g, '_')}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!execResult || !execResult.rows || execResult.rows.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    const cols = selectedColumns.length > 0 ? selectedColumns : availableColumns.map((c) => c.key);

    // Document header
    doc.setFontSize(16);
    doc.text(name, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `FINLONEXA CRM — Custom Report (${primaryModule}) | Generated: ${new Date().toLocaleString()}`,
      14,
      22
    );
    doc.text(
      `Total Matched Records: ${execResult.total_count} | Exported Rows: ${execResult.rows.length}`,
      14,
      27
    );

    // Table Header
    let y = 35;
    const colWidth = Math.max(260 / cols.length, 24);
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    cols.forEach((col, i) => {
      const match = availableColumns.find((c) => c.key === col);
      const label = match?.label || col;
      doc.text(label.substring(0, 16), 14 + i * colWidth, y);
    });
    doc.line(14, y + 2, 280, y + 2);
    y += 7;

    // Table Data Rows
    doc.setFont('helvetica', 'normal');
    for (const row of execResult.rows.slice(0, 40)) {
      if (y > 190) {
        doc.addPage();
        y = 15;
      }
      cols.forEach((col, i) => {
        const val = row[col] !== null && row[col] !== undefined ? String(row[col]) : '—';
        doc.text(val.substring(0, 18), 14 + i * colWidth, y);
      });
      y += 5;
    }

    doc.save(`${name.toLowerCase().replace(/\s+/g, '_')}_export.pdf`);
  };

  // Compute breakdown if chart is selected
  const chartBreakdown = useMemo(() => {
    if (!execResult?.rows || !groupByField) return [];
    const counts: Record<string, number> = {};
    for (const r of execResult.rows) {
      const val = r[groupByField] !== null && r[groupByField] !== undefined ? String(r[groupByField]) : '(Empty)';
      counts[val] = (counts[val] || 0) + 1;
    }
    const total = execResult.rows.length || 1;
    return Object.entries(counts)
      .map(([label, count]) => ({
        label,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [execResult?.rows, groupByField]);

  return (
    <PageContainer>
      {/* Top Navigation & Action Bar */}
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {reportId ? 'Edit Custom Report' : 'Custom Report Builder'}
            </h1>
            <p className="text-xs text-slate-500">
              Query readable sales data with custom fields, filtering, and chart visualization.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {savedSuccess && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" /> Saved!
            </span>
          )}
          <button
            onClick={handleExportCSV}
            disabled={!execResult?.rows || execResult.rows.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!execResult?.rows || execResult.rows.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <FileText className="h-4 w-4 text-red-500" /> Export PDF
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Report'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Side: Configuration Panel (4 cols) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Metadata Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Report Details
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Report Title
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="e.g. Q4 Stalled Enterprise Pipeline"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Short description of report purpose..."
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_shared"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_shared" className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
                  <Share2 className="h-3.5 w-3.5 text-slate-400" />
                  Share with company sales team
                </label>
              </div>
            </div>
          </div>

          {/* Module Selector */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Primary Sales Module
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_MODULE_OPTIONS.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => handleModuleChange(mod.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                    primaryModule === mod.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {mod.label}
                </button>
              ))}
            </div>
          </div>

          {/* Field Selection */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Display Columns ({selectedColumns.length})
              </h2>
              <button
                type="button"
                onClick={() => setSelectedColumns(availableColumns.map((c) => c.key))}
                className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
              >
                Select All
              </button>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {availableColumns.map((col) => {
                const checked = selectedColumns.includes(col.key);
                return (
                  <label
                    key={col.key}
                    className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="text-slate-700 dark:text-slate-300">{col.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleColumn(col.key)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Visualization & Grouping */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Chart & Grouping
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Visualization Layout
                </label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {[
                    { id: 'table', label: 'Table Only', icon: TableIcon },
                    { id: 'bar', label: 'Bar Chart', icon: BarChart3 },
                    { id: 'donut', label: 'Donut / Pie', icon: PieChart },
                  ].map((ct) => {
                    const Icon = ct.icon;
                    return (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => setChartType(ct.id as ReportChartType)}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center text-xs font-medium transition-colors ${
                          chartType === ct.id
                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{ct.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {chartType !== 'table' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Group Breakdown By Field
                  </label>
                  <select
                    value={groupByField}
                    onChange={(e) => setGroupByField(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">None</option>
                    {availableColumns.map((col) => (
                      <option key={col.key} value={col.key}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Sort By
                  </label>
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {availableColumns.map((col) => (
                      <option key={col.key} value={col.key}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Direction
                  </label>
                  <select
                    value={sortDirection}
                    onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="desc">Descending (Z-A / Newest)</option>
                    <option value="asc">Ascending (A-Z / Oldest)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Filtering Conditions */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Filter Criteria ({filters.length})
              </h2>
              <button
                type="button"
                onClick={addFilter}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Plus className="h-3 w-3" /> Add Filter
              </button>
            </div>
            {filters.length === 0 ? (
              <p className="text-xs italic text-slate-400">No active filters. Showing all records.</p>
            ) : (
              <div className="space-y-2">
                {filters.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <select
                      value={f.field}
                      onChange={(e) => updateFilter(idx, { field: e.target.value })}
                      className="w-1/3 rounded border border-slate-300 px-1.5 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {availableColumns.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={f.operator}
                      onChange={(e) => updateFilter(idx, { operator: e.target.value as any })}
                      className="w-1/4 rounded border border-slate-300 px-1 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="equals">=</option>
                      <option value="not_equals">≠</option>
                      <option value="contains">contains</option>
                      <option value="greater_than">&gt;</option>
                      <option value="less_than">&lt;</option>
                    </select>
                    <input
                      type="text"
                      value={f.value}
                      placeholder="value"
                      onChange={(e) => updateFilter(idx, { value: e.target.value })}
                      className="w-1/3 rounded border border-slate-300 px-1.5 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeFilter(idx)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Live Report Preview (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
          {/* Status & Preview Summary Header */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    Live Preview
                  </span>
                  <span className="text-xs text-slate-500">
                    Target View: <code className="text-slate-700 dark:text-slate-300">{primaryModule}_readable</code>
                  </span>
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {name}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => refetch()}
                  disabled={isExecuting}
                  className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Play className="h-3.5 w-3.5 text-emerald-600" />
                  {isExecuting ? 'Running...' : 'Re-run Query'}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-3 dark:border-slate-800">
              <div>
                <span className="text-[11px] text-slate-400">Total Count</span>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {execResult?.total_count ?? 0} records
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Returned Rows</span>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {execResult?.rows?.length ?? 0} of {execResult?.limit ?? 250}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Active Columns</span>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedColumns.length} fields
                </p>
              </div>
            </div>
          </div>

          {/* Chart Segment Distribution Preview */}
          {chartType !== 'table' && chartBreakdown.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Segment Distribution by {groupByField}
              </h4>
              <div className="space-y-2.5">
                {chartBreakdown.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {item.label}
                      </span>
                      <span className="text-slate-500">
                        {item.count} items ({item.percent}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
                        style={{ width: `${Math.min(item.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dataset Table Preview */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tabular Dataset Preview
            </h4>

            {isExecuting && (
              <div className="flex h-48 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            )}

            {isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-xs text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
                Failed to execute custom report. Ensure you have read permissions for module{' '}
                <code>{primaryModule}</code>.
              </div>
            )}

            {!isExecuting && !isError && (!execResult?.rows || execResult.rows.length === 0) && (
              <div className="py-12 text-center text-xs text-slate-400">
                No matching records returned for this report configuration.
              </div>
            )}

            {!isExecuting && !isError && execResult?.rows && execResult.rows.length > 0 && (
              <div className="overflow-x-auto">
                <DataGrid<Record<string, any>>
                  data={execResult.rows}
                  keyExtractor={(r: Record<string, any>) => String(r.id || r.name || Math.random())}
                  columns={selectedColumns.map((colKey) => {
                    const match = availableColumns.find((c) => c.key === colKey);
                    const label = match?.label || colKey;
                    return {
                      id: colKey,
                      header: label,
                      accessorKey: colKey,
                      cell: (row: any) => (
                        <span className="text-xs text-slate-800 dark:text-slate-200">
                          {row[colKey] !== null && row[colKey] !== undefined
                            ? String(row[colKey])
                            : '—'}
                        </span>
                      ),
                    };
                  })}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default function CustomReportBuilderPage() {
  return (
    <PermissionGate action="reports.view" showAccessDenied>
      <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading custom report builder...</div>}>
        <CustomReportBuilderContent />
      </Suspense>
    </PermissionGate>
  );
}
