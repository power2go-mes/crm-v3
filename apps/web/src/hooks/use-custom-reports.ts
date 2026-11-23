'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CrmCustomReport, CustomReportExecutionResult } from '@/types/custom-reports';

export function useCustomReports() {
  const supabase = createClient() as any;
  const queryClient = useQueryClient();

  const reportsQuery = useQuery<CrmCustomReport[]>({
    queryKey: ['custom-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_custom_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const saveReportMutation = useMutation({
    mutationFn: async (payload: Partial<CrmCustomReport>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const record = {
        ...payload,
        created_by_id: payload.created_by_id || user.id,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('crm_custom_reports')
        .upsert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-reports'] });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_custom_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-reports'] });
    },
  });

  return {
    reports: reportsQuery.data || [],
    isLoading: reportsQuery.isLoading,
    saveReport: saveReportMutation.mutateAsync,
    isSaving: saveReportMutation.isPending,
    deleteReport: deleteReportMutation.mutateAsync,
  };
}

export function useExecuteCustomReport(reportConfig: any, enabled = true) {
  const supabase = createClient() as any;

  return useQuery<CustomReportExecutionResult>({
    queryKey: ['execute-custom-report', reportConfig],
    enabled: Boolean(enabled && reportConfig?.primary_module),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('execute_custom_report', {
        p_report_id: reportConfig.id || null,
        p_config: reportConfig,
      });

      if (error) throw error;
      return data;
    },
  });
}
