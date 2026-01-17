# SendGrid Email Service Setup & Testing Guide

## Overview

This application uses SendGrid for sending transactional emails:

- **Invitation emails** when admins create new users
- **Request notifications** when users submit leave requests
- **Approval emails** when requests are approved
- **Denial emails** when requests are denied

## Configuration

### Required Environment Variables

```bash
# SendGrid API Key (required for email functionality)
SENDGRID_API_KEY=your_api_key_here

# Verified sender email address (recommended)
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Application URL (optional, defaults to http://localhost:3000)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Getting Started

1. **Sign up for SendGrid**
   - Visit [SendGrid](https://sendgrid.com/) and create a free account
   - Free tier includes 100 emails/day

2. **Create an API Key**
   - Navigate to **Settings** → **API Keys**
   - Click **Create API Key**
   - Choose **Full Access** or at least **Mail Send** permissions
   - Copy the API key and add it to your `.env.local` file
   - **Important:** Save the key immediately - you won't be able to see it again

3. **Verify Your Sender Email**
   - Navigate to **Settings** → **Sender Authentication**
   - Choose one of these options:

   **Option A: Single Sender Verification** (Easier, for development/testing)
   - Click **Verify a Single Sender**
   - Enter your email address (e.g., `noreply@yourdomain.com`)
   - Check your inbox and click the verification link
   - Update `SENDGRID_FROM_EMAIL` in `.env.local`

   **Option B: Domain Authentication** (Recommended for production)
   - Click **Authenticate Your Domain**
   - Follow the wizard to add DNS records to your domain
   - Wait for DNS propagation (can take up to 48 hours)
   - Any email from your domain will be automatically verified

## Testing Email Functionality

### Running Tests

The project includes comprehensive tests for the email service:

```bash
# Run all tests
npm test

# Run only email tests
npm test -- lib/__tests__/email.test.ts

# Run tests in watch mode
npm test:watch
```

### Test Coverage

Tests verify:

- ✅ Email configuration status checking
- ✅ Successful email sending for all email types
- ✅ Proper error handling (403, network errors, unknown errors)
- ✅ Graceful degradation when not configured
- ✅ Correct email content formatting
- ✅ Date localization
- ✅ Multiple recipient handling

### Manual Testing

1. **Start the development server:**

   ```bash
   npm run dev
   ```

2. **Test invitation email:**
   - Log in as admin
   - Navigate to `/admin/users`
   - Click "Invite User"
   - Fill in the form and submit
   - Check console logs for success/error messages
   - Check recipient's inbox

3. **Test request notification:**
   - Log in as a regular user
   - Submit a leave request
   - Admins should receive notification emails

4. **Test approval/denial emails:**
   - Log in as admin
   - Navigate to `/admin/requests`
   - Approve or deny a request
   - User should receive appropriate email

## Troubleshooting Common Issues

### Issue 1: 403 Forbidden Error

**Symptoms:**

```
Failed to send invitation email: { error: 'Forbidden', code: 403 }
```

**Causes & Solutions:**

1. **Sender Email Not Verified**
   - Check if you completed sender verification (see step 3 above)
   - Verify the email in `SENDGRID_FROM_EMAIL` matches your verified sender
   - Check SendGrid dashboard for verification status

2. **API Key Permissions**
   - Regenerate API key with correct permissions
   - Ensure it has at least **Mail Send** permission
   - Update `.env.local` with new key
   - Restart dev server

3. **Account Suspended**
   - Check SendGrid dashboard for warnings
   - Verify account is in good standing
   - Contact SendGrid support if needed

### Issue 2: API Key Not Configured

**Symptoms:**

```
⚠️  SENDGRID_API_KEY is not configured. Email notifications will be disabled.
```

**Solution:**

- Add `SENDGRID_API_KEY` to `.env.local`
- Restart the development server
- Emails will fail gracefully, but users/requests will still be created

### Issue 3: Emails Not Arriving

**Debugging steps:**

1. **Check Application Logs**

   ```bash
   # Look for success/error messages
   npm run dev
   ```

2. **Check SendGrid Activity Feed**
   - Log into SendGrid dashboard
   - Navigate to **Activity** → **Email Activity**
   - Search for recipient email address
   - Check delivery status and errors

3. **Check Spam Folder**
   - SendGrid emails may be marked as spam initially
   - Mark as "Not Spam" to improve future delivery

4. **Verify Email Configuration Status**

   ```typescript
   // In your API route or component
   import { getEmailConfigurationStatus } from '@/lib/email';

   const status = getEmailConfigurationStatus();
   console.log('Email configured:', status.isConfigured);
   console.log('Has API key:', status.hasApiKey);
   console.log('Has from email:', status.hasFromEmail);
   ```

### Issue 4: Rate Limiting

**Symptoms:**

```
Error: Too Many Requests (429)
```

**Solution:**

- Free tier: 100 emails/day
- Upgrade plan if you need more
- Implement retry logic with exponential backoff (future enhancement)

## Email Service Architecture

### Graceful Degradation

The email service is designed to fail gracefully:

- ✅ Users are still created even if invitation email fails
- ✅ Leave requests are still submitted even if notification fails
- ✅ Requests are still approved/denied even if emails fail
- ✅ Detailed error logging for debugging
- ✅ Configuration status warnings at startup

### Configuration Validation

At startup, the app logs warnings if email is not configured:

```
⚠️  SENDGRID_API_KEY is not configured. Email notifications will be disabled.
⚠️  SENDGRID_FROM_EMAIL is not configured. Using default: noreply@example.com
```

### Error Handling

All email functions return a consistent `EmailResult`:

```typescript
interface EmailResult {
  success: boolean;
  error?: string;
}
```

Example usage in API routes:

```typescript
const emailResult = await sendInvitationEmail(email, fullName);
if (!emailResult.success) {
  console.error('Failed to send email:', emailResult.error);
  // Continue with user creation anyway
}
```

## Development Without Email

You can develop and test the application without configuring SendGrid:

1. **Skip email configuration**
   - Don't set `SENDGRID_API_KEY` in `.env.local`
   - App will work normally, but emails won't be sent

2. **Test email logic**
   - All email functions return success/error status
   - Run unit tests to verify email logic works
   - Mock SendGrid in tests (see `lib/__tests__/email.test.ts`)

3. **Manual login testing**
   - Users can manually navigate to `/login`
   - Enter their email for magic link authentication
   - No invitation email needed

## Production Checklist

Before deploying to production:

- [ ] SendGrid API key configured with appropriate permissions
- [ ] Domain authentication completed (not just single sender)
- [ ] Sender email verified and matches production domain
- [ ] Test all email types in production environment
- [ ] Monitor SendGrid activity feed for delivery issues
- [ ] Set up SendGrid alerts for bounces and spam reports
- [ ] Consider email template customization with brand colors
- [ ] Review SendGrid pricing tier for expected volume
- [ ] Set up proper SPF/DKIM/DMARC DNS records
- [ ] Test spam filter handling across major email providers

## Advanced Configuration

### Custom Email Templates

To customize email templates, edit the HTML in `lib/email.ts`:

```typescript
// Example: Change brand color
html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #YOUR_BRAND_COLOR;">Welcome to Your App</h2>
    ...
  </div>
`;
```

### Email Localization

Currently emails are in English. To add Croatian translations:

1. Create translation strings
2. Update email templates in `lib/email.ts`
3. Use environment variable or user preference for language

### Monitoring & Alerts

Set up monitoring in SendGrid:

1. Navigate to **Settings** → **Mail Settings**
2. Enable **Event Webhook** for delivery tracking
3. Set up alerts for bounces and spam reports

## Getting Help

If you're still having issues:

1. **Check SendGrid Status**
   - Visit [status.sendgrid.com](https://status.sendgrid.com/)

2. **Review SendGrid Docs**
   - [SendGrid Documentation](https://docs.sendgrid.com/)
   - [Node.js Library](https://github.com/sendgrid/sendgrid-nodejs)

3. **Contact Support**
   - SendGrid: [support.sendgrid.com](https://support.sendgrid.com/)
   - Project Issues: Check the project repository

## Related Files

- `lib/email.ts` - Email service implementation
- `lib/__tests__/email.test.ts` - Email service tests
- `app/api/profiles/route.ts` - User invitation email
- `app/api/requests/route.ts` - Request notification email
- `app/api/requests/[id]/route.ts` - Approval/denial emails
