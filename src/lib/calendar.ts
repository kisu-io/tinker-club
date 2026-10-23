// Pure date helpers for the server-rendered calendars. All dates are UTC YYYY-MM-DD strings.

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const todayUtc = () => new Date().toISOString().slice(0, 10);

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A `?month=YYYY-MM` param, or the month of `today` when missing or malformed. */
export const parseMonth = (param: unknown, today = todayUtc()) =>
  typeof param === "string" && MONTH_RE.test(param) ? param : today.slice(0, 7);

/** A `?from=YYYY-MM-DD` param, or `today` when missing or malformed. */
export const parseDay = (param: unknown, today = todayUtc()) =>
  typeof param === "string" && DATE_RE.test(param) && !Number.isNaN(Date.parse(param)) ? param : today;

export function shiftMonth(month: string, n: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

/** Monday-first weeks covering the month; days outside it are null. */
export function monthWeeks(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const days: (string | null)[] = Array(lead).fill(null);
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) days.push(d);
  while (days.length % 7) days.push(null);
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00Z`));
}

export function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}
