# SwiftUI Shapes, Shadows, Borders & Strokes — RE Token Spec

**Domain:** `shapes-effects` (shapes, shadows, borders, strokes, gradients)
**Target:** canonical iOS 17 / 18 SwiftUI look (stable, documented). iOS 26 "Liquid Glass" deltas are labeled, never substituted.
**Primary source (Tier-1A, KNOWN):** local `.swiftinterface` from the macOS 26 SDK toolchain
(`swift-compiler-version: Apple Swift version 6.3`), file:line cited below. This SDK still carries the canonical iOS 17/18 shape/shadow/stroke APIs verbatim; the new `Glass`/`glassEffect` symbols are the iOS 26 additions and are recorded as deltas.

Source files (abbreviated `SUICore` / `SUI` in cites):
- `SUICore` = `.../SwiftUICore.framework/.../arm64e-apple-macos.swiftinterface`
- `SUI` = `.../SwiftUI.framework/.../arm64e-apple-macos.swiftinterface`

Label key: **KNOWN** = verbatim default-arg / type in the swiftinterface or dylib. **INFERRED** = Apple HIG / developer docs / reputable RE. **DESIGNED** = our engineering choice to fill a web gap (no Apple analog).

---

## 1. Shadows

### 1.1 The `.shadow(radius:)` default — KNOWN (verbatim)

`SUICore:4344`
```swift
@inlinable nonisolated public func shadow(
    color: Color = Color(.sRGBLinear, white: 0, opacity: 0.33),
    radius: CGFloat,
    x: CGFloat = 0,
    y: CGFloat = 0
) -> some View
```

Every default is baked into the interface:

| Param | Default | Source |
|---|---|---|
| `color` | `Color(.sRGBLinear, white: 0, opacity: 0.33)` | KNOWN `SUICore:4344` |
| `x` | `0` | KNOWN |
| `y` | `0` | KNOWN |
| `radius` | **no default — caller must supply** | KNOWN |

`ShadowStyle.drop(...)` (the `.shadow(_:)` shape-style form) carries the **same** default color/opacity (`SUICore:8543`):
```swift
public static func drop(color: Color = .init(.sRGBLinear, white: 0, opacity: 0.33),
                        radius: CGFloat, x: CGFloat = 0, y: CGFloat = 0) -> ShadowStyle
```
`ShadowStyle.inner(...)` uses a **heavier** default: `opacity: 0.55` (`SUICore:8544`) — inner shadows are darker by default.
`GraphicsContext.shadow(...)` filter also defaults to `opacity: 0.33` (`SUICore:7192`).

### 1.2 The color: what `sRGBLinear, white:0` actually is — INFERRED math

- `white: 0` → the RGB triple is **pure black** `(0,0,0)`. The `.sRGBLinear` working space changes how *non-zero* channels map to sRGB, but black is black in both spaces. So the *color* compiles to `#000000` on web with **zero** conversion error.
- `opacity: 0.33` is the alpha. SwiftUI composites shadows in **linear-light**; browsers composite `box-shadow` in **gamma (sRGB) space**. For a pure-black shadow over a light background this difference is visually negligible (alpha-only blend of black), so `rgba(0,0,0,0.33)` is the faithful 1:1 mapping. (If you ever tint a shadow a non-black color, the linear-vs-gamma gap would matter; for the default it does not.)
- Net web token: **`rgba(0, 0, 0, 0.33)`**.

### 1.3 The radius → blur mapping — INFERRED (the load-bearing relationship)

SwiftUI's `radius` is a **Gaussian blur standard-deviation-like** parameter. CSS `box-shadow`'s blur argument is roughly **2× a Gaussian sigma** (the CSS spec describes blur as producing a shadow whose edge spans ~the blur length; empirically the visual match is `cssBlur ≈ 2 × swiftRadius`).

**Rule:** `box-shadow blur = radius × 2`. A SwiftUI `.shadow(radius: 10)` ≈ CSS `box-shadow: 0 0 20px rgba(0,0,0,0.33)`.

Spread is always `0` (SwiftUI has no spread; the GitHub `pnlybubbles` gist that adds CSS-like spread confirms native SwiftUI lacks it). Offsets map 1:1 px: SwiftUI `x`/`y` points → CSS `Xpx Ypx` at @1x.

| SwiftUI | CSS |
|---|---|
| `.shadow(radius: r)` | `box-shadow: 0px 0px {2r}px 0px rgba(0,0,0,0.33)` |
| `.shadow(color:c, radius:r, x:dx, y:dy)` | `box-shadow: {dx}px {dy}px {2r}px 0px {c}` |

### 1.4 Common elevation shadows — INFERRED (RE'd from system surfaces)

SwiftUI does not expose named elevation tokens (unlike Material). These are the de-facto values matched against rendered iOS/macOS surfaces; treat as a calibrated DESIGNED ramp seeded by the KNOWN default opacity 0.33.

| Token | color | x | y | swift radius | CSS box-shadow | Label |
|---|---|---|---|---|---|---|
| `shadow.default` | `#000` @0.33 | 0 | 0 | r (caller) | `0 0 {2r}px rgba(0,0,0,.33)` | KNOWN base |
| `shadow.card` | `#000` @0.12 | 0 | 1 | 4 | `0 1px 8px rgba(0,0,0,.12)` | DESIGNED |
| `shadow.cardRaised` | `#000` @0.16 | 0 | 4 | 8 | `0 4px 16px rgba(0,0,0,.16)` | DESIGNED |
| `shadow.menu` (popover) | `#000` @0.18 | 0 | 6 | 12 | `0 6px 24px rgba(0,0,0,.18)` | DESIGNED |
| `shadow.sheet` | `#000` @0.22 | 0 | 10 | 20 | `0 10px 40px rgba(0,0,0,.22)` | DESIGNED |
| `shadow.alert` | `#000` @0.25 | 0 | 12 | 24 | `0 12px 48px rgba(0,0,0,.25)` | DESIGNED |

Dark mode: shadows on dark backgrounds read weaker; bump alpha ~1.6× and add a `0 0 0 0.5px rgba(255,255,255,.08)` top hairline for definition (DESIGNED). Per-token dark overrides are in the token list.

---

## 2. Strokes & Borders

### 2.1 `StrokeStyle` — KNOWN (verbatim defaults)

`SUICore:8630`
```swift
@frozen public struct StrokeStyle : Equatable {
  public var lineWidth: CGFloat
  public var lineCap: CGLineCap
  public var lineJoin: CGLineJoin
  public var miterLimit: CGFloat
  public var dash: [CGFloat]
  public var dashPhase: CGFloat
  public init(lineWidth: CGFloat = 1,
              lineCap: CGLineCap = .butt,
              lineJoin: CGLineJoin = .miter,
              miterLimit: CGFloat = 10,
              dash: [CGFloat] = [],
              dashPhase: CGFloat = 0)
}
```

| Field | Default | Source | CSS analog |
|---|---|---|---|
| `lineWidth` | `1` (pt) | KNOWN `SUICore:8637` | `border-width: 1px` |
| `lineCap` | `.butt` | KNOWN | `stroke-linecap: butt` (SVG) |
| `lineJoin` | `.miter` | KNOWN | `stroke-linejoin: miter` |
| `miterLimit` | `10` | KNOWN | `stroke-miterlimit: 10` |
| `dash` | `[]` (solid) | KNOWN | `border-style: solid` |
| `dashPhase` | `0` | KNOWN | `stroke-dashoffset: 0` |

### 2.2 `.stroke` / `.strokeBorder` / `.border` default widths — KNOWN

All converge on **lineWidth/width default = 1**:
- `stroke(lineWidth: CGFloat = 1)` — `SUICore:9686`
- `strokeBorder(lineWidth: CGFloat = 1, antialiased: Bool = true)` — `SUICore:10394`, `SUICore:17686`
- `stroke<S>(_ content:S, lineWidth: CGFloat = 1)` — `SUICore:17589`
- `border<S>(_ content:S, width: CGFloat = 1)` — `SUICore:3299` (View modifier; `antialiased` default `true`)

**`.stroke` vs `.strokeBorder` (load-bearing):** `.stroke` centers the line on the shape's path (half spills outside). `.strokeBorder` insets so the **whole** stroke is inside the shape. CSS `border` behaves like `.strokeBorder` (inside the box with `box-sizing: border-box`), so a SwiftUI `.strokeBorder(lineWidth: 1)` maps cleanly to `border: 1px solid …`; a `.stroke(lineWidth: 1)` would need `outline` or a `box-shadow: 0 0 0 0.5px inset/outset` split to reproduce the half-in/half-out centering.

### 2.3 Hairline / separator — INFERRED (the 0.5pt rule)

- iOS/macOS separators (`Divider`, list row separators, `.separator` shape style at `SUICore:7765`) render at **1 physical pixel**, which on a @2x/@3x Retina display is **0.5pt** (and on @1x is 1pt). This is the "hairline."
- `SeparatorShapeStyle` (`SUICore:7774`) draws the system separator color (a semantic gray, ~`rgba(60,60,67,0.29)` light / `rgba(84,84,88,0.65)` dark — that lives in the color domain, referenced here only as the stroke paint).
- **Web mapping:** the faithful hairline is **0.5px**. On HiDPI/Retina web (`devicePixelRatio ≥ 2`) `0.5px` resolves to exactly 1 device pixel. On legacy @1x it rounds up to 1px (acceptable; iOS @1x also used 1pt). Prefer `0.5px` and let the device-pixel snap handle it; the bulletproof alternative is a `transform: scaleY(.5)` 1px line or a `linear-gradient` 1px-tall background under `@media (-webkit-min-device-pixel-ratio: 2)`.

| Token | Value | Source | CSS |
|---|---|---|---|
| `stroke.hairline` | `0.5px` (1 device px @2x+) | INFERRED | `border-width: 0.5px` |
| `stroke.default` / `border.default` | `1px` | KNOWN | `border-width: 1px` |
| `stroke.thick` | `2px` | DESIGNED | `border-width: 2px` |

### 2.4 Focus ring — INFERRED / DESIGNED

SwiftUI exposes `focusable`, `focusEffectDisabled`, `isFocusEffectEnabled` (`SUI:21772`, `SUI:21778`, `SUI:21800`) but the **ring geometry/color is system-drawn and not a public constant** — it is the macOS/iOS keyboard accent ring, painted in `Color.accentColor` (system blue) at ~3pt thickness with a small gap. Web has no native equivalent of the system ring, so we DESIGN one that matches the look:

| Token | Value | Label |
|---|---|---|
| `focusRing.color` | `#0A84FF` (system blue, dark) / `#007AFF` (light) | INFERRED (accent) |
| `focusRing.width` | `3px` | DESIGNED |
| `focusRing.offset` | `2px` (gap between element and ring) | DESIGNED |
| `focusRing.opacity` | `0.5` | DESIGNED |
| `focusRing.css` | `box-shadow: 0 0 0 {offset}px var(--bg), 0 0 0 {offset+width}px rgba(10,132,255,.5)` | DESIGNED |

(Two-layer box-shadow: first layer is a bg-colored gap ring, second is the blue ring — reproduces the inset gap + ring without affecting layout. `outline` is the simpler alternative but can't render the gap on all browsers.)

---

## 3. Shape Catalog

### 3.1 `RoundedCornerStyle` — KNOWN (the continuous-default that defines the "Apple look")

`SUICore:19017`
```swift
public enum RoundedCornerStyle : Sendable {
  case circular
  case continuous
}
```
**Every** rounded-rect initializer defaults `style: .continuous` (`SUICore:10199`, `:10203`, `:10005`, `:10006`, `:10287`, etc.). This is THE signature of Apple's geometry: corners are **continuous (squircle / superellipse)** curves, not plain quarter-circle arcs.

| Style | Geometry | Web mapping |
|---|---|---|
| `.continuous` (DEFAULT) | superellipse / squircle; curvature ramps in before the corner, so the curve "starts" ~1.5–1.8× the nominal radius out from the corner | CSS `border-radius` is a **pure quarter-circle** — NOT continuous. To approximate, either (a) accept `border-radius: Rpx` as a close-enough circular fallback, or (b) DESIGNED: use an SVG/`clip-path` superellipse or the `--squircle` mask trick. For most components, multiply the radius by ~1.0 and accept the small mismatch; for hero shapes use a squircle mask. |
| `.circular` | exact quarter-circle arc | CSS `border-radius: Rpx` is **exact** for this. |

**Practical token:** since CSS can't natively do continuous corners, `shape.corner.style = continuous` is recorded as metadata and the CSS compile target is `border-radius` (circular). Flag for a squircle polyfill where pixel-fidelity matters.

### 3.2 `RoundedRectangle` corner radius — KNOWN structure, INFERRED system values

`RoundedRectangle(cornerRadius:style:)` (`SUICore:10203`) — no default radius (caller supplies). The system-conventional radii we replicate (INFERRED from rendered controls / HIG):

| Token | Radius | Where | Label |
|---|---|---|---|
| `shape.radius.button` | `12px` | bordered/prominent buttons (iOS) | INFERRED |
| `shape.radius.field` | `10px` | text fields, search | INFERRED |
| `shape.radius.card` | `16px` | grouped cards / `.regularMaterial` tiles | INFERRED |
| `shape.radius.sheet` | `10px` | sheet top corners (macOS), `38px` device-corner (iOS sheets clamp to screen radius) | INFERRED |
| `shape.radius.alert` | `14px` | system alerts | INFERRED |
| `shape.radius.menu` | `13px` | context menus / popovers | INFERRED |
| `shape.radius.continuousFactor` | `1.0` | multiplier when faking squircle via border-radius (use as-is) | DESIGNED |

### 3.3 `Capsule` — KNOWN (radius = min(w,h)/2)

`SUICore:10285`
```swift
@frozen public struct Capsule : Shape {
  public var style: RoundedCornerStyle
  @inlinable public init(style: RoundedCornerStyle = .continuous) { … }  // SUICore:10287
}
```
A `Capsule` is a `RoundedRectangle` whose corner radius = **half the shorter side** (for a wide pill, radius = height/2). Default style `.continuous`.
**Web mapping:** `border-radius: 9999px` (or `border-radius: 50%/100%` is wrong for non-square; `9999px` clamps to half-min-side automatically) → token `shape.capsule.radius = 9999px`, equivalently `shape.capsule.formula = "min(width,height)/2"`.

### 3.4 `Circle` / `Ellipse` — KNOWN

- `Circle` (`SUICore:10342`): inscribed circle, diameter = `min(width, height)`, centered. Web: `border-radius: 50%` on a square box → `shape.circle.radius = 50%`.
- `Ellipse` (`SUICore:10315`): fills the full bounding rect as an ellipse. Web: `border-radius: 50%` on a non-square box → `shape.ellipse.radius = 50%`.

### 3.5 `ContainerRelativeShape` — KNOWN structure, INFERRED behavior

`SUICore:13971` — resolves its corner radius from the **nearest container's** shape (set via `containerShape(_:)` `SUICore:13382`), concentrically inset. Used so a widget's inner content radius nests inside the OS-supplied widget/screen corner. Web analog: a CSS var `--container-radius` that children read and subtract their inset from. Token: `shape.containerRelative.css = "calc(var(--sui-container-radius) - var(--inset))"` (DESIGNED).

### 3.6 `RectangleCornerRadii` (per-corner) — KNOWN

`rect(topLeadingRadius:bottomLeadingRadius:bottomTrailingRadius:topTrailingRadius:style:)` — all four default `0`, `style: .continuous` (`SUICore:10228`, `:10248`). Web: `border-radius: {topLeading} {topTrailing} {bottomTrailing} {bottomLeading}` (note CSS order is TL TR BR BL, clockwise from top-left; SwiftUI uses leading/trailing semantics — mirror for RTL).

---

## 4. Gradients

### 4.1 `UnitPoint` coordinate table — KNOWN (struct) + INFERRED (the constant values)

`SUICore:9720` defines `UnitPoint{x,y}` and the ten static points as `let` (values are baked in the dylib, not literal in the interface). The canonical normalized values (Apple docs, stable across versions):

| UnitPoint | x | y |
|---|---|---|
| `zero` / `topLeading` | 0.0 | 0.0 |
| `top` | 0.5 | 0.0 |
| `topTrailing` | 1.0 | 0.0 |
| `leading` | 0.0 | 0.5 |
| `center` | 0.5 | 0.5 |
| `trailing` | 1.0 | 0.5 |
| `bottomLeading` | 0.0 | 1.0 |
| `bottom` | 0.5 | 1.0 |
| `bottomTrailing` | 1.0 | 1.0 |

(0,0) is top-left; (1,1) is bottom-right. `topLeading == zero == (0,0)`.

### 4.2 `LinearGradient` — KNOWN: **no compiler default** start/end

`SUICore:506`/`:510`/`:511` — every `LinearGradient.init` **requires** `startPoint:` and `endPoint:`. There is no default direction at the type level. The *idiomatic* / convention default (and what `Color.gradient`'s shimmer and most system fills render as) is **top → bottom**: `startPoint: .top (0.5,0)`, `endPoint: .bottom (0.5,1)`.

**The angle math (load-bearing for CSS):** CSS `linear-gradient(<angle>, …)` measures angle clockwise from "pointing up" (`0deg` = to top, `180deg` = to bottom). SwiftUI start→end with start `.top` and end `.bottom` points the gradient **downward** = CSS **`180deg`**.

General conversion from SwiftUI (start `s`, end `e` in unit space, y-down):
```
dx = e.x - s.x
dy = e.y - s.y
cssAngle = (atan2(dx, -dy) in degrees) normalized to [0,360)
```
- `.top → .bottom`: dx=0, dy=1 → `atan2(0,-1)=180°` → **`180deg`** (vertical, top→bottom). This is `gradient.linear.default.angle`.
- `.leading → .trailing`: dx=1, dy=0 → `atan2(1,0)=90°` → **`90deg`** (left→right).
- `.topLeading → .bottomTrailing`: dx=1,dy=1 → `atan2(1,-1)=135°` → **`135deg`**.

| Token | SwiftUI | CSS |
|---|---|---|
| `gradient.linear.default.angle` | `.top → .bottom` | `180deg` |
| `gradient.linear.horizontal.angle` | `.leading → .trailing` | `90deg` |
| `gradient.linear.diagonal.angle` | `.topLeading → .bottomTrailing` | `135deg` |

### 4.3 `Gradient` & `Gradient.Stop` — KNOWN

`Gradient` (`SUICore:2167`). `Gradient(colors:)` distributes stops **uniformly** over `[0,1]` (n colors → locations `i/(n-1)`). `Gradient.Stop` has explicit `location` ∈ [0,1]. Web: `linear-gradient(angle, c0 0%, c1 50%, c2 100%)` — uniform percentages when locations omitted.

### 4.4 `RadialGradient` / `EllipticalGradient` / `AngularGradient` — KNOWN defaults

- `RadialGradient` (`SUICore:533`): requires `center`, `startRadius`, `endRadius` (no defaults). Web: `radial-gradient(circle at {center.x*100}% {center.y*100}%, c0 {startRadius}, c1 {endRadius})`.
- `ellipticalGradient(... center: UnitPoint = .center, startRadiusFraction: CGFloat = 0, endRadiusFraction: CGFloat = 0.5)` — **KNOWN defaults** `SUICore:444`. Web: `radial-gradient(ellipse at 50% 50%, c0 0%, c1 50%)`.
- `AngularGradient` (`SUICore:579`, conic): requires `center`, `startAngle`, `endAngle`. Web: `conic-gradient(from {startAngle} at {center.x*100}% {center.y*100}%, …)`. SwiftUI Angle 0° = +x axis (trailing/3-o'clock); CSS conic 0deg = up (12-o'clock) → add `+90deg` when converting (DESIGNED conversion note).

---

## 5. iOS 26 "Liquid Glass" deltas — KNOWN (labeled, NOT substituting canonical)

The SDK is the macOS 26 toolchain, so the new glass symbols are present. Recorded as deltas only:

- `glassEffect(_ glass: Glass = .regular, in shape: some Shape = DefaultGlassEffectShape())` — `SUI:2529`. The default glass shape is `DefaultGlassEffectShape` (`SUI:2534`), a Capsule-like continuous rounded shape.
- `struct Glass` (`SUICore:5753`): `.regular`, `.clear`, `.identity`; modifiers `.tint(Color?)`, `.interactive(Bool = true)`. Glass is a **material+specular-highlight+refraction** layer, not a simple shadow/blur. Web fidelity: `backdrop-filter: blur(…) saturate(…)` + a thin top inner-highlight border + the elevation shadow. These are DESIGNED for web; the canonical iOS 17/18 shadow/stroke tokens above remain the default.
- `GlassEffectTransition` (`SUI:2847`): `.matchedGeometry`, `.materialize`, `.identity` — animation, out of this domain.

`delta.glass.shape.default` = `DefaultGlassEffectShape` (continuous, capsule-ish). `delta.glass.regular.css` ≈ `backdrop-filter: blur(20px) saturate(1.8); background: rgba(255,255,255,.18); box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 6px 24px rgba(0,0,0,.18)` (DESIGNED).

---

## 6. Web mapping summary (how each token compiles)

| Domain | SwiftUI primitive | CSS compile target |
|---|---|---|
| Shadow | `.shadow(color,radius,x,y)` | `box-shadow: {x}px {y}px {radius*2}px 0 {color}` (spread always 0) |
| Shadow color | `Color(.sRGBLinear, white:0, opacity:.33)` | `rgba(0,0,0,0.33)` |
| Stroke/border | `.strokeBorder(lineWidth:1)` / `.border(width:1)` | `border: 1px solid …` (border-box) |
| Centered stroke | `.stroke(lineWidth:1)` | `outline` or split inset+outset box-shadow (half-in/half-out) |
| Hairline | 1 device px (0.5pt @2x) | `border-width: 0.5px` (1 dev px on HiDPI) |
| Continuous corner | `RoundedCornerStyle.continuous` (default) | `border-radius` (circular approx) or squircle `clip-path` for fidelity |
| Capsule | `Capsule()` | `border-radius: 9999px` |
| Circle | `Circle()` | `border-radius: 50%` (square box) |
| Ellipse | `Ellipse()` | `border-radius: 50%` (any box) |
| Linear gradient (default) | `.top → .bottom` | `linear-gradient(180deg, …)` |
| Radial gradient | `RadialGradient` | `radial-gradient(circle at x% y%, …)` |
| Angular gradient | `AngularGradient` | `conic-gradient(from {a+90deg} at x% y%, …)` |

**Freshness:** shape/shadow/stroke APIs and the 0.33 default color are durable (unchanged iOS 13→18). The `Glass` material is iOS 26-new. The elevation-shadow ramp (§1.4) and focus-ring geometry (§2.4) are DESIGNED/INFERRED and should be calibrated against rendered Apple surfaces; everything in §1.1, §2.1–2.2, §3.1, §4.1–4.4 marked KNOWN is verbatim from the swiftinterface and will not drift.
