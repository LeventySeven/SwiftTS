/**
 * Swift Charts → Web — the scale engine (§0.4, §1.3, §10.4, §11).
 *
 * Pure + SSR-safe. Builds linear / time / band scales from the union of every
 * mark's plottable values, runs the "nice numbers" tick generator, the stacking
 * layout pass, and resolves the default categorical palette + style/symbol
 * scales. No React, no DOM.
 */
import { cssVar } from "../../tokens/tokens";
import {
  type Interp,
  type Scale,
  type ScaleSpec,
  type StackingMethod,
  type StyleScaleSpec,
  type SymbolScaleSpec,
  type BasicSymbol,
  type AxisMarkValues,
  plottableKey,
  plottableNumber,
} from "./types";

/* =============================================================================
 * Default categorical palette (§2.2, §18 — system color cycle, INFERRED)
 *
 * The spec lists the dark-mode vivid hexes; we read the live tokens so the
 * palette flips with color scheme. Order: blue, green, orange, purple, red,
 * teal, yellow, pink.
 * ========================================================================== */

export const PALETTE_TOKENS = [
  "--sui-color-system-blue",
  "--sui-color-system-green",
  "--sui-color-system-orange",
  "--sui-color-system-purple",
  "--sui-color-system-red",
  "--sui-color-system-teal",
  "--sui-color-system-yellow",
  "--sui-color-system-pink",
] as const;

/** CSS `var()` refs for the default series palette (resolve at render via CSS). */
export const DEFAULT_PALETTE: string[] = PALETTE_TOKENS.map((t) => cssVar(t));

export function paletteColor(index: number): string {
  return DEFAULT_PALETTE[((index % DEFAULT_PALETTE.length) + DEFAULT_PALETTE.length) % DEFAULT_PALETTE.length];
}

/* =============================================================================
 * "Nice numbers" tick generator (§10.4)
 * ========================================================================== */

function niceNum(range: number, round: boolean): number {
  if (range === 0 || !isFinite(range)) return 1;
  const exp = Math.floor(Math.log10(Math.abs(range)));
  const frac = Math.abs(range) / Math.pow(10, exp);
  let nice: number;
  if (round) {
    if (frac < 1.5) nice = 1;
    else if (frac < 3) nice = 2;
    else if (frac < 7) nice = 5;
    else nice = 10;
  } else {
    if (frac <= 1) nice = 1;
    else if (frac <= 2) nice = 2;
    else if (frac <= 5) nice = 5;
    else nice = 10;
  }
  return nice * Math.pow(10, exp);
}

/** Generate ~`desired` round ticks spanning [d0,d1]. */
export function niceTicks(d0: number, d1: number, desired = 5): number[] {
  if (d0 === d1) return [d0];
  const span = niceNum(d1 - d0, false);
  const step = niceNum(span / Math.max(1, desired - 1), true);
  const lo = Math.floor(d0 / step) * step;
  const hi = Math.ceil(d1 / step) * step;
  const out: number[] = [];
  // guard against absurd step (NaN/0) producing an infinite loop
  if (!(step > 0)) return [d0, d1];
  for (let val = lo; val <= hi + step * 1e-9; val += step) {
    // snap tiny float error to step grid
    out.push(Math.abs(val) < step * 1e-9 ? 0 : val);
    if (out.length > 1000) break;
  }
  return out;
}

/** Resolve `AxisMarkValues` into the concrete tick number list for a linear/time scale. */
export function ticksForValues(
  values: AxisMarkValues | undefined,
  d0: number,
  d1: number,
): number[] {
  if (!values || (typeof values === "object" && "automatic" in values)) {
    return niceTicks(d0, d1, 5);
  }
  if (Array.isArray(values)) {
    return values.map(plottableNumber).filter((n) => !isNaN(n));
  }
  if ("stride" in values) {
    const step = values.stride;
    if (!(step > 0)) return niceTicks(d0, d1, 5);
    const lo = Math.ceil(d0 / step) * step;
    const out: number[] = [];
    for (let val = lo; val <= d1 + step * 1e-9; val += step) {
      out.push(val);
      if (out.length > 1000) break;
    }
    return out;
  }
  if ("desiredCount" in values) {
    return niceTicks(d0, d1, values.desiredCount);
  }
  return niceTicks(d0, d1, 5);
}

/* =============================================================================
 * Scale construction (§0.4)
 * ========================================================================== */

export interface ChannelInfo {
  kind: "number" | "string" | "time";
  /** numeric extent for linear/time channels. */
  min: number;
  max: number;
  /** ordered unique category keys for band channels. */
  categories: string[];
}

/** Fresh empty channel accumulator. */
export function emptyChannel(): ChannelInfo {
  return { kind: "number", min: Infinity, max: -Infinity, categories: [] };
}

/** Fold one observed value into a channel accumulator. */
export function observe(ch: ChannelInfo, value: unknown): void {
  if (value instanceof Date || typeof value === "number") {
    if (ch.categories.length === 0) ch.kind = value instanceof Date ? "time" : "number";
    const n = plottableNumber(value);
    if (n < ch.min) ch.min = n;
    if (n > ch.max) ch.max = n;
  } else if (value != null) {
    ch.kind = "string";
    const k = plottableKey(value);
    if (!ch.categories.includes(k)) ch.categories.push(k);
  }
}

/**
 * Build a `Scale` from an accumulated channel + pixel range + optional override.
 * `includeZero` extends a numeric domain to include the baseline (bars/areas).
 */
export function buildScale(
  ch: ChannelInfo,
  range: [number, number],
  spec?: ScaleSpec,
  includeZero = false,
): Scale {
  const [px0, px1Raw] = spec?.range ?? range;
  const startPad = spec?.startPadding ?? 0;
  const endPad = spec?.endPadding ?? 0;
  // apply padding inward from each end (range may be inverted for y)
  const dir = px1Raw >= px0 ? 1 : -1;
  const px0p = px0 + dir * startPad;
  const px1 = px1Raw - dir * endPad;

  const wantBand =
    spec?.type === "category" ||
    (!spec?.type && ch.kind === "string") ||
    (Array.isArray(spec?.domain) && typeof spec?.domain?.[0] === "string");

  if (wantBand) {
    const cats =
      (Array.isArray(spec?.domain)
        ? (spec!.domain as unknown[]).map(plottableKey)
        : undefined) ?? (ch.categories.length ? ch.categories : ["0"]);
    const step = (px1 - px0p) / cats.length;
    const index = new Map<string, number>(cats.map((c, i) => [c, i]));
    const scale: Scale = {
      kind: "band",
      domain: cats,
      range: [px0p, px1],
      categories: cats,
      scale: (value: unknown) => {
        const i = index.get(plottableKey(value)) ?? 0;
        return px0p + i * step + step / 2; // centered in slot
      },
      invert: (pixel: number) => {
        const i = Math.floor((pixel - px0p) / step);
        return cats[Math.max(0, Math.min(cats.length - 1, i))] ?? null;
      },
      bandwidth: () => Math.abs(step),
    };
    return scale;
  }

  // linear / time
  let d0: number;
  let d1: number;
  if (Array.isArray(spec?.domain) && spec.domain.length === 2 && typeof spec.domain[0] === "number") {
    d0 = spec.domain[0] as number;
    d1 = spec.domain[1] as number;
  } else {
    d0 = isFinite(ch.min) ? ch.min : 0;
    d1 = isFinite(ch.max) ? ch.max : 1;
    if (includeZero) {
      d0 = Math.min(d0, 0);
      d1 = Math.max(d1, 0);
    }
    if (d0 === d1) {
      d0 -= 1;
      d1 += 1;
    }
  }
  const span = d1 - d0 || 1;
  const scale: Scale = {
    kind: ch.kind === "time" ? "time" : "linear",
    domain: [d0, d1],
    range: [px0p, px1],
    scale: (value: unknown) => px0p + ((plottableNumber(value) - d0) / span) * (px1 - px0p),
    invert: (pixel: number) =>
      (d0 + ((pixel - px0p) / (px1 - px0p)) * span) as unknown as null,
    bandwidth: () => 0,
  };
  return scale;
}

/* =============================================================================
 * Stacking layout pass (§1.3)
 * ========================================================================== */

export interface StackRow {
  /** category key on the stacking axis (usually x). */
  cat: string;
  /** series key (stacking order). */
  series: string;
  /** raw magnitude. */
  y: number;
  /** resolved stack interval (filled by `stack`). */
  y0: number;
  y1: number;
}

/**
 * Run the stacking algorithm in-place over rows grouped by category.
 * Mirrors §1.3's pseudocode (standard / normalized / center / unstacked).
 */
export function stack(rows: StackRow[], method: StackingMethod, seriesOrder: string[]): void {
  const groups = new Map<string, StackRow[]>();
  for (const r of rows) {
    const g = groups.get(r.cat) ?? [];
    g.push(r);
    groups.set(r.cat, g);
  }
  const rank = new Map(seriesOrder.map((s, i) => [s, i]));
  for (const grp of groups.values()) {
    grp.sort((a, b) => (rank.get(a.series) ?? 0) - (rank.get(b.series) ?? 0));
    let acc = 0;
    const total = grp.reduce((s, r) => s + r.y, 0);
    for (const r of grp) {
      if (method === "unstacked") {
        r.y0 = 0;
        r.y1 = r.y;
        continue;
      }
      r.y0 = acc;
      r.y1 = acc + r.y;
      acc = r.y1;
    }
    if (method === "normalized" && total !== 0) {
      for (const r of grp) {
        r.y0 /= total;
        r.y1 /= total;
      }
    }
    if (method === "center") {
      const c = acc / 2;
      for (const r of grp) {
        r.y0 -= c;
        r.y1 -= c;
      }
    }
  }
}

/* =============================================================================
 * Style + symbol scales (§11.3)
 * ========================================================================== */

export type StyleScaleFn = (key: string, index: number) => string;

export function makeStyleScale(spec: StyleScaleSpec | undefined): StyleScaleFn {
  if (spec?.mapping) {
    const m = spec.mapping;
    return (k, i) => m[k] ?? paletteColor(i);
  }
  if (spec?.domain && spec.range) {
    const m = new Map(spec.domain.map((d, i) => [d, spec.range![i % spec.range!.length]]));
    return (k, i) => m.get(k) ?? paletteColor(i);
  }
  return (_k, i) => paletteColor(i);
}

/** Continuous heatmap color (interpolate gradient stops by normalized [0..1] value). */
export function makeGradientScale(
  spec: StyleScaleSpec | undefined,
  min: number,
  max: number,
): (value: number) => string {
  const stops = spec?.gradient ?? [
    { at: 0, color: paletteColor(0) },
    { at: 1, color: paletteColor(4) },
  ];
  const span = max - min || 1;
  return (value: number) => {
    const t = Math.max(0, Math.min(1, (value - min) / span));
    // pick the nearest stop pair; CSS color-mix interpolates crisply
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].at && t <= stops[i + 1].at) {
        lo = stops[i];
        hi = stops[i + 1];
        break;
      }
    }
    const local = hi.at === lo.at ? 0 : (t - lo.at) / (hi.at - lo.at);
    return `color-mix(in srgb, ${hi.color} ${(local * 100).toFixed(1)}%, ${lo.color})`;
  };
}

const DEFAULT_SYMBOLS: BasicSymbol[] = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "pentagon",
  "plus",
  "cross",
  "asterisk",
];

export type SymbolScaleFn = (key: string, index: number) => BasicSymbol;

export function makeSymbolScale(spec: SymbolScaleSpec | undefined): SymbolScaleFn {
  if (spec?.mapping) {
    const m = spec.mapping;
    return (k, i) => m[k] ?? DEFAULT_SYMBOLS[i % DEFAULT_SYMBOLS.length];
  }
  if (spec?.domain && spec.range) {
    const m = new Map(spec.domain.map((d, i) => [d, spec.range![i % spec.range!.length]]));
    return (k, i) => m.get(k) ?? DEFAULT_SYMBOLS[i % DEFAULT_SYMBOLS.length];
  }
  return (_k, i) => DEFAULT_SYMBOLS[i % DEFAULT_SYMBOLS.length];
}

/* re-export for marks that build their own curves */
export type { Interp };
