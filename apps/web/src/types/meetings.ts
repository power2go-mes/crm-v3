import type { Database } from '@finlonexa/database';

export type ActivityRow = Database['public']['Tables']['activities']['Row'];
export type ActivityInsert = Database['public']['Tables']['activities']['Insert'];
export type ActivityUpdate = Database['public']['Tables']['activities']['Update'];

export interface MeetingWithRelations extends ActivityRow {
  assigned_to?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  created_by?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export const MEETING_PROVIDERS = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'ms_teams', label: 'Microsoft Teams' },
  { value: 'in_person', label: 'In-Person / Office' },
] as const;

export const MEETING_STATUSES = [
  { value: 'not_started', label: 'Scheduled', color: 'text-emerald-600 bg-emerald-600/10 border-emerald-200/20' },
  { value: 'in_progress', label: 'In Progress', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { value: 'completed', label: 'Completed', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
] as const;
