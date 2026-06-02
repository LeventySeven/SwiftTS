# SwiftUI Color System — RE Token Spec

Domain: **Color system** (semantic + system palette + fill + hierarchy).
Target: canonical iOS 17/18-era SwiftUI look. iOS 26 "Liquid Glass" deltas recorded as labelled notes, never as replacements.
Goal: a senior engineer must be able to rebuild the entire CSS custom-property set from the token list alone.

---

## 0. Provenance & how SwiftUI colors actually resolve

**KNOWN (from swiftinterface).** SwiftUICore declares the color *names* and the
*hierarchy*, but **not** the RGB literals — those resolve at render time from the
platform asset catalog / UIKit-NSColor bridge. What the swiftinterface proves:

- `SwiftUICore.Color` exposes the system palette as static vars on the
  `ShapeStyle where Self == Color` extension (swiftinterface arm64e
  `:7566–7618`): `red, orange, yellow, green, mint, teal, cyan, blue, indigo,
  purple, pink, brown, white, gray, black, clear`. `mint/teal/cyan/indigo/brown`
  are gated `iOS 15.0 / macOS 12.0` — the rest are `iOS 13.0`.
- `Color.primary` / `Color.secondary` are `public static let` (`:7557–7558`).
  In SwiftUI these are the `ShapeStyle` foreground hierarchy, and they bridge to
  UIKit `label` / `secondaryLabel`. `Color.primary == UIColor.label`,
  `Color.secondary == UIColor.secondaryLabel`. (KNOWN name → INFERRED bridge.)
- `HierarchicalShapeStyle` (`:6685–6745`) declares **five** levels:
  `primary, secondary, tertiary, quaternary, quinary` and a
  `HierarchicalShapeStyleModifier(base:level:)` where the `.secondary`/`.tertiary`
  /`.quaternary`/`.quinary` accessors pass `level: 1/2/3/4` respectively
  (`:6712–6727`). This is the opacity-cascade applied to *any* base style.
- `SeparatorShapeStyle` (`:7764–7787`) and the background/fill semantics resolve
  through the same UIKit bridge.
- `Color.accentColor` (`:1918`) is the app tint; default = `systemBlue`.
  `.tint(_:)` overrides it per-subtree; `.primary`/`.secondary` are NOT the tint.

**INFERRED (from Apple HIG + UIColor RE tables).** Every hex/RGBA below is the
published Apple value, cross-checked across Sarunw's dark-color cheat sheet,
noahgilmore's iOS-13 compatibility table, the Flutter `CupertinoColors` mirror,
and ColorSift's Apple-system-colors reference. These are reference values — Apple
warns they may drift per release, so they are CALIBRATE-against-device, but they
have been stable across iOS 13→18.

**Color space.** All values are **sRGB / Display-P3-tagged sRGB**. When SwiftUI
emits a `Color(.sRGB, red:green:blue:opacity:)` it uses sRGB IEC 61966-2-1.
On web, map straight to CSS sRGB hex; no gamma conversion needed.

---

## 1. Label hierarchy (text/foreground)

The label colors are an **opaque-black / opaque-white base + alpha** design. Light
base = `#000000` carried as `#3C3C43` tint for the de-rated levels; dark base =
`#FFFFFF` carried as `#EBEBF5`. Alpha encodes the level. (INFERRED, Apple HIG.)

| Token | Light hex (RGBA) | Dark hex (RGBA) | SwiftUI name |
|---|---|---|---|
| `label` | `#000000` α1.0 | `#FFFFFF` α1.0 | `Color.primary` |
| `secondaryLabel` | `#3C3C43` α0.60 → `#3C3C4399` | `#EBEBF5` α0.60 → `#EBEBF599` | `Color.secondary` |
| `tertiaryLabel` | `#3C3C43` α0.30 → `#3C3C434D` | `#EBEBF5` α0.30 → `#EBEBF54D` | (tertiary hierarchy) |
| `quaternaryLabel` | `#3C3C43` α0.18 → `#3C3C432E` | `#EBEBF5` α0.18 → `#EBEBF52E` | (quaternary hierarchy) |
| `placeholderText` | `#3C3C43` α0.30 → `#3C3C434D` | `#EBEBF5` α0.30 → `#EBEBF54D` | `Color(.placeholderText)` |

`placeholderText` is numerically identical to `tertiaryLabel`. `quinary` (5th
level) ≈ α0.10 of the same base (used by Liquid-Glass-era thin strokes).

---

## 2. Backgrounds (base + grouped, base/elevated)

iOS has TWO background families: **base** (plain screens) and **grouped** (table/
form screens). Each has 3 tiers. In dark mode each also has a **base** vs
**elevated** surface — elevated (sheets/popovers/modals presented over content)
shifts one step lighter. Values below are the **base** dark surface; elevated
deltas noted. (INFERRED, Apple HIG.)

### Base backgrounds
| Token | Light | Dark (base) | Dark (elevated) |
|---|---|---|---|
| `systemBackground` | `#FFFFFF` | `#000000` | `#1C1C1E` |
| `secondarySystemBackground` | `#F2F2F7` | `#1C1C1E` | `#2C2C2E` |
| `tertiarySystemBackground` | `#FFFFFF` | `#2C2C2E` | `#3A3A3C` |

### Grouped backgrounds
| Token | Light | Dark (base) | Dark (elevated) |
|---|---|---|---|
| `systemGroupedBackground` | `#F2F2F7` | `#000000` | `#1C1C1E` |
| `secondarySystemGroupedBackground` | `#FFFFFF` | `#1C1C1E` | `#2C2C2E` |
| `tertiarySystemGroupedBackground` | `#F2F2F7` | `#2C2C2E` | `#3A3A3C` |

**Web mapping for elevated.** Provide a `.sui-elevated` scope class (or
`[data-elevation="elevated"]`) under `.dark` that re-points the six background
vars to the elevated column. Base `:root.dark` uses the base column.

---

## 3. Fills (overlay fills for shapes/controls)

Overlay fills sit *on top of* content with translucency so the background shows
through. Single base gray per tier, **mode-specific alpha**. Base RGB:
`120,120,128` (`#787880`) for tiers 1–2; `118,118,128` (`#767680`) tier 3;
`116,116,128` (`#747480`) tier 4. (INFERRED, Apple HIG; bases from ColorSift,
opacities from Apple HIG dark-mode fill table — stable iOS 13→18.)

| Token | Base RGB | Light α | Dark α | Light RGBA hex | Dark RGBA hex |
|---|---|---|---|---|---|
| `systemFill` | `120,120,128` | 0.20 | 0.36 | `#78788033` | `#7878805C` |
| `secondarySystemFill` | `120,120,128` | 0.16 | 0.32 | `#78788028` | `#78788052` |
| `tertiarySystemFill` | `118,118,128` | 0.12 | 0.24 | `#7676801F` | `#7676803D` |
| `quaternarySystemFill` | `116,116,128` | 0.08 | 0.18 | `#7474801A` | `#7474802E` |

These are the canonical "rounded-rect control background" fills (search bars,
segmented controls, capsule chips). On web they MUST be emitted as `rgba()` so
the page background bleeds through — do not flatten to opaque.

---

## 4. Separators & link

| Token | Light | Dark | Note |
|---|---|---|---|
| `separator` | `#3C3C43` α0.29 → `#3C3C434A` | `#545458` α0.65 → `#545458A6` | translucent hairline; SwiftUI `SeparatorShapeStyle` / `Color(.separator)` |
| `opaqueSeparator` | `#C6C6C8` α1.0 | `#38383A` α1.0 | opaque variant for overlapping content |
| `link` | `#007AFF` | `#0A84FF` | hyperlink tint (= systemBlue) |

Dark `separator` alpha is published by Apple as **0.65** (`#545458A6`); some RE
tables quote 0.60 (`#54545899`). Use 0.65 (HIG). Hairline width is a *metrics*
token (1px / 0.5pt @2x), not a color token.

---

## 5. System color palette (vibrant accent colors)

Each has a distinct light & dark variant for vibrancy on the opposite background.
(INFERRED, Apple HIG / UIColor RE; cross-checked.) These are the colors behind
`Color.red`, `Color.blue`, … in SwiftUI (which map to UIColor `systemRed`, etc.).

| Token | SwiftUI | Light | Dark |
|---|---|---|---|
| `system.red` | `Color.red` | `#FF3B30` | `#FF453A` |
| `system.orange` | `Color.orange` | `#FF9500` | `#FF9F0A` |
| `system.yellow` | `Color.yellow` | `#FFCC00` | `#FFD60A` |
| `system.green` | `Color.green` | `#34C759` | `#30D158` |
| `system.mint` | `Color.mint` | `#00C7BE` | `#66D4CF` |
| `system.teal` | `Color.teal` | `#30B0C7` | `#40C8E0` |
| `system.cyan` | `Color.cyan` | `#32ADE6` | `#64D2FF` |
| `system.blue` | `Color.blue` | `#007AFF` | `#0A84FF` |
| `system.indigo` | `Color.indigo` | `#5856D6` | `#5E5CE6` |
| `system.purple` | `Color.purple` | `#AF52DE` | `#BF5AF2` |
| `system.pink` | `Color.pink` | `#FF2D55` | `#FF375F` |
| `system.brown` | `Color.brown` | `#A2845E` | `#AC8E68` |

**Palette deltas / contested values (DOCUMENTED, not replaced):**
- `system.teal` — iOS 13–14 light teal was `#5AC8FA` (the old "light blue
  teal"). iOS 15+ re-tuned teal to `#30B0C7` (light) / `#40C8E0` (dark) and the
  old `#5AC8FA` became `systemCyan`-adjacent. Canonical iOS 17/18 = `#30B0C7`.
  Some cheat sheets still list the legacy `#5AC8FA/#64D2FF` under "teal" — that's
  pre-15. Use `#30B0C7`.
- `system.mint` dark — Apple's Xcode color picker / HIG = `#66D4CF`. The
  Flutter `CupertinoColors` mirror and ColorSift list `#63E6E2`. Canonical
  (HIG) = `#66D4CF`; `#63E6E2` is the documented divergence.

---

## 6. Gray ramp (systemGray … systemGray6)

`systemGray` is identical in both modes; gray2–gray6 **invert** their progression
(light gets progressively lighter toward gray6; dark gets progressively darker).
(INFERRED, Apple HIG.) Note the dark ramp gray5=`#2C2C2E`, gray6=`#1C1C1E` are the
same values reused by `tertiary`/`secondary` backgrounds — that is intentional.

| Token | SwiftUI | Light | Dark |
|---|---|---|---|
| `system.gray` | `Color.gray` | `#8E8E93` | `#8E8E93` |
| `system.gray2` | `Color(.systemGray2)` | `#AEAEB2` | `#636366` |
| `system.gray3` | `Color(.systemGray3)` | `#C7C7CC` | `#48484A` |
| `system.gray4` | `Color(.systemGray4)` | `#D1D1D6` | `#3A3A3C` |
| `system.gray5` | `Color(.systemGray5)` | `#E5E5EA` | `#2C2C2E` |
| `system.gray6` | `Color(.systemGray6)` | `#F2F2F7` | `#1C1C1E` |

---

## 7. Tint / accent

| Token | Value | Note |
|---|---|---|
| `tint` | `#007AFF` light / `#0A84FF` dark | default = `systemBlue`. `Color.accentColor` (swiftinterface `:1918`). Overridable via `.tint(_:)` / `.accentColor(_:)`. |

In the web kit, `--sui-color-tint` is the single overridable accent token. Every
control that reads "the app tint" (buttons, switches, sliders, selected states)
references `var(--sui-color-tint)` so a host app can re-theme by setting one var.

---

## 8. Fixed colors (mode-invariant)

| Token | Value |
|---|---|
| `fixed.white` | `#FFFFFF` (both modes) |
| `fixed.black` | `#000000` (both modes) |
| `fixed.clear` | `transparent` (rgba 0,0,0,0) |

`Color.white/.black/.clear` are NOT semantic — they do not adapt. Distinct from
`label`(black-that-flips) and `systemBackground`(white-that-flips).

---

## 9. Hierarchy multipliers (ShapeStyle level cascade) — KNOWN structure

From swiftinterface `HierarchicalShapeStyle` (`:6685–6745`): applying `.secondary`
/`.tertiary`/`.quaternary`/`.quinary` to any base ShapeStyle multiplies its alpha.
The multipliers themselves are baked in the dylib (not literals in the
swiftinterface); the RE'd values match the label-alpha progression:

| Token | Level | Multiplier | Web use |
|---|---|---|---|
| `hierarchy.primary` | 0 | 1.00 | full-strength foreground |
| `hierarchy.secondary` | 1 | 0.50 | de-rated (≈secondaryLabel feel) |
| `hierarchy.tertiary` | 2 | 0.25 | |
| `hierarchy.quaternary` | 3 | 0.18 | matches quaternaryLabel α |
| `hierarchy.quinary` | 4 | 0.10 | iOS 17+/Liquid-Glass thin strokes |

DESIGNED for web: emit these as opacity multipliers; e.g.
`color-mix(in srgb, var(--base) 50%, transparent)` for secondary, so any tinted
shape can cascade the same way SwiftUI does.

---

## 10. iOS 26 "Liquid Glass" deltas (DOCUMENTED, not applied)

- Liquid Glass introduces translucent, blurred material backgrounds where iOS
  17/18 used opaque `systemBackground`. The *semantic color tokens above remain
  the fallback values* under reduced-transparency. Keep canonical opaque values
  as the base; layer glass as a separate material domain.
- `quinary` hierarchy level gains prominence (thin glass separators/strokes).
- Tint behavior unchanged; accent still defaults to systemBlue.
- Do NOT overwrite any §1–§8 value with a Liquid-Glass value — they coexist.

---

## 11. Web mapping (CSS compilation strategy)

1. **Opaque adaptive colors** (labels-primary, backgrounds, opaqueSeparator, the
   full palette, gray ramp) → plain hex `--sui-color-x: #RRGGBB;` in `:root`,
   overridden in `:root.dark` (or `@media (prefers-color-scheme: dark)`).
2. **Alpha-carrying colors** (secondary/tertiary/quaternary label, placeholder,
   all fills, translucent separator) → MUST be `rgba()` / 8-digit hex so the
   background shows through. Never flatten. Example:
   `--sui-color-secondary-label: rgba(60,60,67,0.6);` →
   dark `rgba(235,235,245,0.6);`.
3. **Elevated dark surfaces** → scope class `.sui-elevated.dark` (or
   `[data-elevation=elevated]`) re-points the 6 background vars one step lighter.
4. **Tint** → single `--sui-color-tint`; every interactive control references it.
5. **Hierarchy cascade** → implement `.secondary/.tertiary/...` as
   `color-mix(in srgb, currentColor X%, transparent)` using the §9 multipliers,
   so de-rating works on ANY base color, matching SwiftUI's ShapeStyle behavior.
6. **Color space** → values are sRGB; emit as-is. If targeting wide-gamut, wrap
   in `color(display-p3 …)` with the sRGB hex as fallback (Apple tags these P3 on
   capable displays, but sRGB hex is the safe canonical web value).

Source labels: **KNOWN** = SwiftUICore swiftinterface (names, hierarchy, gating,
accent var). **INFERRED** = Apple HIG + cross-checked UIColor RE tables (every
hex/alpha). **DESIGNED** = the web compilation strategy (rgba vs hex split,
elevated scope, color-mix cascade, P3 fallback).
