"use client";
/**
 * `<Slider>` — SwiftUI C3 value-input.
 * Mirrors `SwiftUI.Slider` (SwiftUI:3655): continuous (or stepped) value
 * selection by dragging a thumb along a track. Spec:
 * teardowns/SWIFTUI_C3_value-input.md §4.
 *
 *   Slider(value: $vol, in: 0...1)  ⇄  <Slider value={vol} onChange={setVol} bounds={[0,1]} />
 *
 * Built as an ARIA `role="slider"` div trio (track + fill + thumb) — NOT a
 * native `<input type=range>` — for pixel-1:1 thumb/track control (§4.4). Drag
 * uses Pointer Events with setPointerCapture; value is computed from clientX vs
 * the track's bounding rect, snapped to `step`. `data-animating` is false during
 * active drag (1:1) and true for tap-jumps / keyboard nudges.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import type { ViewModifierProps } from "../../system/modifiers";
import styles from "./Slider.module.css";

export interface SliderProps extends ViewModifierProps {
  /** ⇄ `value: Binding<V>` */
  value: number;
  onChange: (v: number) => void;
  /** ⇄ `in: ClosedRange` (default `[0,1]`) */
  bounds?: [number, number];
  /** ⇄ `step: V.Stride` (omit → continuous) */
  step?: number;
  /** ⇄ `onEditingChanged` — true on drag start, false on drag end */
  onEditingChanged?: (editing: boolean) => void;
  /** ⇄ `minimumValueLabel` (leading) */
  minimumValueLabel?: React.ReactNode;
  /** ⇄ `maximumValueLabel` (trailing) */
  maximumValueLabel?: React.ReactNode;
  /** ⇄ `label` (aria-label) */
  label?: string;
  /** ⇄ `neutralValue` (iOS26) — fill anchored here, not at min */
  neutralValue?: number;
  /** ⇄ `enabledBounds` (iOS26) — draggable sub-range inside bounds */
  enabledBounds?: [number, number];
  /** ⇄ `@SliderTickBuilder ticks` (iOS26) */
  ticks?: { value: number; label?: string }[];
  /** ⇄ `.disabled(_:)` */
  disabled?: boolean;
  /** macOS knob variant (⌀18 vs ⌀28) */
  variant?: "ios" | "macos";
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

function snap(v: number, lo: number, step?: number): number {
  if (!step || step <= 0) return v;
  return Math.round((v - lo) / step) * step + lo;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  function Slider(props, ref) {
    const {
      value,
      onChange,
      bounds = [0, 1],
      step,
      onEditingChanged,
      minimumValueLabel,
      maximumValueLabel,
      label,
      neutralValue,
      enabledBounds,
      ticks,
      disabled,
      variant,
      ...modifierProps
    } = props;

    const trackRef = React.useRef<HTMLDivElement | null>(null);
    const [dragging, setDragging] = React.useState(false);
    // false during active drag (1:1), true for taps / keyboard
    const [animating, setAnimating] = React.useState(false);

    const [lo, hi] = bounds;
    const span = hi - lo || 1;
    const [enLo, enHi] = enabledBounds ?? bounds;

    const clamped = clamp(value, lo, hi);
    const pct = ((clamped - lo) / span) * 100;

    // fill spans from neutralValue→value (or min→value when no neutral)
    const anchor = neutralValue != null ? clamp(neutralValue, lo, hi) : lo;
    const anchorPct = ((anchor - lo) / span) * 100;
    const fillLeft = Math.min(anchorPct, pct);
    const fillWidth = Math.abs(pct - anchorPct);

    const valueFromClientX = React.useCallback(
      (clientX: number): number => {
        const el = trackRef.current;
        if (!el) return clamped;
        const rect = el.getBoundingClientRect();
        const ratio =
          rect.width <= 0 ? 0 : clamp((clientX - rect.left) / rect.width, 0, 1);
        const raw = lo + ratio * span;
        return clamp(snap(raw, lo, step), enLo, enHi);
      },
      [clamped, lo, span, step, enLo, enHi],
    );

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      // tap-to-position animates; subsequent drag does not
      setAnimating(true);
      setDragging(true);
      onEditingChanged?.(true);
      const next = valueFromClientX(e.clientX);
      if (next !== value) onChange(next);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || disabled) return;
      // a real drag → kill animation so the thumb tracks 1:1
      if (animating) setAnimating(false);
      const next = valueFromClientX(e.clientX);
      if (next !== value) onChange(next);
    };

    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      setDragging(false);
      setAnimating(false);
      onEditingChanged?.(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const nudge = step && step > 0 ? step : span / 100;
      let next = value;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = value + (e.shiftKey ? nudge * 10 : nudge);
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = value - (e.shiftKey ? nudge * 10 : nudge);
          break;
        case "Home":
          next = enabledBounds ? enLo : lo;
          break;
        case "End":
          next = enabledBounds ? enHi : hi;
          break;
        default:
          return;
      }
      e.preventDefault();
      next = clamp(snap(next, lo, step), enLo, enHi);
      if (next !== value) {
        setAnimating(true);
        onChange(next);
      }
    };

    const viewProps = modifierProps as ViewProps;

    return (
      <View
        ref={ref as never}
        as="div"
        className={[styles.slider, variant === "macos" ? styles.macos : ""]
          .filter(Boolean)
          .join(" ")}
        data-disabled={!!disabled}
        data-animating={animating}
        {...viewProps}
      >
        {minimumValueLabel != null ? (
          <span className={styles.minlabel}>{minimumValueLabel}</span>
        ) : null}

        <div
          ref={trackRef}
          className={styles.track}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-valuemin={lo}
          aria-valuemax={hi}
          aria-valuenow={clamped}
          aria-label={label}
          aria-disabled={disabled || undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={handleKeyDown}
        >
          <div
            className={styles.fill}
            style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
          />
          {ticks?.map((t, i) => {
            const tp = ((clamp(t.value, lo, hi) - lo) / span) * 100;
            return (
              <div
                key={i}
                className={styles.tick}
                style={{ left: `${tp}%` }}
                aria-hidden="true"
              />
            );
          })}
          <div className={styles.thumb} style={{ left: `${pct}%` }} />
        </div>

        {maximumValueLabel != null ? (
          <span className={styles.maxlabel}>{maximumValueLabel}</span>
        ) : null}
      </View>
    );
  },
);

Slider.displayName = "Slider";
