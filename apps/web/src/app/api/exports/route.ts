import { createClient } from '@/lib/supabase/server';
import { centralExportCatalog, runCentralExport } from '@/lib/exports/service';
import { exportModule } from '@/lib/exports/contract';
import { boundedBody } from '@/lib/imports/body';
import { z } from 'zod';
export const runtime = 'nodejs';
const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
function failure(error: unknown) {
  const message = error instanceof z.ZodError ? 'Check selected modules, columns and format.' : error instanceof Error ? error.message : 'Export failed.';
  return Response.json({ error: message }, { status: message.includes('Authentication') ? 401 : message.toLowerCase().includes('permission') ? 403 : 400, headers: privateHeaders });
}
export async function GET(request: Request) {
  try {
    const selected = new URL(request.url).searchParams.getAll('module');
    const modules = selected.length ? z.array(exportModule).max(5).parse(selected) : undefined;
    return Response.json({ modules: await centralExportCatalog(await createClient(), modules) }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403, headers: privateHeaders });
  try {
    const client = await createClient();
    const body = await boundedBody(request, 32768, 'Export request is too large.');
    const file = await runCentralExport(client, JSON.parse(new TextDecoder().decode(body)));
    return new Response(new Uint8Array(file.bytes), { headers: { ...privateHeaders, 'Content-Type': file.contentType, 'Content-Disposition': `attachment; filename="${file.filename}"`, 'X-Export-Rows': String(file.rows) } });
  } catch (error) { return failure(error); }
}
