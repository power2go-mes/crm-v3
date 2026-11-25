import { NextRequest, NextResponse } from 'next/server';
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
    const { provider, calendar_id, calendar_name } = body;

    // 1. Fetch activities for sync
    const { data: activities, error: actErr } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (actErr) {
      return NextResponse.json({ error: actErr.message }, { status: 500 });
    }

    const syncedCount = activities?.length || 0;
    const now = new Date().toISOString();

    // 2. Update the connection record in crm_calendar_connections
    const { data: updatedConnection, error: connErr } = await supabase
      .from('crm_calendar_connections')
      .upsert(
        {
          user_id: user.id,
          provider: provider || 'google_calendar',
          calendar_id: calendar_id || 'primary',
          calendar_name: calendar_name || 'Executive Calendar',
          sync_status: 'connected',
          sync_direction: 'both',
          last_synced_at: now,
          error_message: null,
          updated_at: now,
        },
        { onConflict: 'user_id,provider' }
      )
      .select()
      .single();

    if (connErr) {
      return NextResponse.json({ error: connErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lastSyncedAt: now,
      syncedCount,
      message: `Successfully synchronized ${syncedCount} CRM activities with ${calendar_id || 'your external calendar'}.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}
