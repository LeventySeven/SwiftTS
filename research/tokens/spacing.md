# SwiftUI Spacing, Sizing & Corner Metrics — RE Spec

**Domain:** `space.*`, `metric.*`, `radius.*` design tokens for a 1:1 SwiftUI → TypeScript/React web replica.
**Target:** canonical iOS 17 / iOS 18 / macOS 14–15 SwiftUI look. iOS 26 "Liquid Glass" deltas are labeled inline, never substituted.

**Source labels used throughout:**
- **KNOWN** — read directly from the SDK `.swiftinterface` (Tier-1A) or from a public Apple doc that states a literal number.
- **INFERRED** — Apple's runtime resolves it (the swiftinterface default is `nil` / an `@Environment` value), and the numeric value is established by HIG docs + reputable RE.
- **DESIGNED** — our engineering choice for the web replica where Apple computes the value in private layout code with no published constant.

**Primary Tier-1A sources (read this session):**
- `…/MacOSX.sdk/.../SwiftUICore.swiftmodule/arm64e-apple-macos.swiftinterface`
- `…/MacOSX.sdk/.../SwiftUI.swiftmodule/arm64e-apple-macos.swiftinterface`

> **The single most important RE finding for this domain:** *Every* stack-spacing and padding default in the swiftinterface is `nil`, not a number. SwiftUI does **not** bake `8.0` into `VStack.init`. The number is produced at runtime by a private adaptive spacing engine (`ViewSpacing`) that inspects the *types* of adjacent subviews, the platform, and the typography. "8 pt" is the dominant resolved value for generic view-to-view gaps and is what every designer and RE writeup reports — so we treat **8 pt as the canonical constant** for the replica, while documenting that the real engine is contextual.

---

## 1. Stack spacing

### 1.1 The literal swiftinterface evidence (KNOWN that the default is `nil`)

```
// SwiftUICore.swiftinterface
@frozen public struct VStack<Content> : View where Content : View {
  @inlinable public init(alignment: HorizontalAlignment = .center,
                         spacing: CGFloat? = nil,                 // ← default is nil, NOT 8
                         @ViewBuilder content: () -> Content)
}
@frozen public struct HStack<Content> : View where Content : View {
  @inlinable public init(alignment: VerticalAlignment = .center,
                         spacing: CGFloat? = nil,                 // ← default is nil
                         @ViewBuilder content: () -> Content)
}
public struct LazyVStack { init(alignment:.center, spacing: CGFloat? = nil, pinnedViews:…) }
public struct LazyHStack { init(alignment:.center, spacing: CGFloat? = nil, pinnedViews:…) }
@frozen public struct _VStackLayout { init(alignment:.center, spacing: CGFloat? = nil) }
@frozen public struct _HStackLayout { init(alignment:.center, spacing: CGFloat? = nil) }
```

`ZStack` has **no** spacing parameter (overlap layout). `Spacer` has no fixed length (it expands).

### 1.2 What `nil` resolves to (INFERRED — runtime adaptive engine)

When `spacing == nil`, SwiftUI calls into the private `ViewSpacing` machinery (visible as a type in the swiftinterface: `public struct ViewSpacing { static let zero; func distance(to:along:) -> CGFloat }`). The resolved gap depends on the *category* of the two adjacent views:

| Adjacency | Resolved gap (iOS) | Source |
|---|---|---|
| generic view ↔ generic view | **8 pt** | RE consensus / HwS |
| Text ↔ Text (same font, line-spacing aware) | ~ 0–4 pt below 8 (uses text metrics, can be < 8) | fatbobman RE |
| view ↔ Button / control | 8 pt | RE |
| macOS default | often **8 pt**, but platform-tuned | Apple docs |

**Replica decision (DESIGNED):** treat `space.stack.default = 8px`. Implement the text-aware reduction as an optional refinement, not a hard requirement (most layouts use the 8 pt gap). The web `gap` property is the exact analog of stack spacing.

### 1.3 The 8-pt grid (INFERRED — Apple's layout system)

Apple's layout is an 8-pt soft grid with a 4-pt half-step. The canonical ladder used across HIG layout:

`2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64` pt.

We expose this as a spacing scale so components can snap to it.

---

## 2. Padding

### 2.1 swiftinterface evidence (KNOWN — default length is `nil`)

```
// SwiftUICore.swiftinterface  (lines ~2509–2518)
@inlinable public func padding(_ insets: EdgeInsets) -> some View
@inlinable public func padding(_ edges: Edge.Set = .all,
                               _ length: CGFloat? = nil) -> some View   // ← nil = system default
@inlinable public func padding(_ length: CGFloat) -> some View
// modifier struct:
@frozen public struct _PaddingLayout { … }   // resolves nil at layout time
```

`.padding()` with no argument → `padding(.all, nil)` → `_PaddingLayout` resolves a **system default** at layout time. Apple's docs describe it as "a platform-specific default amount." The dominant resolved value on iOS is **16 pt** (the system-standard content margin / "directional layout margin"); some narrow contexts resolve to 20 pt. macOS resolves smaller in places.

**Replica decision (DESIGNED, calibrated to iOS):** `space.padding.default = 16px`. This is the value to use for `.padding()` and is the iOS readable-content / cell content margin.

`EdgeInsets` (KNOWN, `SwiftUICore.swiftinterface` line ~10827): `@frozen public struct EdgeInsets : Equatable { var top, leading, bottom, trailing: CGFloat }` — maps 1:1 to CSS `padding: <top> <trailing> <bottom> <leading>` (RTL-aware: leading/trailing → `padding-inline-start/end`).

---

## 3. List / Form / Section metrics

### 3.1 swiftinterface evidence

```
// SwiftUI.swiftinterface
public var defaultMinListRowHeight: CGFloat { … }          // @Environment, runtime default
public var defaultMinListHeaderHeight: CGFloat? { … }
public func listRowInsets(_ insets: EdgeInsets?) -> some View
public func listRowInsets(_ edges: Edge.Set = .all, _ length: CGFloat?) -> some View
public func listRowSeparator(_ visibility: Visibility, edges: VerticalEdge.Set = .all) -> some View
public func listRowSeparatorTint(_ color: Color?, edges: VerticalEdge.Set = .all) -> some View
public func listSectionSeparator(_ visibility: Visibility, …) -> some View
public func listRowSpacing(_ spacing: CGFloat?) -> some View
public func listSectionSpacing(_ spacing: CGFloat) -> some View

public struct ListSectionSpacing : Sendable {
  public static let `default`: ListSectionSpacing
  public static let compact:  ListSectionSpacing
  public static func custom(_ spacing: CGFloat) -> ListSectionSpacing
}
// list-separator alignment guides (KNOWN):
static let listRowSeparatorLeading:  HorizontalAlignment
static let listRowSeparatorTrailing: HorizontalAlignment
```

`defaultMinListRowHeight` is an `@Environment` value with a runtime default — the swiftinterface gives the *type*, not the number.

### 3.2 Resolved values (INFERRED from HIG + UIKit parity)

| Token | Value | Source-note |
|---|---|---|
| `metric.list.rowMinHeight` | **44 pt** | HIG; matches `UITableView.rowHeight` / min tap target |
| `metric.list.rowHeightSubtitle` | 60 pt | two-line cell (UIKit parity) |
| `metric.list.separatorInsetLeading` | **16 pt** | HIG separator inset; aligns to row content |
| `metric.list.separatorInsetTrailing` | 0 pt | default full-bleed trailing |
| `metric.list.separatorThickness` | 0.5 pt (1 hairline px @2x) | hairline |
| `metric.list.rowContentInsetLeading` | 16 pt | grouped-list content margin |
| `metric.list.rowContentInsetTrailing` | 16 pt | |
| `metric.list.rowContentInsetVertical` | 11 pt | brings 22 + ~22 text to the 44 pt row |
| `space.list.sectionSpacing.default` | ~35 pt | inset-grouped gap between sections (iOS 16+) |
| `space.list.sectionSpacing.compact` | ~10 pt | `.compact` case |
| `metric.form.sectionHeaderTopInset` | 16 pt | grouped section header |
| `metric.list.groupedHorizontalMargin` | 16–20 pt | side margin of inset-grouped lists |

> **Liquid Glass delta (iOS 26):** inset-grouped lists gain larger continuous-corner cards and slightly wider section spacing; row corner radius for grouped cells ≈ 10–12 pt continuous. Canonical (iOS 17/18) grouped cell corner ≈ 10 pt continuous. Record as delta, do not replace.

---

## 4. Tap target & hit metrics (INFERRED — HIG)

| Token | Value | Source |
|---|---|---|
| `metric.tapTarget` | **44 pt** | HIG: minimum 44×44 pt hit area |
| `metric.tapTarget.macOS` | 28 pt (pointer-class) | macOS uses smaller controls; pointer precision |
| `metric.minControlHeight` | 44 pt (iOS) | matches tap target |

Web mapping: every interactive element gets `min-height: 44px; min-width: 44px` on touch-class; controls may render visually smaller but keep an invisible 44 px hit box via padding or `::before` overlay.

---

## 5. Control default sizes & `ControlSize`

### 5.1 `ControlSize` enum (KNOWN — verbatim from `SwiftUICore.swiftinterface` line 6131)

```
public enum ControlSize : CaseIterable, Sendable {
  case mini
  case small
  case regular            // ← default
  @available(macOS 11.0, *)            case large
  @available(iOS 17.0, macOS 14.0, …)  case extraLarge
}
extension ControlSize : Comparable { static func < (…) }
public func controlSize(_ controlSize: ControlSize) -> some View
public func controlSize<T>(_ range: T) -> some View where T : RangeExpression, T.Bound == ControlSize
```

Default is `.regular`. `.extraLarge` is iOS 17+/macOS 14+. `ControlSize` lives in **SwiftUICore** (shared), with an AppKit bridge `init(_ nsControlSize:)` in SwiftUI.

### 5.2 Per-size metric deltas (INFERRED — no published constant; from RE/UIKit parity)

The swiftinterface exposes the enum but **not** the per-case point metrics (private layout). Resolved deltas for the dominant **bordered / borderedProminent** styles on iOS:

| ControlSize | Height (iOS) | H-padding | V-padding | Font (pt) | corner radius |
|---|---|---|---|---|---|
| `.mini`    | 24 pt | 8  | 3 | 11 (caption) | 5  continuous |
| `.small`   | 28 pt | 10 | 4 | 13 (footnote)| 6  continuous |
| `.regular` | 34 pt | 14 | 7 | 15 (body-ish)| 7–8 continuous |
| `.large`   | 50 pt | 20 | 12| 17 (body)    | 10–12 continuous |
| `.extraLarge` | 56 pt | 24 | 15 | 17 | 12 continuous |

> macOS resolves smaller: `.regular` push button ≈ 21–22 pt tall, `.large` ≈ 28–32 pt. The table above is the **iOS** canon used by the replica. macOS deltas are a labeled override set, not a replacement.

### 5.3 Button-style default paddings (INFERRED/DESIGNED)

The swiftinterface gives the style *types* but no padding constants:
```
public struct BorderedButtonStyle : PrimitiveButtonStyle { static var bordered }
public struct BorderedProminentButtonStyle … { static var borderedProminent }
public struct PlainButtonStyle : PrimitiveButtonStyle { static var plain }
public struct BorderlessButtonStyle … { static var borderless }
public struct DefaultButtonStyle … { static var automatic }
```
Resolved label insets at `.regular` (iOS):

| Style | H-padding | V-padding | Background | Corner | Notes |
|---|---|---|---|---|---|
| `.borderedProminent` | 14 pt | 7 pt | filled tint (accent) | 7–8 continuous | white label |
| `.bordered` | 14 pt | 7 pt | tint @ ~15% (quaternary fill) | 7–8 continuous | tint label |
| `.plain` | 0 (label only) | 0 | none | 0 | tappable text, accent color |
| `.borderless` | 0 | 0 | none | 0 | like plain |
| `.automatic` | = `.bordered` on iOS 15+ list/toolbar contexts | | | | context-dependent |

`metric.button.minWidth` ≈ no hard min on iOS (hugs content); macOS push buttons have a ~? content-hug + 8 pt edge insets each side.

### 5.4 Other control defaults (INFERRED)

| Token | Value | Note |
|---|---|---|
| `metric.control.defaultHeight` | 34 pt (iOS `.regular`) | bordered button / textfield baseline |
| `metric.textField.height` | 34–44 pt | `.roundedBorder` ≈ 34; plain row ≈ 44 |
| `metric.textField.contentInsetH` | 8 pt | roundedBorder horizontal inset |
| `metric.toggle.width` / `metric.toggle.height` | 51 × 31 pt | UISwitch parity |
| `metric.toggle.knobDiameter` | 27 pt | switch thumb |
| `metric.slider.trackHeight` | 4 pt | |
| `metric.slider.thumbDiameter` | 28 pt | |
| `metric.navBar.height` | 44 pt | standard nav bar |
| `metric.navBar.largeTitleHeight` | 96 pt (52 added) | large-title nav bar |
| `metric.tabBar.height` | 49 pt (+ safe area) | iOS tab bar |
| `metric.sheet.detentGrabberInset` | 8 pt | |

---

## 6. Corner radius & continuous (squircle) corners

### 6.1 swiftinterface evidence (KNOWN)

```
// SwiftUICore.swiftinterface
public enum RoundedCornerStyle : Sendable {     // line 19017
  case circular
  case continuous
}
@frozen public struct RoundedRectangle : Shape {
  public var cornerSize: CGSize
  public var style: RoundedCornerStyle
  public init(cornerSize: CGSize,  style: RoundedCornerStyle = .continuous)   // ← default CONTINUOUS
  public init(cornerRadius: CGFloat, style: RoundedCornerStyle = .continuous) // ← default CONTINUOUS
}
@frozen public struct UnevenRoundedRectangle : Shape { … style: RoundedCornerStyle = .continuous }
public struct RectangleCornerRadii { var topLeading, bottomLeading, bottomTrailing, topTrailing: CGFloat }
extension Shape where Self == RoundedRectangle {
  static func rect(cornerRadius: CGFloat, style: RoundedCornerStyle = .continuous) -> Self
  static func rect(cornerSize:  CGSize,  style: RoundedCornerStyle = .continuous) -> Self
}
@frozen public struct ContainerRelativeShape : Shape { … }   // inherits container corner
public func containerShape(_ shape: some RoundedRectangularShape) -> some View
// legacy:
public func cornerRadius(_ radius: CGFloat, antialiased: Bool = true) -> some View   // line 17354 (deprecated)
```

**Two KNOWN facts that matter most:**
1. `RoundedCornerStyle` has exactly two cases: `.circular` and `.continuous`.
2. **Every modern constructor defaults to `.continuous`** — so the SwiftUI look is squircle-by-default. The deprecated `.cornerRadius(_:)` modifier produces `.circular`.

`ContainerRelativeShape` + `containerShape(_:)` is Apple's mechanism for nested concentric corners: a child's radius is derived from the parent container's radius so insets stay concentric (inner radius = outer radius − inset).

### 6.2 `.continuous` = superellipse / Apple squircle — the math (INFERRED, RE consensus)

A `.circular` corner is a quarter-circle arc: curvature jumps from 0 (straight edge) to `1/r` instantly at the tangent point. A `.continuous` corner spreads that curvature over a longer span so curvature ramps smoothly (G2 continuity) — visually "fuller," less of a bubble.

**Lamé curve / superellipse:** `|x/a|^n + |y/b|^n = 1`.
- `n = 2` → ellipse/circle (this is `.circular`).
- `n = 4` → the canonical "squircle."
- `n ≈ 5` → the exponent that best matches **Apple's iOS app-icon** shape (per multiple REs, incl. iamvdo's Houdini demo "iOS icons use 5").

Apple does **not** ship a pure Lamé curve. Figma's RE ("Desperately Seeking Squircles") + Manfred Schwind's iOS-source RE established that Apple draws the corner with **cubic Bézier segments** whose control points are placed to approximate the superellipse, plus a tiny implementation quirk (a minuscule straight segment on one side, slightly asymmetric corners).

**The implementable RE model (figma-squircle / squircle.js — the de-facto standard):**
A single `cornerSmoothing ∈ [0,1]` parameter blends rounded-rect (0) → full squircle (1). **`cornerSmoothing ≈ 0.6` reproduces Apple's iOS smoothing** (and the iOS app-icon radius is **22.37 % of icon width**). The core relation:

```
// length of the corner curve along each edge, beyond the pure-arc tangent point:
p = (1 + cornerSmoothing) * cornerRadius      // smoothing pushes the curve start farther down the edge
// the corner is then drawn as: short straight → cubic bezier (smoothing in) → small arc → cubic bezier (smoothing out)
// control-point distances are derived from p, cornerRadius, and the 90° corner angle.
```
Intuition: at `cornerSmoothing = 0`, `p = r` (a plain quarter-circle of radius r). At `0.6`, the curve starts `1.6 r` from the corner, producing the elongated squircle flank. Clamp: `r` is capped at `min(w,h)/2`; when `r` approaches that cap the smoothing is auto-reduced so the curve stays valid.

### 6.3 Web mapping for `.continuous` (DESIGNED — three fidelity tiers)

CSS `border-radius` is a **pure ellipse arc** = `.circular` only. There is no native CSS squircle. Three replica strategies, in increasing fidelity / cost:

- **Tier A (cheap, default):** `border-radius: r` with a **+~1–2 px bump** vs the nominal `r` to visually compensate (continuous corners read slightly larger). Acceptable for small controls where the squircle is sub-pixel.
- **Tier B (accurate, recommended):** generate an SVG path via the figma-squircle algorithm and apply it as `clip-path: url(#squircle)` or `mask`. Use `cornerSmoothing = 0.6`. This is pixel-accurate to Apple at screen resolution.
- **Tier C (Houdini, where supported):** CSS Paint API worklet implementing `|x/r|^5 + |y/r|^5 = 1`:
  ```
  // y = (|r^m − |i−r|^m|)^(1/m) + h,  with m = 5
  paint --smooth-corners: 5;  /* exponent token = radius.continuous.exponent */
  ```

**Cubic-bezier approximation of a quarter-squircle** (Tier B fallback when not generating the full figma path): a single cubic from edge-tangent to corner-apex with control points pulled toward the corner at `~0.55 r` (vs `0.5523 r` for a perfect circular arc) and the curve start offset by `p = 1.6 r`. The replica ships the full figma-squircle path generator; this single-bezier form is the documented degenerate case.

### 6.4 Typical radii (INFERRED — iOS canon)

| Token | Value | Style | Where |
|---|---|---|---|
| `radius.button.small` | 6 px | continuous | `.small` bordered button |
| `radius.button` | 8 px | continuous | `.regular` bordered/borderedProminent |
| `radius.button.large` | 12 px | continuous | `.large` button |
| `radius.button.capsule` | 999 px (`9999`) | n/a (full pill) | `.buttonBorderShape(.capsule)` |
| `radius.card` | 12 px | continuous | grouped card / content tile |
| `radius.listRowGrouped` | 10 px | continuous | inset-grouped cell |
| `radius.textField` | 8 px | continuous | `.roundedBorder` |
| `radius.sheet` | 10 px | continuous | bottom-sheet top corners |
| `radius.sheet.large` | 16 px | continuous | large detent / iOS modern sheet |
| `radius.alert` | 14 px | continuous | alert dialog |
| `radius.menu` | 13 px | continuous | context menu / popover |
| `radius.icon.app` | 22.37 % of side | continuous | app-icon squircle (≈ 13.5 px on 60 px icon) |
| `radius.continuous.smoothing` | 0.6 | (param) | figma-squircle smoothing |
| `radius.continuous.exponent` | 5 | (param) | superellipse n for icon-class corners |

> **Liquid Glass delta (iOS 26):** controls move toward fully-rounded **capsule** shapes by default; many buttons/segmented controls become pills, and concentric continuous corners get larger. Canonical iOS 17/18 keeps the 8–12 px continuous radii above. Record as delta.

### 6.5 `ButtonBorderShape` (KNOWN type, INFERRED radii)

```
public struct ButtonBorderShape { static let automatic, capsule, roundedRectangle, circle, … }
public func buttonBorderShape(_ shape: ButtonBorderShape) -> some View   // env \._buttonBorderShape
```
- `.automatic` → roundedRectangle on iOS (≈ 8 px continuous at `.regular`), capsule in some watchOS/visionOS contexts.
- `.capsule` → full pill (`border-radius: 9999px`).
- `.roundedRectangle` / `.roundedRectangle(radius:)` → continuous rounded rect.
- `.circle` → 1:1 aspect, `border-radius: 50%`.

---

## 7. Web mapping summary (token → CSS)

| Token family | CSS compile target |
|---|---|
| `space.stack.default` | `gap` on flex/grid containers |
| `space.padding.*` | `padding` / `padding-inline` / `padding-block` (RTL-safe via logical props) |
| `metric.tapTarget` | `min-width` + `min-height`, or invisible `::before` hit overlay |
| `metric.list.rowMinHeight` | `min-height` on row |
| `metric.list.separatorInsetLeading` | separator `margin-inline-start` / inset border |
| `metric.list.separatorThickness` | `border-bottom-width` (use `0.5px` → renders as 1 device px @2x) |
| `metric.*.height` | `height` / `min-height` |
| `radius.*` (circular) | `border-radius` |
| `radius.* (continuous)` | `clip-path: url(#squircle-r{n})` (figma-squircle SVG) — fallback `border-radius` |
| `radius.continuous.smoothing` | figma-squircle `cornerSmoothing` arg |
| `radius.continuous.exponent` | Houdini `--smooth-corners` |
| `radius.*.capsule` | `border-radius: 9999px` |

**RTL note:** SwiftUI uses *leading/trailing* (writing-direction relative). Always compile to CSS **logical properties** (`padding-inline-start`, `margin-inline-end`, `inset-inline`) so the replica flips correctly in RTL exactly like SwiftUI.

**Retina note:** `0.5 pt` hairlines (separators) must compile to `0.5px` (not `1px`) so they render as a true 1-device-pixel hairline on @2x/@3x, matching iOS.

---

## 8. Fidelity / uncertainty notes

- **Highest confidence (KNOWN from swiftinterface):** stack/padding defaults are `nil`; `ControlSize` cases; `RoundedCornerStyle = {circular, continuous}`; `.continuous` is the default corner style; `RoundedRectangle`/`UnevenRoundedRectangle`/`RectangleCornerRadii`/`ContainerRelativeShape` shapes; the list/separator/section-spacing modifier surface and `defaultMinListRowHeight` env value.
- **Medium confidence (INFERRED, HIG + RE consensus):** 8 pt stack gap, 16 pt `.padding()`, 44 pt row/tap, 16 pt separator inset, the squircle math (`n≈5`, smoothing `0.6`, icon radius 22.37 %), per-style button paddings.
- **DESIGNED (our calibration target):** the per-`ControlSize` metric table (§5.2) and per-button-style padding table (§5.3) — Apple computes these in private layout code with no published constant; values chosen from UIKit parity + visual RE and must be **calibrated** against screenshots of the real controls. Treat as CALIBRATE.
- **dylib disassembly:** the SwiftUI binary lives only inside the dyld shared cache on this machine (`/System/Volumes/Preboot/Cryptexes/OS/System/Library/dyld/dyld_shared_cache_arm64e`, 2.7 GB); the framework is a broken symlink and `otool` cannot open the cached image without extraction tooling not present here. All baked-float extraction was therefore deferred to swiftinterface + RE evidence. This is the one gap where a future pass (with `dyld_shared_cache_util`/`ipsw`) could harden the INFERRED numbers to KNOWN.
