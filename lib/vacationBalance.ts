/**
 * Vacation Balance Utility Functions
 *
 * Handles vacation day calculations, deductions, and refunds.
 * Implements carry-over first deduction logic per requirements 12.1-12.5.
 */

interface VacationBalance {
  daysCarryOver: number;
  daysCurrentYear: number;
}

/**
 * Calculate total available vacation days
 *
 * @param balance - Profile with vacation day balances
 * @returns Total available days (carry-over + current year)
 */
export function calculateAvailableDays(balance: VacationBalance): number {
  return balance.daysCarryOver + balance.daysCurrentYear;
}

/**
 * Check if user has sufficient balance for requested days
 *
 * @param balance - Profile with vacation day balances
 * @param requestedDays - Number of days requested
 * @returns True if sufficient balance exists
 */
export function hasSufficientBalance(balance: VacationBalance, requestedDays: number): boolean {
  return calculateAvailableDays(balance) >= requestedDays;
}

/**
 * Deduct vacation days from balance
 * Implements carry-over first deduction logic (Requirements 12.1, 12.2)
 *
 * @param balance - Profile with vacation day balances
 * @param daysToDeduct - Number of days to deduct
 * @returns Updated balance with days deducted
 */
export function deductDays(balance: VacationBalance, daysToDeduct: number): VacationBalance {
  let remaining = daysToDeduct;
  let carryOver = balance.daysCarryOver;
  let currentYear = balance.daysCurrentYear;

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
 * Refund vacation days to balance
 * Always refunds to current year (Requirement 12.5)
 *
 * @param balance - Profile with vacation day balances
 * @param daysToRefund - Number of days to refund
 * @returns Updated balance with days refunded
 */
export function refundDays(balance: VacationBalance, daysToRefund: number): VacationBalance {
  return {
    daysCarryOver: balance.daysCarryOver,
    daysCurrentYear: balance.daysCurrentYear + daysToRefund,
  };
}
