import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabaseClient = await createClient();
    const supabase = supabaseClient as any;
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const schema = z.object({
      related_to_type: z.enum(['account', 'contact', 'opportunity', 'lead']),
      related_to_id: z.string().uuid(),
      recipient_email: z.string().trim().email(),
      recipient_name: z.string().optional(),
      cc_emails: z.array(z.string().trim().email()).optional().default([]),
      bcc_emails: z.array(z.string().trim().email()).optional().default([]),
      subject: z.string().trim().min(1),
      body_html: z.string(),
      template_id: z.string().uuid().nullable().optional(),
      is_draft: z.boolean().optional().default(false),
    });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email payload: ' + parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 });
    }

    const {
      related_to_type,
      related_to_id,
      recipient_email,
      recipient_name,
      cc_emails,
      bcc_emails,
      subject,
      body_html,
      template_id,
      is_draft,
    } = parsed.data;

    // Check if user has connected email account
    const { data: accounts } = await supabase
      .from('crm_email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1);

    const activeAccount = accounts && accounts.length > 0 ? accounts[0] : null;

    if (is_draft) {
      const { data, error } = await supabase
        .from('crm_emails')
        .insert({
          user_id: user.id,
          related_to_type,
          related_to_id,
          recipient_email,
          recipient_name: recipient_name || null,
          cc_emails,
          bcc_emails,
          subject,
          body_html,
          template_id: template_id || null,
          status: 'draft',
          error_message: null,
          provider: activeAccount?.provider || null,
          sent_at: null,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, email: data, status: 'draft' });
    }

    if (!activeAccount) {
      return NextResponse.json(
        {
          error: 'No connected mailbox found. Please configure and test an email account in Settings -> Email.',
          status: 'failed',
        },
        { status: 400 }
      );
    }

    // Live dispatch via nodemailer using stored credentials
    let appPassword = '';
    let host = 'smtp.gmail.com';
    let port = 587;

    if (activeAccount.encrypted_tokens?.app_password) {
      appPassword = activeAccount.encrypted_tokens.app_password;
      if (activeAccount.encrypted_tokens.smtp_host) {
        host = activeAccount.encrypted_tokens.smtp_host;
      } else if (activeAccount.provider === 'microsoft') {
        host = 'smtp.office365.com';
      }
      if (activeAccount.encrypted_tokens.smtp_port) {
        port = Number(activeAccount.encrypted_tokens.smtp_port) || 587;
      }
    } else {
      // Check fallback host based on provider
      if (activeAccount.provider === 'microsoft') {
        host = 'smtp.office365.com';
      }
    }

    let dispatchError: string | null = null;
    let messageId: string | null = null;

    if (!appPassword) {
      dispatchError = 'Mailbox does not have an App Password saved. Please update credentials in Settings -> Email.';
    } else {
      try {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          requireTLS: port !== 465,
          auth: {
            user: activeAccount.email_address,
            pass: appPassword,
          },
        });

        const sendInfo = await transporter.sendMail({
          from: `"${activeAccount.display_name || 'FINLONEXA CRM'}" <${activeAccount.email_address}>`,
          to: recipient_name ? `"${recipient_name}" <${recipient_email}>` : recipient_email,
          cc: cc_emails.length > 0 ? cc_emails : undefined,
          bcc: bcc_emails.length > 0 ? bcc_emails : undefined,
          subject,
          html: body_html,
        });

        messageId = sendInfo.messageId;
      } catch (err: any) {
        console.error('[Email Dispatch Error]', err);
        dispatchError = err.message || 'SMTP connection failed';
      }
    }

    const emailStatus = dispatchError ? 'failed' : 'sent';

    const { data: record, error: dbError } = await supabase
      .from('crm_emails')
      .insert({
        user_id: user.id,
        related_to_type,
        related_to_id,
        recipient_email,
        recipient_name: recipient_name || null,
        cc_emails,
        bcc_emails,
        subject,
        body_html,
        template_id: template_id || null,
        status: emailStatus,
        error_message: dispatchError,
        provider: activeAccount.provider,
        sent_at: dispatchError ? null : new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) throw dbError;

    if (dispatchError) {
      return NextResponse.json(
        {
          error: dispatchError,
          status: 'failed',
          email: record,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: 'sent',
      messageId,
      email: record,
    });
  } catch (err: any) {
    console.error('[POST /api/email/send Exception]', err);
    return NextResponse.json({ error: err.message || 'Failed to dispatch email' }, { status: 500 });
  }
}
