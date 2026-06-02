"use client";
/**
 * SwiftUI's animation + transition engine, ported to the web.
 *
 * Maps SwiftUI's `Animation` value model (spring presets + legacy timing curves)
 * onto CSS transitions/keyframes, and SwiftUI's `AnyTransition` insert/remove model
 * onto a mount/unmount class-based transition (CSS can't run an exit animation on an
 * already-unmounted element, so a presence wrapper keeps a removed node mounted until
 * its removal transition ends — the hand-rolled FLIP/Framer-Motion pattern).
 *
 * Spec: teardowns/SWIFTUI_C11_animation-transitions.md. Easings are the exact
 * damped-spring `linear()` tables baked into src/tokens/variables.css as
 * `--sui-anim-<name>-css`; they are NOT re-derived here. The JS spring solver
 * (`springToLinear` / `settlingDuration`) exists only to sample *runtime-constructed*
 * springs (`spring(duration:bounce:)`) that have no precomputed token.
 *
 * Every easing reference below uses the EXACT token var names. Never hardcode a
 * `linear(...)`/`cubic-bezier(...)` for a preset — reference its var.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useEnvironment } from "./environment";

// Re-export the <Transition> presence component (lives in a .tsx sibling because it
// renders JSX) so the whole animation/transition surface is importable from one place.
export { Transition } from "./Transition";
export type { TransitionProps } from "./Transition";

/* ===========================================================================
 * 1. Animation token model (§3 of the spec)
 * ======================================================================== */

/** The named SwiftUI presets. Springs settle (linear() over settling time);
 *  curves use a cubic-bezier over a fixed 0.35s. */
export type SpringPresetName =
  | "smooth"
  | "snappy"
  | "bouncy"
  | "spring"
  | "interactiveSpring";

export type CurvePresetName = "easeInOut" | "easeIn" | "easeOut" | "linear";

/** A SwiftUI `Animation` value, mirrored idiomatically. A bare string is a preset;
 *  the object forms mirror `spring(duration:bounce:)`, `interpolatingSpring(...)`,
 *  `timingCurve(...)`, the explicit-duration curve forms, and the chainable
 *  `.speed/.delay/.repeatCount/.repeatForever` wrappers. */
export type AnimationToken =
  | "default"
  | SpringPresetName
  | CurvePresetName
  | { kind: "spring"; duration: number; bounce: number; blend?: number }
  | {
      kind: "interpolatingSpring";
      duration?: number;
      bounce?: number;
      mass?: number;
      stiffness?: number;
      damping?: number;
      initialVelocity?: number;
    }
  | {
      kind: "timingCurve";
      p1x: number;
      p1y: number;
      p2x: number;
      p2y: number;
      duration?: number;
    }
  | { kind: CurvePresetName; duration: number }
  | {
      base: AnimationToken;
      speed?: number;
      delay?: number;
      repeat?: number | "forever";
      autoreverses?: boolean;
    };

/** A resolved animation: everything needed to emit a CSS `transition`/`animation`. */
export interface ResolvedAnim {
  kind: "spring" | "curve";
  /** Wall-clock seconds — settling time for springs, duration for curves. */
  duration: number;
  /** A `linear(...)`/`cubic-bezier(...)` string OR a `var(--sui-anim-*)` reference. */
  easing: string;
  /** Seconds of lead-in hold (`.delay`). */
  delay: number;
  iteration: number | "infinite";
  direction: "normal" | "alternate";
}

/* --- Easing/duration token references (EXACT var names from variables.css) --- */

/** `var(--sui-anim-<name>-css)` — the precomputed damped-spring `linear()` table. */
function springEasingVar(name: SpringPresetName | "default" | "smooth"): string {
  return `var(--sui-anim-${name}-css)`;
}
/** `var(--sui-anim-<name>-duration)` — settling time as a CSS `<time>` (e.g. `0.735s`). */
function springDurationVar(name: SpringPresetName | "default"): string {
  return `var(--sui-anim-${name}-duration)`;
}

/** Settling durations in seconds — KNOWN constants (= the `--sui-anim-*-duration` vars).
 *  Kept numeric here so JS timers (`useMountTransition`, completion callbacks) have a
 *  fallback when `getComputedStyle` is unavailable (SSR / first paint). */
const SPRING_SETTLING_S: Record<SpringPresetName | "default", number> = {
  smooth: 0.735,
  snappy: 0.697,
  bouncy: 0.819,
  spring: 0.689,
  interactiveSpring: 0.21,
  default: 0.735,
};

/** Legacy curve duration — KNOWN baked default = `--sui-anim-curve-duration` (0.35s). */
const CURVE_DURATION_S = 0.35;

/** Curve cubic-beziers as token var references (variables.css §legacy timing curves).
 *  `.linear` resolves to the literal `linear` keyword, never CSS's `ease`. */
const CURVE_EASING_VAR: Record<CurvePresetName, string> = {
  easeInOut: "var(--sui-anim-easeInOut)",
  easeIn: "var(--sui-anim-easeIn)",
  easeOut: "var(--sui-anim-easeOut)",
  linear: "var(--sui-anim-linear)",
};

const SPRING_PRESETS: ReadonlyArray<SpringPresetName | "default"> = [
  "default",
  "smooth",
  "snappy",
  "bouncy",
  "spring",
  "interactiveSpring",
];

const PRESETS: Record<string, ResolvedAnim> = {
  default: {
    kind: "spring",
    duration: SPRING_SETTLING_S.default,
    easing: springEasingVar("default"),
    delay: 0,
    iteration: 1,
    direction: "normal",
  },
  smooth: {
    kind: "spring",
    duration: SPRING_SETTLING_S.smooth,
    easing: springEasingVar("smooth"),
    delay: 0,
    iteration: 1,
    direction: "normal",
  },
  snappy: {
    kind: "spring",
    duration: SPRING_SETTLING_S.snappy,
    easing: springEasingVar("snappy"),
    delay: 0,
    iteration: 1,
    direction: "normal",
  },
  bouncy: {
    kind: "spring",
    duration: SPRING_SETTLING_S.bouncy,
    easing: springEasingVar("bouncy"),
    delay: 0,
    iteration: 1,
    direction: "normal",
  },
  spring: {
    kind: "spring",
    duration: SPRING_SETTLING_S.spring,
    easing: springEasingVar("spring"),
    delay: 0,
    iteration: 1,
    direction: "normal",
  },
  interactiveSpring: {
    kind: "spring",
    duration: SPRING_SETTLING_S.interactiveSpring,
    easing: springEasingVar("interactiveSpring"),
    delay: 0,
    iteration: 1,
    direction: "normal",
  },
  easeInOut: {
    kind: "curve",
    duration: CURVE_DURATION_S,
    easing: CURVE_EASING_VAR.easeInOut,
    delay: 0,
    iteration: 1,
    direction: "normal",
  },
  easeIn: {
    kind: "curve",
    duration: CURVE_DURATION_S,
    easing: CURVE_EASING_VAR.easeIn,
    delay: 0,
    iteration: 1,
    direction: "normal",
  },
  easeOut: {
    kind: "curve",
    duration: CURVE_DURATION_S,
    easing: CURVE_EASING_VAR.easeOut,
    delay: 0,
    iteration: 1,
    direction: "normal",
  },
  linear: {
    kind: "curve",
    duration: CURVE_DURATION_S,
    easing: CURVE_EASING_VAR.linear,
    delay: 0,
    iteration: 1,
    direction: "normal",
  },
};

/* ===========================================================================
 * 2. The spring solver (§2 of the spec) — only for runtime-constructed springs
 * ======================================================================== */

export interface SpringParams {
  mass: number;
  stiffness: number;
  damping: number;
}

/** `Spring(duration:bounce:)` → physics. k=(2π/dur)², ζ=1−bounce, c=2√k·ζ, mass 1. */
export function springFromDurationBounce(duration = 0.5, bounce = 0): SpringParams {
  const k = Math.pow((2 * Math.PI) / duration, 2);
  const zeta = 1 - bounce;
  const c = 2 * Math.sqrt(k) * zeta;
  return { mass: 1, stiffness: k, damping: c };
}

/** `Spring(response:dampingRatio:)` → physics (UIKit-classic form). */
export function springFromResponseDamping(
  response: number,
  dampingFraction: number,
): SpringParams {
  const k = Math.pow((2 * Math.PI) / response, 2);
  return { mass: 1, stiffness: k, damping: 2 * Math.sqrt(k) * dampingFraction };
}

/** Settling time: when the e^(−ζ·wn·t) envelope decays below `epsilon`. */
export function settlingDuration(
  { mass, stiffness, damping }: SpringParams,
  epsilon = 0.001,
): number {
  const wn = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta >= 1) {
    // critically/over-damped: envelope governed by the slower real pole.
    const root = Math.sqrt(Math.max(zeta * zeta - 1, 0));
    const slow = wn * (zeta - root);
    return slow > 1e-6 ? -Math.log(epsilon) / slow : 4 / (zeta * wn);
  }
  return -Math.log(epsilon) / (zeta * wn);
}

/**
 * Sample the unit-step response into a CSS `linear(...)` timing function via
 * semi-implicit Euler — the JS port of SwiftUI's
 * `Spring.update(value:velocity:target:deltaTime:)`. Used ONLY for springs the
 * caller constructs at runtime; the five named presets use their baked `--sui-anim-*-css`
 * token instead (integrated at higher precision).
 */
export function springToLinear(
  p: SpringParams,
  settling: number,
  samples = 24,
): string {
  const dt = 1 / 240;
  let x = 0;
  let v = 0; // target = 1
  const pts: string[] = ["0"];
  const sampleTimes = Array.from(
    { length: samples - 1 },
    (_, i) => ((i + 1) / (samples - 1)) * settling,
  );
  let si = 0;
  for (let t = 0; t <= settling + dt; t += dt) {
    const a = (p.stiffness * (1 - x) - p.damping * v) / p.mass;
    v += a * dt;
    x += v * dt;
    while (si < sampleTimes.length && t >= sampleTimes[si]) {
      const pct = ((sampleTimes[si] / settling) * 100).toFixed(1);
      pts.push(si === sampleTimes.length - 1 ? "1" : `${x.toFixed(4)} ${pct}%`);
      si++;
    }
  }
  return `linear(${pts.join(", ")})`;
}

/* ===========================================================================
 * 3. Resolve an AnimationToken → ResolvedAnim
 * ======================================================================== */

function isSpringPresetName(s: string): s is SpringPresetName | "default" {
  return (SPRING_PRESETS as ReadonlyArray<string>).includes(s);
}

export function resolveAnim(tok: AnimationToken): ResolvedAnim {
  if (typeof tok === "string") return { ...PRESETS[tok] };
  if ("base" in tok) {
    const r = resolveAnim(tok.base);
    if (tok.speed) r.duration /= tok.speed;
    if (tok.delay) r.delay = tok.delay;
    if (tok.repeat === "forever") {
      r.iteration = "infinite";
      r.direction = tok.autoreverses === false ? "normal" : "alternate";
    } else if (typeof tok.repeat === "number") {
      r.iteration = tok.repeat;
      r.direction = tok.autoreverses === false ? "normal" : "alternate";
    }
    return r;
  }
  if (tok.kind === "spring") {
    const p = springFromDurationBounce(tok.duration, tok.bounce);
    const s = settlingDuration(p);
    return {
      kind: "spring",
      duration: s,
      easing: springToLinear(p, s),
      delay: 0,
      iteration: 1,
      direction: "normal",
    };
  }
  if (tok.kind === "interpolatingSpring") {
    const p =
      tok.stiffness != null
        ? { mass: tok.mass ?? 1, stiffness: tok.stiffness, damping: tok.damping ?? 0 }
        : springFromDurationBounce(tok.duration ?? 0.5, tok.bounce ?? 0);
    const s = settlingDuration(p);
    return {
      kind: "spring",
      duration: s,
      easing: springToLinear(p, s),
      delay: 0,
      iteration: 1,
      direction: "normal",
    };
  }
  if (tok.kind === "timingCurve") {
    return {
      kind: "curve",
      duration: tok.duration ?? CURVE_DURATION_S,
      easing: `cubic-bezier(${tok.p1x}, ${tok.p1y}, ${tok.p2x}, ${tok.p2y})`,
      delay: 0,
      iteration: 1,
      direction: "normal",
    };
  }
  // explicit-duration curve form: { kind: "easeInOut" | ..., duration }
  return { ...PRESETS[tok.kind], duration: tok.duration };
}

/* ===========================================================================
 * 4. springCss / animationCss — emit CSS transition strings (the task API)
 * ======================================================================== */

/** Overrides for `springCss`. `property` defaults to `all`. */
export interface SpringCssOverrides {
  /** The transitioned property (CSS `transition-property`). Default `"all"`. */
  property?: string;
  /** Override the settling duration, in seconds. */
  durationS?: number;
  /** Lead-in delay, in seconds. */
  delayS?: number;
}

/**
 * The CSS `transition` string for a named spring preset, built from the EXACT
 * tokens: `var(--sui-anim-<name>-duration)` + `var(--sui-anim-<name>-css)`.
 *
 *   springCss("bouncy")
 *     → "all var(--sui-anim-bouncy-duration) var(--sui-anim-bouncy-css) 0s"
 *
 * Pass overrides to scope the property or override duration/delay numerically.
 */
export function springCss(
  name: SpringPresetName | "default" | "smooth" = "default",
  overrides: SpringCssOverrides = {},
): string {
  const property = overrides.property ?? "all";
  const duration =
    overrides.durationS != null
      ? `${overrides.durationS}s`
      : springDurationVar(name === "smooth" ? "smooth" : name);
  const easing = springEasingVar(name);
  const delay = `${overrides.delayS ?? 0}s`;
  return `${property} ${duration} ${easing} ${delay}`;
}

/**
 * The CSS `transition` string for a legacy timing curve over an explicit duration.
 *
 *   animationCss("easeInOut", 350)
 *     → "all 0.35s var(--sui-anim-easeInOut) 0s"
 *
 * `curve` is one of the four legacy presets (resolved to its `--sui-anim-*` var) OR a
 * raw timing-function string (a `cubic-bezier(...)`/`linear(...)` you've already built).
 */
export function animationCss(
  curve: CurvePresetName | string = "easeInOut",
  durationMs = CURVE_DURATION_S * 1000,
  options: { property?: string; delayMs?: number } = {},
): string {
  const property = options.property ?? "all";
  const easing =
    (CURVE_EASING_VAR as Record<string, string>)[curve] ?? curve;
  const delayMs = options.delayMs ?? 0;
  return `${property} ${durationMs / 1000}s ${easing} ${delayMs / 1000}s`;
}

/** A general `transition` string for ANY resolved AnimationToken (springs + curves). */
export function transitionFor(
  anim: AnimationToken,
  property = "all",
): string {
  const r = resolveAnim(anim);
  return `${property} ${r.duration}s ${r.easing} ${r.delay}s`;
}

/* ===========================================================================
 * 5. transitionStyles — preset AnyTransition insert/remove states (§4)
 * ======================================================================== */

/** The transition presets that have a self-contained CSS recipe (§4.3/§4.4).
 *  `asymmetric` here uses the default SwiftUI pairing (insert opacity, remove opacity);
 *  callers wanting distinct in/out wire two `transitionStyles` calls themselves. */
export type TransitionPresetName =
  | "opacity"
  | "slide"
  | "scale"
  | "move"
  | "push"
  | "blurReplace"
  | "asymmetric";

/**
 * The four CSS rule fragments for a class-based mount/unmount transition, named
 * after the react-transition-group convention so they map cleanly onto
 * `useMountTransition`'s emitted classes:
 *   - `enter`        → the off-screen "willAppear" state applied at mount
 *   - `enterActive`  → the settled "identity" state animated TO on insert
 *   - `exit`         → the "identity" state held at the start of removal
 *   - `exitActive`   → the off-screen "didDisappear" state animated TO on remove
 *
 * Each value is a CSS declaration block body (no selector, no braces) so a caller
 * can drop it into a styled rule or apply it as inline style text. The animation
 * timing (duration/easing) is NOT baked in here — it comes from the in-scope
 * AnimationToken via `useMountTransition`, mirroring SwiftUI (a transition has no
 * intrinsic duration; it inherits the driving animation).
 */
export interface TransitionStyleSet {
  enter: string;
  enterActive: string;
  exit: string;
  exitActive: string;
}

/** `Edge` → the translate that pushes a node fully off-screen toward that edge. */
function edgeTranslate(edge: "top" | "bottom" | "leading" | "trailing", amt: string): string {
  switch (edge) {
    case "top":
      return `translateY(-${amt})`;
    case "bottom":
      return `translateY(${amt})`;
    case "leading":
      return `translateX(-${amt})`;
    case "trailing":
      return `translateX(${amt})`;
  }
}

export interface TransitionStylesOptions {
  /** For `move`/`push` — which edge the node enters from / exits toward. Default `leading`. */
  edge?: "top" | "bottom" | "leading" | "trailing";
  /** For `scale` — the from-scale (default 0.00001, matching `.scale` = `ScaleTransition(1e-5)`). */
  scale?: number;
  /** For `blurReplace` — config; only `downUp` is implemented as a recipe. */
  blurConfig?: "downUp" | "upUp";
}

/**
 * The insert/remove CSS for a preset transition (§4.3). Returns the four-class set.
 * Timing is layered on by `useMountTransition`; these values describe only the
 * geometry/opacity/filter of the from↔identity states.
 */
export function transitionStyles(
  name: TransitionPresetName,
  options: TransitionStylesOptions = {},
): TransitionStyleSet {
  const edge = options.edge ?? "leading";

  switch (name) {
    case "opacity": {
      return {
        enter: "opacity: 0;",
        enterActive: "opacity: 1;",
        exit: "opacity: 1;",
        exitActive: "opacity: 0;",
      };
    }
    case "scale": {
      // `.scale` zero-arg = ScaleTransition(1e-5) — scale from 0.00001, origin center.
      const from = options.scale ?? 0.00001;
      return {
        enter: `transform: scale(${from}); transform-origin: center;`,
        enterActive: "transform: scale(1); transform-origin: center;",
        exit: "transform: scale(1); transform-origin: center;",
        exitActive: `transform: scale(${from}); transform-origin: center;`,
      };
    }
    case "slide": {
      // SlideTransition = asymmetric(insertion: move(.leading), removal: move(.trailing)).
      return {
        enter: "transform: translateX(-100%);",
        enterActive: "transform: translateX(0);",
        exit: "transform: translateX(0);",
        exitActive: "transform: translateX(100%);",
      };
    }
    case "move": {
      const off = edgeTranslate(edge, "100%");
      return {
        enter: `transform: ${off};`,
        enterActive: "transform: translate(0, 0);",
        exit: "transform: translate(0, 0);",
        exitActive: `transform: ${off};`,
      };
    }
    case "push": {
      // Single-layer approximation of the coupled push: incoming slides in from the
      // edge + fades; outgoing slides out the opposite way + fades. (Full coupling
      // needs a two-layer host; this is the per-node share.)
      const inOff = edgeTranslate(edge, "100%");
      const outEdge =
        edge === "leading"
          ? "trailing"
          : edge === "trailing"
            ? "leading"
            : edge === "top"
              ? "bottom"
              : "top";
      const outOff = edgeTranslate(outEdge, "100%");
      return {
        enter: `transform: ${inOff}; opacity: 0;`,
        enterActive: "transform: translate(0, 0); opacity: 1;",
        exit: "transform: translate(0, 0); opacity: 1;",
        exitActive: `transform: ${outOff}; opacity: 0;`,
      };
    }
    case "blurReplace": {
      // .downUp (default): outgoing moves down + blurs out; incoming comes up + blurs in.
      return {
        enter: "opacity: 0; filter: blur(8px); transform: translateY(-6px);",
        enterActive: "opacity: 1; filter: blur(0); transform: translateY(0);",
        exit: "opacity: 1; filter: blur(0); transform: translateY(0);",
        exitActive: "opacity: 0; filter: blur(6px); transform: translateY(6px);",
      };
    }
    case "asymmetric": {
      // Default symmetric fallback (opacity in/out). For true asymmetry, compose two
      // transitionStyles() results and pick enter* from one, exit* from the other.
      return {
        enter: "opacity: 0;",
        enterActive: "opacity: 1;",
        exit: "opacity: 1;",
        exitActive: "opacity: 0;",
      };
    }
  }
}

/** Parse a `"prop: val; prop2: val2;"` declaration block into a React style object. */
export function declBlockToStyle(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of block.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const rawProp = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (!rawProp || !value) continue;
    // kebab-case → camelCase for React inline styles
    const prop = rawProp.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[prop] = value;
  }
  return out;
}

/* ===========================================================================
 * 6. The transaction model: withAnimation + useAnimation (§1)
 * ======================================================================== */

/**
 * A module-level "current transaction", mirroring SwiftUI's thread-local
 * Transaction. `withAnimation` stamps it; `useAnimation` reads it. Because React
 * batches state updates synchronously within an event, a `setState` issued inside
 * `withAnimation(anim, () => …)` runs while this flag is set, so the animatable
 * read picks up `anim` for exactly that flush.
 */
let CURRENT_TXN: { animation: AnimationToken | null } | null = null;

/** SwiftUI `withAnimation(_:_:)`: run `body`, with `animation` as the in-scope
 *  transaction. Pass `null` to disable animation for the mutations inside `body`. */
export function withAnimation<T>(
  animation: AnimationToken | null,
  body: () => T,
): T;
export function withAnimation<T>(body: () => T): T;
export function withAnimation<T>(
  a: AnimationToken | null | (() => T),
  b?: () => T,
): T {
  const animation: AnimationToken | null = typeof a === "function" ? "default" : a;
  const body = (typeof a === "function" ? a : b) as () => T;
  const prev = CURRENT_TXN;
  CURRENT_TXN = { animation };
  try {
    return body();
  } finally {
    // Restore AFTER React has captured the flag in this synchronous tick.
    if (typeof queueMicrotask === "function") {
      queueMicrotask(() => {
        CURRENT_TXN = prev;
      });
    } else {
      CURRENT_TXN = prev;
    }
  }
}

/** The animation present in the current transaction (null if none / animation disabled). */
export function currentTxnAnimation(): AnimationToken | null {
  return CURRENT_TXN ? CURRENT_TXN.animation : null;
}

/* --- Transaction context (the React-visible inherited transaction, §1.3) --- */

export interface Txn {
  animation: AnimationToken | null;
  disablesAnimations: boolean;
}

const DEFAULT_TXN: Txn = { animation: "default", disablesAnimations: false };

/** The React-visible inherited transaction (SwiftUI `.transaction`). A provider can
 *  override `animation`/`disablesAnimations` for a subtree. */
export const TxnContext = createContext<Txn>(DEFAULT_TXN);

/**
 * `useAnimation()` — resolve the animation to use right now, honoring precedence:
 *   explicit token  >  in-scope withAnimation()  >  inherited .transaction()  > "default".
 *
 * Also returns the `withAnimation` helper (so a component can both READ the in-scope
 * animation and drive a state change with one), and `resolve()` to turn any token into
 * a `ResolvedAnim`/CSS string. Honors `useEnvironment().reduceMotion`: when reduce-motion
 * is on, every resolution collapses to a ≤0.15s linear opacity-only fade.
 */
export interface UseAnimationResult {
  /** The currently in-scope animation token (explicit > withAnimation > inherited). */
  animation: AnimationToken | null;
  /** True when the environment requests reduced motion. */
  reduceMotion: boolean;
  /** Resolve a token (or the in-scope one) to a ResolvedAnim, reduce-motion applied. */
  resolve: (tok?: AnimationToken | null) => ResolvedAnim | null;
  /** A `transition` CSS string for `tok` (or in-scope), reduce-motion applied. */
  css: (tok?: AnimationToken | null, property?: string) => string;
  /** SwiftUI `withAnimation` bound for convenience. */
  withAnimation: typeof withAnimation;
}

/** The reduce-motion floor: a quick linear fade, transforms dropped (§10.1). */
const REDUCED_MOTION_ANIM: ResolvedAnim = {
  kind: "curve",
  duration: 0.15,
  easing: "linear",
  delay: 0,
  iteration: 1,
  direction: "normal",
};

export function useAnimation(explicit?: AnimationToken | null): UseAnimationResult {
  const env = useEnvironment();
  const inherited = useContext(TxnContext);

  const animation: AnimationToken | null =
    explicit !== undefined
      ? explicit
      : (currentTxnAnimation() ?? inherited.animation);

  const reduceMotion = env.reduceMotion;

  const resolve = useCallback(
    (tok?: AnimationToken | null): ResolvedAnim | null => {
      const t = tok !== undefined ? tok : animation;
      if (t == null || inherited.disablesAnimations) return null;
      if (reduceMotion) return { ...REDUCED_MOTION_ANIM };
      return resolveAnim(t);
    },
    [animation, reduceMotion, inherited.disablesAnimations],
  );

  const css = useCallback(
    (tok?: AnimationToken | null, property = "all"): string => {
      const r = resolve(tok);
      if (!r) return "none";
      // Under reduce-motion, only opacity should transition (transforms dropped).
      const prop = reduceMotion ? "opacity" : property;
      return `${prop} ${r.duration}s ${r.easing} ${r.delay}s`;
    },
    [resolve, reduceMotion],
  );

  return { animation, reduceMotion, resolve, css, withAnimation };
}

/* ===========================================================================
 * 7. useMountTransition + <Transition> — class-based mount/unmount (§4.5)
 * ======================================================================== */

/** The lifecycle state of a mount transition. */
export type MountTransitionState =
  | "entering"
  | "entered"
  | "exiting"
  | "exited";

export interface UseMountTransitionOptions {
  /** Which preset transition to play. Default `"opacity"` (SwiftUI's default). */
  transition?: TransitionPresetName;
  /** The driving animation. Default `"default"` (.smooth spring on iOS17+). */
  animation?: AnimationToken | null;
  /** Options forwarded to `transitionStyles` (edge/scale/blurConfig). */
  transitionOptions?: TransitionStylesOptions;
  /** Fired once the exit transition completes and the node may unmount. */
  onExited?: () => void;
  /** Fired once the enter transition completes. */
  onEntered?: () => void;
}

export interface MountTransitionResult {
  /** True while the node should remain in the DOM (covers the exiting tail). */
  mounted: boolean;
  /** Current lifecycle phase. */
  state: MountTransitionState;
  /** The CSS `transition` shorthand to apply to the node. */
  transition: string;
  /** The inline style for the node's CURRENT phase (from/identity geometry). */
  style: Record<string, string>;
  /** Whether the environment requested reduced motion (transforms dropped). */
  reduceMotion: boolean;
}

const APPROX_SETTLING = (anim: AnimationToken | null, reduce: boolean): number => {
  if (reduce) return REDUCED_MOTION_ANIM.duration;
  if (anim == null) return 0;
  return resolveAnim(anim).duration;
};

/**
 * Drives a mount/unmount transition without a CSS-class file — it computes the
 * from/identity inline styles for the chosen preset, flips them across a frame so the
 * browser observes the transition, and (on removal) keeps `mounted=true` until the
 * `transitionend`/timeout fires before reporting `exited`.
 *
 * Honors reduce-motion: under it, transforms/filters are stripped and only opacity
 * cross-fades over ≤0.15s linear (the spec's reduced-motion floor).
 */
export function useMountTransition(
  present: boolean,
  opts: UseMountTransitionOptions = {},
): MountTransitionResult {
  const {
    transition = "opacity",
    animation = "default",
    transitionOptions,
    onExited,
    onEntered,
  } = opts;

  const env = useEnvironment();
  const inherited = useContext(TxnContext);
  const reduceMotion = env.reduceMotion;
  const animDisabled = inherited.disablesAnimations;

  const [mounted, setMounted] = useState(present);
  const [state, setState] = useState<MountTransitionState>(
    present ? "entered" : "exited",
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const styleSet = transitionStyles(transition, transitionOptions);

  // Build the CSS transition string. Springs settle; curves use 0.35s. Reduce-motion
  // collapses both to the linear fade and restricts the transitioned property to opacity.
  const resolved: ResolvedAnim | null =
    animDisabled || animation == null
      ? null
      : reduceMotion
        ? { ...REDUCED_MOTION_ANIM }
        : resolveAnim(animation);
  const transitionStr = resolved
    ? `${reduceMotion ? "opacity" : "all"} ${resolved.duration}s ${resolved.easing} ${resolved.delay}s`
    : "none";

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const durationMs = APPROX_SETTLING(animation, reduceMotion) * 1000;

    if (present) {
      setMounted(true);
      setState("entering");
      // Next frame: switch from the "from" geometry to "identity" so the
      // transition is observed (the from state is applied synchronously below).
      const raf =
        typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
      raf(() => setState("entered"));
      if (durationMs > 0) {
        timerRef.current = setTimeout(() => onEntered?.(), durationMs);
      } else {
        onEntered?.();
      }
    } else {
      // Only run an exit if we were mounted.
      setState((prev) => (prev === "exited" ? "exited" : "exiting"));
      if (durationMs > 0) {
        timerRef.current = setTimeout(() => {
          setMounted(false);
          setState("exited");
          onExited?.();
        }, durationMs);
      } else {
        setMounted(false);
        setState("exited");
        onExited?.();
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present, reduceMotion, animDisabled]);

  // Pick the inline style for the current phase.
  let block: string;
  switch (state) {
    case "entering":
      block = styleSet.enter; // off-screen "from"
      break;
    case "entered":
      block = styleSet.enterActive; // settled "identity"
      break;
    case "exiting":
      block = styleSet.exitActive; // animate toward off-screen "to"
      break;
    case "exited":
    default:
      block = styleSet.exit; // identity at rest (node about to leave)
      break;
  }

  let style = declBlockToStyle(block);
  // Under reduce-motion, drop transforms/filters — keep only opacity.
  if (reduceMotion) {
    const { opacity } = style;
    style = opacity !== undefined ? { opacity } : {};
  }

  return {
    mounted: present || mounted,
    state,
    transition: transitionStr,
    style,
    reduceMotion,
  };
}
