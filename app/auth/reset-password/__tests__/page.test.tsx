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

    expect(screen.getByRole('heading', { name: /resetiraj lozinku/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nova lozinka/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/potvrdi lozinku/i)).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText(/nova lozinka/i), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText(/potvrdi lozinku/i), {
      target: { value: 'newpassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /resetiraj/i }));

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

    fireEvent.change(screen.getByLabelText(/nova lozinka/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/potvrdi lozinku/i), {
      target: { value: 'different123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /resetiraj/i }));

    await waitFor(() => {
      expect(screen.getByText(/lozinke se ne podudaraju/i)).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText(/nova lozinka/i), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByLabelText(/potvrdi lozinku/i), {
      target: { value: 'short' },
    });

    fireEvent.click(screen.getByRole('button', { name: /resetiraj/i }));

    await waitFor(() => {
      expect(screen.getByText(/najmanje 8 znakova/i)).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText(/nova lozinka/i), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText(/potvrdi lozinku/i), {
      target: { value: 'newpassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /resetiraj/i }));

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

    fireEvent.change(screen.getByLabelText(/nova lozinka/i), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText(/potvrdi lozinku/i), {
      target: { value: 'newpassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /resetiraj/i }));

    await waitFor(() => {
      expect(screen.getByText(/greška prilikom resetiranja lozinke/i)).toBeInTheDocument();
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
      expect(screen.getByText(/link za resetiranje lozinke je istekao/i)).toBeInTheDocument();
    });
  });
});
