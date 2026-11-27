'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import {
  Building2,
  Users,
  Megaphone,
  Briefcase,
  Layers3,
  Search,
  ArrowRight,
  TrendingUp,
  DollarSign,
  UserCheck,
} from 'lucide-react';

export const tableWidgets = [
  { id: 'won-leads', title: 'Won Leads', module: 'leads', icon: Layers3 },
  { id: 'open-leads', title: 'Open Leads (pipeline)', module: 'leads', icon: Layers3 },
  { id: 'accounts', title: 'Accounts Directory', module: 'accounts', icon: Building2 },
  { id: 'contacts', title: 'Key Contacts', module: 'contacts', icon: Users },
  { id: 'campaigns', title: 'Active Campaigns', module: 'campaigns', icon: Megaphone },
  { id: 'won-opportunities', title: 'Closed Won Opportunities', module: 'opportunities', icon: Briefcase },
] as const;

const contract = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.object({ id: z.string() }).catchall(z.unknown())),
  missing: z.array(z.string()),
  has_more: z.boolean(),
  total_count: z.number(),
});

const emptyMessages: Record<string, string> = {
  accounts: 'No accounts found.',
  contacts: 'No contacts found.',
  campaigns: 'No campaigns found.',
  'won-leads': 'No won leads found.',
  'open-leads': 'No open leads found.',
  'won-opportunities': 'No closed won opportunities found.',
};

function formatCurrency(val: unknown): string {
  if (val == null || val === '') return '—';
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}k`;
  return `$${num.toLocaleString()}`;
}

export function DashboardTable({
  id,
  title,
  module,
  dateFrom,
  dateTo,
  register,
}: {
  id: string;
  title: string;
  module: string;
  dateFrom: string | null;
  dateTo: string | null;
  register: (id: string, lines: string[] | null) => void;
}) {
  const { user, permissions, roleIds } = useAuth();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sentinel = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: ['crm', user?.id, [...roleIds, ...permissions].sort().join('|'), 'dashboard', 'table', id, dateFrom, dateTo, search, sort, direction],
    enabled: !!user,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const r = await createClient().rpc('dashboard_home_table_page', {
        widget: id,
        page_number: pageParam,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        search_query: search,
        sort_field: sort,
        sort_direction: direction,
      });
      if (r.error) throw Error('Table unavailable');
      return contract.parse(r.data);
    },
    getNextPageParam: (last, pages) => (last.has_more ? pages.length + 1 : undefined),
  });

  const first = query.data?.pages[0];
  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];

  useEffect(() => {
    const element = sentinel.current;
    if (!element || !query.hasNextPage || query.isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void query.fetchNextPage();
      },
      { rootMargin: '120px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  useEffect(() => {
    const d = query.isFetching || query.isError ? undefined : first;
    register(
      id,
      d
        ? [
            ...(d.missing.length ? ['Some columns are unavailable.'] : []),
            d.columns.join(' | '),
            ...(rows.length ? [] : [emptyMessages[id]]),
            ...rows.map((row) => d.columns.map((c) => String(row[c] ?? '')).join(' | ')),
          ]
        : null
    );
    return () => register(id, null);
  }, [id, first, rows, query.isFetching, query.isError, register]);

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between">
      {/* Search & Counter Pill Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            id={'dashboard-search-' + id}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Filter ${title.toLowerCase()}...`}
            className="w-full pl-8 pr-3 py-1.5 bg-[#f8faff] border border-slate-200/70 rounded-xl text-xs text-slate-700 placeholder-slate-400 outline-none focus:bg-white focus:ring-1 focus:ring-[#4361ee] transition"
          />
        </div>

        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#eef2ff] text-[#4361ee] shrink-0">
          {first?.total_count ?? rows.length} records
        </span>
      </div>

      {query.isError && (
        <p role="alert" className="text-xs text-rose-500 py-4 text-center">
          Records unavailable. <button onClick={() => void query.refetch()} className="underline ml-1">Retry</button>
        </p>
      )}

      {/* Modern Card-Based Item Stream (Replaces ugly raw HTML table) */}
      {first && rows.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-10 font-medium">{emptyMessages[id]}</p>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[340px]">
          {rows.map((row) => {
            const primaryTitle = String(
              row.name ||
              (row.first_name ? `${row.first_name} ${row.last_name || ''}` : '') ||
              row.campaign_name ||
              'Record #' + row.id.slice(0, 6)
            ).trim();

            const secondaryInfo = String(
              row.account_type ||
              row.lead_source ||
              row.campaign_type ||
              row.email ||
              row.title ||
              ''
            );

            const revenueValue = row.annual_revenue || row.amount || row.budget_cost;

            return (
              <Link
                key={row.id}
                href={`/${module}/${row.id}`}
                className="group flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-[#fbfcfd] hover:bg-white hover:border-[#4361ee]/30 hover:shadow-sm transition-all duration-150"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200/60 shadow-2xs text-[#4361ee] group-hover:bg-[#4361ee] group-hover:text-white transition-colors">
                    <span className="text-xs font-bold uppercase">{primaryTitle.slice(0, 2)}</span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 group-hover:text-[#4361ee] truncate transition-colors">
                      {primaryTitle}
                    </p>
                    {secondaryInfo && (
                      <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                        {secondaryInfo}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {revenueValue != null && (
                    <span className="text-xs font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-2xs">
                      {formatCurrency(revenueValue)}
                    </span>
                  )}

                  <div className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-300 group-hover:text-[#4361ee] group-hover:translate-x-0.5 transition-all">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
          <div ref={sentinel} className="h-1" aria-hidden="true" />
          {query.isFetchingNextPage && (
            <p role="status" className="text-center text-[11px] text-slate-400 py-2">
              Loading more records…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
