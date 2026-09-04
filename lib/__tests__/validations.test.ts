import { describe, it, expect } from 'vitest';
import {
  createRequestSchema,
  updateRequestDatesSchema,
  updateRequestStatusSchema,
} from '../validations';

describe('updateRequestStatusSchema', () => {
  it('accepts CANCELLED with an optional trimmed reason', () => {
    const r = updateRequestStatusSchema.safeParse({
      status: 'CANCELLED',
      rejectionReason: '  x  ',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rejectionReason).toBe('x');
  });

  it('rejects REQUESTED as a target status', () => {
    expect(updateRequestStatusSchema.safeParse({ status: 'REQUESTED' }).success).toBe(false);
  });

  it('rejects reasons over 500 characters', () => {
    const r = updateRequestStatusSchema.safeParse({
      status: 'CANCELLED',
      rejectionReason: 'a'.repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe('date schemas', () => {
  it('accept plain YYYY-MM-DD', () => {
    expect(
      createRequestSchema.safeParse({ startDate: '2026-07-06', endDate: '2026-07-10' }).success
    ).toBe(true);
    expect(updateRequestDatesSchema.safeParse({ startDate: '2026-07-06' }).success).toBe(true);
  });

  it('reject non-ISO formats and timestamps', () => {
    expect(
      createRequestSchema.safeParse({ startDate: 'July 6, 2026', endDate: '2026-07-10' }).success
    ).toBe(false);
    expect(updateRequestDatesSchema.safeParse({ startDate: '2026-07-06T10:00:00Z' }).success).toBe(
      false
    );
    expect(updateRequestDatesSchema.safeParse({ startDate: '+275760-09-13' }).success).toBe(false);
  });

  it('reject years outside 2020-2100', () => {
    expect(updateRequestDatesSchema.safeParse({ startDate: '0001-01-01' }).success).toBe(false);
    expect(updateRequestDatesSchema.safeParse({ endDate: '2101-01-01' }).success).toBe(false);
  });

  it('reject spans longer than 366 days', () => {
    expect(
      createRequestSchema.safeParse({ startDate: '2026-01-01', endDate: '2027-01-03' }).success
    ).toBe(false);
    expect(
      updateRequestDatesSchema.safeParse({ startDate: '2026-01-01', endDate: '2027-01-03' }).success
    ).toBe(false);
  });

  it('reject end before start', () => {
    expect(
      createRequestSchema.safeParse({ startDate: '2026-07-10', endDate: '2026-07-06' }).success
    ).toBe(false);
  });
});
