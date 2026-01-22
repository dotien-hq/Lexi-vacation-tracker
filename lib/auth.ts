import { createServerSupabaseClient } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { Profile } from '@prisma/client';

/**
 * Get authenticated user profile from Supabase session
 * Uses getUser() instead of getSession() for security
 * Also validates that profile status is ACTIVE
 * @returns Profile or null if not authenticated/not found/not active
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

    // Lookup profile by email or authUserId
    let profile = null;

    // Try to find by authUserId first (more reliable)
    if (user.id) {
      profile = await prisma.profile.findUnique({
        where: { authUserId: user.id },
      });
    }

    // Fallback to email lookup (for legacy users)
    if (!profile) {
      profile = await prisma.profile.findUnique({
        where: { email: user.email },
      });
    }

    // Return profile only if it exists and status is ACTIVE
    if (!profile || profile.status !== 'ACTIVE') {
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error getting authenticated profile:', error);
    return null;
  }
}
