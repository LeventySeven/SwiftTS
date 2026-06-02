"use client";
/**
 * `ChartProxy` + `chartOverlay` / `chartBackground` (§12) — the scale bridge.
 *
 * `ChartOverlay` draws ABOVE marks (gestures/tooltips/crosshairs); placed after
 * the marks group. `ChartBackground` draws BELOW. Both pass a `ChartProxy`
 * (`positionForX`/`valueAtX`/`plotFrame`) to a render-prop so callers convert
 * between data and pixels.
 */
import * as React from "react";
import { useChart, type ChartRender } from "./context";

export interface ChartProxy {
  positionForX(value: unknown): number | null;
  positionForY(value: unknown): number | null;
  positionFor(p: { x: unknown; y: unknown }): { x: number; y: number } | null;
  valueAtX(px: number): unknown;
  valueAtY(px: number): unknown;
  plotSize: { width: number; height: number };
  plotFrame: { x: number; y: number; width: number; height: number };
}

function makeProxy(ctx: ChartRender): ChartProxy {
  return {
    positionForX: (v) => (v == null ? null : ctx.xScale.scale(v)),
    positionForY: (v) => (v == null ? null : ctx.yScale.scale(v)),
    positionFor: (p) => ({ x: ctx.xScale.scale(p.x), y: ctx.yScale.scale(p.y) }),
    valueAtX: (px) => ctx.xScale.invert(px),
    valueAtY: (px) => ctx.yScale.invert(px),
    plotSize: { width: ctx.plot.w, height: ctx.plot.h },
    plotFrame: { x: ctx.plot.x, y: ctx.plot.y, width: ctx.plot.w, height: ctx.plot.h },
  };
}

export interface ChartProxyChildren {
  children: (proxy: ChartProxy) => React.ReactNode;
}

export function ChartOverlay({ children }: ChartProxyChildren): React.ReactElement | null {
  const ctx = useChart();
  if (ctx.collecting) return null;
  return <g className="sui-chart-overlay">{children(makeProxy(ctx))}</g>;
}
ChartOverlay.displayName = "ChartOverlay";

export function ChartBackground({ children }: ChartProxyChildren): React.ReactElement | null {
  const ctx = useChart();
  if (ctx.collecting) return null;
  return <g className="sui-chart-background">{children(makeProxy(ctx))}</g>;
}
ChartBackground.displayName = "ChartBackground";
