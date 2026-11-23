import { createClient } from '@/lib/supabase/server';
import { authorizeImport, createImport, runImport } from '@/lib/imports/service';
import { IMPORT_MAX_BYTES, leadImportFields } from '@/lib/imports/csv';
import { boundedBody } from '@/lib/imports/body';

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Origin denied.' }, { status: 403 });
    const client = await createClient();
    await authorizeImport(client, true);
    const length = Number(request.headers.get('content-length'));
    if (length > IMPORT_MAX_BYTES + 100000) return Response.json({ error: 'Import request is too large.' }, { status: 413 });
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const body = await boundedBody(request, IMPORT_MAX_BYTES + 100000);
      const form = await new Response(body, { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData();
      const file = form.get('file');
      if (!(file instanceof File) || file.size > IMPORT_MAX_BYTES) return Response.json({ error: 'Select a CSV file up to 2 MB.' }, { status: 400 });
      return Response.json(await createImport(client, String(form.get('name') ?? ''), file.name, new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())));
    }
    const text = new TextDecoder().decode(await boundedBody(request, 20000));
    return Response.json({ result: await runImport(client, JSON.parse(text)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed.';
    return Response.json({ error: message.startsWith('[') ? 'Check import fields and configuration.' : message }, { status: message.includes('Authentication') ? 401 : message.includes('Permission') ? 403 : 400 });
  }
}

export async function GET(request: Request) {
  try {
    const client = await createClient();
    await authorizeImport(client);
    const url = new URL(request.url);
    if (url.searchParams.get('template') === 'leads') {
      await authorizeImport(client, true);
      return new Response(leadImportFields.map(([key]) => key).join(',') + '\r\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="leads-template.csv"', 'Cache-Control': 'no-store' } });
    }
    const id = url.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Invalid import.' }, { status: 400 });
    const { data, error } = await client.from('crm_import_jobs').select('filename,source_csv,result').eq('id', id).single();
    if (error || !data) return Response.json({ error: 'Import unavailable.' }, { status: 404 });
    const errors = url.searchParams.get('errors') === '1';
    const result = data.result as { errors?: { row: number; message: string }[] } | null;
    if (errors && !result?.errors?.length) return Response.json({ error: 'No error file is available for this import.' }, { status: 404 });
    const csv = errors ? 'Row,Error\r\n' + (result?.errors ?? []).map(item => `${item.row},"${item.message.replaceAll('"', '""')}"`).join('\r\n') : data.source_csv;
    const filename = errors ? 'import-errors.csv' : data.filename;
    const encodedName = encodeURIComponent(filename).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase());
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="import-${errors ? 'errors' : 'original'}.csv"; filename*=UTF-8''${encodedName}`, 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Import access denied.' }, { status: 403 }); }
}
