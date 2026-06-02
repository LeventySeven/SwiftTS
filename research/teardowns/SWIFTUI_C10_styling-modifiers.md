# SwiftUI Cluster C10 — Styling Modifiers (the prop→CSS mapping engine)

**Mission:** This is the RE spec for the **big view-modifier surface** (~445 modifiers) of SwiftUI, written so a later agent can paste the prop→CSS rows into the React+CSS UI kit. Every component in the kit consumes these — they are not standalone widgets, they are the styling vocabulary applied to *all* widgets.

**Tier-1A source files (read line-by-line this session):**
- `SUICore` = `…/SwiftUICore.framework/Versions/A/Modules/SwiftUICore.swiftmodule/arm64e-apple-macos.swiftinterface` (21,762 lines)
- `SUI` = `…/SwiftUI.framework/Versions/A/Modules/SwiftUI.swiftmodule/arm64e-apple-macos.swiftinterface` (25,517 lines)

**Label key:** **KNOWN** = verbatim signature/default-arg/enum from the swiftinterface. **INFERRED** = Apple HIG / developer docs / reputable RE for runtime numbers the interface can't show. **DESIGNED** = our CSS engineering for a web gap.

**W1 token namespace referenced throughout** (from `swiftui/tokens/*.md`): colors `--sui-color-*`, typography `--sui-text-*` / `--sui-font-*` / `--sui-weight-*`, spacing/metrics `space.* / metric.* / radius.*`, shapes/effects `shadow.* / stroke.* / shape.*`.

**How the React kit consumes this:** the kit ships a single `applyModifiers(props)` compiler that turns an idiomatic prop bag into a CSS style object + class list. Each row below is one entry in that compiler's table. Components (`<SUIButton>`, `<SUIText>`, …) spread these props. So the deliverable is a **prop → CSS** dictionary, grouped by concern.

---

## Part A — Cluster type list (the `types` array)

The C10 `types` array is **almost entirely SwiftUI framework plumbing** — internal layout roots (`_ZStackLayout`, `_LayoutRoot`, `_SizeFittingRoot`), private effect modifiers (`_MaskEffect`, `_ScrollClipEffect`, `_DrawingGroupEffect`), platform bridges (`NSHostingView`, `NSViewRepresentable`), default label structs (`DefaultButtonLabel`, `DefaultTabLabel`), and a handful of real public views that belong to **other clusters** (`GroupBox`→C15 controls, `ContentUnavailableView`→C-empty-states, `HSplitView`/`VSplitView`→layout). **None of these are styling modifiers**; they are types that happened to tag as `View`/`ViewModifier`. The cluster's real payload — and this teardown's job — is the **`modifiers` array (~445)**. The `types` are tabulated at the end (Part Z) with one-line purpose + web-equivalent, since they carry no per-element visual styling spec of their own. The deep work is the modifier→CSS engine below.

---

## Part B — LAYOUT modifiers (frame, padding, position, offset, clip, aspect, safe-area)

This is the spine of the compiler. Every metric references the W1 spacing tokens.

### B.1 `frame` — the size box

**KNOWN** `SUICore:12560`:
```swift
@inlinable nonisolated public func frame(width: CGFloat? = nil, height: CGFloat? = nil,
                                         alignment: Alignment = .center) -> some View
```
**KNOWN** `SUICore:12597` (flexible form):
```swift
@inlinable nonisolated public func frame(minWidth: CGFloat? = nil, idealWidth: CGFloat? = nil,
                                         maxWidth: CGFloat? = nil, minHeight: CGFloat? = nil,
                                         idealHeight: CGFloat? = nil, maxHeight: CGFloat? = nil,
                                         alignment: Alignment = .center) -> some View
```
**KNOWN** `SUICore:12566`: `func frame() -> some View` (debug no-op that fixes the view at its ideal size).

**Semantics (INFERRED from layout docs):** `frame(width:height:)` proposes a *fixed* size to the child and the modifier itself becomes that size; the child is centered (or aligned) inside. The flexible form sets min/ideal/max constraints. **`maxWidth: .infinity`** is the idiom for "fill available width" — it expands the frame to the proposal's width. `alignment` positions the child *within* the (possibly larger) frame.

**Visual anatomy:** an outer box of the resolved size; child positioned by `alignment` (9-point: topLeading…bottomTrailing). No background/border of its own.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.frame(width: w)` | `width: {w}px` |
| `.frame(height: h)` | `height: {h}px` |
| `.frame(width:w, height:h)` | `width:{w}px; height:{h}px` |
| `.frame(maxWidth: .infinity)` | `width: 100%` (or `flex: 1` / `align-self: stretch` in flex parent) |
| `.frame(minWidth: m)` | `min-width: {m}px` |
| `.frame(maxWidth: m)` | `max-width: {m}px` |
| `.frame(idealWidth: i)` | `width: {i}px` (ideal = preferred; only used when proposal is `nil`) |
| `alignment: .center` | child wrapper `display:flex; align-items:center; justify-content:center` |
| `alignment: .topLeading` | `align-items:flex-start; justify-content:flex-start` |
| `alignment: .bottomTrailing` | `align-items:flex-end; justify-content:flex-end` |

The alignment grid maps to a 3×3 flexbox: vertical → `align-items`, horizontal → `justify-content`, each ∈ `{flex-start, center, flex-end}`. `.infinity` → `100%` (RTL-safe; not a logical-prop concern since width is axis-neutral).

**React prop API:**
```tsx
<View frame={{ width?, height?, minWidth?, maxWidth?, idealWidth?, minHeight?, maxHeight?, idealHeight?, alignment? }} />
// maxWidth="infinity" → 100%
```

### B.2 `padding` — inner spacing

**KNOWN** `SUICore:2509–2518`:
```swift
@inlinable nonisolated public func padding(_ insets: EdgeInsets) -> some View          // :2509
@inlinable nonisolated public func padding(_ edges: Edge.Set = .all,
                                           _ length: CGFloat? = nil) -> some View       // :2513  ← nil = system default
@inlinable nonisolated public func padding(_ length: CGFloat) -> some View              // :2518
```
**The load-bearing RE fact:** `length` defaults to `nil`, NOT a number. `.padding()` → `padding(.all, nil)` → runtime resolves the **system default = 16 pt on iOS** (`space.padding.default = 16px`; some narrow contexts → 20). `EdgeInsets{top,leading,bottom,trailing}` maps 1:1 to logical CSS padding.

**Web mapping (DESIGNED, RTL-safe via logical props):**
| SwiftUI | CSS |
|---|---|
| `.padding()` | `padding: 16px` (token `space.padding.default`) |
| `.padding(8)` | `padding: 8px` |
| `.padding(.horizontal, 12)` | `padding-inline: 12px` |
| `.padding(.vertical, 6)` | `padding-block: 6px` |
| `.padding(.leading, 10)` | `padding-inline-start: 10px` |
| `.padding(.trailing, 10)` | `padding-inline-end: 10px` |
| `.padding(.top, 4)` | `padding-top: 4px` |
| `.padding(EdgeInsets(top:t,leading:l,bottom:b,trailing:r))` | `padding: {t}px {r}px {b}px {l}px` (CSS order TRBL; leading→`padding-inline-start`) |
| `.padding([.horizontal, .top], 8)` | `padding-inline: 8px; padding-top: 8px` |

`Edge.Set` cases: `.top .bottom .leading .trailing .horizontal(=leading+trailing) .vertical(=top+bottom) .all`. **Always compile leading/trailing to `padding-inline-start/end`** so RTL flips like SwiftUI.

**React prop API:** `<View padding />` (→16) · `<View padding={8} />` · `<View padding={{ horizontal: 12, top: 6 }} />`.

### B.3 `position` — absolute center placement

**KNOWN** `SUICore:5608` / `:5612`:
```swift
@inlinable nonisolated public func position(_ position: CGPoint) -> some View
@inlinable nonisolated public func position(x: CGFloat = 0, y: CGFloat = 0) -> some View
```
**Semantics:** places the view's **center** at `(x,y)` in the parent's coordinate space, and the view *takes the full parent size* as its own frame (it does not shrink to content — unlike `offset`). Default `(0,0)` = parent's top-left, so the view's center sits at the corner.

**Web mapping (DESIGNED):** parent must be `position: relative`. Child:
```css
position: absolute;
left: {x}px; top: {y}px;
transform: translate(-50%, -50%);   /* center-anchor, matching SwiftUI's center semantics */
```
**React prop API:** `<View position={{ x, y }} />`.

### B.4 `offset` — visual translation (no layout impact)

**KNOWN** `SUICore:896` / `:900`:
```swift
@inlinable nonisolated public func offset(_ offset: CGSize) -> some View
@inlinable nonisolated public func offset(x: CGFloat = 0, y: CGFloat = 0) -> some View
```
**Semantics:** shifts the *rendering* by (x,y) but the view keeps its **original layout slot** (siblings don't move). This is exactly CSS `transform: translate`, which also doesn't affect flow.

**Web mapping (DESIGNED):** `transform: translate({x}px, {y}px)`. Composes with other transforms (scale/rotate) in one `transform` string — compiler concatenates. **React:** `<View offset={{ x, y }} />`.

### B.5 `fixedSize` — hug ideal size, ignore proposal

**KNOWN** `SUICore:1363` / `:1368`:
```swift
@inlinable nonisolated public func fixedSize(horizontal: Bool, vertical: Bool) -> some View
@_alwaysEmitIntoClient nonisolated public func fixedSize() -> some View   // = fixedSize(horizontal:true, vertical:true)
```
**Semantics:** the view renders at its **ideal** size on the chosen axes instead of accepting the parent's proposal. The canonical use: `Text(...).fixedSize()` to stop truncation/wrapping — the text takes its full intrinsic width.

**Web mapping (DESIGNED):**
| | CSS |
|---|---|
| `.fixedSize()` | `width: max-content; height: max-content` (and on text: `white-space: nowrap`) |
| `.fixedSize(horizontal:true, vertical:false)` | `width: max-content` (+`white-space:nowrap` for text) |
| `.fixedSize(horizontal:false, vertical:true)` | `height: max-content` |

**React:** `<View fixedSize />` · `<View fixedSize={{ horizontal: true, vertical: false }} />`.

### B.6 `layoutPriority` — flex grow/shrink priority

**KNOWN** `SUICore:14355`: `func layoutPriority(_ value: Double) -> some View`. Default for all views is `0`. Higher priority claims space first when a stack distributes; a `Text` with `.layoutPriority(1)` keeps its width while a 0-priority sibling truncates.

**Web mapping (DESIGNED):** map to flex `flex-grow`/`flex-shrink`. A view with higher priority → `flex-shrink: 0` (resist shrinking) and `flex-grow` proportional to priority. Practical compile: `priority > 0` → `flex-shrink: 0; flex-grow: {priority}`. **React:** `<View layoutPriority={1} />`.

### B.7 `zIndex` — stacking order

**KNOWN** `SUICore:8119`: `func zIndex(_ value: Double) -> some View`. Default `0`. Controls draw order **within a single ZStack/overlay** (not global). Higher draws on top; ties broken by source order.

**Web mapping (DESIGNED):** `z-index: {value}` (rounded to int; CSS z-index is integer — keep fractional intent by scaling ×1000 if needed). Requires the element to be positioned or a flex/grid item. **React:** `<View zIndex={2} />`.

### B.8 `clipped` / `clipShape` / `cornerRadius` — clipping

**KNOWN** `SUICore:17344` / `:17340` / `:17354`:
```swift
@inlinable nonisolated public func clipped(antialiased: Bool = false) -> some View                              // :17344
@inlinable nonisolated public func clipShape<S>(_ shape: S, style: FillStyle = FillStyle()) -> some View where S: Shape  // :17340
@inlinable nonisolated public func cornerRadius(_ radius: CGFloat, antialiased: Bool = true) -> some View        // :17354 (DEPRECATED)
```
**Semantics:** `clipped()` = clip to the view's own bounding rect (hide overflow). `clipShape(_:)` = clip to any `Shape` (Circle, Capsule, RoundedRectangle…). `cornerRadius(_:)` is **deprecated** and notably produces a **`.circular`** corner (not the modern `.continuous` default of `clipShape(.rect(cornerRadius:))`).

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.clipped()` | `overflow: hidden` |
| `.clipShape(Circle())` | `clip-path: circle(50%)` or `border-radius: 50%; overflow:hidden` |
| `.clipShape(Capsule())` | `border-radius: 9999px; overflow: hidden` |
| `.clipShape(RoundedRectangle(cornerRadius: r))` | `border-radius: {r}px; overflow:hidden` (+ squircle `clip-path` for fidelity — see shapes-effects §3.1) |
| `.cornerRadius(r)` (deprecated, circular) | `border-radius: {r}px; overflow:hidden` (exact — circular = pure CSS arc) |

For continuous corners use the figma-squircle `clip-path` (`radius.continuous.smoothing = 0.6`); circular `cornerRadius` maps exactly to `border-radius`. **React:** `<View clipped />` · `<View clipShape="capsule" />` · `<View cornerRadius={12} />`.

### B.9 `mask` — alpha mask from a view

**KNOWN** `SUICore:4662` / `:4709`:
```swift
@inlinable nonisolated public func mask<Mask>(alignment: Alignment = .center,
       @ViewBuilder _ mask: () -> Mask) -> some View where Mask: View   // :4662
@inlinable nonisolated public func mask<Mask>(_ mask: Mask) -> some View where Mask: View   // :4709
```
**Semantics:** uses the mask view's **alpha** (and luminance for gradients) to cut out the content — where mask is opaque, content shows; where transparent, hidden.

**Web mapping (DESIGNED):** `-webkit-mask` / `mask` with the mask rendered to an image or gradient. For a gradient mask: `mask-image: linear-gradient(...)`. For a shape mask: `mask: url(#shape)`. Private internals `_MaskEffect`/`_MaskAlignmentEffect` (`SUICore:4719`/`:4673`) are the underlying modifier structs — same CSS. **React:** `<View mask={<Gradient/>} />`.

### B.10 `aspectRatio` / `scaledToFit` / `scaledToFill`

**KNOWN** `SUICore:7413` / `:7418` / `:7423` / `:7427`:
```swift
@inlinable nonisolated public func aspectRatio(_ aspectRatio: CGFloat? = nil, contentMode: ContentMode) -> some View  // :7413
@inlinable nonisolated public func aspectRatio(_ aspectRatio: CGSize, contentMode: ContentMode) -> some View          // :7418
@inlinable nonisolated public func scaledToFit() -> some View   // :7423  = aspectRatio(contentMode: .fit)
@inlinable nonisolated public func scaledToFill() -> some View  // :7427  = aspectRatio(contentMode: .fill)
```
**`ContentMode` enum — KNOWN `SUICore:7376`:** `case fit` / `case fill`. `.fit` = scale to fit within bounds (letterbox, whole content visible). `.fill` = scale to fill bounds (crop overflow).

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.aspectRatio(16.0/9.0, contentMode:.fit)` | `aspect-ratio: 16/9; object-fit: contain` (on `<img>`/`<video>`) or `aspect-ratio: 16/9` on a box |
| `.aspectRatio(contentMode:.fill)` (nil ratio) | `object-fit: cover` (uses content's own ratio) |
| `.scaledToFit()` | `object-fit: contain; width:100%; height:100%` |
| `.scaledToFill()` | `object-fit: cover; width:100%; height:100%` |

`object-fit` is the image/video analog; for non-media boxes, `aspect-ratio` + `overflow:hidden` (fill) or contained sizing (fit). **React:** `<Image aspectRatio={16/9} contentMode="fit" />`.

### B.11 `containerRelativeFrame` — size as fraction of nearest container

**KNOWN** `SUI:1457` / `:1460` / `:1463`:
```swift
public func containerRelativeFrame(_ axes: Axis.Set, alignment: Alignment = .center) -> some View                          // :1457
public func containerRelativeFrame(_ axes: Axis.Set, count: Int, span: Int = 1, spacing: CGFloat,
                                   alignment: Alignment = .center) -> some View                                            // :1460  ← grid-cell sizing
public func containerRelativeFrame(_ axes: Axis.Set, alignment: Alignment = .center,
                                   _ length: @escaping (CGFloat, Axis) -> CGFloat) -> some View                            // :1463  ← custom closure
```
**Semantics:** sizes the view relative to its **container** (scroll view / screen), not its parent. The `count:span:spacing:` form is the carousel/paging idiom — divide the container into `count` columns, the view spans `span` of them.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.containerRelativeFrame(.horizontal)` | `width: 100cqw` (container query unit) or `width: 100%` of the scroll container |
| `.containerRelativeFrame(.horizontal, count:3, span:1, spacing:8)` | `width: calc((100cqw - 2*8px) / 3)` — one of 3 cells |
| `.containerRelativeFrame([.horizontal,.vertical])` | `width:100cqw; height:100cqh` |

Requires `container-type: inline-size` (or `size`) on the scroll container. The `count` math: `cellWidth = (containerWidth − (count−1)·spacing) / count · span + (span−1)·spacing`. **React:** `<View containerRelativeFrame={{ axes:'horizontal', count:3, span:1, spacing:8 }} />`.

### B.12 `safeAreaInset` / `safeAreaPadding` / `ignoresSafeArea` / `edgesIgnoringSafeArea` / `scenePadding`

**KNOWN** `SUICore:18826` / `:18888` / `:16559` / `:16548`:
```swift
func safeAreaInset<V>(edge: VerticalEdge, alignment: HorizontalAlignment = .center,
                      spacing: CGFloat? = nil, @ViewBuilder content: () -> V) -> some View   // :18826 (also HorizontalEdge :18833)
func safeAreaPadding(_ insets: EdgeInsets) -> some View                                      // :18888 (+ edges/length :18895, length :18905)
func ignoresSafeArea(_ regions: SafeAreaRegions = .all, edges: Edge.Set = .all) -> some View // :16559
func edgesIgnoringSafeArea(_ edges: Edge.Set) -> some View                                   // :16548 (deprecated)
```
**KNOWN** `SUI:467` / `:470`:
```swift
func scenePadding(_ edges: Edge.Set = .all) -> some View
func scenePadding(_ padding: ScenePadding, edges: Edge.Set = .all) -> some View
```
**Semantics:** `safeAreaInset` docks an accessory (toolbar/banner) against a safe-area edge and pushes content in by its height. `ignoresSafeArea` lets a background bleed under notch/home-indicator. `scenePadding` applies the platform's reading-margin.

**Web mapping (DESIGNED, using CSS `env(safe-area-inset-*)`):**
| SwiftUI | CSS |
|---|---|
| `.ignoresSafeArea()` | remove the `env()` padding for that edge (full-bleed) |
| safe-area honoring container | `padding-top: env(safe-area-inset-top)` etc. |
| `.safeAreaInset(edge:.bottom){bar}` | `padding-bottom: {barHeight}px` on content + fixed/sticky bar at bottom inside safe area |
| `.safeAreaPadding(16)` | `padding: max(16px, env(safe-area-inset-*))` |
| `.scenePadding()` | `padding-inline: max(env(safe-area-inset-left), 16px)` (reading margin) |

Requires `<meta name="viewport" content="viewport-fit=cover">`. **React:** `<View ignoresSafeArea />` · `<View safeAreaInset={{ edge:'bottom', content:<Toolbar/> }} />`.

---

## Part C — FILL / STROKE modifiers (foreground, background, tint, border, overlay, shadow)

These paint the view. They reference the color tokens (`--sui-color-*`) and shape/shadow tokens directly.

### C.1 `foregroundStyle` / `foregroundColor`

**KNOWN** `SUICore:9176` / `:9180` / `:9185` (multi-style) and `:1878` (deprecated color form):
```swift
@inlinable nonisolated public func foregroundStyle<S>(_ style: S) -> some View where S: ShapeStyle           // :9176
@inlinable nonisolated public func foregroundStyle<S1,S2>(_ primary: S1, _ secondary: S2) -> some View       // :9180
@inlinable nonisolated public func foregroundStyle<S1,S2,S3>(_ primary, _ secondary, _ tertiary) -> some View // :9185
@inlinable nonisolated public func foregroundColor(_ color: Color?) -> some View                              // :1878 (deprecated → use foregroundStyle)
```
**Semantics:** sets the fill for text/SF-Symbols/shapes in the subtree. The 2- and 3-arg forms feed **hierarchical** symbol layers (primary/secondary/tertiary), e.g. a multi-layer SF Symbol. `ShapeStyle` can be a `Color`, a `HierarchicalShapeStyle` (`.secondary`), a gradient, or a material.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.foregroundStyle(.primary)` | `color: var(--sui-color-label)` |
| `.foregroundStyle(.secondary)` | `color: var(--sui-color-secondary-label)` (= `rgba(60,60,67,0.6)` light) |
| `.foregroundStyle(.tertiary)` | `color: var(--sui-color-tertiary-label)` |
| `.foregroundStyle(.tint)` | `color: var(--sui-color-tint)` |
| `.foregroundStyle(Color.red)` | `color: var(--sui-color-system-red)` |
| `.foregroundStyle(someGradient)` | `background: <gradient>; -webkit-background-clip: text; color: transparent` (text-gradient trick) |
| `.foregroundColor(.blue)` | `color: var(--sui-color-system-blue)` |
| 2/3-arg hierarchical (symbols) | apply `color` to layer 0, `opacity .secondary/.tertiary` to SVG sublayers via `fill` per `<path>` |

The hierarchy multipliers (colors §9): secondary 0.5, tertiary 0.25, quaternary 0.18, quinary 0.10 — compile via `color-mix(in srgb, currentColor 50%, transparent)`. **React:** `<Text foregroundStyle="secondary" />` · `<Text foregroundStyle={Color.red} />`.

### C.2 `background` — layer behind content

**KNOWN** `SUICore:15455` (view form) and the ShapeStyle forms via overlay-family:
```swift
@inlinable @_disfavoredOverload nonisolated public func background<Background>(_ background: Background,
                                          alignment: Alignment = .center) -> some View where Background: View   // :15455
// ShapeStyle forms (analogous to overlay :3314/:3319):
func background<S>(_ style: S, in shape: T, fillStyle: FillStyle = FillStyle()) -> some View where S: ShapeStyle, T: Shape
func background(alignment: Alignment = .center, @ViewBuilder content: () -> V) -> some View
```
**Semantics:** draws `background` **behind** the content, sized to the content (the background does NOT change the content's layout size — it's measured by the content). `in shape:` clips the background fill to a shape (the canonical "filled rounded rect behind a label" = button look). `alignment` positions a smaller background view.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.background(Color.red)` | `background-color: var(--sui-color-system-red)` |
| `.background(.regularMaterial)` | `backdrop-filter: blur(...); background: rgba(...)` (materials.md) |
| `.background(Color.blue, in: Capsule())` | `background: var(--sui-color-system-blue); border-radius: 9999px` |
| `.background(Color.gray.opacity(0.2), in: RoundedRectangle(cornerRadius:8))` | `background: rgba(...); border-radius: 8px` |
| `.background { CustomView() }` | nest an absolutely-positioned layer at `z-index:-1` (or `::before`) sized 100% behind content |
| `.background(alignment:.bottomTrailing){badge}` | absolutely-positioned child anchored bottom-trailing |

For the common `style, in: shape` form (the button/chip primitive), emit `background` + `border-radius` directly on the element (no extra DOM). For an arbitrary view background, use a positioned `::before` or a wrapper. **React:** `<View background={Color.red} />` · `<View background={{ style: Color.blue, in:'capsule' }} />`.

### C.3 `backgroundStyle` — environment fill for `.background` ShapeStyle

**KNOWN** `SUICore:9137`: `func backgroundStyle<S>(_ style: S) -> some View where S: ShapeStyle`. Sets the **environment** `.backgroundStyle` so descendants that draw `BackgroundStyle` (the semantic "current background") resolve to this. Used so a `Color.clear.background()` or a `.fill(.background)` picks up the right surface color.

**Web mapping (DESIGNED):** set a CSS custom property `--sui-current-background: <value>` on the subtree root; elements that read `BackgroundStyle` use `var(--sui-current-background)`. Default resolves to `--sui-color-system-background`. **React:** `<View backgroundStyle={Color.systemBackground} />`.

### C.4 `tint` / `accentColor`

**KNOWN** `SUICore:19253` (tint) / `:1933` (accentColor, deprecated):
```swift
@inlinable @_disfavoredOverload nonisolated public func tint(_ tint: Color?) -> some View   // :19253
@inlinable nonisolated public func accentColor(_ accentColor: Color?) -> some View           // :1933 (deprecated → tint)
```
**Semantics:** overrides the app accent for the subtree. Every control that reads "the tint" (filled buttons, switches on-state, sliders, selected segments, progress) uses it. Default tint = `systemBlue`. `nil` resets to inherited/default.

**Web mapping (DESIGNED):** set the single overridable accent var on the subtree:
```css
--sui-color-tint: <color>;   /* default #007AFF light / #0A84FF dark */
```
Every interactive component references `var(--sui-color-tint)`. So `.tint(.purple)` → `--sui-color-tint: var(--sui-color-system-purple)`. **React:** `<View tint={Color.purple} />`.

### C.5 `border` — stroke inside the edge

**KNOWN** `SUICore:3299`:
```swift
@inlinable nonisolated public func border<S>(_ content: S, width: CGFloat = 1) -> some View where S: ShapeStyle
```
**Default width = 1** (KNOWN). `.border` draws an **inset** stroke along the view's rectangular edge (like `.strokeBorder`, fully inside) — so it maps to CSS `border` with `box-sizing: border-box`. It does NOT round corners (it's the rectangular edge); to round, combine with `clipShape`/`cornerRadius` or use `.overlay(RoundedRectangle().stroke())`.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.border(Color.gray)` | `border: 1px solid var(--sui-color-system-gray)` |
| `.border(Color.red, width: 2)` | `border: 2px solid var(--sui-color-system-red)` |
| `.border(.separator)` | `border: 0.5px solid var(--sui-color-separator)` (hairline) |

**React:** `<View border={Color.gray} />` · `<View border={{ content: Color.red, width: 2 }} />`.

### C.6 `overlay` — layer in front of content

**KNOWN** `SUICore:3294` / `:3310` / `:3314` / `:3319`:
```swift
@inlinable @_disfavoredOverload nonisolated public func overlay<Overlay>(_ overlay: Overlay,
                                          alignment: Alignment = .center) -> some View where Overlay: View  // :3294
@inlinable nonisolated public func overlay<V>(alignment: Alignment = .center,
                                          @ViewBuilder content: () -> V) -> some View where V: View          // :3310
@inlinable nonisolated public func overlay<S>(_ style: S, ignoresSafeAreaEdges edges: Edge.Set = .all) -> some View where S: ShapeStyle  // :3314
@inlinable nonisolated public func overlay<S,T>(_ style: S, in shape: T, fillStyle: FillStyle = FillStyle()) -> some View where S: ShapeStyle, T: Shape  // :3319
```
**Semantics:** mirror of `background`, but **in front**. `.overlay(RoundedRectangle().stroke(...))` is the idiom for a **rounded border** (since `.border` is rectangular). `overlay(style, in: shape)` paints a shape-clipped fill on top (e.g. a tint wash).

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.overlay(RoundedRectangle(cornerRadius:8).stroke(Color.gray))` | `border: 1px solid var(--sui-color-system-gray); border-radius: 8px` (rounded border idiom) |
| `.overlay(Color.black.opacity(0.2))` | a `::after` layer `background: rgba(0,0,0,.2)` filling 100% |
| `.overlay(alignment:.topTrailing){Badge}` | absolutely-positioned child anchored top-trailing, `z-index:1` |
| `.overlay(.tint, in: Capsule())` | `::after` tint wash clipped to capsule |

`backgroundPreferenceValue`/`overlayPreferenceValue` (`SUICore:8000`/`:7995`) are the preference-driven variants — same CSS, value sourced from a measured preference (handled by the React component's state, not a static style). **React:** `<View overlay={<Border/>} overlayAlignment="topTrailing" />`.

### C.7 `shadow`

**KNOWN** `SUICore:4344`:
```swift
@inlinable nonisolated public func shadow(color: Color = Color(.sRGBLinear, white: 0, opacity: 0.33),
                                          radius: CGFloat, x: CGFloat = 0, y: CGFloat = 0) -> some View
```
**Defaults (KNOWN):** color `rgba(0,0,0,0.33)`, x=0, y=0; **radius has no default** (caller must supply). The `.shadow(_: ShadowStyle)` shape-style form (`SUICore:8553`) and `ShadowStyle.drop(...)` (`:8543`) share the 0.33 color; `ShadowStyle.inner(...)` uses **0.55** opacity (darker inner shadows).

**The radius→blur rule (INFERRED, load-bearing):** CSS blur ≈ **2× SwiftUI radius**. Spread is always 0.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.shadow(radius: 10)` | `box-shadow: 0 0 20px 0 rgba(0,0,0,0.33)` |
| `.shadow(color:c, radius:r, x:dx, y:dy)` | `box-shadow: {dx}px {dy}px {2r}px 0 {c}` |
| `.shadow(.inner(radius:4))` | `box-shadow: inset 0 0 8px rgba(0,0,0,0.55)` |
| named elevations | `shadow.card` `0 1px 8px rgba(0,0,0,.12)` · `shadow.menu` `0 6px 24px rgba(0,0,0,.18)` · `shadow.sheet` `0 10px 40px rgba(0,0,0,.22)` |

Dark mode: bump alpha ~1.6× + add `0 0 0 0.5px rgba(255,255,255,.08)` top hairline. **React:** `<View shadow={{ radius: 10 }} />` · `<View shadow={{ color, radius, x, y }} />`.

---

## Part D — TEXT modifiers (font, weight, design, style, spacing, alignment, case)

These set typography. Every metric references the W1 typography tokens (`--sui-text-*`, `--sui-weight-*`, `--sui-font-*`). Most have a `Text`-returning overload (composes into `Text` directly) and a `some View` overload (environment-level). The CSS is identical.

### D.1 `font` — text style

**KNOWN** `SUICore:16747` (View) / `:12962` (Text):
```swift
@inlinable nonisolated public func font(_ font: Font?) -> some View   // :16747
nonisolated public func font(_ font: Font?) -> Text                   // :12962
```
**Semantics:** sets the font for the subtree. `Font` is usually a `Font.TextStyle` (`.body`, `.headline`, …), `Font.system(size:weight:design:)`, or `Font.custom(...)`. `nil` resets to inherited.

**Web mapping (DESIGNED):** map the TextStyle to its W1 token bundle (size+weight+lineHeight+tracking):
| SwiftUI | CSS |
|---|---|
| `.font(.body)` | `font-size:var(--sui-text-body-size); font-weight:var(--sui-text-body-weight); line-height:var(--sui-text-body-lineHeight); letter-spacing:var(--sui-text-body-tracking)` |
| `.font(.largeTitle)` | the `--sui-text-largeTitle-*` bundle (34px/400/41px/+0.37px) |
| `.font(.headline)` | `--sui-text-headline-*` (17px/**600**/22px/−0.41px) |
| `.font(.caption)` | `--sui-text-caption1-*` (12px/400/16px/0) |
| `.font(.system(size: 20))` | `font-size:20px` (fixed; does NOT scale with Dynamic Type) |
| `.font(.system(size:20, weight:.bold, design:.rounded))` | `font-size:20px; font-weight:700; font-family:var(--sui-font-rounded)` |
| `.font(.custom("Foo", size: 18))` | `font-family:"Foo"; font-size:18px` |

`line-height` MUST be absolute px (not unitless) — matches CoreText fixed leading. **React:** `<Text font="body" />` · `<Text font={{ size:20, weight:'bold', design:'rounded' }} />`.

### D.2 `fontWeight` / `bold` / `italic`

**KNOWN** `SUICore:16758` (fontWeight) / `:19114-area` bold/italic on View & `:12966`/`:12969` on Text:
```swift
nonisolated public func fontWeight(_ weight: Font.Weight?) -> some View   // :16758
nonisolated public func bold() -> Text                                    // :12966
nonisolated public func bold(_ isActive: Bool) -> Text                    // :12968
nonisolated public func italic() -> Text                                  // :12969
nonisolated public func italic(_ isActive: Bool) -> Text                  // :12971
```
**`Font.Weight` cases (KNOWN names; CT values baked):** ultraLight(100) thin(200) light(300) regular(400) medium(500) semibold(600) bold(700) heavy(800) black(900) — CSS numeric per W1 `--sui-weight-*`.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.fontWeight(.semibold)` | `font-weight: var(--sui-weight-semibold)` (600) |
| `.bold()` / `.bold(true)` | `font-weight: 700` (or bump to bolder of current) |
| `.bold(false)` | `font-weight: 400` |
| `.italic()` | `font-style: italic` |
| `.italic(false)` | `font-style: normal` |

`font-synthesis: none` so SF italic/bold use real masters. **React:** `<Text fontWeight="semibold" bold italic />`.

### D.3 `fontDesign` / `fontWidth`

**KNOWN** `SUICore:16770` (design) / `:16761` (width):
```swift
nonisolated public func fontDesign(_ design: Font.Design?) -> some View   // :16770
nonisolated public func fontWidth(_ width: Font.Width?) -> some View       // :16761
```
**`Font.Design` cases (KNOWN):** `.default`(SF Pro) `.serif`(New York) `.rounded`(SF Pro Rounded) `.monospaced`(SF Mono). **`Font.Width`:** `.compressed .condensed .standard .expanded` (variable-font `wdth` axis).

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.fontDesign(.rounded)` | `font-family: var(--sui-font-rounded)` |
| `.fontDesign(.serif)` | `font-family: var(--sui-font-serif)` |
| `.fontDesign(.monospaced)` | `font-family: var(--sui-font-monospaced)` |
| `.fontWidth(.expanded)` | `font-stretch: expanded` (or `font-variation-settings:"wdth" 125`) |
| `.fontWidth(.condensed)` | `font-stretch: condensed` (`"wdth" 75`) |

**React:** `<Text fontDesign="rounded" fontWidth="expanded" />`.

### D.4 `underline` / `strikethrough`

**KNOWN** `SUICore:5909` / `:5912` (View) and `:12981`/`:12978` (Text):
```swift
nonisolated public func underline(_ isActive: Bool = true, pattern: Text.LineStyle.Pattern = .solid, color: Color? = nil) -> some View   // :5909
nonisolated public func strikethrough(_ isActive: Bool = true, pattern: Text.LineStyle.Pattern = .solid, color: Color? = nil) -> some View // :5912
```
**`Text.LineStyle.Pattern`:** `.solid .dot .dash .dashDot .dashDotDot`. Default solid; default color = inherited text color.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.underline()` | `text-decoration-line: underline` |
| `.underline(true, pattern:.dot, color:.red)` | `text-decoration: underline dotted var(--sui-color-system-red)` |
| `.strikethrough()` | `text-decoration-line: line-through` |
| `.strikethrough(true, color:.gray)` | `text-decoration: line-through solid var(--sui-color-system-gray)` |

Pattern map: `.dot→dotted`, `.dash→dashed`, `.solid→solid`. Combine underline+strike → `text-decoration-line: underline line-through`. **React:** `<Text underline strikethrough />` · `<Text underline={{ pattern:'dot', color: Color.red }} />`.

### D.5 `kerning` / `tracking` / `baselineOffset`

**KNOWN** `SUICore:16773` (kerning) / `:16776` (tracking) / `:16779` (baselineOffset):
```swift
nonisolated public func kerning(_ kerning: CGFloat) -> some View          // :16773
nonisolated public func tracking(_ tracking: CGFloat) -> some View        // :16776
nonisolated public func baselineOffset(_ baselineOffset: CGFloat) -> some View  // :16779
```
**Semantics:** `kerning` = fixed spacing added between glyphs (does NOT disable ligatures); `tracking` = same but DISABLES ligatures (use for all-caps display); `baselineOffset` = shift text up (+) / down (−) from baseline (superscript/subscript).

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.kerning(2)` | `letter-spacing: 2px; font-kerning: normal` |
| `.tracking(2)` | `letter-spacing: 2px; font-variant-ligatures: none` |
| `.baselineOffset(4)` | `vertical-align: 4px` (or `position:relative; bottom:4px`) |

**React:** `<Text kerning={2} />` · `<Text tracking={2} />` · `<Text baselineOffset={4} />`.

### D.6 `lineLimit` / `lineSpacing` / `lineHeight` / `multilineTextAlignment`

**KNOWN** `SUICore:8755-8766` (lineLimit family) / `:8505` (lineSpacing) / `:9040` (lineHeight) / `:8497` (multilineTextAlignment):
```swift
@inlinable nonisolated public func lineLimit(_ number: Int?) -> some View                // :8755
nonisolated public func lineLimit(_ limit: PartialRangeFrom<Int>) -> some View           // :8760
nonisolated public func lineLimit(_ limit: PartialRangeThrough<Int>) -> some View        // :8763
nonisolated public func lineLimit(_ limit: ClosedRange<Int>) -> some View                // :8766
@inlinable nonisolated public func lineSpacing(_ lineSpacing: CGFloat) -> some View       // :8505
nonisolated public func lineHeight(_ lineHeight: AttributedString.LineHeight?) -> some View // :9040
@inlinable nonisolated public func multilineTextAlignment(_ alignment: TextAlignment) -> some View // :8497
```
**`TextAlignment` enum (KNOWN `SUICore:16407`):** `case leading / center / trailing`. `lineSpacing` is ADDED to the line's natural leading (not absolute). `lineLimit(2)` caps to 2 lines then truncates.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.lineLimit(1)` | `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` |
| `.lineLimit(2)` | `display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden` |
| `.lineLimit(2...)` (min) | `min-height: calc(2 * var(--lineHeight))` (no clamp) |
| `.lineLimit(nil)` | `-webkit-line-clamp: none; white-space:normal` (unlimited) |
| `.lineSpacing(4)` | `line-height: calc(var(--sui-text-body-lineHeight) + 4px)` (added) |
| `.lineHeight(.fixed(28))` | `line-height: 28px` |
| `.multilineTextAlignment(.center)` | `text-align: center` |
| `.multilineTextAlignment(.leading)` | `text-align: start` (RTL-safe) |
| `.multilineTextAlignment(.trailing)` | `text-align: end` |

**React:** `<Text lineLimit={2} multilineTextAlignment="center" lineSpacing={4} />`.

### D.7 `minimumScaleFactor` / `allowsTightening` / `truncationMode`

**KNOWN** `SUICore:8518` / `:8514` / `:8501`:
```swift
@inlinable nonisolated public func minimumScaleFactor(_ factor: CGFloat) -> some View   // :8518
@inlinable nonisolated public func allowsTightening(_ flag: Bool) -> some View           // :8514
@inlinable nonisolated public func truncationMode(_ mode: Text.TruncationMode) -> some View  // :8501
```
**`Text.TruncationMode` enum (KNOWN `SUICore:8433`):** `case head / tail / middle`. `minimumScaleFactor(0.5)` lets text shrink to 50% to fit before truncating. `allowsTightening` lets glyphs squeeze (reduce inter-letter) to fit one line.

**Web mapping (DESIGNED):**
| SwiftUI | CSS / JS |
|---|---|
| `.truncationMode(.tail)` | `text-overflow: ellipsis` (default; ellipsis at end) |
| `.truncationMode(.head)` | `direction:rtl; text-overflow:ellipsis` trick OR JS-measure prefix-ellipsis |
| `.truncationMode(.middle)` | no native CSS — JS-measure: trim middle, insert `…` (DESIGNED helper) |
| `.minimumScaleFactor(0.5)` | no native CSS — JS/ResizeObserver shrink `font-size` down to 0.5× until fit (DESIGNED helper) |
| `.allowsTightening(true)` | `letter-spacing: -0.02em` fallback when overflowing (approximation) |

`minimumScaleFactor` and `.middle` truncation need a JS fit helper; `.tail` is pure CSS. **React:** `<Text minimumScaleFactor={0.5} truncationMode="middle" allowsTightening />`.

### D.8 `textCase` / `monospaced` / `monospacedDigit` / `textScale`

**KNOWN** `SUICore:8523` (textCase) / `:12973` (monospaced Text) / `:16752` (monospacedDigit View) / `:13022` (textScale View):
```swift
@inlinable nonisolated public func textCase(_ textCase: Text.Case?) -> some View   // :8523
nonisolated public func monospaced(_ isActive: Bool = true) -> Text                // :12973
nonisolated public func monospacedDigit() -> some View                             // :16752
nonisolated public func textScale(_ scale: Text.Scale, isEnabled: Bool = true) -> some View  // :13022
```
**`Text.Case` enum (KNOWN `SUICore:8444`):** `case uppercase / lowercase`. **`Text.Scale`:** `.default .secondary` (secondary renders ~smaller, e.g. currency symbols). `monospacedDigit` = tabular figures only (proportional letters stay).

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.textCase(.uppercase)` | `text-transform: uppercase` |
| `.textCase(.lowercase)` | `text-transform: lowercase` |
| `.textCase(nil)` | `text-transform: none` |
| `.monospaced()` | `font-family: var(--sui-font-monospaced)` |
| `.monospacedDigit()` | `font-variant-numeric: tabular-nums; font-feature-settings:"tnum"` |
| `.textScale(.secondary)` | `font-size: 0.8em` (approx; the de-rated companion scale) |

`textCase(.uppercase)` is the SwiftUI default for grouped-list **section headers** — the kit's `<Section>` header applies it automatically. **React:** `<Text textCase="uppercase" monospacedDigit />`.

### D.9 `typesettingLanguage` / `writingDirection` / `textSelection` / `textSelectionAffinity`

Tabulated (rarely-visual / locale): `typesettingLanguage` → `lang=""` attr (controls hyphenation/line-break rules); `writingDirection` → `direction: rtl/ltr` + `unicode-bidi`; `textSelection(.enabled/.disabled)` → `user-select: text/none`; `textSelectionAffinity` → caret-placement, no CSS analog (native only).

---

## Part E — STATE / VISIBILITY modifiers (opacity, hidden, disabled, redacted, hit-testing, contentShape)

### E.1 `opacity`

**KNOWN** `SUICore:4206`: `@inlinable nonisolated public func opacity(_ opacity: Double) -> some View`. Range `0.0…1.0`; affects the whole subtree (composited as a group — children's overlaps don't double-darken because SwiftUI flattens then applies alpha, like CSS `opacity` on a stacking context).

**Web mapping (DESIGNED):** `opacity: {value}`. **React:** `<View opacity={0.5} />`.

### E.2 `hidden`

**KNOWN** `SUI:19114`: `@inlinable nonisolated public func hidden() -> some View`. **Semantics:** the view is invisible but **keeps its layout space** (siblings don't move) — this is CSS `visibility:hidden`, NOT `display:none`.

**Web mapping (DESIGNED):** `visibility: hidden` (preserves space). To remove from layout use conditional rendering, not `.hidden()`. **React:** `<View hidden />`.

### E.3 `disabled`

**KNOWN** `SUICore:202`: `@inlinable nonisolated public func disabled(_ disabled: Bool) -> some View`. Sets the `\.isEnabled` environment to false for the subtree; controls render dimmed and stop accepting input. Disabled appearance is typically ~0.3–0.4 opacity + no pointer events.

**Web mapping (DESIGNED):**
```css
[data-disabled="true"] { opacity: 0.35; pointer-events: none; cursor: default; }
```
Plus the native `disabled` attribute on form elements (`<button disabled>`). The `opacity 0.35` matches the iOS dimmed-control look (DESIGNED; calibrate). **React:** `<Button disabled />` → sets `disabled` attr + `data-disabled`.

### E.4 `redacted` / `unredacted` / `privacySensitive` / `invalidatableContent`

**KNOWN** `SUICore:6110` / `:6112` / `:2802`:
```swift
nonisolated public func redacted(reason: RedactionReasons) -> some View   // :6110
nonisolated public func unredacted() -> some View                          // :6112
nonisolated public func privacySensitive(_ sensitive: Bool = true) -> some View  // :2802
```
**`RedactionReasons` option set:** `.placeholder` (skeleton/shimmer), `.privacy` (redact sensitive content, e.g. on lock screen), `.invalidated`. `unredacted()` opts a subtree back in.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.redacted(reason:.placeholder)` | replace text/image with a `color: transparent` + `background: var(--sui-color-quaternary-fill); border-radius:4px` skeleton bar; optional shimmer keyframe |
| `.redacted(reason:.privacy)` | `filter: blur(8px)` or solid redaction bars |
| `.unredacted()` | reset to normal rendering |
| `.privacySensitive()` | tag for `.privacy` redaction in privacy contexts |

`.placeholder` skeleton is the loading-state primitive — the kit ships a `<Redacted>` wrapper with a shimmer (1.5s linear gradient sweep). **React:** `<View redacted="placeholder" />`.

### E.5 `allowsHitTesting` / `contentShape` / `containerShape`

**KNOWN** `SUICore:16632` (allowsHitTesting) / `:13050`/`:13135` (contentShape) / `:13382`-area (containerShape):
```swift
@inlinable nonisolated public func allowsHitTesting(_ enabled: Bool) -> some View   // :16632
@inlinable nonisolated public func contentShape<S>(_ shape: S, eoFill: Bool = false) -> some View where S: Shape  // :13050
@inlinable nonisolated public func contentShape<S>(_ kind: ContentShapeKinds, _ shape: S, eoFill: Bool = false) -> some View where S: Shape  // :13135
```
**Semantics:** `allowsHitTesting(false)` makes the view transparent to taps (events pass through). `contentShape(_:)` redefines the **hit-test region** to a shape (e.g. make a padded `HStack` fully tappable, or restrict tap to a circle). `ContentShapeKinds`: `.interaction .hoverEffect .contextMenuPreview .dragPreview .focusEffect …`. `containerShape` sets the shape that `ContainerRelativeShape` children inherit.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.allowsHitTesting(false)` | `pointer-events: none` |
| `.allowsHitTesting(true)` | `pointer-events: auto` |
| `.contentShape(Rectangle())` | ensure full box is hit: set a background (even `transparent`) so the whole padded area receives events |
| `.contentShape(Circle())` | `clip-path: circle(50%)` on a hit-overlay, or restrict `pointer-events` via SVG hit area |
| `.containerShape(RoundedRectangle(cornerRadius:16))` | set `--sui-container-radius: 16px` for `ContainerRelativeShape` children |

For `contentShape(Rectangle())` on a transparent `HStack`, the fix is simply giving the element `background: transparent` is not enough in CSS (transparent still receives events if it has a background set; an element with no background already receives events on its box) — in practice the element box already captures events, so this mostly maps to ensuring the element isn't `pointer-events:none`. **React:** `<View allowsHitTesting={false} contentShape="rectangle" />`.

---

## Part F — TRANSFORM modifiers (rotation, scale, 3D, projection, affine)

All compile into a single CSS `transform` string (the compiler concatenates `offset` + scale + rotate). Anchor → `transform-origin`.

### F.1 `rotationEffect`

**KNOWN** `SUICore:1609`:
```swift
@inlinable nonisolated public func rotationEffect(_ angle: Angle, anchor: UnitPoint = .center) -> some View
```
**Semantics:** 2D rotation about `anchor` (default center). `Angle` is `.degrees(_)` or `.radians(_)`. Layout slot is preserved (visual-only, like `offset`).

**Web mapping (DESIGNED):** `transform: rotate({angle}deg); transform-origin: {anchor.x*100}% {anchor.y*100}%`. **UnitPoint** table (shapes-effects §4.1): center=(.5,.5), topLeading=(0,0), bottomTrailing=(1,1). **React:** `<View rotationEffect={{ degrees: 45, anchor:'topLeading' }} />`.

### F.2 `scaleEffect`

**KNOWN** `SUICore:18738` / `:18742` / `:18746`:
```swift
@inlinable nonisolated public func scaleEffect(_ scale: CGSize, anchor: UnitPoint = .center) -> some View  // :18738
@inlinable nonisolated public func scaleEffect(_ s: CGFloat, anchor: UnitPoint = .center) -> some View      // :18742
@inlinable nonisolated public func scaleEffect(x: CGFloat = 1.0, y: CGFloat = 1.0, anchor: UnitPoint = .center) -> some View  // :18746
```
**Semantics:** scales the rendering about `anchor`. Negative scale flips. Layout slot preserved. The press-down button animation is `.scaleEffect(0.96)` on press.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.scaleEffect(0.96)` | `transform: scale(0.96); transform-origin: 50% 50%` |
| `.scaleEffect(x:2, y:1)` | `transform: scale(2, 1)` |
| `.scaleEffect(1.2, anchor:.bottomLeading)` | `transform: scale(1.2); transform-origin: 0% 100%` |

**React:** `<View scaleEffect={0.96} />` · `<View scaleEffect={{ x:2, y:1, anchor:'center' }} />`.

### F.3 `rotation3DEffect`

**KNOWN** `SUICore:4098`:
```swift
@inlinable nonisolated public func rotation3DEffect(_ angle: Angle,
    axis: (x: CGFloat, y: CGFloat, z: CGFloat),
    anchor: UnitPoint = .center, anchorZ: CGFloat = 0, perspective: CGFloat = 1) -> some View
```
**Defaults (KNOWN):** anchor `.center`, anchorZ `0`, perspective `1`. Rotates in 3D about the given axis vector. `perspective` controls the foreshortening (smaller = more dramatic).

**Web mapping (DESIGNED):**
```css
/* perspective applied on the element's transform; SwiftUI perspective p ≈ 1/(distance) */
transform: perspective({1/perspective * 1000}px) rotate3d({x}, {y}, {z}, {angle}deg);
transform-origin: {anchor.x*100}% {anchor.y*100}%;
```
SwiftUI's `perspective:1` ≈ CSS `perspective: 1000px` (DESIGNED calibration). A `rotation3DEffect(.degrees(60), axis:(0,1,0))` (Y-axis flip) → `transform: perspective(1000px) rotate3d(0,1,0,60deg)`. **React:** `<View rotation3DEffect={{ degrees:60, axis:[0,1,0], perspective:1 }} />`.

### F.4 `transformEffect` / `projectionEffect`

**KNOWN** `SUICore:6488`:
```swift
@inlinable nonisolated public func transformEffect(_ transform: CGAffineTransform) -> some View
```
`projectionEffect(_ ProjectionTransform)` applies a 3×3 projective matrix (the `_BackdropEffect` / private form). `CGAffineTransform{a,b,c,d,tx,ty}`.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.transformEffect(CGAffineTransform(a,b,c,d,tx,ty))` | `transform: matrix({a},{b},{c},{d},{tx},{ty})` |
| `.projectionEffect(ProjectionTransform(m))` | `transform: matrix3d(...)` (3×3 → 4×4 expansion) |

CGAffineTransform maps **1:1** to CSS `matrix()` (same column order a,b,c,d,tx,ty). **React:** `<View transformEffect={[a,b,c,d,tx,ty]} />`.

### F.5 Visual-effect filters (colorInvert, hueRotation, saturation, contrast, brightness, grayscale, blur, colorMultiply, colorMonochrome, luminanceToAlpha, blendMode)

These are `SUICore` filter modifiers that all map to CSS `filter` / `mix-blend-mode`:

**KNOWN signatures:** `colorInvert()` `:3782` · `hueRotation(_:Angle)` `:19493` · `saturation(_:Double)` `:16379` · `contrast(_:Double)` `:2831` · `brightness(_:Double)` `:4438` · `grayscale(_:Double)` `:3956` · `blur(radius:opaque:)` `:3704` · `colorMultiply(_:Color)` `:17235` · `luminanceToAlpha()` `:9872` · `blendMode(_:BlendMode)` `:2618`.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.opacity(x)` | `opacity: x` (see E.1) |
| `.blur(radius: r)` | `filter: blur({r}px)` |
| `.brightness(a)` | `filter: brightness({1+a})` (SwiftUI a is additive offset; CSS is multiplier → `1+a`) |
| `.contrast(a)` | `filter: contrast({a})` |
| `.saturation(a)` | `filter: saturate({a})` |
| `.grayscale(a)` | `filter: grayscale({a})` |
| `.hueRotation(.degrees(d))` | `filter: hue-rotate({d}deg)` |
| `.colorInvert()` | `filter: invert(1)` |
| `.colorMultiply(.red)` | `mix-blend-mode: multiply` over a tint layer, or `filter`+overlay (approx) |
| `.luminanceToAlpha()` | SVG `<feColorMatrix type="luminanceToAlpha">` filter |
| `.blendMode(.multiply)` | `mix-blend-mode: multiply` |
| `_colorMonochrome` (private) | `filter: grayscale(1) sepia(...)` tint approx |
| `_colorMatrix` (private) | SVG `<feColorMatrix>` |

**Note on `brightness`:** SwiftUI `brightness(0.2)` ADDS 0.2 to each channel (offset), so CSS `brightness(1.2)` is the closest multiplicative match (DESIGNED approximation; for exactness use `<feComponentTransfer>` with a linear offset). Multiple filters concatenate in one `filter:` string. **React:** `<View blur={4} saturation={1.5} blendMode="multiply" />`.

### F.6 `compositingGroup` / `drawingGroup` / `geometryGroup` / `luminanceToAlpha`

**KNOWN** `SUICore:5480` (compositingGroup) / `:4398` (drawingGroup) / `:4471` (geometryGroup):
```swift
@inlinable nonisolated public func compositingGroup() -> some View   // :5480
nonisolated public func drawingGroup(opaque: Bool = false, colorMode: ColorRenderingMode = .nonLinear) -> some View  // :4398
@_alwaysEmitIntoClient nonisolated public func geometryGroup() -> some View   // :4471
```
**Semantics:** `compositingGroup` flattens the subtree into one layer before applying opacity/blend (prevents overlap artifacts) — CSS: forces a stacking context (`isolation: isolate` or `transform: translateZ(0)`). `drawingGroup` rasterizes the subtree into an offscreen Metal texture (perf) — CSS: `will-change: transform` / `transform: translateZ(0)` GPU layer. `geometryGroup` isolates geometry for animation — CSS: `contain: layout`.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.compositingGroup()` | `isolation: isolate` |
| `.drawingGroup()` | `will-change: transform; transform: translateZ(0)` (GPU layer) |
| `.geometryGroup()` | `contain: layout paint` |

**React:** `<View compositingGroup />` · `<View drawingGroup />`.

---

## Part G — CONTROL modifiers (controlSize, labels, imageScale, symbol rendering, color scheme)

These configure controls/symbols via the environment. Style modifiers (`buttonStyle`, `toggleStyle`, `pickerStyle`, …) are cross-referenced to **C15 (controls)** — listed in Part H.

### G.1 `controlSize`

**KNOWN** `SUICore:6171` / `:6176`:
```swift
@inlinable nonisolated public func controlSize(_ controlSize: ControlSize) -> some View   // :6171
nonisolated public func controlSize<T>(_ range: T) -> some View where T: RangeExpression, T.Bound == ControlSize  // :6176
```
**`ControlSize` enum (KNOWN):** `.mini .small .regular(default) .large .extraLarge`. Sets the size class for all controls in the subtree. Per-size iOS metrics (INFERRED, spacing.md §5.2):

| ControlSize | Height | H-pad | V-pad | Font | radius |
|---|---|---|---|---|---|
| `.mini` | 24px | 8 | 3 | 11px (caption) | 5px |
| `.small` | 28px | 10 | 4 | 13px (footnote) | 6px |
| `.regular` | 34px | 14 | 7 | 15px | 7–8px |
| `.large` | 50px | 20 | 12 | 17px (body) | 10–12px |
| `.extraLarge` | 56px | 24 | 15 | 17px | 12px |

**Web mapping (DESIGNED):** set a CSS attribute `data-control-size` on the subtree; controls read the metric bundle:
```css
[data-control-size="small"]  { --ctl-h:28px; --ctl-padx:10px; --ctl-pady:4px; --ctl-font:13px; --ctl-radius:6px; }
[data-control-size="regular"]{ --ctl-h:34px; --ctl-padx:14px; --ctl-pady:7px; --ctl-font:15px; --ctl-radius:8px; }
[data-control-size="large"]  { --ctl-h:50px; --ctl-padx:20px; --ctl-pady:12px;--ctl-font:17px; --ctl-radius:12px; }
```
**These are CALIBRATE values** (Apple computes in private layout). **React:** `<View controlSize="large" />` → sets `data-control-size`.

### G.2 `labelsHidden` / `labelStyle` / `labelsVisibility`

**KNOWN** `SUI:12450` (labelsHidden) / `:23880` (labelStyle):
```swift
nonisolated public func labelsHidden() -> some View                                 // :12450
nonisolated public func labelStyle<S>(_ style: S) -> some View where S: LabelStyle   // :23880
```
**Semantics:** `labelsHidden()` hides a control's text label while keeping it for accessibility (e.g. a Toggle/Picker with only the value visible). `LabelStyle`: `.automatic .titleAndIcon .iconOnly .titleOnly` — controls whether a `Label`'s icon+title both show.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.labelsHidden()` | label element `position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0)` (visually-hidden, screen-reader visible) |
| `.labelStyle(.iconOnly)` | hide `.label-title`, show `.label-icon` |
| `.labelStyle(.titleOnly)` | hide `.label-icon`, show `.label-title` |
| `.labelStyle(.titleAndIcon)` | show both (default; icon then 4–6px gap then title) |

**React:** `<Toggle labelsHidden />` · `<Label labelStyle="iconOnly" />`.

### G.3 `imageScale`

**KNOWN** `SUICore:16743`: `@inlinable nonisolated public func imageScale(_ scale: Image.Scale) -> some View`. **`Image.Scale` enum (KNOWN `SUICore:16670`):** `.small .medium .large`. Scales SF Symbols and resizable images relative to the surrounding text. Default `.medium`.

**Web mapping (DESIGNED):** map to an em-relative symbol size:
| Scale | CSS |
|---|---|
| `.small` | `font-size: 0.85em` (on the symbol element) |
| `.medium` | `font-size: 1.0em` (default) |
| `.large` | `font-size: 1.2em` |

SF Symbols rendered as a font/SVG sized in `em` track the text. **React:** `<Image imageScale="large" />`.

### G.4 `symbolRenderingMode` / `symbolVariant` / `symbolColorRenderingMode` / `symbolVariableValueMode`

**KNOWN** `SUICore:6790` (renderingMode) / `:15301` (variant):
```swift
@inlinable nonisolated public func symbolRenderingMode(_ mode: SymbolRenderingMode?) -> some View  // :6790
nonisolated public func symbolVariant(_ variant: SymbolVariants) -> some View                       // :15301
```
**`SymbolRenderingMode` (KNOWN `SUICore:6778`):** static lets `.monochrome .multicolor .hierarchical .palette`. **`SymbolVariants` (KNOWN `SUICore:15266`):** `.none .circle .square .rectangle .fill .slash` (composable, e.g. `.fill.circle`).

**Web mapping (DESIGNED — SF Symbols rendered as multi-layer SVG):**
| SwiftUI | CSS / SVG |
|---|---|
| `.symbolRenderingMode(.monochrome)` | all SVG layers `fill: currentColor` |
| `.symbolRenderingMode(.hierarchical)` | layers get `currentColor` at descending opacity (1.0 / 0.5 / 0.25 — the hierarchy multipliers) |
| `.symbolRenderingMode(.palette)` | each layer takes one of N supplied `foregroundStyle` colors |
| `.symbolRenderingMode(.multicolor)` | use the symbol's intrinsic colors (SVG keeps original fills) |
| `.symbolVariant(.fill)` | swap to the `.fill` glyph variant (different SVG/glyph) |
| `.symbolVariant(.circle)` | swap to circled variant |

The kit selects the SVG asset by variant name and applies per-layer fills by rendering mode. **React:** `<Image symbolRenderingMode="hierarchical" symbolVariant="fill" />`.

### G.5 `colorScheme` / `preferredColorScheme` / `tint` color-scheme / `dynamicTypeSize`

**KNOWN** `SUICore:18435` (colorScheme) / `:18498` (preferredColorScheme) / `:11747` (dynamicTypeSize):
```swift
@inlinable nonisolated public func colorScheme(_ colorScheme: ColorScheme) -> some View         // :18435 (deprecated → preferredColorScheme)
@inlinable nonisolated public func preferredColorScheme(_ colorScheme: ColorScheme?) -> some View // :18498
nonisolated public func dynamicTypeSize(_ size: DynamicTypeSize) -> some View                    // :11747
nonisolated public func dynamicTypeSize<T>(_ range: T) -> some View where T: RangeExpression       // :11749
```
**`ColorScheme`:** `.light .dark`. **`DynamicTypeSize`:** `.xSmall … .xxxLarge .accessibility1 … .accessibility5` (12 cases). `preferredColorScheme` forces the subtree's appearance; `dynamicTypeSize` overrides/clamps the text-size category.

**Web mapping (DESIGNED):**
| SwiftUI | CSS |
|---|---|
| `.preferredColorScheme(.dark)` | add `.dark` class (or `[data-scheme="dark"]`) on subtree → flips `--sui-color-*` vars to dark column |
| `.colorScheme(.light)` | `.light` class on subtree |
| `.dynamicTypeSize(.large)` | set `--sui-type-scale: 1.0` (Large = baseline) |
| `.dynamicTypeSize(.accessibility3)` | `--sui-type-scale: 1.6` (text sizes × scale) |
| `.dynamicTypeSize(...DynamicTypeSize.accessibility1)` (clamp max) | clamp `--sui-type-scale ≤ 1.35` |

Dynamic Type scale factors (INFERRED, iOS table): xSmall 0.82, Small 0.88, Medium 0.94, **Large 1.0 (default)**, xLarge 1.12, xxLarge 1.23, xxxLarge 1.35, accessibility1 1.6, …accessibility5 ~3.1. The kit multiplies `font-size` by `var(--sui-type-scale)`. **React:** `<View preferredColorScheme="dark" dynamicTypeSize="large" />`.

### G.6 `scenePadding` / `headerProminence` / `badgeProminence` / `controlGroupStyle`(→C15)

`scenePadding` covered in B.12. `headerProminence(.increased)` → larger/bolder section header (`font-weight` bump + larger size). `badgeProminence(.increased/.standard/.decreased)` → badge visual weight. These are environment toggles; CSS = swap a header/badge utility class.

---

## Part H — Long-tail modifier tabulation (every remaining `modifiers` entry)

The ~445-entry `modifiers` array contains many entries that are **not visual styling** — they are behavior (gestures, events, tasks), navigation/presentation (sheets, toolbars), accessibility, scene/window config, or **style-selector** modifiers whose actual rendering lives in the cluster that owns that control (C15). They still must be accounted for. Below: every remaining modifier, grouped, with one-line purpose + web target. Modifiers already deep-covered in Parts B–G are **not** repeated. **CR=** cross-reference to owning cluster.

### H.1 Control / element STYLE selectors → CSS = swap the component's style class (own cluster: C15 controls)
| Modifier | Sets style of | Web target |
|---|---|---|
| `buttonStyle` | Button | class: `.sui-btn--{bordered\|borderedProminent\|plain\|borderless}` (CR C15) |
| `buttonBorderShape` | Button border | `border-radius`: automatic→8px, capsule→9999px, circle→50%, roundedRectangle→r |
| `buttonSizing` | Button sizing | flexible/fitted width class |
| `buttonRepeatBehavior` | Button hold-repeat | JS repeat timer (no CSS) |
| `menuButtonStyle` / `menuStyle` | Menu | menu chrome class (CR C15) |
| `toggleStyle` | Toggle | `.sui-toggle--{switch\|checkbox\|button}` (CR C15) |
| `pickerStyle` | Picker | `.sui-picker--{segmented\|wheel\|menu\|inline}` (CR C15) |
| `datePickerStyle` | DatePicker | style class (CR C15) |
| `textFieldStyle` | TextField | `.sui-field--{roundedBorder\|plain}` (CR C15) |
| `textEditorStyle` | TextEditor | style class |
| `gaugeStyle` | Gauge | `.sui-gauge--{linear\|circular\|accessory}` (CR C15) |
| `progressViewStyle` | ProgressView | `.sui-progress--{linear\|circular}` (CR C15) |
| `labelStyle` | Label | covered G.2 |
| `labeledContentStyle` | LabeledContent | row layout class |
| `groupBoxStyle` | GroupBox | card chrome class |
| `controlGroupStyle` | ControlGroup | segmented container class |
| `formStyle` | Form | `.sui-form--{grouped\|columns}` (CR C15) |
| `listStyle` | List | `.sui-list--{plain\|grouped\|insetGrouped\|sidebar}` (CR C15) — drives row insets/separators/section radius |
| `tableStyle` | Table | table chrome class |
| `disclosureGroupStyle` | DisclosureGroup | expander class |
| `navigationSplitViewStyle` / `navigationViewStyle` | NavSplitView | column layout class |
| `tabViewStyle` | TabView | `.sui-tabs--{automatic\|page\|sidebarAdaptable}` (CR C-navigation) |
| `indexViewStyle` | page dots | dot indicator class |
| `menuIndicator` | Menu chevron | show/hide `::after` chevron |
| `menuOrder` | Menu item order | `flex-direction` / priority |
| `menuActionDismissBehavior` | Menu dismiss | JS behavior |
| `presentedWindowStyle` / `presentedWindowToolbarStyle` | Window | n/a web (no windows) |
| `pointerStyle` | macOS pointer | `cursor:` map (e.g. `.link`→pointer) |
| `pointerVisibility` | pointer hide | `cursor:none` |

### H.2 Background / material / scroll appearance → real CSS styling
| Modifier | Purpose | Web target |
|---|---|---|
| `containerBackground` | container surface | `background` on container (materials.md) |
| `scrollContentBackground` | List/ScrollView bg | `.hidden`→`background:transparent` on list |
| `presentationBackground` | sheet backdrop | sheet `background`/material |
| `presentationCornerRadius` | sheet corners | `border-radius` top corners (10–16px) |
| `listItemTint` / `listRowBackground` / `listRowPlatterColor` | row fill | row `background-color` |
| `listRowSeparatorTint` / `listSectionSeparatorTint` | separator color | separator `border-color` |
| `listRowSeparator` / `listSectionSeparator` | separator vis | `border-bottom` show/hide |
| `listRowInsets` | row content inset | row `padding` (default 16px lead) |
| `listRowSpacing` / `listSectionSpacing` / `listSectionMargins` | list gaps | `gap` / section `margin` |
| `alternatingRowBackgrounds` | zebra rows | `:nth-child(even){background:...}` |
| `backgroundStyle` | env fill | covered C.3 |
| `backgroundExtensionEffect` | bg bleed | extend `background` under bars |
| `toolbarBackground` / `toolbarBackgroundVisibility` | bar bg | toolbar `background` + material |
| `scrollIndicators` / `scrollIndicatorsFlash` | scrollbar vis | `scrollbar-width` / `::-webkit-scrollbar` show/hide |
| `scrollEdgeEffectStyle` / `scrollEdgeEffectHidden` | edge fade | `mask-image` edge gradient |
| `scrollBounceBehavior` | overscroll | `overscroll-behavior` |
| `scrollClipDisabled` | clip off | `overflow: visible` |
| `_addingBackgroundGroup` / `_addingBackgroundLayer` / `_BackdropEffect` | private bg | extra bg layer |
| `preferredSurroundingsEffect` | visionOS dimming | n/a web |
| `sliderThumbVisibility` | slider knob | thumb `opacity`/visibility |

### H.3 Layout-detail / grid / scroll-target modifiers → CSS
| Modifier | Purpose | Web target |
|---|---|---|
| `alignmentGuide` | custom alignment | fl/grid offset (JS-measured) |
| `coordinateSpace` | named coord space | `position:relative` named container |
| `gridCellAnchor` / `gridCellColumns` / `gridCellUnsizedAxes` / `gridColumnAlignment` | Grid cell | `grid-column: span N` + `justify-self`/`align-self` |
| `layoutValue` / `_LayoutTrait` | layout trait | per-child layout data |
| `layoutPriority` | covered B.6 | flex-grow/shrink |
| `layoutDirectionBehavior` / `flipsForRightToLeftLayoutDirection` | RTL mirror | `transform: scaleX(-1)` under `[dir=rtl]` |
| `scrollTargetLayout` / `scrollTargetBehavior` | snap | `scroll-snap-type` on container, `scroll-snap-align` on children |
| `scrollPosition` / `defaultScrollAnchor` | scroll offset | JS `scrollTo` / `scroll-snap` anchor |
| `contentMargins` | scroll content inset | `padding` / `scroll-padding` |
| `defaultWheelPickerItemHeight` | wheel row h | item `height` |
| `containerCornerOffset` / `_containerShape` / `containerShape` | container corner | `--sui-container-radius` (covered E.5) |
| `containerRelativeFrame` | covered B.11 | container query units |
| `navigationSplitViewColumnWidth` / `inspectorColumnWidth` | column w | `width`/`min/max-width` of column |
| `scenePadding` | covered B.12 | reading margin |
| `safeAreaBar` | docked bar | safe-area bar (like B.12) |

### H.4 Symbol / image / animation appearance → CSS/JS
| Modifier | Purpose | Web target |
|---|---|---|
| `symbolRenderingMode` / `symbolVariant` | covered G.4 | per-layer SVG fill |
| `symbolColorRenderingMode` / `symbolVariableValueMode` | gradient/flat layers, variable value | SVG fill mode / partial-fill % |
| `symbolEffect` / `symbolEffectsRemoved` | animated symbols | CSS keyframes (bounce/pulse/variableColor) |
| `imageScale` | covered G.3 | `font-size` em |
| `allowedDynamicRange` | HDR image | n/a web (SDR) |
| `colorEffect` / `distortionEffect` / `layerEffect` | Metal shaders | SVG filter / CSS filter approx (no shader) |
| `invalidatableContent` | redraw hint | re-render trigger (no CSS) |
| `interactiveDismissDisabled` | block swipe-down | JS prevent dismiss gesture |

### H.5 Accessibility modifiers → ARIA (no visual CSS)
All map to ARIA attributes / `aria-*`, not styling. Tabulated as a block:
`accessibilityLabel`→`aria-label` · `accessibilityActions`/`accessibilityAction`→custom actions · `accessibilityRotor`/`accessibilityRotorEntry`→landmark nav · `accessibilityChildren`/`accessibilityRepresentation`/`accessibilityElement`→`role`+grouping · `accessibilityLabeledPair`/`accessibilityLinkedGroup`→`aria-labelledby` · `accessibilityShowsLargeContentViewer`→large-content tooltip · `accessibilityChartDescriptor`→chart a11y · `accessibilityQuickAction`→quick action · `accessibilityIgnoresInvertColors`→`filter` opt-out · `accessibilityDefaultFocus`/`accessibilityFocused`→`autofocus`/focus mgmt · `speechAdjustedPitch`/`speechAlwaysIncludesPunctuation`/`speechAnnouncementsQueued`/`speechSpellsOutCharacters`→`aria-live`/SSML (no CSS) · `upperLimbVisibility`/`supportedVolumeViewpoints`/`onVolumeViewpointChange`→visionOS (n/a web).

### H.6 Behavior / events / lifecycle → JS handlers (no CSS)
Tabulated block (React event props / effects, not styling):
`onAppear`/`onDisappear`→mount/unmount effect · `onChange`/`_onBindingChange`/`_onEnvironmentChange`→state effect · `task`/`refreshable`→async effect / pull-to-refresh · `onReceive`/`onOpenURL`/`onContinueUserActivity`/`userActivity`/`handlesExternalEvents`→subscribers · `onSubmit`/`submitScope`/`submitLabel`→form submit · `onGeometryChange`/`onScrollGeometryChange`/`onScrollTargetVisibilityChange`/`onScrollVisibilityChange`/`onInteractiveResizeChange`/`onImmersionChange`/`onWorldRecenter`/`onModifierKeysChanged`/`onPencilSqueeze`→ResizeObserver/IntersectionObserver/event listeners · `keyboardShortcut`/`onCommand`/`onCopyCommand`/`onCutCommand`/`onPasteCommand`/`onDeleteCommand`/`onExitCommand`/`onPlayPauseCommand`/`pageCommand`→keydown handlers · `sensoryFeedback`→`navigator.vibrate` · `focusable`/`focused`/`focusEffectDisabled`/`focusScope`/`focusSection`/`defaultFocus`/`prefersDefaultFocus`/`_prefersDefaultFocus`/`searchFocused`/`accessibilityFocused`→`tabindex`/focus mgmt (focus-ring CSS in shapes-effects §2.4) · `digitalCrownRotation`/`digitalCrownAccessory`→watchOS (n/a) · `allowsWindowActivationEvents`/`allowsHitTesting`(covered)/`selectionDisabled`/`moveDisabled`/`deleteDisabled`/`replaceDisabled`/`findDisabled`→interaction enable flags.

### H.7 Presentation / navigation / toolbar → owned by C-navigation/C-presentation (not styling)
Tabulated block: `sheet`/`_cover`/`fullScreenCover`/`popover`/`alert`/`confirmationDialog`/`actionSheet`/`inspector`→overlay presentation (CR C-presentation) · `presentationDetents`/`presentationDragIndicator`/`presentationBackgroundInteraction`/`presentationCompactAdaptation`/`presentationContentInteraction`/`presentationSizing`/`presentationPreventsAppTermination`→sheet config · `toolbar`/`toolbarItemHidden`/`toolbarRole`/`toolbarVisibility`/`toolbarColorScheme`/`toolbarForegroundStyle`/`toolbarTitleMenu`/`toolbarTitleDisplayMode`/`contentToolbar`/`tableColumnHeaders`→toolbar (CR C-navigation) · `navigationTitle`/`navigationSubtitle`/`navigationBarTitleDisplayMode`/`navigationBarHidden`/`navigationBarBackButtonHidden`/`navigationBarItems`/`navigationBarTitle`/`navigationDestination`/`_navigationDestination`/`navigationDocument`/`navigationLinkIndicatorVisibility`/`navigationSplitViewColumnWidth`→nav (CR C-navigation) · `searchable`/`searchScopes`/`searchSuggestions`/`searchCompletion`/`searchPresentationToolbarBehavior`/`searchToolbarBehavior`/`searchDictationBehavior`/`searchSelection`/`textInputSuggestions`/`textInputCompletion`/`textInputFormattingControlVisibility`→search (CR C-navigation) · `contextMenu`/`swipeActions`/`sectionActions`/`renameAction`/`dismissalConfirmationDialog`→contextual actions · `tabItem`/`tabViewBottomAccessory`/`tabViewSidebarHeader`/`tabViewSidebarFooter`/`tabViewSidebarBottomBar`/`tabViewSearchActivation`/`tabViewCustomization`/`tabBarMinimizeBehavior`/`defaultAdaptableTabBarPlacement`→tabs · `ornament`/`touchBar`/`touchBarItemPresence`/`touchBarItemPrincipal`/`touchBarCustomizationLabel`→ornament/touchbar (n/a web) · `badge`→count bubble (visual: pill, `--sui-color-system-red` bg, white caption2 text) · `help`→`title=""` tooltip.

### H.8 Environment / preference / data plumbing → React context/state (no CSS)
Tabulated: `environment`/`environmentObject`/`transformEnvironment`/`_defaultContext`/`focusedValue`/`focusedObject`/`focusedSceneValue`/`focusedSceneObject`→React context · `preference`/`transformPreference`/`anchorPreference`/`transformAnchorPreference`/`onPreferenceChange`/`backgroundPreferenceValue`/`overlayPreferenceValue`→preference up-pass (measured, drives positioned overlays) · `transaction`→animation transaction (wraps state change with `Animation`) · `id`/`tag`/`_untagged`/`_identified`/`_trait`/`containerValue`/`matchedGeometryEffect`→identity (matchedGeometry → FLIP/`view-transition-name`) · `interactionActivityTrackingTag`/`contentCaptureProtected`/`privacySensitive`(covered)→privacy/telemetry · `previewContext`/`previewDevice`/`previewDisplayName`/`previewInterfaceOrientation`/`previewLayout`→Xcode preview (n/a runtime) · `textRenderer`/`attributedTextFormattingDefinition`/`typeSelectEquivalent`/`textContentType`/`autocorrectionDisabled`/`disableAutocorrection`/`writingToolsBehavior`/`writingToolsAffordanceVisibility`/`writingDirection`→text input attrs (`autocomplete`,`spellcheck`,`dir`).

### H.9 File / drag-drop / share / window / scene → JS APIs (no CSS)
Tabulated: drag/drop `dropDestination`/`onDrop`/`dropConfiguration`/`onDropSessionUpdated`/`dropPreviewsFormation`/`itemProvider`/`exportsItemProviders`/`importsItemProviders`/`exportableToServices`/`importableFromServices`/`copyable`/`cuttable`/`pasteDestination`→HTML5 DnD + Clipboard API · file dialogs `fileImporter`/`fileExporter`/`fileMover`/`fileDialog*`(8 variants)/`fileExporterFilenameLabel`/`documentBrowserContextMenu`→`<input type=file>` / File System Access API · `findNavigator`→find UI · scene/window `statusBar*`(4)/`_statusBar*`/`persistentSystemOverlays`/`windowResizeAnchor`/`windowDismissBehavior`/`windowFullScreenBehavior`/`windowMinimizeBehavior`/`windowResizeBehavior`/`windowToolbarFullScreenVisibility`/`assistiveAccessNavigationIcon`/`immersiveEnvironmentPicker`/`dialogIcon`/`dialogSeverity`/`dialogPreventsAppTermination`/`paletteSelectionEffect`/`horizontalRadioGroupLayout`/`modifierKeyAlternate`/`_texturedSegmentedControlStyle`/`sectionIndexLabel`/`listSectionIndexVisibility`/`focusEffectDisabled`/`labelsVisibility`(covered)/`labelIconToTitleSpacing`/`labelReservedIconWidth`→mostly n/a web or component-specific spacing (`labelIconToTitleSpacing`→`gap` between icon and title; `labelReservedIconWidth`→`min-width` on icon slot).

### H.10 Charts modifiers → owned by C-charts (Charts.framework)
All `chart*` (40 entries) are **cross-referenced to the Charts cluster**, not styling. Tabulated block:
`chartXAxis`/`chartYAxis`/`chartZAxis`/`chartXAxisStyle`/`chartYAxisStyle`/`chartXAxisLabel`/`chartYAxisLabel`/`chartZAxisLabel`→axis config · `chartXScale`/`chartYScale`/`chartZScale`/`chartXVisibleDomain`/`chartYVisibleDomain`→scales/domains · `chartForegroundStyleScale`/`chartLineStyleScale`/`chartSymbolScale`/`chartSymbolSizeScale`→series styling scales · `chartScrollPosition`/`chartScrollTargetBehavior`/`chartScrollableAxes`→scroll · `chartXSelection`/`chartYSelection`/`chartZSelection`/`chartAngleSelection`→selection · `chartPlotStyle`/`chartBackground`/`chartOverlay`/`chartLegend`→chrome · `chart3DPose`/`chart3DCameraProjection`/`chart3DRenderingStyle`→3D charts (iOS 26). **CR C-charts.** These render to SVG/Canvas in the web kit via a charting lib, not the modifier compiler.

### H.11 Misc remaining
`tint`/`accentColor`(covered C.4) · `_colorMonochrome`/`_colorMatrix`(covered F.5) · `_automaticPadding`/`_ignoresAutomaticPadding`/`_tightPadding`→private padding variants (→`padding` family) · `cornerRadius`(covered B.8) · `_safeAreaInsets`(→B.12) · `_detached`/`_listLinkedGroup`/`_navigationDestination`→private plumbing · `colorInvert`(covered F.5) · `geometryGroup`/`drawingGroup`/`compositingGroup`(covered F.6) · `luminanceToAlpha`(covered F.5) · `onScrollGeometryChange`(→H.6) · `safeAreaPadding`(covered B.12) · `edgesIgnoringSafeArea`/`ignoresSafeArea`(covered B.12) · `_onEnvironmentChange`(→H.8).

---

## Part I — The `applyModifiers` compiler (concrete React+CSS skeleton)

This is the paste-and-extend implementation shape the next agent builds. Every styling modifier from Parts B–G is one case; the long-tail (Part H) modifiers route to event handlers / ARIA / class-swaps instead.

```tsx
// types
type SUIModifiers = Partial<{
  // LAYOUT
  frame: { width?: number|'infinity'; height?: number|'infinity'; minWidth?: number; maxWidth?: number|'infinity';
           idealWidth?: number; minHeight?: number; maxHeight?: number|'infinity'; idealHeight?: number; alignment?: Alignment };
  padding: true | number | { all?: number; horizontal?: number; vertical?: number; top?: number; bottom?: number; leading?: number; trailing?: number };
  position: { x: number; y: number };
  offset: { x?: number; y?: number };
  fixedSize: true | { horizontal?: boolean; vertical?: boolean };
  layoutPriority: number;
  zIndex: number;
  clipped: boolean;
  clipShape: 'circle'|'capsule'|{ rect: number };
  cornerRadius: number;
  aspectRatio: number | { ratio?: number; contentMode: 'fit'|'fill' };
  scaledToFit: boolean; scaledToFill: boolean;
  // FILL/STROKE
  foregroundStyle: SUIShapeStyle; foregroundColor: SUIColor;
  background: SUIColor | { style: SUIShapeStyle; in?: 'capsule'|'circle'|{rect:number}; alignment?: Alignment } | ReactNode;
  tint: SUIColor; backgroundStyle: SUIShapeStyle;
  border: SUIColor | { content: SUIShapeStyle; width?: number };
  overlay: ReactNode | { content: ReactNode; alignment?: Alignment };
  shadow: { color?: string; radius: number; x?: number; y?: number } | 'inner';
  // TEXT
  font: SUITextStyle | { size: number; weight?: SUIWeight; design?: SUIDesign };
  fontWeight: SUIWeight; fontDesign: SUIDesign; fontWidth: SUIWidth;
  bold: boolean; italic: boolean;
  underline: boolean | { pattern?: LinePattern; color?: SUIColor };
  strikethrough: boolean | { pattern?: LinePattern; color?: SUIColor };
  kerning: number; tracking: number; baselineOffset: number;
  lineLimit: number | null; lineSpacing: number; lineHeight: number;
  multilineTextAlignment: 'leading'|'center'|'trailing';
  minimumScaleFactor: number; truncationMode: 'head'|'tail'|'middle'; allowsTightening: boolean;
  textCase: 'uppercase'|'lowercase'|null; monospaced: boolean; monospacedDigit: boolean; textScale: 'default'|'secondary';
  // STATE
  opacity: number; hidden: boolean; disabled: boolean;
  redacted: 'placeholder'|'privacy'; allowsHitTesting: boolean; contentShape: 'rectangle'|'circle'|'capsule';
  // TRANSFORM
  rotationEffect: { degrees?: number; radians?: number; anchor?: UnitPoint };
  scaleEffect: number | { x?: number; y?: number; anchor?: UnitPoint };
  rotation3DEffect: { degrees: number; axis: [number,number,number]; anchor?: UnitPoint; perspective?: number };
  transformEffect: [number,number,number,number,number,number]; // CGAffineTransform
  blur: number; brightness: number; contrast: number; saturation: number; grayscale: number;
  hueRotation: number; colorInvert: boolean; blendMode: string;
  compositingGroup: boolean; drawingGroup: boolean; geometryGroup: boolean;
  // CONTROL
  controlSize: 'mini'|'small'|'regular'|'large'|'extraLarge';
  labelsHidden: boolean; imageScale: 'small'|'medium'|'large';
  symbolRenderingMode: 'monochrome'|'multicolor'|'hierarchical'|'palette';
  symbolVariant: 'none'|'circle'|'square'|'rectangle'|'fill'|'slash';
  preferredColorScheme: 'light'|'dark'; dynamicTypeSize: DynamicTypeSize;
}>;

// the compiler: returns { style, className, dataAttrs }
function applyModifiers(m: SUIModifiers): { style: CSSProperties; className: string; data: Record<string,string> } {
  const style: CSSProperties = {}; const cls: string[] = []; const data: Record<string,string> = {};
  const transforms: string[] = []; const filters: string[] = [];

  // ---- LAYOUT ----
  if (m.frame) {
    const f = m.frame;
    if (f.width != null)  style.width  = f.width === 'infinity' ? '100%' : f.width;
    if (f.height != null) style.height = f.height === 'infinity' ? '100%' : f.height;
    if (f.minWidth != null)  style.minWidth = f.minWidth;
    if (f.maxWidth != null)  style.maxWidth = f.maxWidth === 'infinity' ? '100%' : f.maxWidth;
    if (f.minHeight != null) style.minHeight = f.minHeight;
    if (f.maxHeight != null) style.maxHeight = f.maxHeight === 'infinity' ? '100%' : f.maxHeight;
    if (f.alignment) { style.display='flex'; [style.alignItems, style.justifyContent] = alignToFlex(f.alignment); }
  }
  if (m.padding !== undefined) Object.assign(style, paddingToCSS(m.padding)); // logical props
  if (m.position) { style.position='absolute'; style.left=m.position.x; style.top=m.position.y; transforms.push('translate(-50%,-50%)'); }
  if (m.offset)   transforms.push(`translate(${m.offset.x??0}px,${m.offset.y??0}px)`);
  if (m.fixedSize) { /* width/height: max-content per axis */ }
  if (m.layoutPriority != null) { style.flexShrink = m.layoutPriority > 0 ? 0 : 1; style.flexGrow = Math.max(0,m.layoutPriority); }
  if (m.zIndex != null) style.zIndex = Math.round(m.zIndex);
  if (m.clipped) style.overflow='hidden';
  if (m.clipShape) Object.assign(style, clipShapeToCSS(m.clipShape));
  if (m.cornerRadius != null) { style.borderRadius=m.cornerRadius; style.overflow='hidden'; }
  if (m.aspectRatio) Object.assign(style, aspectToCSS(m.aspectRatio));

  // ---- FILL / STROKE ----
  if (m.foregroundStyle) style.color = shapeStyleToColor(m.foregroundStyle);
  if (m.foregroundColor) style.color = colorVar(m.foregroundColor);
  if (m.background) Object.assign(style, backgroundToCSS(m.background));
  if (m.tint) (style as any)['--sui-color-tint'] = colorVar(m.tint);
  if (m.border) Object.assign(style, borderToCSS(m.border));      // 1px default
  if (m.shadow) style.boxShadow = shadowToCSS(m.shadow);          // blur = 2*radius

  // ---- TEXT ----
  if (m.font) Object.assign(style, fontToCSS(m.font));            // size+weight+lineHeight+tracking bundle
  if (m.fontWeight) style.fontWeight = `var(--sui-weight-${m.fontWeight})`;
  if (m.bold)   style.fontWeight = 700;
  if (m.italic) style.fontStyle  = 'italic';
  if (m.fontDesign) style.fontFamily = `var(--sui-font-${m.fontDesign})`;
  if (m.underline || m.strikethrough) style.textDecoration = decorationToCSS(m.underline, m.strikethrough);
  if (m.kerning != null) style.letterSpacing = m.kerning;
  if (m.tracking != null){ style.letterSpacing = m.tracking; (style as any).fontVariantLigatures='none'; }
  if (m.baselineOffset != null) style.verticalAlign = m.baselineOffset;
  if (m.lineLimit !== undefined) Object.assign(style, lineLimitToCSS(m.lineLimit));
  if (m.lineSpacing != null) style.lineHeight = `calc(var(--lh) + ${m.lineSpacing}px)`;
  if (m.multilineTextAlignment) style.textAlign = { leading:'start', center:'center', trailing:'end' }[m.multilineTextAlignment];
  if (m.textCase != null) style.textTransform = m.textCase ?? 'none';
  if (m.monospaced) style.fontFamily = 'var(--sui-font-monospaced)';
  if (m.monospacedDigit) style.fontVariantNumeric = 'tabular-nums';

  // ---- STATE ----
  if (m.opacity != null) style.opacity = m.opacity;
  if (m.hidden) style.visibility = 'hidden';
  if (m.disabled) { data['disabled']='true'; style.pointerEvents='none'; style.opacity = (style.opacity as number ?? 1) * 0.35; }
  if (m.redacted) cls.push(`sui-redacted--${m.redacted}`);
  if (m.allowsHitTesting === false) style.pointerEvents='none';

  // ---- TRANSFORM ----
  if (m.rotationEffect) { transforms.push(`rotate(${deg(m.rotationEffect)}deg)`); style.transformOrigin = originToCSS(m.rotationEffect.anchor); }
  if (m.scaleEffect)    { transforms.push(scaleToCSS(m.scaleEffect)); }
  if (m.rotation3DEffect){ const r=m.rotation3DEffect; transforms.unshift(`perspective(${1000/(r.perspective??1)}px)`); transforms.push(`rotate3d(${r.axis.join(',')},${r.degrees}deg)`); }
  if (m.transformEffect) transforms.push(`matrix(${m.transformEffect.join(',')})`);
  if (m.blur != null) filters.push(`blur(${m.blur}px)`);
  if (m.brightness != null) filters.push(`brightness(${1+m.brightness})`);
  if (m.contrast != null) filters.push(`contrast(${m.contrast})`);
  if (m.saturation != null) filters.push(`saturate(${m.saturation})`);
  if (m.grayscale != null) filters.push(`grayscale(${m.grayscale})`);
  if (m.hueRotation != null) filters.push(`hue-rotate(${m.hueRotation}deg)`);
  if (m.colorInvert) filters.push('invert(1)');
  if (m.blendMode) style.mixBlendMode = m.blendMode as any;
  if (m.compositingGroup) style.isolation='isolate';
  if (m.drawingGroup) { style.willChange='transform'; transforms.push('translateZ(0)'); }
  if (m.geometryGroup) style.contain='layout paint';

  // ---- CONTROL ----
  if (m.controlSize) data['control-size'] = m.controlSize;
  if (m.labelsHidden) cls.push('sui-labels-hidden');
  if (m.imageScale) (style as any)['--sui-symbol-scale'] = { small:0.85, medium:1, large:1.2 }[m.imageScale];
  if (m.symbolRenderingMode) data['symbol-mode'] = m.symbolRenderingMode;
  if (m.symbolVariant) data['symbol-variant'] = m.symbolVariant;
  if (m.preferredColorScheme) cls.push(m.preferredColorScheme); // 'light' | 'dark'
  if (m.dynamicTypeSize) (style as any)['--sui-type-scale'] = typeScaleFor(m.dynamicTypeSize);

  if (transforms.length) style.transform = transforms.join(' ');
  if (filters.length)    style.filter    = filters.join(' ');
  return { style, className: cls.join(' '), data };
}
```

**Order matters:** `transform` entries concatenate (offset → scale → rotate → 3D → matrix). `filter` entries concatenate. `opacity` from `disabled` multiplies any explicit opacity. The 3×3 alignment helper:

```ts
function alignToFlex(a: Alignment): [string,string] {  // [alignItems(vert), justifyContent(horiz)]
  const v = { top:'flex-start', center:'center', bottom:'flex-end' };
  const h = { leading:'flex-start', center:'center', trailing:'flex-end' };
  const map: Record<Alignment,[string,string]> = {
    topLeading:[v.top,h.leading], top:[v.top,h.center], topTrailing:[v.top,h.trailing],
    leading:[v.center,h.leading], center:[v.center,h.center], trailing:[v.center,h.trailing],
    bottomLeading:[v.bottom,h.leading], bottom:[v.bottom,h.center], bottomTrailing:[v.bottom,h.trailing],
  };
  return map[a];
}
```

---

## Part Z — Cluster `types` tabulation (framework plumbing — not styling specs)

Every entry in the C10 `types` array, with kind/module/line, one-line purpose, and web-equivalent. None render a styling modifier; the ones that are real public views belong to other clusters (marked **CR**). Internal `_`-prefixed types are SwiftUI's private layout/effect machinery — they have no public API and are implemented implicitly by the modifier compiler above.

| Type | Module:lines | Purpose | Web-equivalent |
|---|---|---|---|
| `ContentUnavailableView` | SwiftUI 17171–17178 | empty-state placeholder (icon+title+desc) | **CR empty-states**: centered flex `<div>`, SF icon + headline + secondary text |
| `DebugReplaceableView` | SUICore 5231–5242 | hot-reload wrapper | n/a (dev only) |
| `DefaultButtonLabel` | SUI 22035 | default Button label content | internal `<span>` |
| `DefaultDateProgressLabel` | SUI 1261 | default date-progress label | internal |
| `DefaultDocumentGroupLaunchActions` | SUI 22420 | doc launch actions | n/a web |
| `DefaultSettingsLinkLabel` | SUI 9197 | "Settings" link label | internal text |
| `DefaultShareLinkLabel` | SUI 17970 | default share button label | internal |
| `DefaultTabLabel` | SUI 15780 | default tab label | internal |
| `DefaultWindowVisibilityToggleLabel` | SUI 2403 | window toggle label | n/a web |
| `DocumentLaunchView` | SUI 22244–22402 | document launcher screen | n/a web |
| `DynamicViewContent` (protocol) | SUICore 15532 | ForEach-over-data trait (onDelete/onMove) | list with reorder/delete handlers |
| `EmptyView` | SUICore 13838 | renders nothing | `null` / `<></>` |
| `GeometryEffect` (protocol) | SUICore 3738 | custom transform modifier | a `transform` matrix fn (CR transforms F.4) |
| `GlassEffectContainer` | SUICore 9045 | groups Liquid-Glass shapes | `backdrop-filter` group (materials.md, iOS 26) |
| `GridLayout` | SUI 17625 | explicit Grid layout root | CSS `display:grid` (CR layout) |
| `GroupBox` | SUI 12545–12559 | titled bordered container | **CR C15**: card `<fieldset>` w/ header + `.regularMaterial` bg, 16px radius |
| `GroupElementsOfContent` | SUICore 16191 | variadic element grouping | internal |
| `GroupSectionsOfContent` | SUICore 18925 | variadic section grouping | internal |
| `HSplitView` | SUI 13480 | horizontal resizable split (macOS) | CSS `grid` + draggable gutter (CR layout) |
| `VSplitView` | SUI 13497 | vertical resizable split | same, vertical |
| `IDView` | SUICore 18335 | `.id()` wrapper | identity key |
| `LabeledControlGroupContent` | SUI 14980 | labeled control-group content | internal |
| `LabeledToolbarItemGroupContent` | SUI 2914 | labeled toolbar group | internal |
| `MenuButton` | SUI 338 | legacy pull-down menu | **CR C15** menu (`<details>`/popover) |
| `NSHostingController` | SUI 890–945 | AppKit VC hosting SwiftUI | n/a web (bridge) |
| `NSHostingView` | SUI 9354–9505 | AppKit NSView hosting SwiftUI | n/a web (bridge) |
| `NSViewControllerRepresentable` (protocol) | SUI 10699 | wrap AppKit VC | n/a web |
| `NSViewControllerRepresentableContext` | SUI 10754 | coordinator context | n/a web |
| `NSViewRepresentable` (protocol) | SUI 7293 | wrap AppKit NSView | n/a web (≈ a raw DOM escape hatch) |
| `NSViewRepresentableContext` | SUI 7356 | coordinator context | n/a web |
| `NewDocumentButton` | SUI 9886 | "New Document" button | **CR C15** button |
| `OutlineSubgroupChildren` | SUI 3266 | outline disclosure children | nested `<ul>` |
| `PlaceholderContentView` | SUICore 1820 | placeholder slot for styles | the `configuration.content` slot |
| `PresentedWindowContent` | SUI 15403 | window content wrapper | n/a web |
| `PreviewModifierContent` | SUI 2277 | preview modifier slot | n/a runtime |
| `SettingsLink` | SUI 9176 | opens Settings scene | **CR C15** link button |
| `SubscriptionView` | SUI 2804 | Combine publisher subscriber | `useEffect` subscription (CR H.6) |
| `Subview` (struct) | SUICore 19442 | a resolved subview in a `Group(subviews:)` | a child node handle (`React.Children`) |
| `TextFieldLink` | SUI 8913 | watchOS text-entry link | **CR C15** field |
| `TouchBar` | SUI 2679 | macOS Touch Bar content | n/a web |
| `WindowVisibilityToggle` | SUI 2383 | toggle window visibility | n/a web |
| `_AnimatableView` (protocol) | SUI 15476 | animatable view trait | animated component |
| `_BackdropEffect` | SUICore 14744 | backdrop blur modifier | `backdrop-filter` (CR materials) |
| `_CALayerView` | SUICore 302 | raw CALayer host | `<canvas>`/raw DOM |
| `_CompositorContentBodyAdaptor` | SUI 16191 | visionOS compositor adapter | n/a web |
| `_DetachedPlaceholder`/`_DetachedView` | SUICore 11083/11024 | detached-render plumbing | portal (`createPortal`) |
| `_DisclosureIndicator` | SUI 23683 | chevron `›` indicator | `::after` chevron glyph |
| `_DrawingGroupEffect` | SUICore 4374 | `.drawingGroup()` modifier struct | GPU layer (covered F.6) |
| `_EnabledScrollClipEffect`/`_ScrollClipEffect` | SUICore 11785/11765 | scroll-clip modifier | `overflow:hidden` toggle |
| `_FlipForRTLEffect` | SUI 2951 | RTL mirror modifier | `transform:scaleX(-1)` under `[dir=rtl]` |
| `_LayoutDirectionBehaviorEffect` | SUI 4875 | layout-direction modifier | `direction` handling |
| `_LayoutRoot`/`_SizeFittingRoot`/`_ZStackLayout`/`_OverlayLayout`/`_SplitViewContainer` | SUICore/SUI | private layout roots | implicit in flex/grid/abs containers |
| `_LayoutTrait` | SUICore 8307 | per-child layout trait key | child layout data |
| `_MaskEffect`/`_MaskAlignmentEffect` | SUICore 4719/4673 | `.mask()` modifier structs | `mask`/`-webkit-mask` (covered B.9) |
| `_PagingView`/`_ScrollView`/`_ScrollViewRoot`/`_ScrollableLayoutView`/`_ScrollViewBoundsModifier2` | SUI | private scroll plumbing | scroll container internals |
| `_PullDownButton` | SUI 14342 | pull-down menu button | **CR C15** menu |
| `_ShadowView` | SUI 19970 | shadow render node | `box-shadow` (covered C.7) |
| `_SymmetricallyScaledText`/`_TabContentBodyAdaptor`/`_UnaryViewAdaptor`/`_ViewModifier_Content`/`_WKStoryboardContent`/`_CompositorContentBodyAdaptor` | SUI/SUICore | private content adapters | internal |
| `_TaskModifier2`/`_TaskValueModifier2` | SUI 5124/5137 | `.task()` modifier structs | async `useEffect` (CR H.6) |
| `_VariadicView_*` (protocols) | SUICore 6568–6607 | variadic view roots | `React.Children` mapping |

---

## Part W — Web-ready status & fidelity notes

**web_ready = true.** Every deep-covered styling modifier (Parts B–G) has its HTML/CSS + React-prop mapping, and the `applyModifiers` compiler (Part I) is a paste-ready skeleton that wires them together.

**Deep-covered (full HTML+CSS+prop-API):** LAYOUT — `frame`, `padding`, `position`, `offset`, `fixedSize`, `layoutPriority`, `zIndex`, `clipped`, `clipShape`, `cornerRadius`, `mask`, `aspectRatio`, `scaledToFit`, `scaledToFill`, `containerRelativeFrame`, `safeAreaInset`, `safeAreaPadding`, `ignoresSafeArea`, `edgesIgnoringSafeArea`, `scenePadding`. FILL/STROKE — `foregroundStyle`, `foregroundColor`, `background`, `backgroundStyle`, `tint`, `accentColor`, `border`, `overlay`, `shadow`. TEXT — `font`, `fontWeight`, `bold`, `italic`, `fontDesign`, `fontWidth`, `underline`, `strikethrough`, `kerning`, `tracking`, `baselineOffset`, `lineLimit`, `lineSpacing`, `lineHeight`, `multilineTextAlignment`, `minimumScaleFactor`, `allowsTightening`, `truncationMode`, `textCase`, `monospaced`, `monospacedDigit`, `textScale`. STATE — `opacity`, `hidden`, `disabled`, `redacted`/`unredacted`, `privacySensitive`, `allowsHitTesting`, `contentShape`, `containerShape`. TRANSFORM — `rotationEffect`, `scaleEffect`, `rotation3DEffect`, `transformEffect`, `projectionEffect`, `blur`, `brightness`, `contrast`, `saturation`, `grayscale`, `hueRotation`, `colorInvert`, `colorMultiply`, `luminanceToAlpha`, `blendMode`, `compositingGroup`, `drawingGroup`, `geometryGroup`. CONTROL — `controlSize`, `labelsHidden`, `labelStyle`, `imageScale`, `symbolRenderingMode`, `symbolVariant`, `colorScheme`, `preferredColorScheme`, `dynamicTypeSize`.

**Tabulated (Part H, with web target):** all style-selector modifiers (buttonStyle/listStyle/pickerStyle/… → CR C15), all presentation/navigation/toolbar/search (→ CR C-navigation / C-presentation), all accessibility (→ ARIA), all behavior/event/lifecycle (→ JS handlers), all file/drag-drop/share/window/scene, all `chart*` (→ CR C-charts), and all private `_`-prefixed plumbing variants. Plus the entire `types` array in Part Z.

**Fidelity / uncertainty:**
- **KNOWN (verbatim swiftinterface):** every signature + default-arg + enum cited with file:line is exact. The most load-bearing: `padding` length default `nil` (not 8/16), `frame` alignment `.center`, `shadow` color `rgba(0,0,0,0.33)` + radius no-default, `border`/`stroke` width default `1`, `cornerRadius` is **circular** (deprecated) vs `clipShape(.rect)` **continuous**, `ControlSize`/`ContentMode`/`TextAlignment`/`Text.Case`/`TruncationMode`/`Image.Scale`/`SymbolRenderingMode`/`SymbolVariants` enum cases.
- **INFERRED (HIG/RE):** the resolved numbers the interface hides — `.padding()`=16px, per-`ControlSize` metrics (§G.1, CALIBRATE), Dynamic Type scale factors, shadow blur=2×radius, hierarchy opacity multipliers, symbol scale ems.
- **DESIGNED (our CSS):** the compiler itself, transform/filter concatenation order, `brightness` additive→multiplicative approximation (use `<feComponentTransfer>` for exactness), `minimumScaleFactor`/`.middle`-truncation JS fit helpers (no native CSS), `position`/`rotation3DEffect` perspective calibration (`perspective:1`≈`1000px`), squircle `clip-path` for continuous corners.
- **The two hard web gaps (need JS, not CSS):** (1) `minimumScaleFactor` + `.middle`/`.head` truncation — require measure-and-fit JS. (2) continuous (squircle) corners — CSS `border-radius` is a pure circular arc; pixel-fidelity needs the figma-squircle `clip-path` (`cornerSmoothing=0.6`). Both are flagged CALIBRATE.
- **RTL:** all leading/trailing compile to CSS logical props (`padding-inline-start/end`, `text-align:start/end`, `inset-inline`) so the kit flips exactly like SwiftUI.
