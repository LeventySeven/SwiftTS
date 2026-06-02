# SwiftUI Materials & Visual Effects — RE Token Spec

Domain: **Materials (frosted glass) & visual effects.** Target look: canonical iOS 17/18-era SwiftUI. iOS 26 "Liquid Glass" recorded as a labeled delta, never replacing the canonical material recipe.

Source-label legend:
- **KNOWN** — present verbatim in the local swiftinterface (`SwiftUICore.framework` / `SwiftUI.framework`) or in published Apple docs. The *API surface* (which materials/effects exist, their argument names, defaults, enum cases) is KNOWN.
- **INFERRED** — the numeric *recipe* (blur sigma, saturation %, tint rgba). Apple bakes these into the `SwiftUICore` dylib as a multi-stage `CAFilter` chain; they are **not** exposed in the swiftinterface and not officially published. Values here are the best-known reverse-engineered / community-calibrated approximations that match Apple's rendered output, tuned per material thickness.
- **DESIGNED** — web-platform engineering decisions I made to compile the effect to CSS where no 1:1 primitive exists.

---

## 0. Why the numbers are INFERRED, not KNOWN

The `Material` type in `SwiftUICore.swiftinterface` is **opaque** — an empty struct with only static factory vars:

```swift
// SwiftUICore swiftinterface, line 6305
public struct Material : Swift.Sendable {}          // no stored fields

// lines 6313–6336 — the ShapeStyle extension (KNOWN names)
extension ShapeStyle where Self == Material {
  static var regularMaterial   { .regular }
  static var thickMaterial     { .thick }
  static var thinMaterial      { .thin }
  static var ultraThinMaterial { .ultraThin }
  static var ultraThickMaterial{ .ultraThick }     // iOS 15+
}
extension ShapeStyle where Self == Material {       // line 6335, macOS/iOS only
  static var bar { .bar }
}
// lines 6345–6357 — the canonical instances
extension Material {
  static let regular, thick, thin, ultraThin, ultraThick: Material
  static let bar: Material                          // unavailable tvOS/watchOS
}
```

So the swiftinterface tells us **six canonical materials exist** (`ultraThin, thin, regular, thick, ultraThick, bar`) and nothing about *how* they render. The actual blur happens in a private `CABackdropLayer` whose filter array is roughly:

1. `variableBlur` / `gaussianBlur` (sigma scales with thickness)
2. `colorSaturate` (saturationDeltaFactor — boosts backdrop color, the "vibrancy" pop)
3. `colorMatrix` / `colorDodge` tint overlay (a near-white in Light, near-black in Dark, with a low-alpha tint)
4. an alpha/darkening pass for legibility

The web has exactly one matching primitive — `backdrop-filter: blur() saturate()` + a `background: rgba()` overlay — so we collapse Apple's 3-4 stage chain into `blur + saturate + tint`. The thickness ordering (thinner = less blur, less tint, more see-through) is KNOWN; the absolute px/% are INFERRED and the calibration target is the real rendered material.

---

## 1. Canonical material recipes (Light + Dark)

Six materials, thinnest → thickest. Each compiles to:

```css
.sui-material-X {
  backdrop-filter: blur(<blur>px) saturate(<saturate>);
  -webkit-backdrop-filter: blur(<blur>px) saturate(<saturate>);
  background: <tint rgba>;
}
```

Blur grows with thickness; tint alpha grows with thickness (thicker = more opaque, less of the background shows through); saturation is roughly constant (~1.8, the Apple "vibrancy" boost) across all materials. Dark mode flips the tint base from near-white to near-black and drops tint alpha slightly (dark glass reads darker but stays translucent).

| Material | blur (px) | saturate | Light tint (rgba) | Dark tint (rgba) | Recommended use (KNOWN, HIG) |
|---|---|---|---|---|---|
| `.ultraThinMaterial` | 20 | 1.8 | `rgba(255,255,255,0.44)` | `rgba(37,37,37,0.55)` | lightest scrim; overlay where background must stay visible |
| `.thinMaterial` | 25 | 1.8 | `rgba(255,255,255,0.55)` | `rgba(37,37,37,0.66)` | thin chrome over content |
| `.regularMaterial` | 30 | 1.8 | `rgba(245,245,245,0.72)` | `rgba(30,30,30,0.76)` | **default**; sheets, popovers, standard panels |
| `.thickMaterial` | 40 | 1.8 | `rgba(245,245,245,0.82)` | `rgba(24,24,24,0.84)` | high-contrast surfaces needing strong legibility |
| `.ultraThickMaterial` | 50 | 1.8 | `rgba(245,245,245,0.90)` | `rgba(20,20,20,0.92)` | near-opaque frosted surface (iOS 15+) |
| `.bar` | 30 | 1.8 | `rgba(245,245,245,0.80)` | `rgba(30,30,30,0.82)` | nav/tab/tool bars; macOS/iOS only (unavailable tvOS/watchOS) |

Notes:
- **`.bar`** ≈ `.regular` blur but a touch more opaque — it sits over scrolling content and needs to stay legible at the screen edge. KNOWN it exists and is platform-gated; the recipe is INFERRED.
- **`.regular`** is the SwiftUI default material when you write `.background(.regularMaterial)` shorthand or just `.thinMaterial`-family in a sheet; treat `material.regular` as the base token everything else is relative to.
- The tint base shifts from pure white `255` (ultraThin/thin) to a slightly grey `245` (regular+) because the thicker materials carry more of a frosted-panel body than a pure scrim — INFERRED from rendered output.
- Border companion (DESIGNED, not from Apple): a 0.5px `rgba(255,255,255,0.18)` hairline on Light / `rgba(255,255,255,0.10)` on Dark reproduces the subtle material rim. Optional.

---

## 2. Vibrancy — foreground material styles (hierarchy levels)

When you put text/icons *on* a material, SwiftUI tints the foreground with a **vibrancy** level so content blends into the frosted glass. These are `HierarchicalShapeStyle` (KNOWN, SwiftUICore lines 6656–6727): `primary, secondary, tertiary, quaternary, quinary`.

```swift
extension ShapeStyle where Self == HierarchicalShapeStyle {
  static var primary, secondary, tertiary, quaternary: HierarchicalShapeStyle  // 6657–6666
  static var quinary: HierarchicalShapeStyle                                   // 6676 (iOS 16+)
}
// and the chained form: someStyle.secondary / .tertiary / .quaternary / .quinary  (6710–6727)
// HierarchicalShapeStyleModifier(base:, level:)  level 0..4  (6712–6727)
```

The five levels are opacity multipliers applied to the resolved foreground color (KNOWN levels; INFERRED alphas — these match the standard SwiftUI hierarchy and Apple's documented `secondary/tertiary` foreground alphas). On material, vibrancy ALSO implies `mix-blend-mode` so the text picks up backdrop color, but for a faithful, predictable web replica use plain alpha (blend mode on text over glass is fragile cross-browser).

| Level | level idx | Light alpha | Dark alpha | Web mapping |
|---|---|---|---|---|
| `.primary` | 0 | 1.00 | 1.00 | `color: rgba(0,0,0,1)` / dark `rgba(255,255,255,1)` |
| `.secondary` | 1 | 0.50 | 0.55 | foreground at 0.50 / 0.55 alpha |
| `.tertiary` | 2 | 0.25 | 0.25 | foreground at 0.25 |
| `.quaternary` | 3 | 0.18 | 0.16 | foreground at 0.18 / 0.16 |
| `.quinary` | 4 | 0.10 | 0.10 | foreground at 0.10 (iOS 16+) |

Optional true-vibrancy (DESIGNED): for the closest look, wrap the label in a layer with `mix-blend-mode: overlay` (Light) / `plus-lighter` (Dark) plus the alpha above. Default to alpha-only.

`MaterialActiveAppearance` (KNOWN, SwiftUICore 6388–6396): `automatic, active, inactive, matchWindow` — controls whether a material renders its "active window" vibrancy or the dimmed "inactive" look (macOS window focus). Web mapping: `inactive` ⇒ multiply material tint alpha ×1.0 but cut saturate to `1.0` and vibrancy alpha ×0.7 (DESIGNED — desktop-only nicety).

---

## 3. Visual-effect modifiers → CSS filter

All KNOWN (signatures verbatim from SwiftUICore). Each maps to a CSS `filter` function. Note SwiftUI applies these as a **content** filter (`filter:`), distinct from the material's **backdrop** filter.

| SwiftUI modifier | swiftinterface | default arg | CSS |
|---|---|---|---|
| `.blur(radius:opaque:)` | 3704 | `opaque: false` | `filter: blur(<radius>px)` (radius is a CSS px ≈ Gaussian sigma; SwiftUI radius ≈ CSS px 1:1) |
| `.opacity(_:)` | 4206 | — | `opacity: <0…1>` |
| `.saturation(_:)` | 16379 | — | `filter: saturate(<amount>)` (1.0 = identity; SwiftUI Double = CSS unitless) |
| `.brightness(_:)` | 4438 | — | additive in SwiftUI; CSS `brightness()` is multiplicative ⇒ map `brightness(b)` → `filter: brightness(1 + b)` (DESIGNED conversion; SwiftUI `b` is an additive delta in −1…1) |
| `.contrast(_:)` | 2831 | — | `filter: contrast(<amount>)` (1.0 = identity) |
| `.grayscale(_:)` | 3956 | — | `filter: grayscale(<amount>)` (0…1) |
| `.colorInvert()` | 3782 | — | `filter: invert(1)` |
| `.hueRotation(_:)` | 19493 | — | `filter: hue-rotate(<angle>deg)` (SwiftUI `Angle` → deg) |
| `.luminanceToAlpha()` | 9872 | — | SVG `feColorMatrix type="luminanceToAlpha"` (no CSS primitive; DESIGNED via `mask`/SVG filter) |
| `.colorMultiply(_:)` | (Color) | — | `mix-blend-mode: multiply` overlay of the color, or `filter` chain (DESIGNED) |

`opaque: true` on `.blur` means "don't blur in transparency from outside the view's bounds" → web equivalent is to apply blur to an element with an opaque background (no `backdrop-filter` bleed). DESIGNED note.

### Blend modes (KNOWN — SwiftUICore `BlendMode`, lines 6232–6254, all 21 cases)

`.blendMode(_:)` (SwiftUICore 2618) → CSS `mix-blend-mode`. Full mapping:

| SwiftUI `BlendMode` | CSS `mix-blend-mode` |
|---|---|
| `normal` | `normal` |
| `multiply` | `multiply` |
| `screen` | `screen` |
| `overlay` | `overlay` |
| `darken` | `darken` |
| `lighten` | `lighten` |
| `colorDodge` | `color-dodge` |
| `colorBurn` | `color-burn` |
| `softLight` | `soft-light` |
| `hardLight` | `hard-light` |
| `difference` | `difference` |
| `exclusion` | `exclusion` |
| `hue` | `hue` |
| `saturation` | `saturation` |
| `color` | `color` |
| `luminosity` | `luminosity` |
| `sourceAtop` | **no CSS equiv** → `mix-blend-mode: normal` + `background-clip`/compositing (DESIGNED) |
| `destinationOver` | no CSS equiv → reorder layers / `isolation` (DESIGNED) |
| `destinationOut` | no CSS equiv → `mask` cut-out (DESIGNED) |
| `plusDarker` | no direct CSS → approximate with `darken` (DESIGNED) |
| `plusLighter` | `plus-lighter` (supported in modern WebKit/Blink; fallback `lighten`) |

The first 16 (`normal`…`luminosity`) are exactly the W3C separable+non-separable blend modes → 1:1. The last 5 are Porter-Duff compositing operators with no `mix-blend-mode` analog → DESIGNED fallbacks.

---

## 4. iOS 26 "Liquid Glass" — LABELED DELTA (do not replace §1)

KNOWN API (`SwiftUICore`, all `iOS 26.0 / macOS 26.0`, visionOS unavailable):

```swift
// line 5753
public struct Glass : Equatable, Sendable {
  static var regular: Glass   // 5754
  static var clear:   Glass   // 5757
  static var identity:Glass   // 5760
  func tint(_ color: Color?) -> Glass        // 5763
  func interactive(_ isEnabled: Bool = true) -> Glass  // 5764
}
// line 2529
func glassEffect(_ glass: Glass = .regular, in shape: some Shape = DefaultGlassEffectShape()) -> some View
// line 9045
struct GlassEffectContainer<Content: View>: View { … }   // groups glass shapes so they blend/merge
func glassEffectID(_:in:)        // 17372  — matched-geometry id for glass morphing
func glassEffectUnion(id:in:)    // 9880   — fuse adjacent glass shapes into one blob
func glassEffectTransition(_:)   // 2861

// GlassEffectTransition (2847): .matchedGeometry, .materialize, .identity
// GlassButtonStyle: .glass / .glass(_:)        (SwiftUI 1240–1247)
// GlassProminentButtonStyle: .glassProminent   (SwiftUI 3372–3378)
```

How Liquid Glass differs from canonical material (delta):
- It is **not a flat frosted scrim** — it's a lensing/refractive layer with a live **specular highlight** rim and edge light-bending. Default shape is `Capsule()` (`DefaultGlassEffectShape`), not a rect.
- `.regular` = adaptive frosted glass that picks up surroundings; `.clear` = more transparent, dimming layer for media-rich backgrounds; `.identity` = no glass (passthrough).
- `.tint(color)` injects a colored glass; `.interactive()` makes it react to touch/pointer (scale + highlight shift).
- `GlassEffectContainer` + `glassEffectUnion`/`glassEffectID` let multiple glass shapes **merge like droplets** and morph between states — there is no material equivalent.

CSS approximation (DESIGNED — multi-layer; this is the *delta* recipe, kept separate from §1):

```css
.sui-liquid-glass-regular {
  position: relative;
  backdrop-filter: blur(8px) saturate(1.5) brightness(1.08);
  -webkit-backdrop-filter: blur(8px) saturate(1.5) brightness(1.08);
  background: rgba(255,255,255,0.18);   /* dark: rgba(255,255,255,0.10) */
  border-radius: 9999px;                /* Capsule default */
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,0.55),   /* top specular highlight */
    inset 0 -1px 1px rgba(255,255,255,0.12),  /* bottom counter-light */
    0 4px 16px rgba(0,0,0,0.18);              /* drop shadow */
}
.sui-liquid-glass-regular::before {           /* moving specular sheen */
  content:""; position:absolute; inset:0; border-radius:inherit;
  background: linear-gradient(135deg, rgba(255,255,255,0.40) 0%, transparent 40%);
  mix-blend-mode: screen; pointer-events:none;
}
.sui-liquid-glass-clear {                      /* .clear variant */
  backdrop-filter: blur(4px) saturate(1.2) brightness(1.04);
  background: rgba(255,255,255,0.06);
}
```

`.clear` lowers blur, saturation and tint alpha vs `.regular`. `.tint(c)` ⇒ swap `background` to `color-mix(in srgb, c 25%, transparent)`. `.interactive()` ⇒ add `:active { transform: scale(0.97); filter: brightness(1.12); }`. True refraction/edge-bending and droplet-merge (`glassEffectUnion`) are not reproducible in pure CSS — they'd need an SVG `feDisplacementMap` or a WebGL pass; out of scope, flagged.

---

## 5. Web mapping summary (the CSS each token compiles to)

- `material.<X>.blur` → `backdrop-filter: blur(Npx)` (and `-webkit-` prefix).
- `material.<X>.saturate` → appended to the same `backdrop-filter: … saturate(P)`.
- `material.<X>.tint` / `.tintDark` → `background: rgba(...)` overlay sitting on top of the blurred backdrop.
- `vibrancy.<level>.alpha` → `color`/`fill` alpha of foreground content on the material.
- `effect.blur/opacity/saturation/brightness/contrast/grayscale/hueRotation` → element `filter:`/`opacity:` (content filter, not backdrop).
- `blend.<mode>` → `mix-blend-mode`.
- `liquidGlass.*` → the layered §4 recipe (iOS 26 delta only).

Authoring rule for the kit: emit one CSS custom property per leaf token (`--sui-material-regular-blur: 30px;` etc.), then build the composite `backdrop-filter` from the vars so a theme can retune blur/tint without touching component CSS. Light values go on `:root`, dark overrides under `@media (prefers-color-scheme: dark)` / `[data-theme="dark"]`.

### Calibration plan
Render each real SwiftUI material in a tiny macOS/iOS test app over a known photographic backdrop, screenshot, and eyedrop the resulting pixel; tune `blur`/`saturate`/`tint alpha` of the CSS replica until the composited web pixel matches within ΔE < 3. The §1 numbers are the starting point; the eyedrop loop is the source of truth because the dylib filter chain is multi-stage and not a single published radius.
