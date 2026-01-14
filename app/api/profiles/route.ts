import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { sendInvitationEmail } from '@/lib/email';

// GET /api/profiles - List all profiles (admin only)
export async function GET() {
  try {
    // Check authentication
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has a profile and is admin (lookup by email since Supabase auth ID != Prisma profile ID)
    const userProfile = await prisma.profile.findUnique({
      where: { email: session.user.email },
    });

    if (!userProfile || !userProfile.isActive) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (userProfile.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Fetch all profiles
    const profiles = await prisma.profile.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

// POST /api/profiles - Create new profile and send invitation (admin only)
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has a profile and is admin (lookup by email since Supabase auth ID != Prisma profile ID)
    const userProfile = await prisma.profile.findUnique({
      where: { email: session.user.email },
    });

    if (!userProfile || !userProfile.isActive) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (userProfile.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { email, fullName, daysCarryOver, daysCurrentYear } = body;

    if (!email) {
      return NextResponse.json({ error: 'Missing required field: email' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Check if profile already exists
    const existingProfile = await prisma.profile.findUnique({
      where: { email },
    });

    if (existingProfile) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    // Create profile
    const profile = await prisma.profile.create({
      data: {
        id: crypto.randomUUID(), // Generate UUID for new profile
        email,
        fullName: fullName || null,
        role: Role.USER,
        daysCarryOver: daysCarryOver ?? 0,
        daysCurrentYear: daysCurrentYear ?? 20,
        isActive: true,
      },
    });

    // Send invitation email via SendGrid
    // Handle email errors gracefully - log but don't fail the request
    let inviteSent = false;
    try {
      const emailResult = await sendInvitationEmail(email, fullName || email);
      inviteSent = emailResult.success;

      if (!emailResult.success) {
        console.error(`Failed to send invitation email to ${email}:`, emailResult.error);
      } else {
        console.log(`Invitation email sent successfully to: ${email}`);
      }
    } catch (error) {
      console.error(`Error sending invitation email to ${email}:`, error);
    }

    return NextResponse.json(
      {
        profile,
        inviteSent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
