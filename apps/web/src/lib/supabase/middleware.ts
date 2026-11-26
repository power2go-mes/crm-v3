import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@finlonexa/database';
import { getClientEnv } from '../env';

export async function updateSession(request: NextRequest) {
  const url = request.nextUrl.clone();
  const isAuthRoute = url.pathname.startsWith('/login') || url.pathname.startsWith('/auth');
  const isApiRoute = url.pathname.startsWith('/api') || url.pathname.startsWith('/.well-known');

  // Skip supabase getUser call for API routes (they authenticate independently)
  if (isApiRoute) {
    return NextResponse.next({ request });
  }

  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.startsWith('sb-') && (c.name.endsWith('-auth-token') || c.name.includes('auth-token'))
  );

  // If there are no auth cookies at all and user is trying to access protected routes, redirect immediately
  if (!hasAuthCookie && !isAuthRoute) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If there are no auth cookies and visiting login/auth routes, allow through immediately
  if (!hasAuthCookie && isAuthRoute) {
    return NextResponse.next({ request });
  }

  // Avoid redundant remote network round-trips on link prefetch requests
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch';
  if (isPrefetch && hasAuthCookie && !isAuthRoute) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const env = getClientEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is not authenticated and trying to access protected routes
  if (!user && !isAuthRoute) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If user is already authenticated and visits /login, redirect to dashboard
  if (user && isAuthRoute && !url.pathname.startsWith('/auth/callback')) {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
