"use client";
/**
 * `KeyframeAnimator` — `SwiftUICore.KeyframeAnimator<Value, KeyframePath, Content>`
 * (SwiftUICore :2379).
 *
 *   public struct KeyframeAnimator<Value, KeyframePath, Content> {
 *     // triggered: replays the keyframe path on each `trigger` change
 *     public init(initialValue: Value, trigger: some Equatable,
 *                 content: @escaping (Value) -> Content,
 *                 keyframes: @escaping (Value) -> KeyframePath)
 *     // repeating: loops the keyframe path forever on appear
 *     public init(initialValue: Value, repeating: Bool = true,
 *                 content: @escaping (Value) -> Content,
 *                 keyframes: @escaping (Value) -> KeyframePath)
 *   }
 *
 * `KeyframeAnimator` drives a `Value` through a timeline of KEYFRAMES and hands the
 * interpolated value to `content` on every frame. Unlike `PhaseAnimator` (which
 * snaps between discrete states with a single spring), keyframes give you precise,
 * multi-segment control: each segment has its own duration + curve, and segments
 * can overlap tracks of a multi-field value.
 *
 * SwiftUI keyframe kinds (SwiftUICore :14109–14164):
 *   LinearKeyframe(to, duration, timingCurve)   → lerp with a unit curve
 *   CubicKeyframe(to, duration)                 → Catmull-Rom-style smooth (≈ ease)
 *   SpringKeyframe(to, duration, spring)        → spring toward `to`
 *   MoveKeyframe(to)                            → instantaneous jump (0 duration)
 *
 * Web mapping. We implement a small `requestAnimationFrame` interpolator. `Value`
 * may be a `number` OR a flat `Record<string, number>` (a multi-field animatable,
 * the web analogue of SwiftUI's `Animatable` vector decomposition). Each keyframe
 * names a target value, a duration (seconds), and a curve; the interpolator walks
 * wall-clock time across the segments, easing within each, and calls `setValue`.
 *
 * Modes mirror SwiftUI:
 *   - `trigger` supplied → replay from `initialValue` on each trigger change.
 *   - `repeating` (default true when no trigger) → loop forever on appear.
 *
 * SSR-safe: renders `initialValue` on the server / first paint; the rAF loop only
 * starts inside an effect post-mount. Wraps `content` in `<View>` so modifier props
 * apply to the animated container.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";

/** Values we can interpolate: a scalar, or a flat map of named scalars. */
export type KeyframeValue = number | Record<string, number>;

/** Easing for a Linear/Cubic keyframe segment. */
export type KeyframeCurve =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | ((t: number) => number);

/** One keyframe segment (mirrors Linear/Cubic/Spring/Move keyframes). */
export interface Keyframe<Value extends KeyframeValue> {
  /** Segment kind. `move` is instantaneous (duration ignored). */
  kind?: "linear" | "cubic" | "spring" | "move";
  /** Target value at the END of this segment. */
  to: Value;
  /** Segment length in SECONDS (ignored for `move`). Default 0.25. */
  duration?: number;
  /** Easing within the segment (linear/cubic). `spring` uses a critically-ish damped curve. */
  curve?: KeyframeCurve;
}

export interface KeyframeAnimatorProps<Value extends KeyframeValue>
  extends Omit<ViewProps, "children"> {
  /** The starting value (the value before the first keyframe runs). */
  initialValue: Value;
  /** The ordered keyframe segments to drive `initialValue` through. */
  keyframes: ReadonlyArray<Keyframe<Value>>;
  /**
   * When provided, replays the keyframe timeline on each change of `trigger`.
   * Omit + leave `repeating` default → loops forever on appear.
   */
  trigger?: unknown;
  /** Loop the timeline forever (only when `trigger` is absent). Default `true`. */
  repeating?: boolean;
  /** Render-prop: receives the current interpolated value every frame. */
  children: (value: Value) => React.ReactNode;
}

/* -------------------------------------------------------------------------- */
/* Easing                                                                      */
/* -------------------------------------------------------------------------- */

const EASES: Record<string, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

function easeFn(curve: KeyframeCurve | undefined, kind: Keyframe<KeyframeValue>["kind"]): (t: number) => number {
  if (typeof curve === "function") return curve;
  if (curve && EASES[curve]) return EASES[curve];
  // Defaults by kind: cubic/spring read smoother than linear.
  if (kind === "cubic" || kind === "spring") return EASES.easeInOut;
  return EASES.linear;
}

/* -------------------------------------------------------------------------- */
/* Value interpolation (scalar OR flat record)                                 */
/* -------------------------------------------------------------------------- */

function lerpValue<Value extends KeyframeValue>(from: Value, to: Value, t: number): Value {
  if (typeof from === "number" && typeof to === "number") {
    return (from + (to - from) * t) as Value;
  }
  const out: Record<string, number> = {};
  const a = from as Record<string, number>;
  const b = to as Record<string, number>;
  for (const k in b) {
    const av = a[k] ?? b[k];
    out[k] = av + (b[k] - av) * t;
  }
  // keep any keys present only in `from`
  for (const k in a) if (!(k in out)) out[k] = a[k];
  return out as Value;
}

export function KeyframeAnimator<Value extends KeyframeValue>({
  initialValue,
  keyframes,
  trigger,
  repeating = true,
  children,
  ...viewProps
}: KeyframeAnimatorProps<Value>): React.ReactElement {
  const [value, setValue] = React.useState<Value>(initialValue);

  // Total timeline duration (seconds); `move` segments contribute 0.
  const totalDuration = React.useMemo(
    () =>
      keyframes.reduce(
        (sum, kf) => sum + (kf.kind === "move" ? 0 : kf.duration ?? 0.25),
        0,
      ),
    [keyframes],
  );

  const isLooping = trigger === undefined && repeating;

  // Re-arm the rAF run when the timeline replays: on mount (always), on each
  // `trigger` change, and whenever the keyframe set changes.
  React.useEffect(() => {
    if (keyframes.length === 0 || totalDuration <= 0) {
      setValue(initialValue);
      return;
    }

    let raf = 0;
    let start = 0;
    let cancelled = false;

    const sample = (elapsedS: number): Value => {
      // Walk segments accumulating time until `elapsedS` lands inside one.
      let from: Value = initialValue;
      let acc = 0;
      for (const kf of keyframes) {
        const dur = kf.kind === "move" ? 0 : kf.duration ?? 0.25;
        if (kf.kind === "move" || dur === 0) {
          // instantaneous jump
          if (elapsedS <= acc) return from;
          from = kf.to;
          continue;
        }
        if (elapsedS <= acc + dur) {
          const localT = (elapsedS - acc) / dur;
          const eased = easeFn(kf.curve, kf.kind)(Math.min(1, Math.max(0, localT)));
          return lerpValue(from, kf.to, eased);
        }
        acc += dur;
        from = kf.to;
      }
      return from; // past the end → final value
    };

    const tick = (now: number) => {
      if (cancelled) return;
      if (start === 0) start = now;
      const elapsedS = (now - start) / 1000;

      if (elapsedS >= totalDuration) {
        if (isLooping) {
          start = now; // restart the loop
          setValue(sample(0));
        } else {
          setValue(sample(totalDuration)); // settle on the last keyframe
          return; // stop the loop
        }
      } else {
        setValue(sample(elapsedS));
      }
      raf = requestAnimationFrame(tick);
    };

    setValue(initialValue);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, keyframes, totalDuration, isLooping]);

  return <View {...viewProps}>{children(value)}</View>;
}

KeyframeAnimator.displayName = "KeyframeAnimator";
