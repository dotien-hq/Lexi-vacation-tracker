import { Profile } from '@prisma/client';

/**
 * Calculate total available vacation days
 */
export function calculateAvailableDays(profile: Profile): number {
  return profile.daysCarryOver + profile.daysCurrentYear;
}

/**
 * Check if profile has sufficient balance for requested days
 */
export function hasSufficientBalance(profile: Profile, requestedDays: number): boolean {
  return calculateAvailableDays(profile) >= requestedDays;
}

/**
 * Deduct days from profile balance (carry-over first, then current year)
 * Returns updated balance values
 */
export function deductDays(
  profile: Profile,
  daysToDeduct: number
): { daysCarryOver: number; daysCurrentYear: number } {
  let remaining = daysToDeduct;
  let carryOver = profile.daysCarryOver;
  let currentYear = profile.daysCurrentYear;

  // Deduct from carry-over first
  if (carryOver >= remaining) {
    carryOver -= remaining;
    remaining = 0;
  } else {
    remaining -= carryOver;
    carryOver = 0;
  }

  // Deduct remaining from current year
  currentYear -= remaining;

  return {
    daysCarryOver: carryOver,
    daysCurrentYear: currentYear,
  };
}

/**
 * Refund days to profile balance (always to current year)
 * Returns updated balance values
 */
export function refundDays(
  profile: Profile,
  daysToRefund: number
): { daysCarryOver: number; daysCurrentYear: number } {
  return {
    daysCarryOver: profile.daysCarryOver,
    daysCurrentYear: profile.daysCurrentYear + daysToRefund,
  };
}
