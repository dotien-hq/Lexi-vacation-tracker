import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../logout/route';
import { createServerSupabaseClient } from '@/lib/supabase';

vi.mock('@/lib/supabase');

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call supabase.auth.signOut and return success', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { signOut: mockSignOut },
    } as any);

    const response = await POST();
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
    } as any);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Sign out failed' });
  });
});
