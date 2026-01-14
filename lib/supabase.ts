import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';

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

// Browser client for client-side operations
export function createBrowserClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
          return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
        },
        set(name: string, value: string, options: CookieOptions) {
          document.cookie = `${name}=${encodeURIComponent(value)}; path=/; ${
            options.maxAge ? `max-age=${options.maxAge};` : ''
          } ${options.sameSite ? `samesite=${options.sameSite};` : ''}`;
        },
        remove(name: string, options: CookieOptions) {
          document.cookie = `${name}=; path=/; max-age=0; ${
            options.sameSite ? `samesite=${options.sameSite};` : ''
          }`;
        },
      },
    }
  );
}

// Server client for server-side operations (Route Handlers)
export async function createServerSupabaseClient() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
