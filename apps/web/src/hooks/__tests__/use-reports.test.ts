import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => options,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));

import { useReport } from '../use-reports';

function getReportOptions(reportId: string, page: number) {
  return useReport(reportId, page) as unknown as {
    queryKey: readonly unknown[];
    queryFn: () => Promise<{
      summaryMetrics: { label: string; value: string | number }[];
      breakdown: { label: string; count: number }[];
      rows: Record<string, unknown>[];
      pageInfo?: { page: number; pageSize: number; totalCount: number };
    }>;
  };
}

function createLeadQuery(data: Record<string, unknown>[]) {
  const query: {
    select: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    or: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.range.mockResolvedValue({ data, error: null });
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('lead reports', () => {
  it('uses database-wide aggregates and fetches only the requested 100-row page', async () => {
    const query = createLeadQuery([{ id: 'lead-1001', status: 'new' }]);
    mocks.from.mockReturnValue(query);
    mocks.rpc.mockResolvedValue({
      data: {
        total_count: 100000,
        groups: [
          { key: 'new', label: 'New', count: 70000 },
          { key: 'qualified', label: 'Qualified', count: 30000 },
        ],
      },
      error: null,
    });

    const options = getReportOptions('leads-by-status', 11);
    const result = await options.queryFn();

    expect(options.queryKey).toEqual(['report', 'leads-by-status', 11]);
    expect(mocks.rpc).toHaveBeenCalledWith('leads_report_summary', { p_report: 'leads-by-status' });
    expect(query.range).toHaveBeenCalledWith(1000, 1099);
    expect(result.summaryMetrics[0]).toEqual({ label: 'Total Leads', value: 100000 });
    expect(result.breakdown.map(item => item.count)).toEqual([70000, 30000]);
    expect(result.rows).toHaveLength(1);
    expect(result.pageInfo).toEqual({ page: 11, pageSize: 100, totalCount: 100000 });
  });

  it('applies the converted filter and reports an accurate empty total', async () => {
    const query = createLeadQuery([]);
    mocks.from.mockReturnValue(query);
    mocks.rpc.mockResolvedValue({
      data: { total_count: 0, groups: [] },
      error: null,
    });

    const result = await getReportOptions('converted-leads', 1).queryFn();

    expect(query.or).toHaveBeenCalledWith('is_convert.eq.true,status.eq.converted');
    expect(result.summaryMetrics[0]).toEqual({ label: 'Total Converted', value: 0 });
    expect(result.breakdown).toEqual([{ label: 'Converted', count: 0, percent: 0 }]);
    expect(result.pageInfo).toEqual({ page: 1, pageSize: 100, totalCount: 0 });
  });
});
