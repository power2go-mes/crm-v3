'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { SalesQuota } from '@/types/quotas';

export function useSalesQuotas(params: {
  periodType?: string;
  periodStart?: string;
} = {}) {
  const supabase = createClient();
  const { periodType = 'monthly', periodStart } = params;

  return useQuery<SalesQuota[]>({
    queryKey: ['sales-quotas', { periodType, periodStart }],
    queryFn: async () => {
      let query = (supabase as any)
        .from('crm_sales_quotas')
        .select(`
          *,
          user:user_profiles!user_id(id, first_name, last_name, email, department, designation)
        `)
        .eq('period_type', periodType);

      if (periodStart) {
        query = query.eq('period_start', periodStart);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data as SalesQuota[]) || [];
    },
    staleTime: 1000 * 60,
  });
}

export function useUpsertSalesQuotaMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (payload: {
      userId: string;
      periodType: 'monthly' | 'quarterly' | 'yearly';
      periodStart: string;
      periodEnd: string;
      targetAmount: number;
      currency?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from('crm_sales_quotas')
        .upsert(
          {
            user_id: payload.userId,
            period_type: payload.periodType,
            period_start: payload.periodStart,
            period_end: payload.periodEnd,
            target_amount: payload.targetAmount,
            currency: payload.currency || 'USD',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,period_type,period_start' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-quotas'] });
      queryClient.invalidateQueries({ queryKey: ['sales-performance'] });
    },
  });
}

export function useDeleteSalesQuotaMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (quotaId: string) => {
      const { data, error } = await (supabase as any)
        .from('crm_sales_quotas')
        .delete()
        .eq('id', quotaId);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-quotas'] });
      queryClient.invalidateQueries({ queryKey: ['sales-performance'] });
    },
  });
}
