"use client";
/**
 * `<Stepper>` — SwiftUI C3 value-input.
 * Mirrors `SwiftUI.Stepper` (SwiftUI:19824): a `−`/`+` pair that
 * increments/decrements a bound value (or fires arbitrary callbacks). Spec:
 * teardowns/SWIFTUI_C3_value-input.md §5.
 *
 *   Stepper("Quantity", value: $qty, in: 0...10)
 *     ⇄  <Stepper label="Quantity" value={qty} onChange={setQty} bounds={[0,10]} />
 *
 * Press-and-hold auto-repeats (§5.3): first repeat after ~500ms, then ~120ms
 * intervals, cleared on pointerup/leave. Arrows auto-disable at the bounds, or
 * when their callback (`onIncrement`/`onDecrement`) is omitted in callback mode
 * (the SwiftUI `nil`-disables-that-arrow contract).
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import type { ViewModifierProps } from "../../system/modifiers";
import styles from "./Stepper.module.css";

export interface StepperProps extends ViewModifierProps {
  /** ⇄ `value: Binding<V>` (omit → pure callback mode) */
  value?: number;
  onChange?: (v: number) => void;
  /** ⇄ `step` (default 1) */
  step?: number;
  /** ⇄ `in: ClosedRange` — auto-disables arrows at the ends */
  bounds?: [number, number];
  /** ⇄ `label` / `titleKey` */
  label?: React.ReactNode;
  /** ⇄ `onIncrement` (omit in callback mode → disables `+`) */
  onIncrement?: () => void;
  /** ⇄ `onDecrement` (omit in callback mode → disables `−`) */
  onDecrement?: () => void;
  /** ⇄ `onEditingChanged` — true while an arrow is held, false on release */
  onEditingChanged?: (editing: boolean) => void;
  /** ⇄ `format:` — renders an adjacent value display */
  format?: (v: number) => string;
  /** DESIGNED — horizontal pill (iOS) vs stacked ▲▼ (macOS) */
  variant?: "ios" | "mac";
  /** ⇄ `.disabled(_:)` */
  disabled?: boolean;
}

const REPEAT_DELAY_MS = 500;
const REPEAT_INTERVAL_MS = 120;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

export const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  function Stepper(props, ref) {
    const {
      value,
      onChange,
      step = 1,
      bounds,
      label,
      onIncrement,
      onDecrement,
      onEditingChanged,
      format,
      variant = "ios",
      disabled,
      ...modifierProps
    } = props;

    // callback mode: value/onChange omitted, arrows driven by onIncrement/onDecrement
    const callbackMode = value == null;
    const [lo, hi] = bounds ?? [-Infinity, Infinity];

    const repeatDelay = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const repeatInterval = React.useRef<ReturnType<typeof setInterval> | null>(
      null,
    );
    // the direction currently being held (null = not holding)
    const heldDir = React.useRef<1 | -1 | null>(null);
    // a stable closure the interval calls; always reads the latest doStep
    const doStepRef = React.useRef<(dir: 1 | -1) => void>(() => {});

    const clearTimers = React.useCallback(() => {
      if (repeatDelay.current) clearTimeout(repeatDelay.current);
      if (repeatInterval.current) clearInterval(repeatInterval.current);
      repeatDelay.current = null;
      repeatInterval.current = null;
    }, []);

    React.useEffect(() => clearTimers, [clearTimers]);

    const canDecrement = callbackMode
      ? !!onDecrement
      : (value ?? 0) - step >= lo;
    const canIncrement = callbackMode
      ? !!onIncrement
      : (value ?? 0) + step <= hi;

    const doStep = React.useCallback(
      (dir: 1 | -1) => {
        if (callbackMode) {
          if (dir === 1) onIncrement?.();
          else onDecrement?.();
          return;
        }
        const next = clamp((value ?? 0) + dir * step, lo, hi);
        if (next !== value) onChange?.(next);
        // SwiftUI fires the user-provided arrow callbacks alongside the binding
        if (dir === 1) onIncrement?.();
        else onDecrement?.();
      },
      [callbackMode, value, step, lo, hi, onChange, onIncrement, onDecrement],
    );

    // keep the stable interval closure pointed at the freshest doStep so each
    // repeat reads the latest `value` (avoids a stale-closure off-by-one).
    doStepRef.current = doStep;

    const beginHold = (dir: 1 | -1) => {
      if (disabled) return;
      heldDir.current = dir;
      // immediate first step
      doStep(dir);
      onEditingChanged?.(true);
      repeatDelay.current = setTimeout(() => {
        repeatInterval.current = setInterval(() => {
          if (heldDir.current != null) doStepRef.current(heldDir.current);
        }, REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    };

    const endHold = () => {
      if (!repeatDelay.current && !repeatInterval.current) return;
      heldDir.current = null;
      clearTimers();
      onEditingChanged?.(false);
    };

    const viewProps = modifierProps as ViewProps;
    const stepperClass = [styles.stepper, variant === "mac" ? styles.mac : ""]
      .filter(Boolean)
      .join(" ");

    const minusGlyph = variant === "mac" ? "▼" : "−";
    const plusGlyph = variant === "mac" ? "▲" : "+";

    const holdHandlers = (dir: 1 | -1, enabled: boolean) => ({
      onPointerDown: (e: React.PointerEvent) => {
        if (!enabled || disabled) return;
        e.preventDefault();
        beginHold(dir);
      },
      onPointerUp: endHold,
      onPointerLeave: endHold,
      onPointerCancel: endHold,
      onKeyDown: (e: React.KeyboardEvent) => {
        if ((e.key === "Enter" || e.key === " ") && enabled && !disabled) {
          e.preventDefault();
          doStep(dir);
        }
      },
    });

    return (
      <View
        ref={ref as never}
        as="div"
        className={styles.row}
        data-disabled={!!disabled}
        {...viewProps}
      >
        {label != null ? <span className={styles.label}>{label}</span> : null}
        {format && value != null ? (
          <span className={styles.value} aria-hidden="true">
            {format(value)}
          </span>
        ) : null}
        <div
          className={stepperClass}
          role="group"
          aria-label={typeof label === "string" ? `${label} stepper` : "Stepper"}
        >
          <button
            type="button"
            className={styles.btn}
            aria-label="Decrement"
            disabled={disabled || !canDecrement}
            {...holdHandlers(-1, canDecrement)}
          >
            {minusGlyph}
          </button>
          <span className={styles.divider} aria-hidden="true" />
          <button
            type="button"
            className={styles.btn}
            aria-label="Increment"
            disabled={disabled || !canIncrement}
            {...holdHandlers(1, canIncrement)}
          >
            {plusGlyph}
          </button>
        </div>
      </View>
    );
  },
);

Stepper.displayName = "Stepper";
