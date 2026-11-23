'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { DuplicateCandidate, DuplicateRule, MergeLog } from '@/types/duplicates';

export function useFindDuplicateAccounts(params: {
  name?: string | null;
  phone?: string | null;
  website?: string | null;
  excludeId?: string | null;
  enabled?: boolean;
}) {
  const supabase = createClient();
  const { name, phone, website, excludeId, enabled = true } = params;

  return useQuery<DuplicateCandidate[]>({
    queryKey: ['duplicate-accounts', { name, phone, website, excludeId }],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('find_duplicate_accounts', {
        p_name: name?.trim() || null,
        p_phone: phone?.trim() || null,
        p_website: website?.trim() || null,
        p_exclude_id: excludeId || null,
      });
      if (error) throw error;
      return (data as DuplicateCandidate[]) || [];
    },
    enabled: enabled && Boolean(name || phone || website),
    staleTime: 1000 * 60,
  });
}

export function useFindDuplicateContacts(params: {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  excludeId?: string | null;
  enabled?: boolean;
}) {
  const supabase = createClient();
  const { email, phone, firstName, lastName, excludeId, enabled = true } = params;

  return useQuery<DuplicateCandidate[]>({
    queryKey: ['duplicate-contacts', { email, phone, firstName, lastName, excludeId }],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('find_duplicate_contacts', {
        p_email: email?.trim() || null,
        p_phone: phone?.trim() || null,
        p_first_name: firstName?.trim() || null,
        p_last_name: lastName?.trim() || null,
        p_exclude_id: excludeId || null,
      });
      if (error) throw error;
      return (data as DuplicateCandidate[]) || [];
    },
    enabled: enabled && Boolean(email || phone || (firstName && lastName)),
    staleTime: 1000 * 60,
  });
}

export function useMergeAccountsMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      masterId,
      victimId,
      fieldOverrides = {},
    }: {
      masterId: string;
      victimId: string;
      fieldOverrides?: Record<string, any>;
    }) => {
      const { data, error } = await (supabase as any).rpc('merge_accounts', {
        p_master_id: masterId,
        p_victim_id: victimId,
        p_field_overrides: fieldOverrides,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['merge-logs'] });
    },
  });
}

export function useMergeContactsMutation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      masterId,
      victimId,
      fieldOverrides = {},
    }: {
      masterId: string;
      victimId: string;
      fieldOverrides?: Record<string, any>;
    }) => {
      const { data, error } = await (supabase as any).rpc('merge_contacts', {
        p_master_id: masterId,
        p_victim_id: victimId,
        p_field_overrides: fieldOverrides,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['merge-logs'] });
    },
  });
}

export function useDuplicateRules() {
  const supabase = createClient();
  return useQuery<DuplicateRule[]>({
    queryKey: ['duplicate-rules'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_duplicate_rules')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as DuplicateRule[]) || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useMergeLogs() {
  const supabase = createClient();
  return useQuery<MergeLog[]>({
    queryKey: ['merge-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_merge_logs')
        .select('*')
        .order('merged_at', { ascending: false });
      if (error) throw error;
      return (data as MergeLog[]) || [];
    },
    staleTime: 1000 * 30,
  });
}
