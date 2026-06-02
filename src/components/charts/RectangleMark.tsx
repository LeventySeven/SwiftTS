"use client";
/**
 * `RectangleMark` (§7) — a rectangle spanning `[xStart,xEnd] × [yStart,yEnd]`,
 * with no baseline semantics and no auto-stacking.
 *
 * The `x:y:` (both categorical) form is the heatmap cell — one rect per (x,y)
 * category, colored by a continuous `foregroundStyleBy` through the container's
 * gradient scale. Otherwise spans explicit start/end intervals; `.automatic`
 * width/height fall back to the band step.
 */
import * as React from "react";
import { useChart } from "./context";
import {
  type MarkModifierProps,
  resolveMarkColor,
  styleKeyOf,
  offsetTransform,
} from "./mark-common";
import {
  type MarkDimension,
  type PlottableValue,
  type ValueOrNumber,
  resolveDim,
  isPlottable,
  plottableNumber,
} from "./types";

export interface RectangleMarkProps extends MarkModifierProps {
  x?: PlottableValue;
  y?: PlottableValue;
  xStart?: ValueOrNumber;
  xEnd?: ValueOrNumber;
  yStart?: ValueOrNumber;
  yEnd?: ValueOrNumber;
  width?: MarkDimension;
  height?: MarkDimension;
  /** continuous value for heatmap coloring (with a gradient style scale). */
  colorValue?: number;
}

export function RectangleMark(props: RectangleMarkProps): React.ReactElement | null {
  const ctx = useChart();
  const styleKey = styleKeyOf(props);

  if (ctx.collecting) {
    const ys: unknown[] = [];
    if (props.y) ys.push(props.y);
    if (isPlottable(props.yStart)) ys.push(props.yStart);
    if (isPlottable(props.yEnd)) ys.push(props.yEnd);
    if (props.colorValue != null) ys.push(props.colorValue);
    ctx.register({
      type: "rect",
      xs: collectX(props),
      ys,
      styleKeys: styleKey ? [styleKey] : [],
      symbolKeys: [],
      xLabel: props.x?.label,
      yLabel: props.y?.label,
    });
    return null;
  }

  const { xScale, yScale } = ctx;

  // x extent
  const xStart = numX(ctx, props.xStart);
  const xEnd = numX(ctx, props.xEnd);
  let x: number;
  let w: number;
  if (xStart != null && xEnd != null) {
    x = Math.min(xStart, xEnd);
    w = Math.abs(xEnd - xStart);
  } else if (props.x) {
    const step = xScale.bandwidth() || 0;
    const cw = resolveDim(props.width, step, 0); // rect default = full cell (no gap)
    x = xScale.scale(props.x.value) - cw / 2;
    w = cw;
  } else {
    x = ctx.plot.x;
    w = ctx.plot.w;
  }

  // y extent
  const yStart = numY(ctx, props.yStart);
  const yEnd = numY(ctx, props.yEnd);
  let y: number;
  let h: number;
  if (yStart != null && yEnd != null) {
    y = Math.min(yStart, yEnd);
    h = Math.abs(yEnd - yStart);
  } else if (props.y) {
    const step = yScale.bandwidth() || 0;
    const ch = resolveDim(props.height, step, 0);
    y = yScale.scale(props.y.value) - ch / 2;
    h = ch;
  } else {
    y = ctx.plot.y;
    h = ctx.plot.h;
  }

  // heatmap color: gradient scale over colorValue, else categorical/explicit
  let fill: string;
  if (props.colorValue != null && ctx.gradientScale && props.foregroundStyle == null) {
    fill = ctx.gradientScale(props.colorValue);
  } else {
    fill = resolveMarkColor(ctx, props, styleKey);
  }

  return (
    <rect
      className="sui-rectmark"
      x={x}
      y={y}
      width={w}
      height={h}
      rx={props.cornerRadius ?? 0}
      fill={fill}
      opacity={props.opacity ?? 1}
      transform={offsetTransform(props)}
      aria-label={props.accessibilityLabel}
      aria-hidden={props.accessibilityHidden}
      data-testid={props.accessibilityIdentifier}
    />
  );
}

RectangleMark.displayName = "RectangleMark";

function collectX(p: RectangleMarkProps): unknown[] {
  const out: unknown[] = [];
  if (p.x) out.push(p.x);
  if (isPlottable(p.xStart)) out.push(p.xStart);
  if (isPlottable(p.xEnd)) out.push(p.xEnd);
  return out;
}
function numX(ctx: { xScale: { scale: (v: unknown) => number } }, v: ValueOrNumber | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  return ctx.xScale.scale(v.value);
}
function numY(ctx: { yScale: { scale: (v: unknown) => number } }, v: ValueOrNumber | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  return ctx.yScale.scale(plottableNumber(v.value));
}
