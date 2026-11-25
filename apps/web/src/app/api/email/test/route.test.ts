import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

import { createClient } from '@/lib/supabase/server';
import nodemailer from 'nodemailer';

describe('POST /api/email/test', () => {
  it('rejects unauthenticated requests with 401', async () => {
    (createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') }),
      },
    });

    const req = new NextRequest('http://localhost:3000/api/email/test', {
      method: 'POST',
      body: JSON.stringify({
        email_address: 'test@example.com',
        app_password: 'secretpassword',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('rejects invalid or missing inputs with 400', async () => {
    (createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
    });

    const req = new NextRequest('http://localhost:3000/api/email/test', {
      method: 'POST',
      body: JSON.stringify({
        email_address: 'not-an-email',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid SMTP settings');
  });

  it('rejects unpermitted custom SMTP host with 400', async () => {
    (createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
    });

    const req = new NextRequest('http://localhost:3000/api/email/test', {
      method: 'POST',
      body: JSON.stringify({
        email_address: 'user@evil.com',
        app_password: 'secretpassword',
        smtp_host: 'evil.internal.network.com',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('SMTP host is not permitted');
  });

  it('never discloses credentials in responses even on connection failure', async () => {
    (createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
    });

    (nodemailer.createTransport as any).mockReturnValue({
      verify: vi.fn().mockRejectedValue(new Error('Connection timeout')),
    });

    const req = new NextRequest('http://localhost:3000/api/email/test', {
      method: 'POST',
      body: JSON.stringify({
        email_address: 'user@gmail.com',
        app_password: 'supersecretpassword123',
        provider: 'google',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('SMTP connection or delivery failed');
    expect(JSON.stringify(body)).not.toContain('supersecretpassword123');
  });
});
