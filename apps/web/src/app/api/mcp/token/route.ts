import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@finlonexa/database';
import { getClientEnv } from '@/lib/env';
import { mintMcpSessionToken } from '@finlonexa/mcp-server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Mint or Rotate MCP Personal Access Token for the logged-in CRM user.
 * POST /api/mcp/token
 */
export async function POST(req: NextRequest) {
  const env = getClientEnv();

  // Create SSR Supabase client reading session cookies
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user || !session.access_token) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to your FINLONEXA CRM account.' },
      { status: 401 }
    );
  }

  try {
    // 1. Fetch user profile & roles for metadata context
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, is_active')
      .eq('id', session.user.id)
      .single();

    if (profile && profile.is_active === false) {
      return NextResponse.json(
        { error: 'Account is inactive. Cannot generate MCP tokens.' },
        { status: 403 }
      );
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', session.user.id);

    const userRoles = (roles || []).map((r) => r.role_id).filter(Boolean);

    // 2. Mint the dedicated, audience-bound MCP token
    const mcpToken = mintMcpSessionToken(
      session.user.id,
      session.user.email || '',
      session.access_token
    );

    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    return NextResponse.json({
      success: true,
      token: mcpToken,
      tokenType: 'Bearer',
      expiresAt,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : session.user.email,
        roles: userRoles,
      },
      mcpServerUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://finlonexa-crm.vercel.app'}/api/mcp`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token minting failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
