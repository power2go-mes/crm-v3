import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { GET } from '../route';

function request(authorization?: string) {
  return new Request('http://localhost:3000/api/cron/reminders', {
    headers: authorization ? { authorization } : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
  mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { success: true, reminders_created: 0 }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('reminders cron endpoint authorization', () => {
  it('fails closed when the cron secret is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects a missing or incorrect bearer token before calling Supabase', async () => {
    const response = await GET(request('Bearer wrong-secret'));

    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('uses the service client only after valid cron authorization', async () => {
    const response = await GET(request('Bearer test-cron-secret'));

    expect(response.status).toBe(200);
    expect(mocks.createAdminClient).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('generate_sales_reminders', {
      p_target_user_id: null,
    });
  });
});
