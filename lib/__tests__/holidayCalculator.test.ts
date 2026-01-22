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

    it('should exclude 2026 Easter Monday (Apr 6)', () => {
      // Apr 5 (Sun) to Apr 7 (Tue) - Apr 5 is weekend, Apr 6 is Easter Monday holiday
      // Only Apr 7 is a business day
      const start = new Date('2026-04-05');
      const end = new Date('2026-04-07');
      expect(calculateBusinessDays(start, end)).toBe(1);
    });

    it('should exclude 2026 Corpus Christi (Jun 4)', () => {
      // Jun 3 (Wed) to Jun 5 (Fri) - Jun 4 is Corpus Christi holiday
      // Only Jun 3 and Jun 5 are business days
      const start = new Date('2026-06-03');
      const end = new Date('2026-06-05');
      expect(calculateBusinessDays(start, end)).toBe(2);
    });

    it('should exclude 2027 Easter Monday (Mar 29)', () => {
      // Mar 28 (Sun) to Mar 30 (Tue) - Mar 28 is weekend, Mar 29 is Easter Monday holiday
      // Only Mar 30 is a business day
      const start = new Date('2027-03-28');
      const end = new Date('2027-03-30');
      expect(calculateBusinessDays(start, end)).toBe(1);
    });

    it('should exclude 2027 Corpus Christi (May 27)', () => {
      // May 26 (Wed) to May 28 (Fri) - May 27 is Corpus Christi holiday
      // Only May 26 and May 28 are business days
      const start = new Date('2027-05-26');
      const end = new Date('2027-05-28');
      expect(calculateBusinessDays(start, end)).toBe(2);
    });

    it('should exclude 2028 Easter Monday (Apr 17)', () => {
      // Apr 16 (Sun) to Apr 18 (Tue) - Apr 16 is weekend, Apr 17 is Easter Monday holiday
      // Only Apr 18 is a business day
      const start = new Date('2028-04-16');
      const end = new Date('2028-04-18');
      expect(calculateBusinessDays(start, end)).toBe(1);
    });

    it('should exclude 2028 Corpus Christi (Jun 15)', () => {
      // Jun 14 (Wed) to Jun 16 (Fri) - Jun 15 is Corpus Christi holiday
      // Only Jun 14 and Jun 16 are business days
      const start = new Date('2028-06-14');
      const end = new Date('2028-06-16');
      expect(calculateBusinessDays(start, end)).toBe(2);
    });

    it('should handle Date objects from Prisma', () => {
      // Simulate Date objects that would come from Prisma
      const start = new Date(2026, 0, 6); // Jan 6, 2026 (Epiphany - holiday)
      const end = new Date(2026, 0, 8); // Jan 8, 2026 (Thursday)
      // Jan 6 (Tue) is holiday, Jan 7 (Wed) and Jan 8 (Thu) are business days
      expect(calculateBusinessDays(start, end)).toBe(2);
    });

    it('should handle ISO string inputs', () => {
      // ISO string format that might come from API
      expect(calculateBusinessDays('2026-01-06T00:00:00.000Z', '2026-01-08T00:00:00.000Z')).toBe(2);
    });
  });
});
