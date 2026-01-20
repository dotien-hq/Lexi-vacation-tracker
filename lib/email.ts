import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) {
  sgMail.setApiKey(apiKey);
}

const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface EmailResult {
  success: boolean;
  error?: string;
}

interface EmailTheme {
  accentColor: string;
  cardBackground: string;
  cardBorderColor: string;
  headerGradientEnd?: string;
}

interface EmailCTA {
  text: string;
  url: string;
}

/**
 * Generate premium email template with Lexi branding
 * @param content Main body HTML content
 * @param theme Color theme for accents and cards
 * @param cta Optional call-to-action button
 * @returns Complete HTML email template
 */
function generateEmailTemplate(content: string, theme: EmailTheme, cta?: EmailCTA): string {
  const headerGradient = theme.headerGradientEnd
    ? `linear-gradient(90deg, #0041F0 0%, ${theme.headerGradientEnd} 100%)`
    : 'linear-gradient(90deg, #0041F0 0%, #60A5FA 100%)';

  const ctaHtml = cta
    ? `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${cta.url}" style="
        display: inline-block;
        padding: 16px 32px;
        background: linear-gradient(90deg, #0041F0 0%, #3B82F6 100%);
        background-color: #0041F0;
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        box-shadow: 0 2px 4px rgba(0, 65, 240, 0.2);
      ">${cta.text}</a>
    </div>
    <p style="text-align: center; font-size: 14px; color: #64748B; margin-top: 16px;">
      Or copy this link: <a href="${cta.url}" style="color: #0041F0; word-break: break-all;">${cta.url}</a>
    </p>
  `
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lexi Vacation Tracker</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
              <!-- Header with gradient -->
              <tr>
                <td style="background: ${headerGradient}; background-color: #0041F0; height: 80px; vertical-align: middle; text-align: center;">
                  <!-- Branding (centered) -->
                  <div style="display: inline-block;">
                    <div style="color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.025em; margin-bottom: 4px;">LEXI</div>
                    <div style="color: white; opacity: 0.9; font-size: 14px; letter-spacing: 0.1em;">Vacation Tracker</div>
                  </div>
                </td>
              </tr>

              <!-- Content area -->
              <tr>
                <td style="padding: 40px; color: #475569; font-size: 16px; line-height: 1.6;">
                  ${content}
                  ${ctaHtml}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 0 40px 24px;">
                  <div style="height: 1px; background: linear-gradient(90deg, #0041F0 0%, transparent 100%); margin-bottom: 16px;"></div>
                  <div style="text-align: center; color: #94A3B8; font-size: 14px;">Lexi Vacation Tracker</div>
                </td>
              </tr>

              <!-- Bottom gradient bar -->
              <tr>
                <td style="height: 4px; background: linear-gradient(90deg, #0041F0 0%, #60A5FA 100%); background-color: #0041F0;"></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Generate a data card for displaying key-value pairs
 * @param items Array of label-value pairs
 * @param theme Theme colors for card styling
 * @returns HTML for data card
 */
function generateDataCard(
  items: Array<{ label: string; value: string }>,
  theme: EmailTheme
): string {
  const rows = items
    .map(
      (item) => `
    <div style="margin-bottom: 12px;">
      <div style="color: #64748B; font-size: 14px; font-weight: 500; margin-bottom: 4px;">${item.label}</div>
      <div style="color: #1E293B; font-size: 14px; font-weight: 600;">${item.value}</div>
    </div>
  `
    )
    .join('');

  return `
    <div style="background: ${theme.cardBackground}; border-left: 4px solid ${theme.cardBorderColor}; border-radius: 6px; padding: 20px; margin: 24px 0;">
      ${rows}
    </div>
  `;
}

/**
 * Check if email service is properly configured
 * @returns true if configured, false otherwise
 */
function isEmailConfigured(): boolean {
  return !!apiKey;
}

/**
 * Get email configuration status (exported for use in tests and API routes)
 * @returns Object with configuration status
 */
export function getEmailConfigurationStatus(): {
  isConfigured: boolean;
  hasApiKey: boolean;
  hasFromEmail: boolean;
  hasAppUrl: boolean;
} {
  return {
    isConfigured: isEmailConfigured(),
    hasApiKey: !!apiKey,
    hasFromEmail: !!process.env.SENDGRID_FROM_EMAIL,
    hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
  };
}

/**
 * Log configuration warning on startup
 */
function logEmailConfigurationStatus(): void {
  if (!apiKey) {
    console.warn('⚠️  SENDGRID_API_KEY is not configured. Email notifications will be disabled.');
  }
  if (!process.env.SENDGRID_FROM_EMAIL) {
    console.warn('⚠️  SENDGRID_FROM_EMAIL is not configured. Using default: noreply@example.com');
  }
}

// Log configuration status on module load
logEmailConfigurationStatus();

/**
 * Send invitation email to a newly created user
 * @param email User's email address
 * @param fullName User's full name
 * @returns Promise with success status
 */
export async function sendInvitationEmail(email: string, fullName: string): Promise<EmailResult> {
  // Check if SendGrid is configured
  if (!isEmailConfigured()) {
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  try {
    const theme: EmailTheme = {
      accentColor: '#0041F0',
      cardBackground: '#F0F7FF',
      cardBorderColor: '#0041F0',
    };

    const content = `
      <h2 style="color: #0F172A; font-size: 24px; font-weight: 600; margin: 0 0 16px;">Welcome to Lexi Vacation Tracker</h2>
      <p style="margin: 16px 0;">Hello <strong style="color: #1E293B;">${fullName}</strong>,</p>
      <p style="margin: 16px 0;">You have been invited to join Lexi Vacation Tracker! Your account has been created and is ready to use.</p>
      <p style="margin: 16px 0;">Click the button below to access your account and get started.</p>
    `;

    const html = generateEmailTemplate(content, theme, {
      text: 'Access Your Account',
      url: `${appUrl}/login`,
    });

    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Welcome to Lexi Vacation Tracker',
      text: `Hello ${fullName},\n\nYou have been invited to join Lexi Vacation Tracker!\n\nPlease visit ${appUrl}/login to access your account using your email address.\n\nBest regards,\nLexi Vacation Tracker Team`,
      html,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    // Type guard for error object
    const err = error as { message?: string; code?: number; response?: { body?: unknown } };

    // Log detailed error information
    console.error('Failed to send invitation email:', {
      error: err.message,
      code: err.code,
      response: err.response?.body,
    });

    // Provide helpful error messages
    let errorMessage = 'Unknown error';
    if (err.code === 403) {
      errorMessage = 'SendGrid API key lacks permissions or sender email not verified';
    } else if (err.message) {
      errorMessage = err.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send notification email to admins when a new leave request is submitted
 * @param adminEmails Array of admin email addresses
 * @param userName Name of the user who submitted the request
 * @param startDate Request start date
 * @param endDate Request end date
 * @param daysCount Number of business days requested
 * @returns Promise with success status
 */
export async function sendRequestNotificationEmail(
  adminEmails: string[],
  userName: string,
  startDate: Date,
  endDate: Date,
  daysCount: number
): Promise<EmailResult> {
  // Check if SendGrid is configured
  if (!isEmailConfigured()) {
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  try {
    const formattedStartDate = startDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedEndDate = endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const theme: EmailTheme = {
      accentColor: '#0041F0',
      cardBackground: '#F0F7FF',
      cardBorderColor: '#0041F0',
    };

    const dataCard = generateDataCard(
      [
        { label: 'Requester', value: userName },
        { label: 'Start Date', value: formattedStartDate },
        { label: 'End Date', value: formattedEndDate },
        { label: 'Business Days', value: `${daysCount} ${daysCount === 1 ? 'day' : 'days'}` },
      ],
      theme
    );

    const content = `
      <h2 style="color: #0F172A; font-size: 24px; font-weight: 600; margin: 0 0 16px;">New Leave Request</h2>
      <p style="margin: 16px 0;">A new leave request has been submitted and requires your review.</p>
      ${dataCard}
      <p style="margin: 16px 0;">Please review and approve or deny this request.</p>
    `;

    const html = generateEmailTemplate(content, theme, {
      text: 'Review Request',
      url: `${appUrl}/admin/requests`,
    });

    const msg = {
      to: adminEmails,
      from: fromEmail,
      subject: `New Leave Request from ${userName}`,
      text: `A new leave request has been submitted.\n\nUser: ${userName}\nStart Date: ${formattedStartDate}\nEnd Date: ${formattedEndDate}\nBusiness Days: ${daysCount}\n\nPlease review and approve or deny this request at ${appUrl}/admin/requests`,
      html,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Failed to send request notification email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send approval email to user when their leave request is approved
 * @param email User's email address
 * @param userName User's full name
 * @param startDate Request start date
 * @param endDate Request end date
 * @param daysCount Number of business days approved
 * @returns Promise with success status
 */
export async function sendApprovalEmail(
  email: string,
  userName: string,
  startDate: Date,
  endDate: Date,
  daysCount: number
): Promise<EmailResult> {
  // Check if SendGrid is configured
  if (!isEmailConfigured()) {
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  try {
    const formattedStartDate = startDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedEndDate = endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const theme: EmailTheme = {
      accentColor: '#10B981',
      cardBackground: '#F0FDF4',
      cardBorderColor: '#10B981',
      headerGradientEnd: '#5EEAD4', // Subtle green warmth
    };

    const dataCard = generateDataCard(
      [
        { label: 'Start Date', value: formattedStartDate },
        { label: 'End Date', value: formattedEndDate },
        { label: 'Business Days', value: `${daysCount} ${daysCount === 1 ? 'day' : 'days'}` },
      ],
      theme
    );

    const content = `
      <h2 style="color: #0F172A; font-size: 24px; font-weight: 600; margin: 0 0 16px;">Leave Request Approved ✓</h2>
      <p style="margin: 16px 0;">Hello <strong style="color: #1E293B;">${userName}</strong>,</p>
      <p style="margin: 16px 0;">Great news! Your leave request has been approved.</p>
      ${dataCard}
      <p style="margin: 24px 0; color: #10B981; font-weight: 600; font-size: 18px;">Enjoy your time off!</p>
    `;

    const html = generateEmailTemplate(content, theme);

    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Leave Request Approved',
      text: `Hello ${userName},\n\nYour leave request has been approved!\n\nStart Date: ${formattedStartDate}\nEnd Date: ${formattedEndDate}\nBusiness Days: ${daysCount}\n\nEnjoy your time off!\n\nBest regards,\nLexi Vacation Tracker Team`,
      html,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Failed to send approval email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send denial email to user when their leave request is denied
 * @param email User's email address
 * @param userName User's full name
 * @param startDate Request start date
 * @param endDate Request end date
 * @param daysCount Number of business days requested
 * @param rejectionReason Reason for denial
 * @returns Promise with success status
 */
export async function sendDenialEmail(
  email: string,
  userName: string,
  startDate: Date,
  endDate: Date,
  daysCount: number,
  rejectionReason: string
): Promise<EmailResult> {
  // Check if SendGrid is configured
  if (!isEmailConfigured()) {
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  try {
    const formattedStartDate = startDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedEndDate = endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const theme: EmailTheme = {
      accentColor: '#F87171',
      cardBackground: '#FEF2F2',
      cardBorderColor: '#F87171',
    };

    const dataCard = generateDataCard(
      [
        { label: 'Start Date', value: formattedStartDate },
        { label: 'End Date', value: formattedEndDate },
        { label: 'Business Days', value: `${daysCount} ${daysCount === 1 ? 'day' : 'days'}` },
        { label: 'Reason', value: rejectionReason },
      ],
      theme
    );

    const content = `
      <h2 style="color: #0F172A; font-size: 24px; font-weight: 600; margin: 0 0 16px;">Leave Request Update</h2>
      <p style="margin: 16px 0;">Hello <strong style="color: #1E293B;">${userName}</strong>,</p>
      <p style="margin: 16px 0;">Your leave request has been reviewed and unfortunately cannot be approved at this time.</p>
      ${dataCard}
      <p style="margin: 16px 0; color: #64748B;">If you have questions or would like to discuss this further, please contact your administrator.</p>
    `;

    const html = generateEmailTemplate(content, theme);

    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Leave Request Update',
      text: `Hello ${userName},\n\nYour leave request has been denied.\n\nStart Date: ${formattedStartDate}\nEnd Date: ${formattedEndDate}\nBusiness Days: ${daysCount}\n\nReason: ${rejectionReason}\n\nIf you have questions, please contact your administrator.\n\nBest regards,\nLexi Vacation Tracker Team`,
      html,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Failed to send denial email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

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

    const theme: EmailTheme = {
      accentColor: '#0041F0',
      cardBackground: '#F0F7FF',
      cardBorderColor: '#0041F0',
    };

    const content = `
      <h2 style="color: #0F172A; font-size: 24px; font-weight: 600; margin: 0 0 16px;">You're Invited!</h2>
      <p style="margin: 16px 0;">Hello <strong style="color: #1E293B;">${fullName}</strong>,</p>
      <p style="margin: 16px 0;"><strong style="color: #1E293B;">${adminName}</strong> has invited you to join Lexi Vacation Tracker.</p>
      <p style="margin: 16px 0;">Click the button below to accept your invitation and set your password.</p>
      <p style="margin: 24px 0; color: #64748B; font-size: 14px;">⏱ This invitation will expire in 7 days.</p>
    `;

    const html = generateEmailTemplate(content, theme, {
      text: 'Accept Invitation',
      url: inviteUrl,
    });

    const msg = {
      to: email,
      from: fromEmail,
      subject: "You're invited to Lexi Vacation Tracker",
      text: `Hello ${fullName},\n\n${adminName} has invited you to join Lexi Vacation Tracker.\n\nClick the link below to accept your invitation and set your password:\n${inviteUrl}\n\nThis invitation will expire in 7 days.\n\nBest regards,\nLexi Vacation Tracker Team`,
      html,
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

    const theme: EmailTheme = {
      accentColor: '#0041F0',
      cardBackground: '#F0F7FF',
      cardBorderColor: '#0041F0',
    };

    const content = `
      <h2 style="color: #0F172A; font-size: 24px; font-weight: 600; margin: 0 0 16px;">Complete Your Setup</h2>
      <p style="margin: 16px 0;">Hello <strong style="color: #1E293B;">${fullName}</strong>,</p>
      <p style="margin: 16px 0;">This is a friendly reminder to complete your Lexi Vacation Tracker setup.</p>
      <p style="margin: 16px 0;">Click the button below to accept your invitation and set your password.</p>
      <p style="margin: 24px 0; color: #64748B; font-size: 14px;">⏱ This invitation will expire in 7 days.</p>
    `;

    const html = generateEmailTemplate(content, theme, {
      text: 'Complete Setup',
      url: inviteUrl,
    });

    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Reminder: Complete your Lexi Vacation Tracker setup',
      text: `Hello ${fullName},\n\nThis is a reminder to complete your Lexi Vacation Tracker setup.\n\nClick the link below to accept your invitation and set your password:\n${inviteUrl}\n\nThis invitation will expire in 7 days.\n\nBest regards,\nLexi Vacation Tracker Team`,
      html,
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
