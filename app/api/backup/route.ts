import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        requests: true,
      },
    });

    const backup = {
      exportDate: new Date().toISOString(),
      employees,
    };

    return NextResponse.json(backup, {
      headers: {
        'Content-Disposition': `attachment; filename="vacation-backup-${
          new Date().toISOString().split('T')[0]
        }.json"`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create backup' },
      { status: 500 }
    );
  }
}
