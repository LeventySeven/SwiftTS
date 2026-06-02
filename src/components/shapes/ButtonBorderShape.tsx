"use client";
/**
 * `ButtonBorderShape` — SwiftUI Cluster C9 §16.
 *
 *   public struct ButtonBorderShape   // SUI:14675
 *   .automatic | .capsule | .roundedRectangle | .roundedRectangle(radius:) | .circle
 *
 * Hidden logic: the shape used by `.buttonBorderShape(_:)` and bordered button
 * styles — the shape a button's background/border is clipped to. `.automatic`
 * resolves at render time from the control size/platform (small → ~6px rounded
 * rect; bordered-prominent → continuous rounded rect; capsule → pill).
 *
 * Web mapping: a shape token resolving to a `border-radius` (or a clip), keyed to
 * the W1 button-radius vars. Exposed as a clip wrapper around button content and
 * as a `resolveButtonBorderRadius()` helper for style code (cross-ref C2).
 */
import * as React from "react";
import { RoundedRectangle } from "./RoundedRectangle";

export type ButtonBorderShapeToken =
  | "automatic"
  | "capsule"
  | "roundedRectangle"
  | "circle"
  | { roundedRectangle: { radius: number } };

/** Resolve a token → a CSS `border-radius` value (§16.2). */
export function resolveButtonBorderRadius(
  shape: ButtonBorderShapeToken,
  controlRadiusVar = "var(--sui-radius-button)",
): string {
  if (shape === "capsule") return "var(--sui-radius-button-capsule)";
  if (shape === "circle") return "50%";
  if (shape === "roundedRectangle") return controlRadiusVar;
  if (shape === "automatic") return controlRadiusVar;
  return `${shape.roundedRectangle.radius}px`;
}

export interface ButtonBorderShapeViewProps {
  /** the border shape token. default `.automatic`. */
  shape?: ButtonBorderShapeToken;
  /** fill paint when used as a standalone background shape. */
  fill?: string;
  /** continuous corners for the rounded-rect variants. */
  cornerSmoothing?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Render the button-border shape as a standalone background shape. `.capsule`
 * and `.circle` are handled with a CSS `border-radius` div (cheap); the rounded
 * variants use the continuous `<RoundedRectangle>` for the Apple look.
 */
export function ButtonBorderShapeView({
  shape = "automatic",
  fill = "var(--sui-color-label)",
  cornerSmoothing = 0.6,
  className,
  style,
}: ButtonBorderShapeViewProps) {
  if (shape === "capsule" || shape === "circle") {
    return (
      <div
        className={className}
        style={{
          width: "100%",
          height: "100%",
          background: fill,
          borderRadius: shape === "circle" ? "50%" : "var(--sui-radius-button-capsule)",
          ...style,
        }}
      />
    );
  }
  const radius =
    typeof shape === "object"
      ? shape.roundedRectangle.radius
      : // automatic / roundedRectangle → the control radius (≈ 8px).
        8;
  return (
    <RoundedRectangle
      cornerRadius={radius}
      cornerStyle="continuous"
      cornerSmoothing={cornerSmoothing}
      fill={fill}
      className={className}
    />
  );
}

ButtonBorderShapeView.displayName = "ButtonBorderShapeView";
