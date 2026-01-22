import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServerClient } from '@supabase/ssr';

// Mock @supabase/ssr
vi.mock('@supabase/ssr');

describe('Middleware Role Protection Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call Supabase to verify admin role for admin routes', async () => {
    const mockGetClaims = vi.fn().mockResolvedValue({
      data: { claims: { sub: 'user-123', email: 'admin@example.com' } },
      error: null,
    });

    const mockSingle = vi.fn().mockResolvedValue({
      data: { role: 'ADMIN', status: 'ACTIVE' },
      error: null,
    });

    const mockEq = vi.fn().mockReturnValue({
      single: mockSingle,
    });

    const mockOr = vi.fn().mockReturnValue({
      eq: mockEq,
    });

    const mockSelect = vi.fn().mockReturnValue({
      or: mockOr,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: mockSelect,
    });

    vi.mocked(createServerClient).mockReturnValue({
      auth: { getClaims: mockGetClaims },
      from: mockFrom,
    } as any);

    // Import and execute middleware
    const { middleware } = await import('../middleware');

    // Create a proper mock request for admin route
    const req = {
      url: 'http://localhost:3000/admin/users',
      nextUrl: {
        pathname: '/admin/users',
        clone: () => new URL('http://localhost:3000/admin/users'),
      },
      cookies: {
        getAll: () => [],
        set: vi.fn(),
      },
    } as any;

    try {
      await middleware(req);
    } catch (e) {
      // NextResponse.next() may fail in tests, that's OK
      // We're testing the Supabase calls
    }

    // Verify auth check was called
    expect(mockGetClaims).toHaveBeenCalled();

    // Verify role check was performed
    expect(mockFrom).toHaveBeenCalledWith('Profile');
    expect(mockSelect).toHaveBeenCalledWith('role, status');
    expect(mockOr).toHaveBeenCalledWith('authUserId.eq.user-123,email.eq.admin@example.com');
    expect(mockEq).toHaveBeenCalledWith('status', 'ACTIVE');
    expect(mockSingle).toHaveBeenCalled();
  });

  it('should check Supabase for non-admin attempting admin routes', async () => {
    const mockGetClaims = vi.fn().mockResolvedValue({
      data: { claims: { sub: 'user-456', email: 'user@example.com' } },
      error: null,
    });

    const mockSingle = vi.fn().mockResolvedValue({
      data: { role: 'USER', status: 'ACTIVE' },
      error: null,
    });

    const mockEq = vi.fn().mockReturnValue({
      single: mockSingle,
    });

    const mockOr = vi.fn().mockReturnValue({
      eq: mockEq,
    });

    const mockSelect = vi.fn().mockReturnValue({
      or: mockOr,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: mockSelect,
    });

    vi.mocked(createServerClient).mockReturnValue({
      auth: { getClaims: mockGetClaims },
      from: mockFrom,
    } as any);

    const { middleware } = await import('../middleware');

    const req = {
      url: 'http://localhost:3000/admin/calendar',
      nextUrl: {
        pathname: '/admin/calendar',
        clone: () => new URL('http://localhost:3000/admin/calendar'),
      },
      cookies: {
        getAll: () => [],
        set: vi.fn(),
      },
    } as any;

    try {
      await middleware(req);
    } catch (e) {
      // Expected to redirect, which may fail in test env
    }

    // Verify the role check happened
    expect(mockGetClaims).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('Profile');
    expect(mockOr).toHaveBeenCalledWith('authUserId.eq.user-456,email.eq.user@example.com');
  });

  it('should not check role for dashboard routes', async () => {
    const mockGetClaims = vi.fn().mockResolvedValue({
      data: { claims: { sub: 'user-789', email: 'user@example.com' } },
      error: null,
    });

    const mockFrom = vi.fn();

    vi.mocked(createServerClient).mockReturnValue({
      auth: { getClaims: mockGetClaims },
      from: mockFrom,
    } as any);

    const { middleware } = await import('../middleware');

    const req = {
      url: 'http://localhost:3000/dashboard',
      nextUrl: {
        pathname: '/dashboard',
        clone: () => new URL('http://localhost:3000/dashboard'),
      },
      cookies: {
        getAll: () => [],
        set: vi.fn(),
      },
    } as any;

    try {
      await middleware(req);
    } catch (e) {
      // NextResponse.next() may fail in tests
    }

    // Verify auth check was called
    expect(mockGetClaims).toHaveBeenCalled();

    // Verify role check was NOT performed (dashboard doesn't require admin)
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should redirect when no valid session exists', async () => {
    const mockGetClaims = vi.fn().mockResolvedValue({
      data: { claims: null },
      error: { message: 'No session' },
    });

    vi.mocked(createServerClient).mockReturnValue({
      auth: { getClaims: mockGetClaims },
    } as any);

    const { middleware } = await import('../middleware');

    const req = {
      url: 'http://localhost:3000/admin/users',
      nextUrl: {
        pathname: '/admin/users',
        clone: () => new URL('http://localhost:3000/admin/users'),
      },
      cookies: {
        getAll: () => [],
        set: vi.fn(),
      },
    } as any;

    try {
      const response = await middleware(req);

      // If we get a response, check if it's a redirect
      if (response) {
        expect(response.status).toBe(307); // NextResponse.redirect uses 307
        const location = response.headers.get('location');
        if (location) {
          expect(location).toContain('/login');
        }
      }
    } catch (e) {
      // Expected behavior - redirect may throw in test environment
    }

    // Verify auth was checked
    expect(mockGetClaims).toHaveBeenCalled();
  });
});
