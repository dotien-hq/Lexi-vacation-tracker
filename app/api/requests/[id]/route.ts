import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { Role, RequestStatus } from '@prisma/client';
import { calculateBusinessDays } from '@/lib/holidayCalculator';
import { hasSufficientBalance, deductDays, refundDays } from '@/lib/vacationBalance';
import { sendApprovalEmail, sendDenialEmail } from '@/lib/email';

// PATCH /api/requests/[id] - Update leave request (status or dates)
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

    // Check if user has a profile (lookup by email since Supabase auth ID != Prisma profile ID)
    const userProfile = await prisma.profile.findUnique({
      where: { email: session.user.email },
    });

    if (!userProfile || !userProfile.isActive) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get request ID from params
    const { id } = await params;

    // Check if request exists
    const existingRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { status, rejectionReason, startDate, endDate } = body;

    // Determine if this is a status update (admin) or date update (user)
    const isStatusUpdate = status !== undefined;
    const isDateUpdate = startDate !== undefined || endDate !== undefined;

    if (isStatusUpdate && isDateUpdate) {
      return NextResponse.json(
        { error: 'Cannot update status and dates in the same request' },
        { status: 400 }
      );
    }

    // Handle status update (admin only)
    if (isStatusUpdate) {
      // Check admin permission
      if (userProfile.role !== Role.ADMIN) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      // Validate status value
      if (!Object.values(RequestStatus).includes(status)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }

      // Validate status transitions
      if (existingRequest.status !== RequestStatus.REQUESTED) {
        return NextResponse.json(
          { error: 'Can only update status of REQUESTED requests' },
          { status: 400 }
        );
      }

      // Validate rejection reason for DENIED status
      if (status === RequestStatus.DENIED) {
        if (!rejectionReason || rejectionReason.trim() === '') {
          return NextResponse.json(
            { error: 'Rejection reason is required when denying a request' },
            { status: 400 }
          );
        }
      }

      // Handle APPROVED status - deduct days from balance
      if (status === RequestStatus.APPROVED) {
        const updatedBalance = deductDays(existingRequest.profile, existingRequest.daysCount);

        // Update request status and profile balance in a transaction
        const [updatedRequest] = await prisma.$transaction([
          prisma.leaveRequest.update({
            where: { id },
            data: {
              status: RequestStatus.APPROVED,
            },
            include: {
              profile: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
          }),
          prisma.profile.update({
            where: { id: existingRequest.profileId },
            data: {
              daysCarryOver: updatedBalance.daysCarryOver,
              daysCurrentYear: updatedBalance.daysCurrentYear,
            },
          }),
        ]);

        // Send approval email
        try {
          await sendApprovalEmail(
            existingRequest.profile.email,
            existingRequest.profile.fullName || existingRequest.profile.email,
            existingRequest.startDate,
            existingRequest.endDate,
            existingRequest.daysCount
          );
        } catch (emailError) {
          // Log error but don't fail the request
          console.error('Failed to send approval email:', emailError);
        }

        return NextResponse.json(updatedRequest);
      }

      // Handle DENIED status
      if (status === RequestStatus.DENIED) {
        const updatedRequest = await prisma.leaveRequest.update({
          where: { id },
          data: {
            status: RequestStatus.DENIED,
            rejectionReason,
          },
          include: {
            profile: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        });

        // Send denial email with reason
        try {
          await sendDenialEmail(
            existingRequest.profile.email,
            existingRequest.profile.fullName || existingRequest.profile.email,
            existingRequest.startDate,
            existingRequest.endDate,
            existingRequest.daysCount,
            rejectionReason
          );
        } catch (emailError) {
          // Log error but don't fail the request
          console.error('Failed to send denial email:', emailError);
        }

        return NextResponse.json(updatedRequest);
      }
    }

    // Handle date update (user only, only for REQUESTED status)
    if (isDateUpdate) {
      // Check if user owns this request
      if (existingRequest.profileId !== userProfile.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Only REQUESTED requests can be edited
      if (existingRequest.status !== RequestStatus.REQUESTED) {
        return NextResponse.json({ error: 'Can only edit REQUESTED requests' }, { status: 400 });
      }

      // Use existing dates if not provided
      const newStartDate = startDate ? new Date(startDate) : existingRequest.startDate;
      const newEndDate = endDate ? new Date(endDate) : existingRequest.endDate;

      // Validate dates
      if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }

      if (newEndDate < newStartDate) {
        return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
      }

      // Calculate new business days
      const newDaysCount = calculateBusinessDays(newStartDate, newEndDate);

      if (newDaysCount === 0) {
        return NextResponse.json(
          { error: 'Leave request must include at least one business day' },
          { status: 400 }
        );
      }

      // Validate sufficient balance
      if (!hasSufficientBalance(existingRequest.profile, newDaysCount)) {
        const available =
          existingRequest.profile.daysCarryOver + existingRequest.profile.daysCurrentYear;
        return NextResponse.json(
          {
            error: `Insufficient vacation days. Available: ${available}, Requested: ${newDaysCount}`,
          },
          { status: 400 }
        );
      }

      // Update request
      const updatedRequest = await prisma.leaveRequest.update({
        where: { id },
        data: {
          startDate: newStartDate,
          endDate: newEndDate,
          daysCount: newDaysCount,
        },
        include: {
          profile: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      });

      return NextResponse.json(updatedRequest);
    }

    // If neither status nor dates provided
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  } catch (error) {
    console.error('Error updating leave request:', error);
    return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 });
  }
}

// DELETE /api/requests/[id] - Delete leave request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has a profile (lookup by email since Supabase auth ID != Prisma profile ID)
    const userProfile = await prisma.profile.findUnique({
      where: { email: session.user.email },
    });

    if (!userProfile || !userProfile.isActive) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get request ID from params
    const { id } = await params;

    // Check if request exists
    const existingRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Check permissions: users can delete their own REQUESTED, admins can delete any
    const isOwner = existingRequest.profileId === userProfile.id;
    const isAdmin = userProfile.role === Role.ADMIN;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Users can only delete REQUESTED requests
    if (isOwner && !isAdmin && existingRequest.status !== RequestStatus.REQUESTED) {
      return NextResponse.json({ error: 'Can only delete REQUESTED requests' }, { status: 400 });
    }

    // If request is APPROVED, refund days to current year
    if (existingRequest.status === RequestStatus.APPROVED) {
      const updatedBalance = refundDays(existingRequest.profile, existingRequest.daysCount);

      // Delete request and update balance in a transaction
      await prisma.$transaction([
        prisma.leaveRequest.delete({
          where: { id },
        }),
        prisma.profile.update({
          where: { id: existingRequest.profileId },
          data: {
            daysCarryOver: updatedBalance.daysCarryOver,
            daysCurrentYear: updatedBalance.daysCurrentYear,
          },
        }),
      ]);
    } else {
      // Just delete the request (no balance refund for non-approved requests)
      await prisma.leaveRequest.delete({
        where: { id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting leave request:', error);
    return NextResponse.json({ error: 'Failed to delete leave request' }, { status: 500 });
  }
}
