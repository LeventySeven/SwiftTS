"use client";
/**
 * `ConcentricRectangle` + `RectangleCornerRadii` + the concentric-corner model —
 * SwiftUI Cluster C9 / iOS-26 Liquid-Glass §concentric corners.
 *
 * SwiftUI authoritative API (arm64e-apple-macos.swiftinterface):
 *
 *   @frozen public struct RectangleCornerRadii : Equatable, Animatable    // :19044
 *     // physical corners (package): topLeft / topRight / bottomRight / bottomLeft
 *     // public logical aliases:    topLeading→topLeft, topTrailing→topRight,
 *     //                            bottomLeading→bottomLeft, bottomTrailing→bottomRight
 *     init(topLeading:bottomLeading:bottomTrailing:topTrailing:)
 *
 *   public struct ConcentricRectangle : Shape, Animatable                 // :13235
 *     init()                                                  // all .concentric
 *     init(corners: Edge.Corner.Style, isUniform: Bool = false)
 *     init(topLeadingCorner:topTrailingCorner:bottomLeadingCorner:bottomTrailingCorner:)
 *     // + the uniform-pair convenience inits
 *
 *   extension Edge.Corner {                                               // :19199
 *     public struct Style : Hashable, Animatable {
 *       static func fixed(_ radius: CGFloat) -> Style
 *       static var concentric: Style { get }
 *       static func concentric(minimum: Style? = nil) -> Style
 *     }
 *   }
 *
 * THE concentric idea (the load-bearing iOS-26 fact). A `.concentric` corner does
 * NOT have a fixed radius. Its radius is derived from the CONTAINER it sits in:
 * a child whose frame is inset by `inset` from a container of corner radius `R`
 * adopts radius `R - inset`, so the child's curve stays CONCENTRIC with (shares a
 * center of curvature with) the container's curve. Nest a glass button inside a
 * glass bar inside the rounded display and every curve is parallel — the Apple
 * "everything-nested-curves-together" look. `.fixed(r)` opts a single corner out
 * with an absolute radius; `.concentric(minimum:)` floors the derived radius.
 *
 * Web mapping (DESIGNED): the container publishes its radius + the child's inset
 * via the `--sui-concentric-radius` / `--sui-concentric-inset` CSS vars (set by
 * `concentricContainerVars(...)` on the container, consumed here). Each
 * `.concentric` corner resolves to `max(minimum, containerRadius − inset)`; a
 * `.fixed(r)` corner resolves to `r` directly. The four resolved radii feed the
 * same figma-squircle path the rest of the kit uses, so concentric corners are
 * continuous squircles by default — exactly like every other Apple corner.
 *
 * Client component — it measures its box (via <Shape>) and reads CSS vars off the
 * live element to resolve `.concentric` against the enclosing container.
 */
import * as React from "react";
import { Shape, type ShapeStyleProps } from "./Shape";
import { squirclePath, circularRoundRectPath } from "./geometry";
import type { RoundedCornerStyle } from "./RoundedRectangle";

/* =============================================================================
 * RectangleCornerRadii — `struct RectangleCornerRadii` (:19044)
 * ========================================================================== */

/**
 * `RectangleCornerRadii` — per-corner radii in PHYSICAL coordinates
 * (topLeft/topRight/bottomRight/bottomLeft). The public SwiftUI initializer takes
 * LOGICAL leading/trailing names; `rectangleCornerRadii(...)` below builds a value
 * from the logical names (and flips them under RTL), matching the Swift aliases:
 *   topLeading→topLeft, topTrailing→topRight,
 *   bottomLeading→bottomLeft, bottomTrailing→bottomRight.
 */
export interface RectangleCornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

/**
 * Build a `RectangleCornerRadii` from the SwiftUI logical initializer
 * `init(topLeading:bottomLeading:bottomTrailing:topTrailing:)` (all default 0).
 * `rtl` swaps leading/trailing → the physical left/right (SwiftUI does this in the
 * layout pass; we fold it in here so the path is correct for the writing system).
 */
export function rectangleCornerRadii(opts?: {
  topLeading?: number;
  bottomLeading?: number;
  bottomTrailing?: number;
  topTrailing?: number;
  rtl?: boolean;
}): RectangleCornerRadii {
  const tl = opts?.topLeading ?? 0;
  const bl = opts?.bottomLeading ?? 0;
  const bt = opts?.bottomTrailing ?? 0;
  const tt = opts?.topTrailing ?? 0;
  const rtl = opts?.rtl ?? false;
  return rtl
    ? { topLeft: tt, topRight: tl, bottomRight: bl, bottomLeft: bt }
    : { topLeft: tl, topRight: tt, bottomRight: bt, bottomLeft: bl };
}

/** A uniform `RectangleCornerRadii` (one radius on every corner). */
export function uniformCornerRadii(radius: number): RectangleCornerRadii {
  return { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius };
}

/* =============================================================================
 * Edge.Corner.Style — `.fixed(_)` / `.concentric` / `.concentric(minimum:)` (:19199)
 * ========================================================================== */

/**
 * `Edge.Corner.Style` — how a single corner derives its radius.
 *   - `"concentric"`            → radius = containerRadius − inset (the default).
 *   - `{ concentric: minimum }` → same, but floored at `minimum` px.
 *   - `{ fixed: r }`            → an absolute radius `r`, ignoring the container.
 */
export type CornerStyle =
  | "concentric"
  | { concentric: number }
  | { fixed: number };

/** `Edge.Corner.Style.fixed(_:)`. */
export function fixedCorner(radius: number): CornerStyle {
  return { fixed: radius };
}

/** `Edge.Corner.Style.concentric` / `.concentric(minimum:)`. */
export function concentricCorner(minimum?: number): CornerStyle {
  return minimum == null ? "concentric" : { concentric: minimum };
}

/**
 * THE concentric-corner helper (exported for the chrome agents to reuse). Resolve
 * one `CornerStyle` to a concrete radius, given the enclosing container's corner
 * radius and this view's inset from that container:
 *
 *   concentric        → max(0, containerRadius − inset)
 *   concentric(min)   → max(min, containerRadius − inset)
 *   fixed(r)          → r
 *
 * A glass child inset by `inset` inside a container of radius `containerRadius`
 * gets a curve concentric with the container's — every nested glass element shares
 * the same center of curvature, the iOS-26 nested-curve look.
 */
export function resolveConcentricRadius(
  style: CornerStyle,
  containerRadius: number,
  inset: number,
): number {
  if (typeof style === "object") {
    if ("fixed" in style) return Math.max(0, style.fixed);
    // concentric with a minimum floor
    return Math.max(style.concentric, containerRadius - inset);
  }
  // bare concentric: derive, floored at 0
  return Math.max(0, containerRadius - inset);
}

/** The four corner styles of a ConcentricRectangle (physical orientation). */
export interface ConcentricCorners {
  topLeft: CornerStyle;
  topRight: CornerStyle;
  bottomRight: CornerStyle;
  bottomLeft: CornerStyle;
}

const ALL_CONCENTRIC: ConcentricCorners = {
  topLeft: "concentric",
  topRight: "concentric",
  bottomRight: "concentric",
  bottomLeft: "concentric",
};

/* =============================================================================
 * concentricContainerVars — what a CONTAINER publishes so children can resolve
 * ========================================================================== */

/**
 * The CSS var a container writes so concentric children can read its radius.
 * Aliases the C9 `<ContainerShape radius>` contract (`--sui-container-radius`) so
 * a `ConcentricRectangle` is a drop-in inside either a `<ContainerShape>` or a
 * `concentricContainerVars(...)` host. `--sui-concentric-radius` wins when both set.
 */
export const CONCENTRIC_RADIUS_VAR = "--sui-concentric-radius";
/** The CSS var a child writes so its own concentric corners know their inset. */
export const CONCENTRIC_INSET_VAR = "--sui-concentric-inset";
/** The legacy C9 `<ContainerShape>` radius var, read as a fallback. */
export const CONTAINER_RADIUS_VAR = "--sui-container-radius";
/** The legacy C9 `<ContainerShape>` inset var, read as a fallback. */
export const CONTAINER_INSET_VAR = "--sui-container-inset";

/**
 * `concentricContainerVars(radius)` → the style a CONTAINER spreads so that any
 * `ConcentricRectangle` / glass chrome nested inside resolves `.concentric`
 * against `radius`. Used by chrome (bars, glass panes) to seed the concentric
 * chain. Children inherit the var; each child overrides
 * `--sui-concentric-inset` for its own distance from this container.
 */
export function concentricContainerVars(radius: number): React.CSSProperties {
  return { [CONCENTRIC_RADIUS_VAR]: `${radius}px` } as React.CSSProperties;
}

/* =============================================================================
 * <ConcentricRectangle> — `struct ConcentricRectangle` (:13235)
 * ========================================================================== */

export interface ConcentricRectangleProps extends ShapeStyleProps {
  /**
   * The four corner styles. Defaults to all-`.concentric` (the `init()` case).
   * Pass a single `CornerStyle` via `corners` for the `init(corners:)` overload.
   */
  cornerStyles?: Partial<ConcentricCorners>;
  /** `init(corners:isUniform:)` — apply ONE style to every corner. */
  corners?: CornerStyle;
  /**
   * The enclosing container's corner radius. If omitted, it is read at runtime
   * from the inherited `--sui-concentric-radius` CSS var (set by the container via
   * `concentricContainerVars`), defaulting to 0 when no container published one.
   */
  containerRadius?: number;
  /**
   * This view's inset from the container (px). Drives the concentric derivation
   * `containerRadius − inset`. If omitted, read from `--sui-concentric-inset`
   * (default 0). KNOWN-equivalent: the gap between the child frame and container.
   */
  inset?: number;
  /** `.continuous` squircle (default) or `.circular` arc corners. */
  cornerStyle?: RoundedCornerStyle;
  cornerSmoothing?: number;
  /** mirror leading/trailing under right-to-left (affects the published corners). */
  rtl?: boolean;
  insetStrokeBorder?: boolean;
}

/** Read a numeric px CSS var off an element (inherited), with a fallback. */
function readPxVar(el: Element | null, name: string, fallback: number): number {
  if (el == null || typeof window === "undefined") return fallback;
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * `<ConcentricRectangle>` — a rounded rectangle whose `.concentric` corners derive
 * their radius from the enclosing container (`containerRadius − inset`), so nested
 * glass elements share one concentric curve. Renders via the universal `<Shape>`:
 * a continuous squircle by default, matching every other Apple corner.
 *
 * When `containerRadius` isn't passed explicitly, it (and `inset`) are read from
 * the inherited `--sui-concentric-radius` / `--sui-concentric-inset` CSS vars at
 * mount, so dropping a `<ConcentricRectangle>` into a `concentricContainerVars(R)`
 * container "just works" with zero prop wiring.
 */
export function ConcentricRectangle({
  cornerStyles,
  corners,
  containerRadius,
  inset,
  cornerStyle = "continuous",
  cornerSmoothing = 0.6,
  rtl = false,
  ...rest
}: ConcentricRectangleProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  // When radius/inset aren't passed, resolve them from inherited CSS vars after mount.
  const [resolved, setResolved] = React.useState<{ r: number; i: number }>({
    r: containerRadius ?? 0,
    i: inset ?? 0,
  });

  React.useLayoutEffect(() => {
    if (containerRadius != null && inset != null) return;
    const el = hostRef.current;
    // prefer the concentric-specific var; fall back to the C9 <ContainerShape> var.
    const r =
      containerRadius ??
      readPxVar(
        el,
        CONCENTRIC_RADIUS_VAR,
        readPxVar(el, CONTAINER_RADIUS_VAR, 0),
      );
    const i =
      inset ??
      readPxVar(el, CONCENTRIC_INSET_VAR, readPxVar(el, CONTAINER_INSET_VAR, 0));
    setResolved((prev) => (prev.r === r && prev.i === i ? prev : { r, i }));
  }, [containerRadius, inset]);

  const effRadius = containerRadius ?? resolved.r;
  const effInset = inset ?? resolved.i;

  // build the four corner styles (single `corners` wins, else per-corner, else all-concentric)
  const styles: ConcentricCorners = corners
    ? { topLeft: corners, topRight: corners, bottomRight: corners, bottomLeft: corners }
    : { ...ALL_CONCENTRIC, ...cornerStyles };

  // physical orientation under RTL: swap left/right pairs (leading/trailing flip)
  const phys: ConcentricCorners = rtl
    ? {
        topLeft: styles.topRight,
        topRight: styles.topLeft,
        bottomRight: styles.bottomLeft,
        bottomLeft: styles.bottomRight,
      }
    : styles;

  const tl = resolveConcentricRadius(phys.topLeft, effRadius, effInset);
  const tr = resolveConcentricRadius(phys.topRight, effRadius, effInset);
  const br = resolveConcentricRadius(phys.bottomRight, effRadius, effInset);
  const bl = resolveConcentricRadius(phys.bottomLeft, effRadius, effInset);

  const pathIn = (w: number, h: number) =>
    cornerStyle === "continuous"
      ? squirclePath({
          width: w,
          height: h,
          topLeftCornerRadius: tl,
          topRightCornerRadius: tr,
          bottomRightCornerRadius: br,
          bottomLeftCornerRadius: bl,
          cornerSmoothing,
        })
      : // .circular arc path: when uniform, use the symmetric helper; otherwise
        // fall back to the squircle path with smoothing 0 (a pure arc).
        tl === tr && tr === br && br === bl
        ? circularRoundRectPath(w, h, tl, tl)
        : squirclePath({
            width: w,
            height: h,
            topLeftCornerRadius: tl,
            topRightCornerRadius: tr,
            bottomRightCornerRadius: br,
            bottomLeftCornerRadius: bl,
            cornerSmoothing: 0,
          });

  return (
    <div ref={hostRef} style={{ display: "block", width: "100%", height: "100%" }}>
      <Shape pathIn={pathIn} {...rest} />
    </div>
  );
}

ConcentricRectangle.displayName = "ConcentricRectangle";
