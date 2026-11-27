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
  { value: 'high', label: 'High', color: 'text-red-700 bg-red-50 border-red-200' },
  { value: 'medium', label: 'Medium', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { value: 'low', label: 'Low', color: 'text-slate-700 bg-slate-100 border-slate-200' },
] as const;

export const TASK_STATUSES = [
  { value: 'not_started', label: 'Not Started', color: 'text-slate-700 bg-slate-100 border border-slate-200' },
  { value: 'in_progress', label: 'In Progress', color: 'text-[#4361ee] bg-[#eef2ff] border border-indigo-100' },
  { value: 'completed', label: 'Completed', color: 'text-[#4361ee] bg-[#eef2ff] border border-indigo-100' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-rose-700 bg-rose-50 border border-rose-200' },
] as const;
