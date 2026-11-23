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

      const toInsert = {
        ...payload,
        user_id: user.id,
        auth_status: payload.auth_status || 'unconfigured',
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('crm_email_accounts')
        .upsert(toInsert)
        .select()
        .single();

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Check if user has connected email account
      const { data: accounts } = await supabase
        .from('crm_email_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('auth_status', 'connected')
        .limit(1);

      const hasConnectedAccount = accounts && accounts.length > 0;

      let emailStatus: string = 'draft';
      let errorMsg: string | null = null;

      if (!payload.is_draft) {
        if (!hasConnectedAccount) {
          emailStatus = 'failed';
          errorMsg = 'No connected email account with active OAuth credentials found. Configure Gmail or Outlook in Settings -> Email.';
        } else {
          // If connected, set status
          emailStatus = 'provider_accepted';
        }
      }

      const emailRecord = {
        user_id: user.id,
        related_to_type: relatedToType,
        related_to_id: relatedToId,
        recipient_email: payload.recipient_email,
        recipient_name: payload.recipient_name || null,
        cc_emails: payload.cc_emails || [],
        bcc_emails: payload.bcc_emails || [],
        subject: payload.subject,
        body_html: payload.body_html,
        template_id: payload.template_id || null,
        status: emailStatus,
        error_message: errorMsg,
        provider: hasConnectedAccount ? accounts[0].provider : null,
        sent_at: emailStatus === 'provider_accepted' ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from('crm_emails')
        .insert(emailRecord)
        .select()
        .single();

      if (error) throw error;
      return data;
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
