import type { Database } from '@finlonexa/database';

export type ActivityRow = Database['public']['Tables']['activities']['Row'];
export type Activity = ActivityRow;
export type ActivityInsert = Database['public']['Tables']['activities']['Insert'];
export type ActivityUpdate = Database['public']['Tables']['activities']['Update'];

export interface TaskWithRelations extends ActivityRow {
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

export const TASK_PRIORITIES = [
  { value: 'high', label: 'High', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { value: 'medium', label: 'Medium', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { value: 'low', label: 'Low', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
] as const;

export const TASK_STATUSES = [
  { value: 'not_started', label: 'Not Started', color: 'text-slate-300 bg-slate-800' },
  { value: 'in_progress', label: 'In Progress', color: 'text-emerald-600 bg-emerald-600/10 border-emerald-200/20' },
  { value: 'completed', label: 'Completed', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
] as const;
