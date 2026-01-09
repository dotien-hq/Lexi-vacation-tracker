import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        requests: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const employee = await prisma.employee.update({
      where: { id: parseInt(params.id) },
      data: body,
    });

    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    );
  }
}
