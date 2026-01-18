import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/lib/auth';

/**
 * GET /api/profile/me - Get current user's profile
 * Returns the authenticated user's profile
 */
export async function GET() {
  try {
    const profile = await getAuthenticatedProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
