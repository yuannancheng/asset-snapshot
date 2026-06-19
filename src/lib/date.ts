/**
 * Parse a date string into a Date, returning null for invalid input.
 *
 * Accepted formats:
 *   YYYY-MM-DD, YYYY-M-D, YYYY/MM/DD, YYYY/M/D  (full date)
 *   MM-DD, M-D, MM/DD, M/D                      (month-day, defaults to current year)
 */
export function parseDate(value?: string) {
  if (!value) return null;

  const currentYear = new Date().getFullYear();

  let year: number;
  let month: number;
  let day: number;

  const fullMatch = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(value);
  if (fullMatch) {
    year = Number(fullMatch[1]);
    month = Number(fullMatch[2]);
    day = Number(fullMatch[3]);
  } else {
    const shortMatch = /^(\d{1,2})[-\/](\d{1,2})$/.exec(value);
    if (!shortMatch) return null;
    year = currentYear;
    month = Number(shortMatch[1]);
    day = Number(shortMatch[2]);
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return startOfDay(date);
}

export function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function today() {
  return startOfDay(new Date());
}
