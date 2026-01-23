import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { withRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { parseBody, validationError, passwordResetSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  // Rate limiting (strict for auth)
  const rateLimitResponse = withRateLimit(request, RATE_LIMITS.auth, 'password-reset');
  if (rateLimitResponse) return rateLimitResponse;

  // Validate input
  const parsed = await parseBody(request, passwordResetSchema);
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const { email } = parsed.data;

  const supabase = await createServerSupabaseClient();

  // Always return success, even if email doesn't exist
  // This prevents email enumeration attacks
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/reset-password`,
  });

  return NextResponse.json({ success: true });
}
