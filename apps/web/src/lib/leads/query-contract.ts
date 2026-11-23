import { z } from 'zod';
export const leadSortField = z.enum(['title', 'first_name', 'last_name', 'email', 'status',
  'lead_source', 'industry', 'annual_revenue', 'created_at', 'updated_at', 'company_name']);
export const leadViewType = z.enum(['all', 'recently_viewed', 'recently_created',
  'recently_modified', 'oldest_first', 'converted']);
export function leadQueryKey(userId: string | null | undefined, resource: string, ...state: unknown[]) {
  return ['crm', userId ?? 'unauthenticated', 'leads', resource, ...state] as const;
}
export function leadDeleteError(error: unknown) {
  const message = z.object({ code: z.string(), message: z.string() }).safeParse(error);
  if (message.success && message.data.code === '23503'
    && message.data.message === "Remove this Lead's attachments before deleting it.") {
    return 'Remove the Lead attachments before deleting the record.';
  }
  return 'Lead deletion failed. Check your access and any linked records.';
}
/** PostgREST grammar is separate from URL encoding: quote and escape the literal. */
export function leadSearchExpression(value: string): string {
  const search = z.string().trim().max(200).parse(value);
  const pattern = '%' + search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_') + '%';
  const quoted = '"' + pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  return ['title', 'first_name', 'last_name', 'company_name', 'email', 'phone']
    .map(field => field + '.ilike.' + quoted).join(',');
}
export const leadWindow = z.object({
  page: z.number().int().min(1).max(100000), pageSize: z.union([z.literal(10), z.literal(20),
    z.literal(25), z.literal(50), z.literal(100)]),
  sortBy: leadSortField, sortOrder: z.enum(['asc', 'desc']),
});
