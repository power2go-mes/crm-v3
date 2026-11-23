import { z } from 'zod';
import { fieldKey, moduleKey, type FieldAccess } from './fields';

export interface FormField {
  key: string; label: string; schema: z.ZodTypeAny;
  required: boolean; relaxable?: boolean; access: FieldAccess;
  defaultValue?: unknown; group?: string; step?: number;
  /** A server-side selector validator must check each submitted relation against RLS. */
  relation?: { module: string; multiple: boolean };
}
export const layoutSchema = z.array(z.object({
  field: fieldKey, visible: z.boolean(), sequence: z.number().int().nonnegative(),
}).strict()).max(200).refine(v => new Set(v.map(r => r.field)).size === v.length, 'Duplicate fields');
export type FormMode = 'create' | 'edit' | 'duplicate' | 'detail';
export const formMetadataSchema = z.object({
  module: moduleKey, layout: z.enum(['single', 'multi', 'custom']),
  mode: z.enum(['create', 'edit', 'duplicate', 'detail']),
}).strict();

export function resolveForm(
  fields: readonly FormField[], mode: FormMode,
  requirements: Readonly<Record<string, boolean>> = {},
  customLayout?: z.infer<typeof layoutSchema>,
): FormField[] {
  if (new Set(fields.map(f => f.key)).size !== fields.length) throw new Error('Duplicate field keys');
  const layout = customLayout ? layoutSchema.parse(customLayout) : undefined;
  if (layout?.some(r => !fields.some(f => f.key === r.field))) throw new Error('Unknown layout field');
  for (const key of Object.keys(requirements)) {
    const field = fields.find(f => f.key === key);
    if (!field || (!requirements[key] && field.required && !field.relaxable)) {
      throw new Error('Invalid requiredness override: ' + key);
    }
  }
  return fields.map((f, index) => {
    const required = requirements[f.key] ?? f.required;
    const item = layout?.find(r => r.field === f.key);
    const access = mode === 'detail' && f.access !== 'hidden' ? 'readonly' : f.access;
    return { field: { ...f, required, access } as FormField,
      visible: access !== 'hidden' && (!layout || required || item?.visible === true),
      sequence: item?.sequence ?? (layout ? layout.length + index : index), index };
  }).filter(f => f.visible).sort((a, b) => a.sequence - b.sequence || a.index - b.index)
    .map(x => x.field);
}
export async function validateFormSubmission(
  fields: readonly FormField[], payload: unknown, mode: FormMode,
  validateRelation: (module: string, ids: readonly string[]) => Promise<boolean>,
): Promise<Record<string, unknown>> {
  if (mode === 'detail') throw new Error('Detail is read only');
  const input = z.record(z.unknown()).parse(payload);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (!fields.some(f => f.key === key && f.access === 'write')) {
      throw new Error('Field is unavailable for writing: ' + key);
    }
  }
  for (const field of fields) {
    if (field.access !== 'write') continue;
    let raw = input[field.key];
    if (!(field.key in input)) {
      if (mode === 'edit') continue;
      raw = field.defaultValue;
    }
    if (raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && !raw.length)) {
      if (field.required) throw new Error('Required field: ' + field.key);
      if (raw !== undefined) result[field.key] = raw;
      continue;
    }
    const value: unknown = field.schema.parse(raw);
    if (field.relation) {
      const ids = (field.relation.multiple ? z.array(z.string().uuid()) : z.string().uuid())
        .parse(value);
      if (!await validateRelation(field.relation.module, Array.isArray(ids) ? ids : [ids])) {
        throw new Error('Related record is unavailable');
      }
    }
    result[field.key] = value;
  }
  return result;
}
