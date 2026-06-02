"use client";
/**
 * `AnyShape` — type-erased shape — SwiftUI Cluster C9 §9.
 *
 *   @frozen public struct AnyShape : Shape   // SUICore:9898
 *   public init<S>(_ shape: S) where S : Shape   // :9900 — wrap any shape
 *
 * Erases a concrete `Shape` to a single type so you can store heterogeneous
 * shapes or switch shape at runtime. In TS a `pathIn` callback is already
 * type-erased — `AnyShape` collapses to passing a different `pathIn` function.
 *
 * Also re-exports the transform helper so a transformed shape can be wrapped:
 * apply `transformCSS(...)` to `style` and pass any `pathIn`.
 */
import * as React from "react";
import { Shape, type ShapeStyleProps } from "./Shape";

export interface AnyShapeProps extends ShapeStyleProps {
  /** the erased `path(in:)` callback. */
  pathIn: (w: number, h: number) => string;
  insetStrokeBorder?: boolean;
}

export function AnyShape({ pathIn, ...rest }: AnyShapeProps) {
  return <Shape pathIn={pathIn} {...rest} />;
}

AnyShape.displayName = "AnyShape";
