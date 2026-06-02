"use client";
/**
 * `PointMark` (§5) — one symbol per row (default filled circle, area ~80pt²).
 *
 * `symbol(_:)` picks a `BasicChartSymbolShape`; `symbol(by:)` maps a category →
 * distinct shapes from the symbol scale; `symbolSize(by:)` drives continuous
 * bubble sizing. Each point renders independently.
 */
import * as React from "react";
import { useChart } from "./context";
import { styleIndex } from "./context";
import {
  type MarkModifierProps,
  resolveMarkColor,
  styleKeyOf,
  emphasisOpacity,
  offsetTransform,
} from "./mark-common";
import { symbolPath } from "./paths";
import {
  type BasicSymbol,
  type PlottableValue,
  type ValueOrNumber,
  plottableKey,
} from "./types";

export interface PointMarkProps extends MarkModifierProps {
  x?: PlottableValue;
  y?: ValueOrNumber;
  /** `.symbol(_:)` shape. default 'circle'. */
  symbol?: BasicSymbol;
  /** `.symbol(by:)` — category → shape from the symbol scale. */
  symbolBy?: PlottableValue;
  /** `.symbolSize(_:)` — area in pt² (default ~80). */
  symbolSize?: number | { width: number; height: number };
  /** `.symbolSize(by:)` — bubble sizing (area encodes magnitude). */
  symbolSizeBy?: PlottableValue;
}

const DEFAULT_AREA = 80;

export function PointMark(props: PointMarkProps): React.ReactElement | null {
  const ctx = useChart();
  const styleKey = styleKeyOf(props);
  const symbolKey = props.symbolBy ? plottableKey(props.symbolBy.value) : undefined;

  if (ctx.collecting) {
    ctx.register({
      type: "point",
      xs: props.x ? [props.x] : [],
      ys: props.y != null ? [props.y] : [],
      styleKeys: styleKey ? [styleKey] : [],
      symbolKeys: symbolKey ? [symbolKey] : [],
      xLabel: props.x?.label,
      yLabel: typeof props.y === "object" ? props.y.label : undefined,
    });
    return null;
  }

  const { xScale, yScale } = ctx;
  const cx = props.x ? xScale.scale(props.x.value) : ctx.plot.x + ctx.plot.w / 2;
  const cy =
    props.y == null
      ? ctx.plot.y + ctx.plot.h / 2
      : typeof props.y === "number"
        ? props.y
        : yScale.scale(props.y.value);

  const fill = resolveMarkColor(ctx, props, styleKey);

  // shape: explicit symbol, else symbol(by:) from scale, else circle
  let shape: BasicSymbol = props.symbol ?? "circle";
  if (props.symbolBy && symbolKey) {
    shape = ctx.symbolScale(symbolKey, styleIndex(ctx, symbolKey));
  }

  const area =
    typeof props.symbolSize === "number"
      ? props.symbolSize
      : props.symbolSize
        ? props.symbolSize.width * props.symbolSize.height
        : DEFAULT_AREA;

  const op = emphasisOpacity(ctx, styleKey, props.opacity ?? 1);

  if (shape === "circle") {
    const r = Math.sqrt(area / Math.PI);
    return (
      <circle
        className="sui-pointmark"
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        opacity={op}
        transform={offsetTransform(props)}
        aria-label={props.accessibilityLabel}
        aria-hidden={props.accessibilityHidden}
        data-testid={props.accessibilityIdentifier}
      />
    );
  }

  return (
    <path
      className="sui-pointmark"
      d={symbolPath(shape, area)}
      fill={fill}
      opacity={op}
      transform={`translate(${cx}, ${cy})${props.offset ? ` translate(${props.offset.x ?? 0}, ${props.offset.y ?? 0})` : ""}`}
      aria-label={props.accessibilityLabel}
      aria-hidden={props.accessibilityHidden}
      data-testid={props.accessibilityIdentifier}
    />
  );
}

PointMark.displayName = "PointMark";
