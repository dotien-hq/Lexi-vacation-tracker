# Feature Specification: Invitation-Based Access Control

## 1. Executive Summary

This feature migrates the application from a public "Magic Link" login flow to a closed, Invitation-Only (B2B) system. Access is granted strictly via Admin invitation. This allows HR/Admins to pre-provision employee profiles (vacation days, roles) before the user ever registers. All emails will be routed through SendGrid to ensure strict branding control.

## 2. Problem Statement

**Current State:** Users sign up via Magic Link. The system assumes a user exists only after they log in, making it impossible to set up vacation balances beforehand.

**Risk:** Magic links are less secure for enterprise contexts (email forwarding risks) and offer poor UX for users who prefer permanent passwords.

**Goal:** Enable Admins to create "Pending" profiles and invite users to claim them by setting a password.

## 3. User Stories

### Admin

- I want to create a new employee profile with their Name, Email, and Vacation Days without them needing to log in first.
- I want to send an invitation email (branded) to that employee automatically.
- I want to see who has accepted their invite and who is still pending.
- I want to re-invite an employee if their link expired or they missed the email.
- I want to revoke an invitation if I sent it to the wrong email.

### Employee (New)

- I want to receive an email with a secure link to join the company app.
- I want to click the link and immediately set my own password to activate my account.
- I want to log in subsequently using Email + Password.

### Employee (Existing)

- I want to migrate from Magic Link to Password login securely.
- I want to use the "Forgot Password" flow to set my initial password if I am an existing user.

## 4. Technical Architecture

### 4.1. Database Schema Changes (Prisma)

We will modify the Profile model to decouple it from auth.users and add invitation tracking.

```prisma
enum UserStatus {
  PENDING
  ACTIVE
  DEACTIVATED
}

model Profile {
  id            String     @id @default(uuid())
  email         String     @unique
  fullName      String

  // Link to Supabase Auth (Nullable until activation)
  authUserId    String?    @unique

  // Status Management
  status        UserStatus @default(PENDING)

  // Invitation Logic
  invitationToken     String?   @unique
  invitationExpiresAt DateTime?
  invitedAt           DateTime? @default(now())

  // Business Logic
  role            Role      @default(USER)
  daysCarryOver   Int       @default(0)
  daysCurrentYear Int       @default(20)

  // Metadata
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  leaveRequests   LeaveRequest[]
}
```

### 4.2. Critical Workflows

#### A. The Invitation Flow (Admin)

1. Admin submits `POST /api/employees`.
2. Server creates Profile (Status: PENDING).
3. Server generates crypto-secure token (32 chars) + Expiry (7 days).
4. Server saves token to DB.
5. Server triggers SendGrid: "You're invited to Lexi" (Link: `/auth/accept?token=xyz`).

#### B. The Acceptance Flow (User)

1. User lands on `/auth/accept?token=xyz`.
2. Frontend validates token presence.
3. User enters Password + Confirm Password.
4. Submits to `POST /api/auth/complete-invite`.
5. Server:
   - Validates token & expiry.
   - Uses `supabase.auth.admin.createUser()` to create Auth User.
   - Updates Profile: sets authUserId, status ACTIVE, clears token.
6. User is automatically logged in.

## 5. API Interface Design

### POST /api/employees (Create & Invite)

**Request:**

```json
{
  "email": "ivan@company.com",
  "fullName": "Ivan Horvat",
  "daysCurrentYear": 24,
  "daysCarryOver": 5
}
```

**Logic:**

- Check if email exists.
- Create Profile.
- Generate Token.
- Send Email via SendGrid.

### POST /api/employees/[id]/reinvite

**Logic:**

- Invalidate old token (if any).
- Generate new token.
- Update invitationExpiresAt.
- Resend SendGrid email.

### POST /api/auth/complete-invite

**Request:**

```json
{
  "token": "abc-123-secure-token",
  "password": "securePassword123!"
}
```

**Logic:**

- Find Profile by token.
- Check `invitationExpiresAt > now()`.
- Create Supabase Auth User.
- Link Profile to User.
- Return Session.

## 6. Migration Strategy (The "Soft Landing")

To ensure business continuity for current users:

### Database Migration:

- Run SQL to map `isActive: true` → `status: ACTIVE`.
- Run SQL to map `isActive: false` → `status: DEACTIVATED`.

### Auth Configuration:

- Enable Email/Password provider in Supabase.
- Keep Magic Links active for 1 week (Transition Period), then disable.

### User Communication:

- Send blast email to existing users: "We are upgrading security. Please log out and click 'Forgot Password' to set your permanent password."

## 7. Email Templates (SendGrid)

We require three core templates. (Note: Disable all default Supabase emails).

| Template Name       | Trigger               | Variables                                      | Call to Action      |
| ------------------- | --------------------- | ---------------------------------------------- | ------------------- |
| New Employee Invite | Admin creates user    | `{{name}}`, `{{invite_url}}`, `{{admin_name}}` | "Accept Invitation" |
| Password Reset      | User clicks "Forgot"  | `{{reset_url}}`                                | "Reset Password"    |
| Re-Invite           | Admin clicks "Resend" | `{{name}}`, `{{invite_url}}`                   | "Complete Setup"    |

## 8. Security Controls

- **Token Expiry:** Invitation tokens expire strictly after 7 days.
- **Token Rotation:** Generating a new invite immediately invalidates the previous token (prevents replay attacks).
- **Auth Guard:** All API routes (except `/auth/*`) must verify `status: ACTIVE` on the Profile, not just a valid Supabase Session. This prevents "Pending" users from accessing data via API exploits.
