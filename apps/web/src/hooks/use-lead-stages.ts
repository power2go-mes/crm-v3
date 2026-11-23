'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface LeadStage {
  id: string;
  name: string;
  order_index: number;
  color: string;
  probability: number;
  is_final: boolean;
  created_at: string;
}

export function useLeadStages() {
  const supabase = createClient();

  return useQuery<LeadStage[]>({
    queryKey: ['lead-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data as LeadStage[]) || [];
    },
    staleTime: 1000 * 60,
  });
}

export function useUpdateLeadStageMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (payload: {
      stageId: string;
      name: string;
      color: string;
      probability: number;
    }) => {
      const { data, error } = await (supabase as any).rpc('update_lead_stage', {
        p_stage_id: payload.stageId,
        p_name: payload.name,
        p_color: payload.color,
        p_probability: payload.probability,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useReorderLeadStagesMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (stageIds: string[]) => {
      const { data, error } = await (supabase as any).rpc('reorder_lead_stages', {
        p_stage_ids: stageIds,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
