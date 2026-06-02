"use client";
/**
 * `RoundedRectangle` + the `.continuous` squircle — SwiftUI Cluster C9 §4.
 *
 * THE single most important section for the Apple look.
 *
 *   @frozen public struct RoundedRectangle : Shape          // SUICore:10196
 *   init(cornerSize: CGSize, style: RoundedCornerStyle = .continuous)   // :10199
 *   init(cornerRadius: CGFloat, style: RoundedCornerStyle = .continuous) // :10203
 *
 *   enum RoundedCornerStyle { case circular; case continuous }   // SUICore:19017
 *
 * KNOWN: every initializer defaults `.continuous` — so `RoundedRectangle(
 * cornerRadius: 12)` is a SQUIRCLE, not a CSS rounded rect. `.circular` is the
 * plain quarter-circle arc (== CSS `border-radius`). We render `.continuous`
 * via the DESIGNED figma-squircle path (cornerSmoothing 0.6, §4.3) because the
 * interface only NAMES the style and never defines its spline.
 */
import * as React from "react";
import { Shape, type ShapeStyleProps } from "./Shape";
import { squirclePath, circularRoundRectPath } from "./geometry";

export type RoundedCornerStyle = "continuous" | "circular";

export interface RoundedRectangleProps extends ShapeStyleProps {
  /** uniform corner radius in px. */
  cornerRadius?: number;
  /** asymmetric corner size {width,height} (rx/ry). */
  cornerSize?: { width: number; height: number };
  /**
   * The SwiftUI `style:` parameter (`.continuous` | `.circular`). DEFAULT
   * 'continuous' (the squircle). Named `cornerStyle` because React reserves
   * `style` for the CSS style object.
   */
  cornerStyle?: RoundedCornerStyle;
  /** continuous-corner smoothing (Apple ≈ 0.6). */
  cornerSmoothing?: number;
  insetStrokeBorder?: boolean;
}

export function RoundedRectangle({
  cornerRadius,
  cornerSize,
  cornerStyle = "continuous",
  cornerSmoothing = 0.6,
  ...rest
}: RoundedRectangleProps) {
  const rx = cornerSize?.width ?? cornerRadius ?? 0;
  const ry = cornerSize?.height ?? cornerRadius ?? rx;
  const pathIn = (w: number, h: number) =>
    cornerStyle === "continuous"
      ? // figma-squircle uses one radius per corner; for asymmetric cornerSize
        // we use the min as the corner radius (SwiftUI's squircle is isotropic).
        squirclePath({
          width: w,
          height: h,
          cornerRadius: Math.min(rx, ry),
          cornerSmoothing,
        })
      : circularRoundRectPath(w, h, rx, ry);
  return <Shape pathIn={pathIn} {...rest} />;
}

RoundedRectangle.displayName = "RoundedRectangle";
