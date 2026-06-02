"use client";
/**
 * DrumWheel — one spinning drum column (§1.5 / §2.6).
 *
 * RE'd from `teardowns/SWIFTUI_C4_selection.md` §1.5. A scroll-snap column with a
 * CSS barrel fade; on settle it snaps to the nearest row and reports the index.
 * Several side-by-side DrumWheels (sharing one center band) compose the `.wheel`
 * DatePicker (Month | Day | Year, or Hour | Minute | AM/PM — §2.6) and the compact
 * time spinner (§2.4).
 *
 * Reuses the Picker wheel metrics: 34pt rows, 7 visible, center selection band.
 */
import * as React from "react";
import pickerStyles from "../Picker/Picker.module.css";

const ROW_H = 34; // §1.5 standard iOS row height

export interface DrumWheelProps {
  /** Row labels, index-aligned with values. */
  items: string[];
  /** Currently-centered row index. */
  index: number;
  /** Settle → new centered index. */
  onChange: (index: number) => void;
  /** Hide the per-column center band (the parent draws one shared band). */
  hideBand?: boolean;
  /** Optional fixed width (e.g. equal columns in the date wheel). */
  width?: number | string;
  ariaLabel?: string;
}

export function DrumWheel({
  items,
  index,
  onChange,
  hideBand = false,
  width,
  ariaLabel,
}: DrumWheelProps): React.ReactElement {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const rowRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const snapTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const paint = React.useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const center = sc.scrollTop + sc.clientHeight / 2;
    rowRefs.current.forEach((row) => {
      if (!row) return;
      const rowCenter = row.offsetTop + row.offsetHeight / 2;
      const d = (rowCenter - center) / ROW_H;
      row.style.transform = `rotateX(${d * 20}deg) translateZ(-${Math.abs(d) * 10}px)`;
      row.style.opacity = String(1 - Math.min(0.85, Math.abs(d) * 0.28));
    });
  }, []);

  React.useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    sc.scrollTop = index * ROW_H;
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length]);

  const onScroll = React.useCallback(() => {
    paint();
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      const sc = scrollRef.current;
      if (!sc) return;
      const idx = Math.round(sc.scrollTop / ROW_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      if (clamped !== index) onChange(clamped);
    }, 120);
  }, [items.length, index, onChange, paint]);

  return (
    <div
      className={pickerStyles.wheel}
      ref={scrollRef}
      onScroll={onScroll}
      role="listbox"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      style={width != null ? { width } : undefined}
    >
      {!hideBand && <div className={pickerStyles.wheelBand} aria-hidden="true" />}
      <div className={pickerStyles.wheelPad} aria-hidden="true" />
      {items.map((label, i) => (
        <div
          key={i}
          ref={(el) => {
            rowRefs.current[i] = el;
          }}
          className={pickerStyles.wheelRow}
          role="option"
          aria-selected={i === index}
        >
          {label}
        </div>
      ))}
      <div className={pickerStyles.wheelPad} aria-hidden="true" />
    </div>
  );
}
DrumWheel.displayName = "DrumWheel";
