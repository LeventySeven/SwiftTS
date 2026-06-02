"use client";
/**
 * Swift Charts → Web — React context plumbing.
 *
 * The container runs two passes (replacing Charts' `_collect…`/`_layout…`/
 * `_render…` phases with one React tree): a COLLECT pass where marks push their
 * plottable values + style keys into a registry, then a RENDER pass where the
 * built scales + plot rect are exposed via `ChartContext` so each mark positions
 * itself. Mirrors §0.4 / §17.4.
 */
import { createContext, useContext } from "react";
import type { Scale, StyleScaleSpec, SymbolScaleSpec } from "./types";
import type { StyleScaleFn, SymbolScaleFn } from "./scales";

/** A normalized data row a mark contributes during the COLLECT pass. */
export interface CollectedMark {
  type: "bar" | "line" | "point" | "area" | "rule" | "rect" | "sector";
  /** x channel observations (plottable values or numbers). */
  xs: unknown[];
  /** y channel observations. */
  ys: unknown[];
  /** style-by category keys (drive foregroundStyleScale + legend). */
  styleKeys: string[];
  /** symbol-by category keys. */
  symbolKeys: string[];
  /** channel labels for axis titles. */
  xLabel?: string;
  yLabel?: string;
  /** marks that draw from a numeric baseline extend the y-domain to 0. */
  baselineZero?: boolean;
  /** stacking contributions: (category key, series key, magnitude) for stacked bars/areas. */
  stackRows?: Array<{ cat: string; series: string; y: number }>;
  /** stacking method for this mark group. */
  stacking?: import("./types").StackingMethod;
  /** group keys for position(by:) dodging (sub-band partition). */
  groupKeys?: string[];
  /** for line/area/point: the (series, x, y) point this declaration contributes. */
  point?: { series: string; x: unknown; y: unknown };
  /** for sector: the (category, magnitude) slice this declaration contributes. */
  sector?: { key: string; value: number };
}

/** The COLLECT-pass registrar handed to marks via context. */
export interface ChartCollector {
  register: (mark: CollectedMark) => void;
  collecting: true;
}

/** The RENDER-pass scale bundle (= a `ChartProxy` + the geometry). */
export interface ChartRender {
  collecting: false;
  xScale: Scale;
  yScale: Scale;
  /** plot rectangle in svg pixel space. */
  plot: { x: number; y: number; w: number; h: number };
  /** full svg box. */
  size: { width: number; height: number };
  /** categorical color encoding (foregroundStyle(by:)). */
  styleScale: StyleScaleFn;
  /** categorical symbol encoding (symbol(by:)). */
  symbolScale: SymbolScaleFn;
  /** ordered category domain for legend + style index assignment. */
  styleDomain: string[];
  /** continuous heatmap color scale (RectangleMark foregroundStyleBy). */
  gradientScale?: (value: number) => string;
  /** explicit scale spec carriers (for marks that need raw domain). */
  styleSpec?: StyleScaleSpec;
  symbolSpec?: SymbolScaleSpec;
  /** current selection key/value (drives dim-others emphasis). §13 */
  selectedKey?: string | null;
  /**
   * Stack lookup for bars/areas: maps `${cat}|${series}` → resolved [y0,y1] in
   * DATA space (pre-scale). Computed once by the container in the collect pass.
   * §1.3
   */
  stackLookup: (cat: string, series: string) => { y0: number; y1: number } | undefined;
  /**
   * Dodge lookup for position(by:): maps a group key → { offset, width } as a
   * fraction of the band step. §9.2
   */
  dodge: { order: string[]; count: number } | null;
  /**
   * Series-point aggregation for line/area/point marks. Maps
   * `${markType}|${series}` → the ordered point list contributed by every mark
   * of that series, so a single rendered element can draw the connected path.
   * §3 / §4 / §5.
   */
  series: Map<string, Array<{ x: unknown; y: unknown }>>;
  /**
   * Claim ledger: the first rendered mark of a (type, series) draws the whole
   * series and claims it; siblings render null. Mutated during render.
   */
  claimed: Set<string>;
  /**
   * Sector slices in declaration order with normalized cumulative angles
   * (radians, clockwise from 12 o'clock). §8.
   */
  sectors: Array<{ key: string; value: number; a0: number; a1: number; index: number }>;
}

export type ChartCtx = ChartCollector | ChartRender;

export const ChartContext = createContext<ChartCtx | null>(null);

/** Marks read this; throws if used outside a `<Chart>`. */
export function useChart(): ChartCtx {
  const ctx = useContext(ChartContext);
  if (!ctx) {
    throw new Error("Chart marks must be rendered inside a <Chart>.");
  }
  return ctx;
}

/** Index of a style category in the domain → palette slot. */
export function styleIndex(render: ChartRender, key: string): number {
  const i = render.styleDomain.indexOf(key);
  return i < 0 ? 0 : i;
}
