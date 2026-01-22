import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResetPasswordPage from '../page';
import { createBrowserClient } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/supabase');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render password reset form', () => {
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: '123' } } },
      error: null,
    });

    vi.mocked(createBrowserClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    } as unknown as SupabaseClient);

    render(<ResetPasswordPage />);

    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('should update password and redirect on success', async () => {
    const mockPush = vi.fn();
    const mockUpdateUser = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    });
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: '123' } } },
      error: null,
    });

    vi.mocked(createBrowserClient).mockReturnValue({
      auth: {
        updateUser: mockUpdateUser,
        getSession: mockGetSession,
      },
    } as unknown as SupabaseClient);

    const useRouter = await import('next/navigation');
    vi.spyOn(useRouter, 'useRouter').mockReturnValue({
      push: mockPush,
    } as unknown as ReturnType<typeof useRouter.useRouter>);

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'newpassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should show error if passwords do not match', async () => {
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: '123' } } },
      error: null,
    });

    vi.mocked(createBrowserClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    } as unknown as SupabaseClient);

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'different123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('should show error if password is too short', async () => {
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: '123' } } },
      error: null,
    });

    vi.mocked(createBrowserClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    } as unknown as SupabaseClient);

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'short' },
    });

    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('should show error when Supabase returns error', async () => {
    const mockUpdateUser = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Token expired' },
    });
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: '123' } } },
      error: null,
    });

    vi.mocked(createBrowserClient).mockReturnValue({
      auth: {
        updateUser: mockUpdateUser,
        getSession: mockGetSession,
      },
    } as unknown as SupabaseClient);

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'newpassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/token expired/i)).toBeInTheDocument();
    });
  });

  it('should show error when generic exception occurs', async () => {
    const mockUpdateUser = vi.fn().mockRejectedValue(new Error('Network error'));
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: '123' } } },
      error: null,
    });

    vi.mocked(createBrowserClient).mockReturnValue({
      auth: {
        updateUser: mockUpdateUser,
        getSession: mockGetSession,
      },
    } as unknown as SupabaseClient);

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'newpassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/error resetting password/i)).toBeInTheDocument();
    });
  });

  it('should show error when session does not exist', async () => {
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(createBrowserClient).mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    } as unknown as SupabaseClient);

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText(/password reset link has expired/i)).toBeInTheDocument();
    });
  });
});
