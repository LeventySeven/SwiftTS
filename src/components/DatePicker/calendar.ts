/**
 * calendar.ts — pure date-math for the high-fidelity calendar grid (§2.5).
 *
 * RE'd from `teardowns/SWIFTUI_C4_selection.md` §2.5/§3. Shared by the graphical
 * DatePicker, the compact popover, and MultiDatePicker. No DOM, no hooks — pure
 * functions so the grid matrix is deterministic and SSR-safe.
 *
 * Keys are ISO "YYYY-MM-DD" strings == a `DateComponents` {year,month,day} with no
 * time (the MultiDatePicker `Set<DateComponents>` membership key, spec §3.3).
 */

/** One cell of the 6×7 month matrix. */
export interface DayCell {
  /** The concrete day this cell paints. */
  date: Date;
  /** Day-of-month number (1…31). */
  day: number;
  /** ISO "YYYY-MM-DD" key for set membership / equality. */
  key: string;
  /** True when the cell belongs to the previous/next month (dimmed/hidden). */
  outside: boolean;
}

/** Zero-pad to 2 digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** A Date → "YYYY-MM-DD" key (local calendar day, no time). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Parse a "YYYY-MM-DD" key back into a local Date at midnight. */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** True if two Dates fall on the same calendar day (ignores time). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Resolve the locale's first weekday (0=Sun…6=Sat). The `Intl` weekInfo API is
 * not universally available, so default to Sunday (US) and let callers override.
 * Most en-* locales start on Sunday; this matches the spec's "S M T W T F S".
 */
export function firstWeekdayFor(_locale?: string): number {
  return 0; // Sunday-first (spec §2.5 weekday header "S M T W T F S")
}

/** Localized 1-letter weekday symbols starting at `firstWeekday`. */
export function weekdaySymbols(locale = "en-US", firstWeekday = 0): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  // 2023-01-01 is a Sunday → index 0 = Sunday.
  const base = new Date(2023, 0, 1);
  const syms: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + ((firstWeekday + i) % 7));
    syms.push(fmt.format(d));
  }
  return syms;
}

/** The month title, e.g. "June 2026" (spec §2.5 header). */
export function monthTitle(year: number, month: number, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(year, month, 1),
  );
}

/**
 * Build the 6×7 = 42-cell day matrix for a month (spec §2.5: "7-col grid, up to 6
 * rows"). Leading/trailing cells from the adjacent months fill the grid and are
 * flagged `outside`. `firstWeekday` rotates the leading offset (locale-aware).
 */
export function monthMatrix(
  year: number,
  month: number,
  firstWeekday = 0,
): DayCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstDow = firstOfMonth.getDay(); // 0=Sun
  // how many leading days from the previous month to show
  const lead = (firstDow - firstWeekday + 7) % 7;
  const start = new Date(year, month, 1 - lead);

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      date: d,
      day: d.getDate(),
      key: dateKey(d),
      outside: d.getMonth() !== month,
    });
  }
  return cells;
}

/** True when `d` falls within the optional [min, max] bounds (inclusive). */
export function inBounds(d: Date, min?: Date, max?: Date): boolean {
  if (min && d < startOfDay(min)) return false;
  if (max && d > endOfDay(max)) return false;
  return true;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Shift a {year,month} by ±n months, normalizing the overflow. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/* ----- time-field helpers (compact/wheel time, §2.4/§2.6) ----- */

/** Format the date pill, e.g. "Jun 2, 2026" (spec §2.4). */
export function formatDatePill(d: Date, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Format the time pill, e.g. "2:30 PM" (spec §2.4). */
export function formatTimePill(
  d: Date,
  locale = "en-US",
  withSeconds = false,
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: true,
  }).format(d);
}
