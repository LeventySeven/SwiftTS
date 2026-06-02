# SwiftUI Cluster C12 — Materials & Visual Effects (RE Teardown → Web-Replica Spec)

**Goal:** a pixel-1:1 TS/React (Next.js) reimplementation of every SwiftUI materials/effects API. This file is the *spec a later agent uses to WRITE the component* — every section ends with a concrete HTML structure + exact CSS + React prop API.

**Authoritative source (Tier-1A):** the on-disk `SwiftUICore.swiftinterface` (`…/SwiftUICore.framework/…/arm64e-apple-macos.swiftinterface`, `swift-compiler-version: Apple Swift 6.3`). Every signature below is quoted verbatim with its `file:line`. Runtime visuals (blur sigma, tint rgba, specular geometry) are **not** in the interface — Apple bakes them into the `SwiftUICore` dylib as a private `CAFilter`/`CABackdropLayer` chain — so those are labeled INFERRED and cross-referenced to the calibrated token spec at `swiftui/tokens/materials.md` / `shapes-effects.md`.

**Label legend:**
- **KNOWN** — verbatim in the swiftinterface or published Apple docs (API surface: which effects exist, arg names, defaults, enum cases).
- **INFERRED** — the numeric recipe (blur px, saturate, tint rgba), reverse-engineered / community-calibrated to match rendered output. Lives in the W1 token files.
- **DESIGNED** — web-platform engineering I added where no 1:1 CSS primitive exists.

**Key architectural fact (drives the whole cluster):** SwiftUI splits "effects" into two render passes:
1. **Content filters** — `.blur/.opacity/.brightness/.contrast/.saturation/.grayscale/.hueRotation/.colorMultiply/.blendMode` operate on *the view's own rendered pixels*. → CSS **`filter:` / `opacity:` / `mix-blend-mode:`** on the element itself.
2. **Backdrop filters** — `Material` and `Glass` sample *what is behind the view* (the backdrop) and blur+saturate+tint it. → CSS **`backdrop-filter:`** + a tint `background` overlay. These two are the ONLY web primitives that read behind-the-element pixels.

Getting this split right is the single most important thing for fidelity: a frosted sheet uses `backdrop-filter`; a blurred photo uses `filter`.

The W1 token files already compiled the INFERRED numeric recipes; this teardown supplies the **API surface + component structure + state machine + React prop API** that consumes those tokens. Where a number is needed inline I cite the token file rather than re-deriving it.

**Coverage map for this cluster:**
- **Deep-covered:** `Material` (+ the 6 material statics + `backgroundMaterial` env), `MaterialActiveAppearance`, `VisualEffect` protocol / `EmptyVisualEffect` / `_VisualEffectTransformOutputs`, `_BlurEffect` (+ `.blur`), `.opacity`, `.brightness`, `.contrast`, `.saturation`, `.grayscale`, `.hueRotation`, `.colorMultiply`, `.blendMode` (+ full `BlendMode` enum), `.shadow`, `.mask`, `compositingGroup`, `drawingGroup`, `luminanceToAlpha`, `.visualEffect`, `.background`/`.foregroundStyle` with materials, and the **iOS 26 Liquid Glass** delta (`Glass`, `.glassEffect`, `GlassEffectContainer`, `.glassEffectID`, `.glassEffectUnion`, `.glassEffectTransition`, `materialActiveAppearance`).
- **Tabulated long-tail:** the private `_*Effect` `ViewModifier` structs (`_OpacityEffect`, `_BrightnessEffect`, `_ContrastEffect`, `_SaturationEffect`, `_GrayscaleEffect`, `_HueRotationEffect`, `_ColorMultiplyEffect`, `_BlendModeEffect`, `_ShadowEffect`, `_MaskEffect`, `_MaskAlignmentEffect`, `_CompositingGroupEffect`, `_DrawingGroupEffect`, `_LuminanceToAlphaEffect`) — these are implementation structs the public modifiers wrap; tabulated because each is fully described by its public modifier's section.

---

## 1. `Material` — frosted-glass backdrop ShapeStyle

### 1.1 Exact API — KNOWN (verbatim)

```swift
// SwiftUICore.swiftinterface:6305 — the type is an OPAQUE empty struct, no stored fields
public struct Material : Swift.Sendable {
}

// :6312–6328 — ShapeStyle convenience statics (the names you actually type)
extension SwiftUICore.ShapeStyle where Self == SwiftUICore.Material {
  @_alwaysEmitIntoClient public static var regularMaterial:   Material { get { .regular } }
  @_alwaysEmitIntoClient public static var thickMaterial:     Material { get { .thick } }
  @_alwaysEmitIntoClient public static var thinMaterial:      Material { get { .thin } }
  @_alwaysEmitIntoClient public static var ultraThinMaterial: Material { get { .ultraThin } }
  @_alwaysEmitIntoClient public static var ultraThickMaterial:Material { get { .ultraThick } }   // iOS 15+
}

// :6334–6337 — `.bar` is platform-gated (macOS/iOS only, tvOS & watchOS UNAVAILABLE)
extension SwiftUICore.ShapeStyle where Self == SwiftUICore.Material {
  @_alwaysEmitIntoClient public static var bar: Material { get { .bar } }
}

// :6344–6358 — the six canonical instances
extension SwiftUICore.Material {
  public static let regular:    Material
  public static let thick:      Material
  public static let thin:       Material
  public static let ultraThin:  Material
  public static let ultraThick: Material
  public static let bar:        Material   // :6357, macOS/iOS only
}

// :6364–6368 — environment carrier (read by labels-on-material for vibrancy)
extension SwiftUICore.EnvironmentValues {
  public var backgroundMaterial: SwiftUICore.Material? { get set }
}

// :6375–6380 — Material conforms to ShapeStyle (so it can fill .background/.foregroundStyle)
extension SwiftUICore.Material : SwiftUICore.ShapeStyle {
  public static func _makeView<S>(view: …_ShapeView<S, Material>…) -> _ViewOutputs where S : Shape
  public typealias Resolved = Swift.Never   // it never resolves to a flat Color — it's a live backdrop layer
}
```

**Consumption sites** (how a developer applies a material — these are the `.background`/`.foregroundStyle` overloads in this cluster):

```swift
// :15477 — fill the background with a ShapeStyle (Material is one)
func background<S>(_ style: S, ignoresSafeAreaEdges edges: Edge.Set = .all) -> some View where S : ShapeStyle
// :15487 — material clipped to a shape (the common "frosted card" case)
func background<S, T>(_ style: S, in shape: T, fillStyle: FillStyle = FillStyle()) -> some View
                       where S : ShapeStyle, T : Shape
// :9176 — material as a FOREGROUND fill (rare; tints text/icons with the material)
func foregroundStyle<S>(_ style: S) -> some View where S : ShapeStyle
```

`Resolved == Never` is load-bearing: it means a `Material` can **never** be flattened into a static `Color`. It is always a live layer that samples the backdrop every frame. That is exactly why the web mapping must use `backdrop-filter` (a live sampling primitive) and not a baked rgba.

### 1.2 Visual anatomy — INFERRED recipe (from `swiftui/tokens/materials.md`)

The swiftinterface exposes only the *names*. The render is a private multi-stage `CABackdropLayer` filter chain (`materials.md` §0):
1. `gaussianBlur` (sigma ↑ with thickness)
2. `colorSaturate` (the "vibrancy" pop, ~1.8 across all thicknesses)
3. a `colorMatrix`/tint overlay (near-white in Light, near-black in Dark, low alpha)
4. a legibility alpha/darkening pass

The web has exactly one matching primitive — `backdrop-filter: blur() saturate()` + a `background: rgba()` tint — so the 3–4-stage chain collapses to **blur + saturate + tint**. Thickness ordering (thinner = less blur, lower tint alpha, more see-through) is KNOWN; the absolute px/% are INFERRED. Calibrated table (verbatim from `materials.md` §1):

| Material | `--…-blur` | `--…-saturate` | Light tint | Dark tint | HIG use |
|---|---|---|---|---|---|
| `.ultraThinMaterial` | 20px | 1.8 | `rgba(255,255,255,0.44)` | `rgba(37,37,37,0.55)` | lightest scrim; bg must stay visible |
| `.thinMaterial` | 25px | 1.8 | `rgba(255,255,255,0.55)` | `rgba(37,37,37,0.66)` | thin chrome over content |
| `.regularMaterial` | 30px | 1.8 | `rgba(245,245,245,0.72)` | `rgba(30,30,30,0.76)` | **default**: sheets, popovers, panels |
| `.thickMaterial` | 40px | 1.8 | `rgba(245,245,245,0.82)` | `rgba(24,24,24,0.84)` | high-contrast surfaces |
| `.ultraThickMaterial` | 50px | 1.8 | `rgba(245,245,245,0.90)` | `rgba(20,20,20,0.92)` | near-opaque frosted (iOS 15+) |
| `.bar` | 30px | 1.8 | `rgba(245,245,245,0.80)` | `rgba(30,30,30,0.82)` | nav/tab/tool bars (macOS/iOS only) |

Sub-elements rendered: **(a)** the blurred+saturated backdrop sample, **(b)** the tint overlay on top of it, **(c)** an optional 0.5px material-rim hairline (`rgba(255,255,255,0.18)` Light / `0.10` Dark — DESIGNED, not from Apple), **(d)** clipped to the host shape if `.background(_, in: shape)` was used.

### 1.3 Foreground vibrancy on material — INFERRED (`materials.md` §2)

Text/icons placed *on* a material are tinted by a **vibrancy hierarchy** (`HierarchicalShapeStyle`: `primary/secondary/tertiary/quaternary/quinary`). Implemented as opacity multipliers on the resolved foreground color:

| Level | Light α | Dark α | token |
|---|---|---|---|
| `.primary` | 1.00 | 1.00 | `var(--sui-color-label)` at full |
| `.secondary` | 0.50 | 0.55 | foreground @ 0.50 / 0.55 |
| `.tertiary` | 0.25 | 0.25 | foreground @ 0.25 |
| `.quaternary` | 0.18 | 0.16 | foreground @ 0.18 / 0.16 |
| `.quinary` | 0.10 | 0.10 | foreground @ 0.10 (iOS 16+) |

True vibrancy also implies a `mix-blend-mode` so text picks up backdrop color, but blend-on-text-over-glass is fragile cross-browser → **default to alpha-only**; offer `mix-blend-mode: overlay` (Light) / `plus-lighter` (Dark) as an opt-in.

### 1.4 Behavior / states

Materials are **static surfaces** — no hover/press/focus state of their own (the *content on top* has states). The one stateful axis is **window-active vs inactive** on macOS, governed by `MaterialActiveAppearance` (§2). Animations: a material crossfades when its thickness changes or when it appears/disappears with a sheet (standard `.opacity` transition); the blur itself is not separately animated by default.

### 1.5 Web replication mapping

**Token CSS (emit once, in `:root`; dark under `[data-theme="dark"]`):**

```css
:root {
  --sui-material-ultraThin-blur: 20px;  --sui-material-ultraThin-sat: 1.8;
  --sui-material-ultraThin-tint: rgba(255,255,255,0.44);
  --sui-material-thin-blur: 25px;       --sui-material-thin-sat: 1.8;
  --sui-material-thin-tint: rgba(255,255,255,0.55);
  --sui-material-regular-blur: 30px;    --sui-material-regular-sat: 1.8;
  --sui-material-regular-tint: rgba(245,245,245,0.72);
  --sui-material-thick-blur: 40px;      --sui-material-thick-sat: 1.8;
  --sui-material-thick-tint: rgba(245,245,245,0.82);
  --sui-material-ultraThick-blur: 50px; --sui-material-ultraThick-sat: 1.8;
  --sui-material-ultraThick-tint: rgba(245,245,245,0.90);
  --sui-material-bar-blur: 30px;        --sui-material-bar-sat: 1.8;
  --sui-material-bar-tint: rgba(245,245,245,0.80);
  --sui-material-rim: rgba(255,255,255,0.18);
}
[data-theme="dark"] {
  --sui-material-ultraThin-tint: rgba(37,37,37,0.55);
  --sui-material-thin-tint: rgba(37,37,37,0.66);
  --sui-material-regular-tint: rgba(30,30,30,0.76);
  --sui-material-thick-tint: rgba(24,24,24,0.84);
  --sui-material-ultraThick-tint: rgba(20,20,20,0.92);
  --sui-material-bar-tint: rgba(30,30,30,0.82);
  --sui-material-rim: rgba(255,255,255,0.10);
}
```

**Component CSS** (one class per material, composed from the vars so a theme can retune without touching components):

```css
.sui-material {
  position: relative;            /* so tint sits in normal flow over the backdrop */
  background: var(--mat-tint);
  -webkit-backdrop-filter: blur(var(--mat-blur)) saturate(var(--mat-sat));
  backdrop-filter:        blur(var(--mat-blur)) saturate(var(--mat-sat));
  box-shadow: inset 0 0 0 0.5px var(--sui-material-rim);   /* optional rim */
}
.sui-material--ultraThin  { --mat-blur: var(--sui-material-ultraThin-blur);  --mat-sat: var(--sui-material-ultraThin-sat);  --mat-tint: var(--sui-material-ultraThin-tint); }
.sui-material--thin       { --mat-blur: var(--sui-material-thin-blur);       --mat-sat: var(--sui-material-thin-sat);       --mat-tint: var(--sui-material-thin-tint); }
.sui-material--regular    { --mat-blur: var(--sui-material-regular-blur);    --mat-sat: var(--sui-material-regular-sat);    --mat-tint: var(--sui-material-regular-tint); }
.sui-material--thick      { --mat-blur: var(--sui-material-thick-blur);      --mat-sat: var(--sui-material-thick-sat);      --mat-tint: var(--sui-material-thick-tint); }
.sui-material--ultraThick { --mat-blur: var(--sui-material-ultraThick-blur); --mat-sat: var(--sui-material-ultraThick-sat); --mat-tint: var(--sui-material-ultraThick-tint); }
.sui-material--bar        { --mat-blur: var(--sui-material-bar-blur);        --mat-sat: var(--sui-material-bar-sat);        --mat-tint: var(--sui-material-bar-tint); }

/* @supports fallback for browsers without backdrop-filter (Firefox <103 default) */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .sui-material { background: var(--mat-tint); }   /* opaque-ish tint, no blur */
}
```

**Vibrancy CSS** (foreground content on material):

```css
.sui-vibrant--primary    { color: var(--sui-color-label); opacity: 1; }
.sui-vibrant--secondary  { color: var(--sui-color-label); opacity: 0.50; }
.sui-vibrant--tertiary   { color: var(--sui-color-label); opacity: 0.25; }
.sui-vibrant--quaternary { color: var(--sui-color-label); opacity: 0.18; }
.sui-vibrant--quinary    { color: var(--sui-color-label); opacity: 0.10; }
[data-theme="dark"] .sui-vibrant--secondary  { opacity: 0.55; }
[data-theme="dark"] .sui-vibrant--quaternary { opacity: 0.16; }
```

**React prop API** — two idioms: a `<Material>` surface, and a `material` prop on container components.

```tsx
type MaterialKind = "ultraThin" | "thin" | "regular" | "thick" | "ultraThick" | "bar";

// Surface form: renders a frosted layer; children sit on top with vibrancy.
function Material({
  kind = "regular",          // mirrors .regularMaterial default
  in: clipShape,             // optional Shape → border-radius/clip-path (see C-shapes cluster)
  rim = false,               // the optional 0.5px hairline
  children,
  style,
  ...rest
}: {
  kind?: MaterialKind;
  in?: React.CSSProperties["clipPath"] | { borderRadius: number };
  rim?: boolean;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`sui-material sui-material--${kind}`}
      style={{ ...(typeof clipShape === "object" ? clipShape : {}), ...(rim ? {} : { boxShadow: "none" }), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

// Vibrant text helper — mirrors .foregroundStyle(.secondary) on material.
function Vibrant({ level = "primary", children }: {
  level?: "primary" | "secondary" | "tertiary" | "quaternary" | "quinary";
  children: React.ReactNode;
}) {
  return <span className={`sui-vibrant--${level}`}>{children}</span>;
}
```

`.background(.regularMaterial)` ⇒ apply `.sui-material sui-material--regular` to the host element directly (or wrap it). `.background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))` ⇒ `<Material kind="thin" in={{ borderRadius: 12 }} />` positioned behind content. **The host element needs `position: relative` and `overflow: hidden`** if clipping a material to a shape, so the blurred layer is masked to the corner radius.

---

## 2. `MaterialActiveAppearance` + `.materialActiveAppearance` modifier

### 2.1 Exact API — KNOWN (verbatim)

```swift
// SwiftUICore.swiftinterface:6388–6398 (iOS 18.0 / macOS 15.0 / visionOS 2.0+)
public struct MaterialActiveAppearance : Swift.Sendable, Swift.Equatable {
  public static let automatic:   MaterialActiveAppearance       // :6389
  public static let active:      MaterialActiveAppearance       // :6390
  @available(iOS, unavailable) @available(tvOS, unavailable)
  @available(watchOS, unavailable) @available(visionOS, unavailable)
  public static let inactive:    MaterialActiveAppearance       // :6395 — macOS-only
  public static let matchWindow: MaterialActiveAppearance       // :6396
  public static func == (a: MaterialActiveAppearance, b: MaterialActiveAppearance) -> Bool   // :6397
}

// :6405–6409 — environment carrier
extension SwiftUICore.EnvironmentValues {
  public var materialActiveAppearance: MaterialActiveAppearance { get set }
}

// THREE modifier overloads (Material-typed, ShapeStyle-typed, View-typed):
// :6418
public func materialActiveAppearance(_ appearance: MaterialActiveAppearance) -> Material
// :6427
public func materialActiveAppearance(_ appearance: MaterialActiveAppearance) -> some ShapeStyle
// :6437
nonisolated public func materialActiveAppearance(_ appearance: MaterialActiveAppearance) -> some View
```

**Cases:**
- `.automatic` — system decides (≈ `matchWindow` on macOS, always-active elsewhere).
- `.active` — force the vivid "key window" look (full vibrancy + saturation).
- `.inactive` — **macOS-only** dimmed look (background window): cut saturation, mute vibrancy.
- `.matchWindow` — follow the host window's key/inactive state.

### 2.2 Visual anatomy + behavior — INFERRED (`materials.md` §2)

This is a **desktop-only nicety**: macOS dims the vibrancy of materials in windows that aren't key (the frontmost focused window). On iOS/tvOS/watchOS there is no "inactive window" concept, so this is effectively a no-op there. The active→inactive delta (DESIGNED conversion from `materials.md` §2): keep the tint alpha, but **drop `saturate` to `1.0`** and **multiply vibrancy alpha ×0.7**. State machine: keyed off window focus (web: `document.hasFocus()` / `window` `blur`/`focus` events).

### 2.3 Web replication mapping

```css
/* default = active */
.sui-material[data-active="inactive"] {
  --mat-sat: 1.0;                          /* kill the vibrancy pop */
}
.sui-material[data-active="inactive"] .sui-vibrant--secondary  { opacity: calc(0.50 * 0.7); }
.sui-material[data-active="inactive"] .sui-vibrant--tertiary   { opacity: calc(0.25 * 0.7); }
.sui-material[data-active="inactive"] .sui-vibrant--primary    { opacity: 0.85; }
```

```tsx
type ActiveAppearance = "automatic" | "active" | "inactive" | "matchWindow";

// Hook that mirrors .matchWindow by tracking document focus.
function useWindowActive(): boolean {
  const [active, setActive] = React.useState(
    typeof document !== "undefined" ? document.hasFocus() : true
  );
  React.useEffect(() => {
    const on = () => setActive(true), off = () => setActive(false);
    window.addEventListener("focus", on); window.addEventListener("blur", off);
    return () => { window.removeEventListener("focus", on); window.removeEventListener("blur", off); };
  }, []);
  return active;
}

// Wire onto <Material> via data-active:
function resolveActive(appearance: ActiveAppearance, windowActive: boolean): "active" | "inactive" {
  switch (appearance) {
    case "active": return "active";
    case "inactive": return "inactive";
    case "matchWindow": return windowActive ? "active" : "inactive";
    case "automatic": default: return windowActive ? "active" : "inactive";
  }
}
// <Material kind="regular" activeAppearance="matchWindow" /> → data-active={resolveActive(...)}
```

INFERRED note: only meaningful on a desktop layout. For a mobile-first web kit, default `activeAppearance="active"` and treat `inactive` as opt-in.

---

## 3. `VisualEffect` protocol + `EmptyVisualEffect` + `.visualEffect` + `_VisualEffectTransformOutputs`

### 3.1 Exact API — KNOWN (verbatim)

```swift
// SwiftUICore.swiftinterface:16015–16019 (iOS 17.0 / macOS 14.0+)
public protocol VisualEffect : Swift.Sendable, SwiftUICore.Animatable {
  static func _makeVisualEffect(effect: _GraphValue<Self>, inputs: _ViewInputs,
                                body: @escaping (_Graph, _ViewInputs) -> _ViewOutputs) -> _ViewOutputs
  @available(iOS 26.2, macOS 26.2, …, *)
  static func _makeTransform(effect: _GraphValue<Self>, inputs: _ViewInputs) -> _VisualEffectTransformOutputs   // :16018
}

// :16021 (iOS 26.2+) — opaque output of the new transform path; NOT Sendable (:16024)
public struct _VisualEffectTransformOutputs { }

// :16035–16037 — THE PUBLIC ENTRY POINT
extension SwiftUICore.View {
  nonisolated public func visualEffect(
    _ effect: @escaping @Sendable (EmptyVisualEffect, GeometryProxy) -> some VisualEffect
  ) -> some View
}

// :16044–16049 — the identity effect you start from inside the closure
public struct EmptyVisualEffect : SwiftUICore.VisualEffect {
  public init()
  public static func _makeVisualEffect(…) -> _ViewOutputs
  public typealias AnimatableData = EmptyAnimatableData    // :16048 — nothing to animate
}

// :16050–16058 — chaining: ModifiedContent of two VisualEffects is itself a VisualEffect;
// `combining(_:)` (package-internal) just wraps ModifiedContent(content: self, modifier: effect)
extension ModifiedContent : VisualEffect where Content : VisualEffect, Modifier : VisualEffect { … }
```

**The whole point of `VisualEffect`:** it lets you apply geometry-aware effects (`.offset`, `.scaleEffect`, `.opacity`, `.blur`, `.rotation3DEffect`, etc.) **without breaking out of the layout system** and **as a function of `GeometryProxy`** (the view's resolved frame/position). The closure receives `EmptyVisualEffect` (identity) + a `GeometryProxy`, and you chain effect methods onto it. The effect methods available on `VisualEffect` are the same family this cluster covers — each has a `VisualEffect`-returning overload alongside its `View`-returning one:

```swift
// VisualEffect-returning overloads (geometry-aware variants of the same modifiers):
func blendMode(_:)  -> some VisualEffect   // :2625
func contrast(_:)   -> some VisualEffect   // :2842
func blur(radius:opaque:) -> some VisualEffect  // :3715
func grayscale(_:)  -> some VisualEffect   // :3967
func opacity(_:)    -> some VisualEffect   // :4216
func brightness(_:) -> some VisualEffect   // :4449
func saturation(_:) -> some VisualEffect   // :16389
func hueRotation(_:)-> some VisualEffect   // :19504
// (+ offset/scaleEffect/rotationEffect/rotation3DEffect from the transform cluster)
```

### 3.2 Behavior

Usage:
```swift
ScrollView { ForEach(items) { item in
  card(item).visualEffect { content, proxy in
    content
      .opacity(proxy.frame(in: .global).minY < 100 ? 0.3 : 1)   // fade as it scrolls under the header
      .blur(radius: proxy.frame(in: .global).minY < 100 ? 4 : 0)
  }
}}
```
The closure re-runs whenever the geometry changes (scroll, resize). It is the modern, layout-safe way to do scroll-driven effects. It is `Animatable`, so the effects interpolate smoothly when their inputs change.

### 3.3 Web replication mapping — DESIGNED

There is no single CSS primitive. The faithful replica is a **render-prop component** that supplies an element's measured geometry (via `ResizeObserver` + `IntersectionObserver` / scroll position) and lets the caller return a `filter`/`transform`/`opacity` style object — exactly mirroring the `(content, proxy) -> VisualEffect` closure.

```css
.sui-visual-effect { will-change: filter, transform, opacity; transition: filter .12s linear, opacity .12s linear, transform .12s linear; }
```

```tsx
type GeometryProxy = {
  size: { width: number; height: number };
  frame: (space: "global" | "local") => DOMRect;   // global = relative to viewport
};
type VisualEffectStyle = Pick<React.CSSProperties, "filter" | "transform" | "opacity" | "mixBlendMode">;

function VisualEffect({ effect, children, style, ...rest }: {
  effect: (proxy: GeometryProxy) => VisualEffectStyle;   // mirrors (EmptyVisualEffect, GeometryProxy) -> some VisualEffect
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [fx, setFx] = React.useState<VisualEffectStyle>({});
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const recompute = () => {
      const rect = el.getBoundingClientRect();
      const proxy: GeometryProxy = {
        size: { width: rect.width, height: rect.height },
        frame: (space) => space === "global" ? rect
          : new DOMRect(0, 0, rect.width, rect.height),
      };
      setFx(effect(proxy));
    };
    recompute();
    const ro = new ResizeObserver(recompute); ro.observe(el);
    window.addEventListener("scroll", recompute, { passive: true, capture: true });
    window.addEventListener("resize", recompute);
    return () => { ro.disconnect(); window.removeEventListener("scroll", recompute, true); window.removeEventListener("resize", recompute); };
  }, [effect]);
  return <div ref={ref} className="sui-visual-effect" style={{ ...fx, ...style }} {...rest}>{children}</div>;
}

// Usage mirrors SwiftUI:
// <VisualEffect effect={(p) => ({ opacity: p.frame("global").top < 100 ? 0.3 : 1,
//                                 filter: p.frame("global").top < 100 ? "blur(4px)" : "none" })}>
//   <Card/>
// </VisualEffect>
```

`EmptyVisualEffect` ⇒ the identity `{}` returned when no transform applies. `_VisualEffectTransformOutputs` is a private graph type (iOS 26.2 internal plumbing) with **no web analog** — not exposed, nothing to map.

---

## 4. Content-filter modifiers (`.blur .opacity .brightness .contrast .saturation .grayscale .hueRotation .colorMultiply`)

All nine are **content filters** (operate on the view's own pixels) → CSS `filter:` / `opacity:`. Each public `View` modifier inlines to `modifier(_XxxEffect(...))`; the `_XxxEffect` structs are frozen, `Equatable`, `Animatable` (their `animatableData` is the scalar arg). Verbatim signatures + inline bodies below.

### 4.1 `.blur(radius:opaque:)` — KNOWN

```swift
// SwiftUICore.swiftinterface:3681–3697 — the effect struct
@frozen public struct _BlurEffect : Swift.Equatable {
  public var radius: CGFloat
  public var isOpaque: Swift.Bool
  @inlinable public init(radius: CGFloat, opaque: Swift.Bool) { self.radius = radius; self.isOpaque = opaque }
  public var animatableData: CGFloat { get set }          // radius is the animatable scalar
  public typealias AnimatableData = CGFloat
}
// :3703–3708 — the View modifier
extension SwiftUICore.View {
  @inlinable nonisolated public func blur(radius: CGFloat, opaque: Bool = false) -> some View {
        return modifier(_BlurEffect(radius: radius, opaque: opaque))
    }
}
// :3715 — geometry-aware VisualEffect overload (iOS 26+)
func blur(radius: CGFloat, opaque: Bool = false) -> some VisualEffect
```

- **`radius`** (CGFloat, no default): Gaussian blur sigma-like. SwiftUI radius ≈ CSS px **1:1** (`materials.md` §3).
- **`opaque`** (Bool, default `false`): when `true`, the blur does **not** sample transparency from outside the view's bounds — edges stay opaque (no "bleed in" of transparent pixels). Web equiv (DESIGNED): apply blur to an element that has an opaque `background` and `overflow: hidden`, so nothing transparent bleeds into the edge.
- States: none — purely a filter. Animatable on `radius`.
- CSS: `filter: blur(<radius>px)`.

### 4.2 `.opacity(_:)` — KNOWN

```swift
// :4206–4209
@inlinable nonisolated public func opacity(_ opacity: Double) -> some View {
      return modifier(_OpacityEffect(opacity: opacity))
  }
// :4216 — VisualEffect overload
func opacity(_ opacity: Double) -> some VisualEffect
// Also: Color.opacity(_:) -> Color (:16398) and ShapeStyle.opacity (:4243/:4289) — color/style-level, not view-level
```
- `opacity` (Double, no default): 0…1. CSS `opacity: <0…1>` **1:1**. Note this composites the whole subtree as one layer (like `compositingGroup` for the opacity step). Animatable.

### 4.3 `.brightness(_:)` — KNOWN (⚠ semantics differ from CSS)

```swift
// :4419–4434 — struct
@frozen public struct _BrightnessEffect : Swift.Equatable {
  public var amount: Swift.Double
  public var animatableData: Swift.Double { get set }
}
// :4438–4441 — modifier
@inlinable nonisolated public func brightness(_ amount: Double) -> some View {
      return modifier(_BrightnessEffect(amount: amount))
  }
// :4449 — VisualEffect overload
```
- `amount` (Double, no default): an **additive** delta in roughly −1…1 (0 = identity, +ve lightens, −ve darkens). **CSS `brightness()` is multiplicative**, so the conversion (DESIGNED, `materials.md` §3) is `filter: brightness(1 + amount)`. e.g. `.brightness(0.3)` → `filter: brightness(1.3)`; `.brightness(-0.5)` → `filter: brightness(0.5)`.

### 4.4 `.contrast(_:)` — KNOWN

```swift
// :2831–2834
@inlinable nonisolated public func contrast(_ amount: Double) -> some View {
      return modifier(_ContrastEffect(amount: amount))
  }
// :2842 — VisualEffect overload (iOS 26 originally-defined)
```
- `amount` (Double, no default): 1.0 = identity, >1 more contrast, 0 = solid grey, <0 inverts. CSS `filter: contrast(<amount>)` **1:1**.

### 4.5 `.saturation(_:)` — KNOWN

```swift
// :16379–16382
@inlinable nonisolated public func saturation(_ amount: Double) -> some View {
      return modifier(_SaturationEffect(amount: amount))
  }
// :16389 — VisualEffect overload
```
- `amount` (Double, no default): 1.0 = identity, 0 = grayscale, >1 oversaturated. CSS `filter: saturate(<amount>)` **1:1**.

### 4.6 `.grayscale(_:)` — KNOWN

```swift
// :3956–3959
@inlinable nonisolated public func grayscale(_ amount: Double) -> some View {
      return modifier(_GrayscaleEffect(amount: amount))
  }
// :3967 — VisualEffect overload
```
- `amount` (Double, no default): 0 = full color, 1 = fully grey. CSS `filter: grayscale(<amount>)` **1:1** (clamp 0…1).

### 4.7 `.hueRotation(_:)` — KNOWN

```swift
// :19493–19496
@inlinable nonisolated public func hueRotation(_ angle: Angle) -> some View {
      return modifier(_HueRotationEffect(angle: angle))
  }
// :19504 — VisualEffect overload
```
- `angle` (`Angle`, no default): SwiftUI `Angle` → degrees via `.degrees`. CSS `filter: hue-rotate(<deg>deg)` **1:1**. (`Angle(radians:)` → convert: `deg = rad * 180/π`.)

### 4.8 `.colorMultiply(_:)` — KNOWN (no clean CSS primitive)

```swift
// :17235–17238
@inlinable nonisolated public func colorMultiply(_ color: Color) -> some View {
      return modifier(_ColorMultiplyEffect(color: color))
  }
```
- `color` (`Color`, no default): multiplies every pixel by `color` (white = identity, black = black, red tints reds through). **No single CSS filter does per-channel multiply against an arbitrary color.** Two DESIGNED options:
  1. **Overlay layer** (faithful, recommended): an absolutely-positioned `::after` covering the element, `background: <color>; mix-blend-mode: multiply;` — multiplies the element by the color.
  2. For grayscale-ish tints, an SVG `feColorMatrix` can encode the exact multiply, but the overlay is simpler and matches for opaque content.

### 4.9 Shared web mapping — CSS + React

**Important compositing rule:** CSS `filter` functions on one element **compose left-to-right in one `filter` string** (`filter: brightness(1.2) saturate(1.5) blur(2px)`), matching SwiftUI's chained-modifier order (outer modifier = later in the chain = applied last). When stacking these via React props, build a single `filter` string in the documented order.

```css
.sui-fx { /* nothing by default; filter is set inline from props */ }
.sui-fx[data-animatable="true"] { transition: filter .2s ease, opacity .2s ease; }
.sui-color-multiply { position: relative; isolation: isolate; }
.sui-color-multiply::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: var(--cm-color); mix-blend-mode: multiply;
}
```

```tsx
type ContentEffects = {
  blur?: number;                       // .blur(radius:) → blur(Npx)
  blurOpaque?: boolean;                // .blur(opaque:) → opaque bg + overflow hidden
  opacity?: number;                    // .opacity(_:)   → opacity
  brightness?: number;                 // .brightness(_:) ADDITIVE → brightness(1 + b)
  contrast?: number;                   // .contrast(_:)  → contrast()
  saturation?: number;                 // .saturation(_:)→ saturate()
  grayscale?: number;                  // .grayscale(_:) → grayscale()
  hueRotation?: number;                // degrees → hue-rotate(deg)
  colorMultiply?: string;              // CSS color → multiply overlay
};

function buildFilter(e: ContentEffects): string {
  const parts: string[] = [];
  if (e.brightness != null)  parts.push(`brightness(${1 + e.brightness})`);   // additive → multiplicative
  if (e.contrast != null)    parts.push(`contrast(${e.contrast})`);
  if (e.saturation != null)  parts.push(`saturate(${e.saturation})`);
  if (e.grayscale != null)   parts.push(`grayscale(${e.grayscale})`);
  if (e.hueRotation != null) parts.push(`hue-rotate(${e.hueRotation}deg)`);
  if (e.blur != null)        parts.push(`blur(${e.blur}px)`);                 // blur last so it blurs the filtered result
  return parts.join(" ") || "none";
}

function FX({ effects, children, style, ...rest }: {
  effects: ContentEffects; children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { opacity, colorMultiply, blurOpaque } = effects;
  const filter = buildFilter(effects);
  const hasMultiply = !!colorMultiply;
  return (
    <div
      className={`sui-fx${hasMultiply ? " sui-color-multiply" : ""}`}
      style={{
        filter,
        opacity,
        ...(blurOpaque ? { overflow: "hidden", isolation: "isolate" } : {}),
        ...(hasMultiply ? ({ ["--cm-color" as any]: colorMultiply }) : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
// e.g. <FX effects={{ blur: 4, brightness: 0.2, saturation: 1.4, hueRotation: 30 }}>…</FX>
```

The individual modifiers (`<Blur radius>`, `<Opacity value>`, …) can be thin wrappers over `<FX>` that set one key. Prefer `<FX>` when stacking to keep the single-`filter`-string compositing order correct.

---

## 5. `.blendMode(_:)` + the `BlendMode` enum

### 5.1 Exact API — KNOWN (verbatim)

```swift
// SwiftUICore.swiftinterface:6232–6259 — all 21 cases
public enum BlendMode : Swift.Sendable {
  case normal          case multiply        case screen          case overlay
  case darken          case lighten         case colorDodge      case colorBurn
  case softLight       case hardLight       case difference      case exclusion
  case hue             case saturation      case color           case luminosity
  case sourceAtop      case destinationOver case destinationOut   case plusDarker
  case plusLighter
  public static func == (a: BlendMode, b: BlendMode) -> Bool
  public func hash(into hasher: inout Hasher)
}
// :2618–2621 — View modifier (inlines to _BlendModeEffect)
extension SwiftUICore.View {
  @inlinable nonisolated public func blendMode(_ blendMode: BlendMode) -> some View {
        return modifier(_BlendModeEffect(blendMode: blendMode))
    }
}
// :2625 — VisualEffect overload (iOS 18+)
func blendMode(_ blendMode: BlendMode) -> some VisualEffect
// :6266 / :6277 — ShapeStyle.blendMode(_:) — applies the blend to a fill style
```

### 5.2 Behavior + web mapping — KNOWN/DESIGNED

`.blendMode` sets how the view's pixels composite against **what is behind them** within the nearest compositing group → CSS **`mix-blend-mode`**. The first 16 cases are the W3C separable + non-separable blend modes → **1:1**. The last 5 are Porter-Duff *compositing operators* (not separable blends) with no `mix-blend-mode` analog → DESIGNED fallbacks (`materials.md` §3):

| SwiftUI `BlendMode` | CSS | Label |
|---|---|---|
| `normal` | `normal` | 1:1 |
| `multiply` | `multiply` | 1:1 |
| `screen` | `screen` | 1:1 |
| `overlay` | `overlay` | 1:1 |
| `darken` | `darken` | 1:1 |
| `lighten` | `lighten` | 1:1 |
| `colorDodge` | `color-dodge` | 1:1 |
| `colorBurn` | `color-burn` | 1:1 |
| `softLight` | `soft-light` | 1:1 |
| `hardLight` | `hard-light` | 1:1 |
| `difference` | `difference` | 1:1 |
| `exclusion` | `exclusion` | 1:1 |
| `hue` | `hue` | 1:1 |
| `saturation` | `saturation` | 1:1 |
| `color` | `color` | 1:1 |
| `luminosity` | `luminosity` | 1:1 |
| `sourceAtop` | `normal` + clip to dest alpha (`background-clip`/`isolation`) | DESIGNED |
| `destinationOver` | reorder layers / `isolation` (draw behind) | DESIGNED |
| `destinationOut` | `mask` cut-out of the destination | DESIGNED |
| `plusDarker` | `darken` (approx; no exact CSS) | DESIGNED |
| `plusLighter` | `plus-lighter` (modern WebKit/Blink; fallback `lighten`) | mostly 1:1 |

**Critical CSS gotcha:** `mix-blend-mode` blends against the element's **stacking context backdrop**, so for a blend to work as SwiftUI intends, the blended element and the layer it should blend with must share a compositing group. In SwiftUI you'd wrap them in a `ZStack` + `.compositingGroup()`; in CSS you set `isolation: isolate` on the parent (creates a fresh stacking context so the blend doesn't punch through to the page background). This is exactly the `compositingGroup` mapping in §7.

### 5.3 React prop API

```tsx
const BLEND_MAP: Record<string, React.CSSProperties["mixBlendMode"]> = {
  normal:"normal", multiply:"multiply", screen:"screen", overlay:"overlay",
  darken:"darken", lighten:"lighten", colorDodge:"color-dodge", colorBurn:"color-burn",
  softLight:"soft-light", hardLight:"hard-light", difference:"difference", exclusion:"exclusion",
  hue:"hue", saturation:"saturation", color:"color", luminosity:"luminosity",
  plusLighter:"plus-lighter",
  // DESIGNED fallbacks:
  plusDarker:"darken", sourceAtop:"normal", destinationOver:"normal", destinationOut:"normal",
};
type BlendMode = keyof typeof BLEND_MAP;

function BlendMode({ mode, children, style, ...rest }: {
  mode: BlendMode; children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ mixBlendMode: BLEND_MAP[mode], ...style }} {...rest}>{children}</div>;
}
// Parent that wants blends contained: <div style={{ isolation: "isolate" }}> … <BlendMode mode="multiply"/> </div>
```

---

## 6. `.shadow(color:radius:x:y:)` — drop shadow

### 6.1 Exact API — KNOWN (verbatim)

```swift
// SwiftUICore.swiftinterface:4344–4356
extension SwiftUICore.View {
  @inlinable nonisolated public func shadow(
    color: Color = Color(.sRGBLinear, white: 0, opacity: 0.33),   // ← the default shadow color
    radius: CGFloat,
    x: CGFloat = 0,
    y: CGFloat = 0
  ) -> some View {
        return modifier(_ShadowEffect(color: color, radius: radius, offset: CGSize(width: x, height: y)))
    }
}
// :8553 / :8564 — ShapeStyle.shadow(ShadowStyle) form (drop/inner); drop default opacity 0.33, inner 0.55
```

- **`color`** default `Color(.sRGBLinear, white: 0, opacity: 0.33)` — pure black at **33% alpha**, composited in **linear-light**. For pure-black-over-light the linear-vs-gamma gap is negligible → `rgba(0,0,0,0.33)` is faithful (`shapes-effects.md` §1.1).
- **`radius`** (CGFloat, required): a Gaussian std-dev-like value. **CSS `box-shadow` blur ≈ 2× SwiftUI radius** (`shapes-effects.md`: `cssBlur ≈ 2 × swiftRadius`).
- **`x` / `y`** (CGFloat, default 0): offset.
- Spread is **always 0** in SwiftUI's `box-shadow` mapping.

### 6.2 Web mapping — KNOWN

```
.shadow(radius: r)                  → box-shadow: 0 0 {2r}px 0 rgba(0,0,0,0.33)
.shadow(color:c, radius:r, x, y)    → box-shadow: {x}px {y}px {2r}px 0 {c}
```

Elevation ramp tokens (INFERRED/DESIGNED, `shapes-effects.md` §1.4) — use these for system-surface shadows rather than ad-hoc radii: `shadow.card 0 1px 8px rgba(0,0,0,.12)`, `shadow.cardRaised 0 4px 16px rgba(0,0,0,.16)`, `shadow.menu 0 6px 24px rgba(0,0,0,.18)`, `shadow.sheet 0 10px 40px rgba(0,0,0,.22)`, `shadow.alert 0 12px 48px rgba(0,0,0,.25)`. Dark mode: bump alpha ~1.6× and add a `0 0 0 0.5px rgba(255,255,255,.08)` top hairline.

```css
.sui-shadow { box-shadow: var(--shadow, 0 0 0 0 transparent); }
```

```tsx
function Shadow({ color = "rgba(0,0,0,0.33)", radius, x = 0, y = 0, children, style, ...rest }: {
  color?: string; radius: number; x?: number; y?: number; children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{ boxShadow: `${x}px ${y}px ${radius * 2}px 0 ${color}`, ...style }} {...rest}>
      {children}
    </div>
  );
}
// Note: box-shadow follows border-radius; for an arbitrary-shape shadow use filter: drop-shadow() instead.
```

INFERRED edge case: if the view is a non-rectangular shape (`.shadow` after `.clipShape`), `box-shadow` (which only follows `border-radius`) is wrong → use `filter: drop-shadow({x}px {y}px {2r/2≈r}px {color})` which follows alpha. Note `drop-shadow`'s blur ≈ SwiftUI radius **1:1** (different scaling than `box-shadow`).

---

## 7. `.compositingGroup()` + `.drawingGroup(opaque:colorMode:)`

### 7.1 Exact API — KNOWN (verbatim)

```swift
// SwiftUICore.swiftinterface:5480–5483
@inlinable nonisolated public func compositingGroup() -> some View {
      return modifier(_CompositingGroupEffect())
  }
// :4398 — drawingGroup (NOT inlinable; rasterizes the subtree via Metal)
extension SwiftUICore.View {
  nonisolated public func drawingGroup(opaque: Bool = false,
                                       colorMode: ColorRenderingMode = .nonLinear) -> some View
}
// :4360 — ColorRenderingMode enum
public enum ColorRenderingMode : Swift.Sendable { case nonLinear; case linear; case extendedLinear }
```

### 7.2 Behavior + web mapping

- **`.compositingGroup()`** — flattens the subtree into a single composited layer **before** applying outer effects (opacity, blend, shadow), so e.g. `.opacity(0.5)` on a group fades the group as one unit instead of fading each child independently (no double-blending on overlaps). → CSS **`isolation: isolate`** (creates a stacking context = one compositing group) and, when an outer opacity/filter applies, the browser already composites the isolated subtree as a unit. DESIGNED 1:1 enough for the common cases.

- **`.drawingGroup(opaque:colorMode:)`** — forces the subtree to be **rasterized off-screen via Metal** into one bitmap (performance: collapses many layers; also enables some effects that need a flattened canvas). `opaque: true` = no alpha channel (faster, white where transparent). `colorMode` = blending color space (`.nonLinear` default = sRGB gamma; `.linear`/`.extendedLinear` = linear-light). **Web has no exact "rasterize to bitmap" toggle**; the closest perf hint is **`will-change: transform`** / `transform: translateZ(0)` (forces a GPU layer) + `isolation: isolate`. The visual result is usually identical to not using it; it's a perf modifier. DESIGNED: treat as `isolation: isolate; will-change: transform;` and ignore `colorMode` (browsers composite in sRGB; `color()`/`color-mix(in oklab)` is unrelated). Mark as a **perf no-op for fidelity**.

```css
.sui-compositing-group { isolation: isolate; }
.sui-drawing-group     { isolation: isolate; will-change: transform; transform: translateZ(0); }
```

```tsx
function CompositingGroup({ children, style, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return <div className="sui-compositing-group" style={style} {...rest}>{children}</div>;
}
function DrawingGroup({ opaque = false, children, style, ...rest }: { opaque?: boolean; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className="sui-drawing-group" style={{ ...(opaque ? { background: "#fff" } : {}), ...style }} {...rest}>{children}</div>;
}
```

---

## 8. `.mask(...)` + `.luminanceToAlpha()`

### 8.1 `.mask` — Exact API — KNOWN (verbatim)

```swift
// SwiftUICore.swiftinterface:4662–4667 — modern @ViewBuilder form (iOS 15+)
@inlinable nonisolated public func mask<Mask>(
  alignment: Alignment = .center,
  @ViewBuilder _ mask: () -> Mask
) -> some View where Mask : View {
      return modifier(_MaskAlignmentEffect(alignment: alignment, mask: mask()))
  }
// :4709–4712 — deprecated value form (still ships)
@available(*, deprecated: "Use overload where mask accepts a @ViewBuilder instead.")
@inlinable nonisolated public func mask<Mask>(_ mask: Mask) -> some View where Mask : View {
      return modifier(_MaskEffect(mask: mask))
  }
// effect structs: _MaskAlignmentEffect (:4673, has alignment+mask), _MaskEffect (:4720, has mask)
```

- **Semantics:** the mask view's **alpha** (luminance is NOT used — pure alpha) determines visibility: opaque mask pixels show the content, transparent mask pixels hide it. `alignment` positions the mask within the content's frame (default `.center`).
- States: none. The mask can itself be animated (e.g. an animated gradient reveal).

### 8.2 `.mask` — web mapping — DESIGNED

CSS **`-webkit-mask` / `mask`** uses the mask image's alpha (and `mask-mode: alpha`) exactly like SwiftUI. For a *view* as mask (not an image), render the mask subtree into an absolutely-positioned layer and use CSS `mask` with `mask-image` pointing at it — but CSS `mask-image` only accepts images/gradients, **not arbitrary DOM**. So two paths:
1. **Gradient/shape mask** (common: fade-out edges, shape clip): `mask-image: linear-gradient(...)` / `mask-image: url(shape.svg)` — direct CSS.
2. **Arbitrary-view mask** (DESIGNED): render the mask DOM into an inline SVG `<mask>` via `foreignObject`, or use `mask: url(#svgmask)`. Heavier; reserve for true arbitrary masks. For the common case (rounded-corner clip, gradient fade), use gradients/`clip-path`.

```css
.sui-mask--gradient { -webkit-mask-image: var(--mask); mask-image: var(--mask);
  -webkit-mask-size: 100% 100%; mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; }
```

```tsx
function Mask({ mask, alignment = "center", children, style, ...rest }: {
  mask: string;                 // CSS mask-image value (gradient or url) — the common case
  alignment?: "center" | "top" | "bottom" | "leading" | "trailing";
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const pos = { center:"center", top:"top", bottom:"bottom", leading:"left", trailing:"right" }[alignment];
  return (
    <div className="sui-mask--gradient"
         style={{ WebkitMaskImage: mask, maskImage: mask,
                  WebkitMaskPosition: pos, maskPosition: pos, ...style }} {...rest}>
      {children}
    </div>
  );
}
// e.g. fade the bottom of a scroll view: <Mask mask="linear-gradient(to bottom, #000 80%, transparent)">
```

### 8.3 `.luminanceToAlpha()` — Exact API — KNOWN (verbatim)

```swift
// SwiftUICore.swiftinterface:9872–9875
@inlinable nonisolated public func luminanceToAlpha() -> some View {
      return modifier(_LuminanceToAlphaEffect())
  }
```

- **Semantics:** converts the view's **luminance to alpha** — bright pixels become opaque, dark pixels become transparent (the color is discarded; result is greyscale-as-alpha). Used to turn a luminance image into a mask. No params, no states.

### 8.4 `.luminanceToAlpha()` — web mapping — DESIGNED

**No CSS filter primitive.** The exact operation is the SVG filter `feColorMatrix type="luminanceToAlpha"` (the W3C standard luminance→alpha matrix). Define it once in an inline `<svg>` and reference via `filter: url(#sui-lum-alpha)`:

```html
<svg width="0" height="0" style="position:absolute">
  <filter id="sui-lum-alpha"><feColorMatrix type="luminanceToAlpha"/></filter>
</svg>
```
```css
.sui-luminance-to-alpha { filter: url(#sui-lum-alpha); }
```
```tsx
function LuminanceToAlpha({ children, style, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  // assumes the <filter id="sui-lum-alpha"> svg is mounted once at app root
  return <div className="sui-luminance-to-alpha" style={style} {...rest}>{children}</div>;
}
```
The `feColorMatrix type="luminanceToAlpha"` uses the Rec.709-ish coefficients (0.2126/0.7152/0.0722 per W3C) — matches SwiftUI's luminance definition closely. 1:1 within rounding.

---

## 9. iOS 26 "Liquid Glass" — LABELED DELTA (does NOT replace §1)

This is the iOS 26 / macOS 26 (visionOS unavailable) refractive-glass system. It is **not** a flat frosted scrim — it's a lensing layer with a live specular-highlight rim and edge light-bending, default shape `Capsule()`. Recorded as a delta; the canonical material recipe (§1) remains the default for iOS 17/18 fidelity.

### 9.1 Exact API — KNOWN (verbatim)

```swift
// SwiftUICore.swiftinterface:5753–5766 — the glass descriptor
@available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)  @available(visionOS, unavailable)
public struct Glass : Swift.Equatable, Swift.Sendable {
  public static var regular:  Glass { get }     // :5754 — adaptive frosted glass, picks up surroundings
  public static var clear:    Glass { get }     // :5757 — more transparent, dimming layer for media bgs
  public static var identity: Glass { get }     // :5760 — no glass (passthrough)
  public func tint(_ color: Color?) -> Glass    // :5763 — colored glass
  public func interactive(_ isEnabled: Bool = true) -> Glass   // :5764 — reacts to touch/pointer
  public static func == (a: Glass, b: Glass) -> Bool
}

// :2527–2529 — the modifier (default glass .regular, default shape = Capsule-ish)
extension SwiftUICore.View {
  nonisolated public func glassEffect(_ glass: Glass = .regular,
                                      in shape: some Shape = DefaultGlassEffectShape()) -> some View
}
// :2534–2549 — DefaultGlassEffectShape (the default capsule shape)
public struct DefaultGlassEffectShape : Shape { public init(); func path(in: CGRect) -> Path; … }

// :9045–9053 — container that lets multiple glass shapes blend / merge like droplets
@MainActor public struct GlassEffectContainer<Content> : View where Content : View {
  @MainActor public init(spacing: CGFloat? = nil, @ViewBuilder content: () -> Content)
  @MainActor public var body: some View { get }
}

// :17372 — matched-geometry id for glass morphing between states
nonisolated public func glassEffectID(_ id: (some (Hashable & Sendable))?, in namespace: Namespace.ID) -> some View
// :9880 — fuse adjacent glass shapes into one blob
@MainActor public func glassEffectUnion(id: (some (Hashable & Sendable))?, namespace: Namespace.ID) -> some View
// :2847–2861 — transitions
public struct GlassEffectTransition : Sendable {
  public static var matchedGeometry: GlassEffectTransition { get }   // :2848
  public static var materialize:     GlassEffectTransition { get }   // :2851
  public static var identity:        GlassEffectTransition { get }   // :2854
}
@MainActor public func glassEffectTransition(_ transition: GlassEffectTransition) -> some View   // :2861

// Related glass button styles (in SwiftUI.framework):
// GlassButtonStyle (SwiftUI:1247) → .glass ;  GlassProminentButtonStyle (SwiftUI:3378) → .glassProminent
```

### 9.2 How Liquid Glass differs from canonical material (the delta)

- **Refractive, not flat.** A live specular highlight rim + edge light-bending; default shape is a **capsule** (`DefaultGlassEffectShape`), not a rect.
- **`.regular`** = adaptive frosted glass that samples surroundings; **`.clear`** = more transparent dimming layer (for media-rich backgrounds); **`.identity`** = passthrough (no glass).
- **`.tint(color)`** injects colored glass; **`.interactive()`** makes it react to touch/pointer (scale + highlight shift on press).
- **`GlassEffectContainer` + `glassEffectUnion`/`glassEffectID`** let adjacent glass shapes **merge like liquid droplets** and morph between states — there is no material analog. `spacing:` controls how close two glass shapes must be before they fuse.
- **`glassEffectTransition`**: `.matchedGeometry` morphs glass between matched IDs; `.materialize` fades/scales glass in; `.identity` no transition.

### 9.3 Visual anatomy — INFERRED recipe (`materials.md` §4)

Sub-elements (layered): **(a)** blurred+saturated+brightened backdrop, **(b)** low-alpha white tint body, **(c)** an inset top specular highlight + bottom counter-light (the rim), **(d)** a drop shadow, **(e)** a moving diagonal specular sheen (`::before`, `mix-blend-mode: screen`). Default radius = capsule (`9999px`).

### 9.4 Web replication mapping — DESIGNED (multi-layer; kept separate from §1)

```css
.sui-liquid-glass {
  position: relative;
  border-radius: 9999px;                     /* Capsule default; override per `in: shape` */
  backdrop-filter: blur(8px) saturate(1.5) brightness(1.08);
  -webkit-backdrop-filter: blur(8px) saturate(1.5) brightness(1.08);
  background: rgba(255,255,255,0.18);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,0.55),   /* top specular highlight */
    inset 0 -1px 1px rgba(255,255,255,0.12),  /* bottom counter-light */
    0 4px 16px rgba(0,0,0,0.18);              /* drop shadow */
}
[data-theme="dark"] .sui-liquid-glass { background: rgba(255,255,255,0.10); }

.sui-liquid-glass::before {                   /* moving diagonal specular sheen */
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(135deg, rgba(255,255,255,0.40) 0%, transparent 40%);
  mix-blend-mode: screen;
}
.sui-liquid-glass--clear {                    /* .clear variant: lower blur/sat/tint */
  backdrop-filter: blur(4px) saturate(1.2) brightness(1.04);
  -webkit-backdrop-filter: blur(4px) saturate(1.2) brightness(1.04);
  background: rgba(255,255,255,0.06);
}
.sui-liquid-glass--identity {                 /* .identity: passthrough */
  backdrop-filter: none; -webkit-backdrop-filter: none; background: transparent; box-shadow: none;
}
.sui-liquid-glass--interactive { transition: transform .15s ease, filter .15s ease; }
.sui-liquid-glass--interactive:active { transform: scale(0.97); filter: brightness(1.12); }
```

`.tint(c)` ⇒ swap `background` to `color-mix(in srgb, c 25%, transparent)`. `in: shape` ⇒ override `border-radius` / `clip-path` to the requested shape.

```tsx
type GlassKind = "regular" | "clear" | "identity";
function GlassEffect({
  glass = "regular", tint, interactive = false, shape, children, style, ...rest
}: {
  glass?: GlassKind;
  tint?: string;                 // CSS color → color-mix tint
  interactive?: boolean;         // .interactive()
  shape?: React.CSSProperties;   // { borderRadius } or { clipPath } overriding the capsule default
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const cls = ["sui-liquid-glass",
    glass === "clear" ? "sui-liquid-glass--clear" : "",
    glass === "identity" ? "sui-liquid-glass--identity" : "",
    interactive ? "sui-liquid-glass--interactive" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls}
         style={{ ...(tint ? { background: `color-mix(in srgb, ${tint} 25%, transparent)` } : {}),
                  ...shape, ...style }} {...rest}>
      {children}
    </div>
  );
}
```

**GlassEffectContainer + glassEffectUnion/ID/Transition** (`spacing`, droplet-merge, matched-geometry morph): true refraction, edge-bending and liquid droplet merging are **not reproducible in pure CSS** — they require an SVG `feDisplacementMap` (refraction) or a WebGL pass (merge/morph). **Out of scope, flagged.** A web `GlassEffectContainer` can at most group children and apply a shared `isolation: isolate` + the §9.4 glass to each; `glassEffectTransition(.matchedGeometry)` can approximate with a FLIP/`view-transition` animation. Document these as DESIGNED approximations that intentionally fall short of the native droplet-merge.

```tsx
function GlassEffectContainer({ spacing, children, style, ...rest }: {
  spacing?: number; children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  // CSS can't merge glass blobs; we group + isolate. spacing ≈ flex gap.
  return <div style={{ display: "flex", gap: spacing ?? 8, isolation: "isolate", ...style }} {...rest}>{children}</div>;
}
// glassEffectID / glassEffectUnion: no faithful CSS — expose as data attributes for an optional view-transition layer.
```

**Calibration:** §9.4 numbers are starting points. Eyedrop the real iOS 26 glass over a known backdrop and tune `blur`/`saturate`/`brightness`/tint alpha + specular box-shadow alphas until ΔE < 3 (`materials.md` §4 calibration loop).

---

## 10. Tabulated long-tail — private `_*Effect` `ViewModifier` structs

These are the implementation structs each public modifier wraps (`modifier(_XxxEffect(...))`). They are `@frozen`, `Equatable`, and `Animatable` (their `animatableData` is the modifier's scalar arg). They have **no separate web mapping** — each is fully realized by its public modifier's section above. Listed for completeness so nothing is silently dropped.

| Private struct | swiftinterface | wrapped by | animatableData | covered in |
|---|---|---|---|---|
| `_BlurEffect` | :3681 | `.blur(radius:opaque:)` | `radius: CGFloat` | §4.1 |
| `_OpacityEffect` | (wrapped @ :4207) | `.opacity(_:)` | `opacity: Double` | §4.2 |
| `_BrightnessEffect` | :4419 | `.brightness(_:)` | `amount: Double` | §4.3 |
| `_ContrastEffect` | (wrapped @ :2832) | `.contrast(_:)` | `amount: Double` | §4.4 |
| `_SaturationEffect` | (wrapped @ :16380) | `.saturation(_:)` | `amount: Double` | §4.5 |
| `_GrayscaleEffect` | (wrapped @ :3957) | `.grayscale(_:)` | `amount: Double` | §4.6 |
| `_HueRotationEffect` | (wrapped @ :19494) | `.hueRotation(_:)` | `angle: Angle` | §4.7 |
| `_ColorMultiplyEffect` | (wrapped @ :17236) | `.colorMultiply(_:)` | `color` | §4.8 |
| `_BlendModeEffect` | (wrapped @ :2619) | `.blendMode(_:)` | — (enum) | §5 |
| `_ShadowEffect` | (wrapped @ :4345) | `.shadow(color:radius:x:y:)` | color/radius/offset | §6 |
| `_MaskEffect<Mask>` | :4720 | `.mask(_:)` (deprecated) | — | §8.1 |
| `_MaskAlignmentEffect<Mask>` | :4673 | `.mask(alignment:_:)` | — | §8.1 |
| `_CompositingGroupEffect` | (wrapped @ :5481) | `.compositingGroup()` | — | §7 |
| `_DrawingGroupEffect` | :4390 | `.drawingGroup(opaque:colorMode:)` | — | §7 |
| `_LuminanceToAlphaEffect` | (wrapped @ :9873) | `.luminanceToAlpha()` | — | §8.3 |

---

## 11. Cluster summary — SwiftUI modifier → CSS quick-reference

| SwiftUI | CSS primitive | Pass | Fidelity |
|---|---|---|---|
| `.background(.regularMaterial)` etc. | `backdrop-filter: blur() saturate()` + tint `background` | backdrop | INFERRED recipe (calibrate) |
| `.blur(radius:)` | `filter: blur(Npx)` (1:1) | content | KNOWN |
| `.opacity(_:)` | `opacity` (1:1) | content | KNOWN |
| `.brightness(_:)` | `filter: brightness(1 + b)` (additive→mult) | content | DESIGNED conversion |
| `.contrast(_:)` | `filter: contrast()` (1:1) | content | KNOWN |
| `.saturation(_:)` | `filter: saturate()` (1:1) | content | KNOWN |
| `.grayscale(_:)` | `filter: grayscale()` (1:1) | content | KNOWN |
| `.hueRotation(_:)` | `filter: hue-rotate(deg)` (1:1) | content | KNOWN |
| `.colorMultiply(_:)` | `::after` overlay `mix-blend-mode: multiply` | content | DESIGNED |
| `.blendMode(_:)` | `mix-blend-mode` (16 of 21 are 1:1) | composite | KNOWN / 5 DESIGNED |
| `.shadow(...)` | `box-shadow` (blur = 2×radius) | composite | KNOWN |
| `.mask(...)` | `mask-image` / SVG `<mask>` | composite | DESIGNED |
| `.luminanceToAlpha()` | SVG `feColorMatrix type="luminanceToAlpha"` | content | DESIGNED (SVG) |
| `.compositingGroup()` | `isolation: isolate` | composite | DESIGNED |
| `.drawingGroup(...)` | `isolation: isolate; will-change: transform` (perf no-op for fidelity) | composite | DESIGNED |
| `.visualEffect { p in … }` | render-prop + ResizeObserver/scroll → `filter`/`transform`/`opacity` | content | DESIGNED |
| `.glassEffect(_:in:)` (iOS 26) | layered `backdrop-filter` + specular box-shadows + sheen `::before` | backdrop | DESIGNED delta |

**Freshness:** the content-filter + blend + shadow + mask APIs and the `0.33` shadow default are **durable** (unchanged iOS 13→18; signatures verbatim above). `Material` names are durable; the blur/tint *numbers* are INFERRED and must be eyedrop-calibrated. `Glass`/Liquid Glass is iOS 26-new and recorded strictly as a delta. `MaterialActiveAppearance` is iOS 18+/desktop-only.

**Implementation note for the kit author:** emit one CSS custom property per leaf token (`--sui-material-regular-blur: 30px;` etc.), build composite `backdrop-filter`/`filter` from the vars, put Light on `:root` and Dark under `[data-theme="dark"]`. Content filters compose in a single `filter:` string in the documented order (brightness→contrast→saturate→grayscale→hue-rotate→blur). Backdrop and content filters never share a CSS property, so a frosted panel with blurred content needs `backdrop-filter` on the panel **and** `filter` on the inner content — two different elements.

---

## Liquid Glass (iOS 26)

> **Scope of this section.** §9 above first recorded Liquid Glass as a *labeled delta* against the canonical Material (§1). This section is the **authoritative, implemented spec**: the verbatim API, the visual recipe, and the *exact* CSS mapping the SwiftTS kit ships (`src/system/effects.ts`, `src/system/effects.global.css`, `src/tokens/variables.css`, `src/components/Button/`). Every claim is labeled **KNOWN** (verbatim from the swiftinterface), **INFERRED** (eyedropped visual recipe — calibrate against a device), or **DESIGNED** (our CSS engineering for a proprietary/native-only gap).

**Source (all line numbers KNOWN, verbatim):**
`/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/System/Library/Frameworks/SwiftUICore.framework/Versions/A/Modules/SwiftUICore.swiftmodule/arm64e-apple-macos.swiftinterface` (iOS 26 / macOS 26 SDK).

### A. Exact API — KNOWN (verbatim from the swiftinterface)

```swift
// :2529 — the glassEffect view modifier. Default glass = .regular; default
// clip shape = DefaultGlassEffectShape() (a concentric capsule).
nonisolated public func glassEffect(_ glass: SwiftUICore.Glass = .regular,
                                    in shape: some Shape = DefaultGlassEffectShape()) -> some SwiftUICore.View

// :2534 — the default clip shape (a Capsule-like concentric shape).
public struct DefaultGlassEffectShape : SwiftUICore.Shape {
  public init()
  nonisolated public func path(in rect: CoreFoundation.CGRect) -> SwiftUICore.Path
  // role / layoutDirectionBehavior / sizeThatFits … (Shape conformance)
}

// :5753 — the Glass value type. A frozen, Equatable+Sendable value with three
// statics and two chainable builders (each returns a NEW Glass — value semantics).
public struct Glass : Swift.Equatable, Swift.Sendable {
  public static var regular: SwiftUICore.Glass { get }   // :5754
  public static var clear:   SwiftUICore.Glass { get }   // :5757
  public static var identity: SwiftUICore.Glass { get }  // :5760
  public func tint(_ color: SwiftUICore.Color?) -> SwiftUICore.Glass            // :5763
  public func interactive(_ isEnabled: Swift.Bool = true) -> SwiftUICore.Glass  // :5764
  public static func == (a: SwiftUICore.Glass, b: SwiftUICore.Glass) -> Swift.Bool
}

// :9045 — groups multiple glass shapes so nearby ones blend/merge (shared blur
// sampling; capsule-merge when close). `spacing:` = the fuse distance.
@MainActor public struct GlassEffectContainer<Content> : SwiftUICore.View where Content : SwiftUICore.View {
  @MainActor public init(spacing: CoreFoundation.CGFloat? = nil,
                         @ViewBuilder content: () -> Content)   // :9046
  @MainActor public var body: some SwiftUICore.View { get }
}

// :2847 — the transition value for matched-geometry glass morphs.
public struct GlassEffectTransition : Swift.Sendable {
  public static var matchedGeometry: SwiftUICore.GlassEffectTransition { get }  // :2848
  public static var materialize:     SwiftUICore.GlassEffectTransition { get }  // :2851
  public static var identity:        SwiftUICore.GlassEffectTransition { get }  // :2854
}
@MainActor public func glassEffectTransition(_ transition: SwiftUICore.GlassEffectTransition) -> some SwiftUICore.View  // :2861

// :17372 / :9880 — morph/merge identity for matched-geometry glass transitions.
nonisolated public func glassEffectID(_ id: (some (Hashable & Sendable))?,
                                      in namespace: SwiftUICore.Namespace.ID) -> some SwiftUICore.View   // :17372
@MainActor public func glassEffectUnion(id: (some (Hashable & Sendable))?,
                                        namespace: SwiftUICore.Namespace.ID) -> some SwiftUICore.View     // :9880
```

**Button styles (the SwiftUI module, not SwiftUICore):** `GlassButtonStyle` (`.glass`) and `GlassProminentButtonStyle` (`.glassProminent`) render a button *as* Liquid Glass — `.glass` = adaptive glass body + label color; `.glassProminent` = the glass washed with the tint/accent color, white label. **KNOWN** (the style names are public SwiftUI API).

### B. The Liquid-Glass character vs. the older frosted `Material` — INFERRED

Liquid Glass is **not** the iOS-13→18 frosted `Material`. The differences that drive the recipe:

1. **More translucent / lighter.** A *thin* body tint (~0.18 α light, ~0.08 α dark) instead of a heavy frosted scrim (`.regularMaterial` is ~0.72 α). The backdrop reads through almost clearly.
2. **Real-time backdrop refraction.** The pane samples and lenses the pixels behind it — `saturate(180%) brightness(1.08)` lift the backdrop so it looks energized through the glass. (True optical *refraction* — edge light-bending — is native-only.)
3. **A bright specular RIM.** A crisp white highlight on the top edge, a dim counter-light on the bottom edge, and a hairline outline — the "wet edge" that makes it read as a solid pane of glass.
4. **A soft inner glow.** A diffuse self-lit pooling near the top, as if the pane catches ambient light.
5. **`.interactive` lensing.** On hover/press the glass scales slightly and brightens — a subtle physical lensing/response.
6. **Variants:** `.clear` is the **most transparent** (minimal tint, for media-rich backdrops); `.regular` is the default adaptive glass; `.identity` is a no-op passthrough (renders nothing). `.tint(color)` washes the glass with a *translucent* color (not opaque).

### C. The visual recipe — INFERRED (eyedrop; calibrate per device)

Back→front layer stack of a single glass pane:

| Layer | What it does | Recipe |
|---|---|---|
| backdrop | refractive lift | `backdrop-filter: blur(12px) saturate(1.8) brightness(1.08)` |
| body | thin translucent tint | `rgba(255,255,255,0.18)` light / `0.08` dark |
| rim (top) | bright specular highlight | `inset 0 1px 0.5px rgba(255,255,255,0.5)` |
| rim (bottom) | counter-light | `inset 0 -1px 1px rgba(255,255,255,0.12)` |
| hairline | edge outline (traces the shape) | `inset 0 0 0 0.5px rgba(255,255,255,0.28)` |
| drop shadow | soft elevation | `0 6px 20px rgba(0,0,0,0.18)` |
| sheen (`::before`) | top diagonal highlight | `linear-gradient(125deg, rgba(255,255,255,0.45) 0%, transparent 38%)`, `mix-blend-mode: screen` |
| glow (`::after`) | soft inner pooling | `radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,0.22), transparent 60%)` |
| tint wash | `.tint(color)` overlay | `color-mix(in srgb, <color> 22%, transparent)` over the glow + tint-colored hairline |

`.clear` lowers everything (blur 5px, saturate 1.3, body 0.06 α, fainter sheen/glow). `.identity` zeroes the backdrop-filter / background / shadow and hides both pseudo-elements.

### D. The exact CSS mapping the kit implements — DESIGNED

The kit is **token-driven**: one custom property per leaf (`--sui-glass-*` in `src/tokens/variables.css`), Light on `:root`, Dark under both `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`. The CSS (`src/system/effects.global.css`) only consumes vars — it never hardcodes a tint. All selectors are **BARE** (un-scoped) class names (no `:global(...)`, which breaks under Turbopack), so the `glassClass()` strings resolve verbatim.

**Tokens** (`variables.css`): `--sui-glass-blur` (12px), `--sui-glass-saturate` (1.8), `--sui-glass-brightness` (1.08), `--sui-glass-tint` (body), `--sui-glass-rim` / `--sui-glass-rim-bottom` / `--sui-glass-hairline` (specular rim), `--sui-glass-sheen` / `--sui-glass-glow` / `--sui-glass-shadow`, the `.clear` set (`--sui-glass-clear-*`), and the interactive set (`--sui-glass-interactive-brightness/scale`, `--sui-glass-hover-brightness/scale`).

**CSS classes** (`effects.global.css §4`):

- `.sui-glass` — `isolation: isolate` + capsule default radius + the composite `backdrop-filter` + body `background` + the 4-part rim `box-shadow`. `::before` = the diagonal screen-blended sheen; `::after` = the radial inner glow; `> *` lifts children above both. An `@supports not (backdrop-filter)` fallback thickens the body so it stays legible without live refraction.
- `.sui-glass-clear` — the `.clear` variant: lower blur/saturate/brightness/body, fainter sheen+glow.
- `.sui-glass-identity` — passthrough: backdrop-filter/background/shadow off, pseudo-elements hidden.
- `.sui-glass-tinted` — `.tint(color)`: re-tints `::after` with `color-mix(... <color> 22%, transparent)` and re-tints the hairline in-color. The color is delivered via the `--sui-glass-tint-color` custom property (set inline by `glassStyle`).
- `.sui-glass-interactive` — `.interactive()`: a snappy-spring `transform` transition; `@media (hover:hover)` hover scales `1.02` + brightens + lifts the shadow; `:active` scales `0.97` + brightens (the press lensing).

**The TS API** (`src/system/effects.ts`, public via the barrel):

- `Glass` (interface) — the resolved config (`variant`, `tintColor`, `isInteractive`) with chainable `.tint(color|null)` / `.interactive(bool=true)`; each returns a **new** frozen value (1:1 with the Swift value-type builder).
- `glass` — the statics object: `glass.regular` / `glass.clear` / `glass.identity` (getters), chainable: `glass.clear.tint("#34c759").interactive()`.
- `makeGlass({ variant, tint, interactive })` — factory alternative.
- `glassClass(glass)` → the class string; `glassStyle(glass)` → the inline `{ "--sui-glass-tint-color": … }` (empty when untinted).
- `glassEffectProps(glass, shape)` → `{ className, style }` to spread — the analog of `.glassEffect(_:in:)`. `shape`: `'capsule'` (default = `DefaultGlassEffectShape`) | `'circle'` | `{ rounded: n }` | raw `{ borderRadius | clipPath }`.
- `<GlassEffect glass shape>` component (and `Glass` alias) — wraps the props onto a `<div>`.
- `<GlassEffectContainer spacing axis>` — an `inline-flex` group with `isolation: isolate` and `gap: spacing`. A **negative** `spacing` lets adjacent capsules visually kiss/overlap (the closest CSS gets to the native droplet-merge).

**SwiftUI → CSS map:**

| SwiftUI | CSS the kit emits | Label |
|---|---|---|
| `.glassEffect(.regular)` | `.sui-glass` (token-driven backdrop+rim+sheen+glow) | DESIGNED recipe |
| `.glassEffect(.clear)` | `.sui-glass .sui-glass-clear` | DESIGNED |
| `.glassEffect(.identity)` | `.sui-glass .sui-glass-identity` (passthrough) | DESIGNED |
| `Glass.tint(color)` | `.sui-glass-tinted` + `--sui-glass-tint-color` overlay | DESIGNED |
| `Glass.interactive()` | `.sui-glass-interactive` (hover lift + press lensing, snappy spring) | DESIGNED |
| `in: DefaultGlassEffectShape()` | `border-radius: 9999px` (capsule) | DESIGNED |
| `in: RoundedRectangle(cornerRadius: n)` | `glassEffectProps(g, { rounded: n })` → `border-radius: n` | DESIGNED |
| `in: Circle()` | `glassEffectProps(g, 'circle')` → `border-radius:50%; aspect-ratio:1` | DESIGNED |
| `GlassButtonStyle` (`.glass`) | `.button` + `glassClass('regular')` + `data-style="glass"` (label color only) | DESIGNED |
| `GlassProminentButtonStyle` (`.glassProminent`) | `.button` + `.sui-glass` + `data-style="glassProminent"` (tint wash + white label + tint rim) | DESIGNED |
| `GlassEffectContainer(spacing:)` | `<GlassEffectContainer>` `inline-flex; gap: spacing; isolation: isolate` (negative gap ≈ merge) | DESIGNED (approximation) |

### E. Honest gaps — DESIGNED-with-shortfall

- **True backdrop refraction** (edge light-bending) requires an SVG `feDisplacementMap` or a WebGL pass. The CSS recipe approximates the *look* (blur + saturate + brightness + specular rim) but does **not** bend the backdrop. Flagged.
- **Droplet-merge** (`GlassEffectContainer` + `glassEffectUnion`/`glassEffectID` fusing adjacent capsules into one liquid blob) is native-only. The kit groups children with a shared isolation context and a negative `spacing` so capsules can visually overlap, but does not seam-merge their blur fields. Flagged.
- **`glassEffectTransition(.matchedGeometry / .materialize)`** — the morph between matched glass IDs could be approximated with a FLIP / View Transitions API animation; not wired in this pass. `.identity` (no transition) is trivially the default. Flagged as future work.

**Freshness:** the API signatures above are **iOS 26-new and KNOWN** (verbatim, cited). The *numbers* in the recipe (blur radius, body alpha, rim alphas, sheen/glow) are **INFERRED** and must be eyedrop-calibrated against a real iOS 26 device. The architecture (token-per-leaf, bare global classes, two-pass backdrop-vs-content split) is **durable**.
