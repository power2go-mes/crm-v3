import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bpwdxslrkgmcoewkwufu.supabase.co';

  return NextResponse.json(
    {
      resource: process.env.NEXT_PUBLIC_APP_URL || 'https://finlonexa-crm.vercel.app',
      authorization_servers: [`${supabaseUrl}/auth/v1`],
      scopes_supported: ['crm:read', 'crm:write', 'crm:admin'],
      response_types_supported: ['token'],
      grant_types_supported: ['password', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
    },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
