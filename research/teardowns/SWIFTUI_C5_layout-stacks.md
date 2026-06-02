# SwiftUI Cluster C5 — Layout & Stacks — RE Teardown

**Mission:** spec for a pixel-1:1 web (React/Next.js + CSS) replica of SwiftUI's layout backbone.
This file is the implementation spec for a later agent that WRITES the React+CSS components, so every
section ends with a concrete HTML structure + CSS + React prop API.

**Target runtime:** canonical iOS 17 / macOS 14 SwiftUI ("SwiftUI look"). iOS 26 "Liquid Glass" deltas
are labeled, never substituted.

**Authoritative Tier-1A sources read this session (verbatim line cites below):**
- `SwiftUICore.framework/.../arm64e-apple-macos.swiftinterface` — VStack/HStack/ZStack, the `_*StackLayout`
  roots, `Layout` protocol, `ProposedViewSize`, `ViewSpacing`, `LayoutSubviews`/`LayoutSubview`, alignment
  types, `Spacer`, `GeometryReader`, `AnyLayout`, `AnyView`, `Group`, `TupleView`, `ViewBuilder`,
  `_VariadicView`, `LazyVStack`/`LazyHStack`.
- `SwiftUI.framework/.../arm64e-apple-macos.swiftinterface` — `Grid`/`GridRow`/`GridLayout`, `GridItem`,
  `LazyVGrid`/`LazyHGrid`, `Section`, `ViewThatFits`, `EquatableView`.
- Token specs: `swiftui/tokens/spacing.md` (the `nil`→8pt finding), `colors.md`, `typography.md`.
- Apple HIG / WWDC for runtime visual behavior the interface can't show (default 8-pt gap, the
  proposed-size negotiation, Grid cell sizing, alignment-guide math).

**Source labels:** `KNOWN` = verbatim from swiftinterface · `INFERRED` = Apple docs / WWDC / reputable RE
· `DESIGNED` = our CSS/React engineering to reproduce runtime behavior on the web.

**Token cross-refs used:** `var(--sui-color-label)` etc. from `colors.md`; `space.stack.default = 8px`
from `spacing.md`; `text.body` from `typography.md`.

---

## 0. THE LAYOUT ALGORITHM (read this first — everything else is built on it)

SwiftUI layout is **NOT** flow layout and **NOT** constraint solving. It is a single top-down/bottom-up
negotiation per frame, the "proposed-size" protocol. The exact protocol is now public as the `Layout`
protocol (iOS 16+), so we can read the real contract instead of guessing.

### 0.1 The three-step negotiation (INFERRED from `Layout` protocol shape + WWDC22 #10056 "Compose custom layouts")

For every parent→child pair, on every layout pass:

1. **Parent proposes a size** to the child: a `ProposedViewSize` = `(width: CGFloat?, height: CGFloat?)`.
   Each dimension is **optional**. The three sentinel proposals drive the whole system:
   - `.zero` = "what is your *minimum* size?" (propose 0×0)
   - `.infinity` = "what is your *maximum* size?" (propose ∞×∞)
   - `.unspecified` = "what is your *ideal/natural* size?" (propose nil×nil)
   `nil` in a dimension means "you decide that axis." (KNOWN: the three statics exist verbatim.)
2. **Child returns the size it wants** via `sizeThatFits(proposal:)` → `CGSize`. The child is free to ignore
   the proposal (e.g. a fixed-size image returns its intrinsic size regardless; `Text` returns the size that
   fits the proposed width by wrapping). **The child always chooses its own size — the parent cannot force it.**
3. **Parent places the child** by calling `place(at:anchor:proposal:)` — it positions the child within the
   parent's own bounds using an alignment, but it re-proposes a (possibly final) size at placement time.

This is the single most important fidelity fact: **a SwiftUI parent proposes, the child disposes.** CSS is
the opposite (parent's `width`/`flex` usually *forces* the child). The web replica must therefore lean on
`width: max-content` / `min-content` / `fit-content` and `flex` carefully so children keep their intrinsic
size unless they opt into growth (`maxWidth: .infinity` → `flex-grow`/`align-self: stretch`).

### 0.2 The `Layout` protocol — verbatim contract (KNOWN)

```swift
// SwiftUICore.swiftinterface:8142–8156
@preconcurrency public protocol Layout : Swift.Sendable, SwiftUICore.Animatable {
  static var layoutProperties: SwiftUICore.LayoutProperties { get }
  associatedtype Cache = Swift.Void
  typealias Subviews = SwiftUICore.LayoutSubviews
  func makeCache(subviews: Self.Subviews) -> Self.Cache
  func updateCache(_ cache: inout Self.Cache, subviews: Self.Subviews)
  func spacing(subviews: Self.Subviews, cache: inout Self.Cache) -> SwiftUICore.ViewSpacing
  func sizeThatFits(proposal: SwiftUICore.ProposedViewSize, subviews: Self.Subviews, cache: inout Self.Cache) -> CoreFoundation.CGSize
  func placeSubviews(in bounds: CoreFoundation.CGRect, proposal: SwiftUICore.ProposedViewSize, subviews: Self.Subviews, cache: inout Self.Cache)
  func explicitAlignment(of guide: SwiftUICore.HorizontalAlignment, in bounds: …, …) -> CGFloat?
  func explicitAlignment(of guide: SwiftUICore.VerticalAlignment, in bounds: …, …) -> CGFloat?
}
```

- `sizeThatFits` is step 2 for a container: given a proposal, it asks each subview for *its* size and
  returns the container's total size. `placeSubviews` is step 3: lay each subview at a `CGPoint`.
- `LayoutProperties.stackOrientation: Axis?` (`:8181`) is how a custom layout declares "I'm horizontal/vertical"
  so that `Spacer` and divider-insertion behave correctly.
- `makeCache`/`updateCache` memoize expensive measurement across the size+place passes (a Layout's
  `sizeThatFits` and `placeSubviews` are called separately, so the cache avoids re-measuring children).

### 0.3 `ProposedViewSize` — verbatim (KNOWN)

```swift
// SwiftUICore.swiftinterface:8197–8217
@frozen public struct ProposedViewSize : Equatable {
  public var width: CGFloat?
  public var height: CGFloat?
  public static let zero: ProposedViewSize          // (0,0)  → minimum query
  public static let unspecified: ProposedViewSize   // (nil,nil) → ideal query
  public static let infinity: ProposedViewSize      // (∞,∞) → maximum query
  public init(width: CGFloat?, height: CGFloat?)
  public init(_ size: CGSize)
  public func replacingUnspecifiedDimensions(by size: CGSize = CGSize(width: 10, height: 10)) -> CGSize
}
```

**KNOWN constant:** when a dimension is unspecified, the documented fallback for "give me *something*" is
`CGSize(10, 10)` — that literal `10` is baked into `replacingUnspecifiedDimensions`'s default. (This is why
an empty `Color` with no frame collapses toward a 10×10-ish ideal in some contexts.)

### 0.4 `LayoutSubview` / `LayoutSubviews` — the per-child handle (KNOWN)

```swift
// SwiftUICore.swiftinterface:8258–8278
public struct LayoutSubview : Equatable {
  public var priority: Double { get }                       // layoutPriority
  public func sizeThatFits(_ proposal: ProposedViewSize) -> CGSize
  public func dimensions(in proposal: ProposedViewSize) -> ViewDimensions   // size + alignment guides
  public var spacing: ViewSpacing { get }
  public func place(at position: CGPoint, anchor: UnitPoint = .topLeading, proposal: ProposedViewSize)
}
public struct LayoutSubviews : RandomAccessCollection { var layoutDirection: LayoutDirection; … }
```

`priority` is `layoutPriority(_:)` (default `0`). `dimensions(in:)` returns a `ViewDimensions` that carries
the child's size **and** its resolved alignment-guide values — that is the bridge between the size protocol
and alignment guides (§0.6).

### 0.5 How a stack divides space (INFERRED — the canonical HStack/VStack algorithm, WWDC + RE)

This is the algorithm `_HStackLayout`/`_VStackLayout` run. For an HStack of width `W` with `n` children and
`(n-1)` gaps of total `G`:

1. **Available content width** = `W − G`.
2. **Group children by `layoutPriority`** (highest first). Spacers and `Color`/`Rectangle` are "flexible";
   `Text`/`Image` are "rigid-ish" (they have a strong ideal size).
3. **Offer remaining space to the highest-priority group, divided equally**; each child returns
   `sizeThatFits` for that offer. Subtract what they took.
4. **Repeat for the next priority group** with whatever width is left.
5. Within a priority group, the offer is split **evenly** among the un-sized children — but a child that
   refuses the full offer (returns a smaller `sizeThatFits`) frees space that is **re-offered** to the
   remaining children in that group (this is why one short `Text` lets a long `Text` take more room).

So `layoutPriority` is "who gets first dibs on the leftover space", **not** a flex weight. (KNOWN:
`LayoutSubview.priority: Double`. INFERRED: the dibs algorithm.)

### 0.6 Alignment guides (INFERRED — the cross-axis math)

A stack has one **alignment** on the cross axis. Each child reports a guide value (a coordinate within its
own bounds) for that guide; the stack lines the children up so those coordinates coincide.
- `HorizontalAlignment` / `VerticalAlignment` are *named keys* into an `AlignmentID` whose `defaultValue`
  is computed from the child's dimensions (e.g. `.center` = height/2; `.firstTextBaseline` = the baseline of
  the first text line). KNOWN: the structs (`:11147`, `:11165`) wrap an `AlignmentID.Type`.
- `firstTextBaseline`/`lastTextBaseline` (KNOWN `:11178–11179`) align text by its baseline, not its box —
  the single hardest thing to reproduce on the web (see §HStack mapping).

### 0.7 The spacing default is `nil`, not 8 (KNOWN — critical)

Every stack `spacing:` parameter defaults to `nil` (verbatim in §VStack/§HStack below). `nil` is resolved at
runtime by the private `ViewSpacing` engine which inspects the **types** of adjacent subviews. The dominant
resolved value for generic view-to-view gaps is **8 pt**; text-to-text can be smaller. The `ViewSpacing` API
is public enough to confirm the mechanism:

```swift
// SwiftUICore.swiftinterface:8220–8225
public struct ViewSpacing : Sendable {
  public static let zero: ViewSpacing
  public func distance(to next: ViewSpacing, along axis: Axis) -> CGFloat   // ← the resolved gap
}
```

**Replica decision (DESIGNED):** `--sui-space-stack-default: 8px` (token `space.stack.default`). `gap` is the
exact CSS analog. We do NOT attempt the text-metric reduction by default.

### 0.8 Mapping the whole model to CSS (DESIGNED — the master table)

| SwiftUI concept | CSS analog |
|---|---|
| parent proposes size, child disposes | children default to `width: max-content`; growth is opt-in |
| `.frame(maxWidth: .infinity)` | `flex: 1` (in a stack) or `align-self: stretch` / `width: 100%` |
| `Spacer()` | `flex: 1 1 0` empty `<div>` (or `margin-left:auto`) |
| `layoutPriority(p)` | no direct analog; emulate with `flex-grow` weights / `flex-basis` |
| HStack | `display: flex; flex-direction: row` |
| VStack | `display: flex; flex-direction: column` |
| ZStack | `display: grid` (single cell) — all children in `grid-area: 1/1` |
| stack `spacing` | `gap` |
| stack `alignment` | `align-items` (cross axis) |
| `firstTextBaseline` | `align-items: baseline` |
| Grid / GridRow | `display: grid` |
| LazyVGrid columns | `grid-template-columns` |
| ViewThatFits | container-query / JS measure-and-pick |
| GeometryReader | `ResizeObserver` + render-prop |

---

## 1. VStack — vertical stack

### 1.1 Exact API (KNOWN)

```swift
// SwiftUICore.swiftinterface:1128–1140
@frozen public struct VStack<Content> : View where Content : View {
  internal var _tree: _VariadicView.Tree<_VStackLayout, Content>
  @inlinable public init(alignment: HorizontalAlignment = .center,
                         spacing: CGFloat? = nil,
                         @ViewBuilder content: () -> Content) {
        _tree = .init(_VStackLayout(alignment: alignment, spacing: spacing)) { content() }
  }
  public typealias Body = Swift.Never
}
```

The public-Layout twin, usable in `AnyLayout`:

```swift
// SwiftUICore.swiftinterface:1173–1184
@frozen public struct VStackLayout : Layout {
  public var alignment: HorizontalAlignment            // default .center
  public var spacing: CGFloat?                          // default nil
  @inlinable public init(alignment: HorizontalAlignment = .center, spacing: CGFloat? = nil)
  public typealias AnimatableData = EmptyAnimatableData
}
```

- **`alignment: HorizontalAlignment = .center`** — the CROSS axis (VStack stacks vertically, so it aligns
  children horizontally). Cases (KNOWN `:11228–11231`): `.leading`, `.center`, `.trailing` (+ the
  list-separator guides). DEFAULT is `.center` — **not** leading. This is a constant web devs get wrong.
- **`spacing: CGFloat? = nil`** — `nil` ⇒ runtime ~8 pt (§0.7).
- The body is `Never`: a VStack is *not* a normal view, it's a `_VariadicView.Tree` wrapping the internal
  `_VStackLayout` root over the `@ViewBuilder` content (§ViewBuilder). The ViewBuilder flattens the closure
  into a `TupleView`; the variadic-view machinery expands that tuple into the list of subviews the layout
  measures.

### 1.2 Visual anatomy & metrics

- **Sub-elements:** N child views laid top→bottom, each separated by the resolved gap. No background, no
  border, no padding of its own (a bare VStack draws nothing — it's pure layout).
- **Main-axis (vertical) size:** `sum(child heights) + (N-1)*gap`. The stack proposes its *own* full height
  divided among flexible children (§0.5) — but for rigid children it's just their summed ideal heights.
- **Cross-axis (horizontal) size:** `max(child widths)` (the stack is as wide as its widest child) unless a
  child opts into `.infinity`.
- **Default gap:** `8px` (token `space.stack.default`). **Default cross-alignment:** center.
- **States:** none of its own — a layout container has no hover/press/focus. Visual state lives in children.

### 1.3 Behavior

- No interaction, no animation of its own. When `spacing`/`alignment`/child set changes, SwiftUI animates the
  re-layout with whatever transaction animation is in flight (the container itself is inert).
- `Spacer()` inside a VStack expands vertically to push siblings apart.

### 1.4 Web replication mapping (DESIGNED)

```html
<div class="sui-vstack" style="--sui-stack-gap: 8px;">
  <!-- children -->
</div>
```
```css
.sui-vstack {
  display: flex;
  flex-direction: column;
  align-items: center;                 /* maps HorizontalAlignment .center (DEFAULT) */
  gap: var(--sui-stack-gap, 8px);      /* spacing; nil → 8px */
  width: max-content;                  /* "as wide as widest child" (child disposes) */
}
.sui-vstack[data-align="leading"]  { align-items: flex-start; }
.sui-vstack[data-align="center"]   { align-items: center; }
.sui-vstack[data-align="trailing"] { align-items: flex-end; }
```
React API (idiomatic mirror of the Swift init):
```tsx
type HAlign = 'leading' | 'center' | 'trailing';
interface VStackProps {
  alignment?: HAlign;          // default 'center'
  spacing?: number | null;     // default null → 8
  children: React.ReactNode;
}
function VStack({ alignment = 'center', spacing = null, children }: VStackProps) {
  return (
    <div className="sui-vstack" data-align={alignment}
         style={{ '--sui-stack-gap': `${spacing ?? 8}px` } as React.CSSProperties}>
      {children}
    </div>
  );
}
```
**Fidelity notes:** (a) `width: max-content` reproduces "child disposes" — a VStack does not stretch to its
parent unless a child does `.frame(maxWidth: .infinity)` (→ that child gets `align-self: stretch`).
(b) A child that should fill width sets `align-self: stretch`. (c) For `firstTextBaseline` *horizontal*
alignment SwiftUI lines up the leading edges of first text — rare; fall back to `flex-start`.

---

## 2. HStack — horizontal stack

### 2.1 Exact API (KNOWN)

```swift
// SwiftUICore.swiftinterface:5404–5416
@frozen public struct HStack<Content> : View where Content : View {
  internal var _tree: _VariadicView.Tree<_HStackLayout, Content>
  @inlinable public init(alignment: VerticalAlignment = .center,
                         spacing: CGFloat? = nil,
                         @ViewBuilder content: () -> Content) {
        _tree = .init(_HStackLayout(alignment: alignment, spacing: spacing)) { content() }
  }
  public typealias Body = Swift.Never
}
// SwiftUICore.swiftinterface:5449–5456
@frozen public struct HStackLayout : Layout {
  public var alignment: VerticalAlignment              // default .center
  public var spacing: CGFloat?                          // default nil
  @inlinable public init(alignment: VerticalAlignment = .center, spacing: CGFloat? = nil)
}
```

- **`alignment: VerticalAlignment = .center`** — CROSS axis (HStack lays out horizontally → aligns
  children vertically). Cases (KNOWN `:11178–11181`): `.top`, `.center`, `.bottom`, **`.firstTextBaseline`**,
  **`.lastTextBaseline`**. Default `.center`.
- **`spacing: CGFloat? = nil`** ⇒ ~8 pt runtime.

### 2.2 Visual anatomy & metrics

- **Sub-elements:** N children laid left→right (LTR; right→left under RTL — the layout reads
  `LayoutSubviews.layoutDirection`), separated by the gap.
- **Main-axis width:** `sum(child widths) + (N-1)*gap`, with leftover space divided by the priority algorithm
  (§0.5). **Cross-axis height:** `max(child heights)` (or the baseline-extent when a baseline alignment is used).
- **Default gap `8px`; default alignment center.**
- **`.firstTextBaseline`** is the killer feature: it aligns the *first text baseline* of each child. A 40-pt
  number and a 13-pt caption sit on the same baseline, not center-aligned boxes.

### 2.3 Behavior

Inert container; `Spacer()` expands horizontally; RTL flips main-axis order.

### 2.4 Web replication mapping (DESIGNED)

```html
<div class="sui-hstack" style="--sui-stack-gap:8px;" data-align="center"></div>
```
```css
.sui-hstack {
  display: flex;
  flex-direction: row;
  align-items: center;                 /* VerticalAlignment .center (DEFAULT) */
  gap: var(--sui-stack-gap, 8px);
  width: max-content;
}
.sui-hstack[data-align="top"]    { align-items: flex-start; }
.sui-hstack[data-align="center"] { align-items: center; }
.sui-hstack[data-align="bottom"] { align-items: flex-end; }
.sui-hstack[data-align="firstTextBaseline"] { align-items: baseline; }      /* ≈ first baseline */
.sui-hstack[data-align="lastTextBaseline"]  { align-items: last baseline; } /* CSS last baseline */
.sui-hstack[dir="rtl"] { flex-direction: row; }  /* flex already honors dir for order */
```
React API:
```tsx
type VAlign = 'top' | 'center' | 'bottom' | 'firstTextBaseline' | 'lastTextBaseline';
interface HStackProps { alignment?: VAlign; spacing?: number | null; children: React.ReactNode; }
function HStack({ alignment = 'center', spacing = null, children }: HStackProps) {
  return (
    <div className="sui-hstack" data-align={alignment}
         style={{ '--sui-stack-gap': `${spacing ?? 8}px` } as React.CSSProperties}>
      {children}
    </div>
  );
}
```
**Fidelity notes:** `align-items: baseline` is the closest CSS to `.firstTextBaseline` and is correct for the
common single-line case. `align-items: last baseline` covers `.lastTextBaseline`. The priority-divides-leftover
behavior (§0.5) maps to: tag the child that should win leftover space with `flex: 1` (and others `flex: 0 0 auto`).
For true SwiftUI parity with multiple priorities you'd need a JS measure pass — out of scope for v1; document
`layoutPriority` → `flex-grow` weight as the approximation.

---

## 3. ZStack — depth (overlay) stack

### 3.1 Exact API (KNOWN)

```swift
// SwiftUICore.swiftinterface:341–349
@frozen public struct ZStack<Content> : View where Content : View {
  package var _tree: _VariadicView.Tree<_ZStackLayout, Content>
  @inlinable public init(alignment: Alignment = .center,
                         @ViewBuilder content: () -> Content) {
        _tree = .init(_ZStackLayout(alignment: alignment)) { content() }
  }
  public typealias Body = Swift.Never
}
// SwiftUICore.swiftinterface:390–397
@frozen public struct ZStackLayout : Layout {
  public var alignment: Alignment                       // default .center
  @inlinable public init(alignment: Alignment = .center)
  public typealias AnimatableData = EmptyAnimatableData
  public typealias Cache = Swift.Void
}
```

- **`alignment: Alignment = .center`** — a **2-D** `Alignment` (horizontal × vertical), since both axes
  matter when overlapping. Cases (KNOWN `:11233–11241`): `.center`, `.leading`, `.trailing`, `.top`,
  `.bottom`, `.topLeading`, `.topTrailing`, `.bottomLeading`, `.bottomTrailing`.
- **No `spacing` parameter** — children overlap, there is no gap (KNOWN: init has only `alignment`).

### 3.2 Visual anatomy & metrics

- **Sub-elements:** N children stacked in Z order; **later children draw on top** (first child = back).
- **Size:** `max(child widths) × max(child heights)` — the union bounding box; every child is aligned within
  that box by `alignment`.
- **No default gap.** Default alignment `.center`.

### 3.3 Behavior

Inert. Z order = source order (last on top). Hit-testing: topmost child wins by default.

### 3.4 Web replication mapping (DESIGNED)

Use a **single-cell CSS grid** (cleanest way to overlap while still sizing to the largest child — `position:
absolute` would collapse the parent's size):

```html
<div class="sui-zstack" data-align="center"></div>
```
```css
.sui-zstack { display: grid; width: max-content; }
.sui-zstack > * { grid-area: 1 / 1; }           /* all children in the same cell → overlap */
/* alignment maps to BOTH axes via place-items */
.sui-zstack[data-align="center"]        { place-items: center; }
.sui-zstack[data-align="leading"]       { place-items: center start; }
.sui-zstack[data-align="trailing"]      { place-items: center end; }
.sui-zstack[data-align="top"]           { place-items: start center; }
.sui-zstack[data-align="bottom"]        { place-items: end center; }
.sui-zstack[data-align="topLeading"]    { place-items: start; }      /* start start */
.sui-zstack[data-align="topTrailing"]   { place-items: start end; }
.sui-zstack[data-align="bottomLeading"] { place-items: end start; }
.sui-zstack[data-align="bottomTrailing"]{ place-items: end; }        /* end end */
```
> CSS `place-items` shorthand is `align-items` (block/vertical) `justify-items` (inline/horizontal). Z order is
> automatic (DOM order → paint order); no `z-index` needed unless a child sets `position`.

React API:
```tsx
type Alignment2D =
  | 'center' | 'leading' | 'trailing' | 'top' | 'bottom'
  | 'topLeading' | 'topTrailing' | 'bottomLeading' | 'bottomTrailing';
interface ZStackProps { alignment?: Alignment2D; children: React.ReactNode; }
function ZStack({ alignment = 'center', children }: ZStackProps) {
  return <div className="sui-zstack" data-align={alignment}>{children}</div>;
}
```

---

## 4. LazyVStack / LazyHStack — lazy (on-demand) stacks

### 4.1 Exact API (KNOWN)

```swift
// SwiftUICore.swiftinterface:8372–8375
public struct LazyVStack<Content> : View where Content : View {
  public init(alignment: HorizontalAlignment = .center,
              spacing: CGFloat? = nil,
              pinnedViews: PinnedScrollableViews = .init(),
              @ViewBuilder content: () -> Content)
}
// SwiftUICore.swiftinterface:3405–3408
public struct LazyHStack<Content> : View where Content : View {
  public init(alignment: VerticalAlignment = .center,
              spacing: CGFloat? = nil,
              pinnedViews: PinnedScrollableViews = .init(),
              @ViewBuilder content: () -> Content)
}
```

`PinnedScrollableViews` is an `OptionSet` (KNOWN `:16642`): `.sectionHeaders`, `.sectionFooters` (the two
options) controlling which `Section` headers/footers stick to the scroll edge.

### 4.2 Difference from the eager stack — the only thing that matters

`LazyVStack`/`LazyHStack` are **identical in alignment/spacing semantics** to `VStack`/`HStack` (same default
`.center`, same `nil`→8 gap). The difference is **materialization**: a lazy stack only creates child views as
they scroll into the visible region (must live inside a `ScrollView`). This avoids building thousands of rows.
Two corollaries:
- A lazy stack **does not** equalize cross-axis size by measuring all children (it can't — it hasn't built
  them). It uses each child's own width as it appears.
- Lazy stacks support **pinned section headers/footers** (sticky), eager stacks do not.

### 4.3 Web replication mapping (DESIGNED)

The DOM/CSS is identical to VStack/HStack; "lazy" = virtualization. Two valid strategies:
- **Cheap parity (default):** same flex container; rely on the browser. Works to a few hundred rows.
- **True laziness:** virtualize with `@tanstack/react-virtual` (or `content-visibility: auto` +
  `contain-intrinsic-size` for a zero-JS approximation) inside a `ScrollView` (`overflow: auto`).

```css
.sui-lazy-vstack { display: flex; flex-direction: column; align-items: center;
                   gap: var(--sui-stack-gap, 8px); }
.sui-lazy-vstack > * { content-visibility: auto; contain-intrinsic-size: auto 44px; } /* cheap virtualization */
/* pinned headers: */
.sui-lazy-vstack[data-pinned~="headers"] .sui-section-header { position: sticky; top: 0; z-index: 1; }
```
```tsx
interface LazyVStackProps {
  alignment?: HAlign;            // default 'center'
  spacing?: number | null;      // default null → 8
  pinnedViews?: ('sectionHeaders' | 'sectionFooters')[];  // default []
  children: React.ReactNode;
}
```
> Must be rendered inside a `<ScrollView>` (`overflow:auto`) to behave like SwiftUI. Pinned headers map
> exactly to `position: sticky`.

---

## 5. Spacer — flexible gap

### 5.1 Exact API (KNOWN)

```swift
// SwiftUICore.swiftinterface:3419–3425
@frozen public struct Spacer {
  public var minLength: CGFloat?
  @inlinable public init(minLength: CGFloat? = nil) { self.minLength = minLength }
  public typealias Body = Swift.Never
}
```

- **`minLength: CGFloat? = nil`** — the spacer's *minimum* length along the stack's axis. `nil` ⇒ the
  spacer may collapse to the default spacing but no less. When `> 0`, the spacer never shrinks below it.
- A `Spacer` has **no fixed length**; it expands to consume all available space on the stack's main axis.
- In an HStack it expands horizontally; in a VStack, vertically; **outside** a stack (top-level) it expands
  in both axes. (There's also an inlined `_TextBaselineRelativeSpacer` `:3433` and `_HSpacer` for baseline
  spacing — internal, not part of our API.)

### 5.2 Behavior

- One `Spacer` before content right-aligns it; one after left-aligns; one on each side centers; equal Spacers
  between items distribute them evenly. This is the idiom for `justify-content` in SwiftUI.

### 5.3 Web replication mapping (DESIGNED)

```css
/* a Spacer is an empty flex item that grows */
.sui-spacer { flex: 1 1 0%; align-self: stretch; }
.sui-spacer[data-min] { flex-basis: var(--sui-spacer-min, 0); }  /* minLength */
```
```tsx
interface SpacerProps { minLength?: number | null; }   // default null → 0 floor
function Spacer({ minLength }: SpacerProps) {
  return <div className="sui-spacer"
              style={minLength != null
                ? ({ minInlineSize: `${minLength}px`, minBlockSize: `${minLength}px` } as React.CSSProperties)
                : undefined} />;
}
```
> `flex: 1 1 0%` is the exact analog of "consume all free space, equally among multiple spacers." Direction is
> inherited from the parent stack's `flex-direction`, matching SwiftUI's "expands along the stack's axis."
> `minLength` → `min-inline-size`/`min-block-size` (only the axis-relevant one matters; setting both is safe).

---

## 6. Grid + GridRow — true 2-D grid (iOS 16+, cells aligned across rows)

`Grid` is the column-aligning grid: every cell in column *c* across all rows shares the same width
(the max of that column). This is exactly CSS Grid's behavior, so the mapping is near-perfect.

### 6.1 Exact API (KNOWN)

```swift
// SwiftUI.swiftinterface:17524–17535
@frozen public struct Grid<Content> where Content : View {
  internal var _tree: _VariadicView.Tree<GridLayout, Content>
  @inlinable public init(alignment: Alignment = .center,
                         horizontalSpacing: CGFloat? = nil,
                         verticalSpacing: CGFloat? = nil,
                         @ViewBuilder content: () -> Content)
}
// SwiftUI.swiftinterface:17541–17554
@frozen public struct GridRow<Content> where Content : View {
  internal var alignment: VerticalAlignment?
  internal var content: Content
  @inlinable public init(alignment: VerticalAlignment? = nil, @ViewBuilder content: () -> Content)
}
// SwiftUI.swiftinterface:17625–17633 — the engine
@frozen public struct GridLayout : Layout {
  public var alignment: Alignment                  // default .center
  public var horizontalSpacing: CGFloat?           // default nil
  public var verticalSpacing: CGFloat?             // default nil
  public init(alignment: Alignment = .center, horizontalSpacing: CGFloat? = nil, verticalSpacing: CGFloat? = nil)
}
```

- **`Grid(alignment:horizontalSpacing:verticalSpacing:)`** — `alignment` is the default 2-D alignment for
  every cell; `horizontalSpacing`/`verticalSpacing` are the column-gap / row-gap (both `nil`→~8 pt runtime).
- **`GridRow(alignment:content:)`** — one row; `alignment` overrides the row's vertical cell alignment. Each
  top-level view inside the row is **one cell**; the number of cells in the widest row sets the column count.
- A view placed **directly in the Grid** (not in a GridRow) spans the **full width** (all columns) — used for
  `Divider()` separators.

### 6.2 Per-cell modifiers (KNOWN — these ARE part of the Grid API)

```swift
// SwiftUI.swiftinterface:17561–17576
func gridCellColumns(_ count: Int) -> some View          // cell spans `count` columns (colspan)
func gridCellAnchor(_ anchor: UnitPoint) -> some View    // where in its cell the view anchors
func gridColumnAlignment(_ guide: HorizontalAlignment) -> some View  // force a column's H-alignment
func gridCellUnsizedAxes(_ axes: Axis.Set) -> some View  // axes the cell must NOT stretch the column for
```
- `gridCellColumns(n)` = `grid-column: span n` (colspan).
- `gridCellUnsizedAxes([.horizontal])` = "don't let this cell widen the column" (e.g. a full-width Divider
  should not force every column to be as wide as the divider).

### 6.3 Cell-sizing algorithm (INFERRED — WWDC22 #10056)

1. Column width *c* = `max` over all rows of cell *c*'s ideal width (ignoring `gridCellUnsizedAxes` cells).
2. Row height *r* = `max` of cell heights in that row.
3. Cells are placed in their `(c, r)` slot, aligned by the Grid's `alignment` (or per-cell `gridCellAnchor`
   / per-column `gridColumnAlignment` / per-row `GridRow.alignment` overrides).
4. Gaps: `horizontalSpacing` between columns, `verticalSpacing` between rows (both ~8 pt when nil).

### 6.4 Web replication mapping (DESIGNED)

```html
<div class="sui-grid" style="--sui-grid-hgap:8px; --sui-grid-vgap:8px;">
  <div class="sui-gridrow"><span>cell</span><span>cell</span></div>
  <div class="sui-gridrow"><span>cell</span><span>cell</span></div>
</div>
```
Two implementation options — prefer **subgrid** for true column alignment across rows:
```css
.sui-grid {
  display: grid;
  grid-template-columns: repeat(var(--sui-grid-cols), auto); /* cols = max cells in any row */
  column-gap: var(--sui-grid-hgap, 8px);
  row-gap: var(--sui-grid-vgap, 8px);
  justify-items: center; align-items: center;   /* Alignment .center default */
}
.sui-gridrow {
  display: grid;
  grid-column: 1 / -1;                 /* row occupies all columns */
  grid-template-columns: subgrid;      /* inherit the parent's column tracks → cross-row alignment */
  column-gap: inherit;
}
.sui-gridrow > * { /* a cell */ }
.sui-grid > .sui-divider { grid-column: 1 / -1; }   /* a bare view in Grid spans all columns */
.cell-colspan-2 { grid-column: span 2; }            /* gridCellColumns(2) */
```
React API:
```tsx
interface GridProps {
  alignment?: Alignment2D;        // default 'center'
  horizontalSpacing?: number | null;  // default null → 8
  verticalSpacing?: number | null;    // default null → 8
  columns: number;                // DESIGNED: we need the column count up front (CSS can't infer like SwiftUI)
  children: React.ReactNode;      // <GridRow>… or bare views (full-width)
}
interface GridRowProps { alignment?: VAlign | null; children: React.ReactNode; }
// cell helpers:  gridCellColumns(n) -> style={{ gridColumn: `span ${n}` }}
```
> **Fidelity caveat (DESIGNED):** SwiftUI infers column count from the widest row; CSS needs it declared.
> Either pass `columns` explicitly, or count cells in the children at render time. `grid-template-columns:
> subgrid` is what makes column *c* share width across all rows — exactly SwiftUI's contract. Use `auto`
> tracks so columns size to content (SwiftUI sizes columns to their max ideal cell width).

---

## 7. GridItem — column/row template descriptor for the Lazy grids

### 7.1 Exact API (KNOWN)

```swift
// SwiftUI.swiftinterface:22474–22483
public struct GridItem : Sendable {
  public enum Size : Sendable {
    case fixed(_ : CGFloat)
    case flexible(minimum: CGFloat = 10, maximum: CGFloat = .infinity)
    case adaptive(minimum: CGFloat, maximum: CGFloat = .infinity)
  }
  public var size: GridItem.Size
  public var spacing: CGFloat?
  public var alignment: Alignment?
  public init(_ size: GridItem.Size = .flexible(), spacing: CGFloat? = nil, alignment: Alignment? = nil)
}
```

**The three Size cases (KNOWN constants):**
- **`.fixed(w)`** — exactly `w` points wide (one track of fixed size).
- **`.flexible(minimum: 10, maximum: .infinity)`** — one flexible track that shares leftover space equally
  with other flexibles. **DEFAULT minimum is the literal `10`**, default maximum `.infinity`. `GridItem()` =
  `.flexible()`.
- **`.adaptive(minimum:maximum:)`** — one *array entry* that expands into **as many tracks as fit**, each
  between `minimum` and `maximum`. This is the "auto-fill" case.

- `spacing` = the gap **after** this track (column-to-column / row-to-row). `nil` ⇒ ~8.
- `alignment` = the 2-D alignment of items within this track's cells.

### 7.2 Web replication mapping (DESIGNED — GridItem[] → grid-template-columns)

`GridItem` only exists to build the `grid-template-columns` / `grid-template-rows` string for `LazyVGrid`/
`LazyHGrid` (§8). The mapping:

| GridItem.Size | CSS track |
|---|---|
| `.fixed(w)` | `{w}px` |
| `.flexible(min, max)` | `minmax({min}px, {max==∞ ? 1fr : max+'px'})` → typically `minmax(10px, 1fr)` |
| `.adaptive(min, max)` | collapses the *whole array entry* into `repeat(auto-fill, minmax({min}px, {max==∞?'1fr':max}))` |

```ts
function gridItemToTrack(item: GridItemSpec): string {
  switch (item.size.kind) {
    case 'fixed':    return `${item.size.value}px`;
    case 'flexible': return `minmax(${item.size.minimum ?? 10}px, ${item.size.maximum === Infinity ? '1fr' : item.size.maximum + 'px'})`;
    case 'adaptive': return `repeat(auto-fill, minmax(${item.size.minimum}px, ${item.size.maximum === Infinity ? '1fr' : item.size.maximum + 'px'}))`;
  }
}
// columns array → template string:
const template = items.map(gridItemToTrack).join(' ');
```
```tsx
type GridItemSpec = {
  size: { kind: 'fixed'; value: number }
      | { kind: 'flexible'; minimum?: number; maximum?: number }   // defaults 10 / Infinity
      | { kind: 'adaptive'; minimum: number; maximum?: number };
  spacing?: number | null;
  alignment?: Alignment2D | null;
};
// constructors mirroring SwiftUI:
const GridItem = {
  fixed:    (value: number, spacing?: number, alignment?: Alignment2D) => ({ size:{kind:'fixed',value}, spacing, alignment }),
  flexible: (minimum = 10, maximum = Infinity, spacing?: number) => ({ size:{kind:'flexible',minimum,maximum}, spacing }),
  adaptive: (minimum: number, maximum = Infinity, spacing?: number) => ({ size:{kind:'adaptive',minimum,maximum}, spacing }),
};
```

---

## 8. LazyVGrid / LazyHGrid — scrollable on-demand grids

### 8.1 Exact API (KNOWN)

```swift
// SwiftUI.swiftinterface:22504–22507
public struct LazyVGrid<Content> : View where Content : View {
  public init(columns: [GridItem], alignment: HorizontalAlignment = .center,
              spacing: CGFloat? = nil, pinnedViews: PinnedScrollableViews = .init(),
              @ViewBuilder content: () -> Content)
}
// SwiftUI.swiftinterface:22494–22497
public struct LazyHGrid<Content> : View where Content : View {
  public init(rows: [GridItem], alignment: VerticalAlignment = .center,
              spacing: CGFloat? = nil, pinnedViews: PinnedScrollableViews = .init(),
              @ViewBuilder content: () -> Content)
}
```

- **`LazyVGrid(columns:)`** — vertical-scrolling grid; you describe the **columns** as `[GridItem]`; content
  flows top-to-bottom, wrapping across the fixed column template. `alignment` = HorizontalAlignment of items
  within columns; `spacing` = the **row** spacing between lines.
- **`LazyHGrid(rows:)`** — mirror: you describe the **rows**, content flows left-to-right.
- Both lazy (must be inside a `ScrollView`); both support `pinnedViews` sticky section headers/footers.

### 8.2 Web replication mapping (DESIGNED)

```html
<div class="sui-lazy-vgrid" style="--cols: minmax(10px,1fr) minmax(10px,1fr); --row-gap:8px;"></div>
```
```css
.sui-lazy-vgrid {
  display: grid;
  grid-template-columns: var(--cols);     /* built from columns:[GridItem] via gridItemToTrack */
  row-gap: var(--row-gap, 8px);           /* `spacing` = inter-row gap */
  column-gap: var(--col-gap, 8px);        /* per-GridItem.spacing, simplified to one value */
  justify-items: center;                  /* HorizontalAlignment default .center */
}
.sui-lazy-hgrid {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: var(--rows);        /* from rows:[GridItem] */
  column-gap: var(--col-gap, 8px);
}
```
```tsx
interface LazyVGridProps {
  columns: GridItemSpec[];
  alignment?: HAlign;            // default 'center'
  spacing?: number | null;       // row spacing; default null → 8
  pinnedViews?: ('sectionHeaders' | 'sectionFooters')[];
  children: React.ReactNode;
}
function LazyVGrid({ columns, alignment='center', spacing=null, children }: LazyVGridProps) {
  const cols = columns.map(gridItemToTrack).join(' ');
  return <div className="sui-lazy-vgrid"
              data-align={alignment}
              style={{ '--cols': cols, '--row-gap': `${spacing ?? 8}px` } as React.CSSProperties}>
           {children}
         </div>;
}
```
> `repeat(auto-fill, minmax(min,1fr))` from a single `.adaptive` GridItem is the exact CSS analog of SwiftUI's
> adaptive column — both pack as many equal tracks as fit at ≥`min` wide. Must live inside a `ScrollView`
> (`overflow:auto`). For true laziness, virtualize rows.

---

## 9. ViewThatFits — pick the first child that fits

### 9.1 Exact API (KNOWN)

```swift
// SwiftUI.swiftinterface:11223–11231
@frozen public struct ViewThatFits<Content> : View where Content : View {
  internal var _tree: _VariadicView.Tree<_SizeFittingRoot, Content>
  @inlinable public init(in axes: Axis.Set = [.horizontal, .vertical],
                         @ViewBuilder content: () -> Content) {
        _tree = .init(_SizeFittingRoot(axes: axes)) { content() }
  }
  public typealias Body = Swift.Never
}
```

- **`in axes: Axis.Set = [.horizontal, .vertical]`** — which axes to test fit against (default both). If only
  `.horizontal`, it picks based on width fit alone (height unconstrained).
- **Semantics:** evaluates its candidate children **in order**; renders the **first** one whose ideal size
  fits the proposed size in the specified axes. The last child is the fallback (always rendered if none fit).

### 9.2 Behavior

Runtime measures each candidate's `sizeThatFits` against the parent's proposal; selects the first that fits.
Re-evaluates on resize. Classic use: a wide HStack label that collapses to a VStack or an icon when narrow.

### 9.3 Web replication mapping (DESIGNED)

CSS has no native "pick first that fits." Two strategies:
- **Container queries (preferred, zero-JS when fit is width-driven):** wrap candidates, show/hide by
  `@container` width breakpoints — but you must know the breakpoints (SwiftUI measures, CSS can't).
- **Measure-and-pick (true parity):** `ResizeObserver` on the container; render each candidate off-screen,
  measure, pick the first that fits, mount only that one.

```tsx
function ViewThatFits({ axes = ['horizontal','vertical'], children }:
  { axes?: ('horizontal'|'vertical')[]; children: React.ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState(children.length - 1);   // fallback = last
  useLayoutEffect(() => {
    const el = ref.current!; const ro = new ResizeObserver(() => choose());
    function choose() {
      const { width, height } = el.getBoundingClientRect();
      for (let i = 0; i < children.length; i++) {
        const m = measureOffscreen(children[i]);            // render hidden, read scrollWidth/Height
        const wOk = !axes.includes('horizontal') || m.width  <= width;
        const hOk = !axes.includes('vertical')   || m.height <= height;
        if (wOk && hOk) { setPick(i); return; }
      }
      setPick(children.length - 1);
    }
    ro.observe(el); choose(); return () => ro.disconnect();
  }, [children, axes]);
  return <div ref={ref} className="sui-view-that-fits">{children[pick]}</div>;
}
```
> The fallback-is-last rule is load-bearing: if nothing fits, SwiftUI renders the **last** child. Encode that
> as the initial `pick` state.

---

## 10. GeometryReader — read the proposed size, build content from it

### 10.1 Exact API (KNOWN)

```swift
// SwiftUICore.swiftinterface:7885–7892
@frozen public struct GeometryReader<Content> : View where Content : View {
  public var content: (GeometryProxy) -> Content
  @inlinable public init(@ViewBuilder content: @escaping (GeometryProxy) -> Content) {
        self.content = content
  }
  public typealias Body = Swift.Never
}
```

`GeometryProxy` (referenced, not in cluster) exposes `.size: CGSize`, `.safeAreaInsets`, `.frame(in:)`, and
`subscript(anchor:)`. The key behavioral fact: **GeometryReader greedily takes ALL the space its parent
proposes** (unlike most views, which take their ideal size), and reports that size to the closure. Its
children are then positioned at `.topLeading` by default (NOT center — this is a famous gotcha).

### 10.2 Behavior

- Proposes the full available size to itself, hands the resolved `size` to the render closure synchronously
  during layout, and lays the returned content in that frame anchored top-leading.
- Re-runs the closure whenever the size changes (rotation, resize, parent reflow).

### 10.3 Web replication mapping (DESIGNED — render-prop + ResizeObserver)

```tsx
interface GeometryProxy { size: { width: number; height: number };
                          safeAreaInsets?: { top: number; leading: number; bottom: number; trailing: number }; }
function GeometryReader({ content }: { content: (proxy: GeometryProxy) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([e]) =>
      setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="sui-geometry-reader"
         style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
        {content({ size })}    {/* children anchored top-leading — matches SwiftUI */}
      </div>
    </div>
  );
}
```
> Two fidelity rules: (1) the container fills its parent (`width:100%; height:100%`) — GeometryReader is
> greedy. (2) Inner content is **top-leading anchored** (`flex-start`/`flex-start`), the single biggest
> SwiftUI gotcha. First render reports `0×0` until the `ResizeObserver` fires (SwiftUI has a synchronous
> measure pass we can't replicate; gate first paint or render an invisible first frame).

---

## 11. Group — transparent grouping (apply modifiers to many views)

### 11.1 Exact API (KNOWN)

```swift
// SwiftUICore.swiftinterface:2675–2679
@frozen public struct Group<Content> {
  public typealias Body = Swift.Never
  package var content: Content
  @inlinable package init(_content: Content) { self.content = _content }
}
```

The public `init(@ViewBuilder content:)` and `View` conformance live in `where Content : View` extensions
(not in the cluster's line range; the struct shell is here). **Group is purely structural**: it applies a
modifier to many children **without** introducing a layout container. `Group { A; B; C }.padding()` pads each
of A, B, C — it does NOT wrap them in a box. It also sidesteps the 10-subview ViewBuilder limit (pre-variadic)
by grouping. Group does not affect layout, spacing, or alignment — its children are laid out by whatever
parent contains the Group.

### 11.2 Web replication mapping (DESIGNED)

`Group` ≈ React **Fragment** (`<>…</>`) — zero DOM, just passes children through. To replicate
"modifier applies to each child," clone children and merge the modifier props/classes:

```tsx
function Group({ children, className, style }:
  { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  // transparent: applies className/style to each child, adds no wrapper element
  if (!className && !style) return <>{children}</>;
  return <>{React.Children.map(children, c =>
    React.isValidElement(c)
      ? React.cloneElement(c as any, {
          className: [c.props.className, className].filter(Boolean).join(' '),
          style: { ...c.props.style, ...style },
        })
      : c)}</>;
}
```
> Do NOT render a wrapping `<div>` — that would create a layout box SwiftUI's Group never creates. Fragment
> + per-child prop merge is the faithful mapping.

---

## 12. Section — header / content / footer grouping (in List/Form/Picker/Grids)

### 12.1 Exact API (KNOWN — generic over `<Parent, Content, Footer>`)

```swift
// SwiftUI.swiftinterface:11007
public struct Section<Parent, Content, Footer> { }
// View conformance requires all three be Views (:11013)
```

Key initializers (KNOWN, from the `where` extensions):
```swift
// :11019  full:
init(content: () -> Content, header: () -> Parent, footer: () -> Footer)
// :11025  content+footer:
init(content: () -> Content, footer: () -> Footer)         where Parent == EmptyView
// :11031  content+header:
init(content: () -> Content, header: () -> Parent)         where Footer == EmptyView
// :11037  content only:
init(content: () -> Content)                               where Parent == EmptyView, Footer == EmptyView
// :11043  String/LocalizedStringKey title header:
init(_ titleKey: LocalizedStringKey, content: () -> Content)   where Parent == Text, Footer == EmptyView
init<S>(_ title: S, content: () -> Content) where S : StringProtocol
// :11055  collapsible (iOS 17+):
init(_ titleKey: LocalizedStringKey, isExpanded: Binding<Bool>, content: () -> Content)
// :11107  isExpanded + custom header (iOS 17+):
init(isExpanded: Binding<Bool>, content: () -> Content, header: () -> Parent)
```

- **`Parent` = header, `Content` = body, `Footer` = footer.** Any of header/footer may be `EmptyView`.
- **`isExpanded: Binding<Bool>`** (iOS 17+) makes a **collapsible** (disclosure) section — header taps toggle
  the binding and animate content in/out.
- The legacy `init(header:footer:content:)` (value-form) is deprecated in favor of the closure forms.

### 12.2 Visual anatomy & metrics (INFERRED — List/Form context)

In a grouped List/Form (the dominant context):
- **Header:** `text.footnote`-ish, uppercased on iOS grouped style, `var(--sui-color-secondary-label)`, inset
  to the section's leading margin, ~`8pt` below it.
- **Content:** rows in a rounded container (grouped inset style) with separators between rows.
- **Footer:** `var(--sui-color-secondary-label)`, small text below the content block.
- **Collapsible:** a disclosure chevron (rotates 90° when expanded) at the trailing edge of the header.

### 12.3 Web replication mapping (DESIGNED)

```html
<section class="sui-section" data-collapsible="true" data-expanded="true">
  <header class="sui-section-header">
    <span>TITLE</span>
    <svg class="sui-section-chevron" /> <!-- only if collapsible -->
  </header>
  <div class="sui-section-content"><!-- rows --></div>
  <footer class="sui-section-footer">…</footer>
</section>
```
```css
.sui-section-header {
  display: flex; align-items: center; justify-content: space-between;
  font: var(--sui-text-footnote);
  color: var(--sui-color-secondary-label);
  text-transform: uppercase;            /* iOS grouped list style */
  padding: 8px 16px 4px;
}
.sui-section-footer { font: var(--sui-text-footnote); color: var(--sui-color-secondary-label); padding: 4px 16px 8px; }
.sui-section-chevron { transition: transform .25s ease; transform: rotate(0deg); }
.sui-section[data-expanded="true"]  .sui-section-chevron { transform: rotate(90deg); }
.sui-section[data-expanded="false"] .sui-section-content { display: none; }
```
```tsx
interface SectionProps {
  header?: React.ReactNode;        // Parent
  footer?: React.ReactNode;        // Footer
  isExpanded?: boolean;            // controlled collapsible (iOS 17+)
  onExpandedChange?: (v: boolean) => void;
  children: React.ReactNode;       // Content
}
```
> The disclosure chevron rotation (0°→90°) animates with a ~0.25s ease (matches the section expand spring).
> Header text in grouped style is uppercased + secondary-label colored; in plain/`Form` non-grouped contexts
> it is sentence case — gate via a `data-style` attribute. Collapsible content show/hide should animate height
> (use `grid-template-rows: 0fr → 1fr` transition for smooth collapse).

---

## 13. AnyLayout + the Layout-conforming structs (VStackLayout / HStackLayout / ZStackLayout)

### 13.1 AnyLayout — type-erased layout (animate BETWEEN layouts)

```swift
// SwiftUICore.swiftinterface:8072–8088
@frozen public struct AnyLayout : Layout, Sendable {
  public init<L>(_ layout: L) where L : Layout
  public struct Cache : Sendable { }
  public typealias AnimatableData = _AnyAnimatableData
  public func sizeThatFits(proposal:subviews:cache:) -> CGSize
  public func placeSubviews(in:proposal:subviews:cache:)
  // + makeCache/updateCache/spacing/explicitAlignment(of:…)/animatableData
}
```

- **Purpose:** wrap any `Layout` so you can swap between, e.g., `HStackLayout()` and `VStackLayout()` based on
  a condition **while keeping view identity** — SwiftUI then animates the children from one arrangement to the
  other (a horizontal→vertical morph). `AnyLayout(isWide ? AnyLayout(HStackLayout()) : AnyLayout(VStackLayout()))`.
- The three stack twins **`VStackLayout`/`HStackLayout`/`ZStackLayout`** (KNOWN `:1173`/`:5449`/`:390`) are the
  `Layout`-conforming structs you pass into `AnyLayout`. They carry the same `alignment`/`spacing` params as
  their `View` counterparts (covered verbatim in §1.1 / §2.1 / §3.1).

### 13.2 Web replication mapping (DESIGNED)

`AnyLayout` switching maps to **toggling the flex-direction / display of one stable element** so the DOM nodes
(view identity) persist and CSS transitions animate the move:

```tsx
type LayoutKind = 'hstack' | 'vstack' | 'zstack';
function AnyLayout({ kind, alignment, spacing, children }:
  { kind: LayoutKind; alignment?: string; spacing?: number | null; children: React.ReactNode }) {
  // SAME element, only the class/style flips → children keep identity → transitions animate
  return <div className={`sui-anylayout sui-${kind}`} data-align={alignment}
              style={{ '--sui-stack-gap': `${spacing ?? 8}px` } as React.CSSProperties}>
           {children}
         </div>;
}
```
```css
.sui-anylayout { display: flex; gap: var(--sui-stack-gap,8px);
                 transition: none; }              /* the MOVE is animated by FLIP, not CSS flex */
.sui-anylayout.sui-hstack { flex-direction: row; }
.sui-anylayout.sui-vstack { flex-direction: column; }
.sui-anylayout.sui-zstack { display: grid; }
.sui-anylayout.sui-zstack > * { grid-area: 1/1; }
```
> Because flexbox reflow isn't animatable by plain CSS, true SwiftUI-parity layout morphing needs a **FLIP**
> technique (measure first/last positions, apply inverse transform, transition to identity) — `framer-motion`'s
> `layout` prop or `react-flip-toolkit` does this automatically. Keep the element stable (same key) so the
> children's DOM identity persists across the layout switch — that is the whole point of `AnyLayout`.

---

## 14. Structural / type-erasure helpers (tabulated — no own visual output)

These types are part of the layout cluster but render **nothing of their own**; they are the plumbing that
the ViewBuilder/variadic-view system uses to assemble the children that the layouts above measure. They have
no anatomy, metrics, or states. Their web equivalent is React's own composition model. Covered at the depth
their role warrants:

| Type | swiftinterface | Purpose | Web equivalent |
|---|---|---|---|
| **ViewBuilder** | SwiftUICore `:4546–4559` | The `@resultBuilder` that turns `{ A; B; C }` into a `TupleView`. `buildBlock()` → `EmptyView`; one child → passthrough; many → `TupleView<(repeat each Content)>` (variadic generics). `buildIf/buildEither` (elsewhere) → conditional content. | JSX itself — `{children}` / `<>…</>`. The `repeat each Content` tuple = a React children array. No runtime analog needed. |
| **TupleView** | SwiftUICore `:2583–2592` | `@frozen struct TupleView<T> : View` holding `value: T` (the tuple of children). `_makeViewList` expands the tuple into the ordered subview list a stack iterates. The flatten target of `ViewBuilder.buildBlock`. | `React.Children.toArray(children)` — an ordered list. Implicit. |
| **_VariadicView** | SwiftUICore `:6518–6536` | The enum namespace + `Tree<Root, Content>` (`root: Root; content: Content`) that wraps a layout root (`_VStackLayout`, `GridLayout`, `_SizeFittingRoot`, …) over ViewBuilder content. Every stack/grid in this file is literally a `_VariadicView.Tree`. `Root` decides how the flattened children are arranged. | The `(layoutComponent, children)` pair — i.e. `<Stack>{children}</Stack>`. The `Tree` = our layout `<div>` + its children. |
| **AnyView** | SwiftUICore `:14443–14454` | Type-erased view (`init<V>(_ view: V)`, `init(erasing:)`). Lets you return heterogeneous view types from one branch / store views in arrays. **Cost:** breaks structural identity → SwiftUI can't diff efficiently across updates (re-creates subtree). | `React.ReactNode` is already type-erased — every component returns it freely. AnyView's identity-loss penalty ≈ React remounting when the element *type* at a position changes. No wrapper needed; just `{node}`. |
| **EquatableView** | SwiftUI `:15940–15948` | `struct EquatableView<Content> where Content : Equatable & View`, `init(content:)`. Tells SwiftUI to skip re-rendering when `content == oldContent` (custom `Equatable`), a perf escape hatch (via `.equatable()`). | `React.memo(Component, (a,b)=>a===b)` — exact analog (skip re-render when props are equal). |

**Why tabulated, not deep-covered:** none of these has HTML/CSS to render — they are compile-time/diffing
constructs whose entire "web mapping" is "React already does this." The next agent writes **no component** for
them; they inform how `VStack`/`Grid`/etc. accept and flatten `children` (use `React.Children` utilities,
`React.memo` for `.equatable()`, and a Fragment for `Group`/`AnyView`).

---

## 15. Implementation checklist for the component-writing agent

1. **Tokens first:** define `--sui-space-stack-default: 8px` and wire stack `gap` to it.
2. **VStack/HStack/ZStack:** the three flex/grid containers above — get `align-items`/`place-items` + `gap` +
   `width: max-content` exactly right (default alignment is **center**, not leading).
3. **Spacer:** `flex: 1 1 0%` empty item.
4. **Grid/GridRow:** CSS Grid + `subgrid` for cross-row column alignment; bare-view-in-Grid spans all columns.
5. **GridItem → track string:** the `gridItemToTrack` helper (fixed/flexible/adaptive → px / minmax / repeat
   auto-fill). Default `.flexible` minimum = **10**.
6. **LazyVGrid/LazyHGrid:** `grid-template-columns/rows` from `GridItem[]`; wrap in a `ScrollView`; virtualize
   for true laziness.
7. **LazyVStack/LazyHStack:** flex container + `content-visibility:auto` / virtualization; `position:sticky`
   for `pinnedViews`.
8. **ViewThatFits:** `ResizeObserver` measure-and-pick; **fallback = last child**.
9. **GeometryReader:** greedy `100%×100%` container + `ResizeObserver`; inner content **top-leading** anchored.
10. **Section:** `<section>` + header/content/footer; collapsible via `isExpanded`/chevron rotation.
11. **Group/AnyView:** React Fragment (no wrapper div). **EquatableView:** `React.memo`. **AnyLayout:** stable
    element + FLIP animation (framer-motion `layout`).

**Master CSS-mapping invariants (do not violate):**
- stack default alignment = **center** (both axes for ZStack).
- stack default gap = **8px** (token), `spacing: nil` → 8.
- children default to intrinsic size (`max-content`); growth is opt-in (`flex:1` / `align-self:stretch` for
  `.frame(maxWidth:.infinity)`).
- ZStack = single-cell grid (NOT absolute positioning — preserves parent sizing).
- `.firstTextBaseline` → `align-items: baseline`.

---

## Coverage map

- **Deep-covered (full API + anatomy + behavior + HTML/CSS/React mapping):** Layout algorithm (§0),
  VStack, HStack, ZStack, LazyVStack, LazyHStack, Spacer, Grid, GridRow, GridItem, LazyVGrid, LazyHGrid,
  ViewThatFits, GeometryReader, Group, Section, AnyLayout (+ VStackLayout/HStackLayout/ZStackLayout as the
  Layout-conforming twins, and the `Layout` protocol / `ProposedViewSize` / `ViewSpacing` / `LayoutSubview`
  support types).
- **Tabulated (plumbing — no own visual output, web equivalent is React's composition model):** ViewBuilder,
  TupleView, _VariadicView, AnyView, EquatableView.

Every deep-covered component has its HTML structure + exact CSS + React prop API.
