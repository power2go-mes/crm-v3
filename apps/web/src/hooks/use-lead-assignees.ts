'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { leadQueryKey } from '@/lib/leads/query-contract';

export function useLeadAssignees(open: boolean) {
  const { user, roleIds, hasPermission } = useAuth();
  const acrossBranches = roleIds.includes('SUPER_ADMIN');
  const canAssign = hasPermission('leads.update') && (acrossBranches || roleIds.includes('ASM'));
  const query = useQuery({
    queryKey: leadQueryKey(user?.id, 'assignees', acrossBranches),
    enabled: Boolean(open && user && canAssign),
    queryFn: async () => {
      const client = createClient();
      const role = await client.from('roles').select('id').eq('id', 'BDO').eq('is_active', true).maybeSingle();
      if (role.error) throw role.error;
      if (!role.data) return [];
      let bdos = client.from('user_roles').select('user_id').eq('role_id', 'BDO');
      if (!acrossBranches && user) {
        const direct = await client.from('sales_reporting_relationships').select('user_id')
          .eq('manager_id', user.id).eq('is_active', true).limit(501);
        if (direct.error) throw direct.error;
        if (!direct.data.length) return [];
        if (direct.data.length > 500) throw new Error('Too many direct reports to load.');
        bdos = bdos.in('user_id', direct.data.map(row => row.user_id));
      }
      const eligible = await bdos.limit(501);
      if (eligible.error) throw eligible.error;
      if (eligible.data.length > 500) throw new Error('Too many BDOs to load.');
      if (!eligible.data.length) return [];
      const people = await client.from('user_profiles').select('id,first_name,last_name,email')
        .in('id', eligible.data.map(row => row.user_id)).eq('is_active', true).order('first_name').order('id');
      if (people.error) throw people.error;
      return people.data;
    },
  });
  return { ...query, canAssign };
}
