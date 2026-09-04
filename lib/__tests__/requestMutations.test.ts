import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adjustBalance, commitRequestChange, InsufficientBalanceError } from '../requestMutations';

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn() },
}));
import { prisma } from '@/lib/prisma';

function makeTx(profile = { daysCarryOver: 2, daysCurrentYear: 20 }) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    leaveRequest: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'req-1', status: 'APPROVED' }),
    },
    profile: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(profile),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe('adjustBalance', () => {
  it('does nothing for NONE', async () => {
    const tx = makeTx();
    await adjustBalance(tx as never, 'p1', 'NONE', 5);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.profile.update).not.toHaveBeenCalled();
  });

  it('locks the profile row then deducts carry-over first', async () => {
    const tx = makeTx({ daysCarryOver: 2, daysCurrentYear: 20 });
    await adjustBalance(tx as never, 'p1', 'DEDUCT', 5);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.profile.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { daysCarryOver: 0, daysCurrentYear: 17 },
    });
  });

  it('refunds to current year', async () => {
    const tx = makeTx({ daysCarryOver: 0, daysCurrentYear: 15 });
    await adjustBalance(tx as never, 'p1', 'REFUND', 5);
    expect(tx.profile.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { daysCarryOver: 0, daysCurrentYear: 20 },
    });
  });

  it('throws InsufficientBalanceError when deducting more than available', async () => {
    const tx = makeTx({ daysCarryOver: 0, daysCurrentYear: 3 });
    await expect(adjustBalance(tx as never, 'p1', 'DEDUCT', 5)).rejects.toBeInstanceOf(
      InsufficientBalanceError
    );
    expect(tx.profile.update).not.toHaveBeenCalled();
  });
});

describe('commitRequestChange', () => {
  const updatedAt = new Date('2026-06-01T10:00:00.000Z');

  beforeEach(() => vi.clearAllMocks());

  it('updates only when status and updatedAt match, adjusts balance, returns fresh request', async () => {
    const tx = makeTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      (fn as (t: unknown) => Promise<unknown>)(tx)
    );

    const result = await commitRequestChange({
      id: 'req-1',
      expectedStatus: 'REQUESTED',
      expectedUpdatedAt: updatedAt,
      profileId: 'p1',
      effect: 'DEDUCT',
      days: 5,
      data: { status: 'APPROVED' },
    });

    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'REQUESTED', updatedAt },
      data: { status: 'APPROVED' },
    });
    expect(tx.profile.update).toHaveBeenCalled();
    expect(result).toEqual({ id: 'req-1', status: 'APPROVED' });
  });

  it('returns null and skips balance when the optimistic lock fails', async () => {
    const tx = makeTx();
    tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      (fn as (t: unknown) => Promise<unknown>)(tx)
    );

    const result = await commitRequestChange({
      id: 'req-1',
      expectedStatus: 'REQUESTED',
      expectedUpdatedAt: updatedAt,
      profileId: 'p1',
      effect: 'DEDUCT',
      days: 5,
      data: { status: 'APPROVED' },
    });

    expect(result).toBeNull();
    expect(tx.profile.update).not.toHaveBeenCalled();
  });
});
