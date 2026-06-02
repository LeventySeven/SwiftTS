/**
 * Gradient → CSS-gradient helpers — SwiftUI Cluster C9 §14.
 *
 * RE'd from `teardowns/SWIFTUI_C9_shapes-drawing.md` §14. Every SwiftUI gradient
 * maps to a CSS gradient. Pure functions returning a CSS `background` string —
 * server-compatible, no React.
 *
 *   Gradient.Stop { color; location 0..1 }    // SUICore:2168
 *   Gradient.init(colors:)                     // :2176 — N colors → locations i/(N-1)
 *   ColorSpace .device (≈ srgb) | .perceptual (≈ oklab)  // :16922
 */
import { resolveColor } from "../../system/modifiers";
import { resolveUnitPoint, type UnitPointInput, type UnitPoint } from "./geometry";

export interface GradientStop {
  color: string;
  /** 0..1 along the gradient axis. */
  location: number;
}

export type GradientColorSpace = "device" | "perceptual";

export interface GradientDef {
  /** explicit stops, OR `colors` evenly spaced. */
  stops?: GradientStop[];
  colors?: string[];
  colorSpace?: GradientColorSpace;
}

/** `init(colors:)` even spacing (§14.1 INFERRED): N colors → i/(N-1). */
export function resolveStops(g: GradientDef): GradientStop[] {
  if (g.stops?.length) {
    return g.stops.map((s) => ({
      color: resolveColor(s.color),
      location: s.location,
    }));
  }
  const colors = g.colors ?? [];
  if (colors.length === 0) return [];
  if (colors.length === 1) {
    return [{ color: resolveColor(colors[0]), location: 0 }];
  }
  return colors.map((c, i) => ({
    color: resolveColor(c),
    location: i / (colors.length - 1),
  }));
}

/** `.perceptual` → CSS `in oklab` interpolation-method prefix. */
function interpPrefix(space?: GradientColorSpace): string {
  return space === "perceptual" ? "in oklab, " : "";
}

/** Emit the `color loc%, color loc%` stop list. */
export function stopStr(stops: GradientStop[]): string {
  return stops
    .map((s) => `${s.color} ${round(s.location * 100)}%`)
    .join(", ");
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * LinearGradient angle (§14.2). SwiftUI y is DOWN; CSS `linear-gradient(Ndeg)`
 * has 0deg pointing UP and increasing clockwise. Direction start→end:
 *   angle_deg = atan2(dx, -dy) in degrees, where dy is in y-down space.
 */
export function angleFromPoints(start: UnitPoint, end: UnitPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y; // y-down
  // CSS 0deg = up (-y). clockwise positive.
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return round(deg);
}

/** LinearGradient → CSS `linear-gradient(...)` (§14.2). */
export function cssLinearGradient(
  g: GradientDef,
  startPoint: UnitPointInput,
  endPoint: UnitPointInput,
): string {
  const start = resolveUnitPoint(startPoint);
  const end = resolveUnitPoint(endPoint);
  const stops = resolveStops(g);
  return `linear-gradient(${interpPrefix(g.colorSpace)}${angleFromPoints(start, end)}deg, ${stopStr(stops)})`;
}

/** RadialGradient → CSS `radial-gradient(circle …)` (§14.3). */
export function cssRadialGradient(
  g: GradientDef,
  center: UnitPointInput,
  startRadius: number,
  endRadius: number,
): string {
  const c = resolveUnitPoint(center);
  const stops = resolveStops(g);
  // startRadius maps to the first stop's offset = startRadius/endRadius.
  const innerFrac = endRadius > 0 ? startRadius / endRadius : 0;
  const shifted = stops.map((s) => ({
    color: s.color,
    location: innerFrac + s.location * (1 - innerFrac),
  }));
  return `radial-gradient(${interpPrefix(g.colorSpace)}circle ${round(endRadius)}px at ${round(c.x * 100)}% ${round(c.y * 100)}%, ${stopStr(shifted)})`;
}

/**
 * AngularGradient → CSS `conic-gradient(from … at …)` (§14.4). SwiftUI 0° = 3
 * o'clock (+x); CSS conic 0deg = 12 o'clock → add 90°. `startAngle`/`endAngle`
 * in radians; if only a single sweep `angle` is given pass it as startAngle and
 * leave endAngle = startAngle + 2π (full wheel).
 */
export function cssAngularGradient(
  g: GradientDef,
  center: UnitPointInput,
  startAngleRad: number,
  endAngleRad: number,
): string {
  const c = resolveUnitPoint(center);
  const stops = resolveStops(g);
  const startDeg = (startAngleRad * 180) / Math.PI + 90;
  const endDeg = (endAngleRad * 180) / Math.PI + 90;
  const span = endDeg - startDeg || 360;
  // remap stop locations into the [start,end] arc span.
  const mapped = stops.map((s) => ({
    color: s.color,
    location: (startDeg + s.location * span) / 360,
  }));
  return `conic-gradient(${interpPrefix(g.colorSpace)}from ${round(startDeg)}deg at ${round(c.x * 100)}% ${round(c.y * 100)}%, ${stopStr(mapped)})`;
}

/** EllipticalGradient → CSS `radial-gradient(ellipse …)` (§14.5). */
export function cssEllipticalGradient(
  g: GradientDef,
  center: UnitPointInput,
  startRadiusFraction: number,
  endRadiusFraction: number,
): string {
  const c = resolveUnitPoint(center);
  const stops = resolveStops(g);
  const innerFrac =
    endRadiusFraction > 0 ? startRadiusFraction / endRadiusFraction : 0;
  const shifted = stops.map((s) => ({
    color: s.color,
    location: innerFrac + s.location * (1 - innerFrac),
  }));
  const ext = round(endRadiusFraction * 100);
  return `radial-gradient(${interpPrefix(g.colorSpace)}ellipse ${ext}% ${ext}% at ${round(c.x * 100)}% ${round(c.y * 100)}%, ${stopStr(shifted)})`;
}

/**
 * `AnyGradient` auto-gradient (`Color.blue.gradient`, §14.6 DESIGNED). A subtle
 * light-to-dark of the base color — the Apple auto-gradient look.
 */
export function cssAutoGradient(baseColor: string): string {
  const c = resolveColor(baseColor);
  return `linear-gradient(to bottom, color-mix(in oklab, ${c} 88%, white), ${c})`;
}
