import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role, RequestStatus } from '@prisma/client';
import { calculateBusinessDays } from '@/lib/holidayCalculator';
import { hasSufficientBalance } from '@/lib/vacationBalance';
import { sendRequestNotificationEmail } from '@/lib/email';
import { getAuthenticatedProfile } from '@/lib/auth';
import { withRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { parseBody, validationError, createRequestSchema } from '@/lib/validations';

// GET /api/requests - List leave requests (role-based filtering)
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = withRateLimit(request, RATE_LIMITS.api, 'requests-list');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Check authentication
    const userProfile = await getAuthenticatedProfile();

    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  // Rate limiting
  const rateLimitResponse = withRateLimit(request, RATE_LIMITS.api, 'requests-create');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Check authentication
    const userProfile = await getAuthenticatedProfile();

    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate input
    const parsed = await parseBody(request, createRequestSchema);
    if (!parsed.success) {
      return NextResponse.json(validationError(parsed.error), { status: 400 });
    }

    const { startDate, endDate } = parsed.data;

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

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
