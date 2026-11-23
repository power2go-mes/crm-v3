'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { TaskWithRelations, ActivityInsert, ActivityUpdate } from '@/types/tasks';

export interface UseTasksParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useTasks(params: UseTasksParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    search = '',
    status = 'all',
    priority = 'all',
    sortBy = 'due_date',
    sortOrder = 'asc',
  } = params;

  const supabase = createClient();

  return useQuery<{ tasks: TaskWithRelations[]; totalCount: number }>({
    queryKey: ['tasks', { page, pageSize, search, status, priority, sortBy, sortOrder }],
    queryFn: async () => {
      let query = supabase
        .from('activities')
        .select(
          `
          *,
          assigned_to:user_profiles!assigned_to_id(id, first_name, last_name, email),
          created_by:user_profiles!created_by_id(id, first_name, last_name, email)
        `,
          { count: 'exact' }
        )
        .eq('activity_type', 'task');

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (priority && priority !== 'all') {
        query = query.eq('priority', priority);
      }

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`subject.ilike.${term},description.ilike.${term}`);
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        tasks: (data as any) || [],
        totalCount: count || 0,
      };
    },
    staleTime: 1000 * 30,
  });
}

export function useTask(id?: string) {
  const supabase = createClient();

  return useQuery<TaskWithRelations | null>({
    queryKey: ['task', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('activities')
        .select(
          `
          *,
          assigned_to:user_profiles!assigned_to_id(id, first_name, last_name, email),
          created_by:user_profiles!created_by_id(id, first_name, last_name, email)
        `
        )
        .eq('id', id)
        .eq('activity_type', 'task')
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: Boolean(id),
    staleTime: 1000 * 30,
  });
}

export function useCreateTaskMutation() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<ActivityInsert, 'activity_type'>) => {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...payload,
          activity_type: 'task',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTaskMutation() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ActivityUpdate }) => {
      const { data, error } = await supabase
        .from('activities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useToggleTaskStatusMutation() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const nextStatus = currentStatus === 'completed' ? 'not_started' : 'completed';
      const { data, error } = await supabase
        .from('activities')
        .update({ status: nextStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTaskMutation() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
