/** Validate configuration without ever including the candidate credential in errors. */
export function isPublicSupabaseKey(value: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  // Legacy Supabase anon JWTs are public. A service_role JWT is never acceptable.
  const pieces = value.split('.');
  if (pieces.length !== 3) return false;
  try {
    const raw = pieces[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')));
    return typeof payload === 'object' && payload !== null &&
      'role' in payload && payload.role === 'anon';
  } catch { return false; }
}
