'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { ReportDefinition, ReportResult, ReportCategory } from '@/types/reports';

export const REPORT_CATALOG: ReportDefinition[] = [
  // Leads
  {
    id: 'leads-by-status',
    title: 'Leads by Status',
    description: 'Distribution of leads across current workflow statuses',
    category: 'leads',
    chartType: 'donut',
  },
  {
    id: 'leads-by-source',
    title: 'Leads by Source',
    description: 'Channel attribution and lead generation origin breakdown',
    category: 'leads',
    chartType: 'bar',
  },
  {
    id: 'converted-leads',
    title: 'Converted Leads Summary',
    description: 'Analysis of leads successfully converted to Accounts and Contacts',
    category: 'leads',
    chartType: 'bar',
  },
  // Opportunities
  {
    id: 'opportunity-pipeline-by-stage',
    title: 'Opportunity Pipeline by Stage',
    description: 'Total pipeline value and deal volume across pipeline stages',
    category: 'opportunities',
    chartType: 'funnel',
  },
  {
    id: 'top-opportunities',
    title: 'Top High-Value Opportunities',
    description: 'Highest value active opportunities sorted by deal amount',
    category: 'opportunities',
    chartType: 'table',
  },
  // Accounts
  {
    id: 'accounts-by-type',
    title: 'Accounts by Classification',
    description: 'Breakdown of accounts by customer, prospect, and partner types',
    category: 'accounts',
    chartType: 'bar',
  },
  {
    id: 'top-accounts',
    title: 'Top Enterprise Accounts',
    description: 'Key client accounts sorted by annual revenue and employee count',
    category: 'accounts',
    chartType: 'table',
  },
  // Activities
  {
    id: 'sales-activity-summary',
    title: 'Sales Activity Engagement',
    description: 'Consolidated volume of tasks, calls, and meetings conducted',
    category: 'activities',
    chartType: 'donut',
  },
];

export function useReport(reportId: string) {
  const supabase = createClient();

  return useQuery<ReportResult>({
    queryKey: ['report', reportId],
    queryFn: async () => {
      switch (reportId) {
        case 'leads-by-status': {
          const { data: leads, error } = await supabase
            .from('leads')
            .select('id, title, first_name, last_name, company_name, email, phone, status, created_at')
            .order('created_at', { ascending: false });

          if (error) throw error;
          const allLeads = leads || [];
          const statusCounts: Record<string, number> = {};

          for (const l of allLeads) {
            const st = (l.status || 'new').toLowerCase();
            statusCounts[st] = (statusCounts[st] || 0) + 1;
          }

          const total = allLeads.length;
          const breakdown = Object.entries(statusCounts).map(([label, count]) => ({
            label: label.charAt(0).toUpperCase() + label.slice(1),
            count,
            percent: total > 0 ? Math.round((count / total) * 100) : 0,
          }));

          return {
            title: 'Leads by Status',
            description: 'Distribution of leads across workflow statuses',
            summaryMetrics: [
              { label: 'Total Leads', value: total },
              { label: 'Active Leads', value: (statusCounts['in_progress'] || 0) + (statusCounts['new'] || 0) },
              { label: 'Qualified', value: statusCounts['qualified'] || 0 },
              { label: 'Converted', value: statusCounts['converted'] || 0 },
            ],
            breakdown,
            columns: [
              { id: 'first_name', header: 'First Name', accessorKey: 'first_name' },
              { id: 'last_name', header: 'Last Name', accessorKey: 'last_name' },
              { id: 'company_name', header: 'Company', accessorKey: 'company_name' },
              { id: 'email', header: 'Email', accessorKey: 'email' },
              { id: 'status', header: 'Status', accessorKey: 'status' },
              { id: 'created_at', header: 'Created', accessorKey: 'created_at' },
            ],
            rows: allLeads,
          };
        }

        case 'leads-by-source': {
          const { data: leads, error } = await supabase
            .from('leads')
            .select('id, first_name, last_name, company_name, email, lead_source, status, created_at');

          if (error) throw error;
          const allLeads = leads || [];
          const sourceCounts: Record<string, number> = {};

          for (const l of allLeads) {
            const src = l.lead_source || 'Unknown';
            sourceCounts[src] = (sourceCounts[src] || 0) + 1;
          }

          const total = allLeads.length;
          const breakdown = Object.entries(sourceCounts).map(([label, count]) => ({
            label,
            count,
            percent: total > 0 ? Math.round((count / total) * 100) : 0,
          }));

          return {
            title: 'Leads by Source',
            description: 'Channel attribution and lead origin analysis',
            summaryMetrics: [
              { label: 'Total Leads', value: total },
              { label: 'Channels Tracked', value: Object.keys(sourceCounts).length },
              { label: 'Top Source', value: breakdown[0]?.label || 'None' },
            ],
            breakdown,
            columns: [
              { id: 'first_name', header: 'First Name', accessorKey: 'first_name' },
              { id: 'last_name', header: 'Last Name', accessorKey: 'last_name' },
              { id: 'company_name', header: 'Company', accessorKey: 'company_name' },
              { id: 'lead_source', header: 'Source', accessorKey: 'lead_source' },
              { id: 'status', header: 'Status', accessorKey: 'status' },
            ],
            rows: allLeads,
          };
        }

        case 'converted-leads': {
          const { data: converted, error } = await supabase
            .from('leads')
            .select('id, first_name, last_name, company_name, email, phone, converted_at, created_at')
            .or('is_convert.eq.true,status.eq.converted')
            .order('created_at', { ascending: false });

          if (error) throw error;
          const rows = converted || [];

          return {
            title: 'Converted Leads Summary',
            description: 'Record of leads converted into customers and accounts',
            summaryMetrics: [
              { label: 'Total Converted', value: rows.length },
              { label: 'Report Status', value: 'Live' },
            ],
            breakdown: [
              { label: 'Converted', count: rows.length, percent: 100 },
            ],
            columns: [
              { id: 'first_name', header: 'First Name', accessorKey: 'first_name' },
              { id: 'last_name', header: 'Last Name', accessorKey: 'last_name' },
              { id: 'company_name', header: 'Company', accessorKey: 'company_name' },
              { id: 'email', header: 'Email', accessorKey: 'email' },
              { id: 'created_at', header: 'Created', accessorKey: 'created_at' },
            ],
            rows,
          };
        }

        case 'opportunity-pipeline-by-stage': {
          const { data: opps, error } = await (supabase as any)
            .from('opportunities_readable')
            .select('id, name, stage, amount, probability, close_date, account:accounts(name), created_at')
            .order('amount', { ascending: false });

          if (error) throw error;
          const allOpps = opps || [];
          const stageAgg: Record<string, { count: number; totalValue: number }> = {};
          let totalPipelineValue = 0;

          for (const op of allOpps) {
            const st = op.stage || 'Prospecting';
            const val = Number(op.amount || 0);
            totalPipelineValue += val;
            if (!stageAgg[st]) stageAgg[st] = { count: 0, totalValue: 0 };
            stageAgg[st].count += 1;
            stageAgg[st].totalValue += val;
          }

          const breakdown = Object.entries(stageAgg).map(([st, agg]) => ({
            label: st,
            count: agg.count,
            value: agg.totalValue,
            percent: totalPipelineValue > 0 ? Math.round((agg.totalValue / totalPipelineValue) * 100) : 0,
          }));

          const flattenedRows = allOpps.map((op: any) => ({
            id: op.id,
            name: op.name,
            account_name: op.account?.name || '—',
            stage: op.stage,
            amount: op.amount ? `$${Number(op.amount).toLocaleString()}` : '$0',
            probability: `${op.probability || 0}%`,
            close_date: op.close_date,
          }));

          return {
            title: 'Opportunity Pipeline by Stage',
            description: 'Pipeline valuation and opportunity counts grouped by pipeline stage',
            summaryMetrics: [
              { label: 'Total Pipeline', value: `$${totalPipelineValue.toLocaleString()}` },
              { label: 'Active Deals', value: allOpps.length },
              {
                label: 'Avg Deal Size',
                value: allOpps.length > 0 ? `$${Math.round(totalPipelineValue / allOpps.length).toLocaleString()}` : '$0',
              },
            ],
            breakdown,
            columns: [
              { id: 'name', header: 'Opportunity Name', accessorKey: 'name' },
              { id: 'account_name', header: 'Account', accessorKey: 'account_name' },
              { id: 'stage', header: 'Stage', accessorKey: 'stage' },
              { id: 'amount', header: 'Amount', accessorKey: 'amount' },
              { id: 'probability', header: 'Probability', accessorKey: 'probability' },
              { id: 'close_date', header: 'Close Date', accessorKey: 'close_date' },
            ],
            rows: flattenedRows,
          };
        }

        case 'top-opportunities': {
          const { data: opps, error } = await (supabase as any)
            .from('opportunities_readable')
            .select('id, name, stage, amount, probability, close_date, account:accounts(name)')
            .order('amount', { ascending: false })
            .limit(50);

          if (error) throw error;
          const rows = (opps || []).map((op: any) => ({
            id: op.id,
            name: op.name,
            account_name: op.account?.name || '—',
            stage: op.stage,
            amount: op.amount ? `$${Number(op.amount).toLocaleString()}` : '$0',
            probability: `${op.probability || 0}%`,
            close_date: op.close_date,
          }));

          const totalValue = (opps || []).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);

          return {
            title: 'Top High-Value Opportunities',
            description: 'Ranked list of top enterprise opportunities',
            summaryMetrics: [
              { label: 'Top 50 Total', value: `$${totalValue.toLocaleString()}` },
              { label: 'Opportunities Count', value: rows.length },
            ],
            breakdown: [],
            columns: [
              { id: 'name', header: 'Opportunity Name', accessorKey: 'name' },
              { id: 'account_name', header: 'Account', accessorKey: 'account_name' },
              { id: 'stage', header: 'Stage', accessorKey: 'stage' },
              { id: 'amount', header: 'Amount', accessorKey: 'amount' },
              { id: 'probability', header: 'Probability', accessorKey: 'probability' },
              { id: 'close_date', header: 'Close Date', accessorKey: 'close_date' },
            ],
            rows,
          };
        }

        case 'accounts-by-type': {
          const { data: accounts, error } = await (supabase as any)
            .from('accounts_readable')
            .select('id, name, account_type, industry, annual_revenue, contact_number, website');

          if (error) throw error;
          const allAccounts = accounts || [];
          const typeCounts: Record<string, number> = {};

          for (const acc of allAccounts) {
            const typ = acc.account_type || 'Customer';
            typeCounts[typ] = (typeCounts[typ] || 0) + 1;
          }

          const total = allAccounts.length;
          const breakdown = Object.entries(typeCounts).map(([label, count]) => ({
            label,
            count,
            percent: total > 0 ? Math.round((count / total) * 100) : 0,
          }));

          return {
            title: 'Accounts by Classification',
            description: 'Distribution of organizational accounts across account categories',
            summaryMetrics: [
              { label: 'Total Accounts', value: total },
              { label: 'Customer Accounts', value: typeCounts['Customer'] || 0 },
              { label: 'Prospects', value: typeCounts['Prospect'] || 0 },
              { label: 'Partners', value: typeCounts['Partner'] || 0 },
            ],
            breakdown,
            columns: [
              { id: 'name', header: 'Account Name', accessorKey: 'name' },
              { id: 'account_type', header: 'Type', accessorKey: 'account_type' },
              { id: 'industry', header: 'Industry', accessorKey: 'industry' },
              { id: 'contact_number', header: 'Phone', accessorKey: 'contact_number' },
              { id: 'website', header: 'Website', accessorKey: 'website' },
            ],
            rows: allAccounts,
          };
        }

        case 'top-accounts': {
          const { data: accounts, error } = await (supabase as any)
            .from('accounts_readable')
            .select('id, name, account_type, industry, annual_revenue, contact_number')
            .order('annual_revenue', { ascending: false })
            .limit(50);

          if (error) throw error;
          const rows = (accounts || []).map((acc: any) => ({
            id: acc.id,
            name: acc.name,
            account_type: acc.account_type || '—',
            industry: acc.industry || '—',
            annual_revenue: acc.annual_revenue ? `$${Number(acc.annual_revenue).toLocaleString()}` : '$0',
            contact_number: acc.contact_number || '—',
          }));

          return {
            title: 'Top Enterprise Accounts',
            description: 'Highest value business entities ordered by declared annual revenue',
            summaryMetrics: [
              { label: 'Tracked Top Accounts', value: rows.length },
              { label: 'Tier', value: 'Enterprise' },
            ],
            breakdown: [],
            columns: [
              { id: 'name', header: 'Account Name', accessorKey: 'name' },
              { id: 'account_type', header: 'Type', accessorKey: 'account_type' },
              { id: 'industry', header: 'Industry', accessorKey: 'industry' },
              { id: 'annual_revenue', header: 'Annual Revenue', accessorKey: 'annual_revenue' },
              { id: 'contact_number', header: 'Phone', accessorKey: 'contact_number' },
            ],
            rows,
          };
        }

        case 'sales-activity-summary': {
          const { data: activities, error } = await supabase
            .from('activities')
            .select('id, activity_type, subject, status, priority, due_date, created_at')
            .order('created_at', { ascending: false })
            .limit(100);

          if (error) throw error;
          const allActs = activities || [];
          const typeCounts: Record<string, number> = {};

          for (const a of allActs) {
            const typ = a.activity_type || 'other';
            typeCounts[typ] = (typeCounts[typ] || 0) + 1;
          }

          const total = allActs.length;
          const breakdown = Object.entries(typeCounts).map(([label, count]) => ({
            label: label.charAt(0).toUpperCase() + label.slice(1),
            count,
            percent: total > 0 ? Math.round((count / total) * 100) : 0,
          }));

          return {
            title: 'Sales Activity Engagement',
            description: 'Summary of tasks, calls, and meetings logged across the sales force',
            summaryMetrics: [
              { label: 'Total Activities', value: total },
              { label: 'Tasks', value: typeCounts['task'] || 0 },
              { label: 'Calls', value: typeCounts['log_call'] || 0 },
              { label: 'Meetings', value: typeCounts['meeting'] || 0 },
            ],
            breakdown,
            columns: [
              { id: 'activity_type', header: 'Type', accessorKey: 'activity_type' },
              { id: 'subject', header: 'Subject', accessorKey: 'subject' },
              { id: 'status', header: 'Status', accessorKey: 'status' },
              { id: 'priority', header: 'Priority', accessorKey: 'priority' },
              { id: 'due_date', header: 'Due Date', accessorKey: 'due_date' },
            ],
            rows: allActs,
          };
        }

        default:
          throw new Error(`Report not recognized: ${reportId}`);
      }
    },
  });
}

export function exportReportToCSV(result: ReportResult) {
  if (!result || !result.rows.length) return;

  const headers = result.columns.map((c) => c.header);
  const keys = result.columns.map((c) => c.accessorKey);

  const csvRows: string[] = [];
  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

  for (const row of result.rows) {
    const values = keys.map((k) => {
      const val = row[k] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const filename = `${result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
