import { createServerSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createServerSupabaseClient();

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // Get the authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=no_user`);
    }

    // Successful authentication - redirect to dashboard
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // No code provided - redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
