# SwiftUI Cluster C7 — Navigation (RE Teardown → Web Replication Spec)

**Cluster:** C7 (navigation containers, links, tab bars, nav/tab/tool-bar chrome)
**Authoritative source:** `SwiftUI.framework/.../arm64e-apple-macos.swiftinterface` (macOS SDK, SwiftUI 7 / "26" series). Every signature below is quoted verbatim with its `file:line`. The file path is abbreviated as `SwiftUI.swiftinterface` after first use.
**Token references:** W1 design tokens in `swiftui/tokens/*.md` (`colors.md`, `typography.md`, `materials.md`, `animation.md`).

**Label key:** **KNOWN** = read directly from the swiftinterface. **INFERRED** = from Apple HIG/docs/WWDC/RE of runtime visuals not expressible in the interface (heights, blur recipes, springs). **DESIGNED** = our web engineering to reach the same rendered result.

**Scope note on platform:** the swiftinterface is the *macOS* slice, so a few members are `@available(macOS, unavailable)` (e.g. `topBarLeading`, `bottomBar`, `PageTabViewStyle`). The **web kit targets the iOS visual language** (that is the "SwiftUI look" people mean), so this teardown documents the iOS runtime anatomy/metrics even where the macOS interface marks a symbol unavailable — those symbols still exist in the iOS slice with the same signatures. Each such case is flagged.

---

## Coverage map

**Deep-covered (full HTML+CSS+prop-API):** `NavigationStack`, `NavigationSplitView` (+`NavigationSplitViewVisibility`, `NavigationSplitViewColumn`), `NavigationLink`, `TabView` (+`.page` style, bottom tab bar geometry), `Tab`, and the chrome modifiers `navigationTitle`, `navigationBarTitleDisplayMode` (large-title collapse), `toolbar`/`ToolbarItem`/`ToolbarItemPlacement`, `toolbarBackground`/`toolbarColorScheme`, `tabItem`, `navigationDestination`, `navigationBarBackButtonHidden`.

**Tabulated (long tail, one-line + web-equivalent):** `NavigationPath`, `NavigationView` (deprecated), `TabSection`, `PageTabViewStyle.IndexDisplayMode`, `ToolbarTitleDisplayMode`, `ToolbarPlacement`, `TabRole`, `badge`, `navigationSplitViewStyle`, `tabViewStyle`, sidebar header/footer.

---

# 1. NavigationStack

A push/pop container managing a stack of views over a single root. This is the iOS "drill-down" navigation primitive: large title at top, back-chevron, horizontal slide push/pop, interactive edge-swipe back.

## 1.1 Exact API — KNOWN (`SwiftUI.swiftinterface:14608–14617`)

```swift
@_Concurrency.MainActor @preconcurrency
public struct NavigationStack<Data, Root> : SwiftUICore.View where Root : SwiftUICore.View {
  // 14609 — uncontrolled: internal NavigationPath
  public init(@ViewBuilder root: () -> Root) where Data == SwiftUI.NavigationPath
  // 14610 — controlled by a NavigationPath binding (heterogeneous values)
  public init(path: Binding<SwiftUI.NavigationPath>, @ViewBuilder root: () -> Root) where Data == SwiftUI.NavigationPath
  // 14611 — controlled by a homogeneous typed collection binding
  public init(path: Binding<Data>, @ViewBuilder root: () -> Root)
      where Data : MutableCollection, Data : RandomAccessCollection,
            Data : RangeReplaceableCollection, Data.Element : Hashable
  public var body: some View { get }   // 14612
}
```

Three init forms (all **KNOWN**):
1. `NavigationStack { root }` — stack owns its path internally (uncontrolled).
2. `NavigationStack(path: $navPath) { root }` — `navPath: NavigationPath` (type-erased; can hold mixed `Hashable` value types).
3. `NavigationStack(path: $array) { root }` — `array: [SomeHashable]` (homogeneous; the binding IS the stack; `array.append(x)` pushes, `array.removeLast()` pops).

The destinations themselves are registered **inside** `root` via `.navigationDestination(for:)` (see §10). The stack matches a pushed value's *type* to a registered destination builder.

## 1.2 Visual anatomy (iOS runtime) — INFERRED (HIG/RE; not in interface)

```
┌──────────────────────────────────────────┐  ← top safe area (status bar)
│  Navigation bar  (chrome layer)           │
│  [‹ Back]                      [trailing] │   standard bar: 44pt tall
│  Large Title                              │   large-title row: +52pt (collapses on scroll)
├──────────────────────────────────────────┤
│                                           │
│   Root / pushed content (scrollable)      │
│                                           │
└──────────────────────────────────────────┘
```

| Element | Default metric | Source | W1 token |
|---|---|---|---|
| Nav bar standard height | **44pt** (status bar excluded) | HIG / RE | — |
| Large-title extra row | **+52pt** → 96pt total content height | RE (Hackworth) | — |
| Bar background (scrolled) | `.bar` material (frosted blur) | HIG | `material.bar` → `backdrop-filter: blur(30px) saturate(1.8)` |
| Bar background (top, large title) | **transparent** (no blur until scroll) | RE | — |
| Hairline separator (bottom of bar, scrolled) | `separator` 0.5px | tokens | `--sui-color-separator` |
| Large title typography | **34pt / weight bold (700)**, leading-aligned | HIG | `text.largeTitle` |
| Inline title typography | **17pt / semibold (600)**, centered | HIG | `text.headline` |
| Back chevron + label | SF Symbol `chevron.backward` + previous title; tint = accent | RE | `--sui-color-tint` |
| Bar button tint | systemBlue `#007AFF` | tokens | `--sui-color-tint` |
| Content horizontal inset | **16pt** (large-title leading aligns to it) | HIG | — |

**States:** at-top (large title expanded, transparent bar) → scrolled (large title collapsed to inline, frosted `.bar` material appears with hairline). Back button has default/pressed (0.3 opacity) states.

## 1.3 Behavior — push/pop + interactive back-swipe

- **Push animation** (INFERRED, RE of UINavigationController): incoming view slides in from the **right edge** (translateX 100% → 0); outgoing view slides **left by ~30%** (parallax, translateX 0 → -30%) and dims slightly. Duration ≈ **0.35s**, curve ≈ `cubic-bezier(0.33, 0, 0.13, 1)` (the iOS nav ease — see `animation.md` `0.35s` + that bezier). Pop reverses both.
- **Interactive back-swipe** (INFERRED): a left-edge pan gesture (hot zone ≈ leftmost **20pt**) drives the pop interactively — both layers track the finger 1:1; release past **50% width or with velocity** completes the pop, otherwise it springs back. This is the single most "iOS" feel cue.
- **Large-title collapse** (INFERRED): driven by content scrollY. As `scrollY` goes `0 → 52`, the 34pt large title scrubs to the 17pt inline centered title and the bar background cross-fades from transparent to `.bar` material. Bounces back on overscroll. (See §6 `navigationBarTitleDisplayMode`.)
- **Back chevron tap** pops one level (animated push reverse).

## 1.4 Web replication

**HTML structure**
```html
<div class="sui-navstack" data-collapsed="false">
  <header class="sui-navbar" role="navigation">
    <div class="sui-navbar-inline">                 <!-- 44pt row -->
      <button class="sui-navbar-back" aria-label="Back">
        <svg class="sui-chevron">…chevron.backward…</svg>
        <span class="sui-navbar-back-label">Prev</span>
      </button>
      <span class="sui-navbar-title-inline">Title</span>   <!-- centered, fades in on collapse -->
      <div class="sui-navbar-trailing"><!-- toolbar trailing items --></div>
    </div>
    <h1 class="sui-navbar-largetitle">Title</h1>    <!-- +52pt row, collapses away -->
  </header>
  <div class="sui-navstack-scroll">
    <div class="sui-navstack-page" data-depth="0">…root…</div>
    <!-- pushed pages appended here, animated -->
  </div>
</div>
```

**CSS (load-bearing)**
```css
.sui-navstack { position: relative; height: 100%; overflow: hidden; }

.sui-navbar {
  position: absolute; top: 0; left: 0; right: 0; z-index: 10;
  padding-top: env(safe-area-inset-top, 0px);
  background: transparent;                 /* transparent at top */
  transition: background .25s ease, box-shadow .25s ease;
}
.sui-navstack[data-collapsed="true"] .sui-navbar {
  background: var(--sui-material-bar, rgba(245,245,245,0.80));
  backdrop-filter: blur(30px) saturate(1.8);
  -webkit-backdrop-filter: blur(30px) saturate(1.8);
  box-shadow: 0 0.5px 0 var(--sui-color-separator, rgba(60,60,67,0.29));
}
.sui-navbar-inline {
  height: 44px; display: grid;
  grid-template-columns: 1fr auto 1fr;     /* leading | centered title | trailing */
  align-items: center; padding: 0 8px;
}
.sui-navbar-back { display: inline-flex; align-items: center; gap: 4px;
  color: var(--sui-color-tint, #007AFF); background: none; border: 0;
  font: 600 17px/1 var(--sui-font-default); cursor: pointer; }
.sui-navbar-back:active { opacity: .3; }
.sui-chevron { width: 12px; height: 21px; }
.sui-navbar-title-inline {
  grid-column: 2; justify-self: center;
  font: 600 17px/1.2 var(--sui-font-default); color: var(--sui-color-label, #000);
  opacity: 0; transition: opacity .2s ease;  /* shown only when collapsed */
}
.sui-navstack[data-collapsed="true"] .sui-navbar-title-inline { opacity: 1; }
.sui-navbar-largetitle {
  height: 52px; margin: 0; padding: 0 16px; display: flex; align-items: flex-end;
  font: 700 34px/41px var(--sui-font-default);
  letter-spacing: var(--sui-text-largeTitle-tracking, 0.4px);
  color: var(--sui-color-label, #000);
  transform-origin: left bottom;
  transition: opacity .2s ease, transform .2s ease;
}
.sui-navstack[data-collapsed="true"] .sui-navbar-largetitle { opacity: 0; transform: scale(.5) translateY(8px); height: 0; }

.sui-navstack-scroll { position: absolute; inset: 0; padding-top: 96px; overflow-y: auto; }

/* push / pop slide */
.sui-navstack-page { position: absolute; inset: 0; will-change: transform; }
@keyframes sui-push-in  { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes sui-push-out { from { transform: translateX(0); }     to { transform: translateX(-30%); filter: brightness(.85); } }
.sui-navstack-page[data-anim="push-in"]  { animation: sui-push-in  .35s cubic-bezier(0.33,0,0.13,1) both; }
.sui-navstack-page[data-anim="push-out"] { animation: sui-push-out .35s cubic-bezier(0.33,0,0.13,1) both; }
```

**React prop API (DESIGNED, mirrors the 3 inits)**
```tsx
// uncontrolled — owns its own path
<NavigationStack>{rootView}</NavigationStack>

// controlled by a typed array path (mirrors init #3)
const [path, setPath] = useState<string[]>([]);
<NavigationStack path={path} onPathChange={setPath}>
  <RootView onSelect={(id) => setPath([...path, id])} />
</NavigationStack>

// NavigationStack provides context: useNavigation() → { push(value), pop(), popToRoot(), path }
type NavigationStackProps = {
  path?: unknown[];                       // controlled stack
  onPathChange?: (p: unknown[]) => void;
  children: React.ReactNode;              // the root view
};
```
The `useNavigation()` context is consumed by `<NavigationLink>` and `navigationDestination`. Edge-swipe-back: bind a `pointerdown` on the left 20px gutter, track `pointermove` to drive `translateX` on the top two pages, and on `pointerup` complete if `dx > width/2 || velocity > threshold`.

---

# 2. NavigationSplitView

A 2- or 3-column hierarchical container (sidebar | content | detail). The canonical iPad/Mac master-detail layout; on compact width (iPhone) it collapses to a `NavigationStack`-like single column.

## 2.1 Exact API — KNOWN (`SwiftUI.swiftinterface:20410–20429`)

```swift
public struct NavigationSplitView<Sidebar, Content, Detail> : SwiftUICore.View
    where Sidebar : View, Content : View, Detail : View {
  // 20411 — 3-column, uncontrolled visibility
  public init(@ViewBuilder sidebar: () -> Sidebar, @ViewBuilder content: () -> Content, @ViewBuilder detail: () -> Detail)
  // 20412 — 3-column, controlled visibility
  public init(columnVisibility: Binding<NavigationSplitViewVisibility>,
              @ViewBuilder sidebar: () -> Sidebar, @ViewBuilder content: () -> Content, @ViewBuilder detail: () -> Detail)
  // 20413 — 2-column (sidebar + detail), Content == EmptyView
  public init(@ViewBuilder sidebar: () -> Sidebar, @ViewBuilder detail: () -> Detail) where Content == EmptyView
  // 20414 — 2-column, controlled visibility
  public init(columnVisibility: Binding<NavigationSplitViewVisibility>,
              @ViewBuilder sidebar: () -> Sidebar, @ViewBuilder detail: () -> Detail) where Content == EmptyView
  public var body: some View { get }   // 20415
}
```
Plus (`:20424–20430`, iOS17+) four more inits that add `preferredCompactColumn: Binding<NavigationSplitViewColumn>` — which column shows first when collapsed to compact width.

So **four column shapes**: {3-col, 2-col} × {uncontrolled, controlled `columnVisibility`}, and each can also take `preferredCompactColumn`.

### NavigationSplitViewVisibility — KNOWN (`SwiftUI.swiftinterface:20431–20448`)
```swift
public struct NavigationSplitViewVisibility : Equatable, Codable, Sendable {
  public static var detailOnly: Self   // 20433 — only detail visible
  public static var doubleColumn: Self // 20436 — sidebar(s) + detail (the "two-column" reveal)
  public static var all: Self          // 20439 — all columns visible
  public static var automatic: Self    // 20442 — system decides per size class
}
```

### NavigationSplitViewColumn — KNOWN (`SwiftUI.swiftinterface:21506–21516`)
```swift
public struct NavigationSplitViewColumn : Hashable, Sendable {
  public static var sidebar: Self   // 21507
  public static var content: Self   // 21510
  public static var detail: Self    // 21513
}
```

## 2.2 Visual anatomy — INFERRED (HIG)

```
┌──────────┬──────────────┬───────────────────────┐
│ Sidebar  │  Content     │  Detail                │
│ (master) │  (list)      │  (selected item)       │
│ ≈320pt   │  ≈320pt      │  flex (fills rest)      │
│ grouped  │  plain list  │  full content           │
└──────────┴──────────────┴───────────────────────┘
```

| Element | Default | Source | Token |
|---|---|---|---|
| Sidebar width | **~320pt** (regular), resizable on macOS | HIG | — |
| Sidebar min/max | ~200–400pt drag range | RE | — |
| Sidebar background | sidebar material / `secondarySystemGroupedBackground` (`#F2F2F7` light) | tokens | `--sui-color-secondary-system-grouped-background` |
| Sidebar selected-row | accent-tinted rounded rect, 0.18 alpha fill | RE | `--sui-color-tint` @ 18% |
| Content/detail background | `systemBackground` (`#FFFFFF` / `#000000`) | tokens | `--sui-color-system-background` |
| Column divider | 0.5px `separator` hairline | tokens | `--sui-color-separator` |
| Detail nav bar | inherits a NavigationStack inside detail | — | — |

**States / column-visibility mapping:**
- `.all` → all three columns shown (wide iPad landscape).
- `.doubleColumn` → sidebar + (content|detail) — the "show sidebar" state.
- `.detailOnly` → sidebar hidden, detail full-bleed (tap the sidebar toggle to bring it back).
- `.automatic` → system picks based on width (collapses to single column under compact width).

## 2.3 Behavior

- **Sidebar reveal/collapse** (INFERRED): toggling `columnVisibility` slides the sidebar in/out. On macOS it's an animated width change (~0.25s ease). On iPad the sidebar can overlay (portrait) or push (landscape).
- **Compact collapse** (INFERRED): under compact width the whole thing becomes a single navigation stack; `preferredCompactColumn` decides whether sidebar or detail is the visible root. Selecting a sidebar row pushes content; selecting content pushes detail.
- **Selection wiring** (KNOWN by usage): sidebar rows are usually `NavigationLink(value:)` whose selection drives a `@State`; content list reads it and shows the detail. The split view does NOT own selection — you wire it via bindings.

## 2.4 Web replication

**HTML**
```html
<div class="sui-splitview" data-visibility="all">
  <aside class="sui-split-sidebar">…sidebar list…</aside>
  <section class="sui-split-content">…content list…</section>
  <main class="sui-split-detail">…detail…</main>
</div>
```

**CSS**
```css
.sui-splitview { display: grid; height: 100%;
  grid-template-columns: var(--sidebar-w, 320px) var(--content-w, 320px) 1fr; }
.sui-splitview[data-visibility="doubleColumn"] { grid-template-columns: var(--sidebar-w,320px) 0 1fr; }
.sui-splitview[data-visibility="detailOnly"]   { grid-template-columns: 0 0 1fr; }
.sui-split-sidebar {
  background: var(--sui-color-secondary-system-grouped-background, #F2F2F7);
  border-right: 0.5px solid var(--sui-color-separator, rgba(60,60,67,0.29));
  overflow-y: auto; transition: width .25s ease; }
.sui-split-content {
  background: var(--sui-color-system-background, #FFF);
  border-right: 0.5px solid var(--sui-color-separator, rgba(60,60,67,0.29));
  overflow-y: auto; }
.sui-split-detail { background: var(--sui-color-system-background, #FFF); overflow-y: auto; }
/* sidebar selected row */
.sui-split-sidebar .sui-row[aria-selected="true"] {
  background: color-mix(in srgb, var(--sui-color-tint, #007AFF) 18%, transparent);
  border-radius: 8px; color: var(--sui-color-tint, #007AFF); }
/* compact: single column */
@media (max-width: 700px) {
  .sui-splitview { grid-template-columns: 1fr; }
  .sui-split-sidebar, .sui-split-content { display: var(--compact-hide, none); }
}
```

**React prop API (DESIGNED)**
```tsx
type SplitVisibility = "all" | "doubleColumn" | "detailOnly" | "automatic";
type SplitColumn = "sidebar" | "content" | "detail";

<NavigationSplitView
  columnVisibility={vis}                  // controlled (mirrors init #2/#4)
  onColumnVisibilityChange={setVis}
  preferredCompactColumn="sidebar"        // mirrors iOS17 inits
  sidebar={<SidebarList .../>}
  content={<ContentList .../>}            // omit ⇒ 2-column (Content == EmptyView)
  detail={<DetailView .../>}
/>
```
2-column = omit the `content` prop (matches `Content == EmptyView` overloads). The sidebar-toggle button (a `ToolbarItem`) flips `columnVisibility` between `.all`/`.doubleColumn` and `.detailOnly`.

---

# 3. NavigationLink

A button that, when tapped, pushes a destination onto the enclosing `NavigationStack` (or shows it in the split-view detail). Two flavors: **destination-based** (eager view) and **value-based** (pushes a `Hashable` value matched by `navigationDestination(for:)`).

## 3.1 Exact API — KNOWN

**Destination-based** (`SwiftUI.swiftinterface:11185–11210`)
```swift
public struct NavigationLink<Label, Destination> : View
    where Label : View, Destination : View {
  // 11186 — destination + custom label
  public init(@ViewBuilder destination: () -> Destination, @ViewBuilder label: () -> Label)
}
extension NavigationLink where Label == Text {            // 11199
  public init(_ titleKey: LocalizedStringKey, @ViewBuilder destination: () -> Destination)   // 11200
  public init(_ titleResource: LocalizedStringResource, @ViewBuilder destination: () -> Destination)  // 11204
  public init<S>(_ title: S, @ViewBuilder destination: () -> Destination) where S : StringProtocol     // 11207
}
```

**Value-based** (`SwiftUI.swiftinterface:10484–10500`, `Destination == Never`)
```swift
extension NavigationLink where Destination == Swift.Never {
  public init<P>(value: P?, @ViewBuilder label: () -> Label) where P : Hashable           // 10485
  public init<P>(_ titleKey: LocalizedStringKey, value: P?) where Label == Text, P : Hashable  // 10486
  public init<S, P>(_ title: S, value: P?) where Label == Text, S : StringProtocol, P : Hashable  // 10492
  // + Codable-constrained variants (10493–10500) for NavigationPath persistence
}
```
`value: nil` ⇒ the link is **disabled** (nothing to push). Value-based is the modern idiom: the link just appends `value` to the stack's path; the destination is resolved by a matching `.navigationDestination(for: P.self)`.

`isDetailLink(_:)` (`:11219`) exists but is **iOS-only / macOS-unavailable** — controls whether the push targets the detail column in a split view.

## 3.2 Visual anatomy — INFERRED (HIG)

A `NavigationLink` renders as a **list row** by default (its most common context):
```
┌───────────────────────────────────────────┐
│  Label text                            ›   │  ← trailing disclosure chevron
└───────────────────────────────────────────┘
```

| Element | Default | Token |
|---|---|---|
| Label text | `body` 17pt, `label` color | `text.body`, `--sui-color-label` |
| Disclosure chevron | SF `chevron.forward`, **tertiaryLabel** gray, ~13pt, trailing | `--sui-color-tertiary-label` |
| Row height | **44pt** min | — |
| Row inset | 16pt leading / 16pt trailing | — |
| Pressed state | row background → `systemGray5`-ish highlight fill | `--sui-color-system-fill` |
| Separator | 0.5px below, inset to label | `--sui-color-separator` |

Outside a list (e.g. inline), a NavigationLink renders as plain tappable content with **accent-tinted** label and no chevron.

## 3.3 Behavior

- **Tap** → pushes destination/value onto the stack with the §1.3 push slide. Pressed state highlights the row (background fill, ~0.1s in / instant out).
- **Disabled** when `value: nil` or inside a `.disabled(true)` scope (label dims to `quaternaryLabel`).
- In a List, the chevron is added automatically; in a `NavigationSplitView` sidebar/content, the selected link gets the persistent accent highlight (§2.2) instead of pushing.

## 3.4 Web replication

**HTML (list-row form)**
```html
<button class="sui-navlink sui-row" data-disabled="false">
  <span class="sui-navlink-label">Detail Settings</span>
  <svg class="sui-navlink-chevron" aria-hidden="true">…chevron.forward…</svg>
</button>
```

**CSS**
```css
.sui-navlink.sui-row {
  display: flex; align-items: center; justify-content: space-between;
  min-height: 44px; padding: 0 16px; width: 100%;
  background: var(--sui-color-system-background, #FFF); border: 0; cursor: pointer;
  font: var(--sui-text-body-weight,400) var(--sui-text-body-size,17px)/1.3 var(--sui-font-default);
  color: var(--sui-color-label, #000); text-align: left;
}
.sui-navlink.sui-row:active { background: var(--sui-color-system-fill, rgba(120,120,128,0.2)); }
.sui-navlink-chevron { width: 8px; height: 13px; color: var(--sui-color-tertiary-label, rgba(60,60,67,0.3)); flex: 0 0 auto; }
.sui-navlink[data-disabled="true"] { color: var(--sui-color-quaternary-label, rgba(60,60,67,0.18)); pointer-events: none; }
```

**React prop API (DESIGNED — mirrors both flavors)**
```tsx
// value-based (modern): pushes value, matched by <NavigationDestination for={Type}>
<NavigationLink value={item}>{item.name}</NavigationLink>

// destination-based (eager)
<NavigationLink destination={<DetailView id={x}/>}>Open</NavigationLink>

type NavigationLinkProps = {
  value?: unknown;                    // value-based — null ⇒ disabled
  destination?: React.ReactNode;      // destination-based
  children: React.ReactNode;          // label
};
// impl: const { push } = useNavigation();
// onClick = () => value != null ? push(value) : push({__view: destination});
```

---

# 4. TabView

The top-level container that switches between sibling screens via a **bottom tab bar** (default) or swipeable **paged** carousel (`.page` style). This is the iOS root-navigation primitive.

## 4.1 Exact API — KNOWN (`SwiftUI.swiftinterface:2483–2496`)

```swift
public struct TabView<SelectionValue, Content> : View
    where SelectionValue : Hashable, Content : View {
  // 2488 — legacy: ViewBuilder content, tabs declared via .tabItem on each child
  @available(*, deprecated, message: "Use TabContentBuilder-based TabView initializers instead")
  public init(selection: Binding<SelectionValue>?, @ViewBuilder content: () -> Content)
  // 2490 — iOS18+ modern: TabContentBuilder with Tab { } values
  @available(iOS 18.0, macOS 15.0, *)
  public init<C>(selection: Binding<SelectionValue>, @TabContentBuilder<SelectionValue> content: () -> C)
      where Content == TabContentBuilder<SelectionValue>.Content<C>, C : TabContent
  public var body: some View { get }   // 2491
}
extension TabView where SelectionValue == Swift.Int {     // 2501
  public init(@ViewBuilder content: () -> Content)        // 2502 — unselected/index-based
}
```

Two eras:
- **Legacy:** `TabView(selection: $tab) { ChildA().tabItem{…}.tag(0); ChildB().tabItem{…}.tag(1) }` — tabs come from `.tabItem` + `.tag` on each child (§9).
- **Modern (iOS18+):** `TabView(selection: $tab) { Tab("Home", systemImage:"house", value:0){ … } }` — each tab is a `Tab` value (§5).

**Style modifier** (`:4113`): `func tabViewStyle<S>(_ style: S) -> some View where S : TabViewStyle`. Default = automatic (bottom bar on iPhone). `.page` = swipeable carousel with dots (§4.5).

## 4.2 Bottom tab bar anatomy — INFERRED (HIG / RE)

```
┌───────────────────────────────────────────────┐
│                                               │
│              Selected tab's content           │
│                                               │
├───────────────────────────────────────────────┤  ← .bar material + hairline
│   ⌂        🔍        ♥        ⚙               │   icon 25×25pt
│  Home    Search   Saved   Settings            │   label 10pt
└───────────────────────────────────────────────┘  ← +34pt home-indicator safe area
```

| Element | Default metric | Source | Token |
|---|---|---|---|
| Tab bar height (content) | **49pt** portrait (32pt landscape compact) | RE (Hackworth) | — |
| + home-indicator inset | **+34pt** → 83pt total on notched devices | RE | `env(safe-area-inset-bottom)` |
| Background | `.bar` material (frosted) | HIG | `material.bar` → `blur(30px) saturate(1.8)` |
| Top hairline | 0.5px `separator` | tokens | `--sui-color-separator` |
| Icon size | **25×25pt** (SF Symbol, `.medium`) | RE | — |
| Label typography | **10pt / medium (500)** | RE | `text.caption2`-ish |
| Selected tint | **systemBlue** `#007AFF` (icon + label) | HIG | `--sui-color-tint` |
| Unselected tint | **secondaryLabel** gray `#3C3C43`@0.6 | tokens | `--sui-color-secondary-label` |
| Item layout | icon stacked over label, centered, equal-width flex | RE | — |
| Badge | red pill, top-right of icon, white text 13pt | HIG | `#FF3B30` |

**States per item:** unselected (gray icon+label) / selected (accent icon+label) / pressed (brief 0.7 opacity) / with-badge.

## 4.3 Behavior

- **Tap a tab** → instantly swaps content (no slide; cross-dissolve is subtle/none for standard bar). Updates `selection` binding. Tapping the **already-selected** tab pops its inner NavigationStack to root (INFERRED iOS behavior).
- **Content persistence:** each tab's view tree is kept alive (scroll position preserved) — only visibility toggles, matching SwiftUI keeping non-selected tabs mounted.
- Bar hides when keyboard shows / on scroll-to-hide (iOS 18 `.tabBarMinimizeBehavior`, not in this slice).

## 4.4 Web replication — bottom tab bar

**HTML**
```html
<div class="sui-tabview" data-style="bar">
  <div class="sui-tab-pages">
    <div class="sui-tab-page" data-selected="true">…tab 0 content…</div>
    <div class="sui-tab-page" hidden>…tab 1 content…</div>
  </div>
  <nav class="sui-tabbar" role="tablist">
    <button class="sui-tabbar-item" role="tab" aria-selected="true">
      <svg class="sui-tabbar-icon">…house…</svg>
      <span class="sui-tabbar-label">Home</span>
    </button>
    <!-- …more items… -->
  </nav>
</div>
```

**CSS**
```css
.sui-tabview { position: relative; height: 100%; display: flex; flex-direction: column; }
.sui-tab-pages { flex: 1; position: relative; overflow: hidden; }
.sui-tab-page { position: absolute; inset: 0; overflow-y: auto; }
.sui-tab-page[hidden] { display: none; }

.sui-tabbar {
  display: flex; align-items: stretch;
  height: 49px; padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--sui-material-bar, rgba(245,245,245,0.80));
  backdrop-filter: blur(30px) saturate(1.8);
  -webkit-backdrop-filter: blur(30px) saturate(1.8);
  box-shadow: 0 -0.5px 0 var(--sui-color-separator, rgba(60,60,67,0.29));
}
.sui-tabbar-item {
  flex: 1 1 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; border: 0; background: none; cursor: pointer;
  color: var(--sui-color-secondary-label, rgba(60,60,67,0.6));     /* unselected */
}
.sui-tabbar-item[aria-selected="true"] { color: var(--sui-color-tint, #007AFF); }  /* selected */
.sui-tabbar-item:active { opacity: .7; }
.sui-tabbar-icon  { width: 25px; height: 25px; }
.sui-tabbar-label { font: 500 10px/1 var(--sui-font-default); letter-spacing: .1px; }
/* badge */
.sui-tabbar-badge { position: absolute; top: 4px; left: 56%;
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
  background: #FF3B30; color: #fff; font: 600 12px/18px var(--sui-font-default); text-align: center; }
```

**React prop API (DESIGNED)**
```tsx
<TabView selection={tab} onSelectionChange={setTab} style="bar">
  <Tab title="Home"   systemImage="house"   value={0}>{<HomeView/>}</Tab>
  <Tab title="Search" systemImage="magnifyingglass" value={1} badge={3}>{<SearchView/>}</Tab>
</TabView>

type TabViewProps = {
  selection: unknown; onSelectionChange: (v: unknown) => void;
  style?: "bar" | "page";                 // mirrors .tabViewStyle(.page)
  children: React.ReactElement[];         // <Tab> elements
};
```

## 4.5 Page style — `.tabViewStyle(.page)` — KNOWN (`SwiftUI.swiftinterface:10255–10279`)

```swift
extension TabViewStyle where Self == PageTabViewStyle {           // 10255
  public static var page: PageTabViewStyle { get }                // 10256
  public static func page(indexDisplayMode: PageTabViewStyle.IndexDisplayMode) -> PageTabViewStyle  // 10259
}
public struct PageTabViewStyle : TabViewStyle {                   // 10265
  public struct IndexDisplayMode {
    public static let automatic, always, never                    // 10267–10271
  }
  public init(indexDisplayMode: IndexDisplayMode = .automatic)    // 10273
}
```
> Note: `PageTabViewStyle` is `@available(macOS, unavailable)` in this slice but present on iOS — it's the standard swipeable page carousel.

**Anatomy (INFERRED):** full-bleed horizontally-paged content with a **page-dot indicator** centered near the bottom.
- Dot: **7pt** circle, **8pt** spacing. Current dot = white α1.0; others = white α0.3 (or `label`/`tertiaryLabel` on light bg). `indexDisplayMode`: `.always` = dots always shown, `.never` = hidden, `.automatic` = shown when >1 page.

**Behavior:** horizontal swipe pages between children; snaps to the nearest page (spring ≈ `response 0.4, damping 0.85`, ≈ `cubic-bezier(0.34, 1.3, 0.64, 1)` from `animation.md`); dot tracks the active page.

**Web replication (page style)**
```html
<div class="sui-tabview" data-style="page">
  <div class="sui-pageview">  <!-- scroll-snap track -->
    <div class="sui-page">…0…</div><div class="sui-page">…1…</div>
  </div>
  <div class="sui-page-dots"><span class="dot" data-on="true"></span><span class="dot"></span></div>
</div>
```
```css
.sui-pageview { display: flex; height: 100%; overflow-x: auto;
  scroll-snap-type: x mandatory; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
.sui-pageview::-webkit-scrollbar { display: none; }
.sui-page { flex: 0 0 100%; scroll-snap-align: start; overflow-y: auto; }
.sui-page-dots { position: absolute; bottom: calc(8px + env(safe-area-inset-bottom));
  left: 0; right: 0; display: flex; gap: 8px; justify-content: center; }
.sui-page-dots .dot { width: 7px; height: 7px; border-radius: 50%;
  background: rgba(255,255,255,0.3); transition: background .2s; }
.sui-page-dots .dot[data-on="true"] { background: #fff; }
```
React: `style="page"` switches `<TabView>` to render the scroll-snap track + dots instead of the bottom bar; track an `IntersectionObserver` to sync the active dot + `selection`.

---

# 5. Tab (iOS 18+)

A value descriptor for one tab in a modern `TabView` — bundles the tab's `value` (selection key), its `label` (title + icon), and its `content` (the screen). Replaces the legacy `.tabItem` + `.tag` pattern.

## 5.1 Exact API — KNOWN (`SwiftUI.swiftinterface:14031–14116`)

```swift
@available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
public struct Tab<Value, Content, Label> { }                         // 14032
extension Tab : TabContent where Value : Hashable, Content : View, Label : View {  // 14038
  // image-name form (14040)
  public init<S>(_ title: S, image: String, value: Value, @ViewBuilder content: () -> Content)
      where Label == DefaultTabLabel, S : StringProtocol
  // SF Symbol form (14056) — the common one
  public init<S>(_ title: S, systemImage: String, value: Value, @ViewBuilder content: () -> Content)
      where Label == DefaultTabLabel, S : StringProtocol
  // LocalizedStringKey + systemImage (14060)
  public init(_ titleKey: LocalizedStringKey, systemImage: String, value: Value, @ViewBuilder content: () -> Content)
      where Label == DefaultTabLabel
  // custom label builder (14076)
  public init(value: Value, @ViewBuilder content: () -> Content, @ViewBuilder label: () -> Label)
  // + role: TabRole? overloads (e.g. .search) on each (14041, 14047, 14057, 14074, 14077…)
  // + Value == V? optional-selection variants (14042, 14050, 14058…)
}
extension Tab where Value == Swift.Never { … }    // 14092 — tabs in a TabView with no selection binding
```

Key shapes (all **KNOWN**):
- `Tab("Home", systemImage: "house", value: 0) { HomeView() }` — title + SF Symbol + selection value + content.
- `Tab("Search", systemImage: "magnifyingglass", value: 1, role: .search) { … }` — `.search` role pins it to the trailing/standardized search position.
- `Tab(value: 0) { … } label: { … }` — fully custom label.

`role: TabRole?` (`SwiftUI.swiftinterface:13394`, `TabRole : Hashable, Sendable`) — `.search` is the notable role (renders the dedicated search tab treatment).

## 5.2 Visual anatomy

A `Tab` does not render itself — it **contributes** (a) a tab-bar item (icon + title via `DefaultTabLabel`) and (b) the content screen. The item visuals are the §4.2 tab-bar metrics (25pt icon, 10pt label, accent-on-select). `role: .search` ⇒ on iPhone the item shows the magnifying-glass search affordance; on iPad/Mac it floats to a standardized location.

## 5.3 Behavior

Selecting the item sets the `TabView` selection to this `Tab`'s `value`. `badge(...)` on the tab (§ long-tail) adds the red count pill. Content is mounted/kept-alive like all tabs.

## 5.4 Web replication

The `<Tab>` React element is a **descriptor** consumed by `<TabView>` — it renders nothing on its own; `<TabView>` reads its props to build both the bar item and the page.

```tsx
type TabProps = {
  title: string;
  systemImage?: string;       // SF Symbol name → mapped to an inline <svg>/icon font
  image?: string;             // custom image asset name
  value: unknown;             // selection key
  role?: "search";            // TabRole
  badge?: number | string;    // → red pill
  children: React.ReactNode;  // content screen
  label?: React.ReactNode;    // custom label (overrides title/systemImage)
};
// <TabView> maps over children:
//   bar item  = <button aria-selected={value===selection}> icon(systemImage) + title + badge </button>
//   page      = <div hidden={value!==selection}>{children}</div>
```
No standalone CSS — the rendered chrome reuses `.sui-tabbar-item` / `.sui-tab-page` from §4.4.

---

# 6. Modifier — `navigationTitle` + `navigationBarTitleDisplayMode`

## 6.1 Exact API — KNOWN

`navigationTitle` (`SwiftUI.swiftinterface:18170–18196`)
```swift
extension View {
  public func navigationTitle(_ title: Text) -> some View                       // 18170
  public func navigationTitle(_ titleKey: LocalizedStringKey) -> some View       // 18172
  public func navigationTitle(_ titleResource: LocalizedStringResource) -> some View  // 18175
  public func navigationTitle<S>(_ title: S) -> some View where S : StringProtocol     // 18179
  public func navigationTitle<V>(@ViewBuilder _ title: () -> V) -> some View where V : View  // 18185
  public func navigationTitle(_ title: Binding<String>) -> some View             // 18196 — editable title
}
```

`navigationBarTitleDisplayMode` (`SwiftUI.swiftinterface:18203`)
```swift
public func navigationBarTitleDisplayMode(_ displayMode: NavigationBarItem.TitleDisplayMode) -> some View
```
`NavigationBarItem.TitleDisplayMode` enum (`SwiftUI.swiftinterface:7758–7771`):
```swift
public enum TitleDisplayMode : Sendable {
  case automatic   // 7760 — inherits (root → .large; pushed → .inline)
  case inline      // 7761 — small centered 17pt title, always
  case large       // 7764 — 34pt leading large title (watchOS only platform-gates differ)
}
```
The `Binding<String>` overload (`:18196`) makes the large title **editable** (tap to rename — used in Files/Notes); it renders the title as an inline text field.

## 6.2 The large-title collapse behavior — INFERRED (the key fidelity work)

This is the signature iOS interaction and the most important thing to replicate correctly.

**At rest (scrollY = 0), display mode `.large`:**
- Big **34pt bold** title on its own +52pt row, **leading-aligned** (16pt inset).
- Nav bar background **transparent** (content shows through to the top).

**On scroll down (scrollY: 0 → 52):**
- The 34pt large title **scrubs**: it shrinks/fades and the **inline 17pt centered** title fades in at the same time (cross-fade keyed to scroll offset, not a timed animation — it tracks the finger).
- The bar background **cross-fades from transparent → `.bar` frosted material**, and the bottom hairline appears.
- Past scrollY ≈ 52 the large row is fully collapsed (height 0); only the 44pt inline bar remains.

**On scroll back to top:** reverses; large title re-expands, bar goes transparent again. Overscroll (rubber-band) slightly **stretches** the large title (scale > 1).

`.inline` skips all of this — always the 44pt centered bar. `.automatic` = `.large` for a stack root, `.inline` for pushed screens.

## 6.3 Web replication

Already structurally handled by §1.4 (`data-collapsed` on `.sui-navstack`). The driver:
```js
// scroll-linked collapse — runs on the scroll container
scrollEl.addEventListener('scroll', () => {
  const collapsed = scrollEl.scrollTop >= 52;
  navstack.dataset.collapsed = String(collapsed);
  // optional scrubbed interpolation for 1:1 feel:
  const t = Math.min(1, scrollEl.scrollTop / 52);   // 0..1
  navstack.style.setProperty('--lt-progress', String(t));
});
```
```css
/* scrubbed (smoother than the binary toggle) */
.sui-navbar-largetitle { opacity: calc(1 - var(--lt-progress, 0)); transform: scale(calc(1 - 0.4 * var(--lt-progress,0))); }
.sui-navbar-title-inline { opacity: var(--lt-progress, 0); }
.sui-navbar { background: rgba(245,245,245, calc(0.80 * var(--lt-progress,0))); }
```

**React prop API (DESIGNED)** — these are props on a view inside a `NavigationStack`, or context setters:
```tsx
<NavigationStack>
  <ScrollView
    navigationTitle="Library"
    navigationBarTitleDisplayMode="large"   // "automatic" | "inline" | "large"
  >…</ScrollView>
</NavigationStack>
// title can also be editable: navigationTitle={{ value: name, onChange: setName }}
```
A `useNavigationBar()` context lets a child set `{ title, displayMode }` on the enclosing stack's bar.

---

# 7. Modifier — `toolbar` + `ToolbarItem` + `ToolbarItemPlacement`

Places buttons/controls into the navigation bar, bottom bar, or principal slot.

## 7.1 Exact API — KNOWN

`toolbar` modifiers (`SwiftUI.swiftinterface:17926–17930`, `:9977`)
```swift
extension View {
  public func toolbar<Content>(@ViewBuilder content: () -> Content) -> some View where Content : View          // 17926
  public func toolbar<Content>(@ToolbarContentBuilder content: () -> Content) -> some View where Content : ToolbarContent  // 17928
  public func toolbar<Content>(id: String, @ToolbarContentBuilder content: () -> Content) -> some View          // 17930 (customizable)
  public func toolbar(_ visibility: Visibility, for bars: ToolbarPlacement...) -> some View                     // 9977 — show/hide a bar
}
```

`ToolbarItem` (`SwiftUI.swiftinterface:6742–6768`)
```swift
public struct ToolbarItem<ID, Content> : ToolbarContent where Content : View { … }     // 6742
extension ToolbarItem where ID == () {
  public init(placement: ToolbarItemPlacement = .automatic, @ViewBuilder content: () -> Content)   // 6754
}
extension ToolbarItem where ID == String {   // customizable
  public init(id: String, placement: ToolbarItemPlacement = .automatic, @ViewBuilder content: () -> Content)  // 6759
}
```
`ToolbarItemGroup<Content>` (`:2898`) groups several items under one placement.

## 7.2 ToolbarItemPlacement — KNOWN (`SwiftUI.swiftinterface:6028–6144`)

The placement constants that matter for the iOS nav bar:

| Placement | Where it renders | Source line | Note |
|---|---|---|---|
| `.automatic` | system-chosen (usually trailing) | 6029 | default |
| `.principal` | **center** of the nav bar (replaces title) | 6031 | `@available(watchOS, unavailable)` |
| `.navigation` | leading (start of nav bar) | 6033 | |
| `.primaryAction` | trailing primary action | 6034 | |
| `.topBarLeading` | **leading** of top bar (iOS) | 6053 | `@available(macOS, unavailable)` — iOS slice has it |
| `.topBarTrailing` | **trailing** of top bar (iOS) | 6059 | macOS-unavailable; iOS primary trailing slot |
| `.bottomBar` | bottom toolbar row | 6126 | `@available(macOS, unavailable)` |
| `.confirmationAction` / `.cancellationAction` / `.destructiveAction` | semantic (OK/Cancel/Delete) | 6042–6044 | mapped to leading/trailing by platform |
| `.navigationBarLeading` / `.navigationBarTrailing` | **deprecated** aliases of `.topBarLeading`/`.topBarTrailing` | 6090, 6096 | still used in older code |
| `.keyboard` | input-accessory above keyboard | 6049 | |
| `.title` / `.largeTitle` / `.subtitle` | iOS 26 title-area placements | 6102, 6123, 6138 | newer |

**The four classic iOS placements you must support:** `.navigationBarLeading` (=`.topBarLeading`), `.navigationBarTrailing` (=`.topBarTrailing`), `.principal` (center), `.bottomBar`.

## 7.3 Visual anatomy — INFERRED

- **Leading/trailing bar buttons:** 17pt, **accent-tinted** (systemBlue) text or a 22pt SF Symbol; min 44×44pt hit target; 8pt spacing between grouped items; pressed = 0.3 opacity.
- **`.principal`:** a custom view centered in the bar, replacing the title (e.g. a segmented control).
- **`.bottomBar`:** a 44pt row of toolbar items at the screen bottom, `.bar` material background, items spaced with flexible `Spacer()`s; tint = accent. Often used in browsers/mail.

## 7.4 Web replication

**HTML** — toolbar items are slotted into the nav bar / bottom bar structures from §1.4 / §4.4:
```html
<header class="sui-navbar">
  <div class="sui-navbar-inline">
    <div class="sui-toolbar-slot" data-placement="topBarLeading"><!-- leading items --></div>
    <div class="sui-toolbar-slot" data-placement="principal"><!-- center / title --></div>
    <div class="sui-toolbar-slot" data-placement="topBarTrailing"><!-- trailing items --></div>
  </div>
</header>
<!-- bottom bar (optional) -->
<div class="sui-bottombar" data-placement="bottomBar"><!-- items with flexible spacing --></div>
```
```css
.sui-toolbar-slot { display: inline-flex; align-items: center; gap: 8px; }
.sui-toolbar-slot[data-placement="topBarLeading"]  { justify-self: start; grid-column: 1; }
.sui-toolbar-slot[data-placement="principal"]      { justify-self: center; grid-column: 2; }
.sui-toolbar-slot[data-placement="topBarTrailing"] { justify-self: end; grid-column: 3; }
.sui-toolbar-btn {
  min-width: 44px; min-height: 44px; padding: 0 4px; border: 0; background: none; cursor: pointer;
  color: var(--sui-color-tint, #007AFF); font: 400 17px/1 var(--sui-font-default);
  display: inline-flex; align-items: center; justify-content: center;
}
.sui-toolbar-btn:active { opacity: .3; }
.sui-toolbar-btn[data-role="confirmationAction"] { font-weight: 600; }  /* "Done" is semibold */
.sui-bottombar {
  display: flex; align-items: center; height: 44px; padding: 0 16px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--sui-material-bar, rgba(245,245,245,0.80));
  backdrop-filter: blur(30px) saturate(1.8); -webkit-backdrop-filter: blur(30px) saturate(1.8);
  box-shadow: 0 -0.5px 0 var(--sui-color-separator, rgba(60,60,67,0.29));
}
.sui-bottombar .sui-spacer { flex: 1; }
```

**React prop API (DESIGNED)**
```tsx
<View
  toolbar={[
    { placement: "topBarLeading",  content: <Button title="Edit" /> },
    { placement: "principal",      content: <SegmentedControl … /> },
    { placement: "topBarTrailing", content: <Button title="Done" role="confirmationAction" /> },
    { placement: "bottomBar",      content: <Button systemImage="trash" /> },
  ]}
/>
type ToolbarPlacement =
  | "automatic" | "topBarLeading" | "topBarTrailing" | "navigationBarLeading"
  | "navigationBarTrailing" | "principal" | "navigation" | "primaryAction" | "bottomBar"
  | "confirmationAction" | "cancellationAction" | "destructiveAction" | "keyboard";
```
The enclosing `NavigationStack` reads the toolbar context and renders each item into the matching slot.

---

# 8. Modifier — `toolbarBackground` + `toolbarColorScheme`

Override the bar's background material/visibility and force a light/dark content scheme on a bar.

## 8.1 Exact API — KNOWN (`SwiftUI.swiftinterface:9959–9971`)
```swift
extension View {
  // 9959 — set the bar background to a ShapeStyle (e.g. .ultraThinMaterial, Color.blue, a gradient)
  public func toolbarBackground<S>(_ style: S, for bars: ToolbarPlacement...) -> some View where S : ShapeStyle
  // 9965 — force the background visible/hidden (e.g. always show the frosted bar)
  public func toolbarBackground(_ visibility: Visibility, for bars: ToolbarPlacement...) -> some View
  // 9968 — newer spelling
  public func toolbarBackgroundVisibility(_ visibility: Visibility, for bars: ToolbarPlacement...) -> some View
  // 9971 — force bar content to light/dark (affects title + button tint contrast)
  public func toolbarColorScheme(_ colorScheme: ColorScheme?, for bars: ToolbarPlacement...) -> some View
}
```
`ToolbarPlacement` (`SwiftUI.swiftinterface:23436`): `.automatic`, `.navigationBar` (`macOS-unavailable`), `.bottomBar` (`watchOS 10`), `.windowToolbar` (macOS), `.tabBar`. `Visibility` = `.automatic | .visible | .hidden`.

## 8.2 Behavior — INFERRED
- `toolbarBackground(.visible, for: .navigationBar)` ⇒ the frosted `.bar` material is shown **even at the top** (defeats the §6.2 transparent-at-top default).
- `toolbarBackground(Color.blue, for: .navigationBar)` ⇒ a solid colored bar (e.g. branded apps); the title/buttons stay readable via `toolbarColorScheme(.dark, …)` which forces **white** title + button content.
- `toolbarColorScheme(.dark, for: .navigationBar)` ⇒ bar text/icons render in their dark-scheme (light) colors regardless of app theme.

## 8.3 Web replication
```css
/* forced-visible background */
.sui-navbar[data-bg="visible"] {
  background: var(--sui-material-bar, rgba(245,245,245,0.80));
  backdrop-filter: blur(30px) saturate(1.8); -webkit-backdrop-filter: blur(30px) saturate(1.8);
}
/* custom solid background */
.sui-navbar[data-bg-style] { background: var(--bar-bg); backdrop-filter: none; }
/* forced color scheme → flips title/button colors */
.sui-navbar[data-scheme="dark"] { --sui-color-label: #FFF; --sui-color-tint: #FFF; }
.sui-navbar[data-scheme="light"] { --sui-color-label: #000; }
```
```tsx
<View
  toolbarBackground={{ style: "blue" /* or "visible" */, for: ["navigationBar"] }}
  toolbarColorScheme={{ scheme: "dark", for: ["navigationBar"] }}
/>
```

---

# 9. Modifier — `tabItem` (legacy tab labels)

The pre-iOS18 way to label a `TabView` child.

## 9.1 Exact API — KNOWN (`SwiftUI.swiftinterface:10674`)
```swift
extension View {
  public func tabItem<V>(@ViewBuilder _ label: () -> V) -> some View where V : View    // 10674
}
```
Used as: `ChildView().tabItem { Label("Home", systemImage: "house") }.tag(0)`. The `label` is conventionally a `Label` (icon + text); `.tag(_:)` supplies the selection value. Functionally superseded by `Tab` (§5) but still ubiquitous.

## 9.2 Visual + web
Identical rendered output to a `Tab`'s bar item (§4.2 / §4.4). In the web kit, the legacy form maps to the same `<Tab>` descriptor — we accept both `<Tab>` children and `child.tabItem` metadata:
```tsx
// legacy-equivalent React: pass tabItem on the child
<View tabItem={{ title: "Home", systemImage: "house" }} tag={0}>{<HomeView/>}</View>
// <TabView> reads tabItem+tag the same way it reads <Tab> props.
```

---

# 10. Modifier — `navigationDestination`

Registers, inside a `NavigationStack`, the destination view to build when a value of a given type is pushed (or a boolean/item presents).

## 10.1 Exact API — KNOWN (`SwiftUI.swiftinterface:1468–1475`)
```swift
extension View {
  // 1468 — type-driven: push any D, build C(d)
  public func navigationDestination<D, C>(for data: D.Type, @ViewBuilder destination: @escaping (D) -> C) -> some View
      where D : Hashable, C : View
  // 1470 — boolean-driven presentation
  public func navigationDestination<V>(isPresented: Binding<Bool>, @ViewBuilder destination: () -> V) -> some View where V : View
  // 1475 — optional-item-driven
  public func navigationDestination<D, C>(item: Binding<D?>, @ViewBuilder destination: @escaping (D) -> C) -> some View
      where D : Hashable, C : View
}
```
The `for: D.Type` form is the keystone of value-based navigation: a `NavigationLink(value: someD)` anywhere in the stack pushes `someD`, and the stack finds this registered builder to render the screen. Place it on a view **inside** the `NavigationStack` (typically the root).

## 10.2 Behavior + web
- **type form:** maintain a registry `Map<TypeTag, (value) => ReactNode>` in the `NavigationStack` context. When the path appends a value, look up its tag and render the page (with the §1.3 push slide).
- **isPresented form:** push when bool flips true, pop (and set false) when popped.
- **item form:** push when item becomes non-nil; pop sets it nil.

```tsx
<NavigationStack>
  <RootList />
  <NavigationDestination for="Recipe">{(r) => <RecipeDetail recipe={r}/>}</NavigationDestination>
  <NavigationDestination isPresented={showSettings} onChange={setShowSettings}>{() => <Settings/>}</NavigationDestination>
</NavigationStack>
```

---

# 11. Modifier — `navigationBarBackButtonHidden`

## 11.1 Exact API — KNOWN (`SwiftUI.swiftinterface:7753`)
```swift
extension View {
  public func navigationBarBackButtonHidden(_ hidesBackButton: Swift.Bool = true) -> some View   // 7753
}
```
Hides the automatic `‹ Back` chevron+label on a pushed screen (e.g. a modal-ish flow where you supply your own Cancel/Done in `.toolbar`). **Note:** it hides the button but does NOT disable the interactive edge-swipe-back by itself.

## 11.2 Web replication
```css
.sui-navstack[data-hide-back="true"] .sui-navbar-back { display: none; }
```
```tsx
<DetailView navigationBarBackButtonHidden />   // → sets data-hide-back on the active page's bar
```

---

# 12. Long tail — tabulated (KNOWN signatures + web-equivalent)

| Type / member | `file:line` | One-line purpose | Web equivalent |
|---|---|---|---|
| `NavigationPath` | `SwiftUI.swiftinterface:5935–5956` | Type-erased, optionally-`Codable` stack of `Hashable` values; `count`, `isEmpty`, `append(_:)`, `removeLast(_:)`, `codable` | A JS array of `{tag, value}` behind `useNavigation()`; `append`→push, `removeLast(k)`→pop k. `CodableRepresentation` ⇒ JSON-serializable for deep-link/state restore. |
| `NavigationView` | `SwiftUI.swiftinterface:20695–20703` | **Deprecated** ("use NavigationStack or NavigationSplitView"); single-init legacy container | Alias `<NavigationView>` → renders as `<NavigationStack>`; keep for source-compat only. |
| `TabSection` | `SwiftUI.swiftinterface:15732–15733` | Groups `Tab`s under a header in a sidebar-adaptable `TabView` (iPad sidebar sections) | `<TabSection title>` → a `<li>`-group header in the sidebar variant of the tab bar. |
| `PageTabViewStyle.IndexDisplayMode` | `:10266–10272` | `.automatic`/`.always`/`.never` — page-dot visibility | `data-dots="auto|always|never"` on `.sui-page-dots`. |
| `ToolbarTitleDisplayMode` | `SwiftUI.swiftinterface:20160–20176` | `.automatic`/`.large`/`.inlineLarge`/`.inline` — finer title-mode control than the bar variant | Same `data-collapsed`/displayMode machinery as §6; `.inlineLarge` = large font but inline (no collapse row). |
| `ToolbarPlacement` | `SwiftUI.swiftinterface:23436+` | `.automatic`/`.navigationBar`/`.bottomBar`/`.tabBar`/`.windowToolbar` — which bar a bg/visibility modifier targets | The `for:` arg of toolbarBackground/visibility props; maps to which `.sui-*bar` element gets the override. |
| `TabRole` | `SwiftUI.swiftinterface:13394` | `Hashable` role for a `Tab`; `.search` standardizes the search tab | `role="search"` on `<Tab>` → search-styled bar item. |
| `badge(_:)` on TabContent | `:9045–9055` (Int / Text / key / String) | Adds a count/text badge to a tab-bar item | `badge` prop → `.sui-tabbar-badge` red pill (§4.4). Also `badge` on List rows (`:20190`). |
| `navigationSplitViewStyle(_:)` | `:5862`; styles `.balanced` (`:1724`), `.prominentDetail` (`:9098`) | Split-view column-balancing style | `data-split-style="balanced|prominentDetail"` → adjusts grid column flex (prominentDetail biases width to detail). |
| `tabViewStyle(_:)` | `:4113`; `.page` (`:10256`), `.sidebarAdaptable` (`:7520`), `.carousel` (`:269`), `.verticalPage` (`:15841`) | Chooses tab presentation | `style` prop on `<TabView>`: `"bar"|"page"|"sidebarAdaptable"`; sidebarAdaptable = iPad sidebar instead of bottom bar. |
| `navigationBarHidden(_:)` | `:7709` | Deprecated; hide the whole nav bar | `data-navbar-hidden` → `display:none` on `.sui-navbar`. |
| `navigationBarTitle(_:displayMode:)` | `:7737–7751` | Deprecated combined title+mode | Maps to §6 props. |
| `tabViewSidebarHeader/Footer/BottomBar` | `:14121–14125` | Custom views in the sidebar-adaptable tab sidebar | Slots in the `sidebarAdaptable` variant; out of scope for the iOS bottom-bar default. |
| `toolbarRole(_:)` | `:22130` | `.automatic`/`.navigationStack`/`.editor`/`.browser` — bar layout role | Influences bottom-bar item layout; `data-toolbar-role`. |
| `toolbar(removing:)` | `:16982` | Remove a default item (e.g. `.title`, `.sidebarToggle`) | Drop the corresponding default slot. |

---

# 13. Shared CSS custom properties (W1 token bridge)

Every component above references these — define once on `:root`, override under dark mode. (Light values shown; see `tokens/colors.md` + `tokens/materials.md` for the full table.)

```css
:root {
  /* color (tokens/colors.md) */
  --sui-color-label: #000000;
  --sui-color-secondary-label: rgba(60,60,67,0.60);     /* #3C3C4399 */
  --sui-color-tertiary-label: rgba(60,60,67,0.30);
  --sui-color-quaternary-label: rgba(60,60,67,0.18);
  --sui-color-separator: rgba(60,60,67,0.29);           /* #3C3C434A */
  --sui-color-tint: #007AFF;                            /* systemBlue / accent */
  --sui-color-system-background: #FFFFFF;
  --sui-color-secondary-system-grouped-background: #F2F2F7;
  --sui-color-system-fill: rgba(120,120,128,0.20);
  /* material (tokens/materials.md) — the .bar recipe used by nav/tab/tool bars */
  --sui-material-bar: rgba(245,245,245,0.80);
  /* typography (tokens/typography.md) */
  --sui-font-default: -apple-system, "SF Pro Text", system-ui, sans-serif;
  --sui-text-largeTitle-size: 34px;  --sui-text-largeTitle-weight: 700; --sui-text-largeTitle-tracking: 0.4px;
  --sui-text-body-size: 17px;        --sui-text-body-weight: 400;
}
@media (prefers-color-scheme: dark) {
  :root {
    --sui-color-label: #FFFFFF;
    --sui-color-secondary-label: rgba(235,235,245,0.60);  /* #EBEBF599 */
    --sui-color-separator: rgba(84,84,88,0.65);           /* #545458A6 */
    --sui-color-tint: #0A84FF;
    --sui-color-system-background: #000000;
    --sui-color-secondary-system-grouped-background: #1C1C1E;
    --sui-material-bar: rgba(30,30,30,0.82);
  }
}
```

---

# 14. Constants & springs reference (collected)

| Constant | Value | Confidence |
|---|---|---|
| Nav bar standard height | 44pt | INFERRED (HIG/RE) |
| Large-title row extra | +52pt (→ 96pt total) | INFERRED (RE) |
| Large title font | 34pt / 700 / leading | INFERRED (HIG) |
| Inline title font | 17pt / 600 / centered | INFERRED (HIG) |
| Bar button font | 17pt / 400 (600 for confirmationAction) | INFERRED |
| Tab bar height | 49pt (+34pt safe-area inset → 83pt) | INFERRED (RE) |
| Tab icon / label | 25×25pt / 10pt 500 | INFERRED (RE) |
| Content horizontal inset | 16pt | INFERRED (HIG) |
| `.bar` material | `blur(30px) saturate(1.8)`, tint `rgba(245,245,245,0.80)` light | INFERRED (materials.md) |
| Hairline separator | 0.5px, `--sui-color-separator` | INFERRED |
| Push/pop slide | 0.35s, `cubic-bezier(0.33,0,0.13,1)`; outgoing parallax −30% + dim | INFERRED (RE + animation.md) |
| Edge-swipe-back hot zone | leftmost ~20pt; completes >50% width or velocity | INFERRED (RE) |
| Page snap | spring `cubic-bezier(0.34,1.3,0.64,1)` ≈ response 0.4 damping 0.85 | INFERRED (animation.md) |
| Page dot | 7pt circle, 8pt gap; active α1.0 / inactive α0.3 | INFERRED |
| Sidebar width | ~320pt (200–400 drag range, macOS) | INFERRED |
| Bar-button pressed | opacity 0.3 | INFERRED |
| Tab-item pressed | opacity 0.7 | INFERRED |

**`web_ready=true`** — every deep-covered component (NavigationStack, NavigationSplitView, NavigationLink, TabView+`.page`, Tab, navigationTitle/displayMode, toolbar/ToolbarItem/placements, toolbarBackground/colorScheme, tabItem, navigationDestination, navigationBarBackButtonHidden) ships its HTML structure + load-bearing CSS + React prop API. Proprietary runtime metrics (heights, blur recipe, springs) are labeled INFERRED and calibratable against a real iOS render.
