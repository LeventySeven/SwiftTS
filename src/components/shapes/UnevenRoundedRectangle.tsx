"use client";
/**
 * `UnevenRoundedRectangle` + `RectangleCornerRadii` — SwiftUI Cluster C9 §5.
 *
 *   @frozen public struct UnevenRoundedRectangle : Shape    // SUICore:10241
 *   init(topLeadingRadius:bottomLeadingRadius:bottomTrailingRadius:topTrailingRadius:
 *        style: RoundedCornerStyle = .continuous)           // :10248
 *
 * Per-corner radii. Hidden mapping (`SUICore:19053-19068`): public leading/
 * trailing names alias physical topLeft/topRight/bottomRight/bottomLeft —
 * topLeading→topLeft, topTrailing→topRight, bottomLeading→bottomLeft,
 * bottomTrailing→bottomRight. Under RTL leading/trailing swap.
 *
 * `.continuous` → figma-squircle per-corner radii; `.circular` → per-corner
 * arc path.
 */
import * as React from "react";
import { Shape, type ShapeStyleProps } from "./Shape";
import { squirclePath, unevenCircularPath } from "./geometry";
import type { RoundedCornerStyle } from "./RoundedRectangle";

export interface UnevenRoundedRectangleProps extends ShapeStyleProps {
  topLeadingRadius?: number;
  bottomLeadingRadius?: number;
  bottomTrailingRadius?: number;
  topTrailingRadius?: number;
  /** SwiftUI `style:` (`.continuous` | `.circular`). DEFAULT 'continuous'. */
  cornerStyle?: RoundedCornerStyle;
  cornerSmoothing?: number;
  /** mirror leading/trailing for right-to-left layout. */
  rtl?: boolean;
  insetStrokeBorder?: boolean;
}

export function UnevenRoundedRectangle({
  topLeadingRadius = 0,
  bottomLeadingRadius = 0,
  bottomTrailingRadius = 0,
  topTrailingRadius = 0,
  cornerStyle = "continuous",
  cornerSmoothing = 0.6,
  rtl = false,
  ...rest
}: UnevenRoundedRectangleProps) {
  // leading→left, trailing→right (swap under RTL).
  const topLeft = rtl ? topTrailingRadius : topLeadingRadius;
  const topRight = rtl ? topLeadingRadius : topTrailingRadius;
  const bottomLeft = rtl ? bottomTrailingRadius : bottomLeadingRadius;
  const bottomRight = rtl ? bottomLeadingRadius : bottomTrailingRadius;

  const pathIn = (w: number, h: number) =>
    cornerStyle === "continuous"
      ? squirclePath({
          width: w,
          height: h,
          topLeftCornerRadius: topLeft,
          topRightCornerRadius: topRight,
          bottomRightCornerRadius: bottomRight,
          bottomLeftCornerRadius: bottomLeft,
          cornerSmoothing,
        })
      : unevenCircularPath(w, h, { topLeft, topRight, bottomRight, bottomLeft });

  return <Shape pathIn={pathIn} {...rest} />;
}

UnevenRoundedRectangle.displayName = "UnevenRoundedRectangle";
