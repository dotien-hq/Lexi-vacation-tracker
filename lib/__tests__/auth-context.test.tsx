import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth-context';
import { createBrowserClient } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/supabase');

function TestComponent() {
  const { user, profile, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;
  return (
    <div>
      <div>User: {user.email}</div>
      <div>Profile: {profile?.fullName}</div>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide auth state to children', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: '123', email: 'user@example.com' } },
      error: null,
    });

    const mockOnAuthStateChange = vi.fn((callback) => {
      // Simulate initial auth state
      callback('SIGNED_IN', { user: { id: '123', email: 'user@example.com' } });
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    vi.mocked(createBrowserClient).mockReturnValue({
      auth: {
        getUser: mockGetUser,
        onAuthStateChange: mockOnAuthStateChange,
      },
    } as unknown as SupabaseClient);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fullName: 'Test User', role: 'USER' }),
    } as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('User: user@example.com')).toBeInTheDocument();
      expect(screen.getByText('Profile: Test User')).toBeInTheDocument();
    });
  });

  it('should show not authenticated when no user', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const mockOnAuthStateChange = vi.fn((callback) => {
      callback('SIGNED_OUT', null);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    vi.mocked(createBrowserClient).mockReturnValue({
      auth: {
        getUser: mockGetUser,
        onAuthStateChange: mockOnAuthStateChange,
      },
    } as unknown as SupabaseClient);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });
  });

  it('should throw error when useAuth used outside provider', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within AuthProvider');

    spy.mockRestore();
  });
});
