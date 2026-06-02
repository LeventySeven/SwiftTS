"use client";
/**
 * `Circle` — SwiftUI Cluster C9 §8.1.
 *
 *   @frozen public struct Circle : Shape   // SUICore:10342
 *   func sizeThatFits(_:) -> CGSize        // :10360 — forces a SQUARE (min side), centered
 *
 * Hidden logic: Circle's `sizeThatFits` collapses the offered rect to a square
 * of side `min(w,h)` and CENTERS the circle in the offered box. So a `Circle()`
 * in a non-square box is a centered circle of diameter `min(w,h)`, NOT an
 * ellipse. `.circle` sugar (`SUICore:10333`).
 */
import * as React from "react";
import { Shape, type ShapeStyleProps } from "./Shape";
import { circlePath } from "./geometry";

export interface CircleProps extends ShapeStyleProps {
  insetStrokeBorder?: boolean;
}

export function Circle(props: CircleProps) {
  return <Shape pathIn={(w, h) => circlePath(w, h)} {...props} />;
}

Circle.displayName = "Circle";
