import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface CookieOptions {
  maxAge?: number;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  domain?: string;
  secure?: boolean;
}

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: req,
  });

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request: req,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run code between createServerClient and getClaims()
  // Check for valid Supabase session using getClaims (recommended by Supabase)
  const {
    data: { claims },
    error: claimsError,
  } = await supabase.auth.getClaims();

  // No valid session - redirect to login
  if (claimsError || !claims?.sub) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Check if accessing admin routes
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin');

  if (isAdminRoute) {
    // Verify user has admin role using Supabase query (works in Edge runtime)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .or(`authUserId.eq.${claims.sub},email.eq.${claims.email}`)
      .eq('status', 'ACTIVE')
      .single();

    if (!profile || profile.role !== 'ADMIN') {
      const url = req.nextUrl.clone();
      url.pathname = '/access-denied';
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: Return the supabaseResponse to maintain session cookies
  return supabaseResponse;
}

// Configure matcher for `/dashboard/*` and `/admin/*` routes
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
