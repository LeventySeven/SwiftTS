"use client";
/**
 * `ConcentricRectangle` · `ContainerRelativeShape` · `ContainerShape` provider —
 * SwiftUI Cluster C9 §6 / §7.
 *
 *   ConcentricRectangle    // SUICore:13235 (iOS/macOS 26) — per-corner concentric
 *   ContainerRelativeShape // SUICore:13971 — nests concentrically in the container
 *   Edge.Corner.Style: .fixed(r) | .concentric | .concentric(minimum:)   // :19197
 *
 * Hidden logic: a concentric corner resolves its radius from the NEAREST
 * container's corner geometry (declared via `.containerShape(_:)`,
 * `SUICore:13382`) so an inner element's rounding stays concentric (constant
 * gap) with the container. CSS can't natively resolve "nearest container
 * radius", so we expose a CSS custom-property contract (DESIGNED, §6.2/§7.2):
 * a `<ContainerShape radius inset>` sets `--sui-container-radius` /
 * `--sui-container-inset` on its subtree; a concentric corner computes
 * `calc(var(--sui-container-radius) - var(--sui-container-inset))`.
 */
import * as React from "react";

/* ----------------------------- ContainerShape ---------------------------- */

export interface ContainerShapeProps {
  /** the container's own corner radius in px. */
  radius: number;
  /** inset between the container edge and inner concentric shapes. */
  inset?: number;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Declares the container shape for descendants (sets the CSS var contract). */
export function ContainerShape({
  radius,
  inset = 0,
  children,
  className,
  style,
}: ContainerShapeProps) {
  return (
    <div
      className={className}
      style={
        {
          "--sui-container-radius": `${radius}px`,
          "--sui-container-inset": `${inset}px`,
          ...style,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
ContainerShape.displayName = "ContainerShape";

/* ------------------------- ContainerRelativeShape ------------------------ */

export interface ContainerRelativeShapeProps {
  /** fill paint. default label. */
  fill?: string;
  /** additional inset beyond the container contract. */
  inset?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A single-radius shape that reads the inherited `--sui-container-radius` and
 * nests concentrically. Falls back to a rectangle (radius 0) outside a container.
 */
export function ContainerRelativeShape({
  fill = "var(--sui-color-label)",
  inset = 0,
  className,
  style,
}: ContainerRelativeShapeProps) {
  const radius = `calc(var(--sui-container-radius, 0px) - var(--sui-container-inset, 0px) - ${inset}px)`;
  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        background: fill,
        borderRadius: `max(0px, ${radius})`,
        ...style,
      }}
    />
  );
}
ContainerRelativeShape.displayName = "ContainerRelativeShape";

/* ------------------------- ConcentricRectangle --------------------------- */
//
// The canonical `ConcentricRectangle` (squircle-path, full RectangleCornerRadii,
// `.fixed`/`.concentric(minimum:)`, container-var resolution) lives in
// `./ConcentricRectangle.tsx` and is re-exported from the barrel. The legacy
// border-radius-only version was REMOVED here to avoid a duplicate export; it
// also reads the `--sui-container-radius`/`--sui-container-inset` vars that
// `<ContainerShape>` above publishes, so the contract is unchanged.
