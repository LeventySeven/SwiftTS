"use client";
/**
 * `Rectangle` — SwiftUI Cluster C9 §3.
 *
 *   @frozen public struct Rectangle : Shape   // SUICore:10170
 *   path(in:) = M0,0 L w,0 L w,h L 0,h Z
 *
 * One filled axis-aligned box, no corner rounding, fills the offered size.
 * `.rect` sugar (`SUICore:10161`). Stateless; mirrors in RTL (`:10173`) but a
 * plain rect is symmetric so that has no visual effect.
 *
 * Client because it renders through `<Shape>` (measured SVG). For a plain fill
 * a caller may prefer a bare `<div style={{background}}>`; this gives the exact
 * SVG geometry needed when the rect is used as a clip or is stroked.
 */
import * as React from "react";
import { Shape, type ShapeStyleProps } from "./Shape";
import { rectPath } from "./geometry";

export interface RectangleProps extends ShapeStyleProps {
  /** strokeBorder inside-stroke mode (§10.2). */
  insetStrokeBorder?: boolean;
}

export function Rectangle(props: RectangleProps) {
  return <Shape pathIn={(w, h) => rectPath(w, h)} {...props} />;
}

Rectangle.displayName = "Rectangle";
