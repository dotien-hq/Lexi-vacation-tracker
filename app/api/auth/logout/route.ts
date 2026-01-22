import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { withRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = withRateLimit(request, RATE_LIMITS.auth, 'logout');
  if (rateLimitResponse) return rateLimitResponse;

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
