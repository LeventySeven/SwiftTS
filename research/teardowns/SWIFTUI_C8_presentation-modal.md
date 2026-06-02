# SwiftUI Cluster C8 — Presentation / Modal

**Goal:** pixel-1:1 web replica of SwiftUI's modal presentation surface (sheets, full-screen covers, popovers, alerts, confirmation dialogs, context menus) as a TypeScript/React (Next.js) UI kit. This file is the spec the implementation agent pastes from.

**Authoritative interface (Tier-1A, read verbatim):**
`/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/System/Library/Frameworks/SwiftUI.framework/Versions/A/Modules/SwiftUI.swiftmodule/arm64e-apple-macos.swiftinterface` (abbreviated `SwiftUI.swiftinterface` below).

**Label key:** KNOWN = read from swiftinterface / measurable system default. INFERRED = Apple docs / HIG / reputable RE. DESIGNED = our engineering for a web gap.

**Token references** (from `swiftui/tokens/*.md`): springs `anim.smooth/snappy/bouncy` (all `duration 0.5`, settling 0.735s/0.697s/0.819s), materials `--sui-material-*-blur` (`backdrop-filter: blur() saturate()`), colors `--sui-color-label / --sui-color-secondary-label / --sui-color-tint`.

> **Architectural note — these are MODIFIERS, not Views.** Every item in this cluster is a `View` extension method that *attaches* a presentation to an anchor view and toggles it via a `Binding<Bool>` or `Binding<Item?>`. The web analog is a **portal + overlay** pattern: each modifier becomes a React hook/component that renders its content into a top-level `<div id="sui-presentation-root">` portal, NOT inline. The four shared concerns across all of them:
> 1. **A presentation host/portal** (one per app, z-stacked).
> 2. **A scrim** (the dimming layer) — present for sheet/fullScreenCover/alert/confirmationDialog, absent for popover on macOS (popover uses a transparent passthrough + arrow).
> 3. **A transition** (slide-up spring for sheet/dialog, cross-fade+cover for fullScreenCover, scale-from-anchor for popover/contextMenu, fade+scale for alert).
> 4. **Dismissal** (tap-scrim, swipe-down, Esc, or button action) wired to set the binding `false`/`nil`.

---

## 1. `sheet` — the slide-up bottom sheet (HIGH-VALUE DELIVERABLE)

### 1.1 Exact API — KNOWN

`SwiftUI.swiftinterface:7409-7411` (View extension, `iOS 13.0, macOS 10.15+`):

```swift
nonisolated public func sheet<Item, Content>(
    item: Binding<Item?>,
    onDismiss: (() -> Void)? = nil,
    @ViewBuilder content: @escaping (Item) -> Content
) -> some View where Item : Identifiable, Content : View          // :7409

nonisolated public func sheet<Content>(
    isPresented: Binding<Bool>,
    onDismiss: (() -> Void)? = nil,
    @ViewBuilder content: @escaping () -> Content
) -> some View where Content : View                              // :7411
```

Two overloads, identical except the trigger:
- **`isPresented:`** — `Binding<Bool>`; sheet shows while `true`, hides → sets `false` when dismissed.
- **`item:`** — `Binding<Item?>` where `Item: Identifiable`; sheet shows while non-nil; `content` receives the unwrapped item. Changing the item's `id` re-presents (dismiss + re-present). Set to `nil` to dismiss.
- **`onDismiss:`** — fires AFTER the dismiss animation completes (swipe-down, scrim tap on iOS, programmatic, or `.dismiss` env action). Does NOT fire on re-present via item-id change before dismiss.

### 1.2 The detent system (the part that makes it a "bottom sheet")

`SwiftUI.swiftinterface:21239-21258` — `PresentationDetent` (KNOWN verbatim):

```swift
public struct PresentationDetent : Hashable, Sendable {
  public static let medium: PresentationDetent                                  // :21240
  public static let large: PresentationDetent                                   // :21241
  public static func fraction(_ fraction: CGFloat) -> PresentationDetent        // :21242
  public static func height(_ height: CGFloat) -> PresentationDetent            // :21243
  public static func custom<D>(_ type: D.Type) -> PresentationDetent
      where D : CustomPresentationDetent                                        // :21244
  @dynamicMemberLookup public struct Context {
    public var maxDetentValue: CGFloat { get }                                  // :21246 — full available height
    public subscript<T>(dynamicMember keyPath: KeyPath<EnvironmentValues, T>) -> T { get }
  }
}
```

`CustomPresentationDetent` protocol — `SwiftUI.swiftinterface:21307-21312` (KNOWN):
```swift
public protocol CustomPresentationDetent {
  static func height(in context: Self.Context) -> CGFloat?   // return nil → detent inactive
}
extension CustomPresentationDetent { public typealias Context = PresentationDetent.Context }
```

**Detent semantics (INFERRED — Apple docs + HIG):**
| Detent | Resolved height | Notes |
|---|---|---|
| `.medium` | ≈ 50% of `maxDetentValue` (half-screen) | INACTIVE in compact height (landscape phone) — sheet snaps to `.large`. |
| `.large` | full available height under the status bar / top inset | The default when no detents set. |
| `.fraction(f)` | `f * maxDetentValue`, clamped `0…1` | e.g. `.fraction(0.3)` = 30% tall. |
| `.height(h)` | exactly `h` points, clamped to `maxDetentValue` | absolute. |
| `.custom(D.self)` | `D.height(in:)` returns points; `nil` → detent dropped | lets you compute from env (e.g. dynamic type size via the dynamicMember subscript). |

### 1.3 `presentationDetents` modifier — KNOWN

`SwiftUI.swiftinterface:21218-21220` (View ext, `iOS 16.0+`):
```swift
nonisolated public func presentationDetents(_ detents: Set<PresentationDetent>) -> some View         // :21218
nonisolated public func presentationDetents(_ detents: Set<PresentationDetent>,
                                            selection: Binding<PresentationDetent>) -> some View      // :21220
```
- `detents` is a **Set** — order is implied by resolved height ascending, NOT insertion order. With ≥2 detents the sheet is **resizable** (drag the grabber / scroll to snap between them).
- `selection:` overload two-way-binds the *current* detent → you can programmatically snap, or read which detent the user dragged to.
- **Drag indicator auto-appears when `count > 1`** (INFERRED, Apple docs) unless overridden.

### 1.4 Companion presentation modifiers — KNOWN

```swift
// :21222  iOS 16+
nonisolated public func presentationDragIndicator(_ visibility: Visibility) -> some View
//   .automatic (show iff >1 detent) | .visible (force grabber) | .hidden (force off)

// :21233  iOS 16.4+
nonisolated public func presentationCornerRadius(_ cornerRadius: CGFloat?) -> some View
//   nil → system default (≈10pt large / matches device). Sets top-left+top-right radius.

// :22946 & :22948  iOS 16.4+
nonisolated public func presentationBackground<S>(_ style: S) -> some View where S : ShapeStyle
nonisolated public func presentationBackground<V>(alignment: Alignment = .center,
                                                 @ViewBuilder content: () -> V) -> some View where V : View
//   Replaces the sheet's default material backing. e.g. .presentationBackground(.thinMaterial)

// :21227  iOS 16.4+
nonisolated public func presentationBackgroundInteraction(_ interaction: PresentationBackgroundInteraction) -> some View

// :21229 / :21231  iOS 16.4+ — compact-size-class adaptation (iPhone landscape / popover collapse)
nonisolated public func presentationCompactAdaptation(_ adaptation: PresentationAdaptation) -> some View
nonisolated public func presentationCompactAdaptation(horizontal: PresentationAdaptation,
                                                     vertical: PresentationAdaptation) -> some View

// :21235  iOS 16.4+
nonisolated public func presentationContentInteraction(_ behavior: PresentationContentInteraction) -> some View
```

Supporting enums — KNOWN verbatim:

`PresentationBackgroundInteraction` — `:21294-21305`:
```swift
public struct PresentationBackgroundInteraction : Sendable {
  public static var automatic: Self { get }   // disabled, except non-top detents on iPhone allow interaction
  public static var enabled: Self { get }      // background always tappable (no scrim block)
  public static func enabled(upThrough detent: PresentationDetent) -> Self  // interactive only up to this detent
  public static var disabled: Self { get }     // background never interactive (default scrim blocks)
}
```

`PresentationContentInteraction` — `:21281-21292`:
```swift
public struct PresentationContentInteraction : Equatable, Sendable {
  public static var automatic: Self { get }
  public static var resizes: Self { get }   // a swipe up resizes the sheet first, then scrolls
  public static var scrolls: Self { get }   // a swipe up scrolls content first, then resizes
}
```

`PresentationAdaptation` — `:21263-21279`:
```swift
public struct PresentationAdaptation : Sendable {
  public static var automatic: Self { get }
  public static var none: Self { get }
  public static var popover: Self { get }
  public static var sheet: Self { get }
  public static var fullScreenCover: Self { get }
}
```

### 1.5 Visual anatomy & default metrics

Sub-elements rendered, bottom→top z-order:
1. **Scrim** — a dimming layer over the presenting content. INFERRED default: `rgba(0,0,0,0.4)` black at the `.large`/`.medium` detent; on iPhone the scrim fades in proportionally as the sheet rises and is ~transparent at small custom detents.
2. **Sheet card** — rounded-top container. KNOWN/INFERRED metrics:
   - **Corner radius:** system default ≈ **10pt** top-left+top-right (matches `UISheetPresentationController.preferredCornerRadius` default; overridable via `presentationCornerRadius`). Bottom corners are flush with the screen edge (0).
   - **Background:** opaque system-background material by default (light: `#FFFFFF`-ish elevated; dark: `#1C1C1E`-ish), replaceable via `presentationBackground`.
   - **Shadow:** soft ambient shadow at the top lip; INFERRED `0 -1px 10px rgba(0,0,0,0.12)` plus the scrim provides the depth read.
3. **Grabber / drag indicator** — KNOWN UIKit default geometry: a **36 × 5 pt** rounded capsule (radius 2.5pt), centered horizontally, **~5pt from the top edge**, color INFERRED `--sui-color-secondary-label` at ~30% (a translucent gray `rgba(120,120,128,0.4)`-class fill).
4. **Stacked-card scaling (iPhone, when a sheet presents over another sheet OR over the root):** the *presenter* behind scales down and its top corners round. INFERRED metrics: presenter scales to ≈ **0.92** scale, translates down a few points, top corners animate to ≈10pt radius, and dims slightly — producing the "card peeking behind" look. The newly-presented sheet slides up from `y=100%` to its detent.

**Visual states:**
- *Presenting* (slide-up in progress) · *Resting at detent* · *Dragging* (rubber-banding past `.large`, resisting past max) · *Dismissing* (slide-down) · *Background-blocked* (scrim opaque, presenter non-interactive) vs *background-interactive* (`presentationBackgroundInteraction(.enabled)` → no scrim block).

### 1.6 Behavior / animation

- **Present:** sheet `translateY` from `100%` → detent position. Spring = `anim.smooth`-class (iOS interactive sheet spring; not a linear curve). Use token `anim.smooth.css` (settling **0.735s**, `cubic-bezier(0.33,0,0.13,1)` fallback). Scrim cross-fades `0 → 0.4` over the same window.
- **Drag:** finger tracks the sheet 1:1 between detents; on release, springs (`anim.snappy`-class, settling **0.697s**) to the nearest detent by velocity-projected position. Past `.large` it **rubber-bands** (offset *= ~0.3 damping). Drag below the smallest detent past a threshold (≈ the sheet's height * 0.3 OR downward velocity past threshold) triggers dismiss.
- **Dismiss:** `translateY → 100%`, scrim `0.4 → 0`. `onDismiss` fires on `transitionend`. `interactiveDismissDisabled()` (separate cluster) can block swipe/scrim dismiss.
- **Detent snapping with `presentationContentInteraction`:** `.resizes` = upward swipe grows the sheet until max, then inner scroll engages; `.scrolls` = inner scroll consumes the swipe first, sheet only resizes when content is at scroll-top.

### 1.7 Web replication mapping

**HTML structure** (rendered into the portal):
```html
<div class="sui-sheet-host" role="dialog" aria-modal="true">
  <div class="sui-sheet-scrim" data-state="presented"></div>
  <div class="sui-sheet-card" style="--detent-h: 50vh;">
    <div class="sui-sheet-grabber" aria-hidden="true"></div>
    <div class="sui-sheet-content"><!-- content() --></div>
  </div>
</div>
```

**CSS** (custom props mirror the SwiftUI metrics):
```css
.sui-sheet-host { position: fixed; inset: 0; z-index: 1000; }

.sui-sheet-scrim {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.40);            /* scrim default */
  opacity: 0;
  transition: opacity 0.735s cubic-bezier(0.33,0,0.13,1);
}
.sui-sheet-scrim[data-state="presented"] { opacity: 1; }
.sui-sheet-scrim[data-interactive="true"] { pointer-events: none; background: transparent; }

.sui-sheet-card {
  position: absolute; left: 0; right: 0; bottom: 0;
  height: var(--detent-h, 50vh);          /* .medium=50vh, .large=100%, .fraction(f)=calc(f*100%), .height(h)=hpx */
  background: var(--sui-color-elevated-bg, #fff);
  border-top-left-radius: var(--sheet-radius, 10px);   /* presentationCornerRadius */
  border-top-right-radius: var(--sheet-radius, 10px);
  box-shadow: 0 -1px 10px rgba(0,0,0,0.12);
  transform: translateY(100%);            /* hidden default */
  transition: transform 0.735s cubic-bezier(0.33,0,0.13,1);
  touch-action: none;                     /* JS drag drives translateY */
  will-change: transform;
}
.sui-sheet-card[data-state="presented"] { transform: translateY(0); }

.sui-sheet-grabber {
  width: 36px; height: 5px; border-radius: 2.5px;
  background: rgba(120,120,128,0.40);     /* secondary-label-class translucent */
  margin: 5px auto 0;                     /* ~5pt from top */
}

/* stacked-card scaling on the PRESENTER (apply to the page root behind the sheet) */
.sui-presenter[data-behind-sheet="true"] {
  transform: scale(0.92) translateY(0);
  border-radius: 10px; overflow: hidden;
  transition: transform 0.735s cubic-bezier(0.33,0,0.13,1), border-radius 0.735s;
  filter: brightness(0.92);
}
@media (prefers-reduced-motion: reduce) {
  .sui-sheet-card, .sui-sheet-scrim { transition: none; }
}
```

**Detent → `--detent-h` resolver (DESIGNED):**
```ts
function resolveDetent(d: Detent, maxH: number): number {
  switch (d.kind) {
    case 'medium':   return maxH * 0.5;
    case 'large':    return maxH;
    case 'fraction': return Math.min(1, Math.max(0, d.value)) * maxH;
    case 'height':   return Math.min(d.value, maxH);
    case 'custom':   return d.height(/*ctx*/) ?? 0; // 0 → drop
  }
}
```

**React prop API (DESIGNED, mirrors the modifiers):**
```tsx
<Sheet
  isPresented={isOpen}                     // Binding<Bool>  → [value, setter]
  onIsPresentedChange={setOpen}
  onDismiss={() => {}}                     // fires post-animation
  detents={['medium','large']}             // Set<PresentationDetent>; >1 ⇒ resizable + auto grabber
  selectedDetent={detent}                  // optional two-way (selection: overload)
  onSelectedDetentChange={setDetent}
  dragIndicator="automatic"                // "automatic" | "visible" | "hidden"
  cornerRadius={10}                        // presentationCornerRadius (null ⇒ default 10)
  background={<Material kind="thin" />}    // presentationBackground
  backgroundInteraction="automatic"        // "automatic"|"enabled"|"disabled"|{upThrough:'medium'}
  contentInteraction="automatic"           // "automatic"|"resizes"|"scrolls"
  compactAdaptation="automatic"            // PresentationAdaptation
>
  {/* content */}
</Sheet>

// item: overload sugar
<Sheet.Item item={selectedRow} onItemChange={setSelectedRow}>
  {(row) => <Detail row={row}/>}
</Sheet.Item>
```

Drag handler (DESIGNED) tracks `pointermove` → `translateY = clamp(startY + dy)`, with rubber-band `dy*0.3` above the max detent; on `pointerup` project final position by velocity (`pos + v*0.1`) and snap to nearest detent or dismiss if below smallest − threshold. Snap animation uses the `anim.snappy` token.

---

## 2. `fullScreenCover` — opaque full-screen modal

### 2.1 Exact API — KNOWN

`SwiftUI.swiftinterface:7417-7422` (View ext, `iOS 14.0, tvOS 14.0, watchOS 7.0`; **macOS unavailable** — `:7415`):

```swift
nonisolated public func fullScreenCover<Item, Content>(
    item: Binding<Item?>,
    onDismiss: (() -> Void)? = nil,
    @ViewBuilder content: @escaping (Item) -> Content
) -> some View where Item : Identifiable, Content : View          // :7417

nonisolated public func fullScreenCover<Content>(
    isPresented: Binding<Bool>,
    onDismiss: (() -> Void)? = nil,
    @ViewBuilder content: @escaping () -> Content
) -> some View where Content : View                              // :7422
```
(Deprecated `_cover(...)` aliases at `:7420 / :7425` — ignore.)

Same `isPresented:` / `item:` shape as `sheet`. The difference is purely presentation: **covers the entire screen, opaque, NO scrim, NO detents, NOT swipe-to-dismiss by default** (you must provide an explicit dismiss control, e.g. an `@Environment(\.dismiss)` button). Unavailable on macOS → on web (desktop) we map it to a full-window modal.

### 2.2 Visual anatomy & default metrics

- **No scrim** — the cover is opaque and edge-to-edge; nothing of the presenter shows.
- **Background:** opaque system background (light `#FFFFFF`-class, dark `#000000`/`#1C1C1E`-class). No rounded corners (full-bleed, radius 0).
- **No grabber.** No stacked-card scaling.
- **States:** *presenting* (slide-up) / *covering* / *dismissing* (slide-down). No drag/resize.

### 2.3 Behavior / animation

- **Present:** content slides up from `translateY(100%)` → `0` over the sheet spring (`anim.smooth`, settling 0.735s). Full opacity throughout (no fade).
- **Dismiss:** slides down `0 → 100%`; `onDismiss` on `transitionend`. Only programmatic dismissal (no swipe, no scrim — there's no scrim to tap).
- iPad/large: still full-screen by default unless `presentationCompactAdaptation` changes it.

### 2.4 Web replication mapping

```html
<div class="sui-fullscreen-cover" role="dialog" aria-modal="true" data-state="presented">
  <div class="sui-cover-content"><!-- content() --></div>
</div>
```
```css
.sui-fullscreen-cover {
  position: fixed; inset: 0; z-index: 1000;
  background: var(--sui-color-system-bg, #fff);  /* opaque, no scrim */
  transform: translateY(100%);
  transition: transform 0.735s cubic-bezier(0.33,0,0.13,1);
  will-change: transform;
}
.sui-fullscreen-cover[data-state="presented"] { transform: translateY(0); }
@media (prefers-reduced-motion: reduce) { .sui-fullscreen-cover { transition: opacity 0.2s; } }
```
```tsx
<FullScreenCover isPresented={open} onIsPresentedChange={setOpen} onDismiss={fn}>
  {/* must render its own dismiss button — useDismiss() context */}
</FullScreenCover>
```
React provides a `useDismiss()` hook (mirrors `@Environment(\.dismiss)`) so children can close the cover.

---

## 3. `popover` — anchored floating panel with arrow/caret

### 3.1 Exact API — KNOWN

Public overloads, `SwiftUI.swiftinterface:12011 & 12044` (View ext, `iOS 13.0, macOS 10.15`; **tvOS/watchOS unavailable**):

```swift
@_alwaysEmitIntoClient nonisolated public func popover<Item, Content>(
    item: Binding<Item?>,
    attachmentAnchor: PopoverAttachmentAnchor = .rect(.bounds),
    arrowEdge: Edge? = nil,
    @ViewBuilder content: @escaping (Item) -> Content
) -> some View where Item : Identifiable, Content : View          // :12011

@_alwaysEmitIntoClient nonisolated public func popover<Content>(
    isPresented: Binding<Bool>,
    attachmentAnchor: PopoverAttachmentAnchor = .rect(.bounds),
    arrowEdge: Edge? = nil,
    @ViewBuilder content: @escaping () -> Content
) -> some View where Content : View                              // :12044
```

`PopoverAttachmentAnchor` enum — `SwiftUI.swiftinterface:12000-12003` (KNOWN verbatim):
```swift
public enum PopoverAttachmentAnchor {
  case rect(Anchor<CGRect>.Source)   // anchor to a rect within the source (.bounds = whole view)
  case point(UnitPoint)              // anchor to a normalized point (e.g. .top, .center, .bottomTrailing)
}
```
- **`attachmentAnchor`** — where the arrow attaches. Default `.rect(.bounds)` = the source view's full bounds.
- **`arrowEdge: Edge?`** — which edge of the source the arrow points FROM (`.top/.bottom/.leading/.trailing`); `nil` = system auto-picks based on available space. (`Edge` is the standard SwiftUICore enum: `.top .leading .bottom .trailing`.)

### 3.2 Visual anatomy & default metrics (macOS-class popover, INFERRED — HIG + AppKit RE)

Sub-elements:
1. **Panel** — a floating rounded container. INFERRED metrics: corner radius ≈ **10pt** (macOS `NSPopover` chrome), background = **vibrant material** (`--sui-material-regular-blur`, `backdrop-filter: blur() saturate()`), a hairline border `rgba(0,0,0,0.1)`, and a drop shadow ≈ `0 10px 30px rgba(0,0,0,0.20)`.
2. **Arrow / caret** — a triangular pointer joining the panel to the anchor edge. INFERRED ≈ **16pt wide × 9pt tall** triangle, same fill+blur as the panel, positioned on the `arrowEdge` and centered on the attachment point.
3. **Content** — arbitrary view, padded ≈ 0 (content controls its own padding); panel auto-sizes to content with sensible max-width.

**Adaptation:** on compact width (iPhone), a popover **auto-adapts to a sheet** unless `presentationCompactAdaptation(.popover)` forces it to stay a popover. This is THE reason the presentation modifiers in §1.4 live in this cluster.

**States:** *presenting* (scale+fade from anchor) / *open* / *dismissing*. Dismissed by: tap outside (light-dismiss), Esc, or binding→false. No scrim on macOS — clicks outside pass to dismiss only.

### 3.3 Behavior / animation

- **Present:** panel scales from ~0.95 + fades in, transform-origin at the arrow/anchor point. Spring ≈ `anim.snappy` (settling 0.697s) on macOS; a quick fade on iPad.
- **Dismiss:** reverse (scale down + fade). Light-dismiss on outside click; Esc key closes.
- **Repositioning:** if the anchor scrolls or the window resizes, the popover follows the anchor and may flip `arrowEdge` to stay on-screen.

### 3.4 Web replication mapping

Use a positioning engine (Floating UI / Popper-class) keyed off the anchor rect.

```html
<div class="sui-popover" role="dialog" data-arrow-edge="bottom" style="--ax: 200px; --ay: 80px;">
  <div class="sui-popover-arrow"></div>
  <div class="sui-popover-panel"><!-- content() --></div>
</div>
```
```css
.sui-popover { position: absolute; z-index: 1100; transform-origin: var(--origin, center top); }
.sui-popover-panel {
  border-radius: 10px;
  background: var(--sui-material-regular-blur, rgba(245,245,245,0.8));
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border: 0.5px solid rgba(0,0,0,0.10);
  box-shadow: 0 10px 30px rgba(0,0,0,0.20);
  padding: 0;
}
.sui-popover-arrow {
  position: absolute; width: 16px; height: 9px;
  background: inherit;                 /* same material */
  clip-path: polygon(50% 0, 100% 100%, 0 100%);   /* triangle; rotate per edge */
}
.sui-popover[data-arrow-edge="bottom"] .sui-popover-arrow { bottom: -9px; left: calc(var(--anchor-x) - 8px); transform: rotate(180deg); }
.sui-popover[data-arrow-edge="top"]    .sui-popover-arrow { top: -9px;  transform: rotate(0); }
/* enter animation */
.sui-popover { opacity: 0; transform: scale(0.95); transition: opacity 0.2s, transform 0.697s cubic-bezier(0.34,1.3,0.64,1); }
.sui-popover[data-state="presented"] { opacity: 1; transform: scale(1); }
```
```tsx
<Popover
  isPresented={open} onIsPresentedChange={setOpen}
  anchorRef={btnRef}                       // the source view
  attachmentAnchor="bounds"                // "bounds" | UnitPoint like "topTrailing" | {point:[x,y]}
  arrowEdge={null}                         // null(auto) | "top"|"bottom"|"leading"|"trailing"
  compactAdaptation="automatic"            // "automatic" ⇒ becomes a Sheet on narrow viewports
>
  {/* content */}
</Popover>
```
A media query / `ResizeObserver` re-renders the popover as a `<Sheet detents={['medium']}>` when viewport width < ~500px and `compactAdaptation !== 'popover'` — replicating SwiftUI's auto-adaptation.

---

## 4. `alert` — centered modal card with buttons

SwiftUI has TWO alert systems: the **legacy `Alert` value type** (`alert(item:content:)` / `alert(isPresented:content:)`) and the **modern builder API** (`alert(_:isPresented:actions:message:)`). Document both; replicate with one component.

### 4.1 Legacy `Alert` struct — KNOWN

`SwiftUI.swiftinterface:1058-1072`:
```swift
public struct Alert {
  public init(title: Text, message: Text? = nil, dismissButton: Alert.Button? = nil)                    // :1059  (1-button)
  public init(title: Text, message: Text? = nil,
              primaryButton: Alert.Button, secondaryButton: Alert.Button)                                // :1060  (2-button)
  // macOS-only side-by-side variant:
  public static func sideBySideButtons(title: Text, message: Text? = nil,
              primaryButton: Alert.Button, secondaryButton: Alert.Button) -> Alert                       // :1065
  public struct Button {
    public static func `default`(_ label: Text, action: (() -> Void)? = {}) -> Alert.Button              // :1067
    public static func cancel(_ label: Text, action: (() -> Void)? = {}) -> Alert.Button                 // :1068
    public static func cancel(_ action: (() -> Void)? = {}) -> Alert.Button                              // :1069  (default "Cancel" label)
    public static func destructive(_ label: Text, action: (() -> Void)? = {}) -> Alert.Button            // :1070
  }
}
```
Button **roles** (KNOWN, from the factory names): `default` (normal, tint-colored), `cancel` (bold, dismiss), `destructive` (red).

Legacy trigger modifiers — `SwiftUI.swiftinterface:1086 & 1093`:
```swift
nonisolated public func alert<Item>(item: Binding<Item?>, content: (Item) -> Alert) -> some View where Item : Identifiable  // :1086
nonisolated public func alert(isPresented: Binding<Bool>, content: () -> Alert) -> some View                                // :1093
```

### 4.2 Modern builder API — KNOWN

`SwiftUI.swiftinterface:10504-10568`. Canonical forms (Text/title + isPresented + actions [+ message] [+ presenting data] [+ error]):
```swift
// title + actions
nonisolated public func alert<A>(_ titleKey: LocalizedStringKey, isPresented: Binding<Bool>,
    @ViewBuilder actions: () -> A) -> some View where A : View                                           // :10504
// title + actions + message
nonisolated public func alert<A, M>(_ titleKey: LocalizedStringKey, isPresented: Binding<Bool>,
    @ViewBuilder actions: () -> A, @ViewBuilder message: () -> M) -> some View                           // :10518
// title + presenting data → actions(T)/message(T)
nonisolated public func alert<A, M, T>(_ titleKey: LocalizedStringKey, isPresented: Binding<Bool>,
    presenting data: T?, @ViewBuilder actions: (T) -> A, @ViewBuilder message: (T) -> M) -> some View    // :10550
// error-driven
nonisolated public func alert<E, A>(isPresented: Binding<Bool>, error: E?,
    @ViewBuilder actions: () -> A) -> some View where E : LocalizedError, A : View                       // :10566
nonisolated public func alert<E, A, M>(isPresented: Binding<Bool>, error: E?,
    @ViewBuilder actions: (E) -> A, @ViewBuilder message: (E) -> M) -> some View                         // :10568
```
(Each also has `Text`, `StringProtocol`, and `LocalizedStringResource` title overloads — same shape, ~30 lines of overloads total at :10504-10568.) In the modern API, **button roles come from `Button(role:)`** (`.cancel`/`.destructive`) inside the `actions` builder; a `.cancel` button is bolded and auto-bound to the dialog's escape/cancel.

`dialogIcon` / `dialogSeverity` decorate the modern dialog:
```swift
nonisolated public func dialogIcon(_ icon: Image?) -> some View                 // :1031
nonisolated public func dialogSeverity(_ severity: DialogSeverity) -> some View // :16543 (macOS; iOS/tvOS unavailable)
```
`DialogSeverity` — `:16532-16537` (KNOWN): `.automatic`, `.critical`, `.standard` (macOS 14+). `.critical` puts an app/caution icon and emphasizes the dialog.

### 4.3 Visual anatomy & default metrics (iOS-class alert, INFERRED — HIG)

Centered card, vertically & horizontally centered over a scrim:
1. **Scrim** — dimming layer, INFERRED `rgba(0,0,0,0.20-0.40)`; blocks background interaction; tap does NOT dismiss (alerts are deliberate).
2. **Card** — INFERRED metrics: width ≈ **270pt** (classic iOS alert width), corner radius ≈ **14pt**, background = vibrant material (`--sui-material-regular-blur`, blurred), centered. Drop shadow subtle.
3. **Title** — `text.headline`-class, bold, centered, `--sui-color-label`. ~19pt top padding.
4. **Message** — `text.footnote/subheadline`-class, centered, `--sui-color-label` (slightly smaller), below title.
5. **Button row** — hairline `0.5pt` divider (`rgba(60,60,67,0.29)`-class separator) above and between buttons.
   - **1–2 buttons:** laid out **horizontally** (side by side) with a vertical hairline between.
   - **≥3 buttons** (or long labels): stacked **vertically**, each with a horizontal hairline.
   - Each button ≈ **44pt tall**, label centered, tinted blue (`--sui-color-tint`); `.cancel` is **bold**; `.destructive` is **red** (`#FF3B30`-class).

**States:** *presenting* (fade+scale-in) / *open* / button *pressed* (button cell highlights to a translucent gray) / *dismissing* (fade+scale-out).

### 4.4 Behavior / animation

- **Present:** card scales from ~1.15 → 1.0 (subtle "pop down") while fading `0→1`; scrim fades `0→0.4`. Quick spring/ease, ≈ 0.25s. (INFERRED — classic UIAlertController transition.)
- **Dismiss:** fade-out + slight scale; the chosen button's `action` fires, binding set false.
- **Keyboard:** Return triggers the default/primary button; Esc triggers the `.cancel` button. Tab cycles buttons (web).
- Buttons are **not** swipe-dismissable; alerts require an explicit choice.

### 4.5 Web replication mapping

```html
<div class="sui-alert-host" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
  <div class="sui-alert-scrim"></div>
  <div class="sui-alert-card" data-buttons="2">
    <div class="sui-alert-text">
      <h2 id="alert-title" class="sui-alert-title">Delete file?</h2>
      <p class="sui-alert-message">This cannot be undone.</p>
    </div>
    <div class="sui-alert-buttons">
      <button class="sui-alert-btn" data-role="cancel">Cancel</button>
      <button class="sui-alert-btn" data-role="destructive">Delete</button>
    </div>
  </div>
</div>
```
```css
.sui-alert-host { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; }
.sui-alert-scrim { position: absolute; inset: 0; background: rgba(0,0,0,0.30); opacity: 0; transition: opacity 0.25s ease; }
.sui-alert-scrim[data-state="presented"] { opacity: 1; }

.sui-alert-card {
  position: relative; width: 270px;
  border-radius: 14px; overflow: hidden;
  background: var(--sui-material-regular-blur, rgba(250,250,250,0.82));
  backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
  box-shadow: 0 10px 40px rgba(0,0,0,0.25);
  opacity: 0; transform: scale(1.15);
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.2,0.8,0.2,1);
}
.sui-alert-card[data-state="presented"] { opacity: 1; transform: scale(1); }

.sui-alert-text { padding: 19px 16px 14px; text-align: center; }
.sui-alert-title { font: 600 17px/1.3 -apple-system, system-ui; color: var(--sui-color-label,#000); margin: 0; }
.sui-alert-message { font: 400 13px/1.35 -apple-system; color: var(--sui-color-label,#000); margin: 4px 0 0; }

.sui-alert-buttons { display: flex; border-top: 0.5px solid rgba(60,60,67,0.29); }
.sui-alert-card[data-buttons="2"] .sui-alert-buttons { flex-direction: row; }
.sui-alert-card[data-buttons="3"] .sui-alert-buttons,           /* ≥3 ⇒ stack vertical */
.sui-alert-card[data-buttons="stacked"] .sui-alert-buttons { flex-direction: column; }

.sui-alert-btn {
  flex: 1; min-height: 44px; border: none; background: transparent;
  font: 400 17px -apple-system; color: var(--sui-color-tint, #007aff); cursor: pointer;
}
.sui-alert-btn + .sui-alert-btn { border-left: 0.5px solid rgba(60,60,67,0.29); }    /* row */
.sui-alert-card[data-buttons="3"] .sui-alert-btn + .sui-alert-btn { border-left: none; border-top: 0.5px solid rgba(60,60,67,0.29); }
.sui-alert-btn[data-role="cancel"] { font-weight: 600; }
.sui-alert-btn[data-role="destructive"] { color: #ff3b30; }
.sui-alert-btn:active { background: rgba(120,120,128,0.20); }
```
```tsx
<Alert
  isPresented={open} onIsPresentedChange={setOpen}
  title="Delete file?"                     // LocalizedStringKey / Text
  message="This cannot be undone."         // optional
  icon={<Image .../>}                       // dialogIcon (optional)
  severity="automatic"                      // DialogSeverity: "automatic"|"standard"|"critical"
>
  <Alert.Button role="cancel" onAction={fn}>Cancel</Alert.Button>
  <Alert.Button role="destructive" onAction={del}>Delete</Alert.Button>
</Alert>
```
The component counts non-cancel buttons + label lengths to pick `data-buttons="2"` (row) vs stacked. `role="cancel"` button is wired to Esc; the default button (first non-cancel) to Return. Legacy `Alert` value type is sugar: `Alert(title:message:dismissButton:)` → one `<Alert.Button>`; `primary/secondary` → two.

---

## 5. `confirmationDialog` + legacy `ActionSheet` — action sheet from bottom

### 5.1 Modern `confirmationDialog` API — KNOWN

`SwiftUI.swiftinterface:17105-17167` (View ext). Canonical forms:
```swift
// title + actions
nonisolated public func confirmationDialog<A>(_ titleKey: LocalizedStringKey, isPresented: Binding<Bool>,
    titleVisibility: Visibility = .automatic, @ViewBuilder actions: () -> A) -> some View where A : View   // :17105
// title + actions + message
nonisolated public func confirmationDialog<A, M>(_ titleKey: LocalizedStringKey, isPresented: Binding<Bool>,
    titleVisibility: Visibility = .automatic,
    @ViewBuilder actions: () -> A, @ViewBuilder message: () -> M) -> some View                              // :17121
// title + presenting data
nonisolated public func confirmationDialog<A, M, T>(_ titleKey: LocalizedStringKey, isPresented: Binding<Bool>,
    titleVisibility: Visibility = .automatic, presenting data: T?,
    @ViewBuilder actions: (T) -> A, @ViewBuilder message: (T) -> M) -> some View                            // :17155
```
(Same `Text` / `StringProtocol` / `LocalizedStringResource` title overloads, :17105-17167.)
- **`titleVisibility: Visibility`** — `.automatic` (title shown only if a message exists, INFERRED) / `.visible` (always show title as a gray header) / `.hidden`.
- Actions are `Button(role:)`s. A `.cancel` button is **separated** to its own pinned cell at the bottom (iOS action-sheet convention). `.destructive` → red.

### 5.2 Legacy `ActionSheet` struct — KNOWN

`SwiftUI.swiftinterface:608-611`:
```swift
public struct ActionSheet {
  public init(title: Text, message: Text? = nil, buttons: [ActionSheet.Button] = [.cancel()])   // :609
  public typealias Button = Alert.Button                                                          // :610 (reuses Alert.Button: default/cancel/destructive)
}
```
Presented via the deprecated `actionSheet(isPresented:content:)` / `actionSheet(item:content:)` (deprecated → use `confirmationDialog`). **macOS unavailable** (`:617` region) — on macOS an action sheet becomes a popover/menu. Web (desktop): render as a bottom sheet or an anchored menu per viewport.

### 5.3 Visual anatomy & default metrics (iOS action sheet, INFERRED — HIG)

Slides up from the **bottom**, NOT centered (unlike alert):
1. **Scrim** — `rgba(0,0,0,0.20-0.40)`; **tap-to-dismiss = cancel** (unlike alert). Background non-interactive.
2. **Action group card** — a rounded (≈**14pt**) vibrant-material card pinned near the bottom, inset from screen edges by ≈**8-10pt** horizontal margin, sitting above the safe-area bottom.
   - Optional **header** (title + message), gray `--sui-color-secondary-label`, centered, smaller text, with a hairline divider below.
   - **Action buttons** stacked vertically, each ≈**57pt** tall, label centered, tint blue (`--sui-color-tint`); `.destructive` red; separated by `0.5pt` hairlines.
3. **Cancel button** — a SEPARATE card below the action group (gap ≈8pt), full-width, **bold** label, same height, opaque/material background. This visual separation is the signature action-sheet trait.

**States:** *presenting* (slide-up) / *open* / button *pressed* (cell highlights) / *dismissing* (slide-down). On iPad/regular width, `confirmationDialog` presents as a **popover** anchored to the source instead of a bottom sheet.

### 5.4 Behavior / animation

- **Present:** both cards slide up from `translateY(100%)` → rest, scrim fades in. Spring = `anim.smooth`-class (settling 0.735s).
- **Dismiss:** slide down; tapping scrim or the cancel button dismisses (cancel action fires its closure).
- **Keyboard (web):** Esc = cancel; arrow keys move between actions.

### 5.5 Web replication mapping

```html
<div class="sui-actionsheet-host" role="dialog" aria-modal="true">
  <div class="sui-as-scrim"></div>
  <div class="sui-as-stack" data-state="presented">
    <div class="sui-as-group">
      <div class="sui-as-header"><div class="sui-as-title">Title</div><div class="sui-as-msg">Message</div></div>
      <button class="sui-as-btn" data-role="destructive">Delete</button>
      <button class="sui-as-btn">Duplicate</button>
    </div>
    <button class="sui-as-btn sui-as-cancel" data-role="cancel">Cancel</button>
  </div>
</div>
```
```css
.sui-actionsheet-host { position: fixed; inset: 0; z-index: 1200; }
.sui-as-scrim { position:absolute; inset:0; background:rgba(0,0,0,0.30); opacity:0; transition:opacity .735s; }
.sui-as-scrim[data-state="presented"] { opacity:1; }

.sui-as-stack {
  position:absolute; left:0; right:0; bottom:0;
  padding: 0 8px calc(8px + env(safe-area-inset-bottom));
  display:flex; flex-direction:column; gap:8px;
  transform: translateY(100%); transition: transform .735s cubic-bezier(0.33,0,0.13,1);
}
.sui-as-stack[data-state="presented"] { transform: translateY(0); }

.sui-as-group, .sui-as-cancel {
  border-radius:14px; overflow:hidden;
  background: var(--sui-material-regular-blur, rgba(250,250,250,0.82));
  backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
}
.sui-as-header { padding:14px 16px; text-align:center; border-bottom:0.5px solid rgba(60,60,67,0.29); }
.sui-as-title { font:600 13px -apple-system; color:var(--sui-color-secondary-label,#6e6e73); }
.sui-as-msg   { font:400 13px -apple-system; color:var(--sui-color-secondary-label,#6e6e73); margin-top:2px; }

.sui-as-btn {
  display:block; width:100%; min-height:57px; border:none; background:transparent;
  font:400 20px -apple-system; color:var(--sui-color-tint,#007aff); cursor:pointer;
}
.sui-as-group .sui-as-btn + .sui-as-btn { border-top:0.5px solid rgba(60,60,67,0.29); }
.sui-as-btn[data-role="destructive"] { color:#ff3b30; }
.sui-as-cancel { font-weight:600; }
.sui-as-btn:active { background:rgba(120,120,128,0.20); }
```
```tsx
<ConfirmationDialog
  isPresented={open} onIsPresentedChange={setOpen}
  title="Are you sure?"
  message="This permanently deletes the file."
  titleVisibility="automatic"              // "automatic"|"visible"|"hidden"
  compactAdaptation="automatic"            // popover on regular width
>
  <Dialog.Button role="destructive" onAction={del}>Delete</Dialog.Button>
  <Dialog.Button onAction={dup}>Duplicate</Dialog.Button>
  <Dialog.Button role="cancel">Cancel</Dialog.Button>   {/* auto-separated to its own card */}
</ConfirmationDialog>
```
The component splits children: any `role="cancel"` is hoisted into its own bottom card; the rest go in the action group. On viewport ≥ ~768px, it renders as a `<Popover>` anchored to the trigger (mirrors iPad behavior). Legacy `ActionSheet(title:message:buttons:)` maps directly: `buttons` array → children, `.cancel()` → the separated cancel card.

---

## 6. `contextMenu` — long-press menu + preview

### 6.1 Exact API — KNOWN

`ContextMenu` struct — `SwiftUI.swiftinterface:9837-9839`:
```swift
public struct ContextMenu<MenuItems> where MenuItems : View {
  public init(@ViewBuilder menuItems: () -> MenuItems)   // :9838
}
```

View-extension modifiers — `SwiftUI.swiftinterface:9814-9829`:
```swift
// menu only
nonisolated public func contextMenu<MenuItems>(@ViewBuilder menuItems: () -> MenuItems)
    -> some View where MenuItems : View                                                    // :9814
// menu + preview (the highlighted floating thumbnail shown above the menu)
nonisolated public func contextMenu<M, P>(@ViewBuilder menuItems: () -> M,
    @ViewBuilder preview: () -> P) -> some View where M : View, P : View                    // :9820
// pass a prebuilt ContextMenu (or nil to disable)
nonisolated public func contextMenu<MenuItems>(_ contextMenu: ContextMenu<MenuItems>?)
    -> some View where MenuItems : View                                                     // :9829
```

Selection-based variant (lists/tables) — `SwiftUI.swiftinterface:21399`:
```swift
nonisolated public func contextMenu<I, M>(forSelectionType itemType: I.Type = I.self,
    @ViewBuilder menu: @escaping (Set<I>) -> M,
    primaryAction: ((Set<I>) -> Void)? = nil) -> some View where I : Hashable, M : View      // :21399
```
(Plus `TableRow` overloads at :8110-8111 and a `TabContent` overload at :15650 — same shape, tabulated below.)

`menuItems` builder contains `Button`/`Menu`/`Divider`/`Toggle`/`Picker` rows (roles `.destructive` → red). `preview` (iOS) is a custom view shown as a floating card above the menu on long-press.

### 6.2 Visual anatomy & default metrics (INFERRED — HIG)

On **long-press** (iOS) / **right-click or Control-click** (macOS):
1. **Backdrop blur** — the rest of the screen blurs + dims behind the menu (iOS). INFERRED `backdrop-filter: blur(20px)` + `rgba(0,0,0,0.2)` scrim.
2. **Source "lift"** — the pressed view scales up slightly (≈1.0→1.05) and lifts with a shadow; OR if `preview:` is provided, a floating **preview card** (rounded ≈14pt, shadowed) appears in its place.
3. **Menu panel** — a rounded (≈**13-14pt**) vibrant-material list, INFERRED width ≈ **250pt**, appears adjacent to the source/preview (above or below depending on space).
   - **Menu rows:** each ≈**44pt** tall, label left-aligned (`text.body`, `--sui-color-label`), optional trailing SF Symbol icon. `.destructive` rows are red. `0.5pt` hairline separators between groups.
4. **States:** *pressing* (source scales) / *open* (menu + preview + blur) / row *highlight* (translucent gray) / *dismissing*.

### 6.3 Behavior / animation

- **Trigger:** long-press ≈0.5s (iOS) with a subtle scale + haptic at threshold; right/Ctrl-click (macOS) opens instantly at cursor.
- **Present:** source/preview lifts (`anim.snappy`-class scale-up), backdrop blurs in, menu scales+fades from its anchor edge (transform-origin toward the source).
- **Dismiss:** tap outside, Esc, or selecting a row (row action fires, then menu collapses back into the source). `primaryAction` (selection variant) fires on a plain tap (no menu) — menu only on long-press.

### 6.4 Web replication mapping

```html
<div class="sui-ctxmenu-host" data-state="presented">
  <div class="sui-ctx-backdrop"></div>
  <div class="sui-ctx-preview" style="--ox:120px; --oy:200px;"><!-- preview() or lifted source --></div>
  <div class="sui-ctx-menu" role="menu">
    <button class="sui-ctx-row" role="menuitem">Copy</button>
    <button class="sui-ctx-row" data-role="destructive" role="menuitem">Delete</button>
  </div>
</div>
```
```css
.sui-ctxmenu-host { position: fixed; inset: 0; z-index: 1300; }
.sui-ctx-backdrop {
  position:absolute; inset:0; background:rgba(0,0,0,0.20);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  opacity:0; transition: opacity .3s ease;
}
.sui-ctxmenu-host[data-state="presented"] .sui-ctx-backdrop { opacity:1; }

.sui-ctx-preview { position:absolute; border-radius:14px; box-shadow:0 20px 50px rgba(0,0,0,0.30);
  transform: scale(0.9); opacity:0; transition: transform .697s cubic-bezier(0.34,1.3,0.64,1), opacity .2s; }
.sui-ctxmenu-host[data-state="presented"] .sui-ctx-preview { transform: scale(1); opacity:1; }

.sui-ctx-menu {
  position:absolute; min-width:250px; border-radius:13px; overflow:hidden; padding:0;
  background: var(--sui-material-regular-blur, rgba(245,245,245,0.85));
  backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
  box-shadow: 0 10px 40px rgba(0,0,0,0.25);
  transform-origin: top center; transform: scale(0.9); opacity:0;
  transition: transform .697s cubic-bezier(0.34,1.3,0.64,1), opacity .15s;
}
.sui-ctxmenu-host[data-state="presented"] .sui-ctx-menu { transform: scale(1); opacity:1; }
.sui-ctx-row {
  display:flex; align-items:center; justify-content:space-between;
  width:100%; min-height:44px; padding:0 16px; border:none; background:transparent;
  font:400 17px -apple-system; color:var(--sui-color-label,#000); cursor:pointer;
}
.sui-ctx-row + .sui-ctx-row { border-top:0.5px solid rgba(60,60,67,0.20); }
.sui-ctx-row[data-role="destructive"] { color:#ff3b30; }
.sui-ctx-row:active { background:rgba(120,120,128,0.20); }
```
```tsx
<ContextMenu
  menu={<>
    <Menu.Button onAction={copy}>Copy</Menu.Button>
    <Menu.Button role="destructive" onAction={del}>Delete</Menu.Button>
  </>}
  preview={<Thumbnail .../>}                // optional floating preview card
  // selection variant:
  forSelectionType="Photo" onPrimaryAction={(sel)=>{}}
>
  <img src="photo.jpg" />                   {/* the anchor view */}
</ContextMenu>
```
The wrapper attaches a `pointerdown`→long-press timer (≈500ms) on touch and `contextmenu`/Ctrl-click on desktop, then portals the backdrop+preview+menu. `onPrimaryAction` fires on a plain click; the menu only on long-press / right-click.

---

## 7. Dialog decoration & companion modifiers — KNOWN (tabulated + key mappings)

These decorate alerts / confirmationDialogs (mostly macOS). All from `SwiftUI.swiftinterface`.

| Modifier | Line | Signature (abbrev) | Purpose | Web equivalent |
|---|---|---|---|---|
| `dialogIcon(_:)` | :1031 | `(Image?) -> some View` | Sets the dialog's large icon (macOS). | `<img>` slot at top of card. |
| `dialogSeverity(_:)` | :16543 | `(DialogSeverity) -> some View` | `.automatic`/`.critical`/`.standard` — critical adds a caution icon + emphasis (macOS 14+). | `data-severity` attr → red caution glyph + bold. |
| `dialogSuppressionToggle(_:isSuppressed:)` | :7141 | `(LocalizedStringKey, isSuppressed: Binding<Bool>) -> some View` | "Do not ask again" checkbox in the dialog (macOS). | `<label><input type=checkbox></label>` row above buttons, bound to a `boolean` state. |
| `dialogSuppressionToggle(_:isSuppressed:)` (Text/StringProtocol/Resource overloads) | :7143/:7147/:7149/:7151 | same, varied label types | label-type overloads | same |
| `dialogSuppressionToggle(...)` (Scene) | :7160-:7170 | `-> some Scene` | scene-level variant | n/a (app-level) |

`DialogSeverity` cases (`:16532-16536`): `.automatic`, `.critical`, `.standard`. — `dialogSuppressionToggle` React prop:
```tsx
<Alert ... suppressionToggle={{ label: "Don't ask again", isSuppressed, onChange: setSuppressed }}>
```

---

## 8. Long-tail tabulation (overloads & platform variants — same mechanics as deep sections)

Every item below shares the mechanics of its deep-covered parent (§ in parens); listed so nothing is silently dropped.

| Type / Modifier | Line(s) | Parent § | One-line purpose | Web equivalent |
|---|---|---|---|---|
| `sheet(item:onDismiss:content:)` | :7409 | §1 | item-driven sheet | `<Sheet.Item>` |
| `sheet(isPresented:onDismiss:content:)` | :7411 | §1 | bool-driven sheet | `<Sheet>` |
| `presentationDetents(_:)` / `(_:selection:)` | :21218/:21220 | §1.3 | detent set / two-way selection | `detents` / `selectedDetent` props |
| `presentationDragIndicator(_:)` | :21222 | §1.4 | grabber visibility | `dragIndicator` prop |
| `presentationCornerRadius(_:)` | :21233 | §1.4 | top corner radius | `cornerRadius` prop |
| `presentationBackground(_:)` / `(alignment:content:)` | :22946/:22948 | §1.4 | sheet backing style/view | `background` prop |
| `presentationBackgroundInteraction(_:)` | :21227 | §1.4 | scrim passthrough | `backgroundInteraction` prop |
| `presentationContentInteraction(_:)` | :21235 | §1.4 | resize-vs-scroll priority | `contentInteraction` prop |
| `presentationCompactAdaptation(_:)` / `(horizontal:vertical:)` | :21229/:21231 | §1.4,§3 | compact size adaptation | `compactAdaptation` prop |
| `PresentationDetent` (.medium/.large/.fraction/.height/.custom) | :21239-21258 | §1.2 | detent value type | `resolveDetent()` |
| `PresentationDetent.Context` (`maxDetentValue`, dynamicMember) | :21245-21252 | §1.2 | env for custom detents | ctx object |
| `CustomPresentationDetent` | :21307-21312 | §1.2 | custom height protocol | `{kind:'custom', height(ctx)}` |
| `PresentationAdaptation` | :21263-21279 | §1.4 | automatic/none/popover/sheet/fullScreenCover | string union |
| `PresentationContentInteraction` | :21281-21292 | §1.4 | automatic/resizes/scrolls | string union |
| `PresentationBackgroundInteraction` | :21294-21305 | §1.4 | automatic/enabled/(upThrough)/disabled | union/object |
| `fullScreenCover(item:…)` / `(isPresented:…)` | :7417/:7422 | §2 | full-screen modal | `<FullScreenCover>` |
| `_cover(...)` (deprecated aliases) | :7420/:7425 | §2 | legacy fullScreenCover | — (ignore) |
| `popover(item:…)` / `(isPresented:…)` (public) | :12011/:12044 | §3 | anchored popover | `<Popover>` |
| `popover(...)` (internal arrowEdge/core variants) | :12034/:12040/:12068/:12074/:12082/:12088 | §3 | internal positioning plumbing | handled by positioning engine |
| `popover(...)` on `TabContent` | :12414/:12416 | §3 | popover from a tab | `<Popover>` on tab |
| `PopoverAttachmentAnchor` (.rect/.point) | :12000-12003 | §3 | anchor specification | `attachmentAnchor` prop |
| `Alert` (1-btn / 2-btn inits, sideBySideButtons) | :1058-1065 | §4.1 | legacy alert value | `<Alert>` sugar |
| `Alert.Button` (default/cancel/cancel()/destructive) | :1066-1071 | §4.1 | alert button roles | `<Alert.Button role>` |
| `alert(item:content:)` / `(isPresented:content:)` (legacy) | :1086/:1093 | §4.1 | legacy alert triggers | `<Alert>` |
| `alert(_:isPresented:actions:)` family (Key/Text/String/Resource × ±message ×±presenting ×±error) | :10504-10568 | §4.2 | modern alert builder | `<Alert>` + `<Alert.Button>` |
| `ActionSheet(title:message:buttons:)` | :608-610 | §5.2 | legacy action sheet value | `<ConfirmationDialog>` sugar |
| `ActionSheet.Button` (= Alert.Button) | :610 | §5.2 | action sheet buttons | `<Dialog.Button role>` |
| `confirmationDialog(_:isPresented:titleVisibility:…)` family | :17105-17167 | §5.1 | modern action sheet | `<ConfirmationDialog>` |
| `ContextMenu(menuItems:)` struct | :9837-9839 | §6.1 | reusable menu value | `menu` prop |
| `contextMenu(menuItems:)` / `(menuItems:preview:)` / `(_:)` | :9814/:9820/:9829 | §6 | attach context menu | `<ContextMenu>` |
| `contextMenu(forSelectionType:menu:primaryAction:)` | :21399 | §6.1 | list selection menu | `forSelectionType`/`onPrimaryAction` |
| `contextMenu` on `TableRow` (menuItems / menuItems+preview) | :8110/:8111 | §6 | table-row menu | `<ContextMenu>` on row |
| `contextMenu` on `TabContent` | :15650 | §6 | tab context menu | `<ContextMenu>` on tab |
| `dialogIcon(_:)` (View / Scene) | :1031/:1040 | §7 | dialog icon | `icon` prop |
| `dialogSeverity(_:)` (View / Scene) | :16543/:16552 | §7 | dialog severity | `severity` prop |
| `dialogSuppressionToggle(...)` (View ×4 + Scene ×4) | :7141-7170 | §7 | "don't ask again" | `suppressionToggle` prop |
| `DialogSeverity` (.automatic/.critical/.standard) | :16532-16537 | §7 | severity value | string union |

---

## 9. Shared web infrastructure (DESIGNED — build once, all presentations use it)

1. **`<PresentationRoot/>`** — a single portal `<div id="sui-presentation-root">` mounted at app root; all presentations render into it, z-stacked (`sheet/cover` z=1000, popover z=1100, alert/dialog z=1200, contextMenu z=1300). Maintains a presentation stack for nested sheets (drives the stacked-card scaling on the presenter behind).

2. **`usePresentation({isPresented, onDismiss})` hook** — owns the present/dismiss lifecycle: mounts on `true`, plays the enter transition next frame (`data-state="presented"`), and on `false` plays the exit transition, calling `onDismiss` on `transitionend` before unmounting (keep-mounted-through-exit pattern). Shared by all six modifiers.

3. **`useDismiss()` context** — mirrors `@Environment(\.dismiss)`; any child calls it to set the controlling binding false (used by fullScreenCover's required dismiss control).

4. **Scrim component** — `<Scrim opacity={0.3} interactive={false} onTap={dismissIfAllowed}/>`. `interactive` mirrors `presentationBackgroundInteraction`.

5. **Focus trap + a11y** — each modal sets `aria-modal`, traps Tab focus, restores focus to the trigger on close, and wires Esc → cancel/dismiss (respecting `interactiveDismissDisabled`, a separate cluster).

6. **Spring tokens** — import `anim.smooth.css` (sheets/covers/dialogs slide), `anim.snappy.css` (popover/contextMenu pop, detent snap). All transitions honor `@media (prefers-reduced-motion: reduce)` by collapsing to a short fade.

7. **Compact adaptation** — a `useViewport()` hook returns a size class; popover→sheet and confirmationDialog→popover swaps key off it, replicating SwiftUI's `presentationCompactAdaptation` auto-behavior.

---

## 10. Coverage ledger

**Deep-covered (full HTML+CSS+prop-API):** `sheet` + the entire detent/presentation-modifier system (§1), `fullScreenCover` (§2), `popover` + `PopoverAttachmentAnchor` (§3), `alert` (legacy `Alert`/`Alert.Button` + modern builder, §4), `confirmationDialog` + legacy `ActionSheet` (§5), `contextMenu` + `ContextMenu` struct (§6), dialog decoration modifiers (`dialogIcon`/`dialogSeverity`/`dialogSuppressionToggle`, §7).

**Tabulated (overloads/platform variants of the above, mechanics identical):** all rows in §8 — every `sheet`/`fullScreenCover`/`popover`/`alert`/`confirmationDialog`/`contextMenu` overload, the `PresentationDetent`/`PresentationAdaptation`/`PresentationContentInteraction`/`PresentationBackgroundInteraction`/`CustomPresentationDetent` value types, internal popover plumbing, TableRow/TabContent/Scene variants, and `DialogSeverity`.

**Work-list types from C8 JSON — all covered:** `ActionSheet` (§5.2), `Alert` (§4.1), `ContextMenu` (§6.1), `PresentationDetent` (§1.2). ✅

**Confidence:** API signatures & detent value type = KNOWN (verbatim swiftinterface). Default visual metrics (corner radii, scrim opacities, grabber 36×5, alert 270pt, stacked-card 0.92) = INFERRED from Apple HIG / UIKit defaults / RE — these are the calibration targets to verify pixel-for-pixel against a real device screenshot. Web structure/CSS/prop-API = DESIGNED.
