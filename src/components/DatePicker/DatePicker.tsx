"use client";
/**
 * `DatePicker` — SwiftUI Cluster C4 selection control.
 *
 * RE'd from `teardowns/SWIFTUI_C4_selection.md` §2.
 *
 *   DatePicker(selection:displayedComponents:label:)
 *     .datePickerStyle(.compact | .graphical | .wheel | .field | .stepperField | .automatic)
 *
 *  - binds a `Date` (spec §2.1); `displayedComponents` defaults to date+time (§2.1).
 *  - `.compact` = pill button(s) + popover (calendar for date, wheel for time) (§2.4).
 *  - `.graphical` = full month calendar grid (the reference piece, §2.5).
 *  - `.wheel` = side-by-side spinning drums (§2.6).
 *  - `.field` / `.stepperField` = macOS segmented numeric field (§2.7).
 *
 * Modifier props pass through to <View> on the host.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import { useResolvedStyle, type DatePickerStyleName } from "../../system/styles";
import { materialClass } from "../../system/effects";
import { CalendarGrid } from "./CalendarGrid";
import { DrumWheel } from "./DrumWheel";
import {
  dateKey,
  formatDatePill,
  formatTimePill,
  monthTitle as _monthTitle,
} from "./calendar";
import styles from "./DatePicker.module.css";

/** Which fields the picker edits (the `DatePickerComponents` OptionSet, §2.2). */
export type DatePickerComponent = "date" | "hourAndMinute" | "hourMinuteAndSecond";

export type DatePickerStyle = DatePickerStyleName;

export interface DatePickerProps extends Omit<ViewProps, "onChange"> {
  /** Bound value (`Binding<Date>`). */
  selection: Date;
  onChange: (date: Date) => void;
  label?: React.ReactNode;
  /** Default `["date","hourAndMinute"]` (spec §2.1 KNOWN default). */
  components?: DatePickerComponent[];
  /** `in: range` lower / upper bound (spec §2.1). */
  min?: Date;
  max?: Date;
  datePickerStyle?: DatePickerStyle;
  disabled?: boolean;
  /** First-weekday + month/day order. */
  locale?: string;
}

const DEFAULT_COMPONENTS: DatePickerComponent[] = ["date", "hourAndMinute"];

export function DatePicker(props: DatePickerProps): React.ReactElement {
  const {
    selection,
    onChange,
    label,
    components = DEFAULT_COMPONENTS,
    min,
    max,
    datePickerStyle,
    disabled = false,
    locale = "en-US",
    style,
    ...viewRest
  } = props;

  const resolved = useResolvedStyle("datePicker", datePickerStyle);
  // web default for .automatic = compact (spec §2.8)
  const renderStyle: DatePickerStyle = resolved === "automatic" ? "compact" : resolved;

  const hasDate = components.includes("date");
  const hasTime =
    components.includes("hourAndMinute") || components.includes("hourMinuteAndSecond");
  const withSeconds = components.includes("hourMinuteAndSecond");

  const shared = {
    selection,
    onChange,
    min,
    max,
    locale,
    disabled,
    hasDate,
    hasTime,
    withSeconds,
  };

  let body: React.ReactNode;
  switch (renderStyle) {
    case "graphical":
      body = <GraphicalDate {...shared} />;
      break;
    case "wheel":
      body = <WheelDate {...shared} />;
      break;
    case "field":
      body = <FieldDate {...shared} stepper={false} />;
      break;
    case "stepperField":
      body = <FieldDate {...shared} stepper />;
      break;
    case "compact":
    default:
      body = <CompactDate {...shared} label={label} />;
      break;
  }

  return (
    <View style={style} {...viewRest}>
      {body}
    </View>
  );
}
DatePicker.displayName = "DatePicker";

/* ===========================================================================
 * Shared sub-renderer shape
 * ======================================================================== */

interface DateRendererProps {
  selection: Date;
  onChange: (d: Date) => void;
  min?: Date;
  max?: Date;
  locale: string;
  disabled: boolean;
  hasDate: boolean;
  hasTime: boolean;
  withSeconds: boolean;
}

/** Replace just the y/m/d of a Date, keeping time-of-day. */
function withDay(base: Date, day: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
  );
}
/** Replace the time-of-day of a Date, keeping y/m/d. */
function withTime(base: Date, h: number, m: number, s = 0): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    h,
    m,
    s,
  );
}

/* ===========================================================================
 * .graphical — full month calendar (§2.5)
 * ======================================================================== */

function GraphicalDate({
  selection,
  onChange,
  min,
  max,
  locale,
  disabled,
  hasTime,
  withSeconds,
}: DateRendererProps): React.ReactElement {
  const [visibleMonth, setVisibleMonth] = React.useState({
    year: selection.getFullYear(),
    month: selection.getMonth(),
  });

  const selectedKeys = React.useMemo(
    () => new Set([dateKey(selection)]),
    [selection],
  );

  return (
    <div>
      <CalendarGrid
        selectedKeys={selectedKeys}
        onPick={(day) => onChange(withDay(selection, day))}
        visibleMonth={visibleMonth}
        onMonthChange={setVisibleMonth}
        min={min}
        max={max}
        locale={locale}
        disabled={disabled}
      />
      {hasTime && (
        <div style={{ marginTop: 8 }}>
          <TimeWheels
            selection={selection}
            onChange={onChange}
            withSeconds={withSeconds}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
 * .compact — pill button(s) + popover (§2.4)
 * ======================================================================== */

function CompactDate({
  selection,
  onChange,
  min,
  max,
  locale,
  disabled,
  hasDate,
  hasTime,
  withSeconds,
  label,
}: DateRendererProps & { label?: React.ReactNode }): React.ReactElement {
  const [openField, setOpenField] = React.useState<"date" | "time" | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = React.useState({
    year: selection.getFullYear(),
    month: selection.getMonth(),
  });

  React.useEffect(() => {
    if (!openField) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpenField(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenField(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openField]);

  const selectedKeys = React.useMemo(
    () => new Set([dateKey(selection)]),
    [selection],
  );

  return (
    <div
      className={styles.compact}
      ref={rootRef}
      data-disabled={disabled || undefined}
    >
      {label != null && <span className={styles.compactLabel}>{label}</span>}
      <div className={styles.compactFields}>
        {hasDate && (
          <button
            type="button"
            className={styles.pill}
            data-field="date"
            aria-expanded={openField === "date"}
            disabled={disabled}
            onClick={() => setOpenField((f) => (f === "date" ? null : "date"))}
          >
            {formatDatePill(selection, locale)}
          </button>
        )}
        {hasTime && (
          <button
            type="button"
            className={styles.pill}
            data-field="time"
            aria-expanded={openField === "time"}
            disabled={disabled}
            onClick={() => setOpenField((f) => (f === "time" ? null : "time"))}
          >
            {formatTimePill(selection, locale, withSeconds)}
          </button>
        )}
      </div>

      {openField === "date" && (
        <div className={`${styles.popover} ${materialClass("regular")}`}>
          <CalendarGrid
            selectedKeys={selectedKeys}
            onPick={(day) => onChange(withDay(selection, day))}
            visibleMonth={visibleMonth}
            onMonthChange={setVisibleMonth}
            min={min}
            max={max}
            locale={locale}
          />
        </div>
      )}
      {openField === "time" && (
        <div className={`${styles.popover} ${materialClass("regular")}`}>
          <TimeWheels
            selection={selection}
            onChange={onChange}
            withSeconds={withSeconds}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
 * .wheel — side-by-side spinning drums (§2.6)
 * ======================================================================== */

const MONTH_NAMES = (locale: string): string[] =>
  Array.from({ length: 12 }, (_, m) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2023, m, 1)),
  );

function WheelDate({
  selection,
  onChange,
  locale,
  hasDate,
  hasTime,
  withSeconds,
}: DateRendererProps): React.ReactElement {
  return (
    <div className={styles.wheelRow}>
      {hasDate && <DateWheels selection={selection} onChange={onChange} locale={locale} />}
      {hasTime && (
        <TimeWheels
          selection={selection}
          onChange={onChange}
          withSeconds={withSeconds}
          locale={locale}
        />
      )}
    </div>
  );
}

/** Month | Day | Year drums (US order; locale-order is a v2 refinement). */
function DateWheels({
  selection,
  onChange,
  locale,
}: {
  selection: Date;
  onChange: (d: Date) => void;
  locale: string;
}): React.ReactElement {
  const months = React.useMemo(() => MONTH_NAMES(locale), [locale]);
  const year = selection.getFullYear();
  const baseYear = year - 100;
  const years = React.useMemo(
    () => Array.from({ length: 201 }, (_, i) => String(baseYear + i)),
    [baseYear],
  );
  const daysInMonth = new Date(year, selection.getMonth() + 1, 0).getDate();
  const days = React.useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => String(i + 1)),
    [daysInMonth],
  );

  return (
    <div className={styles.wheelRow}>
      <div className={styles.wheelBand} aria-hidden="true" />
      <DrumWheel
        items={months}
        index={selection.getMonth()}
        onChange={(m) =>
          onChange(new Date(year, m, Math.min(selection.getDate(), new Date(year, m + 1, 0).getDate()), selection.getHours(), selection.getMinutes(), selection.getSeconds()))
        }
        hideBand
        width={80}
        ariaLabel="Month"
      />
      <DrumWheel
        items={days}
        index={selection.getDate() - 1}
        onChange={(d) =>
          onChange(new Date(year, selection.getMonth(), d + 1, selection.getHours(), selection.getMinutes(), selection.getSeconds()))
        }
        hideBand
        width={56}
        ariaLabel="Day"
      />
      <DrumWheel
        items={years}
        index={year - baseYear}
        onChange={(yi) =>
          onChange(new Date(baseYear + yi, selection.getMonth(), Math.min(selection.getDate(), new Date(baseYear + yi, selection.getMonth() + 1, 0).getDate()), selection.getHours(), selection.getMinutes(), selection.getSeconds()))
        }
        hideBand
        width={72}
        ariaLabel="Year"
      />
    </div>
  );
}

/** Hour | Minute | (Second) | AM-PM drums. */
function TimeWheels({
  selection,
  onChange,
  withSeconds,
  locale: _locale,
}: {
  selection: Date;
  onChange: (d: Date) => void;
  withSeconds: boolean;
  locale: string;
}): React.ReactElement {
  const h24 = selection.getHours();
  const isPM = h24 >= 12;
  const h12 = ((h24 + 11) % 12) + 1; // 1..12

  const hours = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i + 1)),
    [],
  );
  const minutes = React.useMemo(
    () => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")),
    [],
  );
  const seconds = minutes;
  const meridiem = ["AM", "PM"];

  const applyH12 = (newH12: number, pm: boolean) => {
    const base = pm ? 12 : 0;
    const h = base + (newH12 % 12);
    return withTime(selection, h, selection.getMinutes(), selection.getSeconds());
  };

  return (
    <div className={styles.wheelRow}>
      <div className={styles.wheelBand} aria-hidden="true" />
      <DrumWheel
        items={hours}
        index={h12 - 1}
        onChange={(i) => onChange(applyH12(i + 1, isPM))}
        hideBand
        width={56}
        ariaLabel="Hour"
      />
      <DrumWheel
        items={minutes}
        index={selection.getMinutes()}
        onChange={(m) => onChange(withTime(selection, selection.getHours(), m, selection.getSeconds()))}
        hideBand
        width={56}
        ariaLabel="Minute"
      />
      {withSeconds && (
        <DrumWheel
          items={seconds}
          index={selection.getSeconds()}
          onChange={(s) => onChange(withTime(selection, selection.getHours(), selection.getMinutes(), s))}
          hideBand
          width={56}
          ariaLabel="Second"
        />
      )}
      <DrumWheel
        items={meridiem}
        index={isPM ? 1 : 0}
        onChange={(i) => onChange(applyH12(h12, i === 1))}
        hideBand
        width={56}
        ariaLabel="AM/PM"
      />
    </div>
  );
}

/* ===========================================================================
 * .field / .stepperField (macOS) — segmented numeric field (§2.7)
 * ======================================================================== */

function FieldDate({
  selection,
  onChange,
  hasDate,
  hasTime,
  withSeconds,
  disabled,
  stepper,
}: DateRendererProps & { stepper: boolean }): React.ReactElement {
  const [focused, setFocused] = React.useState<
    "month" | "day" | "year" | "hour" | "minute" | "second" | null
  >(null);

  const set = {
    month: (v: number) =>
      onChange(new Date(selection.getFullYear(), clamp(v, 1, 12) - 1, Math.min(selection.getDate(), new Date(selection.getFullYear(), clamp(v, 1, 12), 0).getDate()), selection.getHours(), selection.getMinutes(), selection.getSeconds())),
    day: (v: number) =>
      onChange(new Date(selection.getFullYear(), selection.getMonth(), clamp(v, 1, new Date(selection.getFullYear(), selection.getMonth() + 1, 0).getDate()), selection.getHours(), selection.getMinutes(), selection.getSeconds())),
    year: (v: number) =>
      onChange(new Date(clamp(v, 1, 9999), selection.getMonth(), selection.getDate(), selection.getHours(), selection.getMinutes(), selection.getSeconds())),
    hour: (v: number) => onChange(withTime(selection, clamp(v, 0, 23), selection.getMinutes(), selection.getSeconds())),
    minute: (v: number) => onChange(withTime(selection, selection.getHours(), clamp(v, 0, 59), selection.getSeconds())),
    second: (v: number) => onChange(withTime(selection, selection.getHours(), selection.getMinutes(), clamp(v, 0, 59))),
  };

  const seg = (
    name: keyof typeof set,
    value: number,
    width2 = false,
  ): React.ReactElement => (
    <input
      className={`${styles.fieldSeg}${width2 ? ` ${styles.fieldSegWide}` : ""}`}
      type="number"
      value={value}
      disabled={disabled}
      onFocus={() => setFocused(name)}
      onChange={(e) => set[name](Number(e.target.value))}
    />
  );

  const stepFocused = (dir: 1 | -1) => {
    if (!focused) return;
    const cur = {
      month: selection.getMonth() + 1,
      day: selection.getDate(),
      year: selection.getFullYear(),
      hour: selection.getHours(),
      minute: selection.getMinutes(),
      second: selection.getSeconds(),
    }[focused];
    set[focused](cur + dir);
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center" }}>
      <div className={styles.field}>
        {hasDate && (
          <>
            {seg("month", selection.getMonth() + 1)}
            <span className={styles.fieldSep}>/</span>
            {seg("day", selection.getDate())}
            <span className={styles.fieldSep}>/</span>
            {seg("year", selection.getFullYear(), true)}
          </>
        )}
        {hasDate && hasTime && <span className={styles.fieldSep}>&nbsp;</span>}
        {hasTime && (
          <>
            {seg("hour", selection.getHours())}
            <span className={styles.fieldSep}>:</span>
            {seg("minute", selection.getMinutes())}
            {withSeconds && (
              <>
                <span className={styles.fieldSep}>:</span>
                {seg("second", selection.getSeconds())}
              </>
            )}
          </>
        )}
      </div>
      {stepper && (
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.stepperBtn}
            aria-label="Increment"
            disabled={disabled || !focused}
            onClick={() => stepFocused(1)}
          >
            ▲
          </button>
          <button
            type="button"
            className={styles.stepperBtn}
            aria-label="Decrement"
            disabled={disabled || !focused}
            onClick={() => stepFocused(-1)}
          >
            ▼
          </button>
        </div>
      )}
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
