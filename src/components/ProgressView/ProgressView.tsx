"use client";

/**
 * `<ProgressView>` — SwiftUI's progress indicator (C1 §8).
 *
 * Spec: teardowns/SWIFTUI_C1_content-primitives.md §8.
 *
 * The presence of `value` is the discriminator (mirrors the Swift inits):
 *   - no `value` (or `value == null`)  → **indeterminate circular spinner**
 *     (8 tapered spokes, continuous clockwise rotation, gray secondary-label).
 *   - `value` present                   → **determinate linear bar** (4pt
 *     capsule track, tint fill from leading to `value/total`, animated).
 *
 * `.progressViewStyle(.circular | .linear)` forces a style regardless of value,
 * inherited from the environment via `useResolvedStyle("progressView")`.
 *
 * Uses a hook → "use client".
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import {
  useResolvedStyle,
  type ProgressViewStyleName,
} from "../../system/styles";
import type { ControlSize } from "../../system/types";
import { useControlSize } from "../controls/controlMachinery";
import styles from "./ProgressView.module.css";

export interface ProgressViewProps extends Omit<ViewProps, "as" | "children"> {
  /** Current progress. Present → determinate bar; absent/`null` → spinner. */
  value?: number | null;
  /** Total (SwiftUI default 1.0). */
  total?: number;
  /** Optional title label (above the indicator). */
  label?: React.ReactNode;
  /** Optional current-value caption (below the bar). */
  currentValueLabel?: React.ReactNode;
  /** `.progressViewStyle(_:)` — overrides the inherited environment style. */
  progressViewStyle?: ProgressViewStyleName;
  /** `.controlSize(_:)` — scales the indeterminate spinner (mini→extraLarge). */
  controlSize?: ControlSize;
}

/** The 8 spokes of the indeterminate spinner (UIActivityIndicator clone). */
function Spinner({ size }: { size: ControlSize }): React.ReactElement {
  return (
    <div
      className={styles.spinner}
      data-control-size={size}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className={styles.spoke} />
      ))}
    </div>
  );
}

export const ProgressView = React.forwardRef<HTMLElement, ProgressViewProps>(
  function ProgressView(
    {
      value,
      total = 1,
      label,
      currentValueLabel,
      progressViewStyle,
      controlSize,
      className,
      ...rest
    },
    ref,
  ) {
    const resolved = useResolvedStyle("progressView", progressViewStyle);
    const size = useControlSize(controlSize);

    // Determinate iff a finite value is supplied AND the style isn't forced circular.
    const hasValue = value != null && Number.isFinite(value);
    const isLinear =
      resolved === "linear" || (resolved === "automatic" && hasValue);
    const isDeterminate = isLinear && hasValue;

    let indicator: React.ReactNode;
    if (isLinear) {
      const frac = hasValue
        ? Math.max(0, Math.min(1, value! / (total || 1)))
        : 0;
      indicator = (
        <div
          className={styles.linear}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={hasValue ? value! : undefined}
        >
          <div
            className={styles.linearFill}
            style={{ width: `${frac * 100}%` }}
          />
        </div>
      );
    } else {
      // indeterminate (or forced circular) → spinner
      indicator = <Spinner size={size} />;
    }

    const mergedClassName =
      [styles.container, className].filter(Boolean).join(" ") || undefined;

    return (
      <View
        ref={ref}
        as="div"
        className={mergedClassName}
        data-determinate={isDeterminate ? "true" : "false"}
        {...rest}
      >
        {label != null && <div className={styles.label}>{label}</div>}
        {indicator}
        {currentValueLabel != null && (
          <div className={styles.currentValueLabel}>{currentValueLabel}</div>
        )}
      </View>
    );
  },
);

ProgressView.displayName = "ProgressView";
