import { z } from 'zod';
import { fieldKey, isoDate, isoDateTime } from './fields';

export const operator = z.enum(['exact', 'ne', 'icontains', 'istartswith', 'iendswith',
  'gt', 'gte', 'lt', 'lte', 'between', 'isnull', 'isnotnull',
  'today', 'yesterday', 'this_week', 'this_month']);
export type FilterField = {
  kind: 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'choice' | 'uuid';
  operators: readonly z.infer<typeof operator>[]; choices?: readonly string[];
  visible: boolean; filterable: boolean; sortable: boolean;
};
export const queryStateSchema = z.object({
  version: z.literal(1), view: z.string().min(1).max(100).default('all'),
  layout: z.enum(['list', 'kanban', 'card', 'split_view', 'group_by', 'chart', 'timeline']).default('list'),
  search: z.string().max(200).default(''),
  logic: z.enum(['AND', 'OR']).default('AND'),
  filters: z.array(z.object({ field: fieldKey, operator, value: z.unknown() }).strict()).max(50).default([]),
  sort: z.array(z.object({ field: fieldKey, direction: z.enum(['asc', 'desc']) }).strict()).max(5).default([]),
  columns: z.array(fieldKey).max(100).default([]),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).optional(),
}).strict();
export type QueryState = z.infer<typeof queryStateSchema>;
function filterValue(field: FilterField): z.ZodTypeAny {
  switch (field.kind) {
    case 'number': return z.number().finite();
    case 'date': return isoDate;
    case 'datetime': return isoDateTime;
    case 'boolean': return z.boolean();
    case 'uuid': return z.string().uuid();
    case 'choice': return z.string().refine(v => field.choices?.includes(v) === true);
    default: return z.string().max(500);
  }
}
export function validateQueryState(
  raw: unknown, fields: Readonly<Record<string, FilterField>>,
  defaults: { pageSize: number; columns: readonly string[] },
): QueryState & { pageSize: number } {
  const state = queryStateSchema.parse(raw);
  const visible = (key: string) => Object.hasOwn(fields, key) && fields[key].visible;
  const columns = state.columns.length ? state.columns : [...defaults.columns];
  if (new Set(columns).size !== columns.length || columns.some(k => !visible(k))) {
    throw new Error('Unavailable or duplicate column');
  }
  if (state.sort.some(s => !visible(s.field) || !fields[s.field].sortable) ||
    new Set(state.sort.map(s => s.field)).size !== state.sort.length) throw new Error('Invalid sort');
  for (const f of state.filters) {
    const field = fields[f.field];
    if (!visible(f.field) || !field.filterable || !field.operators.includes(f.operator)) {
      throw new Error('Invalid filter');
    }
    if (['isnull', 'isnotnull', 'today', 'yesterday', 'this_week', 'this_month'].includes(f.operator)) {
      if (f.value !== null && f.value !== undefined && f.value !== '') throw new Error('Operator takes no value');
      if (['today', 'yesterday', 'this_week', 'this_month'].includes(f.operator) &&
        !['date', 'datetime'].includes(field.kind)) throw new Error('Expected date field');
    }
    else if (f.operator === 'between') {
      const pair: unknown[] = z.array(filterValue(field)).length(2).parse(f.value);
      if ((pair[0] as string | number) > (pair[1] as string | number)) throw new Error('Reversed range');
    }
    else filterValue(field).parse(f.value);
  }
  return { ...state, columns, pageSize: z.number().int().min(1).max(100).parse(state.pageSize ?? defaults.pageSize) };
}
export function serializeQuery(state: QueryState): string {
  const parsed = queryStateSchema.parse(state);
  return new URLSearchParams({ state: JSON.stringify(parsed) }).toString();
}
export function parseQuery(query: string): QueryState {
  if (query.length > 32768) throw new Error('Query state too large');
  const params = new URLSearchParams(query);
  if (params.getAll('state').length !== 1) throw new Error('Expected one state parameter');
  return queryStateSchema.parse(JSON.parse(params.get('state')!));
}
/** An AST, never SQL/PostgREST strings. Server adapters compile allowlisted nodes. */
export function viewOrder(view: string): { field: string; direction: 'asc' | 'desc' } | undefined {
  if (view === 'recently_created') return { field: 'created_at', direction: 'desc' };
  if (view === 'recently_modified') return { field: 'updated_at', direction: 'desc' };
  if (view === 'oldest_first') return { field: 'created_at', direction: 'asc' };
  return undefined;
}
/** Explicit navigation wins; a deleted/private saved-list pin falls back safely. */
export function resolvePinnedView(
  requested: string | undefined, pinned: string | null | undefined,
  availableViews: readonly string[], fallback = 'all',
): string {
  if (!availableViews.includes(fallback)) throw new Error('Unavailable fallback view');
  for (const candidate of [requested, pinned]) {
    if (candidate && availableViews.includes(candidate)) return candidate;
  }
  return fallback;
}
