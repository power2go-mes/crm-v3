import { z } from 'zod';

export const privateExportHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function exportFailure(error: unknown) {
  const message = error instanceof z.ZodError
    ? 'Check selected export columns and options.'
    : error instanceof Error ? error.message : 'Export failed.';
  const lower = message.toLowerCase();
  const status = lower.includes('authentication') ? 401
    : lower.includes('permission') ? 403
    : lower.includes('not found') ? 404 : 400;
  return Response.json({ error: message }, { status, headers: privateExportHeaders });
}

export function requireSameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

export function exportJobIdFromPath(request: Request, offsetFromEnd = 0) {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  const id = segments[segments.length - 1 - offsetFromEnd];
  return z.string().uuid().parse(id);
}
