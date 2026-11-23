import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { fieldDefinition, validateCustomValues, resolveFieldAccess, displayCustomValue } from '../src/fields';
import { resolveForm, validateFormSubmission, type FormField } from '../src/forms';
import { validateQueryState, serializeQuery, parseQuery, viewOrder, resolvePinnedView, type FilterField } from '../src/views';
import { createSharedServices, groupHistoryByDay, SharedServiceError, type SharedTransport } from '../src/services';

const id = '00000000-0000-4000-8000-000000000001';
const field = (type = 'small_text', extra = {}) => fieldDefinition.parse({
  id, module: 'contacts', key: 'custom', label: 'Custom', type, ...extra,
});
describe('custom fields', () => {
  it.each([
    ['small_text', 'hello'], ['large_text', 'long\ntext'], ['number', '1234567890123456.1234'],
    ['choice', ['A', 'B']], ['single_choice', 'A'], ['date', '2024-02-29'],
    ['datetime', '2026-11-16T12:00:00+05:00'],
  ])('validates %s', (type, value) => {
    const definition = field(String(type), { choices: ['A', 'B'], required: true });
    expect(validateCustomValues([definition], { custom: value }, { custom: 'write' }, 'create').custom).toEqual(value);
  });
  it.each(['<script>', '', 'A>B'])('rejects invalid labels %s', label => {
    expect(() => field('small_text', { label })).toThrow();
  });
  it.each([
    ['number', '1e4'], ['number', '1.23456'], ['number', '12345678901234567'],
    ['date', '2025-02-29'], ['datetime', '2026-11-16T12:00:00'],
    ['choice', ['C']], ['choice', ['A', 'A']], ['single_choice', 'C'],
  ])('rejects invalid %s values', (type, value) => {
    expect(() => validateCustomValues([field(type, { choices: ['A'] })],
      { custom: value }, { custom: 'write' }, 'edit')).toThrow();
  });
  it('enforces requiredness on create and duplicate, but preserves omitted edit fields', () => {
    const f = field('small_text', { required: true });
    expect(() => validateCustomValues([f], {}, { custom: 'write' }, 'create')).toThrow();
    expect(() => validateCustomValues([f], {}, { custom: 'write' }, 'duplicate')).toThrow();
    expect(validateCustomValues([f], {}, { custom: 'write' }, 'edit')).toEqual({});
  });
  it.each(['hidden', 'readonly'] as const)('rejects %s payload fields', access => {
    expect(() => validateCustomValues([field()], { custom: 'attack' }, { custom: access }, 'edit')).toThrow();
  });
  it('rejects unknown fields and explicit clears of required fields', () => {
    expect(() => validateCustomValues([], { surprise: 1 }, {}, 'edit')).toThrow();
    expect(() => validateCustomValues([field('choice', { required: true, choices: ['A'] })],
      { custom: [] }, { custom: 'write' }, 'edit')).toThrow();
  });
  it('resolves denial first across roles and renders multiple choice as plain text', () => {
    expect(resolveFieldAccess([{ visible: false, editable: true }], true)).toBe('hidden');
    expect(resolveFieldAccess([{ visible: true, editable: false }], true)).toBe('readonly');
    expect(resolveFieldAccess([], false)).toBe('readonly');
    expect(displayCustomValue(field('choice', { choices: ['A', 'B'] }), ['A', 'B'])).toBe('A, B');
  });
});
const fields: FormField[] = [
  { key: 'name', label: 'Name', schema: z.string().min(1), required: true, access: 'write', step: 1 },
  { key: 'note', label: 'Note', schema: z.string(), required: false, access: 'write', group: 'Other', step: 2 },
  { key: 'secret', label: 'Secret', schema: z.string(), required: false, access: 'hidden' },
];
describe('form metadata', () => {
  it('custom layout cannot hide mandatory fields or expose permission-hidden fields', () => {
    const result = resolveForm(fields, 'create', {}, [
      { field: 'note', sequence: 0, visible: true },
      { field: 'name', sequence: 1, visible: false },
      { field: 'secret', sequence: 2, visible: true },
    ]);
    expect(result.map(f => f.key)).toEqual(['note', 'name']);
  });
  it('default mode preserves ordering/groups/steps; detail is readonly', () => {
    expect(resolveForm(fields, 'edit').map(f => f.key)).toEqual(['name', 'note']);
    expect(resolveForm(fields, 'detail').every(f => f.access === 'readonly')).toBe(true);
    expect(resolveForm(fields, 'create')[1].step).toBe(2);
  });
  it('rejects nonrelaxable overrides and unknown layout fields', () => {
    expect(() => resolveForm(fields, 'create', { name: false })).toThrow();
    expect(() => resolveForm(fields, 'create', {}, [{ field: 'wrong', visible: true, sequence: 0 }])).toThrow();
  });
  it('validates requiredness/defaults and strips no readonly payload silently', async () => {
    await expect(validateFormSubmission(fields, {}, 'create', async () => true)).rejects.toThrow('Required');
    await expect(validateFormSubmission(fields, { secret: 'attack' }, 'edit', async () => true)).rejects.toThrow();
    const withDefault = [{ ...fields[0], defaultValue: 'Default' }];
    expect(await validateFormSubmission(withDefault, {}, 'create', async () => true)).toEqual({ name: 'Default' });
    expect(await validateFormSubmission(withDefault, {}, 'edit', async () => true)).toEqual({});
  });
  it('checks related records using trusted scope adapter', async () => {
    const relation = [{ ...fields[0], schema: z.string().uuid(), relation: { module: 'accounts', multiple: false } }];
    await expect(validateFormSubmission(relation, { name: id }, 'edit', async () => false)).rejects.toThrow('unavailable');
  });
});
const columns: Record<string, FilterField> = {
  name: { kind: 'text', operators: ['exact', 'icontains'], visible: true, filterable: true, sortable: true },
  amount: { kind: 'number', operators: ['between', 'gt'], visible: true, filterable: true, sortable: true },
  secret: { kind: 'text', operators: ['exact'], visible: false, filterable: false, sortable: false },
};
const defaults = { pageSize: 20, columns: ['name'] };
describe('views and query state', () => {
  it('retains module defaults, ordering and AND/OR through stable roundtrip', () => {
    const state = validateQueryState({ version: 1, logic: 'OR', columns: ['amount', 'name'],
      filters: [{ field: 'amount', operator: 'between', value: [1, 10] }] }, columns, defaults);
    expect(state.pageSize).toBe(20);
    expect(parseQuery(serializeQuery(state))).toEqual(state);
    expect(serializeQuery(parseQuery(serializeQuery(state)))).toBe(serializeQuery(state));
  });
  it.each([
    { columns: ['secret'] }, { columns: ['name', 'name'] },
    { sort: [{ field: 'name; DROP TABLE leads', direction: 'asc' }] },
    { filters: [{ field: 'secret', operator: 'exact', value: 'x' }] },
    { filters: [{ field: 'amount', operator: 'icontains', value: 'x' }] },
    { filters: [{ field: 'amount', operator: 'between', value: [10, 1] }] },
    { pageSize: 10000 },
  ])('rejects unavailable/injected query input %j', extra => {
    expect(() => validateQueryState({ version: 1, ...extra }, columns, defaults)).toThrow();
  });
  it('does not interpret filter values as SQL', () => {
    const state = validateQueryState({ version: 1,
      filters: [{ field: 'name', operator: 'exact', value: "x');drop table leads;--" }] }, columns, defaults);
    expect(state.filters[0].value).toContain('drop table');
    expect(viewOrder('recently_modified')).toEqual({ field: 'updated_at', direction: 'desc' });
  });
  it('rejects ambiguous and oversized serialized states', () => {
    expect(() => parseQuery('state={}&state={}')).toThrow();
    expect(() => parseQuery('x'.repeat(32769))).toThrow();
  });
  it('uses explicit view before pin and drops unavailable saved-list pins', () => {
    expect(resolvePinnedView('all', 'recently_created', ['all', 'recently_created'])).toBe('all');
    expect(resolvePinnedView(undefined, 'saved_list_deleted', ['all'])).toBe('all');
    expect(resolvePinnedView(undefined, 'recently_created', ['all', 'recently_created'])).toBe('recently_created');
  });
});
describe('service contracts and history', () => {
  it('propagates sanitized database failures without leaking server details', async () => {
    const transport: SharedTransport = { call: async () => ({ data: null, error: { code: '42501', message: 'secret detail' } }) };
    const promise = createSharedServices(transport).values('contacts', id);
    await expect(promise).rejects.toBeInstanceOf(SharedServiceError);
    await expect(promise).rejects.not.toThrow('secret detail');
  });
  it('persists custom values through validated metadata without actor IDs', async () => {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const transport: SharedTransport = { call: async (name, args) => {
      calls.push({ name, args });
      return { error: null, data: name.endsWith('metadata') ?
        { fields: [{ ...field(), access: 'write', is_custom: true, relaxable: true }], layout: null } : null };
    } };
    await createSharedServices(transport).saveValues('contacts', id, { custom: 'valid' }, 'edit');
    expect(calls[1]).toEqual({ name: 'crm_shared_save_values',
      args: { m: 'contacts', rid: id, payload: { custom: 'valid' }, complete: false } });
  });
  it('groups history using user timezone and hides empty update events', () => {
    const event = { id, module: 'contacts', record_id: id, action: 'create' as const,
      actor_id: null, occurred_at: '2026-11-16T23:00:00Z', changes: [] };
    const result = groupHistoryByDay([event, { ...event, action: 'update' }], 'Asia/Karachi');
    expect(result).toHaveLength(1);
    expect(result[0].day).toBe('2026-11-17');
    expect(result[0].entries).toHaveLength(1);
  });
  it('sorts history chronologically across different UTC offsets', () => {
    const event = { id, module: 'contacts', record_id: id, action: 'create' as const,
      actor_id: null, occurred_at: '2026-11-16T23:00:00+05:00', changes: [] };
    const later = { ...event, id: '00000000-0000-4000-8000-000000000002', occurred_at: '2026-11-16T20:00:00Z' };
    expect(groupHistoryByDay([event, later], 'UTC')[0].entries[0].id).toBe(later.id);
  });
});
