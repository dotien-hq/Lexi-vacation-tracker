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

### TC9: Password Validation

**Steps:**

1. Open invitation acceptance page
2. Try to submit with password < 8 characters

**Expected:**

- ✅ Error: "Password must be at least 8 characters long"
- ✅ Form not submitted

### TC10: Password Mismatch

**Steps:**

1. Open invitation acceptance page
2. Enter password: "password123"
3. Enter confirm password: "different123"
4. Submit form

**Expected:**

- ✅ Error: "Passwords do not match"
- ✅ Form not submitted

### TC11: Invalid Invitation Link

**Steps:**

1. Navigate to /auth/accept?token=invalid-token-123
2. Try to submit form

**Expected:**

- ✅ Error message displayed
- ✅ Account not created

### TC12: Missing Token in URL

**Steps:**

1. Navigate to /auth/accept (no token parameter)

**Expected:**

- ✅ Error: "Invalid invitation link"
- ✅ Message: "Please check your email for the correct link"

## Cleanup

1. Delete test profiles from database
2. Clear test emails from inbox
3. Reset any manually modified data

## Notes

- Test with real email address you have access to
- Verify email templates render correctly in different email clients
- Check that invitation URLs work when copied/pasted
- Confirm token expiry logic works correctly (set to 1 minute for quick testing)
