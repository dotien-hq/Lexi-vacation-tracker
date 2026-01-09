import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        requests: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
    return NextResponse.json(employees);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, daysCarryOver, daysCurrentYear } = body;

    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        daysCarryOver,
        daysCurrentYear,
        isActive: true,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
