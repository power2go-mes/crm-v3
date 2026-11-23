'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type {
  ContactWithRelations,
  SaveContactInput,
  ContactFilterState,
} from '@/types/contacts';
import { saveContact } from '@/app/(dashboard)/contacts/actions';

export interface UseContactsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  accountId?: string;
  filters?: Partial<ContactFilterState>;
  viewType?: string;
}

export function useContacts(params: UseContactsParams = {}) {
  const {
    page = 1,
    pageSize = 20, // CRM v2 default for contacts is 20
    search = '',
    sortBy = 'created_at',
    sortOrder = 'desc',
    accountId,
    filters,
    viewType = 'all',
  } = params;

  const supabase = createClient();

  return useQuery<{ contacts: ContactWithRelations[]; totalCount: number }>({
    queryKey: ['contacts', { page, pageSize, search, sortBy, sortOrder, accountId, filters, viewType }],
    queryFn: async () => {
      let query = (supabase as any)
        .from('contacts_readable')
        .select(
          `
          *,
          account:accounts!account_id(id, name),
          parent_contact:contacts_readable!parent_contact_id(id, first_name, last_name),
          contact_owner:user_profiles!contact_owner_id(id, first_name, last_name, email)
        `,
          { count: 'exact' }
        );

      const targetAccountId = accountId || filters?.accountId;
      if (targetAccountId) {
        query = query.eq('account_id', targetAccountId);
      }

      if (filters?.ownerId) {
        query = query.eq('contact_owner_id', filters.ownerId);
      }

      if (filters?.sources && filters.sources.length > 0) {
        query = query.in('contact_source', filters.sources);
      }

      if (filters?.isPrimary !== undefined && filters?.isPrimary !== null) {
        query = query.eq('is_primary', filters.isPrimary);
      }

      if (filters?.createdDateFrom) {
        query = query.gte('created_at', filters.createdDateFrom);
      }
      if (filters?.createdDateTo) {
        query = query.lte('created_at', filters.createdDateTo + 'T23:59:59.999Z');
      }

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(
          `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},contact_number.ilike.${term}`
        );
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

      return {
        contacts: (data as any) || [],
        totalCount: count || 0,
      };
    },
    staleTime: 1000 * 30,
  });
}

export function useContactDetail(contactId: string | null) {
  const supabase = createClient();

  return useQuery<ContactWithRelations | null>({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data, error } = await (supabase as any)
        .from('contacts_readable')
        .select(
          `
          *,
          account:accounts!account_id(id, name),
          parent_contact:contacts_readable!parent_contact_id(id, first_name, last_name),
          contact_owner:user_profiles!contact_owner_id(id, first_name, last_name, email)
        `
        )
        .eq('id', contactId)
        .single();

      if (error) throw error;
      return (data as any) || null;
    },
    enabled: Boolean(contactId),
  });
}

export function useCreateContactMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const sanitized = {
        ...payload,
        first_name: payload.first_name ? String(payload.first_name).trim() : '',
        last_name: payload.last_name ? String(payload.last_name).trim() : '',
        email: payload.email ? String(payload.email).trim() : '',
        relationships: payload.relationships ?? [],
      };
      const result = await saveContact(sanitized);
      if (result && 'error' in result && result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['contact', data.id] });
      }
    },
  });
}

export function useUpdateContactMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; updates: any } | any) => {
      const id = input.id;
      const updates = input.updates || input;
      const sanitized: any = {
        id,
        ...updates,
        first_name: updates.first_name ? String(updates.first_name).trim() : '',
        last_name: updates.last_name ? String(updates.last_name).trim() : '',
        email: updates.email ? String(updates.email).trim() : '',
      };
      if ('relationships' in updates) {
        sanitized.relationships = updates.relationships;
      }
      const result = await saveContact(sanitized);
      if (result && 'error' in result && result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['contact', data.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}

export function useDeleteContactMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}
