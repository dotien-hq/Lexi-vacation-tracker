import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { clearRateLimitStore } from '@/lib/rateLimit';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

describe('POST /api/auth/complete-invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitStore();
  });

  it('should reject request with missing token', async () => {
    const request = new NextRequest('http://localhost/api/auth/complete-invite', {
      method: 'POST',
      body: JSON.stringify({ password: 'test12345' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details.fieldErrors.token).toBeDefined();
  });

  it('should reject request with missing password', async () => {
    const request = new NextRequest('http://localhost/api/auth/complete-invite', {
      method: 'POST',
      body: JSON.stringify({ token: 'abc123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details.fieldErrors.password).toBeDefined();
  });

  it('should reject invalid token', async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/auth/complete-invite', {
      method: 'POST',
      body: JSON.stringify({ token: 'invalid-token', password: 'test12345' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid or expired');
  });

  it('should reject expired token', async () => {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);

    vi.mocked(prisma.profile.findUnique).mockResolvedValue({
      id: 'profile-123',
      email: 'test@example.com',
      fullName: 'Test User',
      authUserId: null,
      status: 'PENDING',
      invitationToken: 'token-hash',
      invitationExpiresAt: expiredDate,
      invitedAt: new Date(),
      role: 'USER',
      daysCarryOver: 0,
      daysCurrentYear: 20,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const request = new NextRequest('http://localhost/api/auth/complete-invite', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'test12345' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('expired');
  });
});
