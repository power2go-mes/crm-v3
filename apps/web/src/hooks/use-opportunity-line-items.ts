'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { OpportunityLineItemRecord } from '@/types/quotes';

export function useOpportunityLineItems(oppId?: string | null) {
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  return useQuery<OpportunityLineItemRecord[]>({
    queryKey: ['opportunity-line-items', oppId],
    enabled: !authLoading && !!user && !!profile?.is_active && !!oppId && hasPermission('opportunities.view'),
    queryFn: async () => {
      if (!oppId) return [];

      const { data, error } = await (supabase as any)
        .from('crm_opportunity_line_items')
        .select(`
          *,
          product:crm_products(id, name, sku, category, unit_of_measure, is_active)
        `)
        .eq('opportunity_id', oppId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data as OpportunityLineItemRecord[]) || [];
    },
  });
}
