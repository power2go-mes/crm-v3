import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function hasValidCronAuthorization(authorization: string | null, secret: string): boolean {
  const prefix = 'Bearer ';
  if (!authorization?.startsWith(prefix)) return false;

  const supplied = Buffer.from(authorization.slice(prefix.length));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron endpoint is not configured' }, { status: 503 });
  }
  if (!hasValidCronAuthorization(request.headers.get('authorization'), cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized cron invocation' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('generate_sales_reminders', {
      p_target_user_id: null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to execute scheduled reminders' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
