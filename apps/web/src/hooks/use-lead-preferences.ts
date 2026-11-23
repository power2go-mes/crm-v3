'use client';
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { leadQueryKey } from '@/lib/leads/query-contract';
const response = z.object({
  preferences: z.array(z.object({ context: z.string(), url_name: z.string(),
    state: z.object({ pinnedView: z.string().nullable().optional() }).passthrough() })),
  recent: z.array(z.object({ record_id: z.string().uuid(), viewed_at: z.string() })),
});
export function useLeadPreferences() {
  const { user, profile, hasPermission, isLoading } = useAuth();
  return useQuery({
    queryKey: leadQueryKey(user?.id, 'preferences'),
    enabled: !isLoading && Boolean(user && profile?.is_active && hasPermission('leads.view')),
    queryFn: async () => {
      const result = await createClient().rpc('crm_shared_personalization', { m: 'leads' });
      if (result.error) throw new Error('Saved view preferences are unavailable.');
      return response.parse(result.data);
    },
  });
}
export function usePinLeadView() {
  const { user, hasPermission } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (pinnedView: string | null) => {
      if (!user || !hasPermission('leads.view')) throw new Error('Permission denied');
      const result = await createClient().rpc('crm_shared_personalization', { m: 'leads' });
      if (result.error) throw new Error('Saved view preferences are unavailable.');
      const data = response.parse(result.data);
      const existing = data.preferences.find(p => p.context === '' && p.url_name === 'leads_list')?.state;
      const saved = await createClient().rpc('crm_shared_preferences', {
        m: 'leads', ctx: '', url: 'leads_list', s: { ...existing, pinnedView },
      });
      if (saved.error) throw new Error('The default view could not be saved.');
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'preferences') }),
  });
}
export function useRecordLeadVisit(id: string | null) {
  const { user, hasPermission } = useAuth();
  const cache = useQueryClient();
  const recorded = useRef('');
  const mutation = useMutation({
    mutationFn: async (record: string) => {
      const result = await createClient().rpc('crm_shared_touch_record', { m: 'leads', rid: record });
      if (result.error) throw new Error('Recently viewed history could not be saved.');
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: leadQueryKey(user?.id, 'preferences') }),
  });
  const { mutate } = mutation;
  useEffect(() => {
    if (!user || !id || !hasPermission('leads.view')) return;
    const key = user.id + ':' + id;
    if (recorded.current !== key) { recorded.current = key; mutate(id); }
  }, [user, id, hasPermission, mutate]);
  return mutation;
}
