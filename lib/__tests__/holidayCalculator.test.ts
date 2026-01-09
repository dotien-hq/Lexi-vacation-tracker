import { describe, it, expect } from 'vitest';
import { calculateBusinessDays } from '../holidayCalculator';

describe('holidayCalculator', () => {
  describe('calculateBusinessDays', () => {
    it('should calculate business days excluding weekends', () => {
      // Monday to Friday (5 days) - Feb 2-6, 2026
      const start = new Date('2026-02-02'); // Monday
      const end = new Date('2026-02-06'); // Friday
      expect(calculateBusinessDays(start, end)).toBe(5);
    });

    it('should exclude weekends from calculation', () => {
      // Monday to next Monday (6 business days, excluding weekend)
      const start = new Date('2026-02-02'); // Monday
      const end = new Date('2026-02-09'); // Monday
      expect(calculateBusinessDays(start, end)).toBe(6);
    });

    it('should return 1 for same day', () => {
      const date = new Date('2026-02-02');
      expect(calculateBusinessDays(date, date)).toBe(1);
    });

    it('should exclude Croatian public holidays', () => {
      // Jan 1 (New Year) to Jan 2 (1 business day, Jan 1 is holiday, Jan 2 is Friday)
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-02');
      expect(calculateBusinessDays(start, end)).toBe(1);
    });

    it('should handle week with multiple holidays', () => {
      // Dec 24-28, 2026: Dec 25 (Fri) and 26 (Sat) are holidays, 27 (Sun) is weekend
      // Only Dec 24 (Thu) and Dec 28 (Mon) are business days
      const start = new Date('2026-12-24');
      const end = new Date('2026-12-28');
      expect(calculateBusinessDays(start, end)).toBe(2);
    });

    it('should work with string dates', () => {
      expect(calculateBusinessDays('2026-02-02', '2026-02-06')).toBe(5);
    });
  });
});
