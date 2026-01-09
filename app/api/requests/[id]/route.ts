import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateBusinessDays } from '@/lib/holidayCalculator';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const requestId = parseInt(id);

    // Handle status update with day deduction logic
    if (body.status) {
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: requestId },
        include: { employee: true },
      });

      if (!leaveRequest) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      // If approving a request that wasn't approved before
      if (body.status === 'APPROVED' && leaveRequest.status !== 'APPROVED') {
        const employee = leaveRequest.employee;
        let needed = leaveRequest.daysCount;
        let newCarry = employee.daysCarryOver;
        let newCurrent = employee.daysCurrentYear;

        // Deduct from carry-over first
        const fromCarry = Math.min(newCarry, needed);
        newCarry -= fromCarry;
        needed -= fromCarry;

        // Then deduct from current year
        if (needed > 0) {
          newCurrent -= needed;
        }

        // Update employee days
        await prisma.employee.update({
          where: { id: employee.id },
          data: {
            daysCarryOver: newCarry,
            daysCurrentYear: newCurrent,
          },
        });
      }

      // Update request status
      const updated = await prisma.leaveRequest.update({
        where: { id: requestId },
        data: { status: body.status },
        include: { employee: true },
      });

      return NextResponse.json(updated);
    }

    // Handle date edit (refund if approved, recalculate, reset to REQUESTED)
    if (body.startDate || body.endDate) {
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: requestId },
        include: { employee: true },
      });

      if (!leaveRequest) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      // Refund days if previously approved
      if (leaveRequest.status === 'APPROVED') {
        await prisma.employee.update({
          where: { id: leaveRequest.employeeId },
          data: {
            daysCurrentYear: {
              increment: leaveRequest.daysCount,
            },
          },
        });
      }

      // Recalculate business days
      const start = new Date(body.startDate || leaveRequest.startDate);
      const end = new Date(body.endDate || leaveRequest.endDate);
      const newCount = calculateBusinessDays(start, end);

      // Update request with new dates and reset status
      const updated = await prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          startDate: start,
          endDate: end,
          daysCount: newCount,
          status: 'REQUESTED',
        },
        include: { employee: true },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const requestId = parseInt(id);

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Refund days if approved
    if (leaveRequest.status === 'APPROVED') {
      await prisma.employee.update({
        where: { id: leaveRequest.employeeId },
        data: {
          daysCurrentYear: {
            increment: leaveRequest.daysCount,
          },
        },
      });
    }

    await prisma.leaveRequest.delete({
      where: { id: requestId },
    });

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
  }
}
