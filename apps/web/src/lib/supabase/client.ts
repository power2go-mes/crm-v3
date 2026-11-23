import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@finlonexa/database';
import { getClientEnv } from '../env';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (client) return client;

  const env = getClientEnv();
  client = createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return client;
}
