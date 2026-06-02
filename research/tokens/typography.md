# SwiftUI Typography — RE Design-Token Spec

**Domain:** Typography (SF Pro family + Dynamic Type text styles at the default **Large** content-size category).
**Target:** Canonical iOS 17 / iOS 18 / macOS 14–15 SwiftUI look (the stable, documented "SwiftUI look"). iOS 26 "Liquid Glass" deltas are labeled, never substituted.
**Goal:** Every component in the kit sits on these tokens. A senior engineer must be able to rebuild the entire CSS-variable set from the token list alone.

## Source labels

- **KNOWN** — read directly from the SwiftUICore/SwiftUI `.swiftinterface` (Tier-1A) or baked dylib constant. The *type system* (enum cases, weight names, design variants, leading enum) is KNOWN.
- **INFERRED** — Apple's published numeric values (HIG Typography "Specifications" table, Dynamic Type size tables, SF tracking tables, WWDC). The *numbers* (point size, leading, tracking) are **not** in the swiftinterface — they live in CoreText/`UIFontDescriptor` data and Apple's published tables — so they are INFERRED-from-docs at high confidence.
- **DESIGNED** — the web/CSS compilation choices (font stack, `line-height` derivation, `letter-spacing` rounding) that I author to make the browser reproduce the native metrics.

---

## 1. Type system extracted from the swiftinterface (KNOWN)

Source file (Tier-1A, read line-by-line):
`/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/System/Library/Frameworks/SwiftUICore.framework/Versions/A/Modules/SwiftUICore.swiftmodule/arm64e-apple-macos.swiftinterface`

### 1.1 `Font.TextStyle` cases — swiftinterface L12146-12181 (KNOWN)

```swift
public enum TextStyle : Swift.CaseIterable, Swift.Sendable {
  case largeTitle
  case title          // == "title1" / Title 1
  case title2         // @available(iOS 14, macOS 11+)
  case title3         // @available(iOS 14, macOS 11+)
  case headline
  case subheadline
  case body
  case callout
  case footnote
  case caption        // == "caption1" / Caption 1
  case caption2       // @available(iOS 14, macOS 11+)
  case extraLargeTitle    // visionOS-only (iOS/macOS unavailable) — out of scope
  case extraLargeTitle2   // visionOS-only — out of scope
}
```

Note the SwiftUI API name vs. HIG display name mapping: `.title` → "Title 1", `.caption` → "Caption 1". There is **no** `.title1`/`.caption1` symbol; `title1`/`caption1` are the HIG/UIKit (`UIFont.TextStyle.title1`) names for the same styles.

### 1.2 `Font.Weight` — swiftinterface L12236-12252 (names KNOWN; CGFloat `value` baked in dylib)

```swift
@frozen public struct Weight : Swift.Hashable {
  package var value: CoreFoundation.CGFloat   // numeric weight, baked in SwiftUICore dylib (not in interface text)
  public static let ultraLight   // -0.80
  public static let thin         // -0.60
  public static let light        // -0.40
  public static let regular      //  0.00
  public static let medium       //  0.23
  public static let semibold     //  0.30
  public static let bold         //  0.40
  public static let heavy        //  0.56
  public static let black        //  0.62
}
```

The struct stores a single `CGFloat value` in the Apple **`UIFont.Weight`/`NSFont.Weight` normalized scale** `[-1.0 … +1.0]` (the `kCTFontWeightTrait` axis), NOT the CSS `100…900` numeric scale. The `value` literals are baked into the SwiftUICore dylib (which lives in the dyld shared cache; the on-disk `.../SwiftUICore.framework/SwiftUICore` is a stub symlink, so `otool -tV` requires shared-cache extraction). The `[-1…1]`→`100…900` name map below is the **stable, published** Apple correspondence (CSS `font-weight` keyword equivalents) and is what the web kit compiles to.

| Weight name | CTFontWeightTrait `value` | CSS numeric | CSS keyword |
|---|---|---|---|
| ultraLight | -0.80 | 100 | (thin) |
| thin       | -0.60 | 200 | |
| light      | -0.40 | 300 | light |
| regular    |  0.00 | 400 | normal |
| medium     |  0.23 | 500 | medium |
| semibold   |  0.30 | 600 | semibold |
| bold       |  0.40 | 700 | bold |
| heavy      |  0.56 | 800 | |
| black      |  0.62 | 900 | |

### 1.3 `Font.Design` — swiftinterface L17522-17534 (KNOWN)

```swift
public enum Design : Swift.Hashable, Swift.Sendable {
  case `default`     // SF Pro (system)
  case serif         // New York (NY) — @available(watchOS 7+)
  case rounded       // SF Pro Rounded
  case monospaced    // SF Mono — @available(watchOS 7+)
}
```

### 1.4 `Font.Leading` — swiftinterface L12296-12305 (KNOWN)

```swift
public enum Leading : Swift.Sendable { case standard; case tight; case loose }
```

`.standard` is the per-style leading tabulated in §2. `.tight`/`.loose` shift line height by the CoreText `kCTFontLeadingTrait` delta (≈ ∓0.2 × cap-height band; ≈ ∓2pt at body size). Out of the default-token scope but provided as a CSS modifier in §5.4.

### 1.5 Constructor surface (KNOWN — for completeness)

- `Font.system(_:design:weight:)` — swiftinterface L12139. The `style` selects the Dynamic-Type metrics in §2.
- `Font.system(size:weight:design:)` — L17515-17521. Default `weight = .regular`, `design = .default`. A *fixed* size that does **not** scale with Dynamic Type.
- `Font.custom(_:size:relativeTo:)` — L17497. Scales a custom face relative to a TextStyle's metric.
- `@ScaledMetric(relativeTo:)` — L11989/12005, default `textStyle: .body` — the scaling anchor; default Large = scale factor 1.0.

---

## 2. Dynamic Type metrics at Large (default) content size (INFERRED — Apple HIG Specifications)

These numbers are **not** in the swiftinterface — they are Apple's published **HIG → Typography → Specifications** table for iOS at the `.large` (default) `UIContentSizeCategory`. `.large` is the system default when the user has not changed text size (confirmed: "The default content size category … is `.large`").

**Weight:** every style is **Regular (400)** except **Headline = Semibold (600)**. (Older iOS 11-era HIG snapshots listed Title 1 as *Light*; the modern iOS 17/18 SwiftUI default is **Regular** — see §6 delta.)

| Style (SwiftUI / HIG) | Size (pt→px) | Weight | Leading / line-height (pt→px) | Tracking (1/1000 em) | Tracking (px) | Optical face |
|---|---|---|---|---|---|---|
| largeTitle / Large Title | 34 | Regular 400 | 41 | +11 | **+0.37** | Display (≥20) |
| title / Title 1          | 28 | Regular 400 | 34 | +13 | **+0.36** | Display |
| title2 / Title 2         | 22 | Regular 400 | 28 | +16 | **+0.35** | Display |
| title3 / Title 3         | 20 | Regular 400 | 25 | +19 | **+0.38** | Display (=20 crossover) |
| headline / Headline      | 17 | **Semibold 600** | 22 | −24 | **−0.41** | Text (<20) |
| body / Body              | 17 | Regular 400 | 22 | −24 | **−0.41** | Text |
| callout / Callout        | 16 | Regular 400 | 21 | −20 | **−0.32** | Text |
| subheadline / Subhead    | 15 | Regular 400 | 20 | −16 | **−0.24** | Text |
| footnote / Footnote      | 13 | Regular 400 | 18 | −6  | **−0.08** | Text |
| caption / Caption 1      | 12 | Regular 400 | 16 | 0   | **0.00**  | Text |
| caption2 / Caption 2     | 11 | Regular 400 | 13 | +6  | **+0.07** | Text |

**1pt = 1px** at the @1x logical-CSS baseline (CSS px == iOS pt; Apple's HIG tables are in pt, the web kit treats them as px). Retina @2x/@3x is the device-pixel concern, not the token value.

### 2.1 Tracking model (how the px column is derived)

Apple publishes tracking in **1/1000 em** in the HIG. The browser wants `letter-spacing` in px:

```
tracking_px = (tracking_em_per_1000 / 1000) × point_size
```

Verified self-consistent and matching the prompt anchor `body = −0.41px`:
- body/headline: `−24/1000 × 17 = −0.408 → −0.41` ✓ (matches anchor exactly)
- largeTitle: `+11/1000 × 34 = +0.374 → +0.37`
- title1: `+13/1000 × 28 = +0.364 → +0.36`
- title2: `+16/1000 × 22 = +0.352 → +0.35`
- title3: `+19/1000 × 20 = +0.380 → +0.38`
- callout: `−20/1000 × 16 = −0.320 → −0.32`
- subheadline: `−16/1000 × 15 = −0.240 → −0.24`
- footnote: `−6/1000 × 13 = −0.078 → −0.08`
- caption1: `0`
- caption2: `+6/1000 × 11 = +0.066 → +0.07`

These px values also match the well-known **SF UI Font Fixer** per-size data (11pt:+0.07, 12pt:0, 17pt:≈−0.4) — independent confirmation.

### 2.2 SF Text vs SF Display optical crossover (INFERRED — confirmed verbatim "The breaking point is 20pt")

- **< 20 pt → SF Pro *Text*** (separate optical master: looser spacing, taller x-height, open apertures for small-text legibility).
- **≥ 20 pt → SF Pro *Display*** (tighter spacing, refined for headlines).
- The crossover is **20 pt exactly**: `title3` (20pt) and up use Display; `headline`/`body` (17pt) and down use Text.
- On native this is a single variable font (`SF Pro`) with an **optical-size (`opsz`) axis**; CoreText picks the master automatically by point size. The browser cannot switch optical masters via the system font stack — see §5.5 for the limitation and the variable-font fallback.

---

## 3. Design variants → concrete font families (KNOWN cases / INFERRED face names)

| `Font.Design` | Native face | Web `font-family` substitute | Notes |
|---|---|---|---|
| `.default` | SF Pro (Text/Display via opsz) | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif` | The system stack; on Apple browsers `-apple-system` *is* SF Pro with correct optical sizing. |
| `.rounded` | SF Pro Rounded | `"SF Pro Rounded", system-ui, ui-rounded, "Helvetica Neue", Arial, sans-serif` | `ui-rounded` generic maps to SF Pro Rounded on Safari. No web-safe rounded fallback — ship the font or accept system-ui. |
| `.monospaced` | SF Mono | `ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Monaco, "Cascadia Code", "Roboto Mono", monospace` | `ui-monospace` → SF Mono on Safari. |
| `.serif` | New York (NY) | `ui-serif, "New York", Georgia, "Times New Roman", serif` | `ui-serif` → New York on Safari. NY also has Text/Display optical masters. |

`-apple-system` and `BlinkMacSystemFont` resolve to the live SF Pro **only on Apple/Chromium-on-macOS**; on Windows/Linux/Android the stack falls through to Helvetica Neue/Arial/`sans-serif`, which have different metrics (no optical sizing, different tracking) — flagged as a fidelity gap in §7.

---

## 4. Token namespace

```
text.<style>.size        px    point size (Large default)
text.<style>.weight      int   CSS numeric weight (400/600)
text.<style>.lineHeight  px    leading
text.<style>.tracking    px    letter-spacing (signed)
text.<style>.opticalFace enum  "text" | "display"  (informational; drives opsz fallback)

font.weight.<name>            int   100…900 CSS map
font.weight.<name>.ct         num   CTFontWeightTrait value (-1..1)

font.family.default      stack
font.family.rounded      stack
font.family.monospaced   stack
font.family.serif        stack

font.opticalCrossover    px    20  (Text↔Display threshold)
```

---

## 5. Web mapping — exact CSS each token compiles to

### 5.1 Root variable block (light = sole value here; typography has no dark override)

```css
:root {
  /* font stacks */
  --sui-font-default:   -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
  --sui-font-rounded:   "SF Pro Rounded", ui-rounded, system-ui, "Helvetica Neue", Arial, sans-serif;
  --sui-font-monospaced: ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Monaco, monospace;
  --sui-font-serif:     ui-serif, "New York", Georgia, "Times New Roman", serif;

  /* weights (CSS numeric) */
  --sui-weight-ultraLight: 100;
  --sui-weight-thin:       200;
  --sui-weight-light:      300;
  --sui-weight-regular:    400;
  --sui-weight-medium:     500;
  --sui-weight-semibold:   600;
  --sui-weight-bold:       700;
  --sui-weight-heavy:      800;
  --sui-weight-black:      900;

  /* per-style: size / weight / line-height / tracking */
  --sui-text-largeTitle-size: 34px;   --sui-text-largeTitle-weight: 400; --sui-text-largeTitle-lineHeight: 41px; --sui-text-largeTitle-tracking: 0.37px;
  --sui-text-title1-size: 28px;       --sui-text-title1-weight: 400;     --sui-text-title1-lineHeight: 34px;     --sui-text-title1-tracking: 0.36px;
  --sui-text-title2-size: 22px;       --sui-text-title2-weight: 400;     --sui-text-title2-lineHeight: 28px;     --sui-text-title2-tracking: 0.35px;
  --sui-text-title3-size: 20px;       --sui-text-title3-weight: 400;     --sui-text-title3-lineHeight: 25px;     --sui-text-title3-tracking: 0.38px;
  --sui-text-headline-size: 17px;     --sui-text-headline-weight: 600;   --sui-text-headline-lineHeight: 22px;   --sui-text-headline-tracking: -0.41px;
  --sui-text-body-size: 17px;         --sui-text-body-weight: 400;       --sui-text-body-lineHeight: 22px;       --sui-text-body-tracking: -0.41px;
  --sui-text-callout-size: 16px;      --sui-text-callout-weight: 400;    --sui-text-callout-lineHeight: 21px;    --sui-text-callout-tracking: -0.32px;
  --sui-text-subheadline-size: 15px;  --sui-text-subheadline-weight: 400;--sui-text-subheadline-lineHeight: 20px;--sui-text-subheadline-tracking: -0.24px;
  --sui-text-footnote-size: 13px;     --sui-text-footnote-weight: 400;   --sui-text-footnote-lineHeight: 18px;   --sui-text-footnote-tracking: -0.08px;
  --sui-text-caption1-size: 12px;     --sui-text-caption1-weight: 400;   --sui-text-caption1-lineHeight: 16px;   --sui-text-caption1-tracking: 0px;
  --sui-text-caption2-size: 11px;     --sui-text-caption2-weight: 400;   --sui-text-caption2-lineHeight: 13px;   --sui-text-caption2-tracking: 0.07px;

  --sui-font-opticalCrossover: 20px;
}
```

### 5.2 Per-style utility class pattern

```css
.sui-body {
  font-family: var(--sui-font-default);
  font-size: var(--sui-text-body-size);
  font-weight: var(--sui-text-body-weight);
  line-height: var(--sui-text-body-lineHeight);   /* absolute px, NOT unitless — matches native fixed leading */
  letter-spacing: var(--sui-text-body-tracking);
  font-synthesis: none;                            /* never fake-bold/italic SF */
  -webkit-font-smoothing: antialiased;             /* match Apple's grayscale AA */
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

- **`line-height` must be absolute px** (e.g. `22px`), not a ratio — SwiftUI/CoreText line spacing is a fixed leading per style, independent of the rendered glyph size. A unitless ratio drifts when the cascade changes font-size.
- **`font-synthesis: none`** — SF has real optical/weight masters; synthesizing bold/italic corrupts the look.
- **`-webkit-font-smoothing: antialiased`** reproduces Apple's lighter-weight on-screen rendering (the default `subpixel-antialiased` makes SF look heavier than native).

### 5.3 Design-variant override

```css
.sui-rounded    { font-family: var(--sui-font-rounded); }
.sui-monospaced { font-family: var(--sui-font-monospaced); }
.sui-serif      { font-family: var(--sui-font-serif); }
```
Variant changes **family only**; size/weight/line-height/tracking tokens stay per-style.

### 5.4 `Font.Leading` modifiers (CSS deltas off the per-style line-height)

```css
.sui-leading-tight { line-height: calc(var(--sui-text-body-lineHeight) - 2px); }  /* DESIGNED approx of .tight */
.sui-leading-loose { line-height: calc(var(--sui-text-body-lineHeight) + 2px); }  /* DESIGNED approx of .loose */
```
(±2px is the body-size approximation of the CoreText `kCTFontLeadingTrait` shift; scales with size on native.)

### 5.5 Optical-crossover handling (DESIGNED — the hard part)

The system stack cannot select SF Pro Text vs Display masters per element. Two strategies:

1. **Best fidelity** — self-host the **SF Pro variable font** with the `opsz` axis and drive it:
   ```css
   .sui-largeTitle { font-family: "SF Pro"; font-variation-settings: "opsz" 34; }  /* Display master */
   .sui-body       { font-family: "SF Pro"; font-variation-settings: "opsz" 17; }  /* Text master */
   ```
   Set `opsz` == the point size; CoreText/HarfBuzz then interpolates the same master native uses. (SF Pro license restricts redistribution — host per Apple's font license.)
2. **System-stack fallback** — rely on `-apple-system`, which on Safari/macOS already applies the correct optical master automatically by `font-size`. Pre-baked tracking in §5.1 already encodes the per-size SF spacing, so the visual delta off-Apple is small. This is the default ship mode.

---

## 6. iOS 26 "Liquid Glass" deltas (labeled — do NOT replace canonical)

- **iOS 26** rebalances several text styles slightly heavier and adjusts default weights; SwiftUI gains `Font.pointSize(_:)`, `Font.scaled(by:)`, and Boolean-arg modifiers (`bold(_:)`, `italic(_:)`, `monospaced(_:)`) — swiftinterface L12201-12234, all `@available(iOS 26.0…)`. These are API additions, not metric changes to the canonical Large table.
- **`Font.TextStyle: Codable`** added iOS 26 (L12183-12187).
- Title weights and on-glass tracking are reported to firm up under Liquid Glass, but the **canonical iOS 17/18 values in §2 remain the kit baseline**; record any iOS 26 measured override as a separate `*.glass` token if/when measured. **Not applied here.**

## 6.1 Older-HIG vs modern deltas (informational)

- iOS 11-era HIG: Title 1 = **Light**, Title 3 leading = **24**, callout/footnote/caption shown with different older leadings. **Modern iOS 17/18 SwiftUI** uses **Regular** titles and Title 3 leading **25** — §2 reflects the modern canonical, which is the kit target.

---

## 7. Fidelity notes (honest gaps)

- **Numbers are INFERRED-from-docs, not dylib-extracted.** Point size/leading/tracking live in CoreText `UIFontDescriptor` data + Apple's HIG Specifications, not in the swiftinterface text. The swiftinterface gives the *type system* (KNOWN); the *metrics* are Apple-published (INFERRED, high confidence — cross-checked across HIG, SF Font Fixer, and the −0.41 body anchor which matches to 3 decimals).
- **Weight `value` CGFloats** (§1.2) are the published CTFontWeightTrait scale, not carved from the dylib (the dylib is in the dyld shared cache; on-disk file is a stub symlink). The names are KNOWN; the `[-1..1]` values are the documented Apple scale.
- **Off-Apple platforms** fall through to Helvetica Neue/Arial — different x-height, no optical sizing, different native tracking. The pre-baked px tracking mitigates but does not eliminate this. Ship SF Pro web fonts for 1:1.
- **`line-height` rounding:** Apple's leadings are integer pt; used verbatim as px. No sub-px leading.
- **Tracking rounding:** px values rounded to 2 dp from the `em/1000 × size` formula; the formula (not the rounded px) is the source of truth if you re-derive at other sizes.
