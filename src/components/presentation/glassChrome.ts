"use client";
/**
 * glassChrome — the shared Liquid-Glass switch + class helpers for the whole
 * presentation/menu chrome cluster (Sheet, FullScreenCover, Popover, Menu,
 * ContextMenu, Alert, ConfirmationDialog, ControlGroup).
 *
 * iOS 26 reskins every piece of modal/menu chrome in **Liquid Glass**: a
 * translucent, refractive surface with a bright specular RIM, a soft inner glow,
 * concentric (nested-adaptive) corners, and — on interactive surfaces — a
 * lensing hover/press response. This module is the ONE place that decides
 * glass-vs-classic and hands every component the class strings to apply.
 *
 * Design-mode source of truth: `useEnvironment().liquidGlass`. That flag is owned
 * by `system/environment.tsx`; this cluster only READS it. Because the field may
 * not yet be present on every build of `SwiftUIEnvironment`, we read it through a
 * tolerant accessor that:
 *   - returns the flag verbatim when explicitly set (true/false), and
 *   - DEFAULTS TO GLASS when unset, matching "default glass in iOS-26 mode".
 * A caller can always force a mode with the `glass?: boolean` prop on each
 * component (mirrors opting a single surface out of the system look).
 *
 * The actual pixels live in `glassChrome.global.css` (BARE selectors, no
 * `:global(...)`), so the literal class strings emitted here resolve verbatim
 * under Turbopack. We reuse the kit's base `sui-glass*` recipe (the specular rim
 * + sheen + glow + interactive lensing) from `system/effects` and layer the
 * chrome-specific geometry (concentric top corners, glass scrim, glass caret,
 * menu-row highlight, grabber) on top.
 */
import * as React from "react";
import { useEnvironment } from "../../system/environment";
import {
  glassClass,
  glassEffectProps,
  glass,
  type Glass,
  type GlassVariant,
  type GlassShape,
} from "../../system/effects";

// Side-effect import: registers the chrome glass classes (BARE selectors).
import "./glassChrome.global.css";

/* ===========================================================================
 * 1. Design-mode read — `useEnvironment().liquidGlass`, default glass.
 * ======================================================================== */

/**
 * The shape we read off the environment. `liquidGlass` is optional here so this
 * cluster compiles whether or not `SwiftUIEnvironment` has grown the field yet;
 * the owning module (`environment.tsx`) is the canonical declaration.
 */
type MaybeGlassEnv = { liquidGlass?: boolean };

/**
 * `useLiquidGlass(override?)` — resolve whether THIS surface renders in Liquid
 * Glass. Precedence: explicit `override` prop → environment `liquidGlass` flag →
 * default `true` (iOS-26 default). Pass `false` to force the classic frosted
 * Material look for a single surface.
 */
export function useLiquidGlass(override?: boolean): boolean {
  const env = useEnvironment() as unknown as MaybeGlassEnv;
  if (override != null) return override;
  // Default to glass when the flag is unset (iOS-26 default look).
  return env.liquidGlass !== false;
}

/* ===========================================================================
 * 2. Concentric corners (ConcentricRectangle / Edge.Corner.Style.concentric).
 *
 *    Liquid Glass nests with **concentric** corners: a child's radius adapts so
 *    its rounding stays visually parallel to the parent's. SwiftUI expresses this
 *    with `ConcentricRectangle` + `RectangleCornerRadii` + `.concentric`. CSS has
 *    no native concentric primitive, so we publish the parent radius as a custom
 *    property and derive the child radius as `outer - inset` (clamped ≥ a floor),
 *    which keeps the gap between nested rims constant — the concentric look.
 * ======================================================================== */

/**
 * `concentricChildRadius(outer, inset)` — the child radius for a `.concentric`
 * nesting: the rim-to-rim gap equals `inset`, so the child rounds in parallel.
 * Floors at 2px so a tiny child never goes fully square.
 */
export function concentricChildRadius(outer: number, inset: number): number {
  return Math.max(2, outer - inset);
}

/**
 * `concentricVars(outerRadius)` — publish the parent radius so nested glass
 * children can read `--sui-concentric-r` and derive their own concentric corner.
 * Spread onto the glass PARENT surface.
 */
export function concentricVars(outerRadius: number): React.CSSProperties {
  return { ["--sui-concentric-r" as string]: `${outerRadius}px` } as React.CSSProperties;
}

/* ===========================================================================
 * 3. Class helpers for each chrome surface.
 *    Each returns a className string (BARE classes from glassChrome.global.css);
 *    the component decides glass-vs-classic via `useLiquidGlass`.
 * ======================================================================== */

/** Base marker every glass chrome surface carries (enables the chrome cascade). */
export const GLASS_CHROME_CLASS = "sui-glass-chrome";

/**
 * `glassSurfaceClass(g)` — the kit `sui-glass*` recipe PLUS the chrome marker, so
 * a presentation surface gets the specular rim + sheen + glow + (optional)
 * interactive lensing AND the chrome-specific overrides (square-ish radius
 * inheritance, heavier drop shadow). Accepts a `Glass` value or bare variant.
 */
export function glassSurfaceClass(g: Glass | GlassVariant = glass.regular): string {
  return `${glassClass(g)} ${GLASS_CHROME_CLASS}`;
}

/**
 * `glassSurfaceProps(g, shape)` — `{ className, style }` to spread onto a chrome
 * surface that should be clipped to a shape (the `.glassEffect(_:in:)` analog),
 * with the chrome marker mixed in. Default shape is a rounded rect (chrome is
 * rarely a capsule).
 */
export function glassSurfaceProps(
  g: Glass | GlassVariant = glass.regular,
  shape: GlassShape = { rounded: 14 },
): { className: string; style: React.CSSProperties } {
  const base = glassEffectProps(g, shape);
  return { className: `${base.className} ${GLASS_CHROME_CLASS}`, style: base.style };
}

/**
 * `glassScrimClass(glassy)` — the dimming layer class. In glass mode the scrim is
 * NOT a flat black wash: it is a translucent, lightly-blurred "smoked glass"
 * veil (so the bars/content behind stay legible through it). In classic mode it
 * falls back to the plain dark scrim (callers keep their inline opacity).
 */
export function glassScrimClass(glassy: boolean): string {
  return glassy ? "sui-glass-scrim" : "";
}

/** Grabber (drag indicator) — a glass-pill grabber in glass mode. */
export function glassGrabberClass(glassy: boolean): string {
  return glassy ? "sui-glass-grabber" : "";
}

/** Popover caret/arrow — a glass triangle that shares the panel's refraction. */
export function glassCaretClass(glassy: boolean): string {
  return glassy ? "sui-glass-caret" : "";
}

/** Menu/Context-menu/dialog ROW — adds glass-highlight on hover/active. */
export function glassRowClass(glassy: boolean): string {
  return glassy ? "sui-glass-row" : "";
}

/** ContextMenu PREVIEW card — a floating glass-framed preview. */
export function glassPreviewClass(glassy: boolean): string {
  return glassy ? `sui-glass-preview ${GLASS_CHROME_CLASS}` : "";
}

/**
 * `chromeClasses(...names)` — join non-empty class strings (filter falsy). Tiny
 * sugar so components read `chromeClasses(styles.card, glassSurfaceClass(g))`.
 */
export function chromeClasses(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
