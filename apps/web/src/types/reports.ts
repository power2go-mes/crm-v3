export type ReportCategory = 'leads' | 'opportunities' | 'accounts' | 'activities';

export type ReportChartType = 'bar' | 'donut' | 'funnel' | 'table';

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  chartType: ReportChartType;
}

export interface ReportSummaryMetric {
  label: string;
  value: string | number;
  subtext?: string;
}

export interface ReportBreakdownItem {
  label: string;
  count: number;
  value?: number;
  percent?: number;
  color?: string;
}

export interface ReportResult {
  title: string;
  description: string;
  summaryMetrics: ReportSummaryMetric[];
  breakdown: ReportBreakdownItem[];
  columns: { id: string; header: string; accessorKey: string }[];
  rows: Record<string, any>[];
  pageInfo?: { page: number; pageSize: number; totalCount: number };
}
