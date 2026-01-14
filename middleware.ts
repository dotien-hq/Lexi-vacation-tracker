import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from './lib/prisma';

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
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Redirect unauthenticated users to /login
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Note: Profile and role checks are now handled in the page components
  // using server-side data fetching, since Prisma doesn't work in edge middleware

  // IMPORTANT: Return the supabaseResponse to maintain session cookies
  return supabaseResponse;
}

// Configure matcher for `/dashboard/*` and `/admin/*` routes
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
