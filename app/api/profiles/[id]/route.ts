import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { getAuthenticatedProfile } from '@/lib/auth';
import { withRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { parseBody, validationError, updateProfileSchema } from '@/lib/validations';

// PATCH /api/profiles/[id] - Update profile (admin only)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Rate limiting
  const rateLimitResponse = withRateLimit(request, RATE_LIMITS.api, 'profiles-update');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Check authentication
    const userProfile = await getAuthenticatedProfile();

    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (userProfile.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get profile ID from params
    const { id } = await params;

    // Check if profile exists
    const existingProfile = await prisma.profile.findUnique({
      where: { id },
    });

    if (!existingProfile) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Validate input
    const parsed = await parseBody(request, updateProfileSchema);
    if (!parsed.success) {
      return NextResponse.json(validationError(parsed.error), { status: 400 });
    }

    const { daysCarryOver, daysCurrentYear, isActive, role, status } = parsed.data;

    // Role change protection logic
    if (role && role !== existingProfile.role) {
      // Protection 1: Prevent self-role change
      if (existingProfile.id === userProfile.id) {
        return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 });
      }

      // Protection 2: Prevent demoting the last active admin
      if (existingProfile.role === Role.ADMIN && role === 'USER') {
        const activeAdminCount = await prisma.profile.count({
          where: {
            role: Role.ADMIN,
            status: 'ACTIVE',
          },
        });

        if (activeAdminCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote the last active admin' },
            { status: 403 }
          );
        }
      }
    }

    // Build update data object with only provided fields
    const updateData: {
      daysCarryOver?: number;
      daysCurrentYear?: number;
      isActive?: boolean;
      role?: Role;
      status?: 'PENDING' | 'ACTIVE' | 'DEACTIVATED';
    } = {};

    if (daysCarryOver !== undefined) {
      updateData.daysCarryOver = daysCarryOver;
    }

    if (daysCurrentYear !== undefined) {
      updateData.daysCurrentYear = daysCurrentYear;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (role !== undefined) {
      updateData.role = role as Role;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    // Update profile
    const updatedProfile = await prisma.profile.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
