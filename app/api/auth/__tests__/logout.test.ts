import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../logout/route';
import { createServerSupabaseClient } from '@/lib/supabase';
import { clearRateLimitStore } from '@/lib/rateLimit';
import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/supabase');

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitStore();
  });

  it('should call supabase.auth.signOut and return success', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { signOut: mockSignOut },
    } as unknown as SupabaseClient);

    const request = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('should handle signOut errors gracefully', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({
      error: { message: 'Sign out failed' },
    });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { signOut: mockSignOut },
    } as unknown as SupabaseClient);

    const request = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Sign out failed' });
  });
});
