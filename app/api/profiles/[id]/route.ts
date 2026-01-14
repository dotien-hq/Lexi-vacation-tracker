import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// PATCH /api/profiles/[id] - Update profile (admin only)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has a profile and is admin
    const userProfile = await prisma.profile.findUnique({
      where: { id: session.user.id },
    });

    if (!userProfile || !userProfile.isActive) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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
    const { daysCarryOver, daysCurrentYear, isActive } = body;

    // Build update data object with only provided fields
    const updateData: {
      daysCarryOver?: number;
      daysCurrentYear?: number;
      isActive?: boolean;
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
