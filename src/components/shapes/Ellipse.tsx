"use client";
/**
 * `Ellipse` — SwiftUI Cluster C9 §8.2.
 *
 *   @frozen public struct Ellipse : Shape   // SUICore:10315
 *
 * Ellipse inscribes the FULL offered rect (no squaring) — path = two SVG `A`
 * half-arcs with rx=w/2, ry=h/2. `.ellipse` sugar (`SUICore:10306`).
 */
import * as React from "react";
import { Shape, type ShapeStyleProps } from "./Shape";
import { ellipsePath } from "./geometry";

export interface EllipseProps extends ShapeStyleProps {
  insetStrokeBorder?: boolean;
}

export function Ellipse(props: EllipseProps) {
  return <Shape pathIn={(w, h) => ellipsePath(w, h)} {...props} />;
}

Ellipse.displayName = "Ellipse";
