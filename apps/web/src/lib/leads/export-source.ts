import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import type { ScopedExportSource, ExportColumn } from '@finlonexa/crm-shared/server';
import { z } from 'zod';
export const leadExportColumns: readonly ExportColumn[] = [
  { key: 'title', label: 'Title', kind: 'text', visible: true, exportable: true },
  { key: 'first_name', label: 'First Name', kind: 'text', visible: true, exportable: true },
  { key: 'last_name', label: 'Last Name', kind: 'text', visible: true, exportable: true },
  { key: 'email', label: 'Email', kind: 'text', visible: true, exportable: true },
  { key: 'status', label: 'Lead Status', kind: 'text', visible: true, exportable: true },
  { key: 'lead_source', label: 'Lead Source', kind: 'text', visible: true, exportable: true },
  { key: 'industry', label: 'Industry', kind: 'text', visible: true, exportable: true },
  { key: 'annual_revenue', label: 'Annual Revenue', kind: 'number', visible: true, exportable: true },
];
export function leadExportSource(client: SupabaseClient<Database>): ScopedExportSource {
  return {
    async authorize(module) {
      if (module !== 'leads') throw new Error('Export unavailable');
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) throw new Error('Authentication required');
      const profile = await client.from('user_profiles').select('is_active').eq('id', user.id).single();
      const permission = await client.rpc('has_effective_permission', {
        p_user_id: user.id, p_permission_id: 'leads.export',
      });
      if (!profile.data?.is_active || profile.error || permission.error || permission.data !== true) {
        throw new Error('Export denied');
      }
      // No metadata fallback: migration/binding must exist before field-aware export.
      const metadata = await client.rpc('crm_shared_metadata', { m: 'leads' });
      if (metadata.error) throw new Error('Export metadata unavailable');
      const fields = z.object({ fields: z.array(z.object({ key: z.string(),
        access: z.enum(['write', 'readonly', 'hidden']) })) }).parse(metadata.data).fields;
      return leadExportColumns.map(column => ({
        ...column, visible: fields.some(f => f.key === column.key && f.access !== 'hidden'),
      }));
    },
    async fetchSelected(module, ids, columns) {
      if (module !== 'leads') throw new Error('Export unavailable');
      const validIds = z.array(z.string().uuid()).min(1).max(5000).parse(ids);
      if (columns.some(key => !leadExportColumns.some(c => c.key === key))) throw new Error('Invalid columns');
      // Select only authorized columns; RLS scopes the explicit ID set.
      const result = await client.from('leads').select(['id', ...columns].join(',')).in('id', validIds);
      if (result.error) throw new Error('Export unavailable');
      const rows = z.array(z.object({ id: z.string().uuid() }).passthrough()).parse(result.data);
      return rows.map(row => ({ id: row.id, values: row }));
    },
  };
}
