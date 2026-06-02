/**
 * Swift Charts → Web (SVG) — shared vocabulary.
 *
 * RE'd from `teardowns/SWIFTUI_C14_charts.md`. Mirrors the grammar-of-graphics
 * primitives: `PlottableValue` (§1.1), `MarkDimension` (§1.2),
 * `MarkStackingMethod` (§1.3), `InterpolationMethod` (§1.4), and the scale /
 * axis / legend config objects (§9–§14).
 *
 * Pure types + the tiny pure `v()` constructor — SSR-safe, no React, no DOM.
 */

/* =============================================================================
 * Plottable values (§1.1)
 * ========================================================================== */

/** Discriminator the scale builder switches on (number→linear, string→band, Date→time). */
export type PlottableKind = "number" | "string" | "time";

/** A `PlottableValue<T>` — a (label, value) pair bound to a channel. */
export interface PlottableValue<T = unknown> {
  /** Channel display name → axis title + legend key. */
  label: string;
  value: T;
  kind: PlottableKind;
  /** Range form (binned/aggregated data): `.value(_, Range<Value>)`. */
  range?: { lo: number; hi: number };
}

/** `plottableKind(x)` — Date→time, number→number, else string. */
export function plottableKind(x: unknown): PlottableKind {
  return x instanceof Date ? "time" : typeof x === "number" ? "number" : "string";
}

/** Numeric coordinate of any plottable value (Date→epoch ms, number→itself). */
export function plottableNumber(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return NaN;
}

/** Stable key for a categorical/band value. */
export function plottableKey(value: unknown): string {
  if (value instanceof Date) return String(value.getTime());
  return String(value);
}

/**
 * `PlottableValue.value(label, value)` — the `v("Month", row.month)` constructor.
 * Overload for the `Range` form: `v("Bin", { lo, hi })`.
 */
export function v<T>(label: string, value: T): PlottableValue<T> {
  if (
    value != null &&
    typeof value === "object" &&
    "lo" in (value as object) &&
    "hi" in (value as object)
  ) {
    const r = value as unknown as { lo: number; hi: number };
    return { label, value, kind: "number", range: { lo: r.lo, hi: r.hi } };
  }
  return { label, value, kind: plottableKind(value) };
}

/** Accept either a `PlottableValue` or a bare number (the `CGFloat?` plot-space forms). */
export type ValueOrNumber<T = unknown> = PlottableValue<T> | number;

export function isPlottable(x: unknown): x is PlottableValue {
  return typeof x === "object" && x != null && "value" in (x as object) && "kind" in (x as object);
}

/* =============================================================================
 * MarkDimension (§1.2) — bar / rect / sector sizing
 * ========================================================================== */

export type MarkDimension =
  | { automatic: true }
  | { fixed: number }
  | { ratio: number }
  | { inset: number }
  | number; // integer/float literal ⇒ .fixed

export const MarkDimension = {
  automatic: { automatic: true } as MarkDimension,
  fixed: (value: number): MarkDimension => ({ fixed: value }),
  ratio: (value: number): MarkDimension => ({ ratio: value }),
  inset: (value: number): MarkDimension => ({ inset: value }),
};

/** Default band paddingInner (DESIGNED — matches Charts bar gaps). §0.4 */
export const DEFAULT_PADDING_INNER = 0.2;

/**
 * Resolve a `MarkDimension` against the band step.
 *  - `.automatic` → step * (1 - paddingInner)
 *  - `.ratio(r)`  → step * r
 *  - `.inset(i)`  → step - 2*i
 *  - `.fixed(px)` / number → px
 */
export function resolveDim(
  d: MarkDimension | undefined,
  bandStep: number,
  paddingInner = DEFAULT_PADDING_INNER,
): number {
  if (d == null) return bandStep * (1 - paddingInner);
  if (typeof d === "number") return d;
  if ("fixed" in d) return d.fixed;
  if ("ratio" in d) return bandStep * d.ratio;
  if ("inset" in d) return bandStep - 2 * d.inset;
  return bandStep * (1 - paddingInner);
}

/* =============================================================================
 * MarkStackingMethod (§1.3)
 * ========================================================================== */

export type StackingMethod = "standard" | "normalized" | "center" | "unstacked";

/* =============================================================================
 * InterpolationMethod (§1.4)
 * ========================================================================== */

export type Interp =
  | "linear"
  | "monotone"
  | "stepStart"
  | "stepCenter"
  | "stepEnd"
  | { cardinal: number } // tension, default 0
  | { catmullRom: number }; // alpha, default 0.5

export const InterpolationMethod = {
  linear: "linear" as Interp,
  monotone: "monotone" as Interp,
  cardinal: { cardinal: 0 } as Interp, // tension default 0 (KNOWN)
  catmullRom: { catmullRom: 0.5 } as Interp, // alpha default 0.5 (KNOWN)
  stepStart: "stepStart" as Interp,
  stepCenter: "stepCenter" as Interp,
  stepEnd: "stepEnd" as Interp,
};

/* =============================================================================
 * StrokeStyle (§3, §6, §9.1)
 * ========================================================================== */

export interface StrokeStyle {
  lineWidth?: number;
  dash?: number[];
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "miter" | "round" | "bevel";
}

/* =============================================================================
 * Style / symbol scales (§11)
 * ========================================================================== */

export type ScaleType =
  | "linear"
  | "log"
  | "date"
  | "category"
  | "squareRoot"
  | "symmetricLog";

/** A position-scale override (`chartXScale`/`chartYScale`). §11.1 */
export interface ScaleSpec<T = unknown> {
  /** Numeric closed range `[lo,hi]` OR an explicit category list. */
  domain?: [number, number] | T[];
  /** Pixel range override; flips when `[hi,lo]`. */
  range?: [number, number];
  type?: ScaleType;
  /** `.plotDimension(startPadding:endPadding:)` — extra pixels inside the range. */
  startPadding?: number;
  endPadding?: number;
}

/** Foreground-style scale (`chartForegroundStyleScale`). §11.2 */
export interface StyleScaleSpec {
  /** Explicit `KeyValuePairs` map: `{ Asia:'#0A84FF', … }`. */
  mapping?: Record<string, string>;
  /** `domain` + `range` arrays (zipped, cycled). */
  domain?: string[];
  range?: string[];
  /** Continuous heatmap: gradient stops keyed by normalized value [0..1]. */
  gradient?: Array<{ at: number; color: string }>;
  type?: ScaleType;
}

export type BasicSymbol =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "plus"
  | "cross"
  | "asterisk";

export interface SymbolScaleSpec {
  mapping?: Record<string, BasicSymbol>;
  domain?: string[];
  range?: BasicSymbol[];
}

/* =============================================================================
 * Annotation (§9.5)
 * ========================================================================== */

export type AnnotationPosition =
  | "automatic"
  | "overlay"
  | "top"
  | "bottom"
  | "leading"
  | "trailing"
  | "topLeading"
  | "topTrailing"
  | "bottomLeading"
  | "bottomTrailing";

export interface AnnotationSpec {
  position?: AnnotationPosition;
  alignment?: string;
  spacing?: number;
  content: import("react").ReactNode;
}

/* =============================================================================
 * Axis config (§10)
 * ========================================================================== */

export type AxisMarkPosition = "automatic" | "leading" | "trailing" | "top" | "bottom";

export type AxisMarkValues =
  | { automatic: true }
  | { desiredCount: number; roundLowerBound?: boolean; roundUpperBound?: boolean }
  | { stride: number }
  | number[];

export type LabelOrientation =
  | "automatic"
  | "horizontal"
  | "vertical"
  | "verticalReversed";

export type Collision = "automatic" | "greedy" | "truncate" | "disabled";

export interface AxisGridLineSpec {
  centered?: boolean;
  stroke?: StrokeStyle;
  hidden?: boolean;
}
export interface AxisTickSpec {
  centered?: boolean;
  length?: "automatic" | "label" | "longestLabel" | number;
  stroke?: StrokeStyle;
  hidden?: boolean;
}
export interface AxisValueLabelSpec {
  orientation?: LabelOrientation;
  collision?: Collision;
  format?: (value: unknown) => string;
  hidden?: boolean;
}

/** A resolved `chartXAxis`/`chartYAxis` configuration. */
export interface AxisSpec {
  visibility?: "visible" | "hidden" | "automatic";
  position?: AxisMarkPosition;
  values?: AxisMarkValues;
  gridline?: AxisGridLineSpec | false;
  tick?: AxisTickSpec | false;
  label?: AxisValueLabelSpec | false;
  /** `chartXAxisLabel` / `chartYAxisLabel` — the overall axis title. */
  title?: string;
}

/* =============================================================================
 * Legend (§14)
 * ========================================================================== */

export interface LegendSpec {
  position?: AnnotationPosition;
  visible?: boolean;
  items?: Array<{ key: string; color: string; shape: string }>;
}
export type LegendOption = "automatic" | "visible" | "hidden" | LegendSpec;

/* =============================================================================
 * Scale runtime object (§0.4) — the pixel mapper handed to marks via context.
 * ========================================================================== */

export interface Scale<T = unknown> {
  kind: "linear" | "band" | "time";
  /** Numeric domain pair (linear/time) OR category key list (band). */
  domain: [number, number] | string[];
  range: [number, number];
  /** value → pixel. */
  scale: (value: T) => number;
  /** pixel → value (selection / proxy). */
  invert: (px: number) => T | null;
  /** band step width (categorical channels). */
  bandwidth: () => number;
  /** raw category list (band) for axis tick generation. */
  categories?: string[];
}
