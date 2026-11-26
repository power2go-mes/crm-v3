import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/202611260003_resumable_lead_imports.sql', 'utf8');

describe('resumable lead import migration', () => {
  it('temporarily grants schema creation only for the function ownership transfer', () => {
    const grant = migration.indexOf('grant create on schema public to crm_import_executor;');
    const ownerChange = migration.indexOf('alter function public.run_lead_import(uuid, jsonb, text, text[], integer) owner to crm_import_executor;');
    const revoke = migration.indexOf('revoke create on schema public from crm_import_executor;', ownerChange);

    expect(grant).toBeGreaterThanOrEqual(0);
    expect(ownerChange).toBeGreaterThan(grant);
    expect(revoke).toBeGreaterThan(ownerChange);
  });
});
