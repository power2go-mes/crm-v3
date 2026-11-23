'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { leadViewType, leadWindow } from '@/lib/leads/query-contract';
import { useLeads } from '@/hooks/use-leads';

const filtersSchema = z.object({
  search: z.string().max(200), status: z.array(z.string()), source: z.array(z.string()), industry: z.array(z.string()),
  ownerId: z.string().uuid().nullable(), subOwnerId: z.string().uuid().nullable(),
  dateFrom: z.string().nullable(), dateTo: z.string().nullable(),
  minRevenue: z.number().nullable().optional(), maxRevenue: z.number().nullable().optional(),
});
const contextSchema = z.object({ pagination: leadWindow, filters: filtersSchema, viewType: leadViewType });
type Context = z.infer<typeof contextSchema>;
const empty: Context = {
  pagination: { page: 1, pageSize: 25, sortBy: 'created_at', sortOrder: 'desc' },
  filters: { search: '', status: [], source: [], industry: [], ownerId: null, subOwnerId: null, dateFrom: null, dateTo: null },
  viewType: 'all',
};

const key = (userId: string) => `crm:leads:navigation:${userId}`;
export function storeLeadNavigation(userId: string | undefined, leadId: string, context: unknown) {
  if (!userId) return;
  const validated = contextSchema.safeParse(context);
  if (!validated.success) return;
  try { sessionStorage.setItem(key(userId), JSON.stringify({ context: validated.data, token: leadId })); }
  catch { /* Detail remains available when browser storage is disabled. */ }
}

export function leadDetailHref(leadId: string) {
  return `/leads/${leadId}?listContext=${leadId}`;
}

export function useLeadNavigation(userId: string | undefined, leadId: string) {
  const [saved, setSaved] = useState<{context: Context; token: string; page: number; userId: string; leadId: string}>();
  useEffect(() => {
    if (!userId) return;
    try {
      const token = new URLSearchParams(location.search).get('listContext');
      const stored = z.object({ token: z.string().uuid(), context: contextSchema })
        .parse(JSON.parse(sessionStorage.getItem(key(userId)) ?? 'null'));
      if (stored.token !== token) return;
      const requestedPage = Number(new URLSearchParams(location.search).get('listPage') ?? stored.context.pagination.page);
      const parsed = leadWindow.safeParse({ ...stored.context.pagination, page: requestedPage });
      if (parsed.success) setSaved({ ...stored, page: parsed.data.page, userId, leadId });
    } catch { /* Direct links and expired contexts do not have list neighbors. */ }
  }, [userId, leadId]);
  const active = saved?.userId === userId && saved?.leadId === leadId ? saved : undefined;
  const {pagination, filters, viewType} = active?.context ?? empty;
  const page = active?.page ?? pagination.page;
  const current = useLeads({ ...pagination, page }, filters, viewType, Boolean(active));
  const rows = current.data?.leads ?? [];
  const index = rows.findIndex(row => row.id === leadId);
  const prior = useLeads({ ...pagination, page: Math.max(1, page - 1) }, filters, viewType, index === 0 && page > 1);
  const hasLaterPage = index >= 0 && index === rows.length - 1 && page < 100000
    && page * pagination.pageSize < (current.data?.totalCount ?? 0);
  const later = useLeads({ ...pagination, page: Math.min(100000, page + 1) }, filters, viewType, hasLaterPage);
  function href(id: string | undefined, targetPage: number) {
    return active && id ? `/leads/${id}?listContext=${active.token}&listPage=${targetPage}` : undefined;
  }
  return {
    previous: index > 0 ? href(rows[index - 1]?.id, page) : index === 0 && page > 1 ? href(prior.data?.leads.at(-1)?.id, page - 1) : undefined,
    next: index >= 0 && index < rows.length - 1 ? href(rows[index + 1]?.id, page)
      : hasLaterPage ? href(later.data?.leads[0]?.id, page + 1) : undefined,
  };
}
