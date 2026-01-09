// Croatian public holidays with Nov 1 (All Saints' Day) and Nov 18 (Remembrance Day)
const croatianHolidays = [
  // 2026
  '2026-01-01',
  '2026-01-06',
  '2026-04-05',
  '2026-04-06',
  '2026-05-01',
  '2026-05-30',
  '2026-06-04',
  '2026-06-22',
  '2026-08-05',
  '2026-08-15',
  '2026-11-01',
  '2026-11-18', // All Saints' Day, Remembrance Day
  '2026-12-25',
  '2026-12-26',

  // 2027
  '2027-01-01',
  '2027-01-06',
  '2027-03-28',
  '2027-03-29',
  '2027-05-01',
  '2027-05-30',
  '2027-05-27',
  '2027-06-22',
  '2027-08-05',
  '2027-08-15',
  '2027-11-01',
  '2027-11-18', // All Saints' Day, Remembrance Day
  '2027-12-25',
  '2027-12-26',

  // 2028
  '2028-01-01',
  '2028-01-06',
  '2028-04-16',
  '2028-04-17',
  '2028-05-01',
  '2028-05-30',
  '2028-06-15',
  '2028-06-22',
  '2028-08-05',
  '2028-08-15',
  '2028-11-01',
  '2028-11-18', // All Saints' Day, Remembrance Day
  '2028-12-25',
  '2028-12-26',

  // 2029
  '2029-01-01',
  '2029-01-06',
  '2029-04-01',
  '2029-04-02',
  '2029-05-01',
  '2029-05-30',
  '2029-05-31',
  '2029-06-22',
  '2029-08-05',
  '2029-08-15',
  '2029-11-01',
  '2029-11-18', // All Saints' Day, Remembrance Day
  '2029-12-25',
  '2029-12-26',
];

// Parse date string as local date (avoids timezone shift issues)
function parseLocalDate(dateInput: Date | string): Date {
  if (typeof dateInput === 'string') {
    // Parse "YYYY-MM-DD" as local date, not UTC
    const [year, month, day] = dateInput
      .split('T')[0]
      .split('-')
      .map(Number);
    return new Date(year, month - 1, day);
  }
  // If it's already a Date, extract components and recreate as local
  const d = new Date(dateInput);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Format date as YYYY-MM-DD using local date components (not UTC)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateBusinessDays(
  start: Date | string,
  end: Date | string
): number {
  let count = 0;
  const current = parseLocalDate(start);
  const endDate = parseLocalDate(end);

  while (current <= endDate) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    const formattedDate = formatLocalDate(current);

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = croatianHolidays.includes(formattedDate);

    if (!isWeekend && !isHoliday) {
      count++;
    }

    current.setDate(current.getDate() + 1);
  }
  return count;
}
