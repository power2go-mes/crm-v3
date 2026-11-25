import { NextRequest, NextResponse } from 'next/server';
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

    const body = await req.json();
    const { email_address, app_password, provider, smtp_host, smtp_port, test_recipient } = body;

    if (!email_address || !app_password) {
      return NextResponse.json(
        { error: 'Email address and app password/password are required' },
        { status: 400 }
      );
    }

    const recipient = test_recipient?.trim() || email_address.trim();

    // Determine host & port
    let host = smtp_host?.trim();
    let port = parseInt(smtp_port, 10) || 587;
    let secure = port === 465;

    if (!host) {
      if (provider === 'google') {
        host = 'smtp.gmail.com';
        port = 587;
        secure = false;
      } else if (provider === 'microsoft') {
        host = 'smtp.office365.com';
        port = 587;
        secure = false;
      } else {
        host = 'smtp.gmail.com';
      }
    }

    // Configure nodemailer transporter
    const cleanPassword = app_password.replace(/\s+/g, '');
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: email_address.trim(),
        pass: cleanPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
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
            This test email confirms that your mailbox <strong>${email_address.trim()}</strong> is successfully configured with your App Password.
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
  } catch (err: any) {
    console.error('Test email failure:', err);
    return NextResponse.json(
      {
        error: err.message || 'Failed to send test email. Check email ID, host, and app password.',
      },
      { status: 500 }
    );
  }
}
