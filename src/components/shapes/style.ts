/**
 * Shape stroke & fill style — SwiftUI Cluster C9 §13.
 *
 * RE'd from `teardowns/SWIFTUI_C9_shapes-drawing.md` §13 (`StrokeStyle`,
 * `FillStyle`). Exact KNOWN defaults: `lineWidth=1`, `lineCap=.butt`,
 * `lineJoin=.miter`, `miterLimit=10`, `dash=[]`, `dashPhase=0`; fill is
 * nonzero-winding + antialiased.
 *
 * Pure mapping helpers — no React, server-compatible.
 */
import type * as React from "react";

/** `StrokeStyle` (`SUICore:8630`) → SVG stroke-* attributes. */
export interface StrokeStyleProps {
  /** default 1 (`SUICore:8637`). */
  lineWidth?: number;
  /** `CGLineCap` → SVG `stroke-linecap`. default 'butt'. */
  lineCap?: "butt" | "round" | "square";
  /** `CGLineJoin` → SVG `stroke-linejoin`. default 'miter'. */
  lineJoin?: "miter" | "round" | "bevel";
  /** default 10 → SVG `stroke-miterlimit`. */
  miterLimit?: number;
  /** default [] → SVG `stroke-dasharray`. */
  dash?: number[];
  /** default 0 → SVG `stroke-dashoffset` (negated: phase advances opposite). */
  dashPhase?: number;
}

/** `FillStyle` (`SUICore:6218`). */
export interface FillStyleProps {
  /** even-odd vs nonzero winding (default false → nonzero). */
  eoFill?: boolean;
  /** default true. */
  antialiased?: boolean;
}

/** Stroke style → the SVG `<path>` stroke-* attribute bag (§13.3). */
export function strokeAttrs(
  s?: StrokeStyleProps,
): React.SVGAttributes<SVGPathElement> {
  if (!s) return {};
  return {
    strokeWidth: s.lineWidth ?? 1,
    strokeLinecap: s.lineCap ?? "butt",
    strokeLinejoin: s.lineJoin ?? "miter",
    strokeMiterlimit: s.miterLimit ?? 10,
    strokeDasharray: s.dash?.length ? s.dash.join(" ") : undefined,
    // SwiftUI dashPhase advances opposite to SVG dashoffset → negate.
    strokeDashoffset: s.dashPhase != null ? -s.dashPhase : undefined,
  };
}

/** `FillStyle` → fill-rule + shape-rendering (§13.3). */
export function fillAttrs(
  f?: FillStyleProps,
): { fillRule?: "evenodd" | "nonzero"; shapeRendering?: string } {
  return {
    fillRule: f?.eoFill ? "evenodd" : "nonzero",
    shapeRendering:
      f?.antialiased === false ? "crispEdges" : "geometricPrecision",
  };
}
