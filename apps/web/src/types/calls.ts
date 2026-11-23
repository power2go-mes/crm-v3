import type { Database } from '@finlonexa/database';

export type ActivityRow = Database['public']['Tables']['activities']['Row'];
export type ActivityInsert = Database['public']['Tables']['activities']['Insert'];
export type ActivityUpdate = Database['public']['Tables']['activities']['Update'];

export interface CallWithRelations extends ActivityRow {
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

export const CALL_TYPES = [
  { value: 'outbound', label: 'Outbound', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { value: 'inbound', label: 'Inbound', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
] as const;

export const CALL_STATUSES = [
  { value: 'completed', label: 'Completed', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { value: 'not_started', label: 'Scheduled', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { value: 'cancelled', label: 'Missed / Cancelled', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
] as const;
