export type CalendarProvider = 'google_calendar' | 'microsoft_outlook';
export type CalendarSyncStatus = 'unconfigured' | 'connected' | 'syncing' | 'error' | 'disabled';
export type CalendarSyncDirection = 'both' | 'crm_to_external' | 'external_to_crm';

export interface CrmCalendarConnection {
  id: string;
  user_id: string;
  provider: CalendarProvider;
  calendar_id: string | null;
  calendar_name: string | null;
  sync_status: CalendarSyncStatus;
  sync_direction: CalendarSyncDirection;
  last_synced_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmCalendarSyncLink {
  id: string;
  connection_id: string;
  activity_id: string;
  external_event_id: string;
  last_sync_hash: string | null;
  synced_at: string;
}
