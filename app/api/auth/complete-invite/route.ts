import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashToken, isTokenExpired } from '@/lib/tokens';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    // Validate input
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Hash the token to find profile
    const tokenHash = hashToken(token);

    // Find profile by invitation token
    const profile = await prisma.profile.findUnique({
      where: { invitationToken: tokenHash },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 400 });
    }

    // Check if token is expired
    if (isTokenExpired(profile.invitationExpiresAt)) {
      return NextResponse.json({ error: 'Invitation token has expired' }, { status: 400 });
    }

    // Check if already activated
    if (profile.status === 'ACTIVE' && profile.authUserId) {
      return NextResponse.json(
        { error: 'This invitation has already been accepted' },
        { status: 400 }
      );
    }

    // Create Supabase admin client with service role key
    const cookieStore = await cookies();
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: profile.email,
      password: password,
      email_confirm: true, // Auto-confirm email since we sent the invitation
      user_metadata: {
        full_name: profile.fullName,
      },
    });

    if (authError || !authData.user) {
      console.error('Failed to create auth user:', authError);
      return NextResponse.json(
        { error: 'Failed to create account. Please contact support.' },
        { status: 500 }
      );
    }

    // Update profile with auth user ID and activate
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        authUserId: authData.user.id,
        status: 'ACTIVE',
        invitationToken: null, // Clear token after use
        invitationExpiresAt: null,
        isActive: true, // Legacy field for backward compatibility
      },
    });

    // Sign in the user with regular client
    const { createServerSupabaseClient } = await import('@/lib/supabase');
    const supabase = await createServerSupabaseClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: password,
    });

    if (signInError) {
      console.error('Failed to sign in user:', signInError);
      // User is created but not signed in - they can use login page
      return NextResponse.json({
        success: true,
        message: 'Account created. Please sign in.',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Account activated successfully',
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
      },
    });
  } catch (error) {
    console.error('Error completing invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
