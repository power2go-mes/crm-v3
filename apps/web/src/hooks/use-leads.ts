'use client';

import type { LeadCustomValues } from '@/components/leads/lead-custom-form-fields';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { leadQueryKey, leadSearchExpression, leadWindow, leadViewType } from '@/lib/leads/query-contract';
import { z } from 'zod';
import type {
  LeadWithRelations,
  LeadInsert,
  LeadUpdate,
  LeadFilterState,
  LeadPaginationState,
  LeadConversionPayload,
  LeadStatusRow,
  LeadActivityRow,
  LeadHistoryRow,
} from '@/types/leads';

export function useLeadStatuses() {
  const supabase = createClient();
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  return useQuery<LeadStatusRow[]>({
    queryKey: leadQueryKey(user?.id, 'statuses'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !authLoading && Boolean(user && profile?.is_active && hasPermission('leads.view')),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useLeads(
  pagination: LeadPaginationState,
  filters: LeadFilterState,
  viewType: string = 'all',
  enabled = true
) {
  const supabase = createClient();
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();

  return useQuery<{ leads: LeadWithRelations[]; totalCount: number }>({
    queryKey: leadQueryKey(user?.id, 'list', pagination, filters, viewType),
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select(
          `
          *,
          lead_owner:user_profiles!lead_owner_id(id, first_name, last_name, email),
          sub_owner:user_profiles!sub_owner_id(id, first_name, last_name, email)
        `,
          { count: 'exact' }
        );

      leadWindow.parse(pagination);
      leadViewType.parse(viewType);
      if (viewType === 'recently_viewed') {
        const recent = await supabase.rpc('crm_shared_personalization', { m: 'leads' });
        if (recent.error) throw new Error('Recently viewed records are unavailable.');
        const ids = z.object({ recent: z.array(z.object({ record_id: z.string().uuid() })) })
          .parse(recent.data).recent.map(record => record.record_id);
        if (!ids.length) return { leads: [], totalCount: 0 };
        query = query.in('id', ids);
      }
      // Handle View Type presets
      if (viewType === 'converted') {
        query = query.eq('is_convert', true);
      } else if (viewType === 'recently_created') {
        query = query.eq('is_convert', false).order('created_at', { ascending: false });
      } else {
        // Default 'all' or standard view excludes already converted leads from main view unless converted view requested
        query = query.eq('is_convert', false);
      }

      // Search (title, company, first_name, last_name, email, phone)
      if (filters.search && filters.search.trim()) {
        query = query.or(leadSearchExpression(filters.search));
      }

      // Filter by status (multi-select)
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      // Filter by source (multi-select)
      if (filters.source && filters.source.length > 0) {
        query = query.in('lead_source', filters.source);
      }

      // Filter by industry
      if (filters.industry && filters.industry.length > 0) {
        query = query.in('industry', filters.industry);
      }

      // Filter by Owner
      if (filters.ownerId) {
        query = query.eq('lead_owner_id', filters.ownerId);
      }

      // Filter by Assigned BDO (sub_owner)
      if (filters.subOwnerId) {
        query = query.eq('sub_owner_id', filters.subOwnerId);
      }

      // Date ranges
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      // Annual revenue range
      if (filters.minRevenue != null && !isNaN(Number(filters.minRevenue))) {
        query = query.gte('annual_revenue', Number(filters.minRevenue));
      }
      if (filters.maxRevenue != null && !isNaN(Number(filters.maxRevenue))) {
        query = query.lte('annual_revenue', Number(filters.maxRevenue));
      }

      // Sorting
      const sortCol = viewType === 'recently_modified' ? 'updated_at' :
        ['recently_created', 'oldest_first'].includes(viewType) ? 'created_at' : pagination.sortBy;
      const isAsc = viewType === 'oldest_first' || (!['recently_created', 'recently_modified'].includes(viewType) && pagination.sortOrder === 'asc');
      query = query.order(sortCol, { ascending: isAsc }).order('id', { ascending: true });

      // Server-side pagination window
      const from = (pagination.page - 1) * pagination.pageSize;
      const to = from + pagination.pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        leads: (data as any) || [],
        totalCount: count || 0,
      };
    },
    enabled: enabled && !authLoading && Boolean(user && profile?.is_active && hasPermission('leads.view')),
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useLeadDetail(leadId: string | null) {
  const supabase = createClient();
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();

  return useQuery<LeadWithRelations | null>({
    queryKey: leadQueryKey(user?.id, 'detail', leadId),
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('leads')
        .select(
          `
          *,
          lead_owner:user_profiles!lead_owner_id(id, first_name, last_name, email),
          sub_owner:user_profiles!sub_owner_id(id, first_name, last_name, email)
        `
        )
        .eq('id', leadId)
        .single();

      if (error) throw error;
      return (data as any) || null;
    },
    enabled: !authLoading && Boolean(leadId && user && profile?.is_active && hasPermission('leads.view')),
  });
}

export function useLeadActivities(leadId: string | null) {
  const supabase = createClient();
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();

  return useQuery<LeadActivityRow[]>({
    queryKey: leadQueryKey(user?.id, 'activities', leadId),
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !authLoading && Boolean(leadId && user && profile?.is_active && hasPermission('leads.view')),
  });
}

export function useLeadHistory(leadId: string | null) {
  const supabase = createClient();
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();

  return useQuery<LeadHistoryRow[]>({
    queryKey: leadQueryKey(user?.id, 'history', leadId),
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !authLoading && Boolean(leadId && user && profile?.is_active && hasPermission('leads.view')),
  });
}

export function useSaveLeadForm() {
  const { user } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, standard, custom }: { id?: string; standard: LeadInsert | LeadUpdate; custom: LeadCustomValues }) => {
      const { data, error } = await createClient().rpc('lead_save_form', {
        p_id: id ?? null, p_standard: standard, p_custom: custom,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'list').slice(0, 3) }),
  });
}

export function useCreateLeadMutation() {
  const supabase = createClient();
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LeadInsert) => {
      if (!user || !profile?.is_active || !hasPermission('leads.create')) throw new Error('Permission denied');
      const { data, error } = await supabase
        .from('leads')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'list') });
      queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'chart') });
    },
  });
}

export function useUpdateLeadMutation() {
  const supabase = createClient();
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: LeadUpdate }) => {
      if (!user || !profile?.is_active || !hasPermission('leads.update')) throw new Error('Permission denied');
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'list') });
      queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'chart') });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'detail', data.id) });
        queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'history', data.id) });
      }
    },
  });
}

export function useDeleteLeadMutation() {
  const supabase = createClient();
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user || !profile?.is_active || !hasPermission('leads.delete')) throw new Error('Permission denied');
      const { error } = await supabase.rpc('lead_archive_selected', { p_ids: [id] });
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'list').slice(0, 3) });
    },
  });
}

export function useBulkDeleteLeadsMutation() {
  const supabase = createClient();
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user || !profile?.is_active || !hasPermission('leads.delete')) throw new Error('Permission denied');
      const { error } = await supabase.rpc('lead_archive_selected', { p_ids: ids });
      if (error) throw error;
      return ids;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'list').slice(0, 3) });
    },
  });
}

export function useBulkUpdateLeadsMutation() {
  const { user } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, field, value }: { ids: string[]; field: string; value: string }) => {
      const { error } = await createClient().rpc('lead_bulk_edit', { p_ids: ids, p_field: field, p_value: value });
      if (error) throw error;
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'list').slice(0, 3) }),
  });
}

export function useConvertLeadMutation() {
  const supabase = createClient();
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LeadConversionPayload) => {
      if (!user || !profile?.is_active || !hasPermission('leads.update')) throw new Error('Permission denied');
      const { data, error } = await supabase.rpc('convert_lead', {
        p_lead_id: payload.leadId,
        p_account_action: payload.accountAction,
        p_account_id: payload.accountId || null,
        p_account_name: payload.accountName || null,
        p_contact_action: payload.contactAction,
        p_contact_id: payload.contactId || null,
        p_contact_first_name: payload.contactFirstName || null,
        p_contact_last_name: payload.contactLastName || null,
        p_opportunity_action: payload.opportunityAction,
        p_opportunity_id: payload.opportunityId || null,
        p_opportunity_name: payload.opportunityName || null,
        p_opportunity_amount: payload.opportunityAmount ?? null,
        p_opportunity_close_date: payload.opportunityCloseDate || null,
        p_owner_id: payload.ownerId || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'list') });
      queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'chart') });
      queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'detail', variables.leadId) });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function useAddLeadActivityMutation() {
  const supabase = createClient();
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      leadId: string;
      activityType: 'task' | 'meeting' | 'call' | 'note';
      subject: string;
      description?: string;
    }) => {
      const { data, error } = await supabase
        .from('lead_activities')
        .insert({
          lead_id: payload.leadId,
          activity_type: payload.activityType,
          subject: payload.subject,
          description: payload.description || null,
          status: 'completed',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'activities', variables.leadId) });
    },
  });
}
