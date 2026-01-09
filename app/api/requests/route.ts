import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateBusinessDays } from '@/lib/holidayCalculator';

export async function GET() {
  try {
    const requests = await prisma.leaveRequest.findMany({
      include: {
        employee: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(requests);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, startDate, endDate } = body;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysCount = calculateBusinessDays(start, end);

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        startDate: start,
        endDate: end,
        daysCount,
        status: 'REQUESTED',
      },
      include: {
        employee: true,
      },
    });

    return NextResponse.json(leaveRequest, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    );
  }
}
