"use client";
/**
 * `SectorMark` (§8) — one annular sector (`<path>` arc) per row: pie/donut.
 *
 * `angle:` is the magnitude that drives each slice's angular sweep (the
 * container normalizes the sum to 2π). `innerRadius: .ratio(0.6)` → donut;
 * `.automatic` inner ⇒ 0 (solid pie). `angularInset` is the gap between slices.
 * Colored by `foregroundStyle(by:)` (the slice category).
 */
import * as React from "react";
import { useChart, styleIndex } from "./context";
import {
  type MarkModifierProps,
  resolveMarkColor,
  styleKeyOf,
  emphasisOpacity,
} from "./mark-common";
import { annularSectorPath } from "./paths";
import {
  type MarkDimension,
  type PlottableValue,
  resolveDim,
  plottableKey,
  plottableNumber,
} from "./types";

export interface SectorMarkProps extends MarkModifierProps {
  /** slice magnitude. */
  angle: PlottableValue;
  /** `.ratio(0.6)` → donut; default 0 (pie). */
  innerRadius?: MarkDimension;
  /** default automatic = fit. */
  outerRadius?: MarkDimension;
  /** gap between slices (pt). */
  angularInset?: number;
}

const SECTOR_MARGIN = 4; // small outer margin so the pie doesn't touch edges

export function SectorMark(props: SectorMarkProps): React.ReactElement | null {
  const ctx = useChart();
  const styleKey = styleKeyOf(props) ?? plottableKey(props.angle.value);

  if (ctx.collecting) {
    ctx.register({
      type: "sector",
      xs: [],
      ys: [],
      styleKeys: [styleKey],
      symbolKeys: [],
      sector: { key: styleKey, value: plottableNumber(props.angle.value) },
    });
    return null;
  }

  // find this slice's normalized angles by matching key + claim-by-index order
  const claimBase = "sector";
  const used = countUsed(ctx.claimed, claimBase);
  const slice = ctx.sectors[used];
  ctx.claimed.add(`${claimBase}#${used}`);
  if (!slice) return null;

  const { plot } = ctx;
  const cx = plot.x + plot.w / 2;
  const cy = plot.y + plot.h / 2;
  const maxR = Math.min(plot.w, plot.h) / 2 - SECTOR_MARGIN;
  const outerR =
    props.outerRadius && typeof props.outerRadius !== "number" && "ratio" in props.outerRadius
      ? maxR * props.outerRadius.ratio
      : resolveDimOr(props.outerRadius, maxR, maxR);
  const innerR = resolveDimOr(props.innerRadius, outerR, 0);

  const fill = resolveMarkColor(ctx, props, styleKey);
  const d = annularSectorPath(cx, cy, innerR, outerR, slice.a0, slice.a1, props.angularInset ?? 1);

  return (
    <path
      className="sui-sectormark"
      d={d}
      fill={fill}
      opacity={emphasisOpacity(ctx, styleKey, props.opacity ?? 1)}
      aria-label={props.accessibilityLabel}
      aria-hidden={props.accessibilityHidden}
      data-testid={props.accessibilityIdentifier ?? `sector-${styleIndex(ctx, styleKey)}`}
    />
  );
}

SectorMark.displayName = "SectorMark";

function countUsed(claimed: Set<string>, base: string): number {
  let n = 0;
  while (claimed.has(`${base}#${n}`)) n++;
  return n;
}

/** Resolve a radius MarkDimension; `.ratio(r)` is relative to `relativeTo`. */
function resolveDimOr(d: MarkDimension | undefined, relativeTo: number, fallback: number): number {
  if (d == null) return fallback;
  if (typeof d === "number") return d;
  if ("fixed" in d) return d.fixed;
  if ("ratio" in d) return relativeTo * d.ratio;
  if ("inset" in d) return relativeTo - d.inset;
  return fallback;
}
