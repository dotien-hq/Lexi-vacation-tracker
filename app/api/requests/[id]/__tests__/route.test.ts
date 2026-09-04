import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from '../route';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedProfile } from '@/lib/auth';
import {
  sendApprovalEmail,
  sendDenialEmail,
  sendCancellationEmail,
  sendRescheduleEmail,
} from '@/lib/email';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    leaveRequest: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/email', () => ({
  sendApprovalEmail: vi.fn().mockResolvedValue({ success: true }),
  sendDenialEmail: vi.fn().mockResolvedValue({ success: true }),
  sendCancellationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendRescheduleEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('@/lib/auth', () => ({ getAuthenticatedProfile: vi.fn() }));
// Real rate limiter is in-memory per IP; >30 calls in one file would trip it.
vi.mock('@/lib/rateLimit', () => ({
  withRateLimit: vi.fn(() => null),
  RATE_LIMITS: { api: { windowMs: 60000, maxRequests: 30 } },
}));
vi.spyOn(console, 'error').mockImplementation(() => {});

const admin = { id: 'admin-1', role: 'ADMIN', email: 'admin@lexi.hr' };
const owner = { id: 'user-1', role: 'USER', email: 'ana@lexi.hr' };
const stranger = { id: 'user-2', role: 'USER', email: 'x@lexi.hr' };

const profile = {
  id: 'user-1',
  email: 'ana@lexi.hr',
  fullName: 'Ana',
  daysCarryOver: 2,
  daysCurrentYear: 20,
};

const UPDATED_AT = new Date('2026-06-01T10:00:00.000Z');

function existing(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'req-1',
    profileId: 'user-1',
    startDate: new Date('2026-07-06'),
    endDate: new Date('2026-07-10'),
    daysCount: 5,
    status: 'REQUESTED',
    rejectionReason: null,
    updatedAt: UPDATED_AT,
    profile,
    ...overrides,
  };
}

let tx: ReturnType<typeof makeTx>;
function makeTx(balance = { daysCarryOver: 2, daysCurrentYear: 20 }) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    leaveRequest: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'req-1', profile }),
    },
    profile: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(balance),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

const params = { params: Promise.resolve({ id: 'req-1' }) };
const patch = (body: unknown) =>
  PATCH(
    new Request('http://localhost/api/requests/req-1', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }) as never,
    params
  );
const del = () =>
  DELETE(new Request('http://localhost/api/requests/req-1', { method: 'DELETE' }) as never, params);

beforeEach(() => {
  vi.clearAllMocks();
  tx = makeTx();
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
    (fn as (t: unknown) => Promise<unknown>)(tx)
  );
  vi.mocked(getAuthenticatedProfile).mockResolvedValue(admin as never);
  vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(existing() as never);
});

describe('PATCH body', () => {
  it('rejects a non-object JSON body with 400, not 500', async () => {
    const res = await patch(null);
    expect(res.status).toBe(400);
  });

  it('rejects status and dates in the same call', async () => {
    const res = await patch({ status: 'APPROVED', startDate: '2026-07-06' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH status', () => {
  it('rejects non-admins', async () => {
    vi.mocked(getAuthenticatedProfile).mockResolvedValue(owner as never);
    const res = await patch({ status: 'APPROVED' });
    expect(res.status).toBe(403);
  });

  it('approves a REQUESTED request, deducts carry-over first, emails', async () => {
    const res = await patch({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'REQUESTED', updatedAt: UPDATED_AT },
      data: { status: 'APPROVED', rejectionReason: null },
    });
    expect(tx.profile.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { daysCarryOver: 0, daysCurrentYear: 17 },
    });
    expect(sendApprovalEmail).toHaveBeenCalledWith(
      'ana@lexi.hr',
      'Ana',
      existing().startDate,
      existing().endDate,
      5
    );
  });

  it('approves a CANCELLED request (re-deducts)', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'CANCELLED' }) as never
    );
    const res = await patch({ status: 'APPROVED' });
    expect(res.status).toBe(200);
    expect(tx.profile.update).toHaveBeenCalled();
  });

  it('refuses to approve an already APPROVED request', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );
    const res = await patch({ status: 'APPROVED' });
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 400 and sends no email when balance is insufficient at commit time', async () => {
    tx = makeTx({ daysCarryOver: 0, daysCurrentYear: 3 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      (fn as (t: unknown) => Promise<unknown>)(tx)
    );
    const res = await patch({ status: 'APPROVED' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Insufficient vacation days/);
    expect(sendApprovalEmail).not.toHaveBeenCalled();
  });

  it('cancels an APPROVED request, refunds, emails with wasApproved=true', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );
    tx = makeTx({ daysCarryOver: 0, daysCurrentYear: 15 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      (fn as (t: unknown) => Promise<unknown>)(tx)
    );

    const res = await patch({ status: 'CANCELLED', rejectionReason: 'Busy week' });

    expect(res.status).toBe(200);
    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'APPROVED', updatedAt: UPDATED_AT },
      data: { status: 'CANCELLED', rejectionReason: 'Busy week' },
    });
    expect(tx.profile.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { daysCarryOver: 0, daysCurrentYear: 20 },
    });
    expect(sendCancellationEmail).toHaveBeenCalledWith(
      'ana@lexi.hr',
      'Ana',
      expect.any(Date),
      expect.any(Date),
      5,
      true,
      'Busy week'
    );
  });

  it('cancels a REQUESTED request without touching balance', async () => {
    const res = await patch({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(tx.profile.update).not.toHaveBeenCalled();
    expect(sendCancellationEmail).toHaveBeenCalledWith(
      'ana@lexi.hr',
      'Ana',
      expect.any(Date),
      expect.any(Date),
      5,
      false,
      undefined
    );
  });

  it('refuses to cancel a DENIED request', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'DENIED' }) as never
    );
    const res = await patch({ status: 'CANCELLED' });
    expect(res.status).toBe(400);
  });

  it('still requires a reason to deny', async () => {
    const res = await patch({ status: 'DENIED' });
    expect(res.status).toBe(400);
    expect(sendDenialEmail).not.toHaveBeenCalled();
  });

  it('returns 409 when the optimistic lock fails', async () => {
    tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
    const res = await patch({ status: 'APPROVED' });
    expect(res.status).toBe(409);
    expect(sendApprovalEmail).not.toHaveBeenCalled();
  });
});

describe('PATCH dates', () => {
  it('admin reschedule of APPROVED: refunds, resets to REQUESTED, clears reason, emails', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );

    const res = await patch({ startDate: '2026-07-13', endDate: '2026-07-15' });

    expect(res.status).toBe(200);
    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'APPROVED', updatedAt: UPDATED_AT },
      data: {
        startDate: new Date('2026-07-13'),
        endDate: new Date('2026-07-15'),
        daysCount: 3,
        status: 'REQUESTED',
        rejectionReason: null,
      },
    });
    expect(tx.profile.update).toHaveBeenCalled();
    expect(sendRescheduleEmail).toHaveBeenCalledWith(
      'ana@lexi.hr',
      'Ana',
      new Date('2026-07-06'),
      new Date('2026-07-10'),
      new Date('2026-07-13'),
      new Date('2026-07-15'),
      3
    );
  });

  it('admin reschedule of DENIED works and needs no refund', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'DENIED', rejectionReason: 'no' }) as never
    );
    const res = await patch({ startDate: '2026-07-13', endDate: '2026-07-15' });
    expect(res.status).toBe(200);
    expect(tx.profile.update).not.toHaveBeenCalled();
  });

  it('rejects unchanged dates', async () => {
    const res = await patch({ startDate: '2026-07-06', endDate: '2026-07-10' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/unchanged/i);
  });

  it('rejects a range with zero business days', async () => {
    const res = await patch({ startDate: '2026-07-11', endDate: '2026-07-12' }); // Sat-Sun
    expect(res.status).toBe(400);
  });

  it('rejects an over-long span when only one date is supplied', async () => {
    // existing start 2026-07-06; schema cannot see the span, the handler must
    const res = await patch({ endDate: '2027-08-01' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/366 days/);
  });

  it('admin rescheduling their own request resets status but sends no email to themselves', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({
        status: 'APPROVED',
        profileId: 'admin-1',
        profile: { ...profile, id: 'admin-1' },
      }) as never
    );
    const res = await patch({ startDate: '2026-07-13', endDate: '2026-07-15' });
    expect(res.status).toBe(200);
    expect(tx.leaveRequest.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'REQUESTED',
    });
    expect(sendRescheduleEmail).not.toHaveBeenCalled();
  });

  it('rejects when new days exceed balance plus refund', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({
        status: 'APPROVED',
        profile: { ...profile, daysCarryOver: 0, daysCurrentYear: 1 },
      }) as never
    );
    // 1 available + 5 refunded = 6 < 10 requested
    const res = await patch({ startDate: '2026-07-13', endDate: '2026-07-24' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Available: 6/);
  });

  it('owner can edit own REQUESTED request; status unchanged; no email', async () => {
    vi.mocked(getAuthenticatedProfile).mockResolvedValue(owner as never);
    const res = await patch({ startDate: '2026-07-13', endDate: '2026-07-15' });
    expect(res.status).toBe(200);
    const data = tx.leaveRequest.updateMany.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('status');
    expect(sendRescheduleEmail).not.toHaveBeenCalled();
  });

  it('owner cannot edit an APPROVED request', async () => {
    vi.mocked(getAuthenticatedProfile).mockResolvedValue(owner as never);
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );
    const res = await patch({ startDate: '2026-07-13' });
    expect(res.status).toBe(400);
  });

  it('non-owner non-admin gets 403', async () => {
    vi.mocked(getAuthenticatedProfile).mockResolvedValue(stranger as never);
    const res = await patch({ startDate: '2026-07-13' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE', () => {
  it('admin deletes APPROVED with refund, using status as lock', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );
    const res = await del();
    expect(res.status).toBe(200);
    expect(tx.leaveRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'APPROVED', updatedAt: UPDATED_AT },
    });
    expect(tx.profile.update).toHaveBeenCalled();
  });

  it('admin deletes REQUESTED without refund', async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(tx.profile.update).not.toHaveBeenCalled();
  });

  it('returns 409 when the row changed underneath', async () => {
    tx.leaveRequest.deleteMany.mockResolvedValue({ count: 0 });
    const res = await del();
    expect(res.status).toBe(409);
  });

  it('owner may delete own REQUESTED but not APPROVED', async () => {
    vi.mocked(getAuthenticatedProfile).mockResolvedValue(owner as never);
    expect((await del()).status).toBe(200);

    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );
    expect((await del()).status).toBe(400);
  });
});
