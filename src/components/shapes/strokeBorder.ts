/**
 * `InsettableShape.strokeBorder` — the inside-stroke trick — SwiftUI Cluster C9 §10.
 *
 *   func strokeBorder(_:style:antialiased:) -> some View   // SUICore:10377
 *   = inset(by: style.lineWidth * 0.5).stroke(style:).fill(content)
 *
 * THE distinction (§10.2):
 *  - `stroke(lineWidth: w)` centers the stroke ON the path edge → half the stroke
 *    (w/2) spills OUTSIDE the shape bounds (SVG default).
 *  - `strokeBorder(lineWidth: w)` first `inset(by: w/2)` THEN strokes → the entire
 *    stroke is INSIDE the bounds (`SUICore:10378`). This is what buttons/cards want.
 *
 * For arbitrary shapes, pass `insetStrokeBorder` to `<Shape>` (it insets the path
 * geometry by w/2 before stroking). For box shapes (rect/rounded/capsule fills),
 * the cleanest CSS equivalent is `box-shadow: inset 0 0 0 {w}px {color}` — inside-
 * only, antialiased, no path math, no layout shift. This helper builds that.
 */
import type * as React from "react";

/** CSS `strokeBorder` for box shapes: an inside-only border via inset box-shadow. */
export function strokeBorderBoxShadow(
  color: string,
  lineWidth = 1,
): React.CSSProperties {
  return { boxShadow: `inset 0 0 0 ${lineWidth}px ${color}` };
}
