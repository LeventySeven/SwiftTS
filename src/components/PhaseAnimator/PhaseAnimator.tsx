"use client";
/**
 * `PhaseAnimator` — `SwiftUICore.PhaseAnimator<Phase, Content>` (SwiftUICore :14178).
 *
 *   public struct PhaseAnimator<Phase, Content> where Phase : Equatable {
 *     // looping form — cycles forever on appear:
 *     public init(_ phases: some Sequence<Phase>,
 *                 content: @escaping (Phase) -> Content,
 *                 animation: @escaping (Phase) -> Animation? = { _ in .default })
 *     // triggered form — advances one step per `trigger` change:
 *     public init(_ phases: some Sequence<Phase>, trigger: some Equatable,
 *                 content: @escaping (Phase) -> Content,
 *                 animation: @escaping (Phase) -> Animation? = { _ in .default })
 *   }
 *
 * Two modes:
 *
 *   • NO trigger  → the LOOPING animator. On appear it walks `phases` in order,
 *     animating to each, and when it reaches the end it wraps back to the start
 *     and keeps going forever. (Used for idle/attention loops.)
 *
 *   • WITH trigger → the ONE-SHOT-per-event animator. It sits on phase[0]; each
 *     time `trigger` changes it advances to the next phase (wrapping), animating
 *     the transition. (Used for "pulse on tap".)
 *
 * The `content` closure receives the CURRENT phase value and returns the view for
 * that phase — the caller bakes the per-phase styling (scale, opacity, color…)
 * into what they render. `animation(phase)` returns the spring/curve used to
 * animate INTO that phase; we resolve it to a CSS `transition` string via
 * `transitionFor` from `animation.ts` and hand it to the caller so they can put
 * it on the animated element (also exposed on the second render-prop arg).
 *
 * Web mapping. A render-prop component holding a `phaseIndex`:
 *   - looping: a `setTimeout` chain advances the index every "settling" duration.
 *   - triggered: a `useEffect` on `trigger` advances the index by one.
 * The render-prop is `(phase, transition) => node`; `transition` is the CSS
 * transition string for the move INTO `phase`, ready to drop on `style`.
 *
 * SSR-safe: starts on `phases[0]`; the loop only arms inside an effect (post-mount).
 */
import * as React from "react";
import {
  transitionFor,
  resolveAnim,
  type AnimationToken,
} from "../../system/animation";
import { View, type ViewProps } from "../View";

export interface PhaseAnimatorProps<Phase> extends Omit<ViewProps, "children"> {
  /** The ordered phases to cycle through. Must be non-empty. */
  phases: readonly Phase[];
  /**
   * When provided, switches to TRIGGERED mode: each change of `trigger` advances
   * one phase. Omit for LOOPING mode (auto-cycles on appear).
   */
  trigger?: unknown;
  /**
   * The animation used to move INTO a given phase. Receives the phase being
   * entered; default `.default` spring for every phase. The resolved CSS
   * transition string is passed to `children` as the 2nd arg.
   */
  animation?: (phase: Phase) => AnimationToken | null;
  /** CSS `transition-property` the returned transition string targets. Default `"all"`. */
  animatedProperty?: string;
  /** Render-prop: `(currentPhase, cssTransition) => node`. */
  children: (phase: Phase, cssTransition: string) => React.ReactNode;
}

const DEFAULT_ANIM = (): AnimationToken => "default";

export function PhaseAnimator<Phase>({
  phases,
  trigger,
  animation,
  animatedProperty = "all",
  children,
  ...viewProps
}: PhaseAnimatorProps<Phase>): React.ReactElement {
  const [index, setIndex] = React.useState(0);
  const count = phases.length;
  const isLooping = trigger === undefined;

  const animFn = animation ?? DEFAULT_ANIM;

  // --- TRIGGERED mode: advance one phase whenever `trigger` changes ----------
  // Skip the very first run so we sit on phases[0] until the first real event.
  const firstTrigger = React.useRef(true);
  React.useEffect(() => {
    if (isLooping) return;
    if (firstTrigger.current) {
      firstTrigger.current = false;
      return;
    }
    setIndex((i) => (count === 0 ? 0 : (i + 1) % count));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  // --- LOOPING mode: chained timeouts walk phases forever on appear ----------
  React.useEffect(() => {
    if (!isLooping || count <= 1) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = (current: number) => {
      const next = (current + 1) % count;
      // Duration to DWELL on `current` before moving to `next` = the settling
      // time of the animation used to enter `next` (mirrors SwiftUI, which holds
      // a phase for the length of its transition).
      const tok = animFn(phases[next]) ?? "default";
      const settleMs = resolveAnim(tok).duration * 1000;
      timer = setTimeout(() => {
        if (cancelled) return;
        setIndex(next);
        scheduleNext(next);
      }, Math.max(16, settleMs));
    };
    scheduleNext(index);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // Re-arm the loop only when the phase set or looping-ness changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLooping, count]);

  const safeIndex = count === 0 ? 0 : index % count;
  const current = phases[safeIndex];
  const tok = (current !== undefined ? animFn(current) : null) ?? "default";
  const cssTransition = transitionFor(tok, animatedProperty);

  return (
    <View {...viewProps}>
      {current !== undefined ? children(current, cssTransition) : null}
    </View>
  );
}

PhaseAnimator.displayName = "PhaseAnimator";
