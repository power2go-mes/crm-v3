'use client';

import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { leadQueryKey } from '@/lib/leads/query-contract';

export const metadata = z.object({
  fields: z.array(z.object({ key: z.string(), label: z.string(), required: z.boolean(),
    is_custom: z.boolean(), access: z.string(), type: z.string(), choices: z.array(z.unknown()) })),
  layout: z.array(z.object({ field: z.string(), sequence: z.number(), visible: z.boolean() })).nullable(),
});

export function useLeadFormMetadata(open: boolean) {
  const { user, permissions, roleIds } = useAuth();
  return useQuery({
    queryKey: leadQueryKey(user?.id, 'form-metadata', [...permissions, ...roleIds].sort()),
    enabled: open && Boolean(user),
    queryFn: async () => {
      const client = createClient();
      const [details, registry] = await Promise.all([
        client.rpc('crm_shared_metadata', { m: 'leads' }),
        client.from('crm_field_definitions').select('key').eq('module', 'leads').eq('is_custom', false),
      ]);
      if (details.error || registry.error) throw details.error ?? registry.error;
      const parsed = metadata.parse(details.data);
      const access: Record<string, string> = {};
      for (const { key } of registry.data ?? []) access[key] = 'hidden';
      for (const field of parsed.fields) if (!field.is_custom) access[field.key] = field.access;
      return { ...parsed, access };
    },
  });
}

const layoutEvent = 'crm:lead-form-layout';
function subscribeLayout(callback: () => void) {
  window.addEventListener(layoutEvent, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(layoutEvent, callback);
    window.removeEventListener('storage', callback);
  };
}

export function useLeadFormLayoutPreference() {
  const { user } = useAuth();
  const key = 'crm:lead-form-layout:' + (user?.id ?? '');
  const configured = useSyncExternalStore(subscribeLayout, () => {
    try { return Boolean(user && window.localStorage.getItem(key) === 'configured'); }
    catch { return false; }
  }, () => false);
  function setConfigured(value: boolean) {
    if (!user) return;
    try {
      window.localStorage.setItem(key, value ? 'configured' : 'default');
      window.dispatchEvent(new Event(layoutEvent));
    } catch { /* Forms remain usable when browser storage is unavailable. */ }
  }
  return [configured, setConfigured] as const;
}

export function missingLeadFormField(data: z.infer<typeof metadata> | undefined, values: Record<string, string>) {
  return data?.fields.find(field => !field.is_custom && field.access === 'write' && field.required
    && Object.hasOwn(values, field.key) && !values[field.key].trim());
}
