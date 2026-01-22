import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { sendInvitationEmailWithToken } from '@/lib/email';
import { getAuthenticatedProfile } from '@/lib/auth';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendInvitationEmail: vi.fn(),
  sendInvitationEmailWithToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedProfile: vi.fn(),
}));

describe('POST /api/profiles', () => {
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

  it('should create profile and send invitation', async () => {
    const mockProfile = {
      id: 'profile-123',
      email: 'ivan@company.com',
      fullName: 'Ivan Horvat',
      status: 'PENDING',
      invitationToken: 'hashed-token',
      invitationExpiresAt: new Date(),
    };

    vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.profile.create).mockResolvedValue(mockProfile as any);
    vi.mocked(sendInvitationEmailWithToken).mockResolvedValue({ success: true });

    const request = new Request('http://localhost/api/profiles', {
      method: 'POST',
      body: JSON.stringify({
        email: 'ivan@company.com',
        fullName: 'Ivan Horvat',
        daysCurrentYear: 24,
        daysCarryOver: 5,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.profile).toBeDefined();
    expect(prisma.profile.create).toHaveBeenCalled();
    expect(sendInvitationEmailWithToken).toHaveBeenCalledWith(
      'ivan@company.com',
      'Ivan Horvat',
      expect.any(String),
      expect.any(String)
    );
  });

  it('should reject duplicate email', async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({
      id: 'existing-123',
      email: 'ivan@company.com',
    } as any);

    const request = new Request('http://localhost/api/profiles', {
      method: 'POST',
      body: JSON.stringify({
        email: 'ivan@company.com',
        fullName: 'Ivan Horvat',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('already exists');
  });
});
