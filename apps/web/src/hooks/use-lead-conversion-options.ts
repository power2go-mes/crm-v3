'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { leadQueryKey } from '@/lib/leads/query-contract';

/** Bounded, authenticated lookups; RLS decides which related records are selectable. */
export function useLeadConversionOptions(open: boolean, search: string, accountId: string | null) {
  const { user, profile, hasPermission, isLoading } = useAuth();
  const client = createClient();
  const term = search.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&');
  return useQuery({
    queryKey: leadQueryKey(user?.id, 'conversion-options', term, accountId),
    enabled: open && !isLoading && !!user && !!profile?.is_active && hasPermission('leads.update'),
    queryFn: async () => {
      const [accounts, contacts, opportunities] = await Promise.all([
        hasPermission('accounts.view') ? client.from('accounts').select('id,name')
          .ilike('name', `%${term}%`).order('name').limit(50) : Promise.resolve({ data: [], error: null }),
        hasPermission('contacts.view') ? client.from('contacts').select('id,first_name,last_name,email')
          .ilike('first_name', `%${term}%`).order('first_name').limit(50) : Promise.resolve({ data: [], error: null }),
        accountId && hasPermission('opportunities.view') ? client.from('opportunities').select('id,name')
          .eq('account_id', accountId).ilike('name', `%${term}%`).order('name').limit(50) : Promise.resolve({ data: [], error: null }),
      ]);
      if (accounts.error || contacts.error || opportunities.error) throw new Error('Unable to load authorized conversion records');
      return { accounts: accounts.data ?? [], contacts: contacts.data ?? [], opportunities: opportunities.data ?? [] };
    },
  });
}
