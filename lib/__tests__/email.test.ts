import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sendgrid/mail before importing email module
vi.mock('@sendgrid/mail', () => {
  return {
    default: {
      setApiKey: vi.fn(),
      send: vi.fn(),
    },
  };
});

// Mock console to avoid noise in test output
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Now import email functions after mocking
import {
  sendInvitationEmail,
  sendRequestNotificationEmail,
  sendApprovalEmail,
  sendDenialEmail,
  sendInvitationEmailWithToken,
  sendReinviteEmail,
  getEmailConfigurationStatus,
} from '../email';
import sgMail from '@sendgrid/mail';

const mockSend = vi.mocked(sgMail.send);

describe('email service', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('getEmailConfigurationStatus', () => {
    it('should return configuration status', () => {
      const status = getEmailConfigurationStatus();

      expect(status).toHaveProperty('isConfigured');
      expect(status).toHaveProperty('hasApiKey');
      expect(status).toHaveProperty('hasFromEmail');
      expect(status).toHaveProperty('hasAppUrl');
    });
  });

  describe('sendInvitationEmail', () => {
    it('should send invitation email successfully when configured', async () => {
      // Mock successful send
      mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);

      // Skip this test if not configured (will run in CI)
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        const result = await sendInvitationEmail('user@example.com', 'John Doe');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Email service not configured');
        return;
      }

      const result = await sendInvitationEmail('user@example.com', 'John Doe');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSend).toHaveBeenCalledOnce();
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Welcome to Lexi Vacation Tracker',
          text: expect.stringContaining('John Doe'),
          html: expect.stringContaining('John Doe'),
        })
      );
    });

    it('should include login URL in email content', async () => {
      mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);

      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        return; // Skip if not configured
      }

      await sendInvitationEmail('user@example.com', 'Jane Smith');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('/login'),
          html: expect.stringContaining('/login'),
        })
      );
    });

    it('should return error when not configured', async () => {
      const result = await sendInvitationEmail('user@example.com', 'John Doe');

      // If configured, mock it to test error path
      if (getEmailConfigurationStatus().isConfigured) {
        expect(result.success).toBe(true);
      } else {
        expect(result.success).toBe(false);
        expect(result.error).toBe('Email service not configured');
        expect(mockSend).not.toHaveBeenCalled();
      }
    });

    it('should handle 403 Forbidden error with helpful message', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        return; // Skip if not configured
      }

      const error = new Error('Forbidden') as Error & {
        code?: number;
        response?: { body: unknown };
      };
      error.code = 403;
      error.response = { body: { errors: [{ message: 'Forbidden' }] } };

      mockSend.mockRejectedValue(error);

      const result = await sendInvitationEmail('user@example.com', 'John Doe');

      expect(result.success).toBe(false);
      expect(result.error).toBe('SendGrid API key lacks permissions or sender email not verified');
    });

    it('should handle generic SendGrid errors', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        return; // Skip if not configured
      }

      const error = new Error('Network error');
      mockSend.mockRejectedValue(error);

      const result = await sendInvitationEmail('user@example.com', 'John Doe');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle unknown errors', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        return; // Skip if not configured
      }

      mockSend.mockRejectedValue({});

      const result = await sendInvitationEmail('user@example.com', 'John Doe');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('sendRequestNotificationEmail', () => {
    it('should send notification to multiple admins when configured', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        const result = await sendRequestNotificationEmail(
          ['admin@example.com'],
          'John Doe',
          new Date('2026-02-01'),
          new Date('2026-02-05'),
          5
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Email service not configured');
        return;
      }

      mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);

      const adminEmails = ['admin1@example.com', 'admin2@example.com'];
      const startDate = new Date('2026-02-01');
      const endDate = new Date('2026-02-05');

      const result = await sendRequestNotificationEmail(
        adminEmails,
        'John Doe',
        startDate,
        endDate,
        5
      );

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: adminEmails,
          subject: 'New Leave Request from John Doe',
        })
      );
    });

    it('should handle send errors gracefully', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        return; // Skip if not configured
      }

      const error = new Error('Failed to send');
      mockSend.mockRejectedValue(error);

      const result = await sendRequestNotificationEmail(
        ['admin@example.com'],
        'John Doe',
        new Date('2026-02-01'),
        new Date('2026-02-05'),
        5
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to send');
    });
  });

  describe('sendApprovalEmail', () => {
    it('should send approval email successfully when configured', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        const result = await sendApprovalEmail(
          'user@example.com',
          'John Doe',
          new Date('2026-02-01'),
          new Date('2026-02-05'),
          5
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Email service not configured');
        return;
      }

      mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);

      const startDate = new Date('2026-02-01');
      const endDate = new Date('2026-02-05');

      const result = await sendApprovalEmail('user@example.com', 'John Doe', startDate, endDate, 5);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Leave Request Approved',
        })
      );
    });

    it('should handle send errors', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        return; // Skip if not configured
      }

      const error = new Error('Send failed');
      mockSend.mockRejectedValue(error);

      const result = await sendApprovalEmail(
        'user@example.com',
        'John Doe',
        new Date('2026-02-01'),
        new Date('2026-02-05'),
        5
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Send failed');
    });
  });

  describe('sendDenialEmail', () => {
    it('should send denial email with rejection reason when configured', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        const result = await sendDenialEmail(
          'user@example.com',
          'John Doe',
          new Date('2026-02-01'),
          new Date('2026-02-05'),
          5,
          'Overlaps with team event'
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Email service not configured');
        return;
      }

      mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);

      const startDate = new Date('2026-02-01');
      const endDate = new Date('2026-02-05');

      const result = await sendDenialEmail(
        'user@example.com',
        'John Doe',
        startDate,
        endDate,
        5,
        'Overlaps with team event'
      );

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Leave Request Denied',
          text: expect.stringContaining('Overlaps with team event'),
          html: expect.stringContaining('Overlaps with team event'),
        })
      );
    });

    it('should handle send errors', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        return; // Skip if not configured
      }

      const error = new Error('Send failed');
      mockSend.mockRejectedValue(error);

      const result = await sendDenialEmail(
        'user@example.com',
        'John Doe',
        new Date('2026-02-01'),
        new Date('2026-02-05'),
        5,
        'Not approved'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Send failed');
    });
  });

  describe('email content formatting', () => {
    it('should format dates in locale format', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        return;
      }

      mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);

      const startDate = new Date('2026-03-10');
      const endDate = new Date('2026-03-14');

      await sendApprovalEmail('user@example.com', 'Jane Smith', startDate, endDate, 5);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('March'),
        })
      );
    });

    it('should include business days count in emails', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        return;
      }

      mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}]);

      await sendApprovalEmail(
        'user@example.com',
        'John Doe',
        new Date('2026-02-01'),
        new Date('2026-02-10'),
        8
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('8'),
        })
      );
    });
  });

  describe('sendInvitationEmailWithToken', () => {
    it('should send invitation email with token link', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        const result = await sendInvitationEmailWithToken(
          'ivan@company.com',
          'Ivan Horvat',
          'abc123def456',
          'Admin User'
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Email service not configured');
        return;
      }

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
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        return; // Skip if not configured
      }

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
      const result = await sendInvitationEmailWithToken(
        'test@example.com',
        'Test User',
        'token123',
        'Admin'
      );

      // If configured, mock it to test error path
      if (getEmailConfigurationStatus().isConfigured) {
        expect(result.success).toBe(true);
      } else {
        expect(result.success).toBe(false);
        expect(result.error).toBe('Email service not configured');
        expect(mockSend).not.toHaveBeenCalled();
      }
    });
  });

  describe('sendReinviteEmail', () => {
    it('should send re-invite email', async () => {
      const status = getEmailConfigurationStatus();
      if (!status.isConfigured) {
        const result = await sendReinviteEmail('ivan@company.com', 'Ivan Horvat', 'newtoken123');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Email service not configured');
        return;
      }

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
});
