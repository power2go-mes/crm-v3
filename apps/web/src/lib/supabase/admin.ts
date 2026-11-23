import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { getServerEnv } from '../env';

// Server-only administrative client bypassing RLS when required for system tasks
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Security Violation: createAdminClient cannot be executed on the client!');
  }

  const env = getServerEnv();
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
