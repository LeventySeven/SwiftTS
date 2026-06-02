# macOS Design System — RE Teardown → Web-Replica Spec (PLATFORM mode)

**Goal:** encode Apple's **macOS (AppKit)** design system as a *platform layer* over the existing iOS kit, so a single `<SwiftUIProvider platform="macOS">` flips the chrome from touch to desktop: SMALL controls, `NSVisualEffectView` vibrancy backdrops, accent focus rings, accent-tinted selection pills, traffic lights, the unified toolbar, and (on macOS 26) Liquid Glass.

This is the macOS sibling of the iOS materials/glass teardown (`SWIFTUI_C12_materials-effects.md`). Where C12 documents the iOS `Material`/`Glass` recipe, this file documents what is **DIFFERENT on macOS** — the metrics, the `NSVisualEffectView.Material` set, and the desktop-only chrome — and maps each to its implementation.

**Implementation produced by this teardown:**
- `src/system/platform.ts` — the macOS metric / vibrancy-material / accent unions + helpers (`macMetric`, `macVibrancyClass`, `macFocusRingClass`, `macSelectionClass`, `usePlatform`, `useIsMac`).
- `src/system/macos.global.css` — the BARE-selector cascade that styles the class strings, scoped under `[data-platform="macOS"]`.
- `src/tokens/variables.css` — the `--sui-mac-*` token block (light + both dark blocks).
- `src/system/environment.tsx` — adds `platform: 'iOS' | 'macOS'` to the environment + projects `data-platform`.

**Label legend:**
- **KNOWN** — published in Apple's Human Interface Guidelines (HIG) or the AppKit API reference (the metric exists, the control size exists, the material case exists, the named behavior exists).
- **INFERRED** — the numeric recipe (vibrancy blur px / saturate, tint rgba, ring alpha, dot diameter) reverse-engineered / community-calibrated to match rendered AppKit output. AppKit bakes these into `NSVisualEffectView`'s private `CABackdropLayer` + `CAFilter` chain, so they are not in any public header.
- **DESIGNED** — web-platform engineering added where no 1:1 CSS/AppKit primitive maps cleanly (e.g. the `-webkit-app-region` drag affordance, the goo-free vibrancy fallback).

**Sources (Tier-1A/2):**
- HIG → *Components/Layout* (control sizes, metrics), *Foundations/Materials*, *Components/Windows*, *Components/The menu bar / Toolbars / Sidebars*.
- AppKit API reference → `NSControl.ControlSize`, `NSVisualEffectView.Material` (the 11 cases), `NSVisualEffectView.State`/`.blendingMode`, `NSColor.controlAccentColor`, `NSColor.selectedContentBackgroundColor` / `unemphasizedSelectedContentBackgroundColor`, `NSWindow` traffic-light buttons (`NSWindowButton`), `NSToolbar` unified appearance, `NSSplitViewController` sidebar.
- macOS 26 (Tahoe) — "Liquid Glass" extends to macOS; on macOS 26 the `NSVisualEffectView` materials render as Liquid Glass. The kit reuses the iOS-26 `--sui-glass-*` recipe under `[data-design-mode="liquidGlass"]`.

---

## 0. The central architectural fact — macOS is iOS at a different DENSITY + a different BACKDROP set

Two things make macOS *not* iOS, and the whole platform layer is these two:

1. **Density.** macOS controls are tiny relative to touch targets. The base type is **13px** (vs iOS body 17px), the regular control box is **~21px** tall (vs the ~44pt iOS touch target), corners are **~5-6px** (vs iOS ~10-12px), and there are **four** `NSControl.ControlSize`s — `mini / small / regular / large` — each a discrete height. iOS's `extraLarge` has no desktop analog, so the kit clamps it (`toMacControlSize`).

2. **Backdrops.** macOS does not use the iOS frosted `Material` set. It uses `NSVisualEffectView.Material` — **context-specific** translucent + **desaturating** vibrancy recipes. A `.sidebar` reads colder/lighter than a `.hud`; a `.menu`/`.popover` floats with a drop shadow; the `.underWindowBackground` picks up the desktop tint. The vibrancy "wash" is `saturate(<1)` — it DRAINS color from the backdrop, the inverse of the iOS `saturate(1.8)` energizing.

Everything else (selection pill, focus ring, traffic lights, unified toolbar) is desktop chrome built on top of those two facts. On macOS 26 the backdrops additionally gain the Liquid Glass rim/sheen, so the platform layer *reuses* the iOS-26 glass recipe rather than re-implementing it.

---

## 1. METRICS — the AppKit control density — KNOWN (HIG) / INFERRED (exact px)

`NSControl.ControlSize` ships four sizes. The per-size box heights, corner radii, and font sizes are the desktop density. (HIG publishes the sizes + the relative density; the exact px are INFERRED/calibrated.)

| Token (`--sui-mac-*`) | Value | Maps to | Label |
|---|---|---|---|
| `font-base` | **13px** | macOS body / `regular` control type | KNOWN (HIG: 13pt system font) |
| `font-small` | 11px | `small` control / secondary label | KNOWN |
| `font-mini` | 9px | `mini` control caption | INFERRED |
| `control-height-mini` | 16px | `.mini` `NSControl` box | INFERRED |
| `control-height-small` | 19px | `.small` | INFERRED |
| `control-height-regular` | **21px** | `.regular` (the default) | INFERRED |
| `control-height-large` | 28px | `.large` | INFERRED |
| `control-radius` | **5px** | regular rounded bezel | INFERRED (HIG: ~5-6px) |
| `control-radius-large` | 6px | large bezel | INFERRED |
| `control-padding-x` | 7px | default 6-8px horizontal inset | INFERRED |
| `control-padding-y` | 2px | vertical inset | INFERRED |
| `list-row-height` | **24px** | `NSTableView` row | INFERRED (HIG: compact desktop list) |
| `sidebar-row-height` | **28px** | source-list (sidebar) row | INFERRED |
| `toolbar-height` | 38px | unified toolbar strip | INFERRED |
| `titlebar-height` | 28px | titlebar (traffic-light) zone | INFERRED |
| `sidebar-width` | 220px | default `NSSplitViewController` sidebar | INFERRED |
| `selection-radius` | 6px | selected-row pill corner | INFERRED |

**Implementation:** `platform.ts` exports these as typed records (`MAC_CONTROL_HEIGHT`, `MAC_CONTROL_RADIUS`, `MAC_CONTROL_FONT`) for non-CSS callers AND as `--sui-mac-*` CSS vars read via `macMetric("control-height-regular")` → `var(--sui-mac-control-height-regular)`. A component branches on `usePlatform() === "macOS"` and swaps its height/font/radius to the desktop token. `macos.global.css §0` sets the ambient `font-size: var(--sui-mac-font-base)` on the `[data-platform="macOS"]` wrapper so untreated text in a macOS subtree reads at 13px.

```ts
// platform.ts — the AppKit baseline metrics
export const MAC_CONTROL_HEIGHT = { mini: 16, small: 19, regular: 21, large: 28 };
export const MAC_CONTROL_RADIUS = { mini: 3,  small: 4,  regular: 5,  large: 6  };
export const MAC_CONTROL_FONT   = { mini: 9,  small: 11, regular: 13, large: 13 };
export function macMetric(m: MacMetric): string { return `var(--sui-mac-${m})`; }
export function toMacControlSize(s): MacControlSize { return s === "extraLarge" ? "large" : s; }
```

---

## 2. VIBRANCY MATERIALS — `NSVisualEffectView.Material` — KNOWN (cases) / INFERRED (recipe)

AppKit's `NSVisualEffectView.Material` enumerates the desktop backdrops. Each is a translucent **desaturating** vibrancy surface; the platform layer maps all eleven to `.sui-mac-vibrancy-<material>`.

| `NSVisualEffectView.Material` case | `macVibrancyClass(...)` | role | tint character | Label |
|---|---|---|---|---|
| `.sidebar` | `sidebar` | source list backdrop | cold near-white (light) / near-black (dark) | KNOWN |
| `.menu` | `menu` | menu / context menu | bright, floats w/ shadow | KNOWN |
| `.popover` | `popover` | popover bubble | bright, floats w/ shadow | KNOWN |
| `.hudWindow` | `hud` | HUD panel | **dark in BOTH schemes**, white label | KNOWN |
| `.titlebar` | `titlebar` | titlebar strip | window-chrome tint | KNOWN |
| `.sheet` | `sheet` | modal sheet | bright, large corners | KNOWN |
| `.selection` | `selection` | selected-region wash | accent-tinted | KNOWN |
| `.headerView` | `headerView` | table header | chrome tint | KNOWN |
| `.windowBackground` | `windowBackground` | default window fill | neutral window tint | KNOWN |
| `.underWindowBackground` | `underWindowBackground` | behind/under the window | desktop-tinted | KNOWN |
| `.contentBackground` | `contentBackground` | content area fill | near-opaque content | KNOWN |

**The recipe (INFERRED, base class `.sui-mac-vibrancy`):**
```css
background: <per-material tint>;
backdrop-filter: blur(28px) saturate(0.62);   /* DESATURATE — the vibrancy wash */
box-shadow: inset 0 0 0 0.5px <rim>;           /* the faint 0.5px NSVisualEffectView edge */
```
The defining detail vs iOS: **`saturate(0.62)`** (drains color) where iOS `Material` uses `saturate(1.8)` (energizes). That is what makes a macOS sidebar read as a cool grey wash rather than a vivid frosted pane. `.menu`/`.popover`/`.sheet`/`.hud` add a real drop shadow for the float; `.hud` additionally forces a dark tint + white label in both color schemes (the classic heads-up panel) and keeps a little saturation (`1.1`) so it isn't fully drained.

Each modifier class only swaps the `--mac-vib-tint` local that the base rule consumes — same pattern as iOS `materialClass()` binding `--mat-tint`. Dark mode re-points every `--sui-mac-vibrancy-*-tint` to a dark translucent value in both dark blocks of `variables.css`.

```ts
// platform.ts
export function macVibrancyClass(material = "windowBackground"): string {
  return `sui-mac-vibrancy sui-mac-vibrancy-${material}`;
}
```

### 2.1 `NSVisualEffectView.blendingMode` / `.state` — KNOWN, partially modeled
- `.blendingMode` = `behindWindow` (sample the desktop/windows behind — what `backdrop-filter` does) vs `withinWindow` (sample sibling content). The web `backdrop-filter` is always `behindWindow`-like; `withinWindow` has no pure-CSS analog → DESIGNED note: approximate by placing the vibrancy over an in-window blurred copy if ever needed.
- `.state` = `active`/`inactive`/`followsWindowActiveState` — the inactive-window dimming. Reused from the iOS `MaterialActiveAppearance` mechanism (`data-active="inactive"` → kill the saturation pop). Mirrors `effects.global.css §2`.

---

## 3. macOS 26 — the vibrancy materials ARE Liquid Glass — KNOWN (Tahoe) / DESIGNED (CSS)

On macOS 26 the `NSVisualEffectView` materials render with the Liquid Glass treatment (specular rim + diagonal sheen + lift), the same design language as iOS 26. Rather than fork the recipe, the platform layer **reuses the iOS-26 `--sui-glass-*` tokens**: under the default `[data-design-mode="liquidGlass"]`, `.sui-mac-vibrancy` gains the glass rim box-shadow and a (calmer, `opacity:0.45`) screen-blended `::before` sheen — the *same* `--sui-glass-rim`/`--sui-glass-sheen` vars `effects.global.css` uses. Under `[data-design-mode="classic"]` the sheen `::before` is hidden and the surface stays the pre-26 flat frosted vibrancy.

So a single prop matrix selects the look:
- `platform="macOS"` + `designMode="liquidGlass"` → macOS 26 Liquid Glass desktop.
- `platform="macOS"` + `designMode="classic"` → macOS ≤15 (Sonoma/Sequoia) flat vibrancy.
- `platform="iOS"` → the touch kit (unchanged).

The sheen is deliberately calmer than iOS (`opacity:0.45` vs `0.92`) because desktop chrome is denser and must stay legible under the glint — INFERRED calibration.

---

## 4. ACCENT + FOCUS RING + SELECTION — KNOWN (HIG/AppKit) / INFERRED (px+alpha)

A single configurable accent drives the two macOS-defining cues. Default is System Blue (`NSColor.controlAccentColor` ≈ `#007AFF` light / `#0A84FF` dark); the app overrides `--sui-mac-accent` for a custom accent (the macOS *Accent color* preference).

### 4.1 Focus ring — KNOWN (HIG: "the focus ring") / INFERRED (3px glow)
The key control draws a **3px accent glow**. Implemented as a layered `box-shadow` halo (sits outside the box, no layout shift) keyed on `:focus-visible` OR an explicit `data-focused="true"` / class, so a control can opt in either way:
```css
.sui-mac-focus-ring:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--sui-mac-focus-ring-width) var(--sui-mac-focus-ring-color),
              0 0 0 1px var(--sui-mac-accent);
}
```
`--sui-mac-focus-ring-width: 3px`, `--sui-mac-focus-ring-color: rgba(0,122,255,0.5)`. `macFocusRingClass(emphasized)` widens the halo for primary/default buttons.

### 4.2 Selection pill — KNOWN (AppKit: emphasized vs unemphasized selection) / INFERRED (radius+fill)
A selected sidebar/list row gets a **rounded accent-tinted pill** (`NSColor.selectedContentBackgroundColor`). Two states, matching AppKit's *emphasized* vs *unemphasized*:
- **Emphasized** (window focused): solid accent fill (`--sui-mac-selection-fill: rgba(0,122,255,0.85)`) + white label (`--sui-mac-selection-text`). Vibrant glyphs inside go white too.
- **Inactive/unemphasized** (window unfocused): flat grey fill (`--sui-mac-selection-fill-inactive`, `NSColor.unemphasizedSelectedContentBackgroundColor`) + original label color.

The pill is the row's own background, `border-radius: var(--sui-mac-selection-radius)` (6px), inset in the row gutter — the source-list look. Toggled by `data-selected="true"` on the row OR the `.sui-mac-selection` class; `data-window-active="false"` downgrades to the inactive grey.
```ts
export function macSelectionClass(selected, emphasized = true): string {
  if (!selected) return "";
  return emphasized ? "sui-mac-selection" : "sui-mac-selection sui-mac-selection-inactive";
}
```

### 4.3 Row densities — KNOWN (HIG)
`.sui-mac-list-row` (24px) and `.sui-mac-sidebar-row` (28px) set the desktop densities, a hover wash (`--sui-mac-hover-fill`, only when not selected — the pill wins), tight gutters, and host the selection pill.

---

## 5. WINDOW CHROME — traffic lights + unified toolbar — KNOWN (AppKit) / INFERRED+DESIGNED

### 5.1 Traffic lights — KNOWN (`NSWindowButton`) / INFERRED (12px / 8px)
The close/minimize/zoom cluster: three **12px** dots, **8px** center-to-center, hues `#FF5F57 / #FEBC2E / #28C840`. When the window is unfocused (`data-window-active="false"`) all three go grey (`--sui-mac-traffic-inactive`). The glyphs (×, −, +) reveal on cluster hover — the standard AppKit reveal-on-hover. `.sui-mac-traffic-lights` is a flex row; nth-child selects the hue; `::after` carries the hover glyph. `-webkit-app-region: no-drag` so the dots stay clickable inside a draggable titlebar.

### 5.2 Unified toolbar — KNOWN (`NSToolbar` unified) / DESIGNED (`-webkit-app-region`)
The modern macOS window fuses titlebar + toolbar into one strip (`.sui-mac-toolbar`, 38px, a `.titlebar` vibrancy surface with the traffic-light gutter leading). For an Electron/PWA window chrome the strip is a drag region (`-webkit-app-region: drag`) while its buttons/inputs/links opt out (`no-drag`) so they stay clickable — DESIGNED, since AppKit handles drag natively but the web needs the app-region hint.

### 5.3 Sidebar — KNOWN (`NSSplitViewController`)
The source list is a `.sidebar` vibrancy surface (`macVibrancyClass("sidebar")`) at `--sui-mac-sidebar-width` (220px), populated with `.sui-mac-sidebar-row`s carrying the selection pill. This is the desktop counterpart to the iOS `NavigationSplitView`.

---

## 6. ENVIRONMENT WIRING — `platform` on `SwiftUIEnvironment` — KNOWN (our API)

`environment.tsx` adds `platform: 'iOS' | 'macOS'` (canonical `Platform` type, default `'iOS'`), exposed three ways:
1. **Prop:** `<SwiftUIProvider platform="macOS">` (via `Partial<SwiftUIEnvironment>` on `SwiftUIProviderProps`).
2. **Hook:** `useEnvironment().platform`, or the convenience `usePlatform()` / `useIsMac()` in `platform.ts`.
3. **Data attribute:** projected as `data-platform={env.platform}` on the `.sui-root` wrapper, so `macos.global.css` scopes every macOS rule under `[data-platform="macOS"]` — an iOS subtree on the same page is untouched, and a nested `<SwiftUIProvider platform="iOS">` re-scopes back.

All existing environment behavior (colorScheme/system resolution, tint, controlSize, dynamicType, layoutDirection, designMode, the `data-theme`-on-`<html>` projection) is preserved unchanged; `platform` is purely additive (the field is required on the full interface, supplied by `DEFAULTS` and the provider memo; `EnvironmentOverride` stays `Partial`).

`Platform` lives in `environment.tsx` (one source of truth) and is re-exported from `platform.ts` so callers can import it next to the other platform helpers.

---

## 7. What is DESIGNED (no 1:1 primitive) — honest gaps

- **`withinWindow` blending mode** — `backdrop-filter` only samples behind the element; the within-window vibrancy mode has no pure-CSS analog. Approximate with an in-window blurred copy if needed.
- **Drag region** — `-webkit-app-region` is the web (Electron/PWA) affordance for the native titlebar drag AppKit gives for free.
- **No-backdrop-filter fallback** — `@supports not (backdrop-filter)` keeps the per-material tint as an opaque-ish scrim (loses the live vibrancy wash, stays legible).
- **Liquid Glass refraction** — true `feDisplacementMap` backdrop refraction is out of scope for pure CSS (same caveat as the iOS glass teardown); the macOS-26 layer reuses the rim+sheen approximation, not real lensing.

---

## 8. Verification

- `npx tsc --noEmit` — clean across the whole project (the new required `platform` field broke no `SwiftUIEnvironment` constructor; only `DEFAULTS` + the provider memo build the full interface, both updated).
- `macos.global.css` — BARE selectors only (no `:global(...)`), 40/40 brace-balanced, scoped under `[data-platform="macOS"]`, consumes only `--sui-mac-*` + reused `--sui-glass-*` vars.
- `variables.css` — 89 `--sui-mac-*` definitions across `:root` + both dark blocks, 7/7 brace-balanced.
