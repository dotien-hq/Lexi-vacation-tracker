import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../password-reset/route';
import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/supabase');

describe('POST /api/auth/password-reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send password reset email and return success', async () => {
    const mockResetPasswordForEmail = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    });

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { resetPasswordForEmail: mockResetPasswordForEmail },
    } as unknown as SupabaseClient);

    const request = new NextRequest('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'http://localhost:3000/auth/reset-password',
    });
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('should return 400 if email is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Email is required' });
  });

  it('should return success even when Supabase returns error (prevents email enumeration)', async () => {
    const mockResetPasswordForEmail = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Email not found' },
    });

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { resetPasswordForEmail: mockResetPasswordForEmail },
    } as unknown as SupabaseClient);

    const request = new NextRequest('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Should return success to prevent email enumeration
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('should return 400 for invalid email format', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid email format' });
  });

  it('should return 400 for email as non-string type', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email: 123 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Email must be a string' });
  });

  it('should return 400 for empty string email', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email: '' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Email is required' });
  });

  it('should return 400 for whitespace-only email', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email: '   ' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Email is required' });
  });

  it('should return 400 for malformed JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/password-reset', {
      method: 'POST',
      body: 'not-json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid request body' });
  });
});
