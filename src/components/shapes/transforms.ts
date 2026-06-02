/**
 * Transformed shapes — `OffsetShape`/`ScaledShape`/`RotatedShape`/
 * `TransformedShape` — SwiftUI Cluster C9 §11.
 *
 *   OffsetShape<Content>      // SUICore:17015  offset: CGSize
 *   ScaledShape<Content>      // SUICore:17056  scale: CGSize; anchor: UnitPoint
 *   RotatedShape<Content>     // SUICore:17087  angle: Angle; anchor: UnitPoint
 *   TransformedShape<Content> // SUICore:17130  transform: CGAffineTransform [a b c d tx ty]
 *
 * All four wrap a `Content: Shape` and apply a transform to its path. Web: a CSS
 * `transform` + `transform-origin` on the host element (or a `<g transform>`).
 * `UnitPoint` anchor → `transform-origin: {x*100}% {y*100}%`.
 *
 * Pure helper — server-compatible.
 */
import type * as React from "react";
import { resolveUnitPoint, type UnitPointInput } from "./geometry";

export interface ShapeTransform {
  /** translate by {x,y} px. */
  offset?: { x: number; y: number };
  /** uniform or per-axis scale. */
  scale?: { x: number; y: number } | number;
  /** rotation in radians. */
  rotation?: number;
  /** raw CGAffineTransform [a, b, c, d, tx, ty]. */
  matrix?: [number, number, number, number, number, number];
  /** anchor for scale/rotation (default `.center`). */
  anchor?: UnitPointInput;
}

/** Build the CSS `transform` + `transform-origin` for a shape transform (§11.5). */
export function transformCSS(t: ShapeTransform): React.CSSProperties {
  const anchor = resolveUnitPoint(t.anchor ?? "center");
  const parts: string[] = [];
  if (t.offset) parts.push(`translate(${t.offset.x}px, ${t.offset.y}px)`);
  if (typeof t.scale === "number") parts.push(`scale(${t.scale})`);
  else if (t.scale) parts.push(`scale(${t.scale.x}, ${t.scale.y})`);
  if (t.rotation) parts.push(`rotate(${t.rotation}rad)`);
  if (t.matrix) parts.push(`matrix(${t.matrix.join(", ")})`);
  return {
    transform: parts.length ? parts.join(" ") : undefined,
    transformOrigin: `${anchor.x * 100}% ${anchor.y * 100}%`,
  };
}
