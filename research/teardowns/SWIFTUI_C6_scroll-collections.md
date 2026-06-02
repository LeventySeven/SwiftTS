# SwiftUI Cluster C6 — Scroll & Collections (RE Teardown → Web Replica Spec)

**Scope:** `ScrollView`, `ScrollViewReader`/`ScrollViewProxy`, scroll modifiers (`scrollTargetBehavior` / `.paging` / `.viewAligned`, `scrollPosition`, `scrollClipDisabled`, `scrollIndicators`, `contentMargins`, `scrollDismissesKeyboard`, `scrollBounceBehavior`, `scrollDisabled`), `List` (every `ListStyle`: `.plain`/`.grouped`/`.insetGrouped`/`.inset`/`.sidebar`), all list-row modifiers (`listRowInsets`/`listRowBackground`/`listRowSeparator`/`listRowSeparatorTint`/`listSectionSeparator`/`listRowSpacing`/`listSectionSpacing`), `swipeActions`, selection + `EditMode`, `searchable`, `refreshable`, `Form`, `Table`/`TableColumn`/`TableRow`, `OutlineGroup`, `DisclosureGroup`, `ForEach`.

**Source of truth:** `arm64e-apple-macos.swiftinterface` for SwiftUI + SwiftUICore (macOS 26 SDK, the file the orchestrator pinned). Every signature below is quoted verbatim with its line number. Runtime visual metrics (row heights, insets, radii, spring constants) are not in the interface — they are marked **INFERRED** with the Apple HIG / UIKit-RE source, or **DESIGNED** where they are our engineering choice for the web. Where a W1 token exists I reference it by name (e.g. `systemGroupedBackground`, `separator`, `label`, `--sui-text-body-size`).

**Label legend:** **KNOWN** = read straight from the swiftinterface. **INFERRED** = Apple docs / HIG / UIKit RE / measured-from-Settings. **DESIGNED** = our web engineering decision.

**The iOS "Settings" look is the fidelity bar.** `List` + `Form` with `.insetGrouped` IS the Settings app. We go deepest there.

---

## 0. The mental model the web replica must encode

SwiftUI's collection views are NOT "a div with overflow:auto and some children." Three distinct layers exist and the web replica must keep them distinct:

1. **The scroll container** (`ScrollView`) — pure clipping + offset + indicators + snap behavior. No row chrome, no separators. Web = `overflow:auto` element + a snap layer.
2. **The collection** (`List`/`Table`/`Form`) — owns row chrome: row background, separators (hairlines), row insets, section grouping, selection highlight, swipe actions, edit affordances. This is where the Settings look lives. A `List` is itself internally a styled scroll view + a `ForEach`-driven row recycler. Web = a styled `<ul>`/`role=list` wrapper that paints separators and section cards, NOT a raw scroller.
3. **The content generators** (`ForEach`, `OutlineGroup`, `DisclosureGroup`) — turn data into rows. They render no chrome themselves; they emit rows that the enclosing collection then styles. Web = `.map()` plus, for the outline types, a recursive expand/collapse component.

Modifiers attach to whichever layer owns the property: `scrollTargetBehavior` → layer 1; `listRowBackground`/`swipeActions` → layer 2 (they are *row traits* read by the List, not real view wrappers); `searchable`/`refreshable` → cross-cutting (attach to the collection but render their own UI — a search bar in the nav area, a spinner above the first row).

This separation is why `.listRowBackground(_:)` returns `some View` but does nothing on its own outside a `List`: it sets a **`_ViewTraitKey`** the List reads. The web replica mirrors this with row-level props/data-attributes the wrapper reads, not real DOM wrappers.

---

## 1. ScrollView

### 1.1 Exact API — KNOWN (SwiftUI.swiftinterface)

```swift
// :14469
public struct ScrollView<Content> : SwiftUICore.View where Content : SwiftUICore.View {
  public var content: Content
  public var axes: SwiftUICore.Axis.Set { get set }              // :14471
  public var showsIndicators: Swift.Bool { get set }             // :14475
  // DEPRECATED initializer (use scrollIndicators modifier instead): :14483
  public init(_ axes: SwiftUICore.Axis.Set = .vertical,
              showsIndicators: Swift.Bool = true,
              @ViewBuilder content: () -> Content)
}
// :14506 — the current, non-deprecated initializer:
public init(_ axes: SwiftUICore.Axis.Set = .vertical, @ViewBuilder content: () -> Content)
// :14495 private content-inset knobs (underscored, SPI):
public var _contentInsets: SwiftUICore.EdgeInsets { get set }                // :14495
public var _automaticallyAdjustsContentInsets: Swift.Bool { get set }        // :14499
```

- `Axis.Set` is an `OptionSet`: `.horizontal`, `.vertical`, or `[.horizontal, .vertical]`. Default `.vertical`. **KNOWN.**
- `showsIndicators` defaults `true` but is deprecated; the live path is the `scrollIndicators(_:axes:)` modifier. **KNOWN.**

### 1.2 Scroll modifiers — KNOWN signatures (all `extension View`)

```swift
// :12146 — replaces showsIndicators
func scrollIndicators(_ visibility: ScrollIndicatorVisibility,
                      axes: Axis.Set = [.vertical, .horizontal]) -> some View
// :12249
func scrollClipDisabled(_ disabled: Bool = true) -> some View
// :12232
func scrollDisabled(_ disabled: Bool) -> some View
// :12255
func scrollDismissesKeyboard(_ mode: ScrollDismissesKeyboardMode) -> some View
// :12305
func scrollBounceBehavior(_ behavior: ScrollBounceBehavior, axes: Axis.Set = [.vertical]) -> some View
// :1410
func scrollTargetBehavior(_ behavior: some ScrollTargetBehavior) -> some View
// :1415
func scrollTargetLayout(isEnabled: Bool = true) -> some View
// :21755
func scrollPosition(_ position: Binding<ScrollPosition>, anchor: UnitPoint? = nil) -> some View
// :21760
func scrollPosition(id: Binding<(some Hashable)?>, anchor: UnitPoint? = nil) -> some View
// :4118 — content insets (the public replacement for _contentInsets)
func contentMargins(_ edges: Edge.Set = .all, _ insets: EdgeInsets, for placement: ContentMarginPlacement = .automatic) -> some View
func contentMargins(_ edges: Edge.Set = .all, _ length: CGFloat?, for placement: ContentMarginPlacement = .automatic) -> some View  // :4121
func contentMargins(_ length: CGFloat, for placement: ContentMarginPlacement = .automatic) -> some View                            // :4124
```

**Associated enums (KNOWN, verbatim cases):**

```swift
// :12123  ScrollIndicatorVisibility — NOTE: a struct with static factories, not an enum
public struct ScrollIndicatorVisibility { static var automatic, visible, hidden, never }
// :12260  ScrollDismissesKeyboardMode
public struct ScrollDismissesKeyboardMode { static var automatic, immediately, interactively, never }
// :12292  ScrollBounceBehavior
public struct ScrollBounceBehavior { static var automatic, always, basedOnSize }
```

**Scroll-target behaviors (KNOWN):**

```swift
// :1331
public protocol ScrollTargetBehavior { func updateTarget(_:context:) }
// :4690 — full-page snap
public struct PagingScrollTargetBehavior : ScrollTargetBehavior { public init() }
//   static var paging : PagingScrollTargetBehavior  (:4705)
// :4713 — snap each "view" (cell) to alignment
public struct ViewAlignedScrollTargetBehavior : ScrollTargetBehavior {
  public struct LimitBehavior { static var automatic, always, alwaysByFew, alwaysByOne, never }  // :4714
  public init(limitBehavior: LimitBehavior = .automatic)                                          // :4733
  public init(limitBehavior: LimitBehavior, anchor: UnitPoint?)  // iOS26  :4735
  public init(anchor: UnitPoint?)                                // iOS26  :4737
}
//   static var viewAligned : ViewAlignedScrollTargetBehavior
//   static func viewAligned(limitBehavior:) : ViewAlignedScrollTargetBehavior
```

**The `.viewAligned` contract (INFERRED, Apple docs + RE):** `.viewAligned` only snaps to subviews that are tagged by `scrollTargetLayout()` on the *container* (the LazyHStack/VStack) — each direct child becomes a snap target. `.paging` snaps by the full viewport size regardless of child layout. `LimitBehavior.always` forces one-cell-per-swipe paging-of-cells (carousel); `.automatic` lets the OS decide based on size class (on compact widths it behaves like `.always`).

### 1.3 Visual anatomy & metrics

A `ScrollView` renders exactly two visual things: the **clipped content** and the **scroll indicators** (track-less translucent thumbs that fade in on scroll, fade out ~1.1s after scroll ends). **INFERRED metrics (iOS/macOS RE):**

| Element | Value | Token |
|---|---|---|
| Indicator thumb width | 3pt (rest) → grows on drag (macOS) / fixed 3pt iOS | DESIGNED `--sui-scrollbar-thumb-w: 3px` |
| Indicator thumb color | `label` @ ~0.35 (light) / `label`-white @ ~0.35 (dark) | `var(--sui-color-label)` α0.35 |
| Indicator inset from edge | 2pt | DESIGNED |
| Indicator min length | ~36pt | DESIGNED |
| Fade-out delay after scroll | ~1.1s, ease-out 0.3s | matches `--sui-anim` family |
| Overscroll rubber-band resistance | ~0.55 ratio (translation × 0.55 past bounds) | INFERRED, iOS UIScrollView constant |
| Deceleration | `UIScrollView.DecelerationRate.normal` = 0.998 per ms | INFERRED |

`scrollClipDisabled(true)` removes the `overflow:hidden` clip so content (e.g. a hovered/scaled card or a shadow) can bleed past the scroll frame — used for carousels where the neighboring card peeks. **KNOWN behavior from name + docs.**

### 1.4 Behavior

- **States:** idle, dragging (indicators visible, content tracks finger 1:1 inside bounds, ×0.55 past bounds), decelerating (momentum), snapping (if a `scrollTargetBehavior` is set, animates to the resolved `ScrollTarget` with a spring), bouncing-back (overscroll springs to bound).
- **Bounce:** `.always` bounces even when content fits; `.basedOnSize` only bounces when content exceeds the viewport on that axis; `.automatic` = platform default (iOS bounces vertically always, horizontally only if overflow).
- **Keyboard dismissal:** `.interactively` ties keyboard y-position to scroll offset (drag-to-dismiss); `.immediately` dismisses on any scroll; `.automatic` = `.interactively` inside a search context, else none.
- **Snap animation:** spring; iOS paging uses ~`response 0.5, dampingFraction 0.85` (INFERRED). Web replica uses CSS scroll-snap (no JS spring needed for the common case).

### 1.5 Web replication mapping

**HTML:**
```html
<div class="sui-scrollview" data-axes="vertical" data-snap="none">
  <div class="sui-scrollview__content"><!-- slot --></div>
</div>
```

**CSS:**
```css
.sui-scrollview {
  --sui-scrollbar-thumb: color-mix(in srgb, var(--sui-color-label) 35%, transparent);
  position: relative;
  -webkit-overflow-scrolling: touch;       /* iOS momentum */
  overscroll-behavior: contain;            /* rubber-band w/o page chaining */
  scrollbar-width: thin;                   /* Firefox */
  scrollbar-color: var(--sui-scrollbar-thumb) transparent;
}
.sui-scrollview[data-axes="vertical"]   { overflow-y: auto; overflow-x: hidden; }
.sui-scrollview[data-axes="horizontal"] { overflow-x: auto; overflow-y: hidden; }
.sui-scrollview[data-axes="both"]       { overflow: auto; }
.sui-scrollview[data-indicators="hidden"] { scrollbar-width: none; }
.sui-scrollview[data-indicators="hidden"]::-webkit-scrollbar { display: none; }
.sui-scrollview[data-clip="disabled"]   { overflow: visible; }   /* scrollClipDisabled */

/* WebKit thumb to match the translucent capsule */
.sui-scrollview::-webkit-scrollbar { width: 7px; height: 7px; }
.sui-scrollview::-webkit-scrollbar-thumb {
  background: var(--sui-scrollbar-thumb);
  border-radius: 4px; border: 2px solid transparent; background-clip: padding-box;
}
.sui-scrollview::-webkit-scrollbar-track { background: transparent; }

/* scrollTargetBehavior(.paging) */
.sui-scrollview[data-snap="paging"]   { scroll-snap-type: var(--snap-axis, y) mandatory; }
.sui-scrollview[data-snap="paging"]   > .sui-scrollview__content > * { scroll-snap-align: start; scroll-snap-stop: always; }
/* scrollTargetBehavior(.viewAligned) — requires scrollTargetLayout() on inner stack */
.sui-scrollview[data-snap="viewAligned"] { scroll-snap-type: var(--snap-axis, x) proximity; }
.sui-scrollview[data-snap="viewAligned"] .sui-snap-target { scroll-snap-align: center; }
.sui-scrollview[data-snap="viewAligned"][data-limit="always"] .sui-snap-target { scroll-snap-stop: always; }

/* contentMargins / _contentInsets */
.sui-scrollview { scroll-padding: var(--sui-content-margin, 0); }
.sui-scrollview__content { padding: var(--sui-content-margin, 0); }
```

**React prop API (DESIGNED):**
```tsx
<ScrollView
  axes="vertical" | "horizontal" | "both"          // Axis.Set, default "vertical"
  indicators="automatic" | "visible" | "hidden"    // scrollIndicators
  clipDisabled={false}                             // scrollClipDisabled
  disabled={false}                                 // scrollDisabled
  bounce="automatic" | "always" | "basedOnSize"    // scrollBounceBehavior
  targetBehavior="paging" | "viewAligned" | "none" // scrollTargetBehavior
  viewAlignedLimit="automatic"|"always"|"alwaysByOne"|"alwaysByFew"|"never"
  contentMargins={{ top, leading, bottom, trailing }} // contentMargins / _contentInsets
  dismissesKeyboard="automatic"|"immediately"|"interactively"|"never"
  onScroll={(offset:{x:number;y:number})=>void}
  scrollPosition={[id, setId]}                     // scrollPosition(id:)  — controlled
>
  {children}
</ScrollView>
```
- `targetBehavior="viewAligned"` requires children to carry `className="sui-snap-target"` (the web analogue of `scrollTargetLayout()`). Provide a `<ScrollTargetLayout>` wrapper that injects that class onto each direct child.
- `scrollPosition` (controlled): on mount and on prop change, call `el.querySelector([data-scroll-id="<id>"]).scrollIntoView({block: anchor})`; on user scroll, IntersectionObserver reports the topmost visible child's id back through the setter.

---

## 2. ScrollViewReader + ScrollViewProxy

### 2.1 Exact API — KNOWN

```swift
// :18742
@frozen public struct ScrollViewReader<Content> : View where Content : View {
  public var content: (ScrollViewProxy) -> Content
  @inlinable public init(@ViewBuilder content: @escaping (ScrollViewProxy) -> Content)
}
// :18757
public struct ScrollViewProxy {
  public func scrollTo<ID>(_ id: ID, anchor: UnitPoint? = nil) where ID : Hashable   // :18758
}
```

`scrollTo(id, anchor:)` programmatically scrolls so the view tagged `.id(id)` aligns to `anchor` (e.g. `.top`, `.center`, `.bottom`). `anchor == nil` scrolls the minimum distance to make it visible. **KNOWN.** It animates if called inside `withAnimation { proxy.scrollTo(...) }`.

### 2.2 Web mapping (DESIGNED)

Implement as a React context that exposes `scrollTo(id, anchor?)`. The provider holds a ref to the nearest `.sui-scrollview` and each tagged child registers `data-scroll-id`.

```tsx
const proxy = useScrollViewProxy();
proxy.scrollTo("row-42", "center");
// impl:
function scrollTo(id, anchor = null) {
  const el = container.querySelector(`[data-scroll-id="${CSS.escape(id)}"]`);
  if (!el) return;
  const block = anchor === "top" ? "start" : anchor === "bottom" ? "end" : anchor === "center" ? "center" : "nearest";
  el.scrollIntoView({ behavior: "smooth", block, inline: block });
}
```
```tsx
<ScrollViewReader>{(proxy) => (
  <ScrollView>{items.map(i => <Row key={i.id} data-scroll-id={i.id}/> )}</ScrollView>
)}</ScrollViewReader>
```
`anchor` → `scrollIntoView` `block`/`inline`: `.top→start`, `.center→center`, `.bottom→end`, `nil→nearest`. `behavior:"smooth"` mirrors the spring (use `behavior:"instant"` when not inside an animation).

---

## 3. List — the Settings-app engine

`List` is the single most important component in this cluster. It is the iOS Settings look. Get its metrics exactly right.

### 3.1 Exact API — KNOWN (SwiftUI.swiftinterface)

```swift
// :6456
@MainActor public struct List<SelectionValue, Content> : View
    where SelectionValue : Hashable, Content : View {
  // no-selection / single / multi selection initializers:
  public init(selection: Binding<Set<SelectionValue>>?, @ViewBuilder content: () -> Content)        // :6458 multi
  public init(selection: Binding<SelectionValue?>?, @ViewBuilder content: () -> Content)             // :6460 single (watchOS10+)
  public init(selection: Binding<SelectionValue>, @ViewBuilder content: () -> Content)               // :6466 macOS-only required-single
  // data-driven convenience (wraps your data in a ForEach for you): :6479
  public init<Data, RowContent>(_ data: Data, selection: Binding<Set<SelectionValue>>?,
       @ViewBuilder rowContent: @escaping (Data.Element) -> RowContent)
       where Content == ForEach<Data, Data.Element.ID, RowContent>, Data : RandomAccessCollection,
             RowContent : View, Data.Element : Identifiable
  // hierarchical (outline) list — children keypath: :6494
  public init<Data, RowContent>(_ data: Data, children: KeyPath<Data.Element, Data?>,
       selection: Binding<Set<SelectionValue>>?,
       @ViewBuilder rowContent: @escaping (Data.Element) -> RowContent)
       where Content == OutlineGroup<Data, Data.Element.ID, RowContent, RowContent,
             DisclosureGroup<RowContent, OutlineSubgroupChildren>>, ...
}
```

There is also (not shown above, same file) a no-selection `List(content:)` and `List(_:rowContent:)` via `SelectionValue == Never`. The `selection:` binding is `Set<…>` for multi-select, `Optional<…>` for single-select. **KNOWN.**

### 3.2 ListStyle — KNOWN signatures + INFERRED metrics

```swift
// :523   public protocol ListStyle { }
// :535   func listStyle<S>(_ style: S) -> some View where S : ListStyle
// :2240  public struct DefaultListStyle : ListStyle { public init() }   // .automatic (:2235)
// :11455 public struct PlainListStyle : ListStyle { public init() }           // .plain
// :6787  public struct GroupedListStyle : ListStyle { public init() }          // .grouped
// :10021 public struct InsetGroupedListStyle : ListStyle { public init() }     // .insetGrouped (iOS16.1+/macOS13+)
// :5556  public struct InsetListStyle : ListStyle {                            // .inset
//          public init(); public init(alternatesRowBackgrounds: Bool) (macOS) }
// :2743  public struct SidebarListStyle : ListStyle { public init() }          // .sidebar
// :18510 public struct CarouselListStyle (watchOS)  :18559 BorderedListStyle (macOS)  :15805 EllipticalListStyle (watchOS)
```

`.automatic` resolves per-platform: **iOS** → `.insetGrouped` inside a `NavigationStack`, `.plain` otherwise; **macOS** → `.inset`; **watchOS** → `.carousel`. (INFERRED, Apple docs.)

**The five core styles — exact iOS metrics (INFERRED, measured from Settings.app + HIG; these ARE the fidelity contract):**

| Property | `.plain` | `.grouped` | `.insetGrouped` | `.inset` (macOS) | `.sidebar` |
|---|---|---|---|---|---|
| List background | `systemBackground` (`#FFF`/`#000`) | `systemGroupedBackground` (`#F2F2F7`/`#000`) | `systemGroupedBackground` | `controlBackground`/white | clear/`systemGroupedBackground` |
| Row background | `systemBackground` | `secondarySystemGroupedBackground` (`#FFF`/`#1C1C1E`) | `secondarySystemGroupedBackground` | window bg | clear |
| Row min height | **44pt** | 44pt | 44pt | 24–28pt (macOS) | 28pt (macOS) / 44pt (iOS) |
| Default row vertical padding | 11pt top+bottom (→ ~44 total w/ body text) | 11pt | 11pt | 4pt | 6pt |
| Row horizontal content inset (leading) | **16pt** | 16pt (separator+content align) | 16pt inside card; card itself inset | 8pt | 10pt |
| Section side margin | 0 (flush, full-bleed) | 0 (full-bleed sections) | **20pt** L/R (the inset) | 0 | 0 |
| Card corner radius | 0 | 0 | **10pt** | 0 | 6pt (selection pill) |
| Separator | hairline full-bleed, inset 16pt leading | hairline, inset to text | hairline inside card, inset 16pt, none on last row | hairline | none |
| Separator color | `separator` (`#3C3C434A` / `#545458A6`) | `separator` | `separator` | `separator` | n/a |
| Separator thickness | 0.33pt (1px@3x) → render 0.5px | 0.33pt | 0.33pt | 0.5pt | n/a |
| Section header | UPPERCASE, `footnote` 13pt, `secondaryLabel`, 6pt below | UPPERCASE footnote secondaryLabel | Title-case **or** UPPERCASE footnote; 6pt below, 16pt leading | small caps | `subheadline` semibold |
| Section spacing (gap between groups) | 0 | **35pt** | 35pt | 0 | ~8pt |
| First section top inset | 0 | 35pt | 35pt | 0 | 0 |

The `.insetGrouped` card is the signature element: a `secondarySystemGroupedBackground` rounded rect (radius 10), 20pt from each screen edge, sitting on the `systemGroupedBackground` page. Rows inside share the card; only **interior** separators draw (last row has none), and each separator is inset 16pt from the card's leading edge (aligned to row text). **This is the single highest-fidelity target in the cluster.**

### 3.3 Row anatomy (the standard Settings row)

```
┌──────────────────────────────────────────────────┐  ← row, min-height 44pt
│ 16pt │ [icon 29×29]  Label .......... value  ›  │   │
│  pad │   gap 12pt    body 17pt      secondary chevron │
└──────────────────────────────────────────────────┘
        └─ separator starts here (16pt or icon-aligned) ─┘
```

- **Label text:** `body` = `--sui-text-body-size` 17pt, weight regular, color `label`.
- **Trailing value text:** `body` 17pt, color `secondaryLabel` (`#3C3C4399`).
- **Disclosure chevron** (NavigationLink rows): SF Symbol `chevron.right`, ~13×13pt, `tertiaryLabel` (`#3C3C434D`), 16pt trailing margin.
- **Leading icon** (optional): 29×29pt rounded-rect glyph; when present, the separator inset moves to align under the *text*, not the icon (≈ 16 + 29 + 12 = 57pt). **INFERRED.**
- **Selection highlight:** the whole row fills `systemFill`-ish gray (`systemGray4`-adjacent, `#D1D1D6` light) on press; in `EditMode` multi-select a leading circular check appears.

### 3.4 swipeActions — KNOWN + INFERRED

```swift
// :16033
func swipeActions<T>(edge: HorizontalEdge = .trailing, allowsFullSwipe: Bool = true,
                     @ViewBuilder content: () -> T) -> some View where T : View
```

- `edge`: `.leading` or `.trailing` (`HorizontalEdge`). Default `.trailing`. **KNOWN.**
- `allowsFullSwipe` default `true`: a full swipe past ~50% width auto-triggers the first action (the destructive one on trailing). **KNOWN.**
- Action buttons are built from `Button(role:)`; `.destructive` role → red (`system.red`), `.tint(_)` colors a button. Width per button ≈ 74pt min, grows with label. The drawer slides in from the swiped edge as the row content translates. **INFERRED metrics.**
- Animation: rubber-banded drag tracking the finger; on release either snaps open (rest state, buttons fully revealed) or closed; full-swipe commits with a slide+fade of the row. Spring ≈ `response 0.35, dampingFraction 0.86` (INFERRED).

### 3.5 Row-trait modifiers — KNOWN signatures

```swift
// :1018  func listRowInsets(_ insets: EdgeInsets?) -> some View
// :1025  func listRowInsets(_ edges: Edge.Set = .all, _ length: CGFloat?) -> some View
// :23738 func listRowBackground<V>(_ view: V?) -> some View where V : View
// :6727  func listRowSeparator(_ visibility: Visibility, edges: VerticalEdge.Set = .all) -> some View
// :6729  func listRowSeparatorTint(_ color: Color?, edges: VerticalEdge.Set = .all) -> some View
// :6736  func listSectionSeparator(_ visibility: Visibility, edges: VerticalEdge.Set = .all) -> some View
// :6738  func listSectionSeparatorTint(_ color: Color?, edges: VerticalEdge.Set = .all) -> some View
// :16964 func listRowSpacing(_ spacing: CGFloat?) -> some View
// :12904 func listSectionSpacing(_ spacing: ListSectionSpacing) -> some View
// :12910 func listSectionSpacing(_ spacing: CGFloat) -> some View
// :2321  func listRowHoverEffect(_ effect: HoverEffect?) -> some View
// :10844 func scrollContentBackground(_ visibility: Visibility) -> some View   // hide List's default bg
```

`ListSectionSpacing` (:12895) is a `struct` with `.default`, `.compact`, and `.custom(CGFloat)` factories. `Visibility` is `.automatic`/`.visible`/`.hidden`. `VerticalEdge.Set` is `.top`/`.bottom`/`.all`. **All KNOWN.**

- `listRowInsets(nil)` → reset to default insets. **KNOWN.**
- `listRowBackground(nil)` → transparent row (lets List bg show). **KNOWN.**
- `scrollContentBackground(.hidden)` is THE way to remove the List/Form gray page background so you can paint your own. **KNOWN behavior.**

### 3.6 Selection + EditMode — KNOWN

```swift
// :16684
public enum EditMode : Sendable { case inactive, transient, active
  public var isEditing: Bool { get } }           // active||transient
// :16703  EnvironmentValues.editMode : Binding<EditMode>?  (iOS/tvOS only; macOS unavailable)
```

- `.inactive` = normal; `.active` = editing (multi-select circles + reorder grips + delete buttons show); `.transient` = temporary edit (e.g. mid-swipe). `isEditing` is `true` for `.active` and `.transient`. **KNOWN.**
- In edit mode each row gets a **leading 22pt circle** (empty `#C7C7CC` ring → filled `system.blue` check when selected) and, if `onMove` is set, a **trailing reorder grip** (3 horizontal bars, `tertiaryLabel`). Delete shows a leading red ⊖ circle that expands to a Delete button on tap. **INFERRED.**

### 3.7 Web replication mapping

**HTML (insetGrouped, the canonical case):**
```html
<div class="sui-list" data-style="insetGrouped" role="list">
  <section class="sui-list__section">
    <div class="sui-list__header" role="presentation">SECTION TITLE</div>
    <div class="sui-list__card">
      <div class="sui-list__row" role="listitem" tabindex="0">
        <span class="sui-list__icon"><!-- optional --></span>
        <span class="sui-list__label">Airplane Mode</span>
        <span class="sui-list__value">Off</span>
        <span class="sui-list__chevron" aria-hidden="true"></span>
      </div>
      <!-- more rows; separators are ::before pseudo-elements -->
    </div>
    <div class="sui-list__footer">Footnote text.</div>
  </section>
</div>
```

**CSS (full five-style set):**
```css
.sui-list {
  --sui-list-row-min-h: 44px;
  --sui-list-side-inset: 20px;          /* insetGrouped card margin */
  --sui-list-content-inset: 16px;       /* leading text/separator inset */
  --sui-list-card-radius: 10px;
  --sui-list-section-gap: 35px;
  --sui-separator: var(--sui-color-separator);    /* #3C3C434A / #545458A6 */
  font: var(--sui-text-body-weight) var(--sui-text-body-size)/var(--sui-text-body-lineHeight) -apple-system, system-ui;
  list-style: none; margin: 0; padding: 0;
}
/* ---- page background per style ---- */
.sui-list[data-style="plain"]        { background: var(--sui-color-systemBackground); }
.sui-list[data-style="grouped"],
.sui-list[data-style="insetGrouped"] { background: var(--sui-color-systemGroupedBackground); }

/* ---- section ---- */
.sui-list__section { }
.sui-list[data-style="grouped"]     .sui-list__section,
.sui-list[data-style="insetGrouped"] .sui-list__section { margin-top: var(--sui-list-section-gap); }
.sui-list__section:first-child { margin-top: 0; }
.sui-list[data-style="grouped"]     .sui-list__section:first-child,
.sui-list[data-style="insetGrouped"] .sui-list__section:first-child { margin-top: var(--sui-list-section-gap); }

/* ---- header / footer ---- */
.sui-list__header {
  font: var(--sui-text-footnote-weight) var(--sui-text-footnote-size)/1.3 inherit;
  color: var(--sui-color-secondaryLabel);
  text-transform: uppercase; letter-spacing: -0.08px;
  padding: 0 var(--sui-list-content-inset) 6px;
}
.sui-list[data-style="insetGrouped"] .sui-list__header { padding-left: calc(var(--sui-list-side-inset) + var(--sui-list-content-inset)); }
.sui-list__footer {
  font: var(--sui-text-footnote-size) inherit; color: var(--sui-color-secondaryLabel);
  padding: 6px var(--sui-list-content-inset) 0;
}

/* ---- card (grouped vs insetGrouped) ---- */
.sui-list__card { background: var(--sui-color-secondarySystemGroupedBackground); overflow: hidden; }
.sui-list[data-style="insetGrouped"] .sui-list__card {
  margin: 0 var(--sui-list-side-inset);
  border-radius: var(--sui-list-card-radius);
}
.sui-list[data-style="plain"] .sui-list__card { background: var(--sui-color-systemBackground); }

/* ---- row ---- */
.sui-list__row {
  position: relative; display: flex; align-items: center; gap: 12px;
  min-height: var(--sui-list-row-min-h);
  padding: 11px var(--sui-list-content-inset);
  color: var(--sui-color-label);
  background: transparent;
  -webkit-tap-highlight-color: transparent;
  cursor: default;
}
/* interior separators only — none on last row */
.sui-list__row:not(:last-child)::after {
  content: ""; position: absolute; left: var(--sui-list-content-inset); right: 0; bottom: 0;
  height: 0.5px; background: var(--sui-separator); transform: scaleY(0.5); transform-origin: bottom;
}
/* if a leading icon exists, separator aligns under text */
.sui-list__row:has(.sui-list__icon):not(:last-child)::after { left: calc(var(--sui-list-content-inset) + 29px + 12px); }
.sui-list__label  { flex: 1 1 auto; }
.sui-list__value  { color: var(--sui-color-secondaryLabel); margin-left: auto; }
.sui-list__icon   { width: 29px; height: 29px; border-radius: 6.5px; flex: 0 0 auto; display: grid; place-items: center; }
.sui-list__chevron { flex: 0 0 auto; width: 7px; height: 12px; }
.sui-list__chevron::before {
  content: ""; display: block; width: 7px; height: 7px;
  border-top: 2px solid var(--sui-color-tertiaryLabel); border-right: 2px solid var(--sui-color-tertiaryLabel);
  transform: rotate(45deg); margin-top: 2px;
}

/* states */
.sui-list__row[data-tappable="true"]:active,
.sui-list__row[data-selected="true"] { background: var(--sui-color-systemGray4, #D1D1D6); }
.sui-list[data-edit="active"] .sui-list__row { padding-left: calc(var(--sui-list-content-inset) + 34px); }

/* listRowSeparator(.hidden) */
.sui-list__row[data-separator="hidden"]::after { display: none; }
```

**React prop API (DESIGNED — mirrors the SwiftUI API):**
```tsx
<List
  style="plain"|"grouped"|"insetGrouped"|"inset"|"sidebar"|"automatic"
  selection={[selectedSet, setSelected]}      // List(selection:)
  editMode="inactive"|"active"|"transient"    // EnvironmentValues.editMode
  rowSpacing={number}                          // listRowSpacing
  sectionSpacing={number|"default"|"compact"}  // listSectionSpacing
  contentBackgroundHidden={false}              // scrollContentBackground(.hidden)
>
  <Section header="GENERAL" footer="Footnote.">
    <ListRow
      onTap={fn}
      background={<Color/>}                     // listRowBackground
      insets={{top,leading,bottom,trailing}}    // listRowInsets
      separator="automatic"|"hidden"            // listRowSeparator
      separatorTint="#color"                     // listRowSeparatorTint
      swipeActions={{                            // swipeActions
        trailing: [{label, role:"destructive", tint, onTap}],
        leading:  [{label, tint, onTap}],
        allowsFullSwipe: true,
      }}
    >
      <ListRow.Label>Airplane Mode</ListRow.Label>
      <ListRow.Value>Off</ListRow.Value>
      <ListRow.Chevron/>
    </ListRow>
  </Section>
</List>
```

**Swipe-actions JS behavior (DESIGNED):** wrap each row in a horizontal flex track. `pointerdown`→track `pointermove` translateX (clamp leading at 0, rubber-band past full open width). On `pointerup`: if `|dx| > fullSwipeThreshold (≈50% width) && allowsFullSwipe` → run first action + animate row collapse; elif `|dx| > openWidth/2` → snap open; else → snap closed. Snap uses `transition: transform 0.35s cubic-bezier(0.22,1,0.36,1)` (spring-ish). Action buttons sit absolutely behind the track on the swiped edge, each `min-width:74px`, destructive = `var(--sui-color-system-red)` bg + white label.

---

## 4. Form

### 4.1 Exact API — KNOWN

```swift
// :13138
public struct Form<Content> : View where Content : View {
  public init(@ViewBuilder content: () -> Content)                       // :13139
  public init(_ configuration: FormStyleConfiguration)                   // :13151 (Content == FormStyleConfiguration.Content)
}
// FormStyle (KNOWN):
// :15615 public protocol FormStyle { }
// :15636 func formStyle<S>(_ style: S) -> some View where S : FormStyle
// :22710 public struct AutomaticFormStyle : FormStyle      // .automatic
// :14628 public struct GroupedFormStyle  : FormStyle       // .grouped (:14623)
// :1746  public struct ColumnsFormStyle  : FormStyle       // .columns (:1741, macOS 2-col label/control)
```

### 4.2 Visual model — INFERRED

A `Form` is visually a `List` with `.grouped` (iOS) / `.columns` (macOS) styling applied automatically, plus control-specific row layouts. On iOS a `Form` renders **identically to `List` + `.insetGrouped`** in a `NavigationStack` (rounded cards, 20pt inset, `systemGroupedBackground`). The difference is row content: `Form` auto-lays-out control rows as **leading label + trailing control**:

- `Toggle("Wi-Fi", isOn:)` → label left (`label`, body 17pt), switch right (16pt trailing margin).
- `Picker` → label left, current value + chevron right (navigates to a sub-list on tap).
- `TextField` → full-width, no separate label unless paired.
- `Stepper`, `Slider` → label + control trailing.

`.columns` (macOS) puts labels in a right-aligned left column and controls in a left-aligned right column, with a shared vertical alignment guide (`.firstTextBaseline`). **INFERRED, Apple docs.**

### 4.3 Web mapping

Reuse the `List` machinery with `data-style="insetGrouped"` (iOS) and a `data-form="true"` flag that switches row layout to label/control:

```css
.sui-list[data-form="true"] .sui-list__row { justify-content: space-between; }
.sui-list[data-form="true"] .sui-list__row > .sui-control { margin-left: auto; flex: 0 0 auto; }
/* macOS .columns */
.sui-form[data-style="columns"] { display: grid; grid-template-columns: max-content 1fr; gap: 10px 8px; align-items: baseline; }
.sui-form[data-style="columns"] .sui-form__label { text-align: right; color: var(--sui-color-label); }
```
```tsx
<Form style="automatic"|"grouped"|"columns">
  <Section header="NETWORK">
    <FormRow label="Wi-Fi"><Toggle isOn={[on,setOn]}/></FormRow>
    <FormRow label="Location"><Picker .../></FormRow>
  </Section>
</Form>
```
`Form` is a thin wrapper that renders `<List style="insetGrouped" data-form>` on compact widths and the `.columns` grid on macOS-class widths. **DESIGNED.**

---

## 5. searchable

### 5.1 Exact API — KNOWN

```swift
// :5657 (text + placement + Text prompt)
func searchable(text: Binding<String>, placement: SearchFieldPlacement = .automatic, prompt: Text? = nil) -> some View
// :5659 (LocalizedStringKey prompt)  :5668 (StringProtocol prompt)
// :5675 (with isPresented binding — programmatic show/hide)
func searchable(text: Binding<String>, isPresented: Binding<Bool>, placement: SearchFieldPlacement = .automatic, prompt: Text? = nil) -> some View
// :10653 (with suggestions builder)
func searchable<S>(text:..., @ViewBuilder suggestions: () -> S) -> some View where S : View
// related: :10645 searchSuggestions, :14301/14308 searchCompletion, :2447 searchScopes,
//          :19345 searchPresentationToolbarBehavior, :14316 EnvironmentValues.isSearching : Bool
```

```swift
// :9115  SearchFieldPlacement (struct, static factories):
//   automatic, toolbar, toolbarPrincipal, sidebar, navigationBarDrawer, navigationBarDrawer(displayMode:)
//   NavigationBarDrawerDisplayMode { automatic, always }   (:9146)
// :22676 SearchSuggestionsPlacement { .content, .menu ... } (Set)
```

`isSearching` is an `EnvironmentValues` bool a child reads to know the search field is active. `dismissSearch` (env action) cancels it. **KNOWN.**

### 5.2 Search bar anatomy — INFERRED (iOS)

The standard `.navigationBarDrawer` search bar that sits under the nav title:

```
┌────────────────────────────────────────────┐ ← 36pt tall capsule
│ 🔍  Search                              ⊗ │   tertiarySystemFill bg
└────────────────────────────────────────────┘
```

| Element | Value | Token |
|---|---|---|
| Field background | `tertiarySystemFill` (`#7676801F` / `#7676803D`) | `var(--sui-color-tertiarySystemFill)` |
| Field height | 36pt | DESIGNED `--sui-search-h: 36px` |
| Corner radius | 10pt | `--sui-search-radius: 10px` |
| Side margins | 16pt (8pt on iPad sidebar) | |
| Magnifier glyph | SF `magnifyingglass`, ~15pt, `secondaryLabel` | `var(--sui-color-secondaryLabel)` |
| Placeholder text | `body` 17pt, `placeholderText` (`#3C3C434D`) | |
| Clear button (⊗) | SF `xmark.circle.fill`, `tertiaryLabel`, shows when text non-empty | |
| Cancel button | appears to the right when focused, `system.blue`, `body` 17pt | |

**Behavior:** on focus the search field slides up (the drawer collapses the large title), a "Cancel" button animates in from the trailing edge, and the list filters live as `text` changes. Suggestions (`searchSuggestions`) appear as an overlay list below the field. Scopes (`searchScopes`) render as a segmented control under the field. **INFERRED.**

### 5.3 Web mapping

```html
<div class="sui-search" data-focused="false">
  <span class="sui-search__icon" aria-hidden="true"><!-- magnifier --></span>
  <input class="sui-search__input" type="search" placeholder="Search" />
  <button class="sui-search__clear" aria-label="Clear"></button>
  <button class="sui-search__cancel">Cancel</button>
</div>
```
```css
.sui-search { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 8px;
  margin: 0 16px; border-radius: 10px; background: var(--sui-color-tertiarySystemFill);
  font: var(--sui-text-body-size) -apple-system; }
.sui-search__icon  { color: var(--sui-color-secondaryLabel); width: 15px; }
.sui-search__input { flex: 1; border: 0; background: transparent; outline: none;
  color: var(--sui-color-label); font: inherit; }
.sui-search__input::placeholder { color: var(--sui-color-placeholderText); }
.sui-search__input::-webkit-search-cancel-button { display: none; }
.sui-search__clear { display: none; color: var(--sui-color-tertiaryLabel); }
.sui-search[data-has-text="true"] .sui-search__clear { display: inline-flex; }
.sui-search__cancel { display: none; color: var(--sui-color-tint); background: none; border: 0;
  font: inherit; white-space: nowrap; }
.sui-search[data-focused="true"] .sui-search__cancel { display: inline-flex; }
```
```tsx
<Searchable
  text={[query, setQuery]}                 // Binding<String>
  placement="automatic"|"toolbar"|"sidebar"|"navigationBarDrawer"
  prompt="Search"                           // prompt
  isPresented={[shown,setShown]}            // optional programmatic
  suggestions={query => <>…</>}             // searchSuggestions
  scopes={[scope,setScope, ["All","Favorites"]]} // searchScopes (segmented)
/>
```
`isSearching` → expose via a `useIsSearching()` context hook; `dismissSearch` → context action that blurs + clears. **DESIGNED.**

---

## 6. refreshable

### 6.1 Exact API — KNOWN

```swift
// :9060
func refreshable(@_inheritActorContext action: @escaping @Sendable () async -> Void) -> some View
// :9065  EnvironmentValues.refresh : RefreshAction?
// :9070  public struct RefreshAction : Sendable   (callable: await refresh())
```

The `action` is an `async` closure; the pull-to-refresh spinner stays visible until the closure returns. A child can read `@Environment(\.refresh)` and `await refresh?()` to trigger it programmatically. **KNOWN.**

### 6.2 Anatomy & behavior — INFERRED (iOS)

Pull-to-refresh: when the user over-drags the top of the scroll past a threshold (~80–100pt), a circular indicator is revealed in the overscroll gap.

- **Indicator:** a determinate→indeterminate circular progress (the iOS `UIRefreshControl` ring, ~30pt diameter), `secondaryLabel` tint.
- **Phases:** (1) *pulling* — ring fills/rotates proportional to drag distance; (2) *triggered* (past threshold, finger lifted) — ring becomes a spinning indeterminate; row content springs down to make room (~60pt); (3) *refreshing* — spinner spins while `action` runs; (4) *finishing* — content springs back up, spinner fades.
- Threshold ≈ 80pt; reveal height while refreshing ≈ 56–60pt. **INFERRED.**

### 6.3 Web mapping (DESIGNED)

```css
.sui-refresh__spinner { width: 30px; height: 30px; border-radius: 50%;
  border: 2.5px solid var(--sui-color-tertiaryLabel); border-top-color: var(--sui-color-secondaryLabel);
  animation: sui-spin 0.8s linear infinite; opacity: var(--pull-progress, 0); }
@keyframes sui-spin { to { transform: rotate(360deg); } }
.sui-scrollview[data-refreshing="true"] .sui-scrollview__content { transform: translateY(56px); transition: transform 0.3s; }
```
```tsx
<ScrollView refreshable={async () => { await reload(); }}>…</ScrollView>
// or on List: <List refreshable={async () => {...}}>
```
**JS:** on `touchmove`/`wheel` at `scrollTop <= 0`, accumulate overscroll into `--pull-progress` (0→1 over 0..80px); on release past threshold set `data-refreshing="true"`, `await action()`, then clear. The spinner opacity tracks pull progress; rotation runs once triggered. Expose `useRefresh()` for the `@Environment(\.refresh)` analogue.

---

## 7. DisclosureGroup

### 7.1 Exact API — KNOWN

```swift
// :13704
public struct DisclosureGroup<Label, Content> : View where Label : View, Content : View {
  public init(@ViewBuilder content: @escaping () -> Content, @ViewBuilder label: () -> Label)                 // :13705 uncontrolled
  public init(isExpanded: Binding<Bool>, @ViewBuilder content: @escaping () -> Content, @ViewBuilder label: () -> Label) // :13706 controlled
}
// Text-label conveniences (Label == Text):  :13721
extension DisclosureGroup where Label == Text {
  init(_ titleKey: LocalizedStringKey, @ViewBuilder content: () -> Content)                       // :13722
  init(_ titleKey: LocalizedStringKey, isExpanded: Binding<Bool>, @ViewBuilder content: () -> Content) // :13727
  init<S>(_ label: S, @ViewBuilder content: () -> Content) where S : StringProtocol               // :13736
  init<S>(_ label: S, isExpanded: Binding<Bool>, @ViewBuilder content: () -> Content)             // :13737
}
```
`@available(tvOS, unavailable)(watchOS, unavailable)` — iOS 14 / macOS 11+. **KNOWN.**

### 7.2 Anatomy & behavior — INFERRED

```
▶  Label                ← collapsed (chevron points right)
▼  Label                ← expanded (chevron rotated 90° down)
   └ indented content (children)
```

| Element | Value | Token |
|---|---|---|
| Disclosure chevron | SF `chevron.right`, ~13pt, `tertiaryLabel` (iOS) / `secondaryLabel` (macOS sidebar) | `var(--sui-color-tertiaryLabel)` |
| Chevron position | leading on macOS; **trailing** on iOS Form/List rows | |
| Expand rotation | 0° (closed) → 90° (open), animated | |
| Indentation per level | ~28–32pt (macOS sidebar) | `--sui-disclosure-indent: 28px` |
| Label | `body` 17pt `label` | |

**Behavior:** tapping the row (or chevron) toggles `isExpanded`. The chevron rotates with a spring; the content reveals by **height-animating** from 0 with a fade. SwiftUI uses its default UI spring (`response ≈ 0.35, dampingFraction ≈ 0.86`). When `isExpanded` is a binding, it's controlled; otherwise internal `@State`. **INFERRED.**

### 7.3 Web mapping

```html
<div class="sui-disclosure" data-expanded="false">
  <button class="sui-disclosure__header" aria-expanded="false">
    <span class="sui-disclosure__chevron" aria-hidden="true"></span>
    <span class="sui-disclosure__label">Advanced</span>
  </button>
  <div class="sui-disclosure__content" role="group">…</div>
</div>
```
```css
.sui-disclosure__header { display: flex; align-items: center; gap: 6px; width: 100%;
  background: none; border: 0; padding: 11px 16px; font: var(--sui-text-body-size) inherit;
  color: var(--sui-color-label); cursor: default; }
.sui-disclosure__chevron { width: 7px; height: 11px; transition: transform 0.3s cubic-bezier(0.22,1,0.36,1); }
.sui-disclosure__chevron::before { content:""; display:block; width:7px; height:7px;
  border-top: 2px solid var(--sui-color-tertiaryLabel); border-right: 2px solid var(--sui-color-tertiaryLabel);
  transform: rotate(45deg); }
.sui-disclosure[data-expanded="true"] .sui-disclosure__chevron { transform: rotate(90deg); }
.sui-disclosure__content { display: grid; grid-template-rows: 0fr; overflow: hidden;
  transition: grid-template-rows 0.3s cubic-bezier(0.22,1,0.36,1); padding-left: var(--sui-disclosure-indent, 28px); }
.sui-disclosure[data-expanded="true"] .sui-disclosure__content { grid-template-rows: 1fr; }
.sui-disclosure__content > * { min-height: 0; }   /* required for the 0fr→1fr trick */
```
```tsx
<DisclosureGroup
  title="Advanced"                       // titleKey
  isExpanded={[open, setOpen]}           // optional controlled binding; omit for internal state
  label={<Text/>}                        // custom label override
>
  {children}
</DisclosureGroup>
```
The `grid-template-rows: 0fr → 1fr` trick gives the smooth height animation without measuring content (cross-browser as of 2023+; fall back to `max-height` if targeting old engines). **DESIGNED.**

---

## 8. OutlineGroup

### 8.1 Exact API — KNOWN

```swift
// :3218 (5 generic params: Data, ID, Parent, Leaf, Subgroup)
public struct OutlineGroup<Data, ID, Parent, Leaf, Subgroup>
    where Data : RandomAccessCollection, ID : Hashable { }
// Identifiable convenience (:3226):
init<DataElement>(_ root: DataElement, children: KeyPath<DataElement, Data?>,
     @ViewBuilder content: @escaping (DataElement) -> Leaf)        // :3227
init<DataElement>(_ data: Data, children: KeyPath<DataElement, Data?>,
     @ViewBuilder content: @escaping (DataElement) -> Leaf)        // :3228
// explicit id: variants  :3234/:3235 ;  Binding (editable) variants  :3253/:3260
// View conformance (:3240): renders only when Parent/Leaf/Subgroup : View.
// Subgroup defaults to DisclosureGroup<Parent, OutlineSubgroupChildren>  (:3226)
```

`OutlineGroup` is the recursive engine behind hierarchical `List`s. It walks `children` (a `KeyPath` to an optional child collection — `nil` = leaf, non-nil = expandable branch) and emits, per node, either a `Leaf` view (no children) or a `DisclosureGroup` whose content is the recursively-generated subgroup. `OutlineSubgroupChildren` (:3266) is the opaque placeholder for "the auto-generated children." **KNOWN.**

### 8.2 Anatomy & behavior — INFERRED

Each level indents by ~`indentPerLevel` (the `DisclosureGroup` indent ≈ 28pt macOS / smaller in iOS list). Branch nodes show a chevron; leaf nodes don't. Expand/collapse is per-node `DisclosureGroup` behavior (§7). Inside a `List(_:children:)` this is exactly the Finder/Files-app tree. **INFERRED.**

### 8.3 Web mapping (DESIGNED)

A recursive component; each node is a `DisclosureGroup` (branch) or a plain row (leaf):

```tsx
function OutlineGroup({ data, children, content, level = 0 }) {
  return data.map(node => {
    const kids = node[children];                       // the children keypath
    if (!kids) return <div style={{paddingLeft: level*28}}>{content(node)}</div>;  // leaf
    return (
      <DisclosureGroup label={<div style={{paddingLeft: level*28}}>{content(node)}</div>}>
        <OutlineGroup data={kids} children={children} content={content} level={level+1}/>
      </DisclosureGroup>
    );
  });
}
```
CSS-wise: reuse `.sui-disclosure` and add `--depth` driving `padding-left: calc(var(--depth) * 28px)`. Leaf rows reuse `.sui-list__row`. **DESIGNED.**

---

## 9. Table (macOS / iPad)

### 9.1 Exact API — KNOWN

```swift
// :1119
public struct Table<Value, Rows, Columns> : View
    where Value == Rows.TableRowValue, Rows : TableRowContent, Columns : TableColumnContent,
          Rows.TableRowValue == Columns.TableRowValue {
  public typealias Body = Never            // composed from columns+rows builders
}
// columns + explicit rows builders (:1133):
init(of:_ columns:rows:) ; init(of:selection:columns:rows:)              // single/multi selection via Binding<Value.ID?> / Binding<Set<Value.ID>>
init(sortOrder: Binding<[Sort]>, columns:rows:) where Sort : SortComparator   // :1145 sortable
init(selection:sortOrder:columns:rows:)                                  // :1149/:1157
// data convenience (rows auto-built from a collection) (:1170):
init<Data>(_ data: Data, columns:) ; init<Data>(_ data, selection:, columns:) ; init<Data,Sort>(_ data, sortOrder:, columns:)
// iOS17/macOS14 columnCustomization: Binding<TableColumnCustomization<Value>>  (:1181)
// hierarchical (outline) tables: init<Data>(_ data, children: KeyPath<Value,Data?>, ...) (:1198)
```

### 9.2 TableColumn — KNOWN

```swift
// :3287
public struct TableColumn<RowValue, Sort, Content, Label> : TableColumnContent
    where RowValue : Identifiable, Sort : SortComparator, Content : View, Label : View {
  public typealias TableRowValue = RowValue
  public typealias TableColumnSortComparator = Sort
}
// Text-titled, sortable (:3305):
init(_ titleKey: LocalizedStringKey, sortUsing comparator: Sort, @ViewBuilder content: (RowValue) -> Content)
init(_ text: Text, sortUsing comparator: Sort, @ViewBuilder content: (RowValue) -> Content)         // :3316
// non-sortable (Sort == Never) (:3321):
init(_ titleKey: LocalizedStringKey, @ViewBuilder content: (RowValue) -> Content)                    // :3339
init(_ titleKey: LocalizedStringKey, value: KeyPath<RowValue, String>) where Content == Text          // :3350 (string-only, auto text + sortable)
// width control (:3349):
func width(_ width: CGFloat? = nil) -> TableColumn<…>
func width(min: CGFloat? = nil, ideal: CGFloat? = nil, max: CGFloat? = nil) -> TableColumn<…>
// KeyPathComparator convenience (:5008): init(_:value:comparator:) auto-builds the sort.
```

### 9.3 TableRow — KNOWN

```swift
// :6256
public struct TableRow<Value> : TableRowContent where Value : Identifiable {
  public typealias TableRowValue = Value
  public typealias TableRowBody = Never
  public init(_ value: Value)                          // :6259
}
```
`TableRow(value)` wraps one data element; in the builder you usually use `ForEach`/`TableForEachContent` or pass the data collection directly. **KNOWN.**

### 9.4 tableStyle + sorting — KNOWN

```swift
// :19746 func tableStyle<S>(_ style: S) -> some View where S : TableStyle
// :18432 AutomaticTableStyle (.automatic)  :12612 InsetTableStyle (.inset, :12599)
// :21338 BorderedTableStyle (.bordered, :21325, macOS grid lines)
// :19988 func tableColumnHeaders(_ visibility: Visibility) -> some View   // hide/show header row
```

### 9.5 Anatomy & behavior — INFERRED (macOS)

A `Table` is a multi-column data grid (NSTableView on macOS): a **header row** of sortable column titles + a body of rows. Click a header → sorts by that column's `comparator` and writes the new order into the `sortOrder` binding; a small chevron (▲/▼) marks the active sort column and direction. Columns are resizable by dragging header dividers; `.inset` style gives alternating row backgrounds (zebra) and rounded selection. Selection highlights the full row with `system.blue` (`accentColor`). **INFERRED, Apple docs.**

| Element | Value | Token |
|---|---|---|
| Header row height | ~28pt (macOS) | DESIGNED `--sui-table-header-h: 28px` |
| Row height | ~24–28pt (macOS, single line) | `--sui-table-row-h: 28px` |
| Header text | `caption`/`subheadline` 13pt, `secondaryLabel`, often bold | `var(--sui-color-secondaryLabel)` |
| Cell text | `body`/`callout`, `label` | |
| Grid lines (.bordered) | `separator` hairlines, both axes | `var(--sui-color-separator)` |
| Zebra (.inset alternating) | even rows `clear`, odd `secondarySystemFill`-ish | |
| Sort indicator | ▲ ascending / ▼ descending, `secondaryLabel`, in active header | |
| Selection | full row `accentColor` (system.blue) bg, white text | `var(--sui-color-tint)` |

### 9.6 Web mapping

```html
<table class="sui-table" data-style="inset">
  <thead><tr>
    <th aria-sort="ascending"><button class="sui-table__sort">Name<span class="sui-table__caret"/></button></th>
    <th><button class="sui-table__sort">Size</button></th>
  </tr></thead>
  <tbody>
    <tr class="sui-table__row" data-selected="false"><td>Document.pdf</td><td>2 MB</td></tr>
  </tbody>
</table>
```
```css
.sui-table { border-collapse: collapse; width: 100%; font: var(--sui-text-body-size) -apple-system;
  color: var(--sui-color-label); }
.sui-table thead th { height: 28px; text-align: left; font: 600 13px inherit;
  color: var(--sui-color-secondaryLabel); border-bottom: 0.5px solid var(--sui-color-separator);
  padding: 0 8px; user-select: none; position: sticky; top: 0; background: var(--sui-color-systemBackground); }
.sui-table__sort { all: unset; cursor: default; display: inline-flex; align-items: center; gap: 4px; }
.sui-table__caret::before { content: "\25B2"; font-size: 8px; color: var(--sui-color-secondaryLabel); }
.sui-table[data-sort-dir="desc"] .sui-table__caret::before { content: "\25BC"; }
.sui-table__row { height: 28px; }
.sui-table__row td { padding: 0 8px; }
.sui-table[data-style="inset"] .sui-table__row:nth-child(even) { background: var(--sui-color-secondarySystemFill); }
.sui-table[data-style="bordered"] td,
.sui-table[data-style="bordered"] th { border: 0.5px solid var(--sui-color-separator); }
.sui-table__row[data-selected="true"] { background: var(--sui-color-tint); color: #fff; }
.sui-table[data-headers="hidden"] thead { display: none; }
```
```tsx
<Table
  data={rows}
  selection={[selectedIds, setSelected]}      // Binding<Set<ID>> | Binding<ID?>
  sortOrder={[sort, setSort]}                  // Binding<[KeyPathComparator]>
  style="automatic"|"inset"|"bordered"
  showColumnHeaders={true}                      // tableColumnHeaders
>
  <TableColumn title="Name"  value="name"  width={{min:120, ideal:200}}/>
  <TableColumn title="Size"  value="size"  sortUsing={bySize}>{r => <Text>{fmt(r.size)}</Text>}</TableColumn>
</Table>
```
Clicking a `<th>` toggles that column's comparator in `sortOrder` (asc→desc→asc) and re-sorts `data`. `width({min,ideal,max})` → CSS `min-width`/`width`/`max-width` on the `<col>`/`<th>`. **DESIGNED.**

---

## 10. ForEach

### 10.1 Exact API — KNOWN (SwiftUICore.swiftinterface)

```swift
// :16946
public struct ForEach<Data, ID, Content> where Data : RandomAccessCollection, ID : Hashable {
  public var data: Data
  public var content: (Data.Element) -> Content
}
// Identifiable (id = \.id) (:16968):
init(_ data: Data, @ViewBuilder content: @escaping (Data.Element) -> Content)
       where ID == Data.Element.ID, Data.Element : Identifiable
// explicit id keypath (:16977):
init(_ data: Data, id: KeyPath<Data.Element, ID>, @ViewBuilder content: @escaping (Data.Element) -> Content)
// Binding<Collection> → per-element Binding (editable rows) (:16985):
init<C>(_ data: Binding<C>, @ViewBuilder content: @escaping (Binding<C.Element>) -> Content) ...
init<C>(_ data: Binding<C>, id:, content:)   // :16988
// (elsewhere in file) ForEach(_ range: Range<Int>, content:) for constant integer ranges
```

`ForEach` is a `View` (when `Content : View`, :16958) **and** the list-row generator: it exposes `_makeViewList` (:16961) so a `List`/`Table` enumerates it into individual, identity-stable rows. The `ID` is what powers diffing, reorder animations, and `onDelete`/`onMove`. **KNOWN.**

### 10.2 Behavior — KNOWN/INFERRED

- It produces no chrome — each element's `content` is the row body; the enclosing collection styles it.
- Identity (`ID`) drives SwiftUI's structural-diff: inserts/removes animate (default fade+slide), moves animate position. Using array **index** as id (the `Range<Int>` init) breaks identity → no move animation, recycled state. **KNOWN consequence.**
- `onDelete(perform:)` / `onMove(perform:)` (List context) attach swipe-to-delete and drag-reorder to the generated rows. **KNOWN.**

### 10.3 Web mapping (DESIGNED)

`ForEach` ≈ `Array.prototype.map` with a **stable `key`** (the `ID`). The critical fidelity point: the React `key` MUST be the SwiftUI `id` (not the array index) or reorder/insert/delete animations and preserved row state break — exactly mirroring SwiftUI.

```tsx
function ForEach<T>({ data, id = (x:any)=>x.id, children }:
  { data: T[]; id?: (x:T)=>React.Key; children: (item: T)=>React.ReactNode }) {
  return <>{data.map(item => <React.Fragment key={id(item)}>{children(item)}</React.Fragment>)}</>;
}
// usage:
<ForEach data={items} id={i => i.uuid}>{item => <ListRow>…</ListRow>}</ForEach>
```
For animated insert/remove/move, wrap the mapped output in a FLIP/`framer-motion` `<AnimatePresence>` keyed by `id`, with the SwiftUI default transition = opacity + slight y-translate (≈ fade + 8px). Binding-based `ForEach($items)` → pass `[value, setValue]` per element so rows are editable. **DESIGNED.**

---

## 11. Coverage map (every work-list type accounted for)

**Deep-covered (full API + anatomy + behavior + HTML/CSS/prop-API):**

| Type | swiftinterface | Section | Web equivalent |
|---|---|---|---|
| `ScrollView` | SwiftUI :14469 | §1 | `overflow:auto` + scroll-snap |
| `ScrollViewReader` | SwiftUI :18742 | §2 | context provider + `scrollIntoView` |
| `ScrollViewProxy` | SwiftUI :18757 | §2 | `proxy.scrollTo(id, anchor)` |
| `List` | SwiftUI :6456 | §3 | styled `role=list` + section cards |
| `Form` | SwiftUI :13138 | §4 | `List[data-form]` / `.columns` grid |
| `DisclosureGroup` | SwiftUI :13704 | §7 | `[data-expanded]` + grid 0fr→1fr |
| `OutlineGroup` | SwiftUI :3218 | §8 | recursive `DisclosureGroup` |
| `Table` | SwiftUI :1119 | §9 | `<table>` + sortable `<th>` |
| `TableColumn` | SwiftUI :3287 | §9.2 | `<col>`/`<th>` + width |
| `TableRow` | SwiftUI :6256 | §9.3 | `<tr>` |
| `ForEach` | SwiftUICore :16946 | §10 | `.map()` with stable `key` |

**All 11 types in the work-list are deep-covered. None tabulated-only / dropped.**

**Modifiers deep-covered (cluster brief):** `scrollTargetBehavior`/`.paging`/`.viewAligned` (§1.2), `scrollPosition` (§1), `scrollClipDisabled` (§1), `scrollIndicators`/`contentMargins`/`scrollDismissesKeyboard`/`scrollBounceBehavior`/`scrollDisabled` (§1.2), every `ListStyle` `.plain`/`.grouped`/`.insetGrouped`/`.inset`/`.sidebar` (§3.2), `swipeActions` (§3.4), `listRowInsets`/`listRowBackground`/`listRowSeparator`/`listRowSeparatorTint`/`listSectionSeparator`/`listRowSpacing`/`listSectionSpacing`/`scrollContentBackground` (§3.5), selection + `EditMode` (§3.6), `searchable` (§5), `refreshable` (§6).

**Tabulated long-tail (platform-niche styles, named with line + one-liner — not deep-covered because non-iOS-canonical):**

| Type | swiftinterface | Purpose | Web equivalent |
|---|---|---|---|
| `SidebarListStyle` | :2743 | macOS/iPad source-list (covered in §3.2 table) | `data-style="sidebar"` |
| `CarouselListStyle` | :18510 | watchOS vertical carousel | n/a (watch-only) |
| `EllipticalListStyle` | :15805 | watchOS curved crown list | n/a (watch-only) |
| `BorderedListStyle` | :18559 | macOS bordered list | `data-style="bordered"` |
| `ColumnsFormStyle` | :1746 | macOS 2-col form (§4.2) | `.columns` grid |
| `BorderedTableStyle` | :21338 | macOS grid-lined table | `data-style="bordered"` |
| `InsetTableStyle` | :12612 | macOS zebra table | `data-style="inset"` |

## 12. Consolidated CSS custom properties (paste into the kit root)

```css
:root {
  /* scroll */
  --sui-scrollbar-thumb: color-mix(in srgb, var(--sui-color-label) 35%, transparent);
  /* list / settings */
  --sui-list-row-min-h: 44px;
  --sui-list-side-inset: 20px;          /* insetGrouped card margin */
  --sui-list-content-inset: 16px;       /* row text + separator leading inset */
  --sui-list-card-radius: 10px;
  --sui-list-section-gap: 35px;
  --sui-list-row-vpad: 11px;
  --sui-separator-thickness: 0.5px;
  /* search */
  --sui-search-h: 36px;
  --sui-search-radius: 10px;
  /* disclosure / outline */
  --sui-disclosure-indent: 28px;
  /* table */
  --sui-table-header-h: 28px;
  --sui-table-row-h: 28px;
  /* shared spring (DisclosureGroup, swipe snap, paging) */
  --sui-collection-spring: cubic-bezier(0.22, 1, 0.36, 1);  /* approximates response .35/damping .86 */
  --sui-collection-spring-dur: 0.35s;
}
```

These reference the W1 color tokens (`--sui-color-label`, `--sui-color-secondaryLabel`, `--sui-color-tertiaryLabel`, `--sui-color-separator`, `--sui-color-systemGroupedBackground`, `--sui-color-secondarySystemGroupedBackground`, `--sui-color-systemBackground`, `--sui-color-tertiarySystemFill`, `--sui-color-secondarySystemFill`, `--sui-color-tint`, `--sui-color-systemGray4`, `--sui-color-placeholderText`) and W1 typography tokens (`--sui-text-body-size`/`-weight`/`-lineHeight`, `--sui-text-footnote-size`/`-weight`). Where a W1 token name differs from what's referenced above, alias it.

## 13. Fidelity priority for the implementing agent

1. **`List` + `.insetGrouped` (§3) is the make-or-break.** The 20pt card inset, 10pt radius, `secondarySystemGroupedBackground` card on `systemGroupedBackground` page, 16pt-leading interior-only separators, 44pt rows, 35pt section gaps — these four numbers + the separator rules ARE the Settings look. Nail these first.
2. **`Form` (§4) is `List.insetGrouped` + label/control rows** — build it on top of `List`, don't reimplement.
3. **`searchable` bar (§5)** — `tertiarySystemFill` capsule, 36pt, 10pt radius. Second-most-recognizable iOS element here.
4. **`DisclosureGroup`/`OutlineGroup` (§7-8)** — the `grid-template-rows: 0fr→1fr` height animation + 90° chevron rotation is the whole effect.
5. **`swipeActions` (§3.4)** — pointer-drag track with snap + full-swipe-commit; red destructive button.
6. **`ScrollView` snap (§1)** — pure CSS scroll-snap covers `.paging`/`.viewAligned`; no JS spring needed for the common case.
7. **`Table` (§9)** is macOS/iPad-class; lower priority for a mobile-first kit but the `<table>` + sortable-header mapping is complete.
