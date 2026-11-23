'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CrmWorkflowRule, CrmWorkflowLog } from '@/types/automation';

export function useWorkflowRules() {
  const supabase = createClient() as any;
  const queryClient = useQueryClient();

  const rulesQuery = useQuery<CrmWorkflowRule[]>({
    queryKey: ['workflow-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_workflow_rules')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const saveRuleMutation = useMutation({
    mutationFn: async (payload: Partial<CrmWorkflowRule>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const record = {
        ...payload,
        created_by_id: payload.created_by_id || user?.id || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('crm_workflow_rules')
        .upsert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-rules'] });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('crm_workflow_rules')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-rules'] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_workflow_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-rules'] });
    },
  });

  return {
    rules: rulesQuery.data || [],
    isLoading: rulesQuery.isLoading,
    saveRule: saveRuleMutation.mutateAsync,
    isSaving: saveRuleMutation.isPending,
    toggleRule: toggleRuleMutation.mutateAsync,
    deleteRule: deleteRuleMutation.mutateAsync,
  };
}

export function useWorkflowLogs() {
  const supabase = createClient() as any;

  return useQuery<CrmWorkflowLog[]>({
    queryKey: ['workflow-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_workflow_logs')
        .select(`
          *,
          rule:crm_workflow_rules!rule_id(name)
        `)
        .order('executed_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });
}
