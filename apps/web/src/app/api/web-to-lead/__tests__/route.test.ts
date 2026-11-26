import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

import { POST } from '../route';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  mocks.createClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { success: true }, error: null });
});

function request() {
  return new NextRequest('http://localhost:3000/api/web-to-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ form_id: 'cf98e5de-0a03-440e-bbc2-bc4c6b078ffa', email: 'person@example.com' }),
  });
}

describe('public web-to-lead submission errors', () => {
  it('keeps successful submission responses generic', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
  });

  it('returns a retryable generic error instead of exposing database details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'internal database detail' } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      error: 'The submission could not be completed. Please retry.',
    });
    log.mockRestore();
  });

  it('reports inactive forms without exposing internal database errors', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'private form detail' } });
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: 'This form is unavailable.' });
  });
});
