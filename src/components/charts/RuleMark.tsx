"use client";
/**
 * `RuleMark` (§6) — a full- or partial-span straight reference line.
 *
 * Horizontal rule: `y:` (+ optional `xStart/xEnd`) → threshold/average line.
 * Vertical rule: `x:` (+ optional `yStart/yEnd`) → selection lollipop spine.
 * Nil start/end ⇒ spans the whole plot. Default stroke 1pt; pair with
 * `lineStyle={{ dash:[5,5] }}` for dashed thresholds.
 */
import * as React from "react";
import { useChart, type ChartRender } from "./context";
import {
  type MarkModifierProps,
  resolveMarkColor,
  styleKeyOf,
  strokeAttrs,
  offsetTransform,
} from "./mark-common";
import {
  type PlottableValue,
  type ValueOrNumber,
  isPlottable,
  plottableNumber,
} from "./types";

export interface RuleMarkProps extends MarkModifierProps {
  x?: PlottableValue;
  y?: PlottableValue;
  xStart?: ValueOrNumber;
  xEnd?: ValueOrNumber;
  yStart?: ValueOrNumber;
  yEnd?: ValueOrNumber;
}

const DEFAULT_RULE_WIDTH = 1;

export function RuleMark(props: RuleMarkProps): React.ReactElement | null {
  const ctx = useChart();
  const styleKey = styleKeyOf(props);

  if (ctx.collecting) {
    ctx.register({
      type: "rule",
      xs: collect([props.x, props.xStart, props.xEnd]),
      ys: collect([props.y, props.yStart, props.yEnd]),
      styleKeys: styleKey ? [styleKey] : [],
      symbolKeys: [],
      xLabel: props.x?.label,
      yLabel: props.y?.label,
    });
    return null;
  }

  const { xScale, yScale, plot } = ctx;
  const stroke = resolveMarkColor(ctx, props, styleKey);
  const sa = strokeAttrs(props.lineStyle, DEFAULT_RULE_WIDTH);
  const common = {
    className: "sui-rulemark",
    stroke,
    strokeWidth: sa.strokeWidth,
    strokeDasharray: sa.strokeDasharray,
    strokeLinecap: sa.strokeLinecap,
    opacity: props.opacity ?? 1,
    transform: offsetTransform(props),
    "aria-label": props.accessibilityLabel,
    "aria-hidden": props.accessibilityHidden,
    "data-testid": props.accessibilityIdentifier,
  };

  // horizontal rule (y given) vs vertical rule (x given)
  if (props.y) {
    const py = yScale.scale(props.y.value);
    const x1 = coordX(ctx, props.xStart, plot.x);
    const x2 = coordX(ctx, props.xEnd, plot.x + plot.w);
    return <line {...common} x1={x1} x2={x2} y1={py} y2={py} />;
  }
  if (props.x) {
    const px = xScale.scale(props.x.value);
    const y1 = coordY(ctx, props.yStart, plot.y + plot.h);
    const y2 = coordY(ctx, props.yEnd, plot.y);
    return <line {...common} x1={px} x2={px} y1={y1} y2={y2} />;
  }
  return null;
}

RuleMark.displayName = "RuleMark";

function collect(vals: Array<PlottableValue | ValueOrNumber | undefined>): unknown[] {
  return vals.filter((v) => isPlottable(v)) as unknown[];
}
function coordX(ctx: ChartRender, v: ValueOrNumber | undefined, fallback: number): number {
  if (v == null) return fallback;
  if (typeof v === "number") return v;
  return ctx.xScale.scale(v.value);
}
function coordY(ctx: ChartRender, v: ValueOrNumber | undefined, fallback: number): number {
  if (v == null) return fallback;
  if (typeof v === "number") return v;
  return ctx.yScale.scale(plottableNumber(v.value));
}
