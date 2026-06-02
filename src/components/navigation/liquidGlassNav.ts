/**
 * liquidGlassNav.ts — shared Liquid-Glass (iOS-26) resolution for the navigation
 * chrome (NavigationStack/NavBar, TabView/TabBar, NavigationSplitView/Sidebar,
 * Toolbar). This is the single place that decides, per bar, whether the surface
 * renders as a FLOATING Liquid-Glass bar or as the classic frosted `.bar`
 * material — and emits the exact class strings + data attributes the
 * navigation.global.css `Coverage Expansion` block keys off.
 *
 * Design-mode source of truth (read defensively):
 *   The theme/environment layer adds an iOS-26 flag to `useEnvironment()` — it is
 *   surfaced as `designMode === "iOS26"` and/or a boolean `liquidGlass`. That
 *   field is OPTIONAL on the shared `SwiftUIEnvironment` type (the environment
 *   module is owned by another agent and may land the field after this file), so
 *   we read it through a widened view that treats both keys as `unknown`. This
 *   keeps the kit compiling whether or not the flag is present yet, and makes
 *   Liquid Glass the default for an iOS-26 app while every bar can still opt out
 *   to the classic material via its own `material` / `glass={false}` prop.
 *
 * Mirrors the SwiftUI authoritative API (SwiftUICore.swiftinterface):
 *   glassEffect(_:in:)                    :2529   → glassClass(...) on the bar
 *   struct Glass(.regular/.clear/...)     :5753   → GlassVariant
 *   backgroundExtensionEffect()           :12093  → content extends behind bars
 *   ScrollEdgeEffectStyle(.automatic/...) :12150  → the scroll-edge glass fade
 *   TabBarMinimizeBehavior(...)           :8789   → the compact-pill minimize
 *
 * Pure logic + string builders — no JSX, no hooks beyond the tiny env reader, so
 * it stays cheap to import from both server- and client-rendered bars.
 */
import { useEnvironment } from "../../system/environment";
import {
  glassClass,
  glassStyle,
  type Glass,
  type GlassVariant,
  type ScrollEdgeEffectStyle,
  type TabBarMinimizeBehavior,
} from "../../system/effects";
import type * as React from "react";

// NOTE: `ScrollEdgeEffectStyle` / `TabBarMinimizeBehavior` are NOT re-exported
// from here. They are canonical types owned by `system/effects` (and mirrored in
// `system/modifiers`); re-exporting them through the navigation module graph
// makes `src/index.ts`'s top-level `export *` ambiguous (TS2308). Consumers
// import these two from the package root (they reach it via system/effects).

/* ===========================================================================
 * 1. Design-mode resolution
 * ======================================================================== */

/**
 * The widened environment view: the shared `SwiftUIEnvironment` does not (yet)
 * declare the iOS-26 design flag, so we read it through this optional shape.
 * `designMode` is the string form ("iOS26" | "iOS18" | "classic"); `liquidGlass`
 * is the convenience boolean. Either being truthy/`"iOS26"` enables glass.
 */
interface DesignModeEnv {
  designMode?: unknown;
  liquidGlass?: unknown;
}

/**
 * `isLiquidGlassMode(env)` — true when the app's design mode is iOS-26 (so bars
 * default to Liquid Glass). Reads the optional `designMode`/`liquidGlass` flags
 * defensively. Defaults to `true` (iOS-26 is the kit's modern default) ONLY when
 * neither flag is present; if the theme layer explicitly sets a non-iOS-26 mode,
 * that wins.
 */
export function isLiquidGlassMode(env: unknown): boolean {
  const e = env as DesignModeEnv;
  // Explicit boolean wins.
  if (typeof e.liquidGlass === "boolean") return e.liquidGlass;
  // String design mode: "iOS26" (any case) ⇒ glass; "classic"/"iOS18"/... ⇒ off.
  if (typeof e.designMode === "string") {
    const m = e.designMode.toLowerCase();
    if (m === "ios26" || m === "liquidglass" || m === "glass") return true;
    if (m === "classic" || m === "ios18" || m === "ios17" || m === "material")
      return false;
  }
  // No flag present yet (theme agent hasn't landed it): default to Liquid Glass.
  return true;
}

/** Hook form: read the live environment and resolve the iOS-26 design mode. */
export function useLiquidGlassMode(): boolean {
  return isLiquidGlassMode(useEnvironment());
}

/**
 * Resolve a per-bar opt-out into the effective surface kind.
 *
 * Each bar exposes a `material?: boolean` (opt into the classic frosted `.bar`)
 * and/or `glass?: boolean | Glass | GlassVariant` (force/configure Liquid Glass).
 * Precedence (most explicit wins): an explicit `glass===false` or
 * `material===true` ⇒ classic; an explicit glass value/`true` ⇒ glass; otherwise
 * fall back to the app design mode.
 */
export function resolveBarSurface(opts: {
  glass?: boolean | Glass | GlassVariant;
  material?: boolean;
  liquidGlassMode: boolean;
}): { kind: "glass" | "material"; glass: Glass | GlassVariant } {
  const { glass: g, material, liquidGlassMode } = opts;
  // explicit classic opt-out
  if (g === false || material === true) {
    return { kind: "material", glass: "regular" };
  }
  // explicit glass config (a Glass value or a variant string)
  if (g != null && g !== true) {
    return { kind: "glass", glass: g };
  }
  // explicit `glass` boolean true, or fall back to app design mode
  if (g === true || liquidGlassMode) {
    return { kind: "glass", glass: "regular" };
  }
  return { kind: "material", glass: "regular" };
}

/* ===========================================================================
 * 2. Class + style builders for a floating glass bar
 * ======================================================================== */

/**
 * Build the class list for a floating Liquid-Glass bar. We reuse the canonical
 * `glassClass(...)` (so the bar shares the SAME specular rim / sheen / glow
 * tokens as every other glass surface) and add a bar-local modifier so the
 * navigation CSS can layer the float shadow, concentric corners and scroll-edge
 * fade on top without touching the shared `.sui-glass` rules.
 *
 * `barClass` is e.g. "sui-glassbar" | "sui-glass-tabbar" — the bar-local hook.
 */
export function glassBarClass(
  barClass: string,
  g: Glass | GlassVariant = "regular",
): string {
  return [barClass, "sui-glassbar", glassClass(g)].filter(Boolean).join(" ");
}

/** The inline style for a glass bar (carries the optional tint custom prop). */
export function glassBarStyle(
  g: Glass | GlassVariant = "regular",
): React.CSSProperties {
  return glassStyle(g);
}

/* ===========================================================================
 * 3. Scroll-edge effect (ScrollEdgeEffectStyle :12150)
 * ======================================================================== */

/**
 * Resolve the scroll-edge glass fade applied to the scroll edge that runs UNDER
 * a floating bar. `.automatic` resolves to `.soft` for glass bars (a feathered
 * gradient mask) and is the default; `.hard` is a crisp band; `.soft` an
 * explicit feather. `hidden` (the `scrollEdgeEffectHidden(_:)` boolean modifier,
 * :12169) is carried separately by the caller and short-circuits to `"hidden"`.
 * (Canonical `ScrollEdgeEffectStyle` :12150 lives in system/effects.)
 */
export function resolveScrollEdge(
  style: ScrollEdgeEffectStyle = "automatic",
  hidden = false,
): "hard" | "soft" | "hidden" {
  if (hidden) return "hidden";
  return style === "automatic" ? "soft" : style;
}

/* ===========================================================================
 * 4. Tab-bar minimize behavior (TabBarMinimizeBehavior :8789)
 * ======================================================================== */

/**
 * Resolve `.automatic` → the system default (`.onScrollDown`).
 * (Canonical `TabBarMinimizeBehavior` :8789 lives in system/effects.) `.never`
 * keeps the bar full; `.onScrollDown` minimizes when scrolling content DOWN;
 * `.onScrollUp` minimizes when scrolling UP.
 */
export function resolveMinimizeBehavior(
  b: TabBarMinimizeBehavior = "automatic",
): "onScrollDown" | "onScrollUp" | "never" {
  return b === "automatic" ? "onScrollDown" : b;
}

/**
 * Given a minimize behavior and a scroll-direction delta (`dy` > 0 ⇒ scrolling
 * content down / finger up), decide whether the bar should be minimized. Returns
 * `null` when the behavior is `.never` (caller keeps the bar full).
 */
export function shouldMinimize(
  behavior: "onScrollDown" | "onScrollUp" | "never",
  dy: number,
): boolean | null {
  if (behavior === "never") return null;
  // Below a tiny threshold, treat as no movement (avoid jitter at rest).
  if (Math.abs(dy) < 2) return false;
  if (behavior === "onScrollDown") return dy > 0; // scrolling down → minimize
  return dy < 0; // onScrollUp → minimize when scrolling up
}
