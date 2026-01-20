import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Navigation from '../Navigation';
import { createBrowserClient } from '@/lib/supabase';

vi.mock('@/lib/supabase');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/dashboard',
}));

global.fetch = vi.fn();

describe('Navigation Logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display logout button when user is authenticated', async () => {
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: '123' } } },
      error: null,
    });

    vi.mocked(createBrowserClient).mockReturnValue({
      auth: { getSession: mockGetSession },
    } as unknown as ReturnType<typeof createBrowserClient>);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ role: 'USER' }),
    } as unknown as Response);

    render(<Navigation />);

    await waitFor(() => {
      expect(screen.getByText('Odjavi se')).toBeInTheDocument();
    });
  });

  it('should call logout endpoint and redirect on logout click', async () => {
    const mockPush = vi.fn();
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: '123' } } },
      error: null,
    });

    vi.mocked(createBrowserClient).mockReturnValue({
      auth: { getSession: mockGetSession },
    } as unknown as ReturnType<typeof createBrowserClient>);

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ role: 'USER' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as unknown as Response);

    const useRouter = await import('next/navigation');
    vi.spyOn(useRouter, 'useRouter').mockReturnValue({
      push: mockPush,
    } as unknown as ReturnType<typeof useRouter.useRouter>);

    render(<Navigation />);

    await waitFor(() => {
      expect(screen.getByText('Odjavi se')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Odjavi se'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
      });
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
