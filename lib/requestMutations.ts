import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  calculateAvailableDays,
  deductDays,
  hasSufficientBalance,
  refundDays,
} from '@/lib/vacationBalance';
import type { BalanceEffect } from '@/lib/requestTransitions';
import type { RequestStatusValue } from '@/types';

export class InsufficientBalanceError extends Error {
  constructor(
    public readonly available: number,
    public readonly requested: number
  ) {
    super(`Insufficient vacation days. Available: ${available}, Requested: ${requested}`);
    this.name = 'InsufficientBalanceError';
  }
}

/** Fields returned to clients for a leave request. */
export const requestWithProfile = {
  profile: { select: { id: true, email: true, fullName: true } },
} satisfies Prisma.LeaveRequestInclude;

/**
 * Apply a balance change inside an open transaction.
 * Locks the profile row (SELECT ... FOR UPDATE) so concurrent changes for the
 * same person serialise instead of both reading the same stale balance.
 * Throws InsufficientBalanceError (rolling back the transaction) if a DEDUCT
 * would go negative.
 *
 * Relies on Prisma's default READ COMMITTED isolation: the findUniqueOrThrow
 * after the lock takes a fresh snapshot and sees the latest committed balance.
 * Do not switch this transaction to RepeatableRead.
 */
export async function adjustBalance(
  tx: Prisma.TransactionClient,
  profileId: string,
  effect: BalanceEffect,
  days: number
): Promise<void> {
  if (effect === 'NONE') return;

  await tx.$queryRaw`SELECT "id" FROM "Profile" WHERE "id" = ${profileId} FOR UPDATE`;

  const profile = await tx.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { daysCarryOver: true, daysCurrentYear: true },
  });

  if (effect === 'DEDUCT' && !hasSufficientBalance(profile, days)) {
    throw new InsufficientBalanceError(calculateAvailableDays(profile), days);
  }

  const next = effect === 'DEDUCT' ? deductDays(profile, days) : refundDays(profile, days);
  await tx.profile.update({ where: { id: profileId }, data: next });
}

interface CommitParams {
  id: string;
  /**
   * Optimistic lock: the update only applies if the row still has this status AND
   * this updatedAt (i.e. nobody — including the owner editing dates — changed it
   * since the caller read it). updatedAt is timestamp(3), so the JS Date round-trips exactly.
   */
  expectedStatus: RequestStatusValue;
  expectedUpdatedAt: Date;
  profileId: string;
  effect: BalanceEffect;
  /** Days to deduct or refund (the request's daysCount at the time of the change). */
  days: number;
  data: Prisma.LeaveRequestUpdateManyMutationInput;
}

/**
 * Atomically update a leave request and adjust its owner's balance.
 * Returns the updated request, or null if the optimistic lock failed
 * (someone else changed the status first) — caller should respond 409.
 */
export async function commitRequestChange(params: CommitParams) {
  const { id, expectedStatus, expectedUpdatedAt, profileId, effect, days, data } = params;

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.leaveRequest.updateMany({
      where: { id, status: expectedStatus, updatedAt: expectedUpdatedAt },
      data,
    });
    if (count === 0) return null;

    await adjustBalance(tx, profileId, effect, days);

    return tx.leaveRequest.findUniqueOrThrow({ where: { id }, include: requestWithProfile });
  });
}
