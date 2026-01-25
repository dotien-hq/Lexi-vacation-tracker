// Holiday type with name information
export interface Holiday {
  date: string;
  name: string;
  nameHr: string;
}

// Croatian public holidays with names
const croatianHolidays: Holiday[] = [
  // 2026
  { date: '2026-01-01', name: "New Year's Day", nameHr: 'Nova godina' },
  { date: '2026-01-06', name: 'Epiphany', nameHr: 'Sveta tri kralja' },
  { date: '2026-04-06', name: 'Easter Monday', nameHr: 'Uskrsni ponedjeljak' },
  { date: '2026-05-01', name: 'Labour Day', nameHr: 'Praznik rada' },
  { date: '2026-05-30', name: 'Statehood Day', nameHr: 'Dan državnosti' },
  { date: '2026-06-04', name: 'Corpus Christi', nameHr: 'Tijelovo' },
  { date: '2026-06-22', name: 'Anti-Fascist Struggle Day', nameHr: 'Dan antifašističke borbe' },
  { date: '2026-08-05', name: 'Victory Day', nameHr: 'Dan pobjede' },
  { date: '2026-08-15', name: 'Assumption of Mary', nameHr: 'Velika Gospa' },
  { date: '2026-11-01', name: "All Saints' Day", nameHr: 'Svi sveti' },
  { date: '2026-11-18', name: 'Remembrance Day', nameHr: 'Dan sjećanja' },
  { date: '2026-12-25', name: 'Christmas Day', nameHr: 'Božić' },
  { date: '2026-12-26', name: "St. Stephen's Day", nameHr: 'Sveti Stjepan' },

  // 2027
  { date: '2027-01-01', name: "New Year's Day", nameHr: 'Nova godina' },
  { date: '2027-01-06', name: 'Epiphany', nameHr: 'Sveta tri kralja' },
  { date: '2027-03-29', name: 'Easter Monday', nameHr: 'Uskrsni ponedjeljak' },
  { date: '2027-05-01', name: 'Labour Day', nameHr: 'Praznik rada' },
  { date: '2027-05-27', name: 'Corpus Christi', nameHr: 'Tijelovo' },
  { date: '2027-05-30', name: 'Statehood Day', nameHr: 'Dan državnosti' },
  { date: '2027-06-22', name: 'Anti-Fascist Struggle Day', nameHr: 'Dan antifašističke borbe' },
  { date: '2027-08-05', name: 'Victory Day', nameHr: 'Dan pobjede' },
  { date: '2027-08-15', name: 'Assumption of Mary', nameHr: 'Velika Gospa' },
  { date: '2027-11-01', name: "All Saints' Day", nameHr: 'Svi sveti' },
  { date: '2027-11-18', name: 'Remembrance Day', nameHr: 'Dan sjećanja' },
  { date: '2027-12-25', name: 'Christmas Day', nameHr: 'Božić' },
  { date: '2027-12-26', name: "St. Stephen's Day", nameHr: 'Sveti Stjepan' },

  // 2028
  { date: '2028-01-01', name: "New Year's Day", nameHr: 'Nova godina' },
  { date: '2028-01-06', name: 'Epiphany', nameHr: 'Sveta tri kralja' },
  { date: '2028-04-17', name: 'Easter Monday', nameHr: 'Uskrsni ponedjeljak' },
  { date: '2028-05-01', name: 'Labour Day', nameHr: 'Praznik rada' },
  { date: '2028-05-30', name: 'Statehood Day', nameHr: 'Dan državnosti' },
  { date: '2028-06-15', name: 'Corpus Christi', nameHr: 'Tijelovo' },
  { date: '2028-06-22', name: 'Anti-Fascist Struggle Day', nameHr: 'Dan antifašističke borbe' },
  { date: '2028-08-05', name: 'Victory Day', nameHr: 'Dan pobjede' },
  { date: '2028-08-15', name: 'Assumption of Mary', nameHr: 'Velika Gospa' },
  { date: '2028-11-01', name: "All Saints' Day", nameHr: 'Svi sveti' },
  { date: '2028-11-18', name: 'Remembrance Day', nameHr: 'Dan sjećanja' },
  { date: '2028-12-25', name: 'Christmas Day', nameHr: 'Božić' },
  { date: '2028-12-26', name: "St. Stephen's Day", nameHr: 'Sveti Stjepan' },
];

// Create a Set for fast date lookup
const holidayDates = new Set(croatianHolidays.map((h) => h.date));

// Create a Map for fast holiday lookup by date
const holidayByDate = new Map(croatianHolidays.map((h) => [h.date, h]));

// Parse date string as local date (avoids timezone shift issues)
function parseLocalDate(dateInput: Date | string): Date {
  if (typeof dateInput === 'string') {
    // Parse "YYYY-MM-DD" as local date, not UTC
    const [year, month, day] = dateInput.split('T')[0].split('-').map(Number);
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

export function calculateBusinessDays(start: Date | string, end: Date | string): number {
  let count = 0;
  const current = parseLocalDate(start);
  const endDate = parseLocalDate(end);

  while (current <= endDate) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    const formattedDate = formatLocalDate(current);

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHolidayDay = holidayDates.has(formattedDate);

    if (!isWeekend && !isHolidayDay) {
      count++;
    }

    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Get all holidays for a specific month
 * @param year - Full year (e.g., 2026)
 * @param month - Month index (0-11, where 0 = January)
 */
export function getHolidaysForMonth(year: number, month: number): Holiday[] {
  const monthStr = String(month + 1).padStart(2, '0');
  const prefix = `${year}-${monthStr}-`;
  return croatianHolidays.filter((h) => h.date.startsWith(prefix));
}

/**
 * Get holiday information for a specific date
 * @param date - Date string in YYYY-MM-DD format
 */
export function getHolidayByDate(date: string): Holiday | undefined {
  return holidayByDate.get(date);
}

/**
 * Check if a date is a holiday
 * @param date - Date string in YYYY-MM-DD format
 */
export function isHoliday(date: string): boolean {
  return holidayDates.has(date);
}
