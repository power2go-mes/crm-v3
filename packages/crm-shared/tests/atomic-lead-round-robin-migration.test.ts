import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/202611260006_atomic_lead_round_robin.sql', 'utf8');

describe('atomic lead round-robin migration', () => {
  it('locks and reloads a matched round-robin rule before reading its cursor', () => {
    const lock = migration.indexOf('for update;');
    const cursorRead = migration.indexOf('v_next_idx := ((v_rule.last_assigned_index + v_attempts)');
    const cursorWrite = migration.indexOf('set last_assigned_index = (v_rule.last_assigned_index');
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(cursorRead).toBeGreaterThan(lock);
    expect(cursorWrite).toBeGreaterThan(cursorRead);
  });

  it('does not expose the privileged assignment engine directly to browser or anonymous roles', () => {
    expect(migration).toMatch(/revoke all on function public\.evaluate_and_assign_lead\(uuid\) from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.evaluate_and_assign_lead\(uuid\) to service_role/i);
    expect(migration).not.toMatch(/grant execute on function public\.evaluate_and_assign_lead\(uuid\)[^;]*anon/i);
  });
});
