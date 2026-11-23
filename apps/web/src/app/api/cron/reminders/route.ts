import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is defined in environment, require matching Bearer token
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron invocation' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc('generate_sales_reminders');

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
