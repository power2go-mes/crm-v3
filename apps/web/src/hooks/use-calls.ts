'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CallWithRelations, ActivityInsert, ActivityUpdate } from '@/types/calls';

export interface UseCallsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  callType?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useCalls(params: UseCallsParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    search = '',
    callType = 'all',
    status = 'all',
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = params;

  const supabase = createClient();

  return useQuery<{ calls: CallWithRelations[]; totalCount: number }>({
    queryKey: ['calls', { page, pageSize, search, callType, status, sortBy, sortOrder }],
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
        .eq('activity_type', 'log_call');

      if (callType && callType !== 'all') {
        query = query.eq('call_type', callType as any);
      }

      if (status && status !== 'all') {
        query = query.eq('status', status);
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
        calls: (data as any) || [],
        totalCount: count || 0,
      };
    },
    staleTime: 1000 * 30,
  });
}

export function useCall(id?: string) {
  const supabase = createClient();

  return useQuery<CallWithRelations | null>({
    queryKey: ['call', id],
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
        .eq('activity_type', 'log_call')
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: Boolean(id),
    staleTime: 1000 * 30,
  });
}

export function useCreateCallMutation() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<ActivityInsert, 'activity_type'>) => {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...payload,
          activity_type: 'log_call',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });
}

export function useUpdateCallMutation() {
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
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });
}

export function useDeleteCallMutation() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });
}
