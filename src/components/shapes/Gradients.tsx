/**
 * Gradient views — SwiftUI Cluster C9 §14.
 *
 *   LinearGradient    // SUICore:506  init(gradient/colors/stops, startPoint, endPoint)
 *   RadialGradient    // SUICore:533  init(…, center, startRadius, endRadius)
 *   AngularGradient   // SUICore:579  init(…, center, startAngle, endAngle) / (…, angle)
 *   EllipticalGradient// SUICore:561  init(…, center=.center, startRadiusFraction=0, endRadiusFraction=0.5)
 *
 * Each gradient is BOTH a `ShapeStyle` (a fill paint) AND a `View` whose Body is
 * `_ShapeView<Rectangle, Self>` (`SUICore:524/552/570/607`) — so a bare
 * `<LinearGradient/>` renders as a full-bleed rectangle filled with the gradient.
 * As a fill, use the `cssXGradient(...)` helper from `./gradient` to get the
 * paint string and pass it to a shape's `fill`/`background`.
 *
 * Purely presentational (a `<div>` with a `background`) — no client directive.
 * Default points are exact: LinearGradient top→bottom resolves to `to bottom`.
 */
import * as React from "react";
import {
  cssLinearGradient,
  cssRadialGradient,
  cssAngularGradient,
  cssEllipticalGradient,
  type GradientDef,
  type GradientStop,
  type GradientColorSpace,
} from "./gradient";
import type { UnitPointInput } from "./geometry";

interface BaseGradientProps extends GradientDef {
  stops?: GradientStop[];
  colors?: string[];
  colorSpace?: GradientColorSpace;
  className?: string;
  style?: React.CSSProperties;
}

function FullBleed({
  background,
  className,
  style,
}: {
  background: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", background, ...style }}
    />
  );
}

/* ----------------------------- LinearGradient ---------------------------- */

export interface LinearGradientProps extends BaseGradientProps {
  /** default `.top`. */
  startPoint?: UnitPointInput;
  /** default `.bottom`. */
  endPoint?: UnitPointInput;
}

export function LinearGradient({
  startPoint = "top",
  endPoint = "bottom",
  className,
  style,
  ...g
}: LinearGradientProps) {
  const bg = cssLinearGradient(g, startPoint, endPoint);
  return <FullBleed background={bg} className={className} style={style} />;
}
LinearGradient.displayName = "LinearGradient";

/* ----------------------------- RadialGradient ---------------------------- */

export interface RadialGradientProps extends BaseGradientProps {
  center?: UnitPointInput;
  startRadius: number;
  endRadius: number;
}

export function RadialGradient({
  center = "center",
  startRadius,
  endRadius,
  className,
  style,
  ...g
}: RadialGradientProps) {
  const bg = cssRadialGradient(g, center, startRadius, endRadius);
  return <FullBleed background={bg} className={className} style={style} />;
}
RadialGradient.displayName = "RadialGradient";

/* ----------------------------- AngularGradient --------------------------- */

export interface AngularGradientProps extends BaseGradientProps {
  center?: UnitPointInput;
  /** radians. default 0. */
  startAngle?: number;
  /** radians. default 0. */
  endAngle?: number;
  /** radians — the single-sweep init: a full 360° wheel starting at `angle`. */
  angle?: number;
}

export function AngularGradient({
  center = "center",
  startAngle = 0,
  endAngle = 0,
  angle,
  className,
  style,
  ...g
}: AngularGradientProps) {
  const start = angle != null ? angle : startAngle;
  const end = angle != null ? angle + 2 * Math.PI : endAngle;
  const bg = cssAngularGradient(g, center, start, end);
  return <FullBleed background={bg} className={className} style={style} />;
}
AngularGradient.displayName = "AngularGradient";

/* --------------------------- EllipticalGradient -------------------------- */

export interface EllipticalGradientProps extends BaseGradientProps {
  center?: UnitPointInput;
  /** default 0. */
  startRadiusFraction?: number;
  /** default 0.5. */
  endRadiusFraction?: number;
}

export function EllipticalGradient({
  center = "center",
  startRadiusFraction = 0,
  endRadiusFraction = 0.5,
  className,
  style,
  ...g
}: EllipticalGradientProps) {
  const bg = cssEllipticalGradient(
    g,
    center,
    startRadiusFraction,
    endRadiusFraction,
  );
  return <FullBleed background={bg} className={className} style={style} />;
}
EllipticalGradient.displayName = "EllipticalGradient";
