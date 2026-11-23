import { z } from 'zod';

export const moduleKey = z.string().regex(/^[a-z][a-z0-9_]{0,62}$/);
export const fieldKey = z.string().regex(/^[a-z][a-z0-9_]{0,62}$/);
export const fieldType = z.enum([
  'small_text', 'large_text', 'number', 'choice', 'single_choice', 'date', 'datetime',
]);
export const fieldDefinition = z.object({
  id: z.string().uuid(),
  module: moduleKey,
  key: fieldKey,
  label: z.string().trim().min(1).max(255).refine(v => !/[<>]/.test(v), 'HTML is not allowed'),
  type: fieldType,
  required: z.boolean().default(false),
  order: z.number().int().nonnegative().default(0),
  choices: z.array(z.string().trim().min(1).max(255)).max(200).default([]),
}).strict().superRefine((f, ctx) => {
  if (new Set(f.choices).size !== f.choices.length) {
    ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Duplicate choices' });
  }
  if ((f.type === 'choice' || f.type === 'single_choice') && !f.choices.length) {
    ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Choices are required' });
  }
});
export type CustomField = z.infer<typeof fieldDefinition>;
export type FieldAccess = 'hidden' | 'readonly' | 'write';
export interface FieldRule { visible: boolean; editable: boolean }
/** Explicit denial wins across roles; no caller-supplied role identifiers. */
export function resolveFieldAccess(rules: readonly FieldRule[], canUpdate: boolean): FieldAccess {
  if (rules.some(r => !r.visible)) return 'hidden';
  return canUpdate && rules.every(r => r.editable) ? 'write' : 'readonly';
}
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, 'Invalid calendar date');
export const isoDateTime = z.string().datetime({ offset: true })
  .refine(v => isoDate.safeParse(v.slice(0, 10)).success, 'Invalid calendar date');
const decimal = z.union([z.string().regex(/^-?\d{1,16}(?:\.\d{1,4})?$/), z.number().finite()])
  .transform(String).refine(v => /^-?\d{1,16}(?:\.\d{1,4})?$/.test(v), 'Expected decimal(20,4)');

export function valueSchema(field: CustomField): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  switch (field.type) {
    case 'small_text': schema = z.string().max(255); break;
    case 'large_text': schema = z.string().max(32000); break;
    case 'number': schema = decimal; break;
    case 'choice': schema = z.array(z.string().refine(v => field.choices.includes(v), 'Invalid choice'))
      .max(200).refine(v => new Set(v).size === v.length, 'Duplicate selection'); break;
    case 'single_choice': schema = z.string().refine(v => field.choices.includes(v), 'Invalid choice'); break;
    case 'date': schema = isoDate; break;
    case 'datetime': schema = isoDateTime; break;
  }
  if (!field.required) return z.union([z.null(), z.literal(''), schema]);
  return schema.refine(v => v !== '' && v !== null && (!Array.isArray(v) || v.length > 0), 'Required');
}
/** Patch semantics: omitted edit fields stay unchanged; hidden/readonly writes fail. */
export function validateCustomValues(
  definitions: readonly CustomField[], payload: unknown,
  access: Readonly<Record<string, FieldAccess>>, mode: 'create' | 'edit' | 'duplicate',
) {
  const input = z.record(z.unknown()).parse(payload);
  const known = new Map(definitions.map(d => [d.key, fieldDefinition.parse(d)]));
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const def = known.get(key);
    if (!def || access[key] !== 'write') throw new Error('Field is unavailable for writing: ' + key);
    result[key] = valueSchema(def).parse(value);
  }
  if (mode !== 'edit') for (const def of definitions) {
    if (def.required && access[def.key] === 'write' && !(def.key in input)) {
      throw new Error('Required field: ' + def.key);
    }
  }
  return result;
}
/** React consumers render this as text, never dangerouslySetInnerHTML. */
export function displayCustomValue(field: CustomField, value: unknown, timeZone = 'UTC'): string {
  if (value === null || value === undefined || value === '') return '';
  const parsed: unknown = valueSchema({ ...field, required: false }).parse(value);
  if (Array.isArray(parsed)) return parsed.join(', ');
  if (field.type === 'datetime') return new Intl.DateTimeFormat('en-GB', {
    timeZone, dateStyle: 'short', timeStyle: 'medium',
  }).format(new Date(String(parsed)));
  return String(parsed);
}
