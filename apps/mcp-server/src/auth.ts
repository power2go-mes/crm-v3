import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '../../apps/web/.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bpwdxslrkgmcoewkwufu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';
function getMcpJwtSecret(): string {
  const secret = process.env.MCP_JWT_SECRET?.trim();
  if (!secret) throw new Error('MCP_JWT_SECRET is required for MCP session tokens');
  return secret;
}
if (process.env.NODE_ENV === 'production') getMcpJwtSecret();

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
  primaryRole: string;
  managerId: string | null;
  permissions: string[];
  supabase: SupabaseClient; // Authenticated delegated client bound to user JWT
}

/**
 * Validates the caller's bearer token.
 * Token can either be:
 * 1) A direct Supabase Auth user access_token (JWT), OR
 * 2) An MCP broker audience-bound access token containing the delegated user session.
 * 
 * NEVER permits anonymous or unauthenticated access.
 */
export async function authenticateMcpRequest(authHeader?: string): Promise<AuthenticatedUserContext> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required. Missing or malformed Authorization header. Please log in with FINLONEXA CRM.');
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new Error('Authentication required. Empty bearer token.');
  }

  // Delegated client bound to user's Bearer token
  const delegatedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Verify the user identity with Supabase Auth
  const { data: { user }, error: authError } = await delegatedClient.auth.getUser(token);

  if (authError || !user) {
    try {
      const decoded = jwt.verify(token, getMcpJwtSecret(), { audience: 'finlonexa-crm-mcp' }) as any;
      if (decoded && decoded.sub && decoded.supabase_token) {
        return authenticateMcpRequest(`Bearer ${decoded.supabase_token}`);
      }
    } catch {
      // Ignored
    }

    throw new Error(`Invalid or expired authentication session: ${authError?.message || 'Verification failed'}`);
  }

  // Fetch user profile from user_profiles (columns: id, email, first_name, last_name, is_active)
  const { data: profile } = await delegatedClient
    .from('user_profiles')
    .select('id, email, first_name, last_name, is_active')
    .eq('id', user.id)
    .single();

  if (profile && profile.is_active === false) {
    throw new Error('User account is inactive. Access denied to FINLONEXA MCP server.');
  }

  // Fetch assigned roles from user_roles (columns: user_id, role_id)
  const { data: userRoles } = await delegatedClient
    .from('user_roles')
    .select('role_id')
    .eq('user_id', user.id);

  const assignedRoles = (userRoles || []).map((r: any) => r.role_id).filter(Boolean);

  if (!assignedRoles.length) throw new Error('No CRM role is assigned');

  // Fetch dynamic permissions from role_permissions (columns: role_id, permission_id, is_granted)
  const { data: permissionsData } = await delegatedClient
    .from('role_permissions')
    .select('permission_id, is_granted')
    .in('role_id', assignedRoles)
    .eq('is_granted', true);

  const effectivePermissions = new Set((permissionsData || []).map((p: any) => p.permission_id));

  const fullName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : (user.email || 'CRM User');

  return {
    userId: user.id,
    email: user.email || '',
    fullName: fullName || user.email || 'CRM User',
    roles: assignedRoles,
    primaryRole: assignedRoles[0],
    managerId: null,
    permissions: Array.from(effectivePermissions),
    supabase: delegatedClient,
  };
}

/**
 * Mint audience-bound MCP token for OAuth 2.1 broker
 */
export function mintMcpSessionToken(userId: string, email: string, supabaseToken: string): string {
  return jwt.sign(
    {
      sub: userId,
      email,
      supabase_token: supabaseToken,
    },
    getMcpJwtSecret(),
    {
      audience: 'finlonexa-crm-mcp',
      issuer: 'https://finlonexa-crm.internal/auth',
      expiresIn: '8h',
    }
  );
}
