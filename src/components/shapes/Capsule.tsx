"use client";
/**
 * `Capsule` — SwiftUI Cluster C9 §8.3.
 *
 *   @frozen public struct Capsule : Shape   // SUICore:10285
 *   init(style: RoundedCornerStyle = .continuous)  // :10287
 *
 * Hidden logic (KNOWN): a Capsule is a RoundedRectangle whose corner radius =
 * HALF the shorter side (`min(w,h)/2`). For a wide pill the ends are full
 * semicircles. Default style `.continuous`. `.capsule` sugar (`SUICore:10273`).
 *
 * At full-round (radius == half-side) `.continuous` and `.circular` are nearly
 * indistinguishable, so the SVG path is the same `circularRoundRectPath`
 * regardless of style (§8.4 note).
 */
import * as React from "react";
import { Shape, type ShapeStyleProps } from "./Shape";
import { capsulePath } from "./geometry";
import type { RoundedCornerStyle } from "./RoundedRectangle";

export interface CapsuleProps extends ShapeStyleProps {
  /**
   * SwiftUI `style:` (`.continuous` | `.circular`). DEFAULT 'continuous';
   * visually identical to 'circular' at full-round. Named `cornerStyle` because
   * React reserves `style` for the CSS style object.
   */
  cornerStyle?: RoundedCornerStyle;
  insetStrokeBorder?: boolean;
}

export function Capsule({ cornerStyle: _cornerStyle = "continuous", ...rest }: CapsuleProps) {
  return <Shape pathIn={(w, h) => capsulePath(w, h)} {...rest} />;
}

Capsule.displayName = "Capsule";
