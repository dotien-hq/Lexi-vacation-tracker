import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedProfile } from '@/lib/auth';
import { sendReinviteEmail } from '@/lib/email';
import { generateInvitationToken, hashToken, generateInvitationExpiry } from '@/lib/tokens';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify admin authentication
    const adminProfile = await getAuthenticatedProfile();
    if (!adminProfile || adminProfile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find profile
    const profile = await prisma.profile.findUnique({
      where: { id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if profile is already active
    if (profile.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'This user is already active and does not need an invitation' },
        { status: 400 }
      );
    }

    // Generate new invitation token (invalidates old one)
    const invitationToken = generateInvitationToken();
    const tokenHash = hashToken(invitationToken);
    const expiresAt = generateInvitationExpiry();

    // Update profile with new token
    await prisma.profile.update({
      where: { id },
      data: {
        invitationToken: tokenHash,
        invitationExpiresAt: expiresAt,
        invitedAt: new Date(), // Update invited timestamp
      },
    });

    // Send re-invitation email
    const emailResult = await sendReinviteEmail(
      profile.email,
      profile.fullName || 'User',
      invitationToken // Send unhashed token
    );

    if (!emailResult.success) {
      console.error('Failed to send re-invite email:', emailResult.error);
      return NextResponse.json(
        {
          success: true,
          message: 'Token regenerated but email failed to send',
          emailSent: false,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation resent successfully',
      emailSent: true,
    });
  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
