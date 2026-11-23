'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type {
  OpportunityWithRelations,
  OpportunityInsert,
  OpportunityUpdate,
  OpportunityFilterState,
} from '@/types/opportunities';

export interface UseOpportunitiesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  stage?: string;
  accountId?: string;
  ownerId?: string;
  filters?: Partial<OpportunityFilterState>;
  viewType?: string;
}

export function useOpportunities(params: UseOpportunitiesParams = {}) {
  const {
    page = 1,
    pageSize = 25,
    search = '',
    sortBy = 'created_at',
    sortOrder = 'desc',
    stage,
    accountId,
    ownerId,
    filters,
    viewType = 'all',
  } = params;

  const supabase = createClient();

  return useQuery<{ opportunities: OpportunityWithRelations[]; totalCount: number }>({
    queryKey: ['opportunities', { page, pageSize, search, sortBy, sortOrder, stage, accountId, ownerId, filters, viewType }],
    queryFn: async () => {
      let query = (supabase as any)
        .from('opportunities_readable')
        .select(
          `
          *,
          account:accounts!account_id(id, name),
          owner:user_profiles!owner_id(id, first_name, last_name, email)
        `,
          { count: 'exact' }
        );

      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const activeOwnerId = ownerId || filters?.ownerId;
      if (activeOwnerId) {
        query = query.eq('owner_id', activeOwnerId);
      }

      // Single stage filter
      if (stage && stage !== 'all') {
        query = query.ilike('stage', `%${stage}%`);
      }

      // Multi-stage filter
      if (filters?.stages && filters.stages.length > 0) {
        query = query.in('stage', filters.stages);
      }

      // Opportunity types
      if (filters?.opportunityTypes && filters.opportunityTypes.length > 0) {
        query = query.in('opportunity_type', filters.opportunityTypes);
      }

      // Lead sources
      if (filters?.leadSources && filters.leadSources.length > 0) {
        query = query.in('lead_source', filters.leadSources);
      }

      // Close date range
      if (filters?.closeDateFrom) {
        query = query.gte('close_date', filters.closeDateFrom);
      }
      if (filters?.closeDateTo) {
        query = query.lte('close_date', filters.closeDateTo);
      }

      // Amount range
      if (filters?.minAmount != null && !isNaN(Number(filters.minAmount))) {
        query = query.gte('amount', Number(filters.minAmount));
      }
      if (filters?.maxAmount != null && !isNaN(Number(filters.maxAmount))) {
        query = query.lte('amount', Number(filters.maxAmount));
      }

      // View Types
      if (viewType === 'won') {
        query = query.or('stage.ilike.%closed_won%,stage.ilike.%closed won%');
      } else if (viewType === 'lost') {
        query = query.or('stage.ilike.%closed_lost%,stage.ilike.%closed lost%');
      }

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.ilike('name', term);
      }

      // Sorting
      let effectiveSortBy = sortBy;
      let effectiveSortOrder = sortOrder;
      if (viewType === 'recently_created') {
        effectiveSortBy = 'created_at';
        effectiveSortOrder = 'desc';
      } else if (viewType === 'recently_modified') {
        effectiveSortBy = 'updated_at';
        effectiveSortOrder = 'desc';
      } else if (viewType === 'oldest_first') {
        effectiveSortBy = 'created_at';
        effectiveSortOrder = 'asc';
      }

      query = query.order(effectiveSortBy, { ascending: effectiveSortOrder === 'asc' });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        opportunities: (data as any) || [],
        totalCount: count || 0,
      };
    },
    staleTime: 1000 * 30,
  });
}

export function useOpportunityDetail(opportunityId: string | null) {
  const supabase = createClient();

  return useQuery<OpportunityWithRelations | null>({
    queryKey: ['opportunity', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return null;
      const { data, error } = await (supabase as any)
        .from('opportunities_readable')
        .select(
          `
          *,
          account:accounts!account_id(id, name),
          owner:user_profiles!owner_id(id, first_name, last_name, email)
        `
        )
        .eq('id', opportunityId)
        .single();

      if (error) throw error;
      return (data as any) || null;
    },
    enabled: Boolean(opportunityId),
  });
}

export function useCreateOpportunityMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (payload: OpportunityInsert) => {
      const { data, error } = await supabase
        .from('opportunities')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
      queryClient.invalidateQueries({ queryKey: ['forecast-pipeline-metrics'] });
    },
  });
}

export function useUpdateOpportunityMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: OpportunityUpdate }) => {
      const { data, error } = await supabase
        .from('opportunities')
        .update(updates)
        .eq('id', id)
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
      queryClient.invalidateQueries({ queryKey: ['forecast-pipeline-metrics'] });
    },
  });
}

export function useReopenOpportunityMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      targetStage = 'prospecting',
      reason,
    }: {
      id: string;
      targetStage?: string;
      reason?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc('reopen_closed_opportunity', {
        p_opportunity_id: id,
        p_target_stage: targetStage,
        p_reopen_reason: reason || 'Reopened by user',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
      queryClient.invalidateQueries({ queryKey: ['forecast-pipeline-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-loss-history', id] });
    },
  });
}

export function useOpportunityLossHistory(opportunityId: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ['opportunity-loss-history', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return [];
      const { data, error } = await (supabase as any)
        .from('crm_opportunity_loss_history')
        .select(
          `
          *,
          closed_by:user_profiles!closed_by_id(first_name, last_name, email),
          reopened_by:user_profiles!reopened_by_id(first_name, last_name, email)
        `
        )
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: Boolean(opportunityId),
  });
}

export function useDeleteOpportunityMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
      queryClient.invalidateQueries({ queryKey: ['forecast-pipeline-metrics'] });
    },
  });
}
