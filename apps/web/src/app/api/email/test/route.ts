import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const schema = z.object({
      email_address: z.string().trim().max(254).email(),
      app_password: z.string().min(1).max(1024),
      provider: z.enum(['google', 'microsoft', 'custom']).optional(),
      smtp_host: z.string().trim().toLowerCase().max(253).regex(/^(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*$/).optional(),
      smtp_port: z.union([z.number().int(), z.string().regex(/^\d{1,5}$/)]).transform(Number)
        .pipe(z.number().int().min(1).max(65535)).optional(),
      test_recipient: z.string().trim().max(254).email().optional(),
    });
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid SMTP settings' }, { status: 400 });
    const { email_address, app_password, provider, smtp_host, smtp_port, test_recipient } = parsed.data;
    const recipient = test_recipient ?? email_address;
    const host = smtp_host ?? (provider === 'microsoft' ? 'smtp.office365.com' : 'smtp.gmail.com');
    const port = smtp_port ?? 587;
    const customHosts = (process.env.SMTP_TEST_ALLOWED_HOSTS ?? '').split(',').map(value => value.trim().toLowerCase());
    if (!['smtp.gmail.com', 'smtp.office365.com', ...customHosts].includes(host)) {
      return NextResponse.json({ error: 'SMTP host is not permitted' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: email_address, pass: app_password },
    });

    // Verify SMTP connection credentials
    await transporter.verify();

    // Send the test email
    const info = await transporter.sendMail({
      from: `"FINLONEXA CRM" <${email_address.trim()}>`,
      to: recipient,
      subject: '✅ FINLONEXA CRM — Email Integration Test Successful',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 12px; background: #ffffff;">
          <div style="display: flex; align-items: center; margin-bottom: 16px;">
            <div style="background: #059669; color: #ffffff; padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              FINLONEXA CRM
            </div>
          </div>
          <h2 style="color: #0f172a; margin-top: 0;">Email Connection Test Passed!</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">
            This test email confirms that your mailbox <strong>your configured mailbox</strong> is successfully configured with your App Password.
          </p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #166534; font-size: 13px; font-weight: bold;">
              ✓ Status: Operational & Verified
            </p>
            <p style="margin: 4px 0 0 0; color: #15803d; font-size: 12px;">
              Provider: ${provider?.toUpperCase() || 'SMTP'} | Host: ${host}:${port}
            </p>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
            Sent automatically from FINLONEXA CRM v3 at ${new Date().toLocaleString()}.
          </p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      recipient,
      message: `Test email successfully sent to ${recipient}!`,
    });
  } catch {
    return NextResponse.json({ error: 'SMTP connection or delivery failed' }, { status: 502 });
  }
}
