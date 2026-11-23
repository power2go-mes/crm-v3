export type ReportPrimaryModule =
  | 'accounts'
  | 'contacts'
  | 'opportunities'
  | 'campaigns'
  | 'activities'
  | 'quotas';

export type ReportChartType = 'table' | 'bar' | 'pie' | 'line' | 'donut';

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value: string;
}

export interface ReportAggregation {
  field: string;
  func: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

export interface CrmCustomReport {
  id: string;
  name: string;
  description: string | null;
  primary_module: ReportPrimaryModule;
  selected_columns: string[];
  filters: ReportFilter[];
  sort_field: string;
  sort_direction: 'asc' | 'desc';
  group_by_field: string | null;
  aggregations: ReportAggregation[];
  chart_type: ReportChartType;
  is_shared: boolean;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface CustomReportExecutionResult {
  module: ReportPrimaryModule;
  total_count: number;
  rows: Record<string, any>[];
  limit: number;
}

export const REPORT_MODULE_OPTIONS: { id: ReportPrimaryModule; label: string; icon: string }[] = [
  { id: 'opportunities', label: 'Opportunities & Pipeline', icon: 'DollarSign' },
  { id: 'accounts', label: 'Accounts & Organizations', icon: 'Building2' },
  { id: 'contacts', label: 'Contacts & People', icon: 'Users' },
  { id: 'campaigns', label: 'Marketing Campaigns', icon: 'Megaphone' },
  { id: 'activities', label: 'Activities, Tasks & Calls', icon: 'CheckSquare' },
  { id: 'quotas', label: 'Sales Targets & Quotas', icon: 'Target' },
];

export const MODULE_COLUMNS_MAP: Record<ReportPrimaryModule, { key: string; label: string }[]> = {
  opportunities: [
    { key: 'name', label: 'Deal Name' },
    { key: 'amount', label: 'Amount' },
    { key: 'stage', label: 'Stage' },
    { key: 'probability', label: 'Probability (%)' },
    { key: 'close_date', label: 'Close Date' },
    { key: 'next_step', label: 'Next Step' },
    { key: 'opportunity_age_days', label: 'Age (Days)' },
    { key: 'days_in_stage', label: 'Days in Stage' },
    { key: 'is_stalled', label: 'Is Stalled' },
    { key: 'created_at', label: 'Created At' },
  ],
  accounts: [
    { key: 'name', label: 'Account Name' },
    { key: 'account_type', label: 'Account Type' },
    { key: 'industry', label: 'Industry' },
    { key: 'annual_revenue', label: 'Annual Revenue' },
    { key: 'website', label: 'Website' },
    { key: 'created_at', label: 'Created At' },
  ],
  contacts: [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'title', label: 'Title' },
    { key: 'department', label: 'Department' },
    { key: 'created_at', label: 'Created At' },
  ],
  campaigns: [
    { key: 'campaign_name', label: 'Campaign Name' },
    { key: 'campaign_type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'budgeted_cost', label: 'Budget' },
    { key: 'actual_cost', label: 'Actual Cost' },
    { key: 'expected_revenue', label: 'Expected Revenue' },
    { key: 'created_at', label: 'Created At' },
  ],
  activities: [
    { key: 'subject', label: 'Subject' },
    { key: 'activity_type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'related_to_type', label: 'Related Entity' },
    { key: 'created_at', label: 'Created At' },
  ],
  quotas: [
    { key: 'period_type', label: 'Period Type' },
    { key: 'period_year', label: 'Year' },
    { key: 'period_month', label: 'Month' },
    { key: 'period_quarter', label: 'Quarter' },
    { key: 'target_amount', label: 'Target Quota' },
    { key: 'currency', label: 'Currency' },
  ],
};
