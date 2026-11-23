import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { createZipArchive, renderExportTable, type ExportFile } from '@finlonexa/crm-shared/server';
import { centralExportModules, centralExportRequest, type ExportModule } from './contract';

async function granted(client: SupabaseClient<Database>, userId: string, permission: string) {
  const result = await client.rpc('has_effective_permission', { p_user_id: userId, p_permission_id: permission });
  if (result.error) throw new Error('Export authorization unavailable.');
  return result.data === true;
}
export async function authorizeCentralExport(client: SupabaseClient<Database>) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Authentication required.');
  if (!await granted(client, user.id, 'exports.view')) throw new Error('Permission denied.');
  return user;
}
async function authorizeModule(client: SupabaseClient<Database>, userId: string, module: ExportModule) {
  const checks = await Promise.all([granted(client, userId, `${module}.view`), granted(client, userId, `${module}.export`)]);
  if (!checks.every(Boolean)) throw new Error('Module export permission denied.');
}
export async function availableExportColumns(client: SupabaseClient<Database>, userId: string, module: ExportModule) {
  await authorizeModule(client, userId, module);
  const [definitions, metadata] = await Promise.all([
    client.from('crm_field_definitions').select('key,sensitive,archived').eq('module', module).limit(501),
    client.rpc('crm_shared_metadata', { m: module }),
  ]);
  if (definitions.error || metadata.error || definitions.data.length > 500) throw new Error('Export field configuration unavailable.');
  const visible = z.object({ fields: z.array(z.object({ key: z.string(), access: z.enum(['write','readonly','hidden']) })) }).parse(metadata.data).fields;
  return centralExportModules[module].columns.filter(column => {
    const definition = definitions.data.find(item => item.key === column.key);
    // A configured field is never allowed by absence from the visible metadata response.
    // Unconfigured scalar allowlist entries use module permissions; no field rule can exist without a definition FK.
    return !definition || (!definition.sensitive && !definition.archived && visible.some(item => item.key === column.key && item.access !== 'hidden'));
  });
}
export async function centralExportCatalog(client: SupabaseClient<Database>, modules?: ExportModule[]) {
  const user = await authorizeCentralExport(client);
  const allowed: { module: ExportModule; label: string; columns: Awaited<ReturnType<typeof availableExportColumns>> }[] = [];
  for (const module of modules ?? Object.keys(centralExportModules) as ExportModule[]) {
    const checks = await Promise.all([granted(client, user.id, `${module}.view`), granted(client, user.id, `${module}.export`)]);
    if (!checks.every(Boolean)) continue;
    allowed.push({ module, label: centralExportModules[module].label, columns: modules ? await availableExportColumns(client, user.id, module) : [] });
  }
  return allowed;
}
export async function runCentralExport(client: SupabaseClient<Database>, raw: unknown): Promise<ExportFile> {
  const request = centralExportRequest.parse(raw);
  new Intl.DateTimeFormat('en-GB', { timeZone: request.timeZone }).format();
  const user = await authorizeCentralExport(client);
  const files: ExportFile[] = [];
  let totalBytes = 0, totalCells = 0;
  for (const selection of request.modules) {
    const available = await availableExportColumns(client, user.id, selection.module);
    const columns = selection.columns.map(key => {
      const column = available.find(item => item.key === key);
      if (!column) throw new Error('Selected export field is unavailable.');
      return { ...column, visible: true, exportable: true };
    });
    const records: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (;;) {
      await authorizeModule(client, user.id, selection.module);
      // Session-JWT reads, explicit current columns and existing record-scope RLS; never service-role reads.
      let query = client.from(selection.module).select(['id', ...selection.columns].join(',')).order('id');
      if (cursor) query = query.gt('id', cursor);
      const result = await query.limit(250);
      if (result.error) throw new Error('Scoped export records could not be loaded.');
      const batch = z.array(z.object({ id: z.string().uuid() }).passthrough()).parse(result.data);
      if (batch.some(row => seen.has(row.id) || (cursor !== undefined && row.id <= cursor))) throw new Error('Export page changed unexpectedly. Retry the export.');
      for (const row of batch) { if (seen.has(row.id)) throw new Error('Duplicate export record.'); seen.add(row.id); }
      records.push(...batch);
      totalCells += batch.length * columns.length;
      if (records.length > 5000 || records.length * columns.length > 50000 || totalCells > 100000) throw new Error('Export exceeds the synchronous processing limit; no truncated file was generated.');
      if (batch.length < 250) break;
      cursor = batch[batch.length - 1].id;
    }
    // Recheck field authorization after fetching, so stale UI metadata cannot authorize a download.
    const current = await availableExportColumns(client, user.id, selection.module);
    if (selection.columns.some(key => !current.some(item => item.key === key))) throw new Error('Export field permission changed. Retry your selection.');
    const file = renderExportTable(selection.module, columns, records, request.format, request.timeZone);
    totalBytes += file.bytes.length;
    if (totalBytes > 32 * 1024 * 1024) throw new Error('Export requires background processing.');
    files.push(file);
  }
  if (files.length === 1) return files[0];
  return { filename: `export_${request.format}.zip`, contentType: 'application/zip', rows: files.reduce((total, file) => total + file.rows, 0), bytes: createZipArchive(Object.fromEntries(files.map(file => [file.filename, file.bytes]))) };
}
