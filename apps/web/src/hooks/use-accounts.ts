'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type {
  AccountWithRelations,
  AccountInsert,
  AccountUpdate,
  AccountFilterState,
} from '@/types/accounts';

export interface UseAccountsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Partial<AccountFilterState>;
  viewType?: string;
}

export function useAccounts(params: UseAccountsParams = {}) {
  const {
    page = 1,
    pageSize = 25,
    search = '',
    sortBy = 'created_at',
    sortOrder = 'desc',
    filters,
    viewType = 'all',
  } = params;

  const supabase = createClient();

  return useQuery<{ accounts: AccountWithRelations[]; totalCount: number }>({
    queryKey: ['accounts', { page, pageSize, search, sortBy, sortOrder, filters, viewType }],
    queryFn: async () => {
      let query = (supabase as any)
        .from('accounts_readable')
        .select(
          `
          *,
          account_owner:user_profiles!account_owner_id(id, first_name, last_name, email)
        `,
          { count: 'exact' }
        );

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(
          `name.ilike.${term},website.ilike.${term},industry.ilike.${term}`
        );
      }

      if (filters?.accountTypes && filters.accountTypes.length > 0) {
        query = query.in('account_type', filters.accountTypes);
      }

      if (filters?.industries && filters.industries.length > 0) {
        query = query.in('industry', filters.industries);
      }

      if (filters?.accountSources && filters.accountSources.length > 0) {
        query = query.in('account_source', filters.accountSources);
      }

      if (filters?.ownership && filters.ownership.length > 0) {
        query = query.in('ownership', filters.ownership);
      }

      if (filters?.ownerId) {
        query = query.eq('account_owner_id', filters.ownerId);
      }

      if (filters?.minRevenue != null && !isNaN(Number(filters.minRevenue))) {
        query = query.gte('annual_revenue', Number(filters.minRevenue));
      }
      if (filters?.maxRevenue != null && !isNaN(Number(filters.maxRevenue))) {
        query = query.lte('annual_revenue', Number(filters.maxRevenue));
      }

      if (filters?.createdDateFrom) {
        query = query.gte('created_at', filters.createdDateFrom);
      }
      if (filters?.createdDateTo) {
        query = query.lte('created_at', filters.createdDateTo + 'T23:59:59.999Z');
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

      // Sorting
      query = query.order(effectiveSortBy, { ascending: effectiveSortOrder === 'asc' });

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        accounts: (data as any) || [],
        totalCount: count || 0,
      };
    },
    staleTime: 1000 * 30,
  });
}

export function useAccountDetail(accountId: string | null) {
  const supabase = createClient();

  return useQuery<AccountWithRelations | null>({
    queryKey: ['account', accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data, error } = await (supabase as any)
        .from('accounts_readable')
        .select(
          `
          *,
          account_owner:user_profiles!account_owner_id(id, first_name, last_name, email)
        `
        )
        .eq('id', accountId)
        .single();

      if (error) throw error;
      return (data as any) || null;
    },
    enabled: Boolean(accountId),
  });
}

export function useAccountContacts(accountId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['account_contacts', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await (supabase as any)
        .from('contacts_readable')
        .select('*')
        .eq('account_id', accountId)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(accountId),
  });
}

export function useAccountOpportunities(accountId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['account_opportunities', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await (supabase as any)
        .from('opportunities_readable')
        .select('*')
        .eq('account_id', accountId)
        .order('close_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(accountId),
  });
}

export function useCreateAccountMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (payload: AccountInsert) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}

export function useUpdateAccountMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: AccountUpdate }) => {
      const { data, error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}

export function useDeleteAccountMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}
