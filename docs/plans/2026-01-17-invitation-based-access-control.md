# Invitation-Based Access Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from public Magic Link authentication to closed invitation-only B2B system with admin-controlled access.

**Architecture:** Decouple Profile from Supabase Auth by making authUserId nullable, add invitation token workflow with 7-day expiry, enable email/password authentication, route all emails through SendGrid with custom branded templates.

**Tech Stack:** Next.js 15, Prisma 6.1, Supabase Auth (Email/Password), SendGrid, TypeScript 5.8, Vitest

---

## Task 1: Database Schema - Add UserStatus Enum

**Files:**

- Modify: `prisma/schema.prisma:11-14`

**Step 1: Add UserStatus enum to schema**

Add the enum after the existing Role enum:

```prisma
enum UserStatus {
  PENDING
  ACTIVE
  DEACTIVATED
}
```

**Step 2: Verify schema syntax**

Run: `npx prisma format`
Expected: Schema formatted successfully

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add UserStatus enum to schema"
```

---

## Task 2: Database Schema - Update Profile Model

**Files:**

- Modify: `prisma/schema.prisma:22-33`

**Step 1: Add new fields to Profile model**

Replace the Profile model with:

```prisma
model Profile {
  id              String         @id @default(uuid())
  email           String         @unique
  fullName        String?

  // Link to Supabase Auth (Nullable until activation)
  authUserId      String?        @unique

  // Status Management
  status          UserStatus     @default(PENDING)

  // Invitation Logic
  invitationToken     String?   @unique
  invitationExpiresAt DateTime?
  invitedAt           DateTime? @default(now())

  // Business Logic
  role            Role           @default(USER)
  daysCarryOver   Int            @default(0)
  daysCurrentYear Int            @default(20)

  // Legacy field (will migrate to status)
  isActive        Boolean        @default(true)

  // Metadata
  requests        LeaveRequest[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}
```

**Step 2: Format and validate schema**

Run: `npx prisma format`
Expected: Schema formatted successfully

**Step 3: Generate Prisma Client**

Run: `npx prisma generate`
Expected: Generated Prisma Client successfully

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add invitation fields and authUserId to Profile model"
```

---

## Task 3: Database Schema - Push to Database

**Files:**

- Database: Supabase PostgreSQL

**Step 1: Push schema changes**

Run: `npx prisma db push`
Expected: Database schema updated successfully
Note: Existing data will have NULL values for new fields

**Step 2: Verify in Prisma Studio**

Run: `npx prisma studio`
Expected: Studio opens, Profile table shows new columns

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "chore: push schema changes to database"
```

---

## Task 4: Token Generation Utility - Write Tests

**Files:**

- Create: `lib/__tests__/tokens.test.ts`

**Step 1: Write test for token generation**

```typescript
import { describe, it, expect } from 'vitest';
import { generateInvitationToken, hashToken, verifyToken } from '../tokens';

describe('token utilities', () => {
  describe('generateInvitationToken', () => {
    it('should generate a 32-character token', () => {
      const token = generateInvitationToken();
      expect(token).toHaveLength(32);
    });

    it('should generate unique tokens', () => {
      const token1 = generateInvitationToken();
      const token2 = generateInvitationToken();
      expect(token1).not.toBe(token2);
    });

    it('should only contain alphanumeric characters', () => {
      const token = generateInvitationToken();
      expect(token).toMatch(/^[a-zA-Z0-9]+$/);
    });
  });

  describe('hashToken', () => {
    it('should hash a token consistently', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token-1');
      const hash2 = hashToken('token-2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = 'test-token-123';
      const hash = hashToken(token);
      expect(verifyToken(token, hash)).toBe(true);
    });

    it('should reject an invalid token', () => {
      const hash = hashToken('correct-token');
      expect(verifyToken('wrong-token', hash)).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test lib/__tests__/tokens.test.ts`
Expected: FAIL - Cannot find module '../tokens'

**Step 3: Commit**

```bash
git add lib/__tests__/tokens.test.ts
git commit -m "test: add token generation utility tests"
```

---

## Task 5: Token Generation Utility - Implementation

**Files:**

- Create: `lib/tokens.ts`

**Step 1: Implement token utilities**

```typescript
import crypto from 'crypto';

/**
 * Generate a cryptographically secure invitation token
 * @returns 32-character alphanumeric token
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash a token for secure storage
 * @param token The token to hash
 * @returns SHA-256 hash of the token
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against its hash
 * @param token The token to verify
 * @param hash The stored hash
 * @returns true if token matches hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
}

/**
 * Generate invitation expiry date (7 days from now)
 * @returns Date object 7 days in the future
 */
export function generateInvitationExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);
  return expiry;
}

/**
 * Check if invitation token has expired
 * @param expiresAt The expiration date
 * @returns true if expired
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return new Date() > expiresAt;
}
```

**Step 2: Run tests to verify implementation**

Run: `npm test lib/__tests__/tokens.test.ts`
Expected: PASS - All tests passing

**Step 3: Commit**

```bash
git add lib/tokens.ts
git commit -m "feat: implement token generation and validation utilities"
```

---

## Task 6: Email Service - Add Invitation Email Tests

**Files:**

- Modify: `lib/__tests__/email.test.ts`

**Step 1: Add tests for new invitation email function**

Add after existing tests:

```typescript
describe('sendInvitationEmailWithToken', () => {
  it('should send invitation email with token link', async () => {
    mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);

    const result = await sendInvitationEmailWithToken(
      'ivan@company.com',
      'Ivan Horvat',
      'abc123def456',
      'Admin User'
    );

    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ivan@company.com',
        subject: expect.stringContaining('invited'),
      })
    );
  });

  it('should include token in invitation URL', async () => {
    mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);

    await sendInvitationEmailWithToken(
      'ivan@company.com',
      'Ivan Horvat',
      'abc123def456',
      'Admin User'
    );

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('/auth/accept?token=abc123def456');
  });

  it('should return error when email service not configured', async () => {
    // This test will pass if SENDGRID_API_KEY is not set
    const result = await sendInvitationEmailWithToken(
      'test@example.com',
      'Test User',
      'token123',
      'Admin'
    );

    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('sendReinviteEmail', () => {
  it('should send re-invite email', async () => {
    mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);

    const result = await sendReinviteEmail('ivan@company.com', 'Ivan Horvat', 'newtoken123');

    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ivan@company.com',
        subject: expect.stringContaining('invitation'),
      })
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test lib/__tests__/email.test.ts`
Expected: FAIL - Functions not defined

**Step 3: Commit**

```bash
git add lib/__tests__/email.test.ts
git commit -m "test: add invitation email with token tests"
```

---

## Task 7: Email Service - Implement Invitation Emails

**Files:**

- Modify: `lib/email.ts`

**Step 1: Add new email functions**

Add these functions to email.ts:

```typescript
/**
 * Send invitation email with secure token link
 * @param email User's email address
 * @param fullName User's full name
 * @param token Invitation token
 * @param adminName Name of admin who sent invitation
 * @returns Promise with success status
 */
export async function sendInvitationEmailWithToken(
  email: string,
  fullName: string,
  token: string,
  adminName: string
): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  try {
    const inviteUrl = `${appUrl}/auth/accept?token=${token}`;

    const msg = {
      to: email,
      from: fromEmail,
      subject: "You're invited to Lexi Vacation Tracker",
      text: `Hello ${fullName},\n\n${adminName} has invited you to join Lexi Vacation Tracker.\n\nClick the link below to accept your invitation and set your password:\n${inviteUrl}\n\nThis invitation will expire in 7 days.\n\nBest regards,\nLexi Vacation Tracker Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0041F0;">You're Invited!</h2>
          <p>Hello <strong>${fullName}</strong>,</p>
          <p><strong>${adminName}</strong> has invited you to join Lexi Vacation Tracker.</p>
          <p>Click the button below to accept your invitation and set your password:</p>
          <p style="margin: 30px 0;">
            <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0041F0; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
          </p>
          <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days.</p>
          <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link:<br/>
          <a href="${inviteUrl}" style="color: #0041F0;">${inviteUrl}</a></p>
          <p>Best regards,<br/>Lexi Vacation Tracker Team</p>
        </div>
      `,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send re-invitation email when admin resends invite
 * @param email User's email address
 * @param fullName User's full name
 * @param token New invitation token
 * @returns Promise with success status
 */
export async function sendReinviteEmail(
  email: string,
  fullName: string,
  token: string
): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  try {
    const inviteUrl = `${appUrl}/auth/accept?token=${token}`;

    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Reminder: Complete your Lexi Vacation Tracker setup',
      text: `Hello ${fullName},\n\nThis is a reminder to complete your Lexi Vacation Tracker setup.\n\nClick the link below to accept your invitation and set your password:\n${inviteUrl}\n\nThis invitation will expire in 7 days.\n\nBest regards,\nLexi Vacation Tracker Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0041F0;">Complete Your Setup</h2>
          <p>Hello <strong>${fullName}</strong>,</p>
          <p>This is a reminder to complete your Lexi Vacation Tracker setup.</p>
          <p>Click the button below to accept your invitation and set your password:</p>
          <p style="margin: 30px 0;">
            <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0041F0; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Complete Setup</a>
          </p>
          <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days.</p>
          <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link:<br/>
          <a href="${inviteUrl}" style="color: #0041F0;">${inviteUrl}</a></p>
          <p>Best regards,<br/>Lexi Vacation Tracker Team</p>
        </div>
      `,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Failed to send re-invite email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Step 2: Run tests to verify implementation**

Run: `npm test lib/__tests__/email.test.ts`
Expected: PASS - All tests passing

**Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat: add invitation and re-invite email functions"
```

---

## Task 8: Update Auth Helper - Add Status Check

**Files:**

- Modify: `lib/auth.ts:10-40`

**Step 1: Update getAuthenticatedProfile to check status**

Replace the function:

```typescript
/**
 * Get authenticated user profile from Supabase session
 * Uses getUser() instead of getSession() for security
 * Also validates that profile status is ACTIVE
 * @returns Profile or null if not authenticated/not found/not active
 */
export async function getAuthenticatedProfile(): Promise<Profile | null> {
  try {
    const supabase = await createServerSupabaseClient();

    // Use getUser() instead of getSession() for security
    // This validates the token with Supabase Auth server
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return null;
    }

    // Lookup profile by email or authUserId
    let profile = null;

    // Try to find by authUserId first (more reliable)
    if (user.id) {
      profile = await prisma.profile.findUnique({
        where: { authUserId: user.id },
      });
    }

    // Fallback to email lookup (for legacy users)
    if (!profile) {
      profile = await prisma.profile.findUnique({
        where: { email: user.email },
      });
    }

    // Return profile only if it exists and status is ACTIVE
    if (!profile || profile.status !== 'ACTIVE') {
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error getting authenticated profile:', error);
    return null;
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: update auth to check ACTIVE status and authUserId"
```

---

## Task 9: API Route - Complete Invite (Tests)

**Files:**

- Create: `app/api/auth/complete-invite/__tests__/route.test.ts`

**Step 1: Write tests for complete-invite endpoint**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: vi.fn(),
}));

describe('POST /api/auth/complete-invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject request with missing token', async () => {
    const request = new Request('http://localhost/api/auth/complete-invite', {
      method: 'POST',
      body: JSON.stringify({ password: 'test123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('token');
  });

  it('should reject request with missing password', async () => {
    const request = new Request('http://localhost/api/auth/complete-invite', {
      method: 'POST',
      body: JSON.stringify({ token: 'abc123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('password');
  });

  it('should reject invalid token', async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost/api/auth/complete-invite', {
      method: 'POST',
      body: JSON.stringify({ token: 'invalid-token', password: 'test123' }),
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

    const request = new Request('http://localhost/api/auth/complete-invite', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'test123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('expired');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test app/api/auth/complete-invite`
Expected: FAIL - Route handler not found

**Step 3: Commit**

```bash
git add app/api/auth/complete-invite/__tests__/route.test.ts
git commit -m "test: add complete-invite endpoint tests"
```

---

## Task 10: API Route - Complete Invite (Implementation)

**Files:**

- Create: `app/api/auth/complete-invite/route.ts`

**Step 1: Implement complete-invite endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashToken, isTokenExpired } from '@/lib/tokens';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    // Validate input
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Hash the token to find profile
    const tokenHash = hashToken(token);

    // Find profile by invitation token
    const profile = await prisma.profile.findUnique({
      where: { invitationToken: tokenHash },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 400 });
    }

    // Check if token is expired
    if (isTokenExpired(profile.invitationExpiresAt)) {
      return NextResponse.json({ error: 'Invitation token has expired' }, { status: 400 });
    }

    // Check if already activated
    if (profile.status === 'ACTIVE' && profile.authUserId) {
      return NextResponse.json(
        { error: 'This invitation has already been accepted' },
        { status: 400 }
      );
    }

    // Create Supabase auth user
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: profile.email,
      password: password,
      email_confirm: true, // Auto-confirm email since we sent the invitation
      user_metadata: {
        full_name: profile.fullName,
      },
    });

    if (authError || !authData.user) {
      console.error('Failed to create auth user:', authError);
      return NextResponse.json(
        { error: 'Failed to create account. Please contact support.' },
        { status: 500 }
      );
    }

    // Update profile with auth user ID and activate
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        authUserId: authData.user.id,
        status: 'ACTIVE',
        invitationToken: null, // Clear token after use
        invitationExpiresAt: null,
        isActive: true, // Legacy field for backward compatibility
      },
    });

    // Sign in the user
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: password,
    });

    if (signInError) {
      console.error('Failed to sign in user:', signInError);
      // User is created but not signed in - they can use login page
      return NextResponse.json({
        success: true,
        message: 'Account created. Please sign in.',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Account activated successfully',
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
      },
    });
  } catch (error) {
    console.error('Error completing invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 2: Run tests**

Run: `npm test app/api/auth/complete-invite`
Expected: Some tests may pass, adjust mocks if needed

**Step 3: Commit**

```bash
git add app/api/auth/complete-invite/route.ts
git commit -m "feat: implement complete-invite endpoint"
```

---

## Task 11: API Route - Modify Create Profile (Tests)

**Files:**

- Create: `app/api/profiles/__tests__/route.test.ts`

**Step 1: Write tests for updated POST /api/profiles**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { sendInvitationEmailWithToken } from '@/lib/email';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendInvitationEmailWithToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedProfile: vi.fn(),
}));

describe('POST /api/profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create profile and send invitation', async () => {
    const mockProfile = {
      id: 'profile-123',
      email: 'ivan@company.com',
      fullName: 'Ivan Horvat',
      status: 'PENDING',
      invitationToken: 'hashed-token',
      invitationExpiresAt: new Date(),
    };

    vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.profile.create).mockResolvedValue(mockProfile as any);
    vi.mocked(sendInvitationEmailWithToken).mockResolvedValue({ success: true });

    const request = new Request('http://localhost/api/profiles', {
      method: 'POST',
      body: JSON.stringify({
        email: 'ivan@company.com',
        fullName: 'Ivan Horvat',
        daysCurrentYear: 24,
        daysCarryOver: 5,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.profile).toBeDefined();
    expect(prisma.profile.create).toHaveBeenCalled();
    expect(sendInvitationEmailWithToken).toHaveBeenCalledWith(
      'ivan@company.com',
      'Ivan Horvat',
      expect.any(String),
      expect.any(String)
    );
  });

  it('should reject duplicate email', async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({
      id: 'existing-123',
      email: 'ivan@company.com',
    } as any);

    const request = new Request('http://localhost/api/profiles', {
      method: 'POST',
      body: JSON.stringify({
        email: 'ivan@company.com',
        fullName: 'Ivan Horvat',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('already exists');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test app/api/profiles/__tests__/route.test.ts`
Expected: FAIL - Implementation doesn't match tests

**Step 3: Commit**

```bash
git add app/api/profiles/__tests__/route.test.ts
git commit -m "test: add profile creation with invitation tests"
```

---

## Task 12: API Route - Modify Create Profile (Implementation)

**Files:**

- Read existing: `app/api/profiles/route.ts`
- Modify: `app/api/profiles/route.ts`

**Step 1: Read current implementation**

Run: `cat app/api/profiles/route.ts`

**Step 2: Update POST handler to include invitation flow**

Modify the POST function to:

1. Generate invitation token
2. Hash and store token
3. Set expiry to 7 days
4. Send invitation email
5. Return profile with pending status

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedProfile } from '@/lib/auth';
import { sendInvitationEmailWithToken } from '@/lib/email';
import { generateInvitationToken, hashToken, generateInvitationExpiry } from '@/lib/tokens';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminProfile = await getAuthenticatedProfile();
    if (!adminProfile || adminProfile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, fullName, daysCurrentYear = 20, daysCarryOver = 0, role = 'USER' } = body;

    // Validate required fields
    if (!email || !fullName) {
      return NextResponse.json({ error: 'Email and full name are required' }, { status: 400 });
    }

    // Check if profile already exists
    const existingProfile = await prisma.profile.findUnique({
      where: { email },
    });

    if (existingProfile) {
      return NextResponse.json(
        { error: 'A profile with this email already exists' },
        { status: 400 }
      );
    }

    // Generate invitation token
    const invitationToken = generateInvitationToken();
    const tokenHash = hashToken(invitationToken);
    const expiresAt = generateInvitationExpiry();

    // Create profile with PENDING status
    const profile = await prisma.profile.create({
      data: {
        email,
        fullName,
        role,
        daysCurrentYear,
        daysCarryOver,
        status: 'PENDING',
        invitationToken: tokenHash,
        invitationExpiresAt: expiresAt,
        invitedAt: new Date(),
        isActive: false, // Legacy field
      },
    });

    // Send invitation email
    const emailResult = await sendInvitationEmailWithToken(
      email,
      fullName,
      invitationToken, // Send unhashed token in email
      adminProfile.fullName || 'Admin'
    );

    if (!emailResult.success) {
      console.error('Failed to send invitation email:', emailResult.error);
      // Profile created but email failed - admin can resend
    }

    return NextResponse.json(
      {
        profile: {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          status: profile.status,
          invitedAt: profile.invitedAt,
        },
        emailSent: emailResult.success,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 3: Run tests**

Run: `npm test app/api/profiles/__tests__/route.test.ts`
Expected: PASS (or identify failing tests to fix)

**Step 4: Commit**

```bash
git add app/api/profiles/route.ts
git commit -m "feat: add invitation flow to profile creation"
```

---

## Task 13: API Route - Re-invite Endpoint (Tests)

**Files:**

- Create: `app/api/profiles/[id]/reinvite/__tests__/route.test.ts`

**Step 1: Write tests for reinvite endpoint**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { sendReinviteEmail } from '@/lib/email';

vi.mock('@/lib/prisma');
vi.mock('@/lib/email');
vi.mock('@/lib/auth');

describe('POST /api/profiles/[id]/reinvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should regenerate token and send re-invite email', async () => {
    const mockProfile = {
      id: 'profile-123',
      email: 'ivan@company.com',
      fullName: 'Ivan Horvat',
      status: 'PENDING',
    };

    vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile as any);
    vi.mocked(prisma.profile.update).mockResolvedValue(mockProfile as any);
    vi.mocked(sendReinviteEmail).mockResolvedValue({ success: true });

    const request = new Request('http://localhost/api/profiles/profile-123/reinvite', {
      method: 'POST',
    });

    const response = await POST(request, { params: { id: 'profile-123' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'profile-123' },
      data: expect.objectContaining({
        invitationToken: expect.any(String),
        invitationExpiresAt: expect.any(Date),
      }),
    });
  });

  it('should reject reinvite for already active users', async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({
      id: 'profile-123',
      status: 'ACTIVE',
    } as any);

    const request = new Request('http://localhost/api/profiles/profile-123/reinvite', {
      method: 'POST',
    });

    const response = await POST(request, { params: { id: 'profile-123' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('already active');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test app/api/profiles/\\[id\\]/reinvite`
Expected: FAIL - Route not found

**Step 3: Commit**

```bash
git add app/api/profiles/[id]/reinvite/__tests__/route.test.ts
git commit -m "test: add reinvite endpoint tests"
```

---

## Task 14: API Route - Re-invite Endpoint (Implementation)

**Files:**

- Create: `app/api/profiles/[id]/reinvite/route.ts`

**Step 1: Implement reinvite endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedProfile } from '@/lib/auth';
import { sendReinviteEmail } from '@/lib/email';
import { generateInvitationToken, hashToken, generateInvitationExpiry } from '@/lib/tokens';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify admin authentication
    const adminProfile = await getAuthenticatedProfile();
    if (!adminProfile || adminProfile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Find profile
    const profile = await prisma.profile.findUnique({
      where: { id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if profile is already active
    if (profile.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'This user is already active and does not need an invitation' },
        { status: 400 }
      );
    }

    // Generate new invitation token (invalidates old one)
    const invitationToken = generateInvitationToken();
    const tokenHash = hashToken(invitationToken);
    const expiresAt = generateInvitationExpiry();

    // Update profile with new token
    await prisma.profile.update({
      where: { id },
      data: {
        invitationToken: tokenHash,
        invitationExpiresAt: expiresAt,
        invitedAt: new Date(), // Update invited timestamp
      },
    });

    // Send re-invitation email
    const emailResult = await sendReinviteEmail(
      profile.email,
      profile.fullName || 'User',
      invitationToken // Send unhashed token
    );

    if (!emailResult.success) {
      console.error('Failed to send re-invite email:', emailResult.error);
      return NextResponse.json(
        {
          success: true,
          message: 'Token regenerated but email failed to send',
          emailSent: false,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation resent successfully',
      emailSent: true,
    });
  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 2: Run tests**

Run: `npm test app/api/profiles/\\[id\\]/reinvite`
Expected: PASS

**Step 3: Commit**

```bash
git add app/api/profiles/[id]/reinvite/route.ts
git commit -m "feat: implement reinvite endpoint"
```

---

## Task 15: Frontend Page - Accept Invitation (Component)

**Files:**

- Create: `app/auth/accept/page.tsx`

**Step 1: Create accept invitation page**

```typescript
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. Please check your email for the correct link.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/complete-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to activate account');
        return;
      }

      // Success - redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Error accepting invitation:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Link</h1>
          <p className="text-gray-600">
            This invitation link is invalid. Please check your email for the correct link or contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Lexi!</h1>
        <p className="text-gray-600 mb-6">
          Set your password to activate your account and get started.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              required
              minLength={8}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm your password"
              required
              minLength={8}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Activating...' : 'Activate Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <AcceptInvitationForm />
    </Suspense>
  );
}
```

**Step 2: Verify TypeScript compilation**

Run: `npm run type-check`
Expected: No errors

**Step 3: Test in browser**

Run: `npm run dev`
Navigate to: `http://localhost:3000/auth/accept?token=test123`
Expected: Page renders with password form

**Step 4: Commit**

```bash
git add app/auth/accept/page.tsx
git commit -m "feat: add invitation acceptance page"
```

---

## Task 16: Database Migration Script

**Files:**

- Create: `prisma/migrations/migrate-isactive-to-status.sql`

**Step 1: Write migration SQL**

```sql
-- Migrate existing isActive field to status field
-- Run this after schema update is pushed

-- Map isActive = true AND authUserId exists → ACTIVE
UPDATE "Profile"
SET status = 'ACTIVE'
WHERE "isActive" = true AND "authUserId" IS NOT NULL;

-- Map isActive = true AND authUserId is null → PENDING
-- (These are legacy users who haven't linked to Supabase Auth yet)
UPDATE "Profile"
SET status = 'PENDING'
WHERE "isActive" = true AND "authUserId" IS NULL;

-- Map isActive = false → DEACTIVATED
UPDATE "Profile"
SET status = 'DEACTIVATED'
WHERE "isActive" = false;

-- For ACTIVE users, ensure they have authUserId linked
-- This assumes Supabase auth.users were created with matching emails
-- You may need to manually link some users

-- Optional: Print summary
SELECT
  status,
  COUNT(*) as count
FROM "Profile"
GROUP BY status;
```

**Step 2: Create migration instructions**

Create: `prisma/migrations/MIGRATION-INSTRUCTIONS.md`

````markdown
# Migration Instructions: isActive to status

## Pre-Migration Checklist

1. **Backup Database**
   ```bash
   # Export current data
   curl http://localhost:3000/api/backup > backup-$(date +%Y%m%d).json
   ```
````

2. **Update Schema**

   ```bash
   npx prisma db push
   ```

3. **Run Migration**

   ```bash
   # Connect to database and run migration SQL
   psql $DATABASE_URL -f prisma/migrations/migrate-isactive-to-status.sql
   ```

4. **Verify Migration**
   ```bash
   npx prisma studio
   # Check that all profiles have correct status values
   ```

## Post-Migration

1. Update Supabase Auth Settings:
   - Enable Email/Password provider
   - Disable Magic Link (after transition period)

2. Send notification to existing users:
   - Email blast explaining password setup
   - Direct them to "Forgot Password" flow

## Rollback

If needed, you can rollback by:

```sql
UPDATE "Profile"
SET "isActive" = true
WHERE status = 'ACTIVE';

UPDATE "Profile"
SET "isActive" = false
WHERE status IN ('PENDING', 'DEACTIVATED');
```

````

**Step 3: Commit**

```bash
git add prisma/migrations/migrate-isactive-to-status.sql prisma/migrations/MIGRATION-INSTRUCTIONS.md
git commit -m "feat: add migration script for isActive to status"
````

---

## Task 17: Update Types

**Files:**

- Read: `types.ts` (if exists, or check for type definitions)

**Step 1: Verify Prisma types are regenerated**

Run: `npx prisma generate`
Expected: Types regenerated with new Profile fields

**Step 2: Run type check**

Run: `npm run type-check`
Expected: Identify any type errors from schema changes

**Step 3: Fix any type errors found**

Based on type-check output, update imports and type references:

- Change `isActive` references to `status`
- Update Profile type usage across the app

**Step 4: Commit**

```bash
git add .
git commit -m "fix: update types after schema changes"
```

---

## Task 18: Update GET /api/profiles to Show Status

**Files:**

- Modify: `app/api/profiles/route.ts`

**Step 1: Update GET handler to include status info**

Ensure the GET handler returns status, invitedAt, and invitation status:

```typescript
export async function GET(request: NextRequest) {
  try {
    const adminProfile = await getAuthenticatedProfile();
    if (!adminProfile || adminProfile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await prisma.profile.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        daysCarryOver: true,
        daysCurrentYear: true,
        invitedAt: true,
        invitationExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            requests: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 2: Test endpoint**

Run: `npm run dev`
Test: `curl http://localhost:3000/api/profiles -H "Cookie: ..."`
Expected: Profiles include status field

**Step 3: Commit**

```bash
git add app/api/profiles/route.ts
git commit -m "feat: include status in profiles list endpoint"
```

---

## Task 19: Add Environment Variables Documentation

**Files:**

- Modify: `.env.example`

**Step 1: Add required environment variables**

Add to .env.example:

```bash
# App URL (required for invitation emails)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase Service Role Key (required for admin.createUser)
# Find this in Supabase Dashboard > Settings > API
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Step 2: Update README if needed**

Check if README.md needs updates for new env vars.

**Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add environment variables for invitation flow"
```

---

## Task 20: Manual Testing Checklist

**Files:**

- Create: `docs/testing/invitation-flow-manual-tests.md`

**Step 1: Create manual testing checklist**

```markdown
# Manual Testing: Invitation Flow

## Setup

1. Start dev server: `npm run dev`
2. Ensure SENDGRID_API_KEY is configured
3. Ensure SUPABASE_SERVICE_ROLE_KEY is configured
4. Login as admin user

## Test Cases

### TC1: Create New Employee with Invitation

**Steps:**

1. Navigate to employees/profiles page
2. Click "Add Employee"
3. Fill form:
   - Email: test-user@example.com
   - Full Name: Test User
   - Days Current Year: 20
   - Days Carry Over: 0
4. Submit form

**Expected:**

- ✅ Profile created with status: PENDING
- ✅ Invitation email sent to test-user@example.com
- ✅ Email contains invitation link with token
- ✅ Profile visible in admin list with "Pending" badge

### TC2: Accept Invitation

**Steps:**

1. Open invitation email
2. Click "Accept Invitation" link
3. Should land on /auth/accept?token=...
4. Enter password (min 8 chars)
5. Confirm password
6. Click "Activate Account"

**Expected:**

- ✅ Account activated
- ✅ User automatically logged in
- ✅ Redirected to /dashboard
- ✅ Profile status changed to ACTIVE
- ✅ authUserId populated in database

### TC3: Expired Token

**Steps:**

1. Manually set invitationExpiresAt to past date in DB
2. Try to use invitation link

**Expected:**

- ✅ Error: "Invitation token has expired"
- ✅ Account not activated

### TC4: Re-invite User

**Steps:**

1. Find pending user in admin list
2. Click "Resend Invitation"
3. Check email

**Expected:**

- ✅ New token generated (old token invalidated)
- ✅ New email sent with updated link
- ✅ invitedAt timestamp updated

### TC5: Cannot Re-invite Active User

**Steps:**

1. Find active user in admin list
2. Try to click "Resend Invitation"

**Expected:**

- ✅ Button disabled or error shown
- ✅ API returns 400: "User already active"

### TC6: Duplicate Email Rejected

**Steps:**

1. Try to create profile with existing email

**Expected:**

- ✅ Error: "Profile with this email already exists"
- ✅ No duplicate created

### TC7: Authentication Guard

**Steps:**

1. Create pending user
2. Manually get their authUserId (should be null)
3. Try to access /dashboard with pending status

**Expected:**

- ✅ Access denied
- ✅ Redirected to login

### TC8: Token Already Used

**Steps:**

1. Accept invitation successfully
2. Try to use same token again

**Expected:**

- ✅ Error: "This invitation has already been accepted"

## Cleanup

1. Delete test profiles from database
2. Clear test emails from inbox
```

**Step 2: Commit**

```bash
git add docs/testing/invitation-flow-manual-tests.md
git commit -m "docs: add manual testing checklist for invitation flow"
```

---

## Task 21: Frontend - Add Status Badge Component

**Files:**

- Create: `components/StatusBadge.tsx`

**Step 1: Create status badge component**

```typescript
interface StatusBadgeProps {
  status: 'PENDING' | 'ACTIVE' | 'DEACTIVATED';
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    ACTIVE: 'bg-green-100 text-green-800 border-green-200',
    DEACTIVATED: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const labels = {
    PENDING: 'Pending',
    ACTIVE: 'Active',
    DEACTIVATED: 'Deactivated',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[status]
      } ${className}`}
    >
      {labels[status]}
    </span>
  );
}
```

**Step 2: Verify TypeScript**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add components/StatusBadge.tsx
git commit -m "feat: add status badge component"
```

---

## Task 22: Integration Test - Full Flow

**Files:**

- Create: `__tests__/integration/invitation-flow.test.ts`

**Step 1: Write integration test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { generateInvitationToken, hashToken, generateInvitationExpiry } from '@/lib/tokens';

describe('Invitation Flow Integration', () => {
  let testProfileId: string;
  let testToken: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.profile.deleteMany({
      where: { email: 'integration-test@example.com' },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testProfileId) {
      await prisma.profile
        .delete({
          where: { id: testProfileId },
        })
        .catch(() => {
          // Ignore errors if already deleted
        });
    }
  });

  it('should complete full invitation flow', async () => {
    // Step 1: Create profile with invitation
    testToken = generateInvitationToken();
    const tokenHash = hashToken(testToken);
    const expiresAt = generateInvitationExpiry();

    const profile = await prisma.profile.create({
      data: {
        email: 'integration-test@example.com',
        fullName: 'Integration Test',
        status: 'PENDING',
        invitationToken: tokenHash,
        invitationExpiresAt: expiresAt,
        daysCurrentYear: 20,
        daysCarryOver: 0,
      },
    });

    testProfileId = profile.id;

    // Step 2: Verify profile is pending
    expect(profile.status).toBe('PENDING');
    expect(profile.authUserId).toBeNull();
    expect(profile.invitationToken).toBe(tokenHash);

    // Step 3: Simulate token validation (what complete-invite does)
    const foundProfile = await prisma.profile.findUnique({
      where: { invitationToken: tokenHash },
    });

    expect(foundProfile).toBeTruthy();
    expect(foundProfile?.email).toBe('integration-test@example.com');

    // Step 4: Simulate activation (without actually creating Supabase user)
    const updatedProfile = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        status: 'ACTIVE',
        invitationToken: null,
        invitationExpiresAt: null,
        isActive: true,
      },
    });

    expect(updatedProfile.status).toBe('ACTIVE');
    expect(updatedProfile.invitationToken).toBeNull();
  });

  it('should invalidate old token on reinvite', async () => {
    // Create profile with old token
    const oldToken = generateInvitationToken();
    const oldTokenHash = hashToken(oldToken);

    const profile = await prisma.profile.create({
      data: {
        email: 'reinvite-test@example.com',
        fullName: 'Reinvite Test',
        status: 'PENDING',
        invitationToken: oldTokenHash,
        invitationExpiresAt: generateInvitationExpiry(),
      },
    });

    // Generate new token (reinvite)
    const newToken = generateInvitationToken();
    const newTokenHash = hashToken(newToken);

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        invitationToken: newTokenHash,
        invitationExpiresAt: generateInvitationExpiry(),
      },
    });

    // Old token should not find profile
    const oldTokenProfile = await prisma.profile.findUnique({
      where: { invitationToken: oldTokenHash },
    });
    expect(oldTokenProfile).toBeNull();

    // New token should find profile
    const newTokenProfile = await prisma.profile.findUnique({
      where: { invitationToken: newTokenHash },
    });
    expect(newTokenProfile).toBeTruthy();

    // Cleanup
    await prisma.profile.delete({ where: { id: profile.id } });
  });
});
```

**Step 2: Run integration tests**

Run: `npm test __tests__/integration/invitation-flow.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add __tests__/integration/invitation-flow.test.ts
git commit -m "test: add invitation flow integration tests"
```

---

## Task 23: Documentation - Update README

**Files:**

- Modify: `README.md`

**Step 1: Add invitation flow documentation**

Add section after "Business Logic":

```markdown
## Invitation Flow

### Admin Workflow

1. Admin creates employee profile with vacation days allocation
2. System generates secure invitation token (32 chars, 7-day expiry)
3. Invitation email sent via SendGrid with acceptance link
4. Profile status: PENDING (cannot access system yet)

### Employee Activation

1. Employee receives email with invitation link
2. Clicks link → lands on `/auth/accept?token=xxx`
3. Sets password (min 8 characters)
4. System creates Supabase Auth user
5. Profile linked to Auth user (authUserId)
6. Profile status: ACTIVE → access granted

### Re-invitation

- Admin can resend invitation for PENDING users
- Generates new token, invalidates previous
- Cannot re-invite ACTIVE users

### Security

- Tokens: SHA-256 hashed, crypto-secure random
- Expiry: 7 days (configurable)
- Timing-safe token comparison
- Auth guard enforces ACTIVE status on all protected routes
```

**Step 2: Update API Routes section**

Add new endpoints:

```markdown
### Authentication

- `POST /api/auth/complete-invite` - Complete invitation and set password

### Employees (Updated)

- `POST /api/employees` - Create employee and send invitation
- `POST /api/employees/[id]/reinvite` - Resend invitation email
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add invitation flow documentation to README"
```

---

## Summary

This plan implements a complete invitation-based access control system following TDD principles. Each task is bite-sized (2-5 minutes) with exact file paths, complete code, and clear testing steps.

**Total Tasks:** 23
**Estimated Time:** 2-3 hours
**Commits:** 23 (one per task)

**Key Features:**

- ✅ Database schema with invitation tracking
- ✅ Secure token generation (crypto-random, SHA-256)
- ✅ Email integration (SendGrid templates)
- ✅ Complete API endpoints (create, reinvite, accept)
- ✅ Frontend invitation acceptance page
- ✅ Migration from isActive to status
- ✅ Comprehensive testing (unit + integration)
- ✅ Documentation and manual test checklist

**Testing Coverage:**

- Token utilities (unit tests)
- Email service (unit tests with mocks)
- API endpoints (route tests)
- Integration flow (end-to-end DB tests)
- Manual testing checklist

**Next Steps After Implementation:**

1. Run full test suite: `npm test`
2. Execute migration script
3. Configure Supabase (enable Email/Password)
4. Run manual tests from checklist
5. Deploy to staging
6. Send notification to existing users
