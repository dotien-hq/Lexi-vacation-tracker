import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { Role, RequestStatus } from '@prisma/client';
import { calculateBusinessDays } from '@/lib/holidayCalculator';
import { hasSufficientBalance } from '@/lib/vacationBalance';
import { sendRequestNotificationEmail } from '@/lib/email';

// GET /api/requests - List leave requests (role-based filtering)
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') as RequestStatus | null;

    // Build query based on role
    const where: {
      profileId?: string;
      status?: RequestStatus;
    } = {};

    // Users see only their own requests, admins see all
    if (userProfile.role === Role.USER) {
      where.profileId = userProfile.id;
    }

    // Apply status filter if provided
    if (statusFilter && Object.values(RequestStatus).includes(statusFilter)) {
      where.status = statusFilter;
    }

    // Fetch requests
    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        profile: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

// POST /api/requests - Create new leave request
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

    // Check if user has a profile (lookup by email since Supabase auth ID != Prisma profile ID)
    const userProfile = await prisma.profile.findUnique({
      where: { email: session.user.email },
    });

    if (!userProfile || !userProfile.isActive) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: startDate, endDate' },
        { status: 400 }
      );
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate date range
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (end < start) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    // Calculate business days
    const daysCount = calculateBusinessDays(start, end);

    if (daysCount === 0) {
      return NextResponse.json(
        { error: 'Leave request must include at least one business day' },
        { status: 400 }
      );
    }

    // Validate sufficient balance
    if (!hasSufficientBalance(userProfile, daysCount)) {
      const available = userProfile.daysCarryOver + userProfile.daysCurrentYear;
      return NextResponse.json(
        {
          error: `Insufficient vacation days. Available: ${available}, Requested: ${daysCount}`,
        },
        { status: 400 }
      );
    }

    // Create leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        profileId: userProfile.id,
        startDate: start,
        endDate: end,
        daysCount,
        status: RequestStatus.REQUESTED,
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

    // Send notification email to all admins
    try {
      const admins = await prisma.profile.findMany({
        where: {
          role: Role.ADMIN,
          isActive: true,
        },
        select: {
          email: true,
        },
      });

      const adminEmails = admins.map((admin) => admin.email);

      if (adminEmails.length > 0) {
        await sendRequestNotificationEmail(
          adminEmails,
          userProfile.fullName || userProfile.email,
          start,
          end,
          daysCount
        );
      }
    } catch (emailError) {
      // Log error but don't fail the request
      console.error('Failed to send notification email to admins:', emailError);
    }

    return NextResponse.json(leaveRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating leave request:', error);
    return NextResponse.json({ error: 'Failed to create leave request' }, { status: 500 });
  }
}
