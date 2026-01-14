import { describe, it, expect } from 'vitest';
import {
  calculateAvailableDays,
  hasSufficientBalance,
  deductDays,
  refundDays,
} from '../vacationBalance';
import { Profile, Role } from '@prisma/client';

// Helper to create a mock profile
function createMockProfile(daysCarryOver: number, daysCurrentYear: number): Profile {
  return {
    id: 'test-id',
    email: 'test@example.com',
    fullName: 'Test User',
    role: Role.USER,
    daysCarryOver,
    daysCurrentYear,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('vacationBalance', () => {
  describe('calculateAvailableDays', () => {
    it('should sum carry-over and current year days', () => {
      const profile = createMockProfile(5, 20);
      expect(calculateAvailableDays(profile)).toBe(25);
    });

    it('should handle zero carry-over', () => {
      const profile = createMockProfile(0, 20);
      expect(calculateAvailableDays(profile)).toBe(20);
    });
  });

  describe('hasSufficientBalance', () => {
    it('should return true when balance is sufficient', () => {
      const profile = createMockProfile(5, 20);
      expect(hasSufficientBalance(profile, 25)).toBe(true);
      expect(hasSufficientBalance(profile, 10)).toBe(true);
    });

    it('should return false when balance is insufficient', () => {
      const profile = createMockProfile(5, 20);
      expect(hasSufficientBalance(profile, 26)).toBe(false);
    });
  });

  describe('deductDays', () => {
    it('should deduct from carry-over first when sufficient', () => {
      const profile = createMockProfile(10, 20);
      const result = deductDays(profile, 5);
      expect(result.daysCarryOver).toBe(5);
      expect(result.daysCurrentYear).toBe(20);
    });

    it('should deduct from carry-over then current year when carry-over insufficient', () => {
      const profile = createMockProfile(5, 20);
      const result = deductDays(profile, 10);
      expect(result.daysCarryOver).toBe(0);
      expect(result.daysCurrentYear).toBe(15);
    });

    it('should handle zero carry-over', () => {
      const profile = createMockProfile(0, 20);
      const result = deductDays(profile, 10);
      expect(result.daysCarryOver).toBe(0);
      expect(result.daysCurrentYear).toBe(10);
    });

    it('should deplete carry-over completely', () => {
      const profile = createMockProfile(10, 20);
      const result = deductDays(profile, 10);
      expect(result.daysCarryOver).toBe(0);
      expect(result.daysCurrentYear).toBe(20);
    });
  });

  describe('refundDays', () => {
    it('should refund to current year only', () => {
      const profile = createMockProfile(5, 15);
      const result = refundDays(profile, 10);
      expect(result.daysCarryOver).toBe(5);
      expect(result.daysCurrentYear).toBe(25);
    });

    it('should handle zero carry-over', () => {
      const profile = createMockProfile(0, 15);
      const result = refundDays(profile, 5);
      expect(result.daysCarryOver).toBe(0);
      expect(result.daysCurrentYear).toBe(20);
    });
  });
});
