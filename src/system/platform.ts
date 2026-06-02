/* =============================================================================
 * platform.ts — macOS platform mode (the AppKit design system as a PLATFORM)
 *
 * SwiftUI compiles ONE source tree to many platforms, but the rendered chrome is
 * platform-specific: on macOS the controls are SMALL (13px base, ~21px control
 * height, ~5-6px corners), backdrops are NSVisualEffectView VIBRANCY MATERIALS
 * (sidebar/menu/popover/hud/…), focus is a 3px accent ring, and selection is a
 * rounded accent-tinted pill. This module encodes that macOS layer:
 *
 *   - the macOS METRIC unions + a `macMetric()` token reader
 *   - the NSVisualEffectView VIBRANCY MATERIAL union + `macVibrancyClass(material)`
 *     (these resolve to .sui-mac-vibrancy-<material> in macos.global.css; on
 *     macOS 26 they ARE Liquid Glass — the recipe is reused there)
 *   - accent / focus-ring / selection class helpers
 *   - `usePlatform()` — reads the active `platform` off useEnvironment()
 *
 * It is the macOS sibling of effects.ts (iOS materials/glass). The CSS lives in
 * macos.global.css (BARE selectors, side-effect import below); the metric/accent
 * NUMBERS live as --sui-mac-* vars in tokens/variables.css. This file invents no
 * literals — it only hands out the stable class strings + reads the vars.
 * ========================================================================== */

import { useEnvironment } from "./environment";
import type { Platform } from "./environment";

// Side-effect import: registers the global .sui-mac-* vibrancy/selection/focus
// classes so a caller that imports macVibrancyClass() also pulls in the CSS that
// styles the class strings it returns (mirrors effects.ts ↔ effects.global.css).
import "./macos.global.css";

/* -----------------------------------------------------------------------------
 * 1. Platform identity
 * -------------------------------------------------------------------------- */

/** The OS look the kit renders in. `iOS` (default) is the touch chrome; `macOS`
 * switches to the AppKit desktop chrome (small controls, vibrancy, focus rings).
 * Re-exported from environment.tsx (the canonical home) so callers can `import
 * type { Platform } from "system/platform"` next to the other platform helpers. */
export type { Platform };

/** Default platform — matches SwiftUIEnvironment's default. */
export const DEFAULT_PLATFORM: Platform = "iOS";

/* -----------------------------------------------------------------------------
 * 2. macOS control METRICS — NSControl.ControlSize × the desktop dimensions.
 *    macOS controls are dramatically smaller than iOS: base type is 13px (vs the
 *    17px iOS body), the regular control box is ~21px tall (vs ~44pt touch), and
 *    corners are a tight ~5-6px (vs the iOS ~10-12px). The four AppKit control
 *    sizes (mini/small/regular/large) map to discrete heights + paddings.
 * -------------------------------------------------------------------------- */

/** AppKit NSControl.ControlSize. macOS ships four; iOS's `extraLarge` has no
 * desktop analog, so the kit clamps it to `large` when on macOS. */
export type MacControlSize = "mini" | "small" | "regular" | "large";

/** macOS control heights in px (NSControl baseline metrics). */
export const MAC_CONTROL_HEIGHT: Record<MacControlSize, number> = {
  mini: 16,
  small: 19,
  regular: 21,
  large: 28,
};

/** macOS control corner radii in px (AppKit rounded-rect bezel). */
export const MAC_CONTROL_RADIUS: Record<MacControlSize, number> = {
  mini: 3,
  small: 4,
  regular: 5,
  large: 6,
};

/** macOS control font sizes in px (the desktop type ramp per control size). */
export const MAC_CONTROL_FONT: Record<MacControlSize, number> = {
  mini: 9,
  small: 11,
  regular: 13,
  large: 13,
};

/** The macOS metric tokens exposed as --sui-mac-* CSS vars (see variables.css). */
export type MacMetric =
  | "font-base" // 13px base type
  | "font-small" // 11px small/secondary
  | "font-mini" // 9px mini
  | "control-height-mini"
  | "control-height-small"
  | "control-height-regular"
  | "control-height-large"
  | "control-radius"
  | "control-radius-large"
  | "control-padding-x"
  | "control-padding-y"
  | "list-row-height"
  | "sidebar-row-height"
  | "toolbar-height"
  | "titlebar-height"
  | "sidebar-width"
  | "accent" // resolved accent color
  | "selection-radius"; // selected-row pill corner

/** `macMetric("control-height-regular")` → `var(--sui-mac-control-height-regular)`.
 * Use inline in a style object so a macOS control reads the desktop dimension. */
export function macMetric(metric: MacMetric): string {
  return `var(--sui-mac-${metric})`;
}

/** The numeric height (px) for a given AppKit control size — non-CSS callers. */
export function macControlHeight(size: MacControlSize = "regular"): number {
  return MAC_CONTROL_HEIGHT[size];
}

/* -----------------------------------------------------------------------------
 * 3. NSVisualEffectView VIBRANCY MATERIALS.
 *    macOS backdrops are not the iOS frosted Materials — they are the AppKit
 *    NSVisualEffectView.Material set: each is a context-specific translucent +
 *    DESATURATING vibrancy recipe (a sidebar reads colder/lighter than a HUD).
 *    Every member resolves to a .sui-mac-vibrancy-<material> class. On macOS 26
 *    these ARE Liquid Glass, so the classes layer the glass rim/sheen on top.
 * -------------------------------------------------------------------------- */

/** NSVisualEffectView.Material — the full AppKit vibrancy material set. */
export type MacVibrancyMaterial =
  | "sidebar"
  | "menu"
  | "popover"
  | "hud" // HUD window (dark, heavily blurred)
  | "titlebar"
  | "sheet"
  | "selection"
  | "headerView"
  | "windowBackground"
  | "underWindowBackground" // the under-page/desktop-tinted backdrop
  | "contentBackground";

/** Base class shared by every NSVisualEffectView surface. */
export const MAC_VIBRANCY_BASE_CLASS = "sui-mac-vibrancy";

/**
 * macVibrancyClass(material) → the stable global class string for a vibrancy
 * material. e.g. macVibrancyClass("sidebar") === "sui-mac-vibrancy sui-mac-vibrancy-sidebar".
 * Drop it on a backdrop element (the web mapping of `.background(NSVisualEffectView…)`
 * / `.material(.sidebar)`). On macOS 26 the class also carries the Liquid Glass rim.
 */
export function macVibrancyClass(
  material: MacVibrancyMaterial = "windowBackground",
): string {
  return `${MAC_VIBRANCY_BASE_CLASS} ${MAC_VIBRANCY_BASE_CLASS}-${material}`;
}

/* -----------------------------------------------------------------------------
 * 4. Accent / focus-ring / selection.
 *    A configurable accent (default System Blue) drives two macOS-defining cues:
 *      - the FOCUS RING: a 3px accent glow around the key control
 *      - SELECTION: a rounded accent-tinted pill behind the selected sidebar/list
 *        row (the "emphasized" selection in a focused window)
 * -------------------------------------------------------------------------- */

/** Class for the macOS key-control focus ring (3px accent glow). Add to a control
 * that should show focus, or rely on `:focus-visible` (the CSS handles both). */
export const MAC_FOCUS_RING_CLASS = "sui-mac-focus-ring";

/** Class for a selected sidebar/list row — the rounded accent-tinted selection
 * pill. Toggle by `data-selected` OR by adding/removing this class. */
export const MAC_SELECTION_CLASS = "sui-mac-selection";

/** Class for a sidebar row container (28px row, hover wash, selection pill host). */
export const MAC_SIDEBAR_ROW_CLASS = "sui-mac-sidebar-row";

/** Class for a list row container (24px row, the desktop list density). */
export const MAC_LIST_ROW_CLASS = "sui-mac-list-row";

/** `macFocusRingClass()` — the focus-ring class (parameterless helper for parity
 * with the other class getters; takes an optional `emphasized` to widen the glow). */
export function macFocusRingClass(emphasized = false): string {
  return emphasized
    ? `${MAC_FOCUS_RING_CLASS} ${MAC_FOCUS_RING_CLASS}-emphasized`
    : MAC_FOCUS_RING_CLASS;
}

/** `macSelectionClass(selected)` — the selection-pill class when `selected`, else "".
 * `emphasized=false` (window unfocused) downgrades to the gray inactive selection. */
export function macSelectionClass(selected: boolean, emphasized = true): string {
  if (!selected) return "";
  return emphasized
    ? MAC_SELECTION_CLASS
    : `${MAC_SELECTION_CLASS} ${MAC_SELECTION_CLASS}-inactive`;
}

/** Set `--sui-mac-accent` to a CSS color so the ring + selection pick it up. The
 * default lives in variables.css (System Blue); pass to a wrapper's style. */
export function macAccentStyle(color: string): Record<string, string> {
  return { "--sui-mac-accent": color };
}

/* -----------------------------------------------------------------------------
 * 5. Traffic lights / unified toolbar — structural class hooks (styled in CSS).
 * -------------------------------------------------------------------------- */

/** The macOS window close/minimize/zoom "traffic light" cluster container. */
export const MAC_TRAFFIC_LIGHTS_CLASS = "sui-mac-traffic-lights";
/** The unified titlebar+toolbar strip (toolbar fused into the titlebar). */
export const MAC_TOOLBAR_CLASS = "sui-mac-toolbar";

/* -----------------------------------------------------------------------------
 * 6. usePlatform() — read the active platform off the environment.
 * -------------------------------------------------------------------------- */

/**
 * usePlatform() → the active `Platform` from the nearest SwiftUIProvider. Lets a
 * component branch its chrome (e.g. render the desktop small-control variant when
 * `usePlatform() === "macOS"`). Convenience over `useEnvironment().platform`.
 */
export function usePlatform(): Platform {
  return useEnvironment().platform;
}

/** True when the active platform is macOS — a readable guard in component code. */
export function useIsMac(): boolean {
  return useEnvironment().platform === "macOS";
}

/** Clamp an iOS `ControlSize` token to the four AppKit sizes (extraLarge→large). */
export function toMacControlSize(
  size: "mini" | "small" | "regular" | "large" | "extraLarge",
): MacControlSize {
  return size === "extraLarge" ? "large" : size;
}
