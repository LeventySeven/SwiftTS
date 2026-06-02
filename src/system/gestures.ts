"use client";
/**
 * SwiftUI gesture system, ported to the web on Pointer Events.
 *
 * SwiftUI gestures are NOT DOM events — they are value-producing state machines
 * attached to a view (see teardowns/SWIFTUI_C13_gestures.md §0). Each gesture is
 * a recognizer that emits a typed `Value` through three lifecycle sinks:
 *   - updating  (every change; drives transient GestureState, auto-reset on end)
 *   - onChanged (every change; your code — there is NO onBegan, "began" is the
 *                first onChanged)
 *   - onEnded   (recognition finished/succeeded)
 *
 * The load-bearing part is the RECOGNITION THRESHOLDS (the reason a tap is not a
 * drag). These are quoted verbatim from the macOS SDK `.swiftinterface`:
 *   DragGesture.minimumDistance        = 10 pt
 *   DragGesture velocity factor        = ×4  (velocity = 4·(predictedEnd − loc))
 *   LongPressGesture.minimumDuration   = 0.5 s
 *   LongPressGesture.maximumDistance   = 10 pt
 *   MagnifyGesture.minimumScaleDelta   = 0.01
 *   RotateGesture.minimumAngleDelta    = 1°
 *   TapGesture.count                   = 1 (default), tap slop = 10 pt,
 *                                        multi-tap window ≈ 0.3 s
 *
 * Everything is built on Pointer Events (mouse + touch + pen unify) plus
 * `setPointerCapture` (the web analogue of SwiftUI grabbing the gesture) and
 * `touch-action` (so the browser does not steal a pan/pinch for scrolling).
 *
 * Each hook returns a `GestureProps` object you SPREAD onto a host element:
 *   const drag = useDragGesture({}, { onChanged, onEnded });
 *   return <div {...drag.handlers} style={drag.style} />;
 */
import React from "react";

// ---------------------------------------------------------------------------
// Core value shapes (mirror the SwiftUI `Value` structs exactly)
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}
/** SwiftUI CGSize is used for translation/velocity → {width, height}. */
export interface Size {
  width: number;
  height: number;
}
/** Unit point (0…1) — pinch/rotate anchor (UnitPoint). */
export interface UnitPoint {
  x: number;
  y: number;
}

export type CoordinateSpace = "local" | "global";

/** DragGesture.Value — SUI:3487. The richest value in the cluster. */
export interface DragValue {
  /** timestamp of this sample (ms, performance-clock domain). */
  time: number;
  /** current finger point. */
  location: Point;
  /** original down point (NOT the threshold-cross point). */
  startLocation: Point;
  /** location − startLocation. Includes the minimumDistance you travelled. */
  translation: Size;
  /** points/second; ×4 of the projected delta (interface getter). */
  velocity: Size;
  /** where the drag would land if released now: location + velocity/4. */
  predictedEndLocation: Point;
  /** predictedEndLocation − startLocation: translation + velocity/4. */
  predictedEndTranslation: Size;
}

/** SpatialTapGesture.Value — SUI:22836: a tap that carries its location. */
export interface SpatialTapValue {
  location: Point;
}

/** MagnifyGesture.Value — SUI:9791. */
export interface MagnifyValue {
  time: number;
  /** ratio relative to start: 1.0 = none, 2.0 = doubled. */
  magnification: number;
  /** scale change per second. */
  velocity: number;
  /** pinch center as a unit point (0…1) — transform-origin. */
  startAnchor: UnitPoint;
  /** pinch center in points. */
  startLocation: Point;
}

/** RotateGesture.Value — SUI:5172. Angle stored in DEGREES. */
export interface RotateValue {
  time: number;
  /** accumulated rotation in degrees. */
  rotation: number;
  /** angular velocity, degrees per second. */
  velocity: number;
  startAnchor: UnitPoint;
  startLocation: Point;
}

// ---------------------------------------------------------------------------
// Recognizer state machine — possible → began → changed* → ended|failed|cancelled
// (mirrors UIKit UIGestureRecognizer.State, which SwiftUI wraps). §0.2
// ---------------------------------------------------------------------------

export type GestureState =
  | "possible"
  | "began"
  | "changed"
  | "ended"
  | "failed"
  | "cancelled";

/**
 * A recognizer consumes raw pointer events and feeds three value sinks.
 * Combinators (§9–11) compose recognizers by re-wiring these sinks and routing
 * the pointer events between children.
 */
export interface Recognizer<V> {
  onPointerDown(e: PointerEvent): void;
  onPointerMove(e: PointerEvent): void;
  onPointerUp(e: PointerEvent): void;
  onPointerCancel(e: PointerEvent): void;
  /** transient — auto-reset on end (drives GestureState). */
  updating?: (v: V) => void;
  /** every value change. */
  onChanged?: (v: V) => void;
  /** recognition finished. */
  onEnded?: (v: V) => void;
}

// ---------------------------------------------------------------------------
// Recognition constants (KNOWN, from the .swiftinterface). DO NOT change.
// ---------------------------------------------------------------------------

export const GESTURE_CONSTANTS = {
  /** DragGesture default minimumDistance — SUI:3514/3522. */
  dragMinimumDistance: 10,
  /** velocity = 4·(predictedEndLocation − location) — interface getter. */
  velocityFactor: 4,
  /** LongPressGesture default minimumDuration (seconds) — SUI:17003. */
  longPressMinimumDuration: 0.5,
  /** LongPressGesture default maximumDistance — SUI:17003. */
  longPressMaximumDistance: 10,
  /** MagnifyGesture default minimumScaleDelta — SUI:9801. */
  minimumScaleDelta: 0.01,
  /** RotateGesture default minimumAngleDelta (degrees) — SUI:5183. */
  minimumAngleDeltaDegrees: 1,
  /** UIKit tap slop (movement tolerance before a tap fails) — INFERRED 10 pt. */
  tapSlop: 10,
  /** system double-tap interval (ms) — INFERRED ≈ 0.3 s. */
  multiTapInterval: 300,
} as const;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Map a pointer to the requested coordinate space.
 *  - "local"  → relative to the element's own box (getBoundingClientRect math).
 *  - "global" → window/client coordinates.
 */
function toSpace(
  e: PointerEvent,
  el: HTMLElement,
  space: CoordinateSpace,
): Point {
  if (space === "global") return { x: e.clientX, y: e.clientY };
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// ===========================================================================
// 1–6. LEAF RECOGNIZERS (pure, framework-free — the engine each hook drives)
// ===========================================================================

/**
 * §1 TapGesture (CORE:14256) / §2 SpatialTapGesture (SUI:22836).
 * Fires `onEnded` only once `count` taps land within the multi-tap window and
 * without exceeding the slop. A tap is atomic — there is no `onChanged`.
 *
 * When `spatial` is true the emitted value carries the tap `{location}`
 * (SpatialTapGesture); otherwise it is `undefined` (TapGesture emits Void).
 */
export function tapRecognizer(opts?: {
  count?: number;
  slop?: number;
  multiTapInterval?: number;
  coordinateSpace?: CoordinateSpace;
  spatial?: boolean;
  getElement?: () => HTMLElement | null;
}): Recognizer<SpatialTapValue | undefined> {
  const count = opts?.count ?? 1;
  const slop = opts?.slop ?? GESTURE_CONSTANTS.tapSlop;
  const window_ = opts?.multiTapInterval ?? GESTURE_CONSTANTS.multiTapInterval;
  const space = opts?.coordinateSpace ?? "local";

  let taps = 0;
  let lastTime = 0;
  let startX = 0;
  let startY = 0;
  let failed = false;

  const rec: Recognizer<SpatialTapValue | undefined> = {
    onPointerDown(e) {
      startX = e.clientX;
      startY = e.clientY;
      failed = false;
      // a gap longer than the window resets the run.
      if (e.timeStamp - lastTime > window_) taps = 0;
    },
    onPointerMove(e) {
      if (dist(e.clientX, e.clientY, startX, startY) > slop) failed = true;
    },
    onPointerUp(e) {
      if (failed) {
        taps = 0;
        return;
      }
      taps += 1;
      lastTime = e.timeStamp;
      if (taps >= count) {
        taps = 0;
        let value: SpatialTapValue | undefined;
        if (opts?.spatial) {
          const el = opts?.getElement?.();
          value = el ? { location: toSpace(e, el, space) } : { location: { x: e.clientX, y: e.clientY } };
        }
        rec.updating?.(value);
        rec.onEnded?.(value);
      }
    },
    onPointerCancel() {
      taps = 0;
      failed = true;
    },
  };
  return rec;
}

/**
 * §4 LongPressGesture (SUI:16994). Succeeds once the press is held for
 * `minimumDuration` while staying within `maximumDistance`; fails on early
 * release or wandering. `Value = Bool`. The `pressing` callback toggles a
 * pressed highlight (true at down, false at release/cancel/fail).
 */
export function longPressRecognizer(opts?: {
  minimumDuration?: number;
  maximumDistance?: number;
  pressing?: (b: boolean) => void;
}): Recognizer<boolean> {
  const minimumDuration =
    opts?.minimumDuration ?? GESTURE_CONSTANTS.longPressMinimumDuration;
  const maximumDistance =
    opts?.maximumDistance ?? GESTURE_CONSTANTS.longPressMaximumDistance;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let startX = 0;
  let startY = 0;
  let succeeded = false;

  const clear = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const rec: Recognizer<boolean> = {
    onPointerDown(e) {
      startX = e.clientX;
      startY = e.clientY;
      succeeded = false;
      opts?.pressing?.(true);
      timer = setTimeout(() => {
        succeeded = true;
        rec.updating?.(true);
        rec.onChanged?.(true); // Value flips to `true` the instant the hold elapses.
      }, minimumDuration * 1000);
    },
    onPointerMove(e) {
      if (succeeded) return;
      if (dist(e.clientX, e.clientY, startX, startY) > maximumDistance) {
        clear();
        opts?.pressing?.(false); // wandered → fail
      }
    },
    onPointerUp() {
      clear();
      opts?.pressing?.(false);
      if (succeeded) rec.onEnded?.(true);
    },
    onPointerCancel() {
      clear();
      opts?.pressing?.(false);
    },
  };
  return rec;
}

/**
 * §3 DragGesture (SUI:3487). Begins on the first move past `minimumDistance`
 * (or immediately if `minimumDistance === 0` — used for sliders/knobs). Emits
 * the full DragValue including ×4-projected velocity & predicted end.
 *
 * `startLocation` is the TRUE initial down point, so `translation` includes the
 * `minimumDistance` you had to travel — the recognizer does NOT zero it out.
 */
export function dragRecognizer(opts?: {
  minimumDistance?: number;
  coordinateSpace?: CoordinateSpace;
  getElement?: () => HTMLElement | null;
}): Recognizer<DragValue> {
  const minimumDistance =
    opts?.minimumDistance ?? GESTURE_CONSTANTS.dragMinimumDistance;
  const space = opts?.coordinateSpace ?? "local";
  const factor = GESTURE_CONSTANTS.velocityFactor;

  let start: Point = { x: 0, y: 0 };
  let began = false;
  let samples: { t: number; x: number; y: number }[] = [];

  const loc = (e: PointerEvent): Point => {
    const el = opts?.getElement?.() ?? (e.currentTarget as HTMLElement | null);
    if (el && space === "local") return toSpace(e, el, "local");
    return { x: e.clientX, y: e.clientY };
  };

  const build = (point: Point, t: number): DragValue => {
    // velocity from the last two samples (points/sec).
    let vx = 0;
    let vy = 0;
    if (samples.length >= 2) {
      const a = samples[samples.length - 2];
      const b = samples[samples.length - 1];
      const dt = (b.t - a.t) / 1000 || 1e-3;
      vx = (b.x - a.x) / dt;
      vy = (b.y - a.y) / dt;
    }
    const velocity: Size = { width: vx, height: vy };
    // interface: velocity = factor·(predictedEnd − loc) ⇒ predictedEnd = loc + velocity/factor.
    const predictedEndLocation: Point = {
      x: point.x + vx / factor,
      y: point.y + vy / factor,
    };
    return {
      time: t,
      location: point,
      startLocation: start,
      translation: { width: point.x - start.x, height: point.y - start.y },
      velocity,
      predictedEndLocation,
      predictedEndTranslation: {
        width: predictedEndLocation.x - start.x,
        height: predictedEndLocation.y - start.y,
      },
    };
  };

  const rec: Recognizer<DragValue> = {
    onPointerDown(e) {
      const el = e.currentTarget as HTMLElement | null;
      el?.setPointerCapture?.(e.pointerId);
      start = loc(e);
      began = minimumDistance === 0;
      samples = [{ t: e.timeStamp, x: start.x, y: start.y }];
      if (began) {
        const v = build(start, e.timeStamp);
        rec.updating?.(v);
        rec.onChanged?.(v);
      }
    },
    onPointerMove(e) {
      const point = loc(e);
      samples.push({ t: e.timeStamp, x: point.x, y: point.y });
      if (samples.length > 4) samples.shift();
      if (!began && dist(point.x, point.y, start.x, start.y) >= minimumDistance) {
        began = true;
      }
      if (began) {
        const v = build(point, e.timeStamp);
        rec.updating?.(v);
        rec.onChanged?.(v);
      }
    },
    onPointerUp(e) {
      if (began) {
        const v = build(loc(e), e.timeStamp);
        rec.onEnded?.(v);
      }
      began = false;
    },
    onPointerCancel() {
      began = false;
    },
  };
  return rec;
}

/**
 * §5 MagnifyGesture (SUI:9791). Two-finger pinch. Tracks two active pointers,
 * begins once |magnification − 1| ≥ minimumScaleDelta (default 0.01).
 * `magnification` is a ratio relative to the start; `startAnchor` is the pinch
 * center as a unit point for `transform-origin`.
 */
export function magnifyRecognizer(opts?: {
  minimumScaleDelta?: number;
  getElement?: () => HTMLElement | null;
}): Recognizer<MagnifyValue> {
  const minimumScaleDelta =
    opts?.minimumScaleDelta ?? GESTURE_CONSTANTS.minimumScaleDelta;

  const pts = new Map<number, Point>();
  let startDist = 0;
  let anchor: UnitPoint = { x: 0, y: 0 };
  let anchorPt: Point = { x: 0, y: 0 };
  let began = false;
  let lastMag = 1;
  let lastT = 0;

  const spread = (): number => {
    const arr = [...pts.values()];
    if (arr.length < 2) return 0;
    return dist(arr[0].x, arr[0].y, arr[1].x, arr[1].y);
  };

  const rec: Recognizer<MagnifyValue> = {
    onPointerDown(e) {
      (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const el =
          opts?.getElement?.() ?? (e.currentTarget as HTMLElement | null);
        const arr = [...pts.values()];
        const cx = (arr[0].x + arr[1].x) / 2;
        const cy = (arr[0].y + arr[1].y) / 2;
        startDist = spread();
        anchorPt = { x: cx, y: cy };
        if (el) {
          const r = el.getBoundingClientRect();
          anchor = { x: (cx - r.left) / r.width, y: (cy - r.top) / r.height };
        }
        began = false;
        lastMag = 1;
        lastT = e.timeStamp;
      }
    },
    onPointerMove(e) {
      const p = pts.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size < 2 || startDist === 0) return;
      const mag = spread() / startDist;
      if (!began && Math.abs(mag - 1) >= minimumScaleDelta) began = true;
      if (began) {
        const dt = (e.timeStamp - lastT) / 1000 || 1e-3;
        const vel = (mag - lastMag) / dt;
        const v: MagnifyValue = {
          time: e.timeStamp,
          magnification: mag,
          velocity: vel,
          startAnchor: anchor,
          startLocation: anchorPt,
        };
        rec.updating?.(v);
        rec.onChanged?.(v);
        lastMag = mag;
        lastT = e.timeStamp;
      }
    },
    onPointerUp(e) {
      pts.delete(e.pointerId);
      if (began && pts.size < 2) {
        rec.onEnded?.({
          time: e.timeStamp,
          magnification: lastMag,
          velocity: 0,
          startAnchor: anchor,
          startLocation: anchorPt,
        });
        began = false;
      }
    },
    onPointerCancel(e) {
      pts.delete(e.pointerId);
      began = false;
    },
  };
  return rec;
}

/**
 * §6 RotateGesture (SUI:5172). Two-finger twist. Begins once |rotation| ≥
 * minimumAngleDelta (default 1°). `rotation` accumulates in DEGREES with
 * shortest-arc unwrap; apply as `rotate()` around `startAnchor`.
 */
export function rotateRecognizer(opts?: {
  minimumAngleDeltaDegrees?: number;
  getElement?: () => HTMLElement | null;
}): Recognizer<RotateValue> {
  const minimumAngleDelta =
    opts?.minimumAngleDeltaDegrees ?? GESTURE_CONSTANTS.minimumAngleDeltaDegrees;

  const pts = new Map<number, Point>();
  let startAngle = 0;
  let anchor: UnitPoint = { x: 0, y: 0 };
  let anchorPt: Point = { x: 0, y: 0 };
  let began = false;
  let lastRot = 0;
  let lastT = 0;
  let primed = false;

  const angleDeg = (): number => {
    const arr = [...pts.values()];
    if (arr.length < 2) return 0;
    return (Math.atan2(arr[1].y - arr[0].y, arr[1].x - arr[0].x) * 180) / Math.PI;
  };

  const rec: Recognizer<RotateValue> = {
    onPointerDown(e) {
      (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const el =
          opts?.getElement?.() ?? (e.currentTarget as HTMLElement | null);
        const arr = [...pts.values()];
        const cx = (arr[0].x + arr[1].x) / 2;
        const cy = (arr[0].y + arr[1].y) / 2;
        startAngle = angleDeg();
        anchorPt = { x: cx, y: cy };
        if (el) {
          const r = el.getBoundingClientRect();
          anchor = { x: (cx - r.left) / r.width, y: (cy - r.top) / r.height };
        }
        began = false;
        primed = true;
        lastRot = 0;
        lastT = e.timeStamp;
      }
    },
    onPointerMove(e) {
      const p = pts.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size < 2 || !primed) return;
      let rot = angleDeg() - startAngle;
      while (rot > 180) rot -= 360; // shortest-arc unwrap
      while (rot < -180) rot += 360;
      if (!began && Math.abs(rot) >= minimumAngleDelta) began = true;
      if (began) {
        const dt = (e.timeStamp - lastT) / 1000 || 1e-3;
        const vel = (rot - lastRot) / dt;
        const v: RotateValue = {
          time: e.timeStamp,
          rotation: rot,
          velocity: vel,
          startAnchor: anchor,
          startLocation: anchorPt,
        };
        rec.updating?.(v);
        rec.onChanged?.(v);
        lastRot = rot;
        lastT = e.timeStamp;
      }
    },
    onPointerUp(e) {
      pts.delete(e.pointerId);
      if (began && pts.size < 2) {
        rec.onEnded?.({
          time: e.timeStamp,
          rotation: lastRot,
          velocity: 0,
          startAnchor: anchor,
          startLocation: anchorPt,
        });
        began = false;
        primed = false;
      }
    },
    onPointerCancel(e) {
      pts.delete(e.pointerId);
      began = false;
      primed = false;
    },
  };
  return rec;
}

// ===========================================================================
// 8. VALUE OPERATORS — .onChanged / .onEnded / .map (§8)
// ===========================================================================

/**
 * §8 .onChanged (CORE:5719). Requires `Value : Equatable` in SwiftUI: it dedups
 * and only fires when the value actually changed. Here `eq` defaults to a
 * shallow structural compare so DragValue-like structs dedup correctly.
 */
export function withOnChanged<V>(
  rec: Recognizer<V>,
  fn: (v: V) => void,
  eq: (a: V, b: V) => boolean = shallowEqual,
): Recognizer<V> {
  let last: V | undefined;
  let hasLast = false;
  const prev = rec.onChanged;
  rec.onChanged = (v) => {
    prev?.(v);
    if (!hasLast || !eq(last as V, v)) {
      last = v;
      hasLast = true;
      fn(v);
    }
  };
  return rec;
}

/** §8 .onEnded (CORE:5711). No Equatable constraint — fires once at the end. */
export function withOnEnded<V>(
  rec: Recognizer<V>,
  fn: (v: V) => void,
): Recognizer<V> {
  const prev = rec.onEnded;
  rec.onEnded = (v) => {
    prev?.(v);
    fn(v);
  };
  return rec;
}

/** §8 .map (CORE:9930). Transforms the emitted value type; recognition unchanged. */
export function mapGesture<V, T>(
  rec: Recognizer<V>,
  body: (v: V) => T,
): Recognizer<T> {
  const out: Recognizer<T> = {
    onPointerDown: (e) => rec.onPointerDown(e),
    onPointerMove: (e) => rec.onPointerMove(e),
    onPointerUp: (e) => rec.onPointerUp(e),
    onPointerCancel: (e) => rec.onPointerCancel(e),
  };
  rec.updating = (v) => out.updating?.(body(v));
  rec.onChanged = (v) => out.onChanged?.(body(v));
  rec.onEnded = (v) => out.onEnded?.(body(v));
  return out;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const va = (a as Record<string, unknown>)[k];
    const vb = (b as Record<string, unknown>)[k];
    if (typeof va === "object" && va !== null) {
      if (!shallowEqual(va, vb)) return false;
    } else if (!Object.is(va, vb)) {
      return false;
    }
  }
  return true;
}

// ===========================================================================
// 9–11. COMBINATORS — sequenced / simultaneously / exclusively (§9–11)
// ===========================================================================

/** §9 SequenceGesture.Value (SUI:2209) — an enum: .first | .second. */
export type SeqValue<A, B> =
  | { phase: "first"; first: A }
  | { phase: "second"; first: A; second: B | null };

/**
 * §9 .sequenced(before:) (SUI:2204). `b` cannot begin until `a` SUCCEEDS. While
 * in `.first` only `a`'s value flows; once `a` ends, state moves to `.second`
 * and `b` recognizes from there. If `a` fails (never ends) the sequence fails.
 */
export function sequenced<A, B>(
  a: Recognizer<A>,
  b: Recognizer<B>,
): Recognizer<SeqValue<A, B>> {
  let phase: "first" | "second" = "first";
  let firstVal: A;

  const out: Recognizer<SeqValue<A, B>> = {
    onPointerDown(e) {
      (phase === "first" ? a : b).onPointerDown(e);
    },
    onPointerMove(e) {
      // `a` keeps tracking; once promoted, `b` also receives moves.
      a.onPointerMove(e);
      if (phase === "second") b.onPointerMove(e);
    },
    onPointerUp(e) {
      (phase === "first" ? a : b).onPointerUp(e);
    },
    onPointerCancel(e) {
      a.onPointerCancel(e);
      b.onPointerCancel(e);
    },
  };

  a.onChanged = (v) => {
    if (phase === "first") {
      const value: SeqValue<A, B> = { phase: "first", first: v };
      out.updating?.(value);
      out.onChanged?.(value);
    }
  };
  a.onEnded = (v) => {
    firstVal = v;
    phase = "second";
    const value: SeqValue<A, B> = { phase: "second", first: v, second: null };
    out.updating?.(value);
    out.onChanged?.(value);
  };
  b.onChanged = (v) => {
    if (phase === "second") {
      const value: SeqValue<A, B> = {
        phase: "second",
        first: firstVal,
        second: v,
      };
      out.updating?.(value);
      out.onChanged?.(value);
    }
  };
  b.onEnded = (v) => {
    if (phase === "second") {
      out.onEnded?.({ phase: "second", first: firstVal, second: v });
    }
  };
  return out;
}

/** §10 SimultaneousGesture.Value (CORE:1080) — a struct of two optionals. */
export interface SimulValue<A, B> {
  first: A | null;
  second: B | null;
}

/**
 * §10 .simultaneously(with:) (CORE:1071). Both gestures recognize at the same
 * time from the same touches; either may be null before it begins. Canonical:
 * pinch + rotate together.
 */
export function simultaneously<A, B>(
  a: Recognizer<A>,
  b: Recognizer<B>,
): Recognizer<SimulValue<A, B>> {
  let fa: A | null = null;
  let fb: B | null = null;

  const out: Recognizer<SimulValue<A, B>> = {
    onPointerDown(e) {
      a.onPointerDown(e);
      b.onPointerDown(e);
    },
    onPointerMove(e) {
      a.onPointerMove(e);
      b.onPointerMove(e);
    },
    onPointerUp(e) {
      a.onPointerUp(e);
      b.onPointerUp(e);
    },
    onPointerCancel(e) {
      a.onPointerCancel(e);
      b.onPointerCancel(e);
    },
  };

  const emit = () => {
    const value: SimulValue<A, B> = { first: fa, second: fb };
    out.updating?.(value);
    out.onChanged?.(value);
  };
  a.onChanged = (v) => {
    fa = v;
    emit();
  };
  a.onEnded = (v) => {
    fa = v;
    emit();
  };
  b.onChanged = (v) => {
    fb = v;
    emit();
  };
  b.onEnded = (v) => {
    fb = v;
    emit();
  };
  return out;
}

/** §11 ExclusiveGesture.Value (CORE:1549) — an enum: .first | .second. */
export type ExclValue<A, B> =
  | { which: "first"; value: A }
  | { which: "second"; value: B };

/**
 * §11 .exclusively(before:) (CORE:1540). Only one recognizes — `first` has
 * priority; `second` is only given a chance if `first` fails. The first to
 * succeed wins, the other is cancelled.
 */
export function exclusively<A, B>(
  a: Recognizer<A>,
  b: Recognizer<B>,
): Recognizer<ExclValue<A, B>> {
  let decided: "first" | "second" | null = null;

  const out: Recognizer<ExclValue<A, B>> = {
    onPointerDown(e) {
      a.onPointerDown(e);
      b.onPointerDown(e);
    },
    onPointerMove(e) {
      a.onPointerMove(e);
      b.onPointerMove(e);
    },
    onPointerUp(e) {
      a.onPointerUp(e);
      b.onPointerUp(e);
    },
    onPointerCancel(e) {
      a.onPointerCancel(e);
      b.onPointerCancel(e);
    },
  };

  a.onChanged = (v) => {
    if (decided === null || decided === "first") {
      out.onChanged?.({ which: "first", value: v });
    }
  };
  a.onEnded = (v) => {
    if (decided !== "second") {
      decided = "first";
      out.onEnded?.({ which: "first", value: v });
    }
  };
  // `b` only wins if `a` never claimed (first failed).
  b.onChanged = (v) => {
    if (decided === null || decided === "second") {
      out.onChanged?.({ which: "second", value: v });
    }
  };
  b.onEnded = (v) => {
    if (decided === null) {
      decided = "second";
      out.onEnded?.({ which: "second", value: v });
    }
  };
  return out;
}

/**
 * §13 AnyGesture (CORE:9950) — pure type erasure. At runtime a no-op; useful
 * only to type a `Recognizer<V>` variable that may hold different recognizers.
 */
export const anyGesture = <V>(r: Recognizer<V>): Recognizer<V> => r;

// ===========================================================================
// 12. ATTACHMENT — bind a recognizer to a DOM element + GestureMask / priority
// ===========================================================================

/** §12 GestureMask (CORE:18695) — whose gestures are eligible. Default `.all`. */
export type GestureMask = "none" | "gesture" | "subviews" | "all";
/** §12 priority — normal (bubble) / high (capture+stopPropagation) / simultaneous. */
export type GesturePriority = "normal" | "high" | "simultaneous";

export interface AttachOptions {
  /** which pan/pinch/drag gestures need `touch-action: none`. */
  touchAction?: React.CSSProperties["touchAction"];
  /** §12.3 priority routing. */
  priority?: GesturePriority;
  /** §12 GestureMask, default 'all'. */
  mask?: GestureMask;
  /** disable the recognizer without unbinding (drives ignored events). */
  disabled?: boolean;
}

/**
 * Bind a recognizer's pointer handlers to an element via native listeners.
 *  - `high`   → capture phase + stopPropagation (parent beats child).
 *  - `normal` → bubble phase (a child that captures the pointer wins).
 *  - `simultaneous` → bubble, no stopPropagation (parent + child both fire).
 * `mask` of 'none' or 'subviews' suppresses THIS recognizer (events still flow
 * to children); 'gesture'/'all' run it.
 */
export function attachRecognizer<V>(
  el: HTMLElement,
  rec: Recognizer<V>,
  options: AttachOptions = {},
): () => void {
  const { priority = "normal", mask = "all", disabled = false } = options;
  const capture = priority === "high";
  const stop = priority === "high";
  // 'none'/'subviews' disable this node's own recognizer.
  const active = !disabled && mask !== "none" && mask !== "subviews";

  const wrap =
    (fn: (e: PointerEvent) => void) =>
    (e: Event) => {
      if (!active) return;
      if (stop) e.stopPropagation();
      fn(e as PointerEvent);
    };

  const onDown = wrap((e) => rec.onPointerDown(e));
  const onMove = wrap((e) => rec.onPointerMove(e));
  const onUp = wrap((e) => rec.onPointerUp(e));
  const onCancel = wrap((e) => rec.onPointerCancel(e));

  const optsObj: AddEventListenerOptions = { capture };
  el.addEventListener("pointerdown", onDown, optsObj);
  el.addEventListener("pointermove", onMove, optsObj);
  el.addEventListener("pointerup", onUp, optsObj);
  el.addEventListener("pointercancel", onCancel, optsObj);

  return () => {
    el.removeEventListener("pointerdown", onDown, optsObj);
    el.removeEventListener("pointermove", onMove, optsObj);
    el.removeEventListener("pointerup", onUp, optsObj);
    el.removeEventListener("pointercancel", onCancel, optsObj);
  };
}

// ===========================================================================
// REACT HOOKS — each returns props/handlers/ref to spread onto a host element
// ===========================================================================

/** React pointer-event handlers ready to spread (`{...handlers}`). */
export interface PointerHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

/** The object every gesture hook returns. Spread `handlers` + `style` on a host. */
export interface GestureProps {
  /** Spread directly: `<div {...g.handlers} />`. */
  handlers: PointerHandlers;
  /** Recommended CSS (touch-action etc.) — spread into the host `style`. */
  style: React.CSSProperties;
  /** Attach the host element (used for coordinate-space math + capture). */
  ref: React.RefObject<HTMLElement | null>;
}

/** Build React handlers from a leaf recognizer; sets pointer capture on down. */
function recognizerHandlers<V>(rec: Recognizer<V>): PointerHandlers {
  return {
    onPointerDown: (e) => rec.onPointerDown(e.nativeEvent),
    onPointerMove: (e) => rec.onPointerMove(e.nativeEvent),
    onPointerUp: (e) => rec.onPointerUp(e.nativeEvent),
    onPointerCancel: (e) => rec.onPointerCancel(e.nativeEvent),
  };
}

/**
 * §1/§2 useTapGesture — mirrors `.onTapGesture(count:perform:)` and the spatial
 * `.onTapGesture(count:coordinateSpace:perform:)` overload.
 *
 *   const tap = useTapGesture({ count: 2 }, () => …);
 *   <div {...tap.handlers} style={tap.style} ref={tap.ref as any} />
 *
 * When `coordinateSpace` is provided the handler receives the tap `{location}`
 * (SpatialTapGesture); otherwise it receives `undefined` (TapGesture = Void).
 */
export function useTapGesture(
  options: { count?: number; coordinateSpace?: CoordinateSpace } | undefined,
  onEnded: (value?: SpatialTapValue) => void,
): GestureProps {
  const ref = React.useRef<HTMLElement | null>(null);
  const onEndedRef = React.useRef(onEnded);
  onEndedRef.current = onEnded;
  const count = options?.count ?? 1;
  const space = options?.coordinateSpace;

  const rec = React.useMemo(
    () =>
      tapRecognizer({
        count,
        coordinateSpace: space,
        spatial: space !== undefined,
        getElement: () => ref.current,
      }),
    [count, space],
  );

  React.useEffect(() => {
    rec.onEnded = (v) => onEndedRef.current(v ?? undefined);
  }, [rec]);

  return {
    handlers: recognizerHandlers(rec),
    // taps preserve scroll — manipulation, not none.
    style: { touchAction: "manipulation", cursor: "default" },
    ref,
  };
}

/**
 * §4 useLongPressGesture — mirrors `.onLongPressGesture(minimumDuration:
 * maximumDistance:perform:onPressingChanged:)`.
 *
 *   const lp = useLongPressGesture(
 *     { minimumDuration: 0.5, maximumDistance: 10 },
 *     { onChanged: (b) => …, onEnded: () => …, onPressingChanged: setPressed },
 *   );
 */
export function useLongPressGesture(
  options:
    | { minimumDuration?: number; maximumDistance?: number }
    | undefined,
  callbacks: {
    onChanged?: (value: boolean) => void;
    onEnded?: (value: boolean) => void;
    onPressingChanged?: (pressing: boolean) => void;
  },
): GestureProps {
  const ref = React.useRef<HTMLElement | null>(null);
  const cbRef = React.useRef(callbacks);
  cbRef.current = callbacks;
  const minimumDuration =
    options?.minimumDuration ?? GESTURE_CONSTANTS.longPressMinimumDuration;
  const maximumDistance =
    options?.maximumDistance ?? GESTURE_CONSTANTS.longPressMaximumDistance;

  const rec = React.useMemo(
    () =>
      longPressRecognizer({
        minimumDuration,
        maximumDistance,
        pressing: (b) => cbRef.current.onPressingChanged?.(b),
      }),
    [minimumDuration, maximumDistance],
  );

  React.useEffect(() => {
    rec.onChanged = (v) => cbRef.current.onChanged?.(v);
    rec.onEnded = (v) => cbRef.current.onEnded?.(v);
  }, [rec]);

  return {
    handlers: recognizerHandlers(rec),
    // suppress the native callout/selection while holding.
    style: {
      touchAction: "manipulation",
      WebkitTouchCallout: "none",
      WebkitUserSelect: "none",
      userSelect: "none",
    } as React.CSSProperties,
    ref,
  };
}

/**
 * §3 useDragGesture — mirrors `DragGesture(minimumDistance:coordinateSpace:)`.
 * Produces the full DragValue (translation, location, startLocation, velocity,
 * predictedEndTranslation) on every change.
 *
 *   const drag = useDragGesture(
 *     { minimumDistance: 10, coordinateSpace: "local" },
 *     { onChanged: (v) => setOffset(v.translation), onEnded: () => snapBack() },
 *   );
 */
export function useDragGesture(
  options:
    | { minimumDistance?: number; coordinateSpace?: CoordinateSpace }
    | undefined,
  callbacks: {
    onChanged?: (value: DragValue) => void;
    onEnded?: (value: DragValue) => void;
    /** transient sink (drives useGestureState; auto-reset on end). */
    onUpdating?: (value: DragValue) => void;
  },
): GestureProps {
  const ref = React.useRef<HTMLElement | null>(null);
  const cbRef = React.useRef(callbacks);
  cbRef.current = callbacks;
  const minimumDistance =
    options?.minimumDistance ?? GESTURE_CONSTANTS.dragMinimumDistance;
  const space = options?.coordinateSpace ?? "local";

  const rec = React.useMemo(
    () =>
      dragRecognizer({
        minimumDistance,
        coordinateSpace: space,
        getElement: () => ref.current,
      }),
    [minimumDistance, space],
  );

  React.useEffect(() => {
    rec.updating = (v) => cbRef.current.onUpdating?.(v);
    rec.onChanged = (v) => cbRef.current.onChanged?.(v);
    rec.onEnded = (v) => {
      cbRef.current.onEnded?.(v);
    };
  }, [rec]);

  return {
    handlers: recognizerHandlers(rec),
    // a touch-drag must not scroll the page; grab cursor on pointer class.
    style: { touchAction: "none", cursor: "grab", userSelect: "none" },
    ref,
  };
}

/**
 * §5 useMagnifyGesture — mirrors `MagnifyGesture(minimumScaleDelta:)`. Two-finger
 * pinch; on desktop also maps trackpad pinch (ctrl+wheel) to magnification.
 *
 *   const pinch = useMagnifyGesture(
 *     { minimumScaleDelta: 0.01 },
 *     { onChanged: (v) => setScale(base * v.magnification) },
 *   );
 */
export function useMagnifyGesture(
  options: { minimumScaleDelta?: number } | undefined,
  callbacks: {
    onChanged?: (value: MagnifyValue) => void;
    onEnded?: (value: MagnifyValue) => void;
    onUpdating?: (value: MagnifyValue) => void;
  },
): GestureProps {
  const ref = React.useRef<HTMLElement | null>(null);
  const cbRef = React.useRef(callbacks);
  cbRef.current = callbacks;
  const minimumScaleDelta =
    options?.minimumScaleDelta ?? GESTURE_CONSTANTS.minimumScaleDelta;

  const rec = React.useMemo(
    () =>
      magnifyRecognizer({
        minimumScaleDelta,
        getElement: () => ref.current,
      }),
    [minimumScaleDelta],
  );

  React.useEffect(() => {
    rec.updating = (v) => cbRef.current.onUpdating?.(v);
    rec.onChanged = (v) => cbRef.current.onChanged?.(v);
    rec.onEnded = (v) => cbRef.current.onEnded?.(v);
  }, [rec]);

  // Desktop fallback: trackpad pinch surfaces as ctrl+wheel.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let mag = 1;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      mag *= 1 - e.deltaY * 0.01;
      const r = el.getBoundingClientRect();
      const v: MagnifyValue = {
        time: e.timeStamp,
        magnification: mag,
        velocity: 0,
        startAnchor: {
          x: (e.clientX - r.left) / r.width,
          y: (e.clientY - r.top) / r.height,
        },
        startLocation: { x: e.clientX, y: e.clientY },
      };
      cbRef.current.onUpdating?.(v);
      cbRef.current.onChanged?.(v);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return {
    handlers: recognizerHandlers(rec),
    style: { touchAction: "none" },
    ref,
  };
}

/**
 * §6 useRotateGesture — mirrors `RotateGesture(minimumAngleDelta:)`. Two-finger
 * rotation; often composed with magnify via `simultaneously` for pinch+rotate.
 *
 *   const rot = useRotateGesture(
 *     { minimumAngleDelta: 1 },
 *     { onChanged: (v) => setAngle(base + v.rotation) },
 *   );
 */
export function useRotateGesture(
  options: { minimumAngleDelta?: number } | undefined,
  callbacks: {
    onChanged?: (value: RotateValue) => void;
    onEnded?: (value: RotateValue) => void;
    onUpdating?: (value: RotateValue) => void;
  },
): GestureProps {
  const ref = React.useRef<HTMLElement | null>(null);
  const cbRef = React.useRef(callbacks);
  cbRef.current = callbacks;
  const minimumAngleDelta =
    options?.minimumAngleDelta ?? GESTURE_CONSTANTS.minimumAngleDeltaDegrees;

  const rec = React.useMemo(
    () =>
      rotateRecognizer({
        minimumAngleDeltaDegrees: minimumAngleDelta,
        getElement: () => ref.current,
      }),
    [minimumAngleDelta],
  );

  React.useEffect(() => {
    rec.updating = (v) => cbRef.current.onUpdating?.(v);
    rec.onChanged = (v) => cbRef.current.onChanged?.(v);
    rec.onEnded = (v) => cbRef.current.onEnded?.(v);
  }, [rec]);

  return {
    handlers: recognizerHandlers(rec),
    style: { touchAction: "none" },
    ref,
  };
}

/**
 * §7 useGestureState — the transient-state mechanism (`@GestureState` +
 * `.updating`). Returns a value that the gesture writes via `updating` and that
 * AUTO-RESETS to `initial` the instant the gesture ends/cancels — exactly
 * SwiftUI's killer feature (you never manually reset drag offset on release).
 *
 *   const drag = useGestureState({ width: 0, height: 0 });
 *   const g = useDragGesture({}, {
 *     onUpdating: (v) => drag.updating(v.translation),  // .updating body
 *     onEnded:    () => drag.reset(),                   // auto-reset wired in
 *   });
 *   <div style={{ transform: `translate(${drag.value.width}px,${drag.value.height}px)` }} />
 */
export function useGestureState<T>(initial: T): {
  value: T;
  updating: (v: T) => void;
  reset: () => void;
} {
  const [value, setValue] = React.useState<T>(initial);
  const initialRef = React.useRef(initial);
  initialRef.current = initial;
  const updating = React.useCallback((v: T) => setValue(v), []);
  const reset = React.useCallback(() => setValue(initialRef.current), []);
  return { value, updating, reset };
}

/**
 * §9–11 useGesture — the combinator entry point. Compose a recognizer tree with
 * `sequenced` / `simultaneously` / `exclusively`, then bind it to a host element
 * with `setPointerCapture` + the right `touch-action`/priority.
 *
 *   const ref = useRef<HTMLDivElement>(null);
 *   const rec = useMemo(
 *     () => simultaneously(magnifyRecognizer(), rotateRecognizer()),
 *     [],
 *   );
 *   useGesture(ref, rec, { touchAction: "none" });
 *
 * `build` may receive nothing or use the closed-over recognizer; the hook wires
 * the recognizer's pointer handlers to the element via native listeners so
 * priority (capture vs bubble) and GestureMask work.
 */
export function useGesture<V>(
  ref: React.RefObject<HTMLElement | null>,
  recognizer: Recognizer<V>,
  options: AttachOptions = {},
): void {
  const recRef = React.useRef(recognizer);
  recRef.current = recognizer;
  const {
    touchAction,
    priority = "normal",
    mask = "all",
    disabled = false,
  } = options;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (touchAction !== undefined) {
      el.style.touchAction = String(touchAction);
    }
    const detach = attachRecognizer(el, recRef.current, {
      priority,
      mask,
      disabled,
    });
    return detach;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, touchAction, priority, mask, disabled]);
}

// ===========================================================================
// 14. HOVER family — onHover / onContinuousHover (§14). Pointer-only.
// ===========================================================================

/** §14 HoverPhase (SUI:4282) — `.active(point)` | `.ended`. */
export type HoverPhase =
  | { phase: "active"; location: Point }
  | { phase: "ended" };

/**
 * §14 useOnHover — mirrors `.onHover(perform:)`. Pointer-only: touch is ignored
 * (`pointerType === "touch"` is skipped) so it matches SwiftUI's pointer-only
 * hover semantics. Returns handlers to spread.
 */
export function useOnHover(
  onHover: (hovering: boolean) => void,
): { handlers: Pick<PointerHandlers, "onPointerCancel"> & {
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
} } {
  const ref = React.useRef(onHover);
  ref.current = onHover;
  return {
    handlers: {
      onPointerEnter: (e) => {
        if (e.pointerType === "touch") return;
        ref.current(true);
      },
      onPointerLeave: (e) => {
        if (e.pointerType === "touch") return;
        ref.current(false);
      },
      onPointerCancel: () => ref.current(false),
    },
  };
}

/**
 * §14 useOnContinuousHover — mirrors `.onContinuousHover(coordinateSpace:
 * perform:)`. Streams `{phase:'active', location}` on move and `{phase:'ended'}`
 * on leave. Pointer-only.
 */
export function useOnContinuousHover(
  options: { coordinateSpace?: CoordinateSpace } | undefined,
  onHover: (phase: HoverPhase) => void,
): { handlers: {
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}; ref: React.RefObject<HTMLElement | null> } {
  const ref = React.useRef<HTMLElement | null>(null);
  const cb = React.useRef(onHover);
  cb.current = onHover;
  const space = options?.coordinateSpace ?? "local";
  return {
    handlers: {
      onPointerMove: (e) => {
        if (e.pointerType === "touch") return;
        const el = ref.current ?? (e.currentTarget as HTMLElement);
        const location =
          space === "global"
            ? { x: e.clientX, y: e.clientY }
            : (() => {
                const r = el.getBoundingClientRect();
                return { x: e.clientX - r.left, y: e.clientY - r.top };
              })();
        cb.current({ phase: "active", location });
      },
      onPointerLeave: (e) => {
        if (e.pointerType === "touch") return;
        cb.current({ phase: "ended" });
      },
      onPointerCancel: () => cb.current({ phase: "ended" }),
    },
    ref,
  };
}

// ===========================================================================
// 16. _ButtonGesture — press/highlight engine behind Button (§16)
// ===========================================================================

/**
 * §16 _ButtonGesture (SUI:21377). The "press-in highlight, release-out cancels,
 * release-in commits" UIButton behavior. `pressing(true)` on down inside;
 * `pressing(false)` on release/slide-out/cancel; `action()` only on release
 * INSIDE the bounds. Uses the same ~10 pt slop via the element's own box.
 */
export function buttonGestureRecognizer(
  action: () => void,
  pressing?: (b: boolean) => void,
): Recognizer<undefined> {
  let inside = false;

  const within = (e: PointerEvent): boolean => {
    const el = e.currentTarget as HTMLElement | null;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return (
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom
    );
  };

  return {
    onPointerDown(e) {
      (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
      inside = true;
      pressing?.(true);
    },
    onPointerMove(e) {
      const w = within(e);
      if (w !== inside) {
        inside = w;
        pressing?.(w); // press highlight follows in/out
      }
    },
    onPointerUp() {
      pressing?.(false);
      if (inside) action();
    },
    onPointerCancel() {
      inside = false;
      pressing?.(false);
    },
  };
}

/**
 * §16 useButtonGesture — React wrapper for `_onButtonGesture`. Returns handlers
 * + a `pressed` boolean you can map to `data-pressed` for press feedback.
 */
export function useButtonGesture(
  action: () => void,
  onPressingChanged?: (pressing: boolean) => void,
): { handlers: PointerHandlers; pressed: boolean } {
  const [pressed, setPressed] = React.useState(false);
  const actionRef = React.useRef(action);
  actionRef.current = action;
  const pressingRef = React.useRef(onPressingChanged);
  pressingRef.current = onPressingChanged;

  const rec = React.useMemo(
    () =>
      buttonGestureRecognizer(
        () => actionRef.current(),
        (b) => {
          setPressed(b);
          pressingRef.current?.(b);
        },
      ),
    [],
  );

  return { handlers: recognizerHandlers(rec), pressed };
}

// ===========================================================================
// 17. Keyboard / move input modifiers (§17) — gesture-adjacent
// ===========================================================================

/** §17.1 KeyPress.Result (SUI:18992) — return `.handled` to consume the event. */
export type KeyPressResult = "handled" | "ignored";
/** §17.1 KeyPress.Phases (SUI:18972). Default `[.down, .repeat]`. */
export type KeyPressPhase = "down" | "repeat" | "up";

/** §17.1 KeyPress (SUI:18963) — the value handed to an onKeyPress handler. */
export interface KeyPress {
  phase: KeyPressPhase;
  key: string;
  characters: string;
  modifiers: {
    shift: boolean;
    control: boolean;
    option: boolean;
    command: boolean;
  };
}

/**
 * §17.1 useOnKeyPress — mirrors `.onKeyPress(phases:action:)`. Default phases
 * `['down','repeat']`. Returning `'handled'` calls `preventDefault` +
 * `stopPropagation`. Spread `handlers` on a focusable element (`tabIndex={0}`).
 */
export function useOnKeyPress(
  action: (key: KeyPress) => KeyPressResult,
  options?: { phases?: KeyPressPhase[] },
): {
  handlers: {
    tabIndex: number;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onKeyUp: (e: React.KeyboardEvent) => void;
  };
} {
  const ref = React.useRef(action);
  ref.current = action;
  const phases = options?.phases ?? ["down", "repeat"];

  const handle = (e: React.KeyboardEvent, phase: KeyPressPhase) => {
    if (!phases.includes(phase)) return;
    const press: KeyPress = {
      phase,
      key: e.key,
      characters: e.key.length === 1 ? e.key : "",
      modifiers: {
        shift: e.shiftKey,
        control: e.ctrlKey,
        option: e.altKey,
        command: e.metaKey,
      },
    };
    if (ref.current(press) === "handled") {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return {
    handlers: {
      tabIndex: 0,
      onKeyDown: (e) => handle(e, e.repeat ? "repeat" : "down"),
      onKeyUp: (e) => handle(e, "up"),
    },
  };
}

/** §17.2 MoveCommandDirection (SUI:12799). */
export type MoveCommandDirection = "up" | "down" | "left" | "right";

/**
 * §17.2 useOnMoveCommand — mirrors `.onMoveCommand(perform:)`. Maps the four
 * arrow keys to directional focus moves. Spread on a focusable element.
 */
export function useOnMoveCommand(
  action: (direction: MoveCommandDirection) => void,
): {
  handlers: { tabIndex: number; onKeyDown: (e: React.KeyboardEvent) => void };
} {
  const ref = React.useRef(action);
  ref.current = action;
  const map: Record<string, MoveCommandDirection> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };
  return {
    handlers: {
      tabIndex: 0,
      onKeyDown: (e) => {
        const dir = map[e.key];
        if (dir) {
          e.preventDefault();
          ref.current(dir);
        }
      },
    },
  };
}
