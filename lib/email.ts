import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) {
  console.error('SENDGRID_API_KEY is not configured');
} else {
  sgMail.setApiKey(apiKey);
}

const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface EmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send invitation email to a newly created user
 * @param email User's email address
 * @param fullName User's full name
 * @returns Promise with success status
 */
export async function sendInvitationEmail(email: string, fullName: string): Promise<EmailResult> {
  try {
    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Welcome to Lexi Vacation Tracker',
      text: `Hello ${fullName},\n\nYou have been invited to join Lexi Vacation Tracker!\n\nPlease visit ${appUrl}/login to access your account using your email address.\n\nBest regards,\nLexi Vacation Tracker Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0041F0;">Welcome to Lexi Vacation Tracker</h2>
          <p>Hello <strong>${fullName}</strong>,</p>
          <p>You have been invited to join Lexi Vacation Tracker!</p>
          <p>Please visit <a href="${appUrl}/login" style="color: #0041F0;">${appUrl}/login</a> to access your account using your email address.</p>
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

    const msg = {
      to: adminEmails,
      from: fromEmail,
      subject: `New Leave Request from ${userName}`,
      text: `A new leave request has been submitted.\n\nEmployee: ${userName}\nStart Date: ${formattedStartDate}\nEnd Date: ${formattedEndDate}\nBusiness Days: ${daysCount}\n\nPlease review and approve or deny this request at ${appUrl}/admin/requests`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0041F0;">New Leave Request</h2>
          <p>A new leave request has been submitted.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Employee:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${userName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Start Date:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formattedStartDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>End Date:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formattedEndDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Business Days:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${daysCount}</td>
            </tr>
          </table>
          <p>
            <a href="${appUrl}/admin/requests" style="display: inline-block; padding: 12px 24px; background-color: #0041F0; color: white; text-decoration: none; border-radius: 6px;">Review Request</a>
          </p>
        </div>
      `,
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

    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Leave Request Approved',
      text: `Hello ${userName},\n\nYour leave request has been approved!\n\nStart Date: ${formattedStartDate}\nEnd Date: ${formattedEndDate}\nBusiness Days: ${daysCount}\n\nEnjoy your time off!\n\nBest regards,\nLexi Vacation Tracker Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0041F0;">Leave Request Approved ✓</h2>
          <p>Hello <strong>${userName}</strong>,</p>
          <p>Your leave request has been approved!</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Start Date:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formattedStartDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>End Date:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formattedEndDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Business Days:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${daysCount}</td>
            </tr>
          </table>
          <p style="color: #059669; font-weight: bold;">Enjoy your time off!</p>
          <p>Best regards,<br/>Lexi Vacation Tracker Team</p>
        </div>
      `,
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

    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Leave Request Denied',
      text: `Hello ${userName},\n\nYour leave request has been denied.\n\nStart Date: ${formattedStartDate}\nEnd Date: ${formattedEndDate}\nBusiness Days: ${daysCount}\n\nReason: ${rejectionReason}\n\nIf you have questions, please contact your administrator.\n\nBest regards,\nLexi Vacation Tracker Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #DC2626;">Leave Request Denied</h2>
          <p>Hello <strong>${userName}</strong>,</p>
          <p>Your leave request has been denied.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Start Date:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formattedStartDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>End Date:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formattedEndDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Business Days:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${daysCount}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Reason:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${rejectionReason}</td>
            </tr>
          </table>
          <p>If you have questions, please contact your administrator.</p>
          <p>Best regards,<br/>Lexi Vacation Tracker Team</p>
        </div>
      `,
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
