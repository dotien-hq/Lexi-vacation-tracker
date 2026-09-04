import type { RequestStatusValue } from '@/types';

/**
 * Leave request state machine.
 *
 * Pure module, no Prisma/React imports, so it is shared by:
 *  - app/api/requests/[id]/route.ts  (enforces transitions server-side)
 *  - components/calendar/EventDetailModal.tsx (decides which buttons to render)
 *
 * Invariant: vacation days are deducted while, and only while, a request is APPROVED.
 */

export type RequestAction = 'APPROVE' | 'DENY' | 'CANCEL' | 'RESCHEDULE';
export type BalanceEffect = 'DEDUCT' | 'REFUND' | 'NONE';

const ALLOWED_FROM: Record<RequestAction, readonly RequestStatusValue[]> = {
  APPROVE: ['REQUESTED', 'DENIED', 'CANCELLED'],
  DENY: ['REQUESTED'],
  CANCEL: ['REQUESTED', 'APPROVED'],
  RESCHEDULE: ['REQUESTED', 'APPROVED', 'DENIED', 'CANCELLED'],
};

const TARGET: Record<RequestAction, RequestStatusValue> = {
  APPROVE: 'APPROVED',
  DENY: 'DENIED',
  CANCEL: 'CANCELLED',
  RESCHEDULE: 'REQUESTED',
};

export function canPerform(action: RequestAction, from: RequestStatusValue): boolean {
  return ALLOWED_FROM[action].includes(from);
}

export function targetStatus(action: RequestAction): RequestStatusValue {
  return TARGET[action];
}

/** Map a target status (as sent in a PATCH body) to the action it implies. */
export function actionForStatus(to: RequestStatusValue): RequestAction | null {
  switch (to) {
    case 'APPROVED':
      return 'APPROVE';
    case 'DENIED':
      return 'DENY';
    case 'CANCELLED':
      return 'CANCEL';
    default:
      return null;
  }
}

/** Balance side-effect of moving a request from one status to another. */
export function balanceEffect(from: RequestStatusValue, to: RequestStatusValue): BalanceEffect {
  if (from === to) return 'NONE';
  if (to === 'APPROVED') return 'DEDUCT';
  if (from === 'APPROVED') return 'REFUND';
  return 'NONE';
}
