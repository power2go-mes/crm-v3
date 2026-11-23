'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { QuoteRecord, QuoteLineItemRecord, QuoteRevisionRecord } from '@/types/quotes';

export function useOpportunityQuotes(oppId?: string | null) {
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  return useQuery<QuoteRecord[]>({
    queryKey: ['opportunity-quotes', oppId],
    enabled: !authLoading && !!user && !!profile?.is_active && !!oppId && hasPermission('quotes.view'),
    queryFn: async () => {
      if (!oppId) return [];

      const { data, error } = await (supabase as any)
        .from('crm_quotes')
        .select(`
          *,
          account:accounts(id, name),
          contact:contacts(id, first_name, last_name, email)
        `)
        .eq('opportunity_id', oppId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as QuoteRecord[]) || [];
    },
  });
}

export function useQuoteDetails(quoteId?: string | null) {
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  return useQuery<{ quote: QuoteRecord; items: QuoteLineItemRecord[] } | null>({
    queryKey: ['quote-detail', quoteId],
    enabled: !authLoading && !!user && !!profile?.is_active && !!quoteId && hasPermission('quotes.view'),
    queryFn: async () => {
      if (!quoteId) return null;

      const [quoteRes, itemsRes] = await Promise.all([
        (supabase as any)
          .from('crm_quotes')
          .select(`
            *,
            opportunity:opportunities(id, name),
            account:accounts(id, name),
            contact:contacts(id, first_name, last_name, email)
          `)
          .eq('id', quoteId)
          .single(),
        (supabase as any)
          .from('crm_quote_line_items')
          .select('*')
          .eq('quote_id', quoteId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

      if (quoteRes.error) throw quoteRes.error;
      if (itemsRes.error) throw itemsRes.error;

      return {
        quote: quoteRes.data as QuoteRecord,
        items: (itemsRes.data as QuoteLineItemRecord[]) || [],
      };
    },
  });
}

export function useQuoteRevisions(quoteId?: string | null) {
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  return useQuery<QuoteRevisionRecord[]>({
    queryKey: ['quote-revisions', quoteId],
    enabled: !authLoading && !!user && !!profile?.is_active && !!quoteId && hasPermission('quotes.view'),
    queryFn: async () => {
      if (!quoteId) return [];

      const { data, error } = await (supabase as any)
        .from('crm_quote_revisions')
        .select('*')
        .eq('quote_id', quoteId)
        .order('revision_number', { ascending: false });

      if (error) throw error;
      return (data as QuoteRevisionRecord[]) || [];
    },
  });
}
