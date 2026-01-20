import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

type PasswordResetRequest = {
  email: string;
};

export async function POST(request: NextRequest) {
  let email: string;

  try {
    const body = (await request.json()) as PasswordResetRequest;
    email = body.email;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Check if email exists
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Check if email is string
  if (typeof email !== 'string') {
    return NextResponse.json({ error: 'Email must be a string' }, { status: 400 });
  }

  // Trim whitespace
  email = email.trim();

  // Check if empty after trim
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  // Always return success, even if email doesn't exist
  // This prevents email enumeration attacks
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${request.nextUrl.origin}/auth/reset-password`,
  });

  return NextResponse.json({ success: true });
}
