import { describe, it, expect } from 'vitest';
import { canPerform, targetStatus, actionForStatus, balanceEffect } from '../requestTransitions';

describe('canPerform', () => {
  it.each([
    ['APPROVE', 'REQUESTED', true],
    ['APPROVE', 'DENIED', true],
    ['APPROVE', 'CANCELLED', true],
    ['APPROVE', 'APPROVED', false],
    ['DENY', 'REQUESTED', true],
    ['DENY', 'APPROVED', false],
    ['DENY', 'DENIED', false],
    ['DENY', 'CANCELLED', false],
    ['CANCEL', 'REQUESTED', true],
    ['CANCEL', 'APPROVED', true],
    ['CANCEL', 'DENIED', false],
    ['CANCEL', 'CANCELLED', false],
    ['RESCHEDULE', 'REQUESTED', true],
    ['RESCHEDULE', 'APPROVED', true],
    ['RESCHEDULE', 'DENIED', true],
    ['RESCHEDULE', 'CANCELLED', true],
  ] as const)('%s from %s → %s', (action, from, expected) => {
    expect(canPerform(action, from)).toBe(expected);
  });
});

describe('targetStatus', () => {
  it('maps every action to its resulting status', () => {
    expect(targetStatus('APPROVE')).toBe('APPROVED');
    expect(targetStatus('DENY')).toBe('DENIED');
    expect(targetStatus('CANCEL')).toBe('CANCELLED');
    expect(targetStatus('RESCHEDULE')).toBe('REQUESTED');
  });
});

describe('actionForStatus', () => {
  it('maps a target status back to the action', () => {
    expect(actionForStatus('APPROVED')).toBe('APPROVE');
    expect(actionForStatus('DENIED')).toBe('DENY');
    expect(actionForStatus('CANCELLED')).toBe('CANCEL');
  });

  it('returns null for REQUESTED (only reachable via reschedule)', () => {
    expect(actionForStatus('REQUESTED')).toBeNull();
  });
});

describe('balanceEffect', () => {
  it.each([
    ['REQUESTED', 'APPROVED', 'DEDUCT'],
    ['DENIED', 'APPROVED', 'DEDUCT'],
    ['CANCELLED', 'APPROVED', 'DEDUCT'],
    ['APPROVED', 'CANCELLED', 'REFUND'],
    ['APPROVED', 'REQUESTED', 'REFUND'],
    ['APPROVED', 'DENIED', 'REFUND'],
    ['REQUESTED', 'CANCELLED', 'NONE'],
    ['REQUESTED', 'DENIED', 'NONE'],
    ['DENIED', 'REQUESTED', 'NONE'],
    ['CANCELLED', 'REQUESTED', 'NONE'],
    ['REQUESTED', 'REQUESTED', 'NONE'],
    ['APPROVED', 'APPROVED', 'NONE'],
  ] as const)('%s → %s = %s', (from, to, expected) => {
    expect(balanceEffect(from, to)).toBe(expected);
  });
});
