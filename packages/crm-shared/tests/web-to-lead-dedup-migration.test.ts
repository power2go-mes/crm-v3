import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/202611260005_web_to_lead_deduplicate.sql', 'utf8');
const functionBody = /create or replace function public\.submit_web_to_lead[\s\S]*?\$\$([\s\S]*?)\$\$;/i.exec(migration)?.[1] ?? '';

describe('web intake duplicate guard migration', () => {
  it('serializes normalized same-email submissions before checking recent leads', () => {
    const lock = functionBody.indexOf("pg_advisory_xact_lock(hashtextextended('web-to-lead:' || v_email, 0))");
    const lookup = functionBody.indexOf('from public.leads', lock);
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lookup).toBeGreaterThan(lock);
    expect(functionBody).toMatch(/created_at\s*>=\s*now\(\)\s*-\s*interval '5 minutes'/i);
  });

  it('keeps the recent website-email lookup indexable and its response non-enumerable', () => {
    expect(migration).toMatch(/on public\.leads\s*\(email,\s*created_at desc\)\s*where lead_source = 'website' and email is not null/i);
    expect(functionBody).not.toMatch(/'lead_id'\s*,/i);
    expect(functionBody).toMatch(/v_assignment_res := public\.evaluate_and_assign_lead\(v_lead_id\)/i);
    expect(functionBody).not.toMatch(/exception when others then\s*null/i);
  });
});
