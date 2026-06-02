"use client";

/**
 * `<Gauge>` — SwiftUI's value-within-bounds indicator (C1 §9, iOS16+).
 *
 * Spec: teardowns/SWIFTUI_C1_content-primitives.md §9.
 *
 *   Gauge(value: 0.4, in: 0...1) { Text("Speed") } currentValueLabel: { Text("40") }
 *
 * Styles (`.gaugeStyle(_:)`, inherited via `useResolvedStyle("gauge")`):
 *   - circular / accessoryCircular           → a 270° open-ring arc (SVG).
 *       Arc math: r=18 → circumference 2π·18 ≈ 113.1; 270° sweep = 0.75 → 84.8.
 *       The progress arc's dash length = 84.8 · frac, rotated so the gap sits
 *       at the bottom.
 *   - circularCapacity                        → same ring but the progress arc
 *       grows as a solid capacity (treated identically here — capacity vs thin
 *       progress is the same stroke, full sweep).
 *   - linear / accessoryLinear                → track + indicator DOT at value.
 *   - linearCapacity / accessoryLinearCapacity→ track FILLED to value (battery).
 *   - automatic                               → linear (kit default).
 *
 * Bounds default 0…1. `frac = (value-min)/(max-min)`, clamped. "use client"
 * (hook). Value→angle/width animate via CSS transition.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import { useResolvedStyle, type GaugeStyleName } from "../../system/styles";
import styles from "./Gauge.module.css";

export interface GaugeProps extends Omit<ViewProps, "as" | "children"> {
  /** Current value. */
  value: number;
  /** Lower bound (SwiftUI `in:` lower). Default 0. */
  min?: number;
  /** Upper bound (SwiftUI `in:` upper). Default 1. */
  max?: number;
  /** Title label. */
  label?: React.ReactNode;
  /** Center / inline current-value label. */
  currentValueLabel?: React.ReactNode;
  /** Leading bound label. */
  minimumValueLabel?: React.ReactNode;
  /** Trailing bound label. */
  maximumValueLabel?: React.ReactNode;
  /** Intermediate tick labels. */
  markedValueLabels?: React.ReactNode;
  /** `.gaugeStyle(_:)` — overrides the inherited environment style. */
  gaugeStyle?: GaugeStyleName;
}

// Arc geometry constants (44×44 viewBox, r=18, 270° sweep).
const R = 18;
const CIRCUMFERENCE = 2 * Math.PI * R; // ≈ 113.097
const ARC_LEN = CIRCUMFERENCE * 0.75; // 270° ≈ 84.823
const ARC_GAP = CIRCUMFERENCE - ARC_LEN; // remaining 90°

const CIRCULAR_STYLES = new Set<GaugeStyleName>([
  "circular",
  "accessoryCircular",
  "accessoryCircularCapacity",
]);
const CAPACITY_STYLES = new Set<GaugeStyleName>([
  "linearCapacity",
  "accessoryLinearCapacity",
]);

export const Gauge = React.forwardRef<HTMLElement, GaugeProps>(function Gauge(
  {
    value,
    min = 0,
    max = 1,
    label,
    currentValueLabel,
    minimumValueLabel,
    maximumValueLabel,
    markedValueLabels,
    gaugeStyle,
    className,
    ...rest
  },
  ref,
) {
  const resolved = useResolvedStyle("gauge", gaugeStyle);
  const span = max - min || 1;
  const frac = Math.max(0, Math.min(1, (value - min) / span));

  const isCircular = CIRCULAR_STYLES.has(resolved);

  // ── Circular: 270° open-ring arc via two stroked circles ────────────────
  if (isCircular) {
    const progressDash = ARC_LEN * frac;
    const mergedClassName =
      [styles.circularWrap, className].filter(Boolean).join(" ") || undefined;
    return (
      <View ref={ref} as="div" className={mergedClassName} {...rest}>
        <svg
          className={styles.circular}
          viewBox="0 0 44 44"
          role="meter"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        >
          {/* track: full 270° arc, gap centered at the bottom (start rotated +135°) */}
          <circle
            cx={22}
            cy={22}
            r={R}
            className={styles.circularTrack}
            strokeDasharray={`${ARC_LEN} ${ARC_GAP}`}
            transform="rotate(135 22 22)"
          />
          {/* progress: same geometry, dash scaled by the value fraction */}
          <circle
            cx={22}
            cy={22}
            r={R}
            className={styles.circularProgress}
            strokeDasharray={`${progressDash} ${CIRCUMFERENCE - progressDash}`}
            transform="rotate(135 22 22)"
          />
          {typeof currentValueLabel === "string" ||
          typeof currentValueLabel === "number" ? (
            <text
              x={22}
              y={26}
              textAnchor="middle"
              className={styles.circularValue}
            >
              {currentValueLabel}
            </text>
          ) : null}
        </svg>
        {(label != null ||
          (currentValueLabel != null &&
            typeof currentValueLabel !== "string" &&
            typeof currentValueLabel !== "number")) && (
          <span className={styles.circularLabel}>
            {label}
            {typeof currentValueLabel !== "string" &&
            typeof currentValueLabel !== "number"
              ? currentValueLabel
              : null}
          </span>
        )}
      </View>
    );
  }

  // ── Linear: track with capacity fill OR indicator dot ───────────────────
  const isCapacity = CAPACITY_STYLES.has(resolved); // automatic/linear → indicator dot
  const mergedClassName =
    [styles.linearWrap, className].filter(Boolean).join(" ") || undefined;

  return (
    <View ref={ref} as="div" className={mergedClassName} {...rest}>
      {label != null && <span className={styles.linearTitle}>{label}</span>}
      <div className={styles.linearRow}>
        {minimumValueLabel != null && (
          <span className={styles.boundLabel}>{minimumValueLabel}</span>
        )}
        <div
          className={styles.linearTrack}
          role="meter"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        >
          {isCapacity ? (
            <div
              className={styles.linearFill}
              style={{ width: `${frac * 100}%` }}
            />
          ) : (
            <div
              className={styles.linearDot}
              style={{ left: `${frac * 100}%` }}
            />
          )}
          {markedValueLabels}
        </div>
        {maximumValueLabel != null && (
          <span className={styles.boundLabel}>{maximumValueLabel}</span>
        )}
      </div>
      {currentValueLabel != null && (
        <span className={styles.linearTitle}>{currentValueLabel}</span>
      )}
    </View>
  );
});

Gauge.displayName = "Gauge";
