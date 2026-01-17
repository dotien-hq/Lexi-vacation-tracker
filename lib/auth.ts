import { createServerSupabaseClient } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { Profile } from '@prisma/client';

/**
 * Get authenticated user profile from Supabase session
 * Uses getUser() instead of getSession() for security
 * @returns Profile or null if not authenticated/not found
 */
export async function getAuthenticatedProfile(): Promise<Profile | null> {
  try {
    const supabase = await createServerSupabaseClient();

    // Use getUser() instead of getSession() for security
    // This validates the token with Supabase Auth server
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return null;
    }

    // Lookup profile by email
    const profile = await prisma.profile.findUnique({
      where: { email: user.email },
    });

    // Return profile only if active
    if (!profile || !profile.isActive) {
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error getting authenticated profile:', error);
    return null;
  }
}
