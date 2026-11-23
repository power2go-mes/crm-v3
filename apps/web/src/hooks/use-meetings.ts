'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { MeetingWithRelations, ActivityInsert, ActivityUpdate } from '@/types/meetings';

export interface UseMeetingsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useMeetings(params: UseMeetingsParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    search = '',
    status = 'all',
    sortBy = 'start_time',
    sortOrder = 'asc',
  } = params;

  const supabase = createClient();

  return useQuery<{ meetings: MeetingWithRelations[]; totalCount: number }>({
    queryKey: ['meetings', { page, pageSize, search, status, sortBy, sortOrder }],
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
        .eq('activity_type', 'meeting');

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`subject.ilike.${term},description.ilike.${term},location.ilike.${term}`);
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        meetings: (data as any) || [],
        totalCount: count || 0,
      };
    },
    staleTime: 1000 * 30,
  });
}

export function useMeeting(id?: string) {
  const supabase = createClient();

  return useQuery<MeetingWithRelations | null>({
    queryKey: ['meeting', id],
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
        .eq('activity_type', 'meeting')
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: Boolean(id),
    staleTime: 1000 * 30,
  });
}

export function useCreateMeetingMutation() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<ActivityInsert, 'activity_type'>) => {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...payload,
          activity_type: 'meeting',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}

export function useUpdateMeetingMutation() {
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
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}

export function useDeleteMeetingMutation() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}
