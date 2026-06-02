"use client";
/**
 * `BarMark` (§2) — one rounded rectangle per data row.
 *
 * Supports the 7 initializers via props: the common `x:y:` vertical bar, the
 * swapped horizontal bar, ranged (`xStart/xEnd`, `yStart/yEnd`) bars, plus
 * `width`/`height` (`MarkDimension`), `stacking`, `position(by:)` dodging, and
 * `cornerRadius`. Vertical bars grow from `yScale(0)`; stacking offsets come
 * from the container's stack pass (§1.3).
 */
import * as React from "react";
import { useChart } from "./context";
import {
  type MarkModifierProps,
  resolveMarkColor,
  styleKeyOf,
  emphasisOpacity,
  offsetTransform,
} from "./mark-common";
import {
  type MarkDimension,
  type PlottableValue,
  type StackingMethod,
  type ValueOrNumber,
  resolveDim,
  plottableKey,
  plottableNumber,
  isPlottable,
} from "./types";

export interface BarMarkProps extends MarkModifierProps {
  x?: PlottableValue;
  y?: PlottableValue;
  xStart?: ValueOrNumber;
  xEnd?: ValueOrNumber;
  yStart?: ValueOrNumber;
  yEnd?: ValueOrNumber;
  /** vertical bar width / horizontal bar height. default .automatic */
  width?: MarkDimension;
  height?: MarkDimension;
  stacking?: StackingMethod;
  /** `position(by:)` — dodge into sub-band slots (grouped bars). §9.2 */
  positionBy?: PlottableValue;
  /** default bar corner radius (DESIGNED 4). §2.2 */
  cornerRadius?: number;
}

const DEFAULT_CORNER = 4;

export function BarMark(props: BarMarkProps): React.ReactElement | null {
  const ctx = useChart();
  const styleKey = styleKeyOf(props);
  const seriesKey = props.foregroundStyleBy ? plottableKey(props.foregroundStyleBy.value) : "__default__";

  // ---- COLLECT pass -------------------------------------------------------
  if (ctx.collecting) {
    const orientation = props.y && !props.x ? "horizontal" : "vertical";
    const catKey = orientation === "vertical" ? keyOf(props.x) : keyOf(props.y);
    const mag =
      orientation === "vertical"
        ? plottableNumber(props.y?.value ?? num(props.yEnd))
        : plottableNumber(props.x?.value ?? num(props.xEnd));

    const isStacked = props.stacking !== "unstacked" && !props.yStart && !props.yEnd;
    ctx.register({
      type: "bar",
      xs: collectX(props),
      ys: collectY(props),
      styleKeys: styleKey ? [styleKey] : [],
      symbolKeys: [],
      xLabel: props.x?.label ?? (props.xStart != null ? labelOf(props.xStart) : undefined),
      yLabel: props.y?.label ?? (props.yStart != null ? labelOf(props.yStart) : undefined),
      baselineZero: true,
      stacking: props.stacking,
      stackRows:
        isStacked && catKey != null && !isNaN(mag)
          ? [{ cat: catKey, series: seriesKey, y: mag }]
          : undefined,
      groupKeys: props.positionBy ? [plottableKey(props.positionBy.value)] : undefined,
    });
    return null;
  }

  // ---- RENDER pass --------------------------------------------------------
  const { xScale, yScale } = ctx;
  const fill = resolveMarkColor(ctx, props, styleKey);
  const radius = props.cornerRadius ?? DEFAULT_CORNER;

  const orientation = props.y && !props.x ? "horizontal" : "vertical";

  if (orientation === "vertical") {
    const cat = props.x;
    if (!cat) return null;
    let bandStep = xScale.bandwidth() || 0;
    let cx = xScale.scale(cat.value);

    // position(by:) dodging — partition band into sub-slots (§9.2)
    if (ctx.dodge && props.positionBy) {
      const gi = ctx.dodge.order.indexOf(plottableKey(props.positionBy.value));
      const sub = bandStep / ctx.dodge.count;
      cx = cx - bandStep / 2 + gi * sub + sub / 2;
      bandStep = sub;
    }

    const barW = resolveDim(props.width, bandStep);

    // y extent: explicit yStart/yEnd, else stacked [y0,y1], else [0, value]
    let y0Data: number;
    let y1Data: number;
    if (props.yStart != null || props.yEnd != null) {
      y0Data = num(props.yStart) ?? 0;
      y1Data = num(props.yEnd) ?? plottableNumber(props.y?.value ?? 0);
    } else {
      const stk = ctx.stackLookup(keyOf(cat) ?? "", seriesKey);
      if (stk) {
        y0Data = stk.y0;
        y1Data = stk.y1;
      } else {
        y0Data = 0;
        y1Data = plottableNumber(props.y?.value ?? 0);
      }
    }
    const py0 = yScale.scale(y0Data);
    const py1 = yScale.scale(y1Data);
    const y = Math.min(py0, py1);
    const h = Math.abs(py1 - py0);
    return (
      <rect
        className="sui-barmark"
        x={cx - barW / 2}
        y={y}
        width={barW}
        height={h}
        rx={Math.min(radius, barW / 2)}
        ry={Math.min(radius, h / 2)}
        fill={fill}
        opacity={emphasisOpacity(ctx, keyOf(cat), props.opacity ?? 1)}
        transform={offsetTransform(props)}
        aria-label={props.accessibilityLabel}
        aria-hidden={props.accessibilityHidden}
        data-testid={props.accessibilityIdentifier}
      />
    );
  }

  // horizontal bar (swap axes)
  const catY = props.y;
  if (!catY) return null;
  const bandStepY = yScale.bandwidth() || 0;
  const cy = yScale.scale(catY.value);
  const barH = resolveDim(props.height, bandStepY);
  const x0Data = num(props.xStart) ?? 0;
  const x1Data = num(props.xEnd) ?? plottableNumber(props.x?.value ?? 0);
  const px0 = xScale.scale(x0Data);
  const px1 = xScale.scale(x1Data);
  const x = Math.min(px0, px1);
  const w = Math.abs(px1 - px0);
  return (
    <rect
      className="sui-barmark"
      x={x}
      y={cy - barH / 2}
      width={w}
      height={barH}
      rx={Math.min(radius, w / 2)}
      ry={Math.min(radius, barH / 2)}
      fill={fill}
      opacity={emphasisOpacity(ctx, keyOf(catY), props.opacity ?? 1)}
      transform={offsetTransform(props)}
      aria-label={props.accessibilityLabel}
      aria-hidden={props.accessibilityHidden}
      data-testid={props.accessibilityIdentifier}
    />
  );
}

BarMark.displayName = "BarMark";

/* ---- helpers ------------------------------------------------------------- */

function keyOf(v?: PlottableValue): string | undefined {
  return v ? plottableKey(v.value) : undefined;
}
function labelOf(v: ValueOrNumber): string | undefined {
  return isPlottable(v) ? v.label : undefined;
}
function num(v?: ValueOrNumber): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  return plottableNumber(v.value);
}
function collectX(p: BarMarkProps): unknown[] {
  const out: unknown[] = [];
  if (p.x) out.push(p.x);
  if (isPlottable(p.xStart)) out.push(p.xStart);
  if (isPlottable(p.xEnd)) out.push(p.xEnd);
  if (typeof p.xStart === "number") out.push(p.xStart);
  if (typeof p.xEnd === "number") out.push(p.xEnd);
  return out;
}
function collectY(p: BarMarkProps): unknown[] {
  const out: unknown[] = [];
  if (p.y) out.push(p.y);
  if (isPlottable(p.yStart)) out.push(p.yStart);
  if (isPlottable(p.yEnd)) out.push(p.yEnd);
  if (typeof p.yStart === "number") out.push(p.yStart);
  if (typeof p.yEnd === "number") out.push(p.yEnd);
  return out;
}
