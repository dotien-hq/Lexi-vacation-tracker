import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { sendReinviteEmail } from '@/lib/email';
import { getAuthenticatedProfile } from '@/lib/auth';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendReinviteEmail: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedProfile: vi.fn(),
}));

describe('POST /api/profiles/[id]/reinvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock admin authentication by default
    vi.mocked(getAuthenticatedProfile).mockResolvedValue({
      id: 'admin-123',
      email: 'admin@company.com',
      fullName: 'Admin User',
      role: 'ADMIN',
      authUserId: 'auth-123',
      status: 'ACTIVE',
      invitationToken: null,
      invitationExpiresAt: null,
      invitedAt: null,
      daysCarryOver: 0,
      daysCurrentYear: 20,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  });

  it('should regenerate token and send re-invite email', async () => {
    const mockProfile = {
      id: 'profile-123',
      email: 'ivan@company.com',
      fullName: 'Ivan Horvat',
      status: 'PENDING',
    };

    vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile as any);
    vi.mocked(prisma.profile.update).mockResolvedValue(mockProfile as any);
    vi.mocked(sendReinviteEmail).mockResolvedValue({ success: true });

    const request = new Request('http://localhost/api/profiles/profile-123/reinvite', {
      method: 'POST',
    });

    const response = await POST(request, { params: { id: 'profile-123' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'profile-123' },
      data: expect.objectContaining({
        invitationToken: expect.any(String),
        invitationExpiresAt: expect.any(Date),
      }),
    });
  });

  it('should reject reinvite for already active users', async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({
      id: 'profile-123',
      status: 'ACTIVE',
    } as any);

    const request = new Request('http://localhost/api/profiles/profile-123/reinvite', {
      method: 'POST',
    });

    const response = await POST(request, { params: { id: 'profile-123' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('already active');
  });
});
