/**
 * US Holiday computation — returns next occurrence of each federal holiday.
 */

interface Holiday {
  name: string;
  date: Date;
}

/** Get the nth occurrence of a weekday in a month (1-indexed). n=-1 means last. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  if (n === -1) {
    // Last occurrence: start from end of month, walk backward
    const last = new Date(year, month + 1, 0); // last day of month
    const diff = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month, last.getDate() - diff);
  }
  // Nth occurrence: start from 1st of month
  const first = new Date(year, month, 1);
  const diff = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + diff + (n - 1) * 7);
}

/** Easter Sunday via anonymous Gregorian algorithm */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function getUSHolidaysForYear(year: number): Holiday[] {
  return [
    { name: "New Year's Day", date: new Date(year, 0, 1) },
    { name: "Martin Luther King, Jr. Day", date: nthWeekdayOfMonth(year, 0, 1, 3) },
    { name: "Presidents' Day", date: nthWeekdayOfMonth(year, 1, 1, 3) },
    { name: "Easter Sunday", date: getEasterSunday(year) },
    { name: "Memorial Day", date: nthWeekdayOfMonth(year, 4, 1, -1) },
    { name: "Juneteenth National Independence Day", date: new Date(year, 5, 19) },
    { name: "Independence Day", date: new Date(year, 6, 4) },
    { name: "Labor Day", date: nthWeekdayOfMonth(year, 8, 1, 1) },
    { name: "Columbus Day", date: nthWeekdayOfMonth(year, 9, 1, 2) },
    { name: "Veterans Day", date: new Date(year, 10, 11) },
    { name: "Thanksgiving", date: nthWeekdayOfMonth(year, 10, 4, 4) },
    { name: "Day after Thanksgiving (Black Friday)", date: new Date(nthWeekdayOfMonth(year, 10, 4, 4).getTime() + 86400000) },
    { name: "Christmas Eve", date: new Date(year, 11, 24) },
    { name: "Christmas Day", date: new Date(year, 11, 25) },
    { name: "New Year's Eve", date: new Date(year, 11, 31) },
  ];
}

/** Returns the next occurrence of each holiday (this year or next if already passed). */
export function getNextHolidays(): Holiday[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const year = now.getFullYear();

  const thisYear = getUSHolidaysForYear(year);
  const nextYear = getUSHolidaysForYear(year + 1);

  return thisYear.map((h, i) => {
    if (h.date >= now) return h;
    return nextYear[i];
  });
}
