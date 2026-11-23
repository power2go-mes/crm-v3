'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CrmCalendarConnection } from '@/types/calendar';

export function useCalendarConnections() {
  const supabase = createClient() as any;
  const queryClient = useQueryClient();

  const connectionsQuery = useQuery<CrmCalendarConnection[]>({
    queryKey: ['calendar-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_calendar_connections')
        .select('*')
        .order('provider', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const saveConnectionMutation = useMutation({
    mutationFn: async (payload: Partial<CrmCalendarConnection>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const record = {
        ...payload,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('crm_calendar_connections')
        .upsert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_calendar_connections')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
    },
  });

  return {
    connections: connectionsQuery.data || [],
    isLoading: connectionsQuery.isLoading,
    saveConnection: saveConnectionMutation.mutateAsync,
    isSaving: saveConnectionMutation.isPending,
    deleteConnection: deleteConnectionMutation.mutateAsync,
    isDeleting: deleteConnectionMutation.isPending,
  };
}
