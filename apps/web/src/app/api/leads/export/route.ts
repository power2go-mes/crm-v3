import { createClient } from '@/lib/supabase/server';
import { leadExportSource } from '@/lib/leads/export-source';
import { exportRecords } from '@finlonexa/crm-shared/server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  try {
    const text = await request.text();
    if (text.length > 1024 * 1024) return Response.json({ error: 'Selection too large' }, { status: 413 });
    const input: unknown = JSON.parse(text);
    const file = await exportRecords(input, leadExportSource(await createClient()));
    return new Response(new Uint8Array(file.bytes), { headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': 'attachment; filename="' + file.filename + '"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return Response.json({ error: 'Export unavailable. Check your selection, permissions and field configuration.' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
