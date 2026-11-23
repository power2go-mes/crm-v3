import { z } from 'zod';
import { fieldDefinition, moduleKey, validateCustomValues, type FieldAccess } from './fields';
import { layoutSchema } from './forms';
import { queryStateSchema, validateQueryState, type FilterField } from './views';

/** Supply a cookie/session JWT Supabase client. Never use a service-role client. */
export interface SharedTransport {
  call(name: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown; error: { message: string; code?: string } | null;
  }>;
}
export class SharedServiceError extends Error {
  constructor(readonly operation: string, readonly code: string) {
    super('Shared CRM operation failed: ' + operation);
  }
}
const metadataSchema = z.object({
  fields: z.array(fieldDefinition.innerType().extend({
    is_custom: z.boolean(), relaxable: z.boolean(),
    access: z.enum(['hidden', 'readonly', 'write']),
  }).strict()),
  layout: layoutSchema.nullable(),
});
// FieldDefinition refinement is applied separately so extended metadata stays validated.
export type SharedMetadata = z.infer<typeof metadataSchema>;
const recordId = z.string().min(1).max(200);
export function createSharedServices(transport: SharedTransport) {
  async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    let response: Awaited<ReturnType<SharedTransport['call']>>;
    try { response = await transport.call('crm_shared_' + name, args); }
    catch { throw new SharedServiceError(name, 'TRANSPORT_ERROR'); }
    if (response.error) throw new SharedServiceError(name, response.error.code ?? 'DATABASE_ERROR');
    return response.data;
  }
  async function metadata(module: string): Promise<SharedMetadata> {
    const data = metadataSchema.parse(await rpc('metadata', { m: moduleKey.parse(module) }));
    for (const field of data.fields) {
      const { access: _access, is_custom: _custom, relaxable: _relaxable, ...definition } = field;
      fieldDefinition.parse(definition);
    }
    return data;
  }
  return {
    metadata,
    async values(module: string, id: string) {
      return z.record(z.unknown()).parse(await rpc('values', { m: moduleKey.parse(module), rid: recordId.parse(id) }));
    },
    async saveValues(module: string, id: string, payload: unknown, mode: 'create' | 'edit' | 'duplicate') {
      const data = await metadata(module);
      const fields = data.fields.filter(f => f.is_custom).map(f => {
        const { access: _access, is_custom: _custom, relaxable: _relaxable, ...definition } = f;
        return fieldDefinition.parse(definition);
      });
      const access: Record<string, FieldAccess> = Object.fromEntries(data.fields.map(f => [f.key, f.access]));
      const values = validateCustomValues(fields, payload, access, mode);
      await rpc('save_values', { m: moduleKey.parse(module), rid: recordId.parse(id),
        payload: values, complete: mode !== 'edit' });
    },
    async saveDefinition(input: unknown) {
      const definition = fieldDefinition.parse(input);
      return z.string().uuid().parse(await rpc('put_definition', { payload: definition }));
    },
    async deleteDefinition(id: string) {
      await rpc('delete_definition', { fid: z.string().uuid().parse(id) });
    },
    async configureForm(module: string, layout: unknown, requirements: unknown) {
      await rpc('configure_form', { m: moduleKey.parse(module), layout: layoutSchema.parse(layout),
        requirements: z.record(z.boolean()).parse(requirements) });
    },
    async personalization(module: string) {
      const result = z.object({
        views: z.array(z.object({ id: z.string().uuid(), user_id: z.string().uuid(),
          module: moduleKey, name: z.string(), is_public: z.boolean(), state: queryStateSchema })),
        preferences: z.array(z.object({ module: moduleKey, context: z.string(), url_name: z.string(),
          state: z.record(z.unknown()) })),
        recent: z.array(z.object({ record_id: recordId, viewed_at: z.string() })),
      }).parse(await rpc('personalization', { m: moduleKey.parse(module) }));
      // Loading configuration does not authorize it: revalidate against CURRENT field permissions before use.
      return result;
    },
    async saveView(
      module: string, name: string, state: unknown, fields: Readonly<Record<string, FilterField>>,
      defaults: { pageSize: number; columns: readonly string[] }, options: { id?: string; public?: boolean } = {},
    ) {
      const validated = validateQueryState(state, fields, defaults);
      return z.string().uuid().parse(await rpc('save_view', { m: moduleKey.parse(module),
        n: z.string().trim().min(1).max(100).parse(name), s: validated,
        shared: options.public ?? false, vid: options.id ? z.string().uuid().parse(options.id) : null }));
    },
    async deleteView(id: string) { await rpc('delete_view', { vid: z.string().uuid().parse(id) }); },
    async preferences(module: string, context: string, urlName: string, input: unknown) {
      const state = z.object({
        pinnedView: z.string().min(1).max(100).nullable().optional(),
        columns: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,62}$/)).max(100).optional(),
        removedCustomFields: z.array(z.string()).max(100).optional(),
        formLayout: z.enum(['single', 'multi', 'custom']).optional(),
      }).strict().parse(input);
      await rpc('preferences', { m: moduleKey.parse(module), ctx: z.string().max(200).parse(context),
        url: z.string().max(200).parse(urlName), s: state });
    },
    async resetPreferences(module: string, context: string, urlName: string) {
      await rpc('preferences', { m: moduleKey.parse(module), ctx: z.string().max(200).parse(context),
        url: z.string().max(200).parse(urlName), s: {} });
    },
    async touchRecord(module: string, id: string) {
      await rpc('touch_record', { m: moduleKey.parse(module), rid: recordId.parse(id) });
    },
    async history(module: string, id: string, limit = 50, offset = 0) {
      return historySchema.parse(await rpc('history', { m: moduleKey.parse(module), rid: recordId.parse(id),
        lim: z.number().int().min(1).max(100).parse(limit),
        off: z.number().int().min(0).max(100000).parse(offset) }));
    },
  };
}
export const historySchema = z.array(z.object({
  id: z.string().uuid(), module: moduleKey, record_id: recordId,
  action: z.enum(['create', 'update', 'delete']), actor_id: z.string().uuid().nullable(),
  occurred_at: z.string().datetime({ offset: true }),
  changes: z.array(z.object({ field: z.string(), label: z.string(), old: z.unknown(), new: z.unknown() })),
}));
export type HistoryEvent = z.infer<typeof historySchema>[number];
export function groupHistoryByDay(events: readonly HistoryEvent[], timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const groups = new Map<string, HistoryEvent[]>();
  for (const event of [...events].sort((a, b) =>
    new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime() || b.id.localeCompare(a.id))) {
    if (event.action === 'update' && !event.changes.length) continue;
    const day = formatter.format(new Date(event.occurred_at));
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }
  return [...groups].map(([day, entries]) => ({ day, entries }));
}
