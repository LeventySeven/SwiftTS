"use client";
/**
 * `LineMark` (§3) — one `<path>` stroke per series, points sorted by x.
 *
 * The `series:` form is the multi-line key: every distinct series value becomes
 * its own connected polyline. Default stroke 2pt, round caps/joins, `.linear`
 * interpolation. The container aggregates per-row points into series; the first
 * rendered mark of a series draws the whole path, siblings render null.
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
import { linePath, type Pt } from "./paths";
import {
  type Interp,
  type PlottableValue,
  plottableKey,
} from "./types";

export interface LineMarkProps extends MarkModifierProps {
  x: PlottableValue;
  y: PlottableValue;
  /** multi-line key — each distinct series → its own polyline. */
  series?: PlottableValue;
  /** `.interpolationMethod(_:)`. default 'linear'. */
  interpolationMethod?: Interp;
}

const DEFAULT_LINE_WIDTH = 2;

export function LineMark(props: LineMarkProps): React.ReactElement | null {
  const ctx = useChart();
  const seriesKey = seriesKeyOf(props);

  if (ctx.collecting) {
    const styleKey = styleKeyOf(props) ?? (props.series ? plottableKey(props.series.value) : undefined);
    ctx.register({
      type: "line",
      xs: [props.x],
      ys: [props.y],
      styleKeys: styleKey ? [styleKey] : [],
      symbolKeys: [],
      xLabel: props.x.label,
      yLabel: props.y.label,
      point: { series: seriesKey, x: props.x.value, y: props.y.value },
    });
    return null;
  }

  // RENDER: only the first mark per series draws the connected path
  const claim = `line|${seriesKey}`;
  if (ctx.claimed.has(claim)) return null;
  ctx.claimed.add(claim);
  return renderSeries(ctx, props, seriesKey);
}

LineMark.displayName = "LineMark";

function renderSeries(
  ctx: ChartRender,
  props: LineMarkProps,
  seriesKey: string,
): React.ReactElement | null {
  const pts = ctx.series.get(`line|${seriesKey}`) ?? [];
  if (pts.length === 0) return null;
  const styleKey = styleKeyOf(props) ?? (seriesKey !== "__default__" ? seriesKey : undefined);
  const stroke = resolveMarkColor(ctx, props, styleKey);
  const sa = strokeAttrs(props.lineStyle, DEFAULT_LINE_WIDTH);

  const px: Pt[] = pts
    .map((p) => ({ x: ctx.xScale.scale(p.x), y: ctx.yScale.scale(p.y) }))
    .sort((a, b) => a.x - b.x);

  const d = linePath(px, props.interpolationMethod ?? "linear");
  return (
    <path
      className="sui-linemark"
      fill="none"
      stroke={stroke}
      strokeWidth={sa.strokeWidth}
      strokeDasharray={sa.strokeDasharray}
      strokeLinecap={sa.strokeLinecap}
      strokeLinejoin={sa.strokeLinejoin}
      opacity={props.opacity ?? 1}
      transform={offsetTransform(props)}
      d={d}
      aria-label={props.accessibilityLabel}
      aria-hidden={props.accessibilityHidden}
      data-testid={props.accessibilityIdentifier}
    />
  );
}

function seriesKeyOf(props: LineMarkProps): string {
  if (props.series) return plottableKey(props.series.value);
  if (props.foregroundStyleBy) return plottableKey(props.foregroundStyleBy.value);
  return "__default__";
}
