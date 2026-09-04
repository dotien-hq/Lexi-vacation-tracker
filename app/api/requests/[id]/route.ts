import { NextRequest, NextResponse } from 'next/server';
import { Role, RequestStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateBusinessDays } from '@/lib/holidayCalculator';
import { calculateAvailableDays } from '@/lib/vacationBalance';
import {
  sendApprovalEmail,
  sendDenialEmail,
  sendCancellationEmail,
  sendRescheduleEmail,
  type EmailResult,
} from '@/lib/email';
import { getAuthenticatedProfile } from '@/lib/auth';
import { withRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import {
  validationError,
  updateRequestStatusSchema,
  updateRequestDatesSchema,
  MAX_LEAVE_SPAN_DAYS,
} from '@/lib/validations';
import { actionForStatus, balanceEffect, canPerform } from '@/lib/requestTransitions';
import {
  adjustBalance,
  commitRequestChange,
  InsufficientBalanceError,
} from '@/lib/requestMutations';

type ExistingRequest = Prisma.LeaveRequestGetPayload<{ include: { profile: true } }>;
type Actor = { id: string; role: Role };

const MS_PER_DAY = 86_400_000;

const conflict = () =>
  NextResponse.json(
    { error: 'This request was changed by someone else. Refresh and try again.' },
    { status: 409 }
  );

/**
 * Send a notification without letting email failures fail the API call.
 * The send* helpers return { success: false } for SendGrid/config problems and only
 * throw on programming errors; both are logged so a silent "email never went out" is visible.
 */
async function notify(send: () => Promise<EmailResult>): Promise<void> {
  try {
    const result = await send();
    if (!result.success) {
      console.error('Notification email not sent:', result.error);
    }
  } catch (error) {
    console.error('Failed to send notification email:', error);
  }
}

// ---------------------------------------------------------------------------
// Status change (admin only): APPROVE / DENY / CANCEL
// ---------------------------------------------------------------------------
async function handleStatusUpdate(existing: ExistingRequest, body: unknown) {
  const parsed = updateRequestStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const { status: toStatus } = parsed.data;
  const reason = parsed.data.rejectionReason || undefined;

  const action = actionForStatus(toStatus);
  if (!action || !canPerform(action, existing.status)) {
    return NextResponse.json(
      { error: `Cannot change status from ${existing.status} to ${toStatus}` },
      { status: 400 }
    );
  }

  if (toStatus === RequestStatus.DENIED && !reason) {
    return NextResponse.json(
      { error: 'Rejection reason is required when denying a request' },
      { status: 400 }
    );
  }

  const updated = await commitRequestChange({
    id: existing.id,
    expectedStatus: existing.status,
    expectedUpdatedAt: existing.updatedAt,
    profileId: existing.profileId,
    effect: balanceEffect(existing.status, toStatus),
    days: existing.daysCount,
    data: {
      status: toStatus,
      rejectionReason: toStatus === RequestStatus.APPROVED ? null : (reason ?? null),
    },
  });
  if (!updated) return conflict();

  const { email, fullName } = existing.profile;
  const name = fullName || email;
  const { startDate, endDate, daysCount } = existing;

  await notify(() => {
    if (toStatus === RequestStatus.APPROVED) {
      return sendApprovalEmail(email, name, startDate, endDate, daysCount);
    }
    if (toStatus === RequestStatus.DENIED) {
      return sendDenialEmail(email, name, startDate, endDate, daysCount, reason!);
    }
    const wasApproved = existing.status === RequestStatus.APPROVED;
    return sendCancellationEmail(email, name, startDate, endDate, daysCount, wasApproved, reason);
  });

  return NextResponse.json(updated);
}

// ---------------------------------------------------------------------------
// Date change: owner edits own REQUESTED request, or admin reschedules any
// request (which resets it to REQUESTED and refunds if it was APPROVED)
// ---------------------------------------------------------------------------
async function handleDateUpdate(existing: ExistingRequest, body: unknown, actor: Actor) {
  const parsed = updateRequestDatesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const isAdmin = actor.role === Role.ADMIN;
  const isOwner = existing.profileId === actor.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  if (!isAdmin && existing.status !== RequestStatus.REQUESTED) {
    return NextResponse.json({ error: 'Can only edit REQUESTED requests' }, { status: 400 });
  }
  if (isAdmin && !canPerform('RESCHEDULE', existing.status)) {
    return NextResponse.json(
      { error: `Cannot reschedule a ${existing.status} request` },
      { status: 400 }
    );
  }

  const newStart = parsed.data.startDate ? new Date(parsed.data.startDate) : existing.startDate;
  const newEnd = parsed.data.endDate ? new Date(parsed.data.endDate) : existing.endDate;

  if (newEnd < newStart) {
    return NextResponse.json(
      { error: 'End date must be after or equal to start date' },
      { status: 400 }
    );
  }

  const unchanged =
    newStart.getTime() === existing.startDate.getTime() &&
    newEnd.getTime() === existing.endDate.getTime();
  if (unchanged) {
    return NextResponse.json({ error: 'Dates are unchanged' }, { status: 400 });
  }

  // The schema can only check the span when both dates are supplied; cover the mixed case here.
  if ((newEnd.getTime() - newStart.getTime()) / MS_PER_DAY > MAX_LEAVE_SPAN_DAYS) {
    return NextResponse.json(
      { error: `Leave cannot span more than ${MAX_LEAVE_SPAN_DAYS} days` },
      { status: 400 }
    );
  }

  const newDaysCount = calculateBusinessDays(newStart, newEnd);
  if (newDaysCount === 0) {
    return NextResponse.json(
      { error: 'Leave request must include at least one business day' },
      { status: 400 }
    );
  }

  // Admin reschedule returns the request to REQUESTED; refund if it was APPROVED.
  const effect = isAdmin ? balanceEffect(existing.status, RequestStatus.REQUESTED) : 'NONE';
  const refunded = effect === 'REFUND' ? existing.daysCount : 0;
  const available = calculateAvailableDays(existing.profile) + refunded;
  if (newDaysCount > available) {
    return NextResponse.json(
      { error: `Insufficient vacation days. Available: ${available}, Requested: ${newDaysCount}` },
      { status: 400 }
    );
  }

  const updated = await commitRequestChange({
    id: existing.id,
    expectedStatus: existing.status,
    expectedUpdatedAt: existing.updatedAt,
    profileId: existing.profileId,
    effect,
    days: existing.daysCount,
    data: {
      startDate: newStart,
      endDate: newEnd,
      daysCount: newDaysCount,
      ...(isAdmin ? { status: RequestStatus.REQUESTED, rejectionReason: null } : {}),
    },
  });
  if (!updated) return conflict();

  // Notify the employee, unless the admin is rescheduling their own request.
  if (isAdmin && existing.profileId !== actor.id) {
    const { email, fullName } = existing.profile;
    await notify(() =>
      sendRescheduleEmail(
        email,
        fullName || email,
        existing.startDate,
        existing.endDate,
        newStart,
        newEnd,
        newDaysCount
      )
    );
  }

  return NextResponse.json(updated);
}

// PATCH /api/requests/[id] - Update leave request (status or dates)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimitResponse = withRateLimit(request, RATE_LIMITS.api, 'requests-update');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const userProfile = await getAuthenticatedProfile();
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    // request.json() happily returns null / numbers / arrays; those must not reach `body.status`.
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const isStatusUpdate = body.status !== undefined;
    const isDateUpdate = body.startDate !== undefined || body.endDate !== undefined;

    if (isStatusUpdate && isDateUpdate) {
      return NextResponse.json(
        { error: 'Cannot update status and dates in the same request' },
        { status: 400 }
      );
    }

    if (isStatusUpdate) {
      if (userProfile.role !== Role.ADMIN) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      return await handleStatusUpdate(existing, body);
    }

    if (isDateUpdate) {
      return await handleDateUpdate(existing, body, userProfile);
    }

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating leave request:', error);
    return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 });
  }
}

// DELETE /api/requests/[id] - Delete leave request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = withRateLimit(request, RATE_LIMITS.api, 'requests-delete');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const userProfile = await getAuthenticatedProfile();
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const isOwner = existing.profileId === userProfile.id;
    const isAdmin = userProfile.role === Role.ADMIN;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (!isAdmin && existing.status !== RequestStatus.REQUESTED) {
      return NextResponse.json({ error: 'Can only delete REQUESTED requests' }, { status: 400 });
    }

    const effect = existing.status === RequestStatus.APPROVED ? 'REFUND' : 'NONE';

    const deleted = await prisma.$transaction(async (tx) => {
      // status + updatedAt in the where clause = optimistic lock (see lib/requestMutations.ts)
      const { count } = await tx.leaveRequest.deleteMany({
        where: { id, status: existing.status, updatedAt: existing.updatedAt },
      });
      if (count === 0) return false;
      await adjustBalance(tx, existing.profileId, effect, existing.daysCount);
      return true;
    });

    if (!deleted) return conflict();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting leave request:', error);
    return NextResponse.json({ error: 'Failed to delete leave request' }, { status: 500 });
  }
}
