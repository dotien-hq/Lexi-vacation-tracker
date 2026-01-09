import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.leaveRequest.deleteMany();
  await prisma.employee.deleteMany();

  // Seed employees
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        name: 'Marko Horvat',
        email: 'marko.horvat@company.hr',
        daysCarryOver: 5,
        daysCurrentYear: 20,
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        name: 'Ana Babić',
        email: 'ana.babic@company.hr',
        daysCarryOver: 0,
        daysCurrentYear: 24,
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        name: 'Ivan Kovač',
        email: 'ivan.kovac@company.hr',
        daysCarryOver: 12,
        daysCurrentYear: 22,
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        name: 'Petra Ivić',
        email: 'petra.ivic@company.hr',
        daysCarryOver: 2,
        daysCurrentYear: 20,
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        name: 'Luka Marić',
        email: 'luka.maric@company.hr',
        daysCarryOver: 0,
        daysCurrentYear: 18,
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        name: 'Maja Jurić',
        email: 'maja.juric@company.hr',
        daysCarryOver: 10,
        daysCurrentYear: 25,
        isActive: true,
      },
    }),
  ]);

  console.log(`Created ${employees.length} employees`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
