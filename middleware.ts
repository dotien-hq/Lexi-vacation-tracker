import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

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

const prisma = new PrismaClient();

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

  // Query Profile table to verify user has active profile
  const profile = await prisma.profile.findUnique({
    where: { id: user.sub },
    select: { role: true, isActive: true },
  });

  // Redirect users without profiles to /access-denied
  if (!profile) {
    return NextResponse.redirect(new URL('/access-denied', req.url));
  }

  // Redirect inactive users to /access-denied
  if (!profile.isActive) {
    return NextResponse.redirect(new URL('/access-denied', req.url));
  }

  // Check user role for /admin routes (ADMIN only)
  if (req.nextUrl.pathname.startsWith('/admin')) {
    // Redirect non-admin users from /admin routes to /dashboard
    if (profile.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // IMPORTANT: Return the supabaseResponse to maintain session cookies
  return supabaseResponse;
}

// Configure matcher for `/dashboard/*` and `/admin/*` routes
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
