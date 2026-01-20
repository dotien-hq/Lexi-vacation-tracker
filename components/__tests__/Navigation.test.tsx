import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Navigation from '../Navigation';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/types';
import type { User } from '@supabase/supabase-js';

vi.mock('@/lib/auth-context');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/dashboard',
}));

describe('Navigation Logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display logout button when user is authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'user@example.com' } as unknown as User,
      profile: {
        id: '1',
        email: 'user@example.com',
        fullName: 'Test User',
        role: Role.USER,
        daysCurrentYear: 20,
        daysCarryOver: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      loading: false,
      signOut: vi.fn(),
    });

    render(<Navigation />);

    expect(screen.getByText('Odjavi se')).toBeInTheDocument();
  });

  it('should call signOut and redirect on logout click', async () => {
    const mockPush = vi.fn();
    const mockSignOut = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useAuth).mockReturnValue({
      user: { id: '123', email: 'user@example.com' } as unknown as User,
      profile: {
        id: '1',
        email: 'user@example.com',
        fullName: 'Test User',
        role: Role.USER,
        daysCurrentYear: 20,
        daysCarryOver: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      loading: false,
      signOut: mockSignOut,
    });

    const useRouter = await import('next/navigation');
    vi.spyOn(useRouter, 'useRouter').mockReturnValue({
      push: mockPush,
    } as unknown as ReturnType<typeof useRouter.useRouter>);

    render(<Navigation />);

    expect(screen.getByText('Odjavi se')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Odjavi se'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
