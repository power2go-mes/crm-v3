import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const sql = readFileSync('supabase/migrations/202611160001_codex_shared_engines.sql', 'utf8');
const code = sql.replace(/--[^\n]*/g, '');
describe('unapplied migration ownership/security checks (not a PostgreSQL execution test)', () => {
  it('changes no existing business table, role seed or policy', () => {
    expect(code).not.toMatch(/\b(?:alter|drop|truncate)\s+table\s+(?:public\.)?(?:leads|accounts|contacts|opportunities|roles|user_roles|role_permissions|sales_\w+)\b/i);
    expect(code).not.toMatch(/\b(?:insert into|update|delete from)\s+public\.(?:leads|roles|role_permissions|sales_\w+)\b/i);
    expect(code).not.toMatch(/\bcreate\s+or\s+replace\b/i);
  });
  it('enables RLS on every introduced table', () => {
    const tables = [...code.matchAll(/create table public\.(\w+)/g)].map(m => m[1]);
    expect(tables.length).toBeGreaterThan(8);
    for (const table of tables) expect(code).toContain('alter table public.' + table + ' enable row level security');
  });
  it('only exposes invoker RPC entrypoints; definer writers are trigger-only and revoked', () => {
    const functions = [...code.matchAll(/create function public\.(\w+)\([^]*?\$\$;/g)].map(m => m[0]);
    expect(functions.length).toBeGreaterThan(15);
    for (const definition of functions) {
      const name = /public\.(\w+)/.exec(definition)![1];
      if (/security definer/i.test(definition)) {
        expect(definition).toMatch(/returns trigger/i);
        expect(code).toContain('revoke all on function public.' + name + '() from public,anon,authenticated');
        expect(definition).toMatch(/set search_path\s*=\s*pg_catalog,\s*public/i);
      }
    }
    expect(code).toContain('and not p.prosecdef');
  });
  it('keeps history immutable and custom values permission checked in direct policies', () => {
    expect(code).toContain('grant select on public.crm_history_events,public.crm_history_changes to authenticated');
    expect(code).not.toMatch(/grant (?:insert|update|delete|all)[^;]*crm_history_events/i);
    expect(code).toContain('public.crm_shared_field_access(definition_id,true)');
    expect(code).toContain('Custom value identity is immutable');
    expect(code).toContain('auth.uid()');
  });
  it('does not install entity bindings or attach history to Leads', () => {
    expect(code).not.toMatch(/insert into public\.crm_shared_modules/i);
    expect(code).not.toMatch(/(?:before|after)[^;]* on public\.leads/i);
    expect(code.trim().startsWith('begin;')).toBe(true);
    expect(code.trim().endsWith('commit;')).toBe(true);
  });
});
