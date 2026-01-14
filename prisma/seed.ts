/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminName = process.env.ADMIN_NAME;

  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL environment variable is required');
  }

  if (!adminName) {
    throw new Error('ADMIN_NAME environment variable is required');
  }

  console.log('Seeding database...');
  console.log(`Creating admin profile for: ${adminEmail}`);

  // Check if admin already exists
  const existingAdmin = await prisma.profile.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('Admin profile already exists. Skipping seed.');
    return;
  }

  // Create admin profile
  const admin = await prisma.profile.create({
    data: {
      email: adminEmail,
      fullName: adminName,
      role: 'ADMIN',
      daysCarryOver: 0,
      daysCurrentYear: 20,
      isActive: true,
    },
  });

  console.log('Admin profile created successfully:');
  console.log(`  ID: ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Name: ${admin.fullName}`);
  console.log(`  Role: ${admin.role}`);
  console.log(`  Days Carry Over: ${admin.daysCarryOver}`);
  console.log(`  Days Current Year: ${admin.daysCurrentYear}`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
