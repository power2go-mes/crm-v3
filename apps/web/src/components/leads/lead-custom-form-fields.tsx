'use client';

import { useQuery } from '@tanstack/react-query';
import type { Json } from '@finlonexa/database';
import type { z } from 'zod';
import type { metadata } from '@/hooks/use-lead-form-metadata';
import { useAuth } from '@/components/providers/auth-provider';
import { leadQueryKey } from '@/lib/leads/query-contract';
import { createClient } from '@/lib/supabase/client';

export type LeadCustomValues = Record<string, Json | undefined>;

export function useLeadCustomFormValues(id: string | undefined) {
  const { user, permissions, roleIds } = useAuth();
  return useQuery({
    queryKey: leadQueryKey(user?.id, 'form-values', id, [...permissions, ...roleIds].sort()),
    enabled: Boolean(id && user),
    queryFn: async () => {
      const { data, error } = await createClient().rpc('crm_shared_values', { m: 'leads', rid: id! });
      if (error) throw error;
      return data && !Array.isArray(data) && typeof data === 'object' ? data : {};
    },
  });
}

export function LeadCustomFormFields({ definition, configured, values, onChange }: {
  definition: z.infer<typeof metadata> | undefined;
  configured: boolean;
  values: LeadCustomValues;
  onChange: (key: string, value: Json) => void;
}) {
  const layout = new Map(configured ? definition?.layout?.map(item => [item.field, item]) : []);
  const fields = (definition?.fields ?? []).filter(field => field.is_custom && field.access !== 'hidden'
    && (field.required && field.access === 'write' || layout.get(field.key)?.visible !== false));
  fields.sort((a, b) => (layout.get(a.key)?.sequence ?? Infinity) - (layout.get(b.key)?.sequence ?? Infinity));
  if (!fields.length) return null;
  return <fieldset className="mt-4 grid gap-3 rounded border p-3 sm:grid-cols-2">
    <legend>Custom fields</legend>
    {fields.map(field => {
      const value = values[field.key];
      const text = value == null ? '' : String(value);
      const choices = field.choices.filter((choice): choice is string => typeof choice === 'string');
      const props = { disabled: field.access !== 'write', className: 'block w-full rounded border p-2' };
      return <label key={field.key}>{field.label}{field.required && field.access === 'write' && ' *'}
        {field.type === 'choice' || field.type === 'single_choice'
          ? <select {...props} multiple={field.type === 'choice'} value={field.type === 'choice'
            ? (Array.isArray(value) ? value.map(String) : []) : text} onChange={event => onChange(field.key,
              field.type === 'choice' ? Array.from(event.target.selectedOptions, option => option.value) : event.target.value || null)}>
            {field.type === 'single_choice' && <option value="">Choose a value</option>}
            {choices.map(choice => <option key={choice}>{choice}</option>)}
          </select>
          : field.type === 'large_text'
            ? <textarea {...props} value={text} onChange={event => onChange(field.key, event.target.value)} />
            : <input {...props} type={field.type === 'number' || field.type === 'date' ? field.type : field.type === 'datetime' ? 'datetime-local' : 'text'}
              step={field.type === 'number' ? 'any' : undefined}
              value={field.type === 'datetime' ? text.slice(0, 16) : text} onChange={event => {
                const next = event.target.value;
                onChange(field.key, !next ? null : field.type === 'number' ? Number(next)
                  : field.type === 'datetime' ? new Date(next).toISOString() : next);
              }} />}
      </label>;
    })}
  </fieldset>;
}
