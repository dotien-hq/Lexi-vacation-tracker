/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminName = process.env.ADMIN_NAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL environment variable is required');
  }

  if (!adminName) {
    throw new Error('ADMIN_NAME environment variable is required');
  }

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD environment variable is required');
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  console.log('Seeding database...');
  console.log(`Creating admin account for: ${adminEmail}`);

  // Check if admin already exists
  const existingAdmin = await prisma.profile.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('Admin profile already exists. Skipping seed.');
    return;
  }

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Check if auth user already exists
  console.log('Checking for existing Supabase Auth user...');
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingAuthUser = existingUsers?.users.find((u) => u.email === adminEmail);

  let authUserId: string;

  if (existingAuthUser) {
    console.log(`Found existing auth user with ID: ${existingAuthUser.id}`);
    console.log('Deleting existing auth user to recreate with new password...');

    const { error: deleteError } = await supabase.auth.admin.deleteUser(existingAuthUser.id);

    if (deleteError) {
      console.error('Failed to delete existing auth user:', deleteError);
      throw new Error('Failed to delete existing Supabase Auth user');
    }

    console.log('Existing auth user deleted.');
  }

  // Create Supabase Auth user
  console.log('Creating Supabase Auth user...');
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: adminName,
    },
  });

  if (authError || !authData.user) {
    console.error('Failed to create auth user:', authError);
    throw new Error('Failed to create Supabase Auth user');
  }

  authUserId = authData.user.id;
  console.log(`Auth user created with ID: ${authUserId}`);

  // Create admin profile linked to auth user
  const admin = await prisma.profile.create({
    data: {
      email: adminEmail,
      fullName: adminName,
      authUserId: authUserId,
      role: 'ADMIN',
      status: 'ACTIVE',
      daysCarryOver: 0,
      daysCurrentYear: 20,
      isActive: true,
    },
  });

  console.log('\n✅ Admin account created successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Profile ID: ${admin.id}`);
  console.log(`  Auth User ID: ${admin.authUserId}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Name: ${admin.fullName}`);
  console.log(`  Role: ${admin.role}`);
  console.log(`  Status: ${admin.status}`);
  console.log(`  Days Carry Over: ${admin.daysCarryOver}`);
  console.log(`  Days Current Year: ${admin.daysCurrentYear}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔑 You can now login at /login with:');
  console.log(`  Email: ${adminEmail}`);
  console.log(`  Password: [your ADMIN_PASSWORD]`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
