import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { generateInvitationToken, hashToken, generateInvitationExpiry } from '@/lib/tokens';

describe('Invitation Flow Integration', () => {
  let testProfileId: string;
  let testToken: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.profile.deleteMany({
      where: { email: 'integration-test@example.com' },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testProfileId) {
      await prisma.profile
        .delete({
          where: { id: testProfileId },
        })
        .catch(() => {
          // Ignore errors if already deleted
        });
    }
  });

  it('should complete full invitation flow', async () => {
    // Step 1: Create profile with invitation
    testToken = generateInvitationToken();
    const tokenHash = hashToken(testToken);
    const expiresAt = generateInvitationExpiry();

    const profile = await prisma.profile.create({
      data: {
        email: 'integration-test@example.com',
        fullName: 'Integration Test',
        status: 'PENDING',
        invitationToken: tokenHash,
        invitationExpiresAt: expiresAt,
        daysCurrentYear: 20,
        daysCarryOver: 0,
      },
    });

    testProfileId = profile.id;

    // Step 2: Verify profile is pending
    expect(profile.status).toBe('PENDING');
    expect(profile.authUserId).toBeNull();
    expect(profile.invitationToken).toBe(tokenHash);

    // Step 3: Simulate token validation (what complete-invite does)
    const foundProfile = await prisma.profile.findUnique({
      where: { invitationToken: tokenHash },
    });

    expect(foundProfile).toBeTruthy();
    expect(foundProfile?.email).toBe('integration-test@example.com');

    // Step 4: Simulate activation (without actually creating Supabase user)
    const updatedProfile = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        status: 'ACTIVE',
        invitationToken: null,
        invitationExpiresAt: null,
        isActive: true,
      },
    });

    expect(updatedProfile.status).toBe('ACTIVE');
    expect(updatedProfile.invitationToken).toBeNull();
  });

  it('should invalidate old token on reinvite', async () => {
    // Create profile with old token
    const oldToken = generateInvitationToken();
    const oldTokenHash = hashToken(oldToken);

    const profile = await prisma.profile.create({
      data: {
        email: 'reinvite-test@example.com',
        fullName: 'Reinvite Test',
        status: 'PENDING',
        invitationToken: oldTokenHash,
        invitationExpiresAt: generateInvitationExpiry(),
        daysCurrentYear: 20,
        daysCarryOver: 0,
      },
    });

    // Generate new token (reinvite)
    const newToken = generateInvitationToken();
    const newTokenHash = hashToken(newToken);

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        invitationToken: newTokenHash,
        invitationExpiresAt: generateInvitationExpiry(),
      },
    });

    // Old token should not find profile
    const oldTokenProfile = await prisma.profile.findUnique({
      where: { invitationToken: oldTokenHash },
    });
    expect(oldTokenProfile).toBeNull();

    // New token should find profile
    const newTokenProfile = await prisma.profile.findUnique({
      where: { invitationToken: newTokenHash },
    });
    expect(newTokenProfile).toBeTruthy();

    // Cleanup
    await prisma.profile.delete({ where: { id: profile.id } });
  });
});
