'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type {
  CampaignRecord,
  CampaignMemberWithDetails,
  CampaignWithRelations,
  CampaignMemberStatus,
  CampaignFilterState,
} from '@/types/campaigns';

export interface UseCampaignsListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Partial<CampaignFilterState>;
  viewType?: string;
}

export function useCampaignsList(params: UseCampaignsListParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    search = '',
    sortBy = 'created_at',
    sortOrder = 'desc',
    filters,
    viewType = 'all',
  } = params;

  const supabase = createClient();
  const { user, profile, permissions, roleIds, hasPermission, isLoading } = useAuth();
  const signature = [...roleIds, ...permissions].sort().join('|');

  return useQuery<{ campaigns: CampaignWithRelations[]; totalCount: number }>({
    queryKey: ['campaigns-list', user?.id, signature, { page, pageSize, search, sortBy, sortOrder, filters, viewType }],
    enabled: !isLoading && !!user && !!profile?.is_active && hasPermission('campaigns.view'),
    queryFn: async () => {
      let query = (supabase as any)
        .from('campaigns_readable')
        .select(
          `
          *,
          owner:user_profiles!campaign_owner_id(id, first_name, last_name, email),
          parent_campaign:campaigns_readable!parent_campaign_id(id, campaign_name)
        `,
          { count: 'exact' }
        );

      if (search.trim()) {
        const term = `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`;
        query = query.ilike('campaign_name', term);
      }

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.campaignType && filters.campaignType.length > 0) {
        query = query.in('campaign_type', filters.campaignType);
      }

      if (filters?.startDateFrom) {
        query = query.gte('start_date', filters.startDateFrom);
      }
      if (filters?.startDateTo) {
        query = query.lte('start_date', filters.startDateTo);
      }

      if (filters?.endDateFrom) {
        query = query.gte('end_date', filters.endDateFrom);
      }
      if (filters?.endDateTo) {
        query = query.lte('end_date', filters.endDateTo);
      }

      if (filters?.minExpectedRevenue != null && !isNaN(Number(filters.minExpectedRevenue))) {
        query = query.gte('expected_revenue', Number(filters.minExpectedRevenue));
      }
      if (filters?.maxExpectedRevenue != null && !isNaN(Number(filters.maxExpectedRevenue))) {
        query = query.lte('expected_revenue', Number(filters.maxExpectedRevenue));
      }

      if (filters?.minBudgetCost != null && !isNaN(Number(filters.minBudgetCost))) {
        query = query.gte('budget_cost', Number(filters.minBudgetCost));
      }
      if (filters?.maxBudgetCost != null && !isNaN(Number(filters.maxBudgetCost))) {
        query = query.lte('budget_cost', Number(filters.maxBudgetCost));
      }

      if (viewType === 'active') {
        query = query.in('status', ['planned', 'in_progress']);
      } else if (viewType === 'completed') {
        query = query.eq('status', 'completed');
      }

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

      const campaigns = ((data as any[]) || []).map((c) => ({
        ...c,
        parent_campaign: Array.isArray(c.parent_campaign) ? (c.parent_campaign[0] ?? null) : (c.parent_campaign ?? null),
        owner: Array.isArray(c.owner) ? (c.owner[0] ?? null) : (c.owner ?? null),
      })) as CampaignWithRelations[];

      return {
        campaigns,
        totalCount: count || 0,
      };
    },
    staleTime: 1000 * 30,
  });
}

export function useCampaign(id?: string) {
  const supabase = createClient();

  return useQuery<CampaignWithRelations | null>({
    queryKey: ['campaign', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await (supabase as any)
        .from('campaigns_readable')
        .select(`
          *,
          owner:user_profiles!campaign_owner_id(id, first_name, last_name, email),
          parent_campaign:campaigns_readable!parent_campaign_id(id, campaign_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        parent_campaign: Array.isArray(data.parent_campaign) ? (data.parent_campaign[0] ?? null) : (data.parent_campaign ?? null),
        owner: Array.isArray(data.owner) ? (data.owner[0] ?? null) : (data.owner ?? null),
      } as CampaignWithRelations;
    },
  });
}

export function useCampaignMembers(campaignId?: string) {
  const supabase = createClient();

  return useQuery<CampaignMemberWithDetails[]>({
    queryKey: ['campaign-members', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from('campaign_members')
        .select(`
          *,
          lead:leads(id, first_name, last_name, company_name, email),
          contact:contacts(id, first_name, last_name, email)
        `)
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false }).limit(100);

      if (error) throw error;
      return (data as unknown as CampaignMemberWithDetails[]) || [];
    },
  });
}

export function useAddCampaignMember() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (payload: {
      campaign_id: string;
      member_type: 'lead' | 'contact';
      lead_id?: string | null;
      contact_id?: string | null;
      member_status?: CampaignMemberStatus;
    }) => {
      const { data, error } = await supabase
        .from('campaign_members')
        .insert({
          campaign_id: payload.campaign_id,
          member_type: payload.member_type,
          lead_id: payload.member_type === 'lead' ? payload.lead_id : null,
          contact_id: payload.member_type === 'contact' ? payload.contact_id : null,
          member_status: payload.member_status || 'planned',
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-members', variables.campaign_id] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaign_id] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
    },
  });
}

export function useUpdateCampaignMemberStatus() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      campaignId,
      status,
    }: {
      id: string;
      campaignId: string;
      status: CampaignMemberStatus;
    }) => {
      const { data, error } = await supabase
        .from('campaign_members')
        .update({ member_status: status } as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-members', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
    },
  });
}

export function useDeleteCampaignMember() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const { error } = await supabase
        .from('campaign_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-members', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
    },
  });
}

export function useDeleteCampaignMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}

export function useBulkDeleteCampaignsMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('campaigns').delete().in('id', ids);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}

export function useCampaignOpportunities(campaignId?: string) {
  const supabase = createClient();
  const { user, profile, permissions, roleIds, hasPermission, isLoading } = useAuth();

  return useQuery({
    queryKey: ['crm', user?.id, 'campaigns', 'opportunities', campaignId, [...roleIds, ...permissions].sort().join('|')],
    enabled: !isLoading && !!user && !!profile?.is_active && !!campaignId && hasPermission('campaigns.view') && hasPermission('opportunities.view'),
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await (supabase as any)
        .from('opportunities_readable')
        .select('*, account:accounts(id, name)')
        .eq('primary_campaign_source_id', campaignId)
        .order('created_at', { ascending: false }).limit(100);

      if (error) {
        throw error;
      }
      return data || [];
    },
  });
}

export function useChildCampaigns(campaignId?: string) {
  const supabase = createClient();

  return useQuery<CampaignRecord[]>({
    queryKey: ['child-campaigns', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await (supabase as any)
        .from('campaigns_readable')
        .select('*')
        .eq('parent_campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as CampaignRecord[]) || [];
    },
  });
}
