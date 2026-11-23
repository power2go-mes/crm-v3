import { describe, it, expect } from 'vitest';
import { leadQueryKey, leadSearchExpression, leadWindow } from '../query-contract';
import { isPublicSupabaseKey } from '../../supabase/public-key';
describe('Lead query and public credential boundaries', () => {
  it('partitions all Lead resources by authenticated identity', () => {
    expect(leadQueryKey('one', 'detail', 'same')).not.toEqual(leadQueryKey('two', 'detail', 'same'));
    expect(leadQueryKey(null, 'list')).toContain('unauthenticated');
  });
  it('quotes filter grammar and escapes SQL wildcard literals', () => {
    const result = leadSearchExpression('x",status.eq.convert),%_');
    expect(result).toContain('title.ilike."');
    expect(result).toContain('\\"');
    expect(result.match(/\.ilike\./g)).toHaveLength(6);
    expect(() => leadSearchExpression('x'.repeat(201))).toThrow();
  });
  it('rejects invalid sorting and unbounded pagination', () => {
    expect(() => leadWindow.parse({ page: 0, pageSize: 10000, sortBy: 'secret', sortOrder: 'asc' })).toThrow();
  });
  it('accepts only publishable or legacy anon credentials without exposing rejected values', () => {
    const jwt = (role: string) => 'header.' + btoa(JSON.stringify({ role })).replace(/=/g, '') + '.signature';
    expect(isPublicSupabaseKey('sb_publishable_example')).toBe(true);
    expect(isPublicSupabaseKey(jwt('anon'))).toBe(true);
    expect(isPublicSupabaseKey(jwt('service_role'))).toBe(false);
    expect(isPublicSupabaseKey('sb_secret_never-log')).toBe(false);
    expect(isPublicSupabaseKey('garbage')).toBe(false);
  });
});
