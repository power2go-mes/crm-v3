'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CrmEmailAccount, CrmEmailTemplate, CrmEmail } from '@/types/email';

export function useEmailAccounts() {
  const supabase = createClient() as any;
  const queryClient = useQueryClient();

  const accountsQuery = useQuery<CrmEmailAccount[]>({
    queryKey: ['email-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_email_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const saveAccountMutation = useMutation({
    mutationFn: async (payload: Partial<CrmEmailAccount>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      let data, error;
      if (payload.id) {
        // Partial update for existing account
        const res = await supabase
          .from('crm_email_accounts')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payload.id)
          .select()
          .single();
        data = res.data;
        error = res.error;
      } else {
        // Insert new account
        const toInsert = {
          ...payload,
          user_id: user.id,
          auth_status: payload.auth_status || 'unconfigured',
          updated_at: new Date().toISOString(),
        };
        const res = await supabase
          .from('crm_email_accounts')
          .insert(toInsert)
          .select()
          .single();
        data = res.data;
        error = res.error;
      }

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_email_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
    },
  });

  return {
    accounts: accountsQuery.data || [],
    isLoading: accountsQuery.isLoading,
    isError: accountsQuery.isError,
    refetch: accountsQuery.refetch,
    saveAccount: saveAccountMutation.mutateAsync,
    isSaving: saveAccountMutation.isPending,
    deleteAccount: deleteAccountMutation.mutateAsync,
    isDeleting: deleteAccountMutation.isPending,
  };
}

export function useEmailTemplates() {
  const supabase = createClient() as any;
  const queryClient = useQueryClient();

  const templatesQuery = useQuery<CrmEmailTemplate[]>({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_email_templates')
        .select(`
          *,
          creator:user_profiles!created_by_id(first_name, last_name, email)
        `)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (payload: Partial<CrmEmailTemplate>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const record = {
        ...payload,
        created_by_id: payload.created_by_id || user.id,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('crm_email_templates')
        .upsert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
  });

  return {
    templates: templatesQuery.data || [],
    isLoading: templatesQuery.isLoading,
    saveTemplate: saveTemplateMutation.mutateAsync,
    isSaving: saveTemplateMutation.isPending,
    deleteTemplate: deleteTemplateMutation.mutateAsync,
    isDeleting: deleteTemplateMutation.isPending,
  };
}

export function useRecordEmails(relatedToType: string, relatedToId: string) {
  const supabase = createClient() as any;
  const queryClient = useQueryClient();

  const emailsQuery = useQuery<CrmEmail[]>({
    queryKey: ['record-emails', relatedToType, relatedToId],
    enabled: Boolean(relatedToId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_emails')
        .select('*')
        .eq('related_to_type', relatedToType)
        .eq('related_to_id', relatedToId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (payload: {
      recipient_email: string;
      recipient_name?: string;
      cc_emails?: string[];
      bcc_emails?: string[];
      subject: string;
      body_html: string;
      template_id?: string | null;
      is_draft?: boolean;
    }) => {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          related_to_type: relatedToType,
          related_to_id: relatedToId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch email');
      }

      return data.email || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record-emails', relatedToType, relatedToId] });
    },
  });

  return {
    emails: emailsQuery.data || [],
    isLoading: emailsQuery.isLoading,
    sendEmail: sendEmailMutation.mutateAsync,
    isSending: sendEmailMutation.isPending,
  };
}
