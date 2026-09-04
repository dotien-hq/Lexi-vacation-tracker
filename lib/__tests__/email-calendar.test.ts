import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sendgrid/mail', () => ({
  default: { setApiKey: vi.fn(), send: vi.fn() },
}));
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

/** email.ts reads SENDGRID_* at module load, so stub env then re-import fresh. */
async function loadEmailModule(apiKey = 'SG.test-key') {
  vi.resetModules();
  vi.stubEnv('SENDGRID_API_KEY', apiKey);
  vi.stubEnv('SENDGRID_FROM_EMAIL', 'noreply@lexi.hr');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vacation.lexi.hr');
  const sgMail = (await import('@sendgrid/mail')).default;
  const email = await import('../email');
  const mockSend = vi.mocked(sgMail.send);
  mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}] as never);
  return { email, mockSend };
}

const start = new Date('2026-07-06');
const end = new Date('2026-07-10');

describe('sendCancellationEmail', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('sends with refund note and reason when request was approved', async () => {
    const { email, mockSend } = await loadEmailModule();

    const result = await email.sendCancellationEmail(
      'ana@lexi.hr',
      'Ana Anić',
      start,
      end,
      5,
      true,
      'Project deadline'
    );

    expect(result).toEqual({ success: true });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@lexi.hr',
        subject: 'Leave Request Cancelled',
        html: expect.stringContaining('Project deadline'),
        text: expect.stringContaining('returned to your vacation balance'),
      })
    );
  });

  it('omits refund note when request was not approved', async () => {
    const { email, mockSend } = await loadEmailModule();

    await email.sendCancellationEmail('ana@lexi.hr', 'Ana', start, end, 5, false);

    const msg = mockSend.mock.calls[0][0] as { text: string; html: string };
    expect(msg.text).not.toContain('returned to your vacation balance');
    expect(msg.html).not.toContain('Reason');
  });

  it('escapes HTML in the reason', async () => {
    const { email, mockSend } = await loadEmailModule();

    await email.sendCancellationEmail('ana@lexi.hr', 'Ana', start, end, 5, false, '<b>x</b>');

    const msg = mockSend.mock.calls[0][0] as { html: string };
    expect(msg.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(msg.html).not.toContain('<b>x</b>');
  });

  it('returns an error when not configured', async () => {
    const { email, mockSend } = await loadEmailModule('');

    const result = await email.sendCancellationEmail('ana@lexi.hr', 'Ana', start, end, 5, false);

    expect(result).toEqual({ success: false, error: 'Email service not configured' });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('sendRescheduleEmail', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('sends previous and new dates with a dashboard link', async () => {
    const { email, mockSend } = await loadEmailModule();
    const newStart = new Date('2026-07-13');
    const newEnd = new Date('2026-07-15');

    const result = await email.sendRescheduleEmail(
      'ana@lexi.hr',
      'Ana',
      start,
      end,
      newStart,
      newEnd,
      3
    );

    expect(result).toEqual({ success: true });
    const msg = mockSend.mock.calls[0][0] as { subject: string; text: string; html: string };
    expect(msg.subject).toBe('Leave Dates Updated - Pending Approval');
    expect(msg.text).toContain('July 6, 2026');
    expect(msg.text).toContain('July 13, 2026');
    expect(msg.text).toContain('pending');
    expect(msg.html).toContain('https://vacation.lexi.hr/dashboard');
  });

  it('returns an error when not configured', async () => {
    const { email } = await loadEmailModule('');
    const result = await email.sendRescheduleEmail('a@b.c', 'A', start, end, start, end, 1);
    expect(result.success).toBe(false);
  });
});
