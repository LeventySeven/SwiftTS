"use client";
/**
 * CalendarGrid — the high-fidelity month calendar (§2.5).
 *
 * RE'd from `teardowns/SWIFTUI_C4_selection.md` §2.5/§3. This is the load-bearing
 * visual primitive shared by the graphical DatePicker, the compact popover, and
 * MultiDatePicker. It is selection-agnostic: it takes a `selectedKeys` set + an
 * `onPick(date)` callback, so the single-select (replace) and multi-select
 * (toggle) policies live in the parent.
 *
 *  - 7-col grid, up to 6 rows (42 cells); circular day cells (§2.5).
 *  - tint-filled selection circle scales in on a 0.3s spring (CSS, §2.5).
 *  - today = tint text; other-month = tertiaryLabel; out-of-range = non-interactive.
 *  - month navigation (chevrons) slides the grid horizontally with a spring (§2.5).
 *  - keyboard: arrows ±1/±7 days, PageUp/Down change month, Enter/Space picks.
 */
import * as React from "react";
import {
  dateKey,
  inBounds,
  isSameDay,
  monthMatrix,
  monthTitle,
  shiftMonth,
  weekdaySymbols,
  firstWeekdayFor,
  type DayCell,
} from "./calendar";
import styles from "./DatePicker.module.css";

export interface CalendarGridProps {
  /** Which days carry the filled tint circle. ISO "YYYY-MM-DD" keys. */
  selectedKeys: Set<string>;
  /** A day was activated. Parent decides replace (single) vs toggle (multi). */
  onPick: (date: Date) => void;
  /** Month shown initially / when externally driven (the "focused" month). */
  visibleMonth: { year: number; month: number };
  /** Month navigation write-back. */
  onMonthChange: (next: { year: number; month: number }) => void;
  min?: Date;
  max?: Date;
  locale?: string;
  disabled?: boolean;
}

const ChevLeft: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 9 16" fill="none" aria-hidden="true">
    <path d="M7 1 1.5 8 7 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 9 16" fill="none" aria-hidden="true">
    <path d="M2 1 7.5 8 2 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevDown: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 11 7" fill="none" aria-hidden="true">
    <path d="M1 1.5 5.5 5.5 10 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Render one month's 42-cell pane. */
function MonthPane({
  cells,
  selectedKeys,
  today,
  min,
  max,
  onPick,
  disabled,
  focusKey,
  onFocusKey,
}: {
  cells: DayCell[];
  selectedKeys: Set<string>;
  today: Date;
  min?: Date;
  max?: Date;
  onPick: (date: Date) => void;
  disabled?: boolean;
  focusKey: string | null;
  onFocusKey: (key: string) => void;
}): React.ReactElement {
  return (
    <div className={styles.grid} role="grid">
      {cells.map((cell) => {
        const isSelected = selectedKeys.has(cell.key);
        const isToday = isSameDay(cell.date, today);
        const outOfRange = !inBounds(cell.date, min, max);
        const cellDisabled = disabled || outOfRange;
        const cls = [
          styles.day,
          isToday ? styles.dayToday : "",
          isSelected ? styles.daySelected : "",
          cell.outside ? styles.dayOutside : "",
          cellDisabled ? styles.dayDisabled : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={cell.key}
            type="button"
            className={cls}
            role="gridcell"
            aria-selected={isSelected}
            aria-current={isToday ? "date" : undefined}
            aria-disabled={cellDisabled || undefined}
            disabled={cellDisabled}
            tabIndex={cell.key === focusKey ? 0 : -1}
            data-key={cell.key}
            onClick={() => !cellDisabled && onPick(cell.date)}
            onFocus={() => onFocusKey(cell.key)}
          >
            {cell.day}
          </button>
        );
      })}
    </div>
  );
}

export function CalendarGrid({
  selectedKeys,
  onPick,
  visibleMonth,
  onMonthChange,
  min,
  max,
  locale = "en-US",
  disabled = false,
}: CalendarGridProps): React.ReactElement {
  const firstWeekday = firstWeekdayFor(locale);
  const weekdays = React.useMemo(
    () => weekdaySymbols(locale, firstWeekday),
    [locale, firstWeekday],
  );

  // "today" computed once on the client (SSR-safe: stable Date at first render).
  const today = React.useMemo(() => new Date(), []);

  // keyboard focus cursor (an ISO key within the visible month)
  const [focusKey, setFocusKey] = React.useState<string | null>(null);

  // The three panes (prev / current / next) for the horizontal slide; we render a
  // single current pane plus animate the track when month changes.
  const { year, month } = visibleMonth;
  const cells = React.useMemo(
    () => monthMatrix(year, month, firstWeekday),
    [year, month, firstWeekday],
  );

  const goPrev = () => onMonthChange(shiftMonth(year, month, -1));
  const goNext = () => onMonthChange(shiftMonth(year, month, 1));

  const prevDisabled =
    !!min && shiftMonthEndBefore(year, month, -1, min);
  const nextDisabled =
    !!max && shiftMonthStartAfter(year, month, 1, max);

  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const cur = focusKey ? new Date(focusKey) : new Date(year, month, 1);
    const move = (days: number) => {
      e.preventDefault();
      const next = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + days);
      if (!inBounds(next, min, max)) return;
      if (next.getMonth() !== month || next.getFullYear() !== year) {
        onMonthChange({ year: next.getFullYear(), month: next.getMonth() });
      }
      setFocusKey(dateKey(next));
    };
    switch (e.key) {
      case "ArrowLeft":
        move(-1);
        break;
      case "ArrowRight":
        move(1);
        break;
      case "ArrowUp":
        move(-7);
        break;
      case "ArrowDown":
        move(7);
        break;
      case "PageUp":
        e.preventDefault();
        goPrev();
        break;
      case "PageDown":
        e.preventDefault();
        goNext();
        break;
      case "Enter":
      case " ":
        if (focusKey) {
          e.preventDefault();
          const d = new Date(focusKey);
          if (inBounds(d, min, max)) onPick(d);
        }
        break;
    }
  };

  // refocus the moved cell after a month/focus change
  const gridRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!focusKey) return;
    const el = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-key="${focusKey}"]`,
    );
    el?.focus();
  }, [focusKey, year, month]);

  return (
    <div className={styles.calendar}>
      <header className={styles.bar}>
        <button type="button" className={styles.title} aria-expanded={false}>
          {monthTitle(year, month, locale)}
          <ChevDown className={styles.titleChev} />
        </button>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.navBtn}
            aria-label="Previous month"
            disabled={disabled || prevDisabled}
            onClick={goPrev}
          >
            <ChevLeft className={styles.navChevSvg} />
          </button>
          <button
            type="button"
            className={styles.navBtn}
            aria-label="Next month"
            disabled={disabled || nextDisabled}
            onClick={goNext}
          >
            <ChevRight className={styles.navChevSvg} />
          </button>
        </div>
      </header>

      <div className={styles.weekdays} aria-hidden="true">
        {weekdays.map((w, i) => (
          <span key={i} className={styles.weekday}>
            {w}
          </span>
        ))}
      </div>

      <div
        ref={gridRef}
        onKeyDown={onGridKeyDown}
        role="application"
        aria-label={monthTitle(year, month, locale)}
      >
        <MonthPane
          cells={cells}
          selectedKeys={selectedKeys}
          today={today}
          min={min}
          max={max}
          onPick={onPick}
          disabled={disabled}
          focusKey={focusKey}
          onFocusKey={setFocusKey}
        />
      </div>
    </div>
  );
}
CalendarGrid.displayName = "CalendarGrid";

/* ----- bounds helpers for prev/next disable ----- */

/** True if the entire previous month lies strictly before `min`. */
function shiftMonthEndBefore(
  year: number,
  month: number,
  delta: number,
  min: Date,
): boolean {
  const m = shiftMonth(year, month, delta);
  // last day of that month
  const last = new Date(m.year, m.month + 1, 0);
  return last < new Date(min.getFullYear(), min.getMonth(), min.getDate());
}

/** True if the entire next month lies strictly after `max`. */
function shiftMonthStartAfter(
  year: number,
  month: number,
  delta: number,
  max: Date,
): boolean {
  const m = shiftMonth(year, month, delta);
  const first = new Date(m.year, m.month, 1);
  return first > new Date(max.getFullYear(), max.getMonth(), max.getDate());
}
