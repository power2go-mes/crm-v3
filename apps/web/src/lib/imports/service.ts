import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { importMatchFields, leadImportFields, parseImportCsv } from './csv';

export const importDraftInput = z.object({
  job: z.string().uuid(), mode: z.enum(['create', 'update', 'both']),
  mapping: z.record(z.number().int().min(0).max(49)),
  match: z.array(z.enum(importMatchFields)).max(5),
}).strict();
export const importRunInput = importDraftInput.superRefine((value, ctx) => {
  const allowed = new Set<string>(leadImportFields.map(([key]) => key));
  if (!Object.keys(value.mapping).length || Object.keys(value.mapping).some(key => !allowed.has(key))) ctx.addIssue({ code: 'custom', message: 'Choose permitted mapped fields.' });
  if (new Set(value.match).size !== value.match.length || value.match.some(key => value.mapping[key] === undefined)) ctx.addIssue({ code: 'custom', message: 'Match fields must be unique and mapped.' });
  if (value.mode !== 'create' && !value.match.length) ctx.addIssue({ code: 'custom', message: 'Select at least one match field for updates.' });
});
const importProgressSchema = z.object({
  total_rows: z.number().int().nonnegative(),
  processed_rows: z.number().int().nonnegative(),
  complete: z.boolean(),
  created_count: z.number().int().nonnegative(),
  updated_count: z.number().int().nonnegative(),
  error_count: z.number().int().nonnegative(),
  success_rate: z.number().nonnegative(),
  duration_seconds: z.number().nonnegative(),
  errors: z.array(z.object({ row: z.number().int().positive(), message: z.string() })),
});
export type ImportProgress = z.infer<typeof importProgressSchema>;

export async function runImportBatches(
  runBatch: () => Promise<ImportProgress>,
  startAt: number,
  onProgress: (progress: ImportProgress) => void
) {
  let processedRows = startAt;
  let progress: ImportProgress;
  do {
    progress = await runBatch();
    if (!progress.complete && progress.processed_rows <= processedRows) {
      throw new Error('Import worker did not advance. Retry to resume from saved progress.');
    }
    processedRows = progress.processed_rows;
    onProgress(progress);
  } while (!progress.complete);
  return progress;
}

export async function authorizeImport(client: SupabaseClient<Database>, run = false) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Authentication required.');
  for (const permission of ['imports.view', 'leads.view', ...(run ? ['imports.create', 'leads.create'] : [])]) {
    const grant = await client.rpc('has_effective_permission', { p_user_id: user.id, p_permission_id: permission });
    if (grant.error || grant.data !== true) throw new Error('Permission denied.');
  }
  return user;
}
export async function createImport(client: SupabaseClient<Database>, name: string, filename: string, csv: string, authorized = false) {
  if (!authorized) await authorizeImport(client, true);
  if (!filename.toLowerCase().endsWith('.csv')) throw new Error('This import currently accepts CSV files.');
  const importName = z.string().trim().min(1).max(100).parse(name);
  const parsed = parseImportCsv(csv);
  const { data, error } = await client.rpc('create_lead_import', { p_name: importName, p_filename: filename, p_csv: csv, p_headers: parsed.headers, p_rows: parsed.rows });
  if (error) throw new Error('Import could not be prepared. Check permissions and file limits.');
  return { id: data, headers: parsed.headers, sample: parsed.rows.slice(0, 3), total: parsed.rows.length };
}
export async function runImport(client: SupabaseClient<Database>, raw: unknown, authorized = false) {
  if (!authorized) await authorizeImport(client, true);
  const value = importRunInput.parse(raw);
  const { data, error } = await client.rpc('run_lead_import', {
    p_job: value.job,
    p_mapping: value.mapping,
    p_mode: value.mode,
    p_match: value.match,
    p_limit: 250,
  });
  if (error) throw new Error(error.code === '42501' ? 'Permission denied.' : 'Import configuration was rejected. Check mapped fields, field permissions and required custom fields.');
  return importProgressSchema.parse(data);
}
