"use client";
/**
 * `MultiDatePicker` — SwiftUI Cluster C4 selection control (iOS-only in SwiftUI).
 *
 * RE'd from `teardowns/SWIFTUI_C4_selection.md` §3.
 *
 *   MultiDatePicker(selection: Binding<Set<DateComponents>>, in: bounds, label:)
 *
 * The key difference from `DatePicker` (spec §3.1 KNOWN): the binding is a SET of
 * selected days, not a single Date. Visually it is the SAME §2.5 calendar grid,
 * but tapping a day TOGGLES its membership instead of replacing a single value,
 * and `is-selected` is applied to EVERY day in the set (§3.2/§3.3).
 *
 * Web modeling (spec §3.3 DESIGNED): `selection: Set<string>` of ISO "YYYY-MM-DD"
 * keys (== `DateComponents` {year,month,day}). The grid + CSS are reused verbatim
 * via the shared `<CalendarGrid>` from the DatePicker cluster.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import { CalendarGrid, dateKey } from "../DatePicker";

export interface MultiDatePickerProps extends Omit<ViewProps, "onChange"> {
  /** Selected days as ISO "YYYY-MM-DD" keys (== the `Set<DateComponents>`). */
  selection: Set<string>;
  /** Toggle write-back — receives the next set. */
  onChange: (next: Set<string>) => void;
  label?: React.ReactNode;
  /** Half-open bounds (`Range`/`PartialRangeFrom`/`PartialRangeUpTo`, §3.1). */
  min?: Date;
  max?: Date;
  locale?: string;
  disabled?: boolean;
}

export function MultiDatePicker(props: MultiDatePickerProps): React.ReactElement {
  const {
    selection,
    onChange,
    label: _label,
    min,
    max,
    locale = "en-US",
    disabled = false,
    style,
    ...viewRest
  } = props;

  // anchor the visible month on the earliest selected day, else today
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const first = [...selection].sort()[0];
    const anchor = first ? new Date(first) : new Date();
    return { year: anchor.getFullYear(), month: anchor.getMonth() };
  });

  // toggle set membership (spec §3.3: next.has(key) ? delete : add)
  const handlePick = React.useCallback(
    (day: Date) => {
      const key = dateKey(day);
      const next = new Set(selection);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onChange(next);
    },
    [selection, onChange],
  );

  return (
    <View style={style} {...viewRest}>
      <CalendarGrid
        selectedKeys={selection}
        onPick={handlePick}
        visibleMonth={visibleMonth}
        onMonthChange={setVisibleMonth}
        min={min}
        max={max}
        locale={locale}
        disabled={disabled}
      />
    </View>
  );
}
MultiDatePicker.displayName = "MultiDatePicker";
