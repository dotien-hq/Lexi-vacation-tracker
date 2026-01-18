import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { getAuthenticatedProfile } from '@/lib/auth';

// PATCH /api/profiles/[id] - Update profile (admin only)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Parse and validate request body
    const body = await request.json();
    const { daysCarryOver, daysCurrentYear, isActive, role, status } = body;

    // Role change protection logic
    if (role && role !== existingProfile.role) {
      // Validate role value
      if (!['USER', 'ADMIN'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role. Must be USER or ADMIN' }, { status: 400 });
      }

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
      if (typeof daysCarryOver !== 'number' || daysCarryOver < 0) {
        return NextResponse.json(
          { error: 'daysCarryOver must be a non-negative number' },
          { status: 400 }
        );
      }
      updateData.daysCarryOver = daysCarryOver;
    }

    if (daysCurrentYear !== undefined) {
      if (typeof daysCurrentYear !== 'number' || daysCurrentYear < 0) {
        return NextResponse.json(
          { error: 'daysCurrentYear must be a non-negative number' },
          { status: 400 }
        );
      }
      updateData.daysCurrentYear = daysCurrentYear;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
      }
      updateData.isActive = isActive;
    }

    if (role !== undefined) {
      updateData.role = role as Role;
    }

    if (status !== undefined) {
      // Validate status value
      if (!['PENDING', 'ACTIVE', 'DEACTIVATED'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be PENDING, ACTIVE, or DEACTIVATED' },
          { status: 400 }
        );
      }
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
