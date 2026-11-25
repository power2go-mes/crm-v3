import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    // Fetch user activities (meetings, calls, tasks)
    let query = supabase
      .from('activities')
      .select('*')
      .order('start_time', { ascending: true });

    if (userId) {
      query = query.or(`assigned_to_id.eq.${userId},created_by_id.eq.${userId}`);
    }

    const { data: activities, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate iCal format string
    const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const icalEvents = (activities || []).map((act) => {
      const dtStart = act.start_time
        ? new Date(act.start_time).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        : act.due_date
        ? new Date(act.due_date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        : nowStr;

      const dtEnd = act.end_time
        ? new Date(act.end_time).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        : dtStart;

      const summary = act.subject ? act.subject.replace(/\n/g, ' ') : 'CRM Activity';
      const description = act.description ? act.description.replace(/\n/g, '\\n') : '';
      const location = act.location || act.meeting_url || '';

      return [
        'BEGIN:VEVENT',
        `UID:${act.id}@finlonexa-crm.internal`,
        `DTSTAMP:${nowStr}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        `STATUS:${act.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE'}`,
        'END:VEVENT',
      ].join('\r\n');
    });

    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FINLONEXA CRM//Calendar Sync 3.0//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:FINLONEXA CRM Calendar',
      'X-WR-TIMEZONE:UTC',
      ...icalEvents,
      'END:VCALENDAR',
    ].join('\r\n');

    return new Response(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="crm-calendar.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
