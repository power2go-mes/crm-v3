import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { renderExportCsvFragment, type ExportColumn } from '@finlonexa/crm-shared/server';
import { availableExportColumns, authorizeCentralExport } from './service';

const createJobInput = z.object({
  module: z.literal('leads'),
  columns: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1).max(50),
  timeZone: z.string().max(100).default('UTC'),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.columns).size !== value.columns.length) {
    ctx.addIssue({ code: 'custom', message: 'Export columns must be unique.' });
  }
});
const claimSchema = z.object({
  id: z.string().uuid(),
  claim_token: z.string().uuid(),
  cursor_id: z.string().uuid().nullable(),
  part_count: z.number().int().nonnegative(),
  processed_rows: z.number().int().nonnegative(),
  output_bytes: z.number().int().nonnegative(),
  columns: z.array(z.string()),
  time_zone: z.string(),
});
const leadRowSchema = z.object({ id: z.string().uuid() }).passthrough();
const partLimit = 8 * 1024 * 1024;
const outputLimit = 50 * 1024 * 1024;
const rowLimit = 100000;

export async function createLeadExportJob(client: SupabaseClient<Database>, raw: unknown) {
  const input = createJobInput.parse(raw);
  const user = await authorizeCentralExport(client);
  new Intl.DateTimeFormat('en-GB', { timeZone: input.timeZone }).format();
  const available = await availableExportColumns(client, user.id, 'leads');
  if (input.columns.some(key => !available.some(column => column.key === key))) {
    throw new Error('Selected export field is unavailable.');
  }
  const { data, error } = await client.from('crm_export_jobs')
    .insert({ module: 'leads', columns: input.columns, time_zone: input.timeZone })
    .select('id')
    .single();
  if (error) throw new Error(error.code === '23505'
    ? 'An export is already in progress. Resume it before starting another.'
    : 'Export job could not be created.');
  return { id: data.id };
}

export async function listLeadExportJobs(client: SupabaseClient<Database>) {
  await authorizeCentralExport(client);
  const { data, error } = await client.from('crm_export_jobs')
    .select('id,status,processed_rows,part_count,error_message,created_at,completed_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error('Export jobs could not be loaded.');
  return data;
}

export async function getLeadExportJob(client: SupabaseClient<Database>, id: string) {
  const user = await authorizeCentralExport(client);
  const { data, error } = await client.from('crm_export_jobs')
    .select('id,user_id,module,columns,time_zone,status,processed_rows,part_count,output_bytes,storage_path,created_at,completed_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) throw new Error('Export job not found.');
  if (data.module !== 'leads') throw new Error('Export job is unavailable.');
  const keys = z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1).max(50).parse(data.columns);
  const current = await availableExportColumns(client, user.id, 'leads');
  if (keys.some(key => !current.some(column => column.key === key))) {
    throw new Error('Export field permission changed. This export cannot be downloaded.');
  }
  if (data.user_id !== user.id) throw new Error('Export job not found.');
  return { ...data, columns: keys };
}

export async function processLeadExportBatch(client: SupabaseClient<Database>, id: string) {
  const { data: rawClaim, error: claimError } = await client.rpc('claim_crm_export_job', { p_job: id });
  if (claimError) throw new Error(claimError.code === '42501' ? 'Permission denied.' : 'Export job could not be claimed.');
  if (!rawClaim) {
    const job = await getLeadExportJob(client, id);
    return { status: job.status, processedRows: job.processed_rows, totalRows: null, busy: job.status === 'processing' };
  }

  const claim = claimSchema.parse(rawClaim);
  let terminal = false;
  try {
    const user = await authorizeCentralExport(client);
    const available = await availableExportColumns(client, user.id, 'leads');
    if (claim.columns.some(key => !available.some(column => column.key === key))) {
      terminal = true;
      throw new Error('Export field permission changed. Retry with currently permitted columns.');
    }
    const columns = claim.columns.map(key => {
      const selected = available.find(column => column.key === key);
      if (!selected) throw new Error('Selected export field is unavailable.');
      return { ...selected, visible: true, exportable: true } satisfies ExportColumn;
    });
    const selected = ['id', ...claim.columns].join(',');
    let query = client.from('leads').select(selected).order('id', { ascending: true });
    const cursor = claim.cursor_id;
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query.limit(250);
    if (error) throw new Error('Scoped export records could not be loaded.');
    const records = z.array(leadRowSchema).parse(data);
    if (cursor && records.some(record => record.id <= cursor)) {
      terminal = true;
      throw new Error('Export page changed unexpectedly. Retry the export.');
    }
    if (claim.processed_rows + records.length > rowLimit) {
      terminal = true;
      throw new Error('Export exceeds the 100,000-row background limit.');
    }

    const bytes = renderExportCsvFragment(columns, records, claim.time_zone, claim.part_count === 0);
    if (bytes.length > partLimit || claim.output_bytes + bytes.length > outputLimit) {
      terminal = true;
      throw new Error('Export exceeds the 50 MB output limit.');
    }
    const path = `${user.id}/${claim.id}/parts/${String(claim.part_count).padStart(6, '0')}.csv`;
    const { error: uploadError } = await client.storage.from('crm-export-jobs').upload(path, bytes, {
      contentType: 'text/csv',
      upsert: true,
    });
    if (uploadError) throw new Error('Export page could not be saved. Retry to resume.');

    const finished = records.length < 250;
    const nextCursor = records.length ? records[records.length - 1].id : cursor;
    const { data: saved, error: saveError } = await client.rpc('complete_crm_export_batch', {
      p_job: claim.id,
      p_claim_token: claim.claim_token,
      p_cursor_id: nextCursor,
      p_batch_rows: records.length,
      p_part_bytes: bytes.length,
      p_finished: finished,
    });
    if (saveError || !saved) throw new Error('Export progress could not be saved. Retry to resume.');
    return { status: finished ? 'completed' : 'queued', processedRows: claim.processed_rows + records.length, totalRows: null, busy: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export batch failed.';
    await client.rpc('release_crm_export_job', {
      p_job: claim.id,
      p_claim_token: claim.claim_token,
      p_error: message,
      p_terminal: terminal,
    });
    throw error;
  }
}

export function leadExportPartPath(userId: string, jobId: string, part: number) {
  if (!Number.isInteger(part) || part < 0 || part >= 401) throw new Error('Invalid export part.');
  return `${userId}/${jobId}/parts/${String(part).padStart(6, '0')}.csv`;
}
