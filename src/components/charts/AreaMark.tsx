"use client";
/**
 * `AreaMark` (§4) — a filled `<path>`: the line plus a closing edge back along
 * the baseline (or the `yStart` edge for a band).
 *
 * Forms: basic `x:y:` area (filled from baseline), the `yStart:yEnd:` band area
 * (ribbon between two Y values), and `series:` stacked areas. Fill is the series
 * color at full opacity when stacked, ~0.7 for a single overlay. Top edge uses
 * the chosen `InterpolationMethod`.
 */
import * as React from "react";
import { useChart, type ChartRender } from "./context";
import {
  type MarkModifierProps,
  resolveMarkColor,
  styleKeyOf,
  offsetTransform,
} from "./mark-common";
import { areaPath, type Pt } from "./paths";
import {
  type Interp,
  type PlottableValue,
  type StackingMethod,
  plottableKey,
  plottableNumber,
} from "./types";

export interface AreaMarkProps extends MarkModifierProps {
  x?: PlottableValue;
  y?: PlottableValue;
  /** band area (ribbon): fill between yStart and yEnd. */
  yStart?: PlottableValue;
  yEnd?: PlottableValue;
  series?: PlottableValue;
  stacking?: StackingMethod;
  interpolationMethod?: Interp;
  /** explicit fill opacity (default: 1 stacked / 0.7 single). */
  fillOpacity?: number;
}

export function AreaMark(props: AreaMarkProps): React.ReactElement | null {
  const ctx = useChart();
  const seriesKey = seriesKeyOf(props);
  const isBand = props.yStart != null && props.yEnd != null;

  if (ctx.collecting) {
    const styleKey =
      styleKeyOf(props) ?? (props.series ? plottableKey(props.series.value) : undefined);
    const yMag = props.y ? plottableNumber(props.y.value) : NaN;
    ctx.register({
      type: "area",
      xs: props.x ? [props.x] : [],
      ys: collectYs(props),
      styleKeys: styleKey ? [styleKey] : [],
      symbolKeys: [],
      xLabel: props.x?.label,
      yLabel: props.y?.label ?? props.yStart?.label,
      baselineZero: !isBand,
      stacking: props.stacking,
      stackRows:
        !isBand && props.x && props.stacking !== "unstacked" && !isNaN(yMag)
          ? [{ cat: plottableKey(props.x.value), series: seriesKey, y: yMag }]
          : undefined,
      point: props.x
        ? {
            series: seriesKey,
            x: props.x.value,
            y: isBand ? props.yEnd!.value : props.y!.value,
          }
        : undefined,
    });
    return null;
  }

  const claim = `area|${seriesKey}`;
  if (ctx.claimed.has(claim)) return null;
  ctx.claimed.add(claim);
  return renderArea(ctx, props, seriesKey, isBand);
}

AreaMark.displayName = "AreaMark";

function renderArea(
  ctx: ChartRender,
  props: AreaMarkProps,
  seriesKey: string,
  isBand: boolean,
): React.ReactElement | null {
  const pts = ctx.series.get(`area|${seriesKey}`) ?? [];
  if (pts.length === 0) return null;
  const styleKey = styleKeyOf(props) ?? (seriesKey !== "__default__" ? seriesKey : undefined);
  const fill = resolveMarkColor(ctx, props, styleKey);
  const stacked = props.stacking !== "unstacked" && (ctx.styleDomain.length > 1 || props.stacking != null);
  const fillOpacity = props.fillOpacity ?? (isBand || stacked ? 1 : 0.7);

  const sorted = [...pts].sort((a, b) => ctx.xScale.scale(a.x) - ctx.xScale.scale(b.x));

  let top: Pt[];
  let bottom: Pt[];

  if (isBand) {
    // ribbon: top = yEnd edge, bottom = yStart edge
    // both edges were collected as the same x; recover yStart from the band props
    // (band areas come from a single declaration so we re-evaluate per point)
    top = sorted.map((p) => ({ x: ctx.xScale.scale(p.x), y: ctx.yScale.scale(p.y) }));
    bottom = sorted.map((p) => ({
      x: ctx.xScale.scale(p.x),
      y: ctx.yScale.scale(props.yStart ? plottableNumber(props.yStart.value) : 0),
    }));
  } else {
    top = sorted.map((p) => {
      const stk = ctx.stackLookup(plottableKey(p.x), seriesKey);
      const yTop = stk ? stk.y1 : plottableNumber(p.y);
      return { x: ctx.xScale.scale(p.x), y: ctx.yScale.scale(yTop) };
    });
    bottom = sorted.map((p) => {
      const stk = ctx.stackLookup(plottableKey(p.x), seriesKey);
      const yBot = stk ? stk.y0 : 0;
      return { x: ctx.xScale.scale(p.x), y: ctx.yScale.scale(yBot) };
    });
  }

  const d = areaPath(top, bottom, props.interpolationMethod ?? "linear");
  return (
    <path
      className="sui-areamark"
      stroke="none"
      fill={fill}
      fillOpacity={fillOpacity}
      opacity={props.opacity ?? 1}
      transform={offsetTransform(props)}
      d={d}
      aria-label={props.accessibilityLabel}
      aria-hidden={props.accessibilityHidden}
      data-testid={props.accessibilityIdentifier}
    />
  );
}

function seriesKeyOf(props: AreaMarkProps): string {
  if (props.series) return plottableKey(props.series.value);
  if (props.foregroundStyleBy) return plottableKey(props.foregroundStyleBy.value);
  return "__default__";
}
function collectYs(props: AreaMarkProps): unknown[] {
  const out: unknown[] = [];
  if (props.y) out.push(props.y);
  if (props.yStart) out.push(props.yStart);
  if (props.yEnd) out.push(props.yEnd);
  return out;
}
