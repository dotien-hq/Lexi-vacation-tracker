import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { sendInvitationEmailWithToken } from '@/lib/email';
import { getAuthenticatedProfile } from '@/lib/auth';
import { generateInvitationToken, hashToken, generateInvitationExpiry } from '@/lib/tokens';

// GET /api/profiles - List all profiles (admin only)
export async function GET() {
  try {
    // Check authentication
    const userProfile = await getAuthenticatedProfile();

    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (userProfile.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Fetch all profiles with status and invitation info
    const profiles = await prisma.profile.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        daysCarryOver: true,
        daysCurrentYear: true,
        invitedAt: true,
        invitationExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            requests: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

// POST /api/profiles - Create new profile and send invitation (admin only)
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const userProfile = await getAuthenticatedProfile();

    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json(
        { error: 'A profile with this email already exists' },
        { status: 400 }
      );
    }

    // Generate invitation token
    const invitationToken = generateInvitationToken();
    const tokenHash = hashToken(invitationToken);
    const expiresAt = generateInvitationExpiry();

    // Create profile with PENDING status
    const profile = await prisma.profile.create({
      data: {
        email,
        fullName: fullName || null,
        role: Role.USER,
        daysCurrentYear: daysCurrentYear ?? 20,
        daysCarryOver: daysCarryOver ?? 0,
        status: 'PENDING',
        invitationToken: tokenHash,
        invitationExpiresAt: expiresAt,
        invitedAt: new Date(),
        isActive: false, // Legacy field
      },
    });

    // Send invitation email
    const emailResult = await sendInvitationEmailWithToken(
      email,
      fullName || email,
      invitationToken, // Send unhashed token in email
      userProfile.fullName || 'Admin'
    );

    if (!emailResult.success) {
      console.error('Failed to send invitation email:', emailResult.error);
      // Profile created but email failed - admin can resend
    }

    return NextResponse.json(
      {
        profile: {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          status: profile.status,
          invitedAt: profile.invitedAt,
        },
        emailSent: emailResult.success,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
