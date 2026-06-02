# SwiftUI Cluster C4 — Selection Controls (`Picker`, `DatePicker`, `MultiDatePicker`)

**Goal:** pixel-1:1 web replica spec. This file is the implementation contract a later agent uses to write the React+CSS components. Every signature is quoted verbatim from the macOS `arm64e-apple-macos.swiftinterface` with a `file:line` cite. Labels: **KNOWN** = read from the interface; **INFERRED** = Apple docs / HIG / WWDC / reputable RE for runtime visuals the interface can't show; **DESIGNED** = our engineering decision for the web port.

Interface paths (all cites are line numbers in these files):
- **SwiftUI**: `…/SwiftUI.framework/…/arm64e-apple-macos.swiftinterface`
- **SwiftUICore**: `…/SwiftUICore.framework/…/arm64e-apple-macos.swiftinterface`

**Token references** (from `swiftui/tokens/*.md`): `var(--sui-color-label)`, `var(--sui-color-secondary-label)`, `var(--sui-color-tertiary-label)`, `var(--sui-color-separator)`, `var(--sui-color-tint)` (= `#007AFF` light / `#0A84FF` dark, default app accent / `systemBlue`), fills `tertiarySystemFill` (`#7676801F` light / `#7676803D` dark), backgrounds `systemBackground`/`secondarySystemBackground`. Typography: `text.body` (17/22, −0.41), `text.subheadline` (15/20, −0.24), `text.footnote` (13/18, −0.08), `text.caption` (12/16, 0). Radius is `RoundedCornerStyle.continuous` (squircle) by default.

**Coverage map for this cluster:**
- **Deep-covered:** `Picker` (+ all 9 `PickerStyle`s: `.menu`, `.segmented`, `.wheel`, `.inline`, `.palette`, `.navigationLink`, `.radioGroup`, `.automatic/.default`), `DatePicker` (+ `DatePickerComponents` and all 6 `DatePickerStyle`s: `.compact`, `.graphical`, `.wheel`, `.field`, `.stepperField`, `.automatic`), `MultiDatePicker`.
- **Tabulated long-tail:** the per-`Label`-type init overload families (`.systemImage:`, `image:`, `LocalizedStringResource`, `currentValueLabel:` iOS 18) — same body, different label factory; the deprecated `init(selection:label:content:)`; the `*StyleConfiguration` plumbing structs.

---

## 0. Shared mental model — what a "selection control" IS

All three structs are **generic Views parameterized by a `Label` view** that bind a **selection** to a piece of state and render a list of mutually-exclusive (or, for `MultiDatePicker`, multi-select) options. The *rendered* widget is entirely decided by a **style protocol** applied via an environment modifier — the same `Picker` becomes a popup menu, a segmented bar, or a spinning wheel depending on `.pickerStyle(_:)`. This is the central fact for the web port: **one headless React component per control + a `style` prop that swaps the presentation layer**, exactly mirroring SwiftUI's style-protocol architecture.

- `Picker<Label, SelectionValue, Content>` — `SelectionValue : Hashable`; `Content` is a `@ViewBuilder` list of tagged option views (each carries a `.tag(value)`); binds `Binding<SelectionValue>`.
- `DatePicker<Label>` — binds `Binding<Date>`; shows date and/or time fields chosen by `DatePickerComponents`.
- `MultiDatePicker<Label>` — binds `Binding<Set<DateComponents>>`; calendar with multi-day toggle selection (iOS-only).

---

## 1. `Picker`

### 1.1 Exact API — KNOWN

**Type declaration** — `SwiftUI.swiftinterface:13769`:
```swift
public struct Picker<Label, SelectionValue, Content> : SwiftUICore.View
  where Label : SwiftUICore.View, SelectionValue : Swift.Hashable, Content : SwiftUICore.View
```
- `Label` — the picker's label view (its title). For convenience inits, `Label == Text` or `Label == Label<Text, Image>`.
- `SelectionValue : Hashable` — the type of the chosen value (e.g. an enum, `Int`, `String`).
- `Content` — a `@ViewBuilder`-built list of option views. Each option carries its value via `.tag(_:)`; the `Picker` matches the binding against tags by `Hashable` equality.

**Canonical initializers** — `SwiftUI.swiftinterface:13780–13786`:
```swift
@available(iOS 16.0, macOS 13.0, *)
nonisolated public init<C>(
  sources: C,
  selection: Swift.KeyPath<C.Element, SwiftUICore.Binding<SelectionValue>>,
  @SwiftUICore.ViewBuilder content: () -> Content,
  @SwiftUICore.ViewBuilder label: () -> Label
) where C : Swift.RandomAccessCollection                                    // multi-source (mixed-value) form

@_alwaysEmitIntoClient
nonisolated public init(
  selection: SwiftUICore.Binding<SelectionValue>,
  @SwiftUICore.ViewBuilder content: () -> Content,
  @SwiftUICore.ViewBuilder label: () -> Label
)                                                                            // the everyday form
```
The `sources:` overload is for editing a **multiple selection** (e.g. inspector panes): when several objects are selected and they disagree, the picker shows a mixed/indeterminate state. For the single form, `selection` is one `Binding`.

**iOS 18+ `currentValueLabel:` form** — `SwiftUI.swiftinterface:13889–13892`:
```swift
@available(iOS 18.0, macOS 15.0, *)
nonisolated public init(
  selection: SwiftUICore.Binding<SelectionValue>,
  @SwiftUICore.ViewBuilder content: () -> Content,
  @SwiftUICore.ViewBuilder label: () -> Label,
  @SwiftUICore.ViewBuilder currentValueLabel: () -> some View
)
```
`currentValueLabel` overrides what the *collapsed* control shows for the current selection (distinct from the matching option's own view) — used by `.menu`/`.navigationLink` styles.

**`Text`-label convenience** — `SwiftUI.swiftinterface:13788–13811`:
```swift
extension SwiftUI.Picker where Label == SwiftUICore.Text {
  nonisolated public init(_ titleKey: LocalizedStringKey, selection: Binding<SelectionValue>,
                          @ViewBuilder content: () -> Content)                    // :13789
  @_disfavoredOverload
  nonisolated public init<S>(_ title: S, selection: Binding<SelectionValue>,
                             @ViewBuilder content: () -> Content) where S : StringProtocol  // :13808
}
```

**Deprecated label-value form** — `SwiftUI.swiftinterface:14004–14011` (renamed to `Picker(selection:content:label:)`):
```swift
@available(*, deprecated, renamed: "Picker(selection:content:label:)")
nonisolated public init(selection: Binding<SelectionValue>, label: Label, @ViewBuilder content: () -> Content)
```

**Long-tail init families (TABULATED — identical bodies, differ only in label factory):**

| init family | line | label produced | web prop |
|---|---|---|---|
| `(_ titleKey:systemImage:selection:content:)` | 13814 | `Label(titleKey, systemImage:)` | `label`+`systemImage` |
| `(_ titleResource:systemImage:…)` | 13823 | `Label(LocalizedStringResource, systemImage:)` | same |
| `(_ titleKey:image:selection:content:)` | 13868 | `Label(titleKey, image:)` (asset) | `label`+`image` |
| `(_ title:S:selection:content:)` (StringProtocol) | 13808 | `Text(title)` | `label` as plain string |
| all `sources:`-bearing variants | 13782/13798/13832/… | mixed-value editing | `sources`/`selectionKeyPath` (advanced; omit in v1) |
| all `currentValueLabel:` variants (iOS 18) | 13890–14001 | adds collapsed-value override | `currentValueLabel` prop |

> **Web port decision (DESIGNED):** implement ONE `<Picker>` with `selection`, `onChange`, optional `label`/`systemImage`, `style`, and children `<PickerOption value=…>`. The `sources:`/keyPath multi-edit forms are an inspector feature — expose later via an optional `indeterminate` prop, not in v1.

### 1.2 Applying a style — KNOWN

`SwiftUI.swiftinterface:12667` (protocol), `:12679` (modifier):
```swift
public protocol PickerStyle { }                                              // marker protocol, no makeBody publicly
nonisolated public func pickerStyle<S>(_ style: S) -> some View where S : PickerStyle   // :12679
```
`PickerStyle` is a **sealed marker** — you cannot write a custom one; only Apple's concrete styles conform. Each style is a zero-field struct surfaced as a static var on a constrained extension:

| style | static accessor | struct decl | `interface:line` |
|---|---|---|---|
| automatic / default | `.automatic` → `DefaultPickerStyle` | `:10861` | `:10855/10856` |
| segmented | `.segmented` → `SegmentedPickerStyle` | `:12691` | `:12684/12685` |
| wheel | `.wheel` → `WheelPickerStyle` | `:995` | `:987/988` |
| inline | `.inline` → `InlinePickerStyle` | `:7099` | `:7093/7094` |
| menu | `.menu` → `MenuPickerStyle` | (struct elsewhere) | `:22819` |
| palette | `.palette` → `PalettePickerStyle` | `:14023` | `:14015/14016` |
| navigationLink | `.navigationLink` → `NavigationLinkPickerStyle` | (struct) | `:18772` |
| radioGroup (macOS) | `.radioGroup` → `RadioGroupPickerStyle` | `:5510` | `:5500/5501` |

The default resolution (`.automatic`) is **context-dependent** (INFERRED, Apple docs): inside a `Form`/`List` on iOS it resolves to `.menu` (a navigation-link-ish row that pushes/pops a checklist); on macOS `.automatic` → a popup menu (`NSPopUpButton`); free-standing on iOS it is a menu button; on watchOS → `.wheel`.

### 1.3 `.segmented` — visual anatomy (HIGH-FIDELITY) — INFERRED (HIG + UIKit RE)

The segmented picker is the modern iOS `UISegmentedControl`. Sub-elements:
- **Track** — a rounded-rect container. Background = `tertiarySystemFill` (`#7676801F` light / `#7676803D` dark). Outer corner radius **≈ 8–9 pt** (continuous). Track has a **~2 pt inset** all around the pill.
- **Selected pill** — an opaque white (light) / `#636366`-ish elevated (dark) rounded rect that slides under the selected segment. Pill radius ≈ **6–7 pt** (continuous, nested inside the 8–9 pt track). Pill has a subtle shadow: `0 1px 2px rgba(0,0,0,0.12)` + `0 1px 1px rgba(0,0,0,0.04)` and a hairline border.
- **Segment labels** — each segment is equal-width (`1fr` each). Label text = `text.subheadline`-ish weight; selected uses **semibold (600)**, unselected **regular (400)**, both `var(--sui-color-label)`. Segments are separated by **thin vertical dividers** (`var(--sui-color-separator)`, ~1pt tall-inset hairlines) that **fade out adjacent to the selected pill**.

**Default metrics (INFERRED, UIKit RE):**
| metric | value |
|---|---|
| control height | **32 pt** (`28pt` compact / watch) |
| track corner radius | 8–9 pt continuous |
| pill corner radius | 6–7 pt continuous |
| track inset (pill margin) | ~2 pt |
| min segment width | content + ~16pt horizontal padding |
| divider | 1pt, `separator`, vertically inset ~8pt |
| font | 13pt (subheadline) — unselected R400, selected SemiBold 600 |

**States:** default; **pressed segment** — label dims to ~0.4 opacity briefly; **drag** — pill follows finger if you press-and-drag across segments; **disabled** — whole control 0.35 opacity; **selected** — pill present + semibold label.

**Animation (INFERRED):** the pill **slides** to the new segment with a spring — Apple uses an interactive UIKit spring ≈ `response 0.35s, dampingFraction 0.8` (`animation.spring.smooth` token analog). On tap it's a quick ease; on drag it tracks the gesture then settles with the spring. Adjacent dividers cross-fade during the slide.

**Web mapping (segmented):**
```html
<div class="sui-seg" role="tablist" aria-orientation="horizontal">
  <div class="sui-seg__pill" style="--seg-index:1; --seg-count:3"></div>
  <button class="sui-seg__opt" role="tab" aria-selected="false">Day</button>
  <button class="sui-seg__opt" role="tab" aria-selected="true">Week</button>
  <button class="sui-seg__opt" role="tab" aria-selected="false">Month</button>
</div>
```
```css
.sui-seg{
  position:relative; display:grid; grid-auto-flow:column; grid-auto-columns:1fr;
  height:32px; padding:2px; border-radius:9px;
  background:var(--sui-color-tertiary-fill, #7676801F);
  font:600 13px/1 var(--sui-font-text); isolation:isolate;
}
.sui-seg__opt{
  position:relative; z-index:1; border:0; background:transparent; cursor:pointer;
  display:flex; align-items:center; justify-content:center; padding:0 12px;
  color:var(--sui-color-label); font-weight:400; letter-spacing:-0.08px;
  transition:font-weight .2s, color .2s;
}
.sui-seg__opt[aria-selected="true"]{ font-weight:600; }
.sui-seg__opt:active{ opacity:.4; }
/* dividers between segments, hidden next to the pill */
.sui-seg__opt + .sui-seg__opt::before{
  content:""; position:absolute; left:0; top:8px; bottom:8px; width:1px;
  background:var(--sui-color-separator); transform:translateX(-1px);
}
.sui-seg__pill{
  position:absolute; z-index:0; top:2px; bottom:2px;
  width:calc((100% - 4px)/var(--seg-count));
  transform:translateX(calc(var(--seg-index) * 100%));
  border-radius:7px; background:#FFFFFF;
  box-shadow:0 1px 2px rgba(0,0,0,.12), 0 1px 1px rgba(0,0,0,.04);
  border:0.5px solid rgba(0,0,0,.04);
  /* the spring slide */
  transition:transform .35s cubic-bezier(.32,.72,0,1);
}
@media (prefers-color-scheme:dark){ .sui-seg__pill{ background:#636366; } }
```
The pill is positioned by `translateX(index * pillWidth)` so it animates between equal-width slots. `cubic-bezier(.32,.72,0,1)` is the standard Apple "smooth-spring" approximation (used by iOS sheet/segment transitions). React: `<Picker style="segmented">` maps `selection` index → `--seg-index`.

### 1.4 `.menu` — button + popup — INFERRED (HIG)

**Anatomy:** a **button** showing the current value + a trailing **chevron** (iOS: `chevron.up.chevron.down` 2-arrow glyph at ~11pt, `var(--sui-color-secondary-label)`; or a down-chevron in compact contexts). Tap → a **floating menu popover** anchored to the button, listing every option as a row; the selected row shows a **leading checkmark** (`var(--sui-color-tint)`). The menu is a translucent material panel (`materials.md` regular material) with ~13pt continuous corners and a drop shadow.

**Metrics:** button label = `text.body`; chevron 11pt; menu row height ~44pt (iOS) / ~22pt (macOS); checkmark `SF Symbol checkmark` leading, 17pt. Menu appears with a **scale+fade from the anchor corner** (spring response ≈ 0.3, opacity 0→1, scale 0.92→1, transform-origin at the button).

**States:** closed (button); open (menu visible, button highlighted); row hover (macOS: blue highlight `var(--sui-color-tint)` bg, white text); row pressed; disabled.

**Web mapping:**
```html
<div class="sui-menupicker">
  <button class="sui-menupicker__btn" aria-haspopup="listbox" aria-expanded="false">
    <span class="sui-menupicker__value">Medium</span>
    <svg class="sui-menupicker__chev">…chevron.up.chevron.down…</svg>
  </button>
  <ul class="sui-menupicker__menu" role="listbox" hidden>
    <li role="option" aria-selected="true"><svg class="check"/>Medium</li>
    …
  </ul>
</div>
```
```css
.sui-menupicker__btn{display:inline-flex;align-items:center;gap:4px;font:17px/1 var(--sui-font-text);color:var(--sui-color-label);background:none;border:0;cursor:pointer}
.sui-menupicker__chev{width:11px;height:14px;color:var(--sui-color-secondary-label)}
.sui-menupicker__menu{position:absolute;min-width:180px;padding:6px;border-radius:13px;
  background:var(--sui-material-regular);backdrop-filter:blur(20px) saturate(1.8);
  box-shadow:0 10px 40px rgba(0,0,0,.18);transform-origin:top left;
  animation:sui-menu-in .22s cubic-bezier(.32,.72,0,1)}
.sui-menupicker__menu li{display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;border-radius:7px;cursor:pointer}
.sui-menupicker__menu li .check{width:17px;opacity:0;color:var(--sui-color-tint)}
.sui-menupicker__menu li[aria-selected="true"] .check{opacity:1}
.sui-menupicker__menu li:hover{background:var(--sui-color-tint);color:#fff}
@keyframes sui-menu-in{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
```

### 1.5 `.wheel` — spinning drum — INFERRED (UIKit `UIPickerView` RE)

**Anatomy:** a vertically-scrolling **drum** (cylinder illusion). The center row is the selection, framed by **two hairline lines** (`var(--sui-color-separator)`) or, on modern iOS, a **gray selection bar** (`tertiarySystemFill` rounded rect ~34pt tall). Rows above/below the center are **perspective-foreshortened and fade** toward the edges (opacity + scaleY), simulating a 3D barrel.

**Metrics:** row height **34pt** (iOS standard); center selection band 34pt with `tertiarySystemFill`; visible ~5–7 rows; font `text.body` 17pt for center, fading for off-center; the wheel **snaps** to the nearest row on release with deceleration.

**Behavior:** flick → momentum scroll with deceleration, then **snaps** so a row is centered; haptic tick per row crossed (iOS). Selection updates as the centered row changes.

**Web mapping:** a `scroll-snap` column with CSS 3D transforms for the barrel fade.
```css
.sui-wheel{height:238px;/*7×34*/ overflow-y:scroll;scroll-snap-type:y mandatory;
  -webkit-mask:linear-gradient(transparent,#000 25%,#000 75%,transparent);perspective:1000px}
.sui-wheel__row{height:34px;display:flex;align-items:center;justify-content:center;
  scroll-snap-align:center;font:17px var(--sui-font-text);color:var(--sui-color-label);
  /* JS sets per-row: transform:rotateX(deg) translateZ(); opacity by distance from center */}
.sui-wheel__band{position:absolute;left:8px;right:8px;top:50%;height:34px;transform:translateY(-50%);
  border-radius:8px;background:var(--sui-color-tertiary-fill);pointer-events:none}
```
JS on scroll: for each row compute `d = (rowCenter − viewportCenter)/34`, set `transform: rotateX(${d*20}deg) translateZ(-${Math.abs(d)*10}px)` and `opacity: ${1 − Math.min(.85, Math.abs(d)*0.28)}`; snap selects nearest. React `<Picker style="wheel">`.

### 1.6 `.inline` — flat checklist — INFERRED (HIG)

No popup, no drum: renders every option **as a row in the surrounding `List`/`Form`**, the selected row carrying a trailing/leading **checkmark** (`var(--sui-color-tint)`). Used to show all choices inline. Web = a `<ul role="listbox">` of full-width rows, 44pt tall, separator hairlines between, checkmark on the selected row. No container chrome of its own.

### 1.7 `.palette` — compact swatch row — INFERRED (iOS 17 HIG)

A **horizontal row of icon/color chips** (e.g. emoji-reaction style or color tags). Selected chip gets a **filled circular/rounded highlight** in `var(--sui-color-tint)` (or the swatch's own color) with a ring. Often used inside `Menu`s for tag/color/reaction selection. Web = flex row of `<button>` chips ~28–34pt, selected has `outline:2px solid tint` + filled bg. Supports `paletteSelectionEffect` (symbol/automatic/custom) — out of v1 scope; default = symbol fill.

### 1.8 `.navigationLink` — drill-in row — INFERRED (HIG)

A row showing label + current value (`var(--sui-color-secondary-label)`) + a trailing **disclosure chevron** (`chevron.right`, 13pt, `tertiaryLabel`). Tap **pushes a new screen** listing options with checkmarks; choosing pops back. Web = a row that opens a full-panel/sheet list; the collapsed row mirrors the menu button minus popup. React: `<Picker style="navigationLink">` renders a row + routes to an option screen.

### 1.9 `.radioGroup` (macOS) — INFERRED

A **vertical stack of radio buttons** (circle + label). Selected = filled blue dot inside the ring (`var(--sui-color-tint)`). Web = `<div role="radiogroup">` of `<label><input type=radio>…`. Radio ring 16pt, dot 6pt, label `text.body`, 6pt gap, rows ~22pt.

### 1.10 `.automatic` / `DefaultPickerStyle`

Resolves per §1.2 context table. Web port: a `style="automatic"` that maps to `menu` in a list context and `menu` standalone on desktop, `wheel` on "watch" density — for the web kit default to **menu**.

### 1.11 Picker — unified React prop API (DESIGNED)

```tsx
type PickerStyle = "automatic" | "menu" | "segmented" | "wheel"
                 | "inline" | "palette" | "navigationLink" | "radioGroup";

interface PickerProps<T> {
  selection: T;                         // bound value (Hashable analog: any === / key)
  onChange: (v: T) => void;             // mirrors Binding write-back
  label?: React.ReactNode;             // title; string -> Text, or pass systemImage
  systemImage?: string;                 // SF Symbol name for Label form
  currentValueLabel?: React.ReactNode; // iOS-18 collapsed-value override (menu/navLink)
  style?: PickerStyle;                 // .pickerStyle(_:)
  disabled?: boolean;
  indeterminate?: boolean;             // models the `sources:` mixed-value state
  children: React.ReactNode;           // <PickerOption value=…>…</PickerOption> list (== .tag content)
}
// <PickerOption value> sets the tag; selection === value -> selected row/segment.
```
**Behavior contract:** options are matched to `selection` by value equality (Hashable → JS `===`/key compare). Keyboard: arrow keys move selection within segmented/inline/radio; Enter/Space opens menu; Esc closes. ARIA: segmented = `role=tablist`; menu = `aria-haspopup=listbox`; inline/radio = `role=listbox`/`radiogroup`. Each style is a separate sub-renderer chosen by `style`, exactly like SwiftUI swapping `PickerStyle`.

---

## 2. `DatePicker`

### 2.1 Exact API — KNOWN

**Type** — `SwiftUI.swiftinterface:19121`:
```swift
public struct DatePicker<Label> : SwiftUICore.View where Label : SwiftUICore.View {
  public typealias Components = SwiftUI.DatePickerComponents     // :19122
}
```

**Core initializers** — `SwiftUI.swiftinterface:19135–19139`:
```swift
nonisolated public init(
  selection: Binding<Foundation.Date>,
  displayedComponents: DatePicker<Label>.Components = [.hourAndMinute, .date],   // default = date+time
  @ViewBuilder label: () -> Label)                                              // :19136

nonisolated public init(selection: Binding<Date>, in range: ClosedRange<Date>,
  displayedComponents: Components = [.hourAndMinute, .date], @ViewBuilder label: () -> Label)  // :19137
nonisolated public init(selection: Binding<Date>, in range: PartialRangeFrom<Date>,  …)        // :19138 (min only)
nonisolated public init(selection: Binding<Date>, in range: PartialRangeThrough<Date>, …)      // :19139 (max only)
```
> **KNOWN default:** `displayedComponents` defaults to `[.hourAndMinute, .date]` — i.e. an unparameterized `DatePicker` shows **both date AND time**. The three `range` overloads constrain selectable dates (closed / lower-bound / upper-bound).

**`Text`-label convenience** — `SwiftUI.swiftinterface:19143–19190` (availability: iOS/macOS/watchOS; **`@available(tvOS, unavailable)`**):
```swift
extension SwiftUI.DatePicker where Label == Text {
  nonisolated public init(_ titleKey: LocalizedStringKey, selection: Binding<Date>,
     displayedComponents: Components = [.hourAndMinute, .date])                        // :19144
  nonisolated public init(_ titleKey: LocalizedStringKey, selection: Binding<Date>,
     in range: ClosedRange<Date>, displayedComponents: Components = […])               // :19154
  @_disfavoredOverload
  nonisolated public init<S>(_ title: S, selection: Binding<Date>, …) where S: StringProtocol  // :19187
  // + PartialRangeFrom / PartialRangeThrough variants (:19165, :19176, :19188-19190)
  // + LocalizedStringResource @_disfavoredOverload mirrors (:19146,19156,19167,19178)
}
```
(Tabulated: the `LocalizedStringResource` and `StringProtocol` variants are byte-for-byte the keyed forms with a different `Text(...)` factory — `:19146/19156/19167/19178/19187-19190`.)

### 2.2 `DatePickerComponents` — KNOWN (`SwiftUI.swiftinterface:19194–19213`)

```swift
public struct DatePickerComponents : Swift.OptionSet, Swift.Sendable {
  public let rawValue: Swift.UInt
  public init(rawValue: Swift.UInt)
  public static let hourAndMinute: DatePickerComponents          // :19197 — time HH:MM
  public static let date: DatePickerComponents                   // :19198 — calendar date
  @available(watchOS 10.0, *) @available(iOS,macOS,visionOS unavailable)
  public static let hourMinuteAndSecond: DatePickerComponents    // :19203 — watchOS-only HH:MM:SS
}
```
It's an `OptionSet` (bitflags): `.date`, `.hourAndMinute`, or both. The rendered field set is determined by which flags are present. **Web modeling (DESIGNED):** `components?: ("date" | "hourAndMinute" | "hourMinuteAndSecond")[]`, default `["date","hourAndMinute"]`.

### 2.3 Styles — KNOWN accessors

```swift
nonisolated public func datePickerStyle<S>(_ style: S) -> some View where S : DatePickerStyle   // SwiftUI:24196
@preconcurrency @MainActor public protocol DatePickerStyle { … makeBody(configuration:) … }      // :24152
```
Unlike `PickerStyle`, `DatePickerStyle` **does** expose `makeBody(configuration:)` (`:24152`) and a `DatePickerStyleConfiguration` (`:24188`) — but the concrete styles are still Apple-only structs:

| style | accessor | struct / `interface:line` | platform |
|---|---|---|---|
| `.automatic` | `DefaultDatePickerStyle` | `:18306` (accessor `:18299/18300`) | all |
| `.compact` | `CompactDatePickerStyle` | accessor `:19382/19383` | iOS/macOS/Catalyst |
| `.graphical` | `GraphicalDatePickerStyle` | accessor `:18344/18345` | iOS/macOS |
| `.wheel` | `WheelDatePickerStyle` | `:16921` (accessor `:16913/16914`) | iOS/watchOS |
| `.field` | `FieldDatePickerStyle` | accessor `:18336/18337` | macOS |
| `.stepperField` | `StepperFieldDatePickerStyle` | `:18354` (accessor `:18326/18327`) | macOS |

### 2.4 `.compact` — pill button + popover calendar (HIGH-FIDELITY) — INFERRED (HIG)

The default iOS form style. **Anatomy:**
- For `.date`: a **rounded pill** showing the formatted date (e.g. "Jun 2, 2026"), bg `tertiarySystemFill`, text `var(--sui-color-tint)` (blue), `text.body`, corner radius ~6–8pt, padding ~6×12pt, height ~34pt.
- For `.hourAndMinute`: a second pill with the time ("2:30 PM"). Both pills sit on a row with the label on the left (`var(--sui-color-label)`) and pills trailing.
- **Tap the date pill** → a **popover** drops down containing the full `.graphical` month grid (see §2.5). **Tap the time pill** → an inline **wheel** time spinner appears. Only one popover open at a time; tapping elsewhere dismisses.

**Metrics:** pill height 34pt; radius 7pt continuous; pill bg `tertiarySystemFill`; value text tint-colored body; popover = material panel, ~13pt corners, shadow `0 10px 40px rgba(0,0,0,.18)`, appears with scale+fade from the pill.

**States:** collapsed (pill); active/open (pill highlighted tint bg ~0.15 alpha, popover visible); disabled (0.35 opacity).

**Web mapping:**
```html
<div class="sui-datepicker sui-datepicker--compact">
  <span class="sui-datepicker__label">Date</span>
  <div class="sui-datepicker__fields">
    <button class="sui-pill" data-field="date" aria-expanded="false">Jun 2, 2026</button>
    <button class="sui-pill" data-field="time" aria-expanded="false">2:30 PM</button>
  </div>
  <div class="sui-popover" hidden><!-- CalendarGrid or WheelTime --></div>
</div>
```
```css
.sui-datepicker--compact{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sui-pill{font:17px var(--sui-font-text);color:var(--sui-color-tint);
  background:var(--sui-color-tertiary-fill);border:0;border-radius:7px;padding:6px 11px;cursor:pointer}
.sui-pill[aria-expanded="true"]{background:color-mix(in srgb, var(--sui-color-tint) 15%, transparent)}
.sui-popover{position:absolute;z-index:50;padding:12px;border-radius:13px;
  background:var(--sui-material-regular);backdrop-filter:blur(20px) saturate(1.8);
  box-shadow:0 10px 40px rgba(0,0,0,.18);transform-origin:top center;
  animation:sui-pop-in .25s cubic-bezier(.32,.72,0,1)}
@keyframes sui-pop-in{from{opacity:0;transform:scale(.94) translateY(-4px)}to{opacity:1;transform:none}}
```

### 2.5 `.graphical` — full month calendar grid (HIGH-FIDELITY) — INFERRED (HIG + RE)

The reference piece. **Anatomy (top→bottom):**
1. **Month/year header bar** — left: "June 2026" in `text.title3`-ish **semibold**, tappable to switch to a year/month list mode; right: a **‹ ›** prev/next month chevron pair (`var(--sui-color-tint)`). When time is included, a separate time pill sits here too.
2. **Weekday header row** — 7 columns "S M T W T F S" (locale-first-weekday aware), `text.caption`/footnote, **`var(--sui-color-secondary-label)`**, uppercase, semibold-ish.
3. **Day grid** — a **7-column** grid, up to **6 rows**. Each day cell is a **circular tap target**. Layout: `LazyVGrid`-equivalent, columns flexible equal-width, **cell ≈ 44×44pt** tap area with a ~32–36pt circle.
   - **Today (unselected):** day number in **`var(--sui-color-tint)`** (blue), no fill.
   - **Selected day:** day number white on a **filled circle of `var(--sui-color-tint)`** (~34pt diameter).
   - **Today + selected:** same blue filled circle.
   - **Other-month days:** either hidden or dimmed (`var(--sui-color-tertiary-label)`).
   - **Normal days:** `var(--sui-color-label)`.
   - **Out-of-range (disabled by `in:`):** `var(--sui-color-tertiary-label)`, non-interactive.

**Metrics:**
| element | value |
|---|---|
| grid | 7 cols × up to 6 rows |
| day cell tap area | ~44×44pt (≈ 1fr each, min 44) |
| selection circle | ~34pt diameter |
| day font | `text.body` 17pt (selected/today semibold) |
| weekday header | `text.caption` 11–12pt, secondaryLabel, uppercase |
| month title | ~20pt semibold, label color |
| chevrons | 17–22pt, tint |

**Behavior / animation:** tapping a day **animates the blue circle in** (scale 0.6→1 + fade, spring response ≈ 0.3) and moves it from the old day. **Month navigation** (chevron or horizontal swipe) **slides the whole grid horizontally** (new month enters from the side, old exits) with a spring; the month title cross-fades. Tapping the month title **flips** to a wheel-style month+year picker (different mode).

**Web mapping (calendar grid):**
```html
<div class="sui-calendar">
  <header class="sui-calendar__bar">
    <button class="sui-calendar__title" aria-expanded="false">June 2026</button>
    <div class="sui-calendar__nav">
      <button aria-label="Previous month">‹</button>
      <button aria-label="Next month">›</button>
    </div>
  </header>
  <div class="sui-calendar__weekdays">
    <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
  </div>
  <div class="sui-calendar__grid" role="grid">
    <button class="sui-day" role="gridcell">1</button>
    <button class="sui-day is-today" role="gridcell">2</button>
    <button class="sui-day is-selected" role="gridcell" aria-selected="true">5</button>
    <button class="sui-day is-outside" role="gridcell" disabled>30</button>
    <!-- … -->
  </div>
</div>
```
```css
.sui-calendar{width:100%;max-width:340px;font:17px var(--sui-font-text);user-select:none}
.sui-calendar__bar{display:flex;align-items:center;justify-content:space-between;height:44px}
.sui-calendar__title{font:600 20px var(--sui-font-display);color:var(--sui-color-label);background:none;border:0;cursor:pointer}
.sui-calendar__nav button{font-size:22px;color:var(--sui-color-tint);background:none;border:0;cursor:pointer;padding:0 8px}
.sui-calendar__weekdays{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;
  font:600 11px var(--sui-font-text);color:var(--sui-color-secondary-label);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.sui-calendar__grid{display:grid;grid-template-columns:repeat(7,1fr);gap:0}
.sui-day{aspect-ratio:1;min-height:44px;display:grid;place-items:center;border:0;background:none;cursor:pointer;
  color:var(--sui-color-label);border-radius:50%;position:relative}
.sui-day::before{content:"";position:absolute;width:34px;height:34px;border-radius:50%;
  background:transparent;transition:transform .3s cubic-bezier(.32,.72,0,1),background .2s;transform:scale(.6);z-index:-1}
.sui-day.is-today:not(.is-selected){color:var(--sui-color-tint);font-weight:600}
.sui-day.is-selected{color:#fff;font-weight:600}
.sui-day.is-selected::before{background:var(--sui-color-tint);transform:scale(1)}
.sui-day.is-outside,.sui-day[disabled]{color:var(--sui-color-tertiary-label);cursor:default}
/* month transition: wrap grid in a track and translateX on month change */
```
React `<DatePicker style="graphical">`: month state + a `useMemo` building the 42-cell (6×7) day matrix from `firstWeekday`, with `is-today/is-selected/is-outside` flags. Month change toggles a `translateX(±100%)` on a grid track for the slide. Keyboard: arrows move focus by ±1 day / ±7 days; PageUp/Down change month; Enter selects.

### 2.6 `.wheel` (`WheelDatePickerStyle`) — INFERRED

Three (or more) side-by-side **spinning drums** — Month | Day | Year (order is locale-aware) for `.date`, or Hour | Minute | AM/PM for `.hourAndMinute`. Each drum is exactly the §1.5 wheel mechanism (34pt rows, center band, barrel fade, snap, haptic tick). Web = N `<Wheel>` columns in a flex row sharing one center selection band. Each column binds one date component; on snap, recompose the `Date`.

### 2.7 macOS `.field` / `.stepperField` — INFERRED

- **`.field` (`FieldDatePickerStyle`):** a **text field with selectable date sub-fields** — `06/02/2026` where each segment (MM, DD, YYYY) is independently focusable; arrow-up/down increments the focused segment; type to overwrite. No calendar. Web = a segmented `<input>`-like row of `contenteditable`/spinbutton segments separated by `/`.
- **`.stepperField` (`StepperFieldDatePickerStyle`):** same field **plus a trailing ▲▼ stepper** that increments the focused segment. Web = field + a vertical two-button stepper. Both are macOS-only; `text.body`, hairline-bordered field, `secondarySystemBackground`.

### 2.8 `.automatic` (`DefaultDatePickerStyle`)

iOS → `.compact`; macOS → `.stepperField`/field-ish; watchOS → `.wheel`. Web default → `compact`.

### 2.9 DatePicker — React prop API (DESIGNED)

```tsx
interface DatePickerProps {
  selection: Date;
  onChange: (d: Date) => void;
  label?: React.ReactNode;
  components?: ("date" | "hourAndMinute" | "hourMinuteAndSecond")[]; // default ["date","hourAndMinute"]
  min?: Date;  max?: Date;                       // models `in: range` (closed / open-ended)
  style?: "automatic" | "compact" | "graphical" | "wheel" | "field" | "stepperField";
  disabled?: boolean;
  locale?: string;                               // first-weekday + month/day order
}
```

---

## 3. `MultiDatePicker` (iOS-only)

### 3.1 Exact API — KNOWN

**Type** — `SwiftUI.swiftinterface:13234`:
```swift
@available(iOS 16.0, *) @available(tvOS, watchOS, macOS unavailable)
public struct MultiDatePicker<Label> : SwiftUICore.View where Label : SwiftUICore.View
```
The whole type is **iOS-only** (`@available(macOS, unavailable)`, `tvOS`/`watchOS` unavailable — see `:13247-13250`).

**Initializers** — `SwiftUI.swiftinterface:13251–13255`:
```swift
extension SwiftUI.MultiDatePicker {
  nonisolated public init(selection: Binding<Swift.Set<Foundation.DateComponents>>,
                          @ViewBuilder label: () -> Label)                                  // :13252
  nonisolated public init(selection: Binding<Set<DateComponents>>, in bounds: Range<Date>,
                          @ViewBuilder label: () -> Label)                                  // :13253 (half-open lo..<hi)
  nonisolated public init(selection: Binding<Set<DateComponents>>, in bounds: PartialRangeFrom<Date>,
                          @ViewBuilder label: () -> Label)                                  // :13254 (lo...)
  nonisolated public init(selection: Binding<Set<DateComponents>>, in bounds: PartialRangeUpTo<Date>,
                          @ViewBuilder label: () -> Label)                                  // :13255 (..<hi)
}
```
> **KNOWN — the key difference from `DatePicker`:** the binding is `Binding<Set<DateComponents>>`, **not** `Binding<Date>`. It holds a **set of selected days** (each a `DateComponents` with year/month/day, no time). Range bounds use `Range`/`PartialRangeFrom`/`PartialRangeUpTo` (half-open) rather than `ClosedRange`.

**`Text`-label conveniences** — `SwiftUI.swiftinterface:13261–13298`:
```swift
extension SwiftUI.MultiDatePicker where Label == Text {
  init(_ titleKey: LocalizedStringKey, selection: Binding<Set<DateComponents>>)             // :13262
  init(_ titleKey, selection:, in bounds: Range<Date>)                                       // :13266
  init(_ titleKey, selection:, in bounds: PartialRangeFrom<Date>)                            // :13274
  init(_ titleKey, selection:, in bounds: PartialRangeUpTo<Date>)                            // :13282
  // @_disfavoredOverload StringProtocol mirrors :13295-13298
  // @_disfavoredOverload LocalizedStringResource mirrors :13263,13267,13275,13283
}
```

### 3.2 Visual anatomy — INFERRED (HIG)

**Same calendar grid as `.graphical` DatePicker (§2.5)** — month header bar + weekday row + 7-col day grid — but with **multi-select toggle semantics**:
- Tapping a day **toggles it in/out of the set**. Multiple days can be selected simultaneously.
- **Each selected day** shows the filled `var(--sui-color-tint)` circle (white number). There is no single "current" — the entire set is highlighted.
- **No time component** (days only). No time pill.
- Out-of-range days (by `in:` bounds) are `tertiaryLabel`, non-interactive.

There is no separate metric table — it reuses §2.5 calendar metrics exactly (44pt cells, 34pt selection circle, 7×6 grid, caption weekday header, title3-semibold month).

**States:** unselected day, **selected day (in set)**, today, other-month, out-of-range/disabled. Toggling animates the circle in/out (scale+fade, spring ≈ 0.3) identically to §2.5.

### 3.3 Web mapping (DESIGNED)

Reuse the **exact `.sui-calendar` markup + CSS from §2.5**; the only behavioral diff is the click handler toggles set membership instead of replacing a single value, and `is-selected` is applied to **every** day in the set:
```tsx
interface MultiDatePickerProps {
  selection: Set<string>;                 // ISO "YYYY-MM-DD" keys (== DateComponents y/m/d)
  onChange: (next: Set<string>) => void;
  label?: React.ReactNode;
  min?: Date;  max?: Date;                // half-open bounds: Range / PartialRangeFrom / PartialRangeUpTo
}
// onDayClick(day): next = new Set(selection); next.has(key) ? next.delete(key) : next.add(key); onChange(next)
```
```css
/* identical to §2.5 .sui-calendar; .sui-day.is-selected applied per-set-member */
.sui-day.is-selected::before{ background:var(--sui-color-tint); transform:scale(1); }
```
Keyboard: arrows move focus (±1/±7 days); Space/Enter toggles the focused day in the set; bounds clamp focus.

---

## 4. Summary — what the next agent builds

Three React components, each headless + style-switched, mirroring the SwiftUI style-protocol design:

| component | core prop | sub-renderers (style) | high-fidelity piece |
|---|---|---|---|
| `<Picker selection style>` | `selection:T` + `<PickerOption value>` children | menu / **segmented** / wheel / inline / palette / navigationLink / radioGroup | **segmented** sliding pill (§1.3) |
| `<DatePicker selection components style>` | `selection:Date` | compact / **graphical** / wheel / field / stepperField | **graphical** calendar grid (§2.5) |
| `<MultiDatePicker selection>` | `selection:Set<string>` | calendar only | multi-select calendar (§3) — reuses §2.5 |

**The two load-bearing visual primitives to nail:**
1. **Segmented pill** — equal-width grid, absolutely-positioned `.pill` translated by `index`, `cubic-bezier(.32,.72,0,1)` spring slide, semibold-on-select, fading inter-segment dividers (§1.3).
2. **Calendar grid** — `repeat(7,1fr)` grid, circular day cells, `var(--sui-color-tint)`-filled selection circle that scales in on a 0.3s spring, today=blue-text, other-month=tertiaryLabel, horizontal month-slide on navigation (§2.5; reused by graphical DatePicker, compact's popover, and MultiDatePicker).

**Token usage:** selection fills/text = `var(--sui-color-tint)`; track/pill bg = `tertiarySystemFill`; secondary text (weekday/value) = `var(--sui-color-secondary-label)`; dimmed/out-of-range = `var(--sui-color-tertiary-label)`; dividers = `var(--sui-color-separator)`; popovers = regular material; fonts `text.body`/`text.subheadline`/`text.caption`; corners continuous (squircle ≈ 7–9pt for pills/tracks, 13pt for popovers, 50% for day circles).

**Coverage statement:** Deep-covered = `Picker` + all 9 PickerStyles, `DatePicker` + `DatePickerComponents` + all 6 DatePickerStyles, `MultiDatePicker`. Tabulated long-tail (same body, label-factory-only differences) = the `systemImage:`/`image:`/`LocalizedStringResource`/`StringProtocol`/`sources:`/`currentValueLabel:` init families and the macOS field/stepperField styles. Every deep-covered component has HTML + CSS + React prop API.
