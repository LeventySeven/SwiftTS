# SwiftUI Cluster C15 — Styles Registry (the variant system)

**Goal:** spec the entire SwiftUI *style protocol* family so a later agent can build the React+CSS variant engine. A "style" in SwiftUI is the strategy object that a control's `makeBody(configuration:)` uses to render itself. The control (Button, Toggle, Picker…) supplies a **Configuration** struct describing its *semantic content* (label, icon, isPressed, isOn, fractionCompleted…); the style turns that content into pixels.

**Web translation model (the spine of this whole cluster):**
- Every **style protocol** → a `variant` (string union) prop on the React component.
- Every **concrete style struct** (`.bordered`, `.switch`, `.segmented`…) → one value of that union, implemented as a `data-variant="…"` attribute + a CSS rule block (or a CSS class). The component always renders the SAME DOM skeleton; the variant only swaps CSS custom properties / display rules.
- Every **`*StyleConfiguration`** struct → the **render-prop / children contract**: it tells you *exactly which sub-views the control hands to the style*. This is GOLD because it is the authoritative list of slots your component must expose (e.g. `ButtonStyleConfiguration` = `{ label, isPressed, role }` → your `<Button>` must expose a label slot, a pressed state, and a role).

**Source labels:** `KNOWN` = verbatim from the `.swiftinterface` (cited `file:line`) · `INFERRED` = Apple HIG / WWDC / reputable RE for runtime visuals the interface can't show · `DESIGNED` = my CSS/React engineering to reproduce the behavior on the web.

**Interface files (Tier-1A):**
- `SUI` = `.../SwiftUI.framework/.../arm64e-apple-macos.swiftinterface`
- `CORE` = `.../SwiftUICore.framework/.../arm64e-apple-macos.swiftinterface`
- `CHARTS` = `.../Charts.framework/.../arm64e-apple-macos.swiftinterface`

**Token vars referenced** (from `swiftui/tokens/`): `var(--sui-color-tint)` (accent, default `systemBlue` `#007AFF` light), `--sui-color-label` (`#000`/`#FFF`), `--sui-color-secondary-label` (`#3C3C4399`), text sizes `--sui-text-body-size` (17px), `--sui-container-radius`, springs `--sui-anim-smooth-css` / `--sui-anim-snappy-css` / `--sui-anim-bouncy-css`.

---

## 0. The universal style-protocol shape (KNOWN)

Almost every style protocol in SwiftUI is the SAME shape — a `@MainActor` protocol with one method and a `Configuration` typealias:

```swift
// canonical form, e.g. ButtonStyle  (SUI:10353)
@preconcurrency @_Concurrency.MainActor public protocol ButtonStyle {
  associatedtype Body : SwiftUICore.View
  @ViewBuilder @MainActor func makeBody(configuration: Self.Configuration) -> Self.Body
  typealias Configuration = SwiftUI.ButtonStyleConfiguration
}
```

There are **two structural variants** of this:
1. **`makeBody`-style** (public, user-overridable): `ButtonStyle, ToggleStyle, LabelStyle, ProgressViewStyle, GaugeStyle, MenuStyle, FormStyle, DisclosureGroupStyle, GroupBoxStyle, LabeledContentStyle, ControlGroupStyle, TableStyle, PrimitiveButtonStyle, DatePickerStyle`. These pass a `Configuration` struct you render. **You can ship custom variants by implementing one function.**
2. **`_makeView`-style** (private, NOT user-overridable — system-only): `PickerStyle, TextFieldStyle, ListStyle, TabViewStyle, NavigationViewStyle, NavigationSplitViewStyle, MenuButtonStyle, IndexViewStyle, WindowStyle, …`. These take a `_GraphValue<_XxxValue<Self,…>>` and render internally. The *concrete* members are a fixed enum of built-ins; you cannot write a third-party one. → In React these become a **closed `variant` union** (no custom slot).

**Web mapping for the protocol layer (DESIGNED):**
```ts
// Each style protocol → a variant union + (optionally) a custom render fn for the open ones.
type ButtonVariant = 'automatic'|'bordered'|'borderedProminent'|'borderless'|'plain'|'glass'|'glassProminent';
// open protocols also accept a custom render:
type CustomStyle<Cfg> = (cfg: Cfg) => React.ReactNode;
```

---

## 1. Button family — `ButtonStyle` / `PrimitiveButtonStyle` + configs

### 1.1 The two button protocols & their Configurations (KNOWN)

**`ButtonStyle`** (`SUI:10353`) — the *styling-only* protocol. The system keeps ownership of the press gesture; the style just reacts to `isPressed`.
```swift
// SUI:10359-10368  (KNOWN, verbatim)
public struct ButtonStyleConfiguration {
  public struct Label : View { public typealias Body = Never }   // opaque content slot
  public let role: SwiftUI.ButtonRole?      // .destructive / .cancel / nil   (iOS15+)
  public let label: ButtonStyleConfiguration.Label               // the title+icon the user passed
  public let isPressed: Swift.Bool          // true while finger/cursor is down
}
```
→ **Slots your `<Button>` must expose:** `label` (children), `isPressed` (pressed state), `role` (semantic intent). That's the *entire* contract.

**`PrimitiveButtonStyle`** (`SUI:8292`) — the *full-control* protocol. The style owns the gesture and calls `trigger()` to fire the action. ALL the named built-in styles (`.bordered`, `.plain`, `.borderless`, `.borderedProminent`, glass…) are `PrimitiveButtonStyle`s, NOT `ButtonStyle`s (see the JSON `inherits` field).
```swift
// SUI:8298-8311  (KNOWN, verbatim)
public struct PrimitiveButtonStyleConfiguration {
  public struct Label : View { /* _makeView… */ public typealias Body = Never }
  public let role: SwiftUI.ButtonRole?
  public let label: PrimitiveButtonStyleConfiguration.Label
  public func trigger()      // call this to fire the button's action
}
```
→ Difference for the web: a `ButtonStyle` variant is a pure CSS skin reacting to `:active`; a `PrimitiveButtonStyle` variant *also* decides *when* the action fires (e.g. `.menu` fires on release, a hold-style could fire on long-press). For a web kit you implement both as the same `<button onClick>` and treat the distinction as "the variant may override the activation gesture".

`ButtonRole` (referenced, from another cluster): `.destructive` (red tint), `.cancel`. **Web:** `data-role="destructive"` → text/fill becomes `var(--sui-color-destructive)` (`systemRed` `#FF3B30`).

### 1.2 Concrete button styles — visual recipes

All are `struct: PrimitiveButtonStyle`, all expose `public init()` and an opaque `makeBody`. Metrics below are INFERRED from HIG/RE (the interface shows only the type); shape/typography KNOWN-by-observation.

| Style | JSON line | Fill | Text color | Shape / radius | States |
|---|---|---|---|---|---|
| `DefaultButtonStyle` `.automatic` | `SUI:974` | platform default (macOS: white bezel w/ shadow; iOS: tinted text) | accent or label | macOS rounded-rect r≈6; iOS none | resolves to `.bordered` (macOS) or `.borderless`/plain (iOS) |
| `BorderedButtonStyle` `.bordered` | `SUI:16747` | `var(--sui-color-tint)` @ **0.15** opacity fill | `var(--sui-color-tint)` | capsule (iOS) / rounded-rect r6 (macOS) | pressed → fill opacity ↑ to ~0.25 |
| `BorderedProminentButtonStyle` `.borderedProminent` | `SUI:20932` | **solid** `var(--sui-color-tint)` | white (`#FFF`) | capsule/rounded-rect | pressed → 0.8 opacity overlay |
| `BorderlessButtonStyle` `.borderless` | `SUI:1438` | none | `var(--sui-color-tint)` | none | pressed → text 0.3 opacity |
| `PlainButtonStyle` `.plain` | `SUI:8669` | none | `var(--sui-color-label)` (inherits) | none | pressed → 0.3 opacity, no tint |
| `GlassButtonStyle` `.glass` | `SUI:1247` | Liquid-Glass material (backdrop-blur + specular) | label | capsule | pressed → glass dims |
| `GlassProminentButtonStyle` `.glassProminent` | `SUI:3378` | tinted glass | white | capsule | pressed → dim |
| `LinkButtonStyle` `.link` | `SUI:5641` | none | `var(--sui-color-tint)`, underline on hover (macOS) | none | hover → underline |
| `CardButtonStyle` (tvOS) | `SUI:17414` | card surface | label | rounded-rect r large | focus → lift + scale 1.1 + parallax |
| `AccessoryBarButtonStyle` / `AccessoryBarActionButtonStyle` (macOS bars) | `SUI:9296` / `9322` | subtle bar bezel | label | small rounded-rect | hover highlight |

**Default button metrics (INFERRED, iOS 17 / macOS 14):**
- **`.bordered` / `.borderedProminent` control height:** `controlSize.regular` ≈ **iOS 34pt min height** (44pt hit target), macOS **22pt**. Horizontal padding ≈ 16pt iOS / 12pt macOS. Capsule corner = height/2 on iOS; macOS rounded-rect radius **6pt** (5pt small, 8pt large).
- **Typography:** `text.body` (17px iOS) for default; `.borderedProminent` is semibold. macOS `13px` system.
- **Pressed animation:** opacity/scale crossfades over ≈ `0.1s` (snappy). iOS `.bordered` press = fill opacity step, no scale; `.borderedProminent` = brief scale 0.97.
- **Disabled:** whole control → **0.3 opacity** (the universal SwiftUI disabled treatment), pointer-events none.

### 1.3 Web replication — `<Button>` (DESIGNED, paste-and-adapt)

**DOM skeleton (identical for every variant):**
```html
<button class="sui-button" data-variant="bordered" data-role="" data-size="regular"
        aria-pressed="false">
  <span class="sui-button__label">
    <!-- LabelStyleConfiguration-style content: icon + title -->
    <span class="sui-button__icon"><svg/></span>
    <span class="sui-button__title">Save</span>
  </span>
</button>
```

**CSS (variant switch via `data-variant`):**
```css
.sui-button{
  --_tint: var(--sui-color-tint, #007AFF);
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  font: var(--sui-text-body-weight,400) var(--sui-text-body-size,17px)/1 var(--sui-font-default);
  letter-spacing: var(--sui-text-body-tracking,-0.43px);
  border:0; cursor:pointer; user-select:none; -webkit-user-select:none;
  border-radius:9999px;                 /* iOS capsule default */
  padding:8px 16px; min-height:34px;
  transition: background-color .12s, opacity .12s, transform .1s;
}
.sui-button[data-size="small"]{ min-height:28px; padding:5px 12px; font-size:15px; border-radius:8px; }
.sui-button[data-size="large"]{ min-height:50px; padding:12px 22px; font-size:17px; }

/* ---- variants ---- */
.sui-button[data-variant="bordered"]{ background: color-mix(in srgb, var(--_tint) 15%, transparent); color:var(--_tint); }
.sui-button[data-variant="bordered"]:active{ background: color-mix(in srgb, var(--_tint) 25%, transparent); }

.sui-button[data-variant="borderedProminent"]{ background:var(--_tint); color:#fff; font-weight:590; }
.sui-button[data-variant="borderedProminent"]:active{ filter:brightness(.9); transform:scale(.97); }

.sui-button[data-variant="borderless"],
.sui-button[data-variant="plain"]{ background:transparent; padding-inline:6px; }
.sui-button[data-variant="borderless"]{ color:var(--_tint); }
.sui-button[data-variant="plain"]{ color:var(--sui-color-label,#000); }
.sui-button[data-variant="borderless"]:active,
.sui-button[data-variant="plain"]:active{ opacity:.3; }

.sui-button[data-variant="link"]{ background:none; color:var(--_tint); padding:0; }
.sui-button[data-variant="link"]:hover{ text-decoration:underline; }

.sui-button[data-variant="glass"]{ background:rgba(255,255,255,.45); backdrop-filter:blur(20px) saturate(1.6);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 1px 3px rgba(0,0,0,.12); color:var(--sui-color-label); }
.sui-button[data-variant="glassProminent"]{ background: color-mix(in srgb, var(--_tint) 80%, transparent);
  backdrop-filter:blur(20px); color:#fff; }

.sui-button[data-role="destructive"]{ --_tint: var(--sui-color-destructive,#FF3B30); }
.sui-button:disabled{ opacity:.3; pointer-events:none; }
```

**React prop API:**
```tsx
type ButtonVariant =
  'automatic'|'bordered'|'borderedProminent'|'borderless'|'plain'|'link'|'glass'|'glassProminent';
interface ButtonProps {
  variant?: ButtonVariant;            // SwiftUI .buttonStyle(...)
  role?: 'destructive'|'cancel';      // ButtonStyleConfiguration.role
  controlSize?: 'mini'|'small'|'regular'|'large';
  isDisabled?: boolean;
  onPress?: () => void;               // == PrimitiveButtonStyleConfiguration.trigger()
  children: React.ReactNode;          // == .label slot
}
// 'automatic' resolves at runtime: pick 'bordered' on desktop layouts, 'plain'/'borderless' inline.
```
The `isPressed` of `ButtonStyleConfiguration` is just the CSS `:active` pseudo — no JS needed for the common case. A custom `ButtonStyle` (open protocol) = pass a render fn `renderButton={(cfg)=> …}` receiving `{label, isPressed, role}`.

---

## 2. Toggle family — `ToggleStyle` + config (`.switch` / `.button` / `.checkbox`)

### 2.1 Protocol & Configuration (KNOWN)
```swift
// SUI:3077  protocol  +  SUI:3083-3101  config  (verbatim)
public protocol ToggleStyle {
  associatedtype Body : View
  @ViewBuilder func makeBody(configuration: Self.Configuration) -> Self.Body
  typealias Configuration = SwiftUI.ToggleStyleConfiguration
}
public struct ToggleStyleConfiguration {
  public struct Label : View { public typealias Body = Never }   // the toggle's label
  @Binding public var isOn: Swift.Bool                           // two-way on/off
  public var $isOn: Binding<Bool> { get }
  public var isMixed: Swift.Bool                                 // iOS16+: tri-state (mixed/dash)
}
```
→ **Slots:** `label`, **`isOn` binding** (the toggle is a *controlled* component — you MUST read+write it), and `isMixed` (the indeterminate dash state, e.g. a "select all" checkbox whose children are partially checked). This is the canonical "controlled input" contract.

### 2.2 Concrete toggle styles (KNOWN type, INFERRED visuals)

**`SwitchToggleStyle` `.switch`** (`SUI:23189`) — the iOS sliding switch.
```swift
public struct SwitchToggleStyle : ToggleStyle {
  public init()
  public init(tint: Color)   // DEPRECATED — "Use View/tint(_) instead"   (SUI:23196)
}
```
- **Anatomy:** track (pill) + knob (circle). **Track:** iOS **51×31pt**, corner = 15.5 (full pill). **Knob:** **27pt** circle, white, drop shadow `0 3px 8px rgba(0,0,0,.15), 0 3px 1px rgba(0,0,0,.06)`, inset ~2pt.
- **States:** OFF → track `var(--sui-color-fill-tertiary)` / `#78788029` gray, knob left. ON → track `var(--sui-color-tint)` (`#34C759` systemGreen is the *historical* default, but iOS toggles use **green** specifically, NOT accent — KNOWN behavior). Knob slides right.
- **Animation:** knob translate + track color cross-fade with the **interactive spring** (`response 0.15, dampingFraction 0.86`) → `var(--sui-anim-snappy-css)`. Knob squashes slightly wider while dragging (≈ 27→33pt).
- **macOS:** smaller switch, **38×22pt** track, **18pt** knob, accent-blue when ON.

**`CheckboxToggleStyle` `.checkbox`** (`SUI:12434`, **macOS-only** — `@available(iOS,unavailable)`) — the macOS checkbox.
```swift
public struct CheckboxToggleStyle : ToggleStyle { public init() }
```
- **Anatomy:** 14×14pt rounded-square box (r3) + trailing label. OFF → white fill, 1px gray border `#C7C7CC`. ON → accent fill `var(--sui-color-tint)` + white SF-Symbol `checkmark`. **Mixed (`isMixed`)** → accent fill + white `minus` (dash).
- **Animation:** checkmark draws in ≈ `0.15s`; box fill cross-fades.

**`ButtonToggleStyle` `.button`** (`SUI:1105`) — renders the toggle AS a button that stays "pressed-in" when ON.
```swift
public struct ButtonToggleStyle : ToggleStyle { public init() }
```
- **Anatomy:** a `.bordered`-style button. OFF → `.bordered` (tint @ 0.15). ON → `.borderedProminent`-ish (solid tint fill, white/contrast label). Used for toolbars / `.palette`.
- **States:** ON = filled, OFF = subtle fill; pressed = momentary dim.

**`DefaultToggleStyle` `.automatic`** (`SUI:18474`) → resolves to `.switch` on iOS, `.checkbox` on macOS forms, `.button` in toolbars.

### 2.3 Web replication — `<Toggle>` (DESIGNED)

```html
<!-- switch variant -->
<button class="sui-toggle" role="switch" data-variant="switch"
        aria-checked="false" data-on="false">
  <span class="sui-toggle__track"><span class="sui-toggle__knob"></span></span>
  <span class="sui-toggle__label">Wi-Fi</span>
</button>
```
```css
.sui-toggle{ display:inline-flex; align-items:center; gap:8px; background:none; border:0; cursor:pointer; }
/* --- switch --- */
.sui-toggle[data-variant="switch"] .sui-toggle__track{
  width:51px; height:31px; border-radius:15.5px;
  background: var(--sui-color-fill-tertiary,#78788029);
  position:relative; transition: background-color .2s var(--sui-anim-snappy-css, ease);
}
.sui-toggle[data-variant="switch"][data-on="true"] .sui-toggle__track{ background: var(--sui-toggle-on,#34C759); }
.sui-toggle__knob{
  position:absolute; top:2px; left:2px; width:27px; height:27px; border-radius:50%;
  background:#fff; box-shadow:0 3px 8px rgba(0,0,0,.15), 0 3px 1px rgba(0,0,0,.06);
  transition: transform .25s var(--sui-anim-snappy-css, cubic-bezier(.2,.8,.2,1));
}
.sui-toggle[data-on="true"] .sui-toggle__knob{ transform: translateX(20px); }
.sui-toggle:active .sui-toggle__knob{ width:33px; }   /* squash while pressing */

/* --- checkbox (macOS) --- */
.sui-toggle[data-variant="checkbox"] .sui-toggle__track{
  width:14px; height:14px; border-radius:3px; border:1px solid #C7C7CC; background:#fff;
  display:grid; place-items:center;
}
.sui-toggle[data-variant="checkbox"][data-on="true"] .sui-toggle__track{ background:var(--sui-color-tint,#007AFF); border-color:transparent; }
.sui-toggle[data-variant="checkbox"][data-on="true"] .sui-toggle__knob::after{ content:"✓"; color:#fff; font-size:11px; }
.sui-toggle[data-variant="checkbox"][data-mixed="true"] .sui-toggle__knob::after{ content:"–"; }

/* --- button --- */
.sui-toggle[data-variant="button"]{ /* reuse .sui-button[data-variant=bordered] */ }
.sui-toggle[data-variant="button"][data-on="true"]{ /* reuse borderedProminent */ }

.sui-toggle:disabled,.sui-toggle[aria-disabled="true"]{ opacity:.3; pointer-events:none; }
```
```tsx
interface ToggleProps {
  isOn: boolean;                 // ToggleStyleConfiguration.$isOn (controlled)
  onChange: (v:boolean)=>void;
  isMixed?: boolean;             // ToggleStyleConfiguration.isMixed
  variant?: 'switch'|'checkbox'|'button'|'automatic';
  tint?: string;                 // overrides --sui-toggle-on / --sui-color-tint
  isDisabled?: boolean;
  children?: React.ReactNode;    // .label
}
// onClick → onChange(!isOn). role="switch"+aria-checked for a11y; checkbox variant → role="checkbox" aria-checked="mixed" when isMixed.
```

---

## 3. Picker family — `PickerStyle` (closed; `_makeView`-based)

### 3.1 Protocol (KNOWN)
```swift
// SUI:12667  — NOTE: NO makeBody/Configuration. Closed protocol, system-only.
public protocol PickerStyle {
  static func _makeView<SelectionValue>(value: _GraphValue<_PickerValue<Self,SelectionValue>>, …)
  static func _makeViewList<…>(…)
}
public struct _PickerValue<Style, SelectionValue> where Style: PickerStyle, SelectionValue: Hashable {}
```
→ Because there is **no `Configuration`**, third parties cannot author a Picker style. In React this is a **closed `variant` union**. The `SelectionValue: Hashable` constraint = your `value`/`onChange` keys must be primitives/ids. A Picker always has the same content contract: an array of `(tag, label)` options + a current selection.

### 3.2 Concrete picker styles (KNOWN type, INFERRED visuals)

| Style | line | Render | Notes / metrics |
|---|---|---|---|
| `DefaultPickerStyle` `.automatic` | `SUI:10861` | resolves per-context | iOS form → `.menu` (navigationLink in nav), macOS → `.menu` popup, segmented contexts → `.segmented` |
| `MenuPickerStyle` `.menu` | `SUI:22826` | a button that opens a popup menu of options; shows current value + chevron | iOS/macOS dropdown. Trigger height 34/22pt, trailing `chevron.up.chevron.down` |
| `SegmentedPickerStyle` `.segmented` | `SUI:12691` | horizontal segmented control; selected segment has white "thumb" | iOS height **32pt**, r **9**, track `#78788029`, thumb white w/ shadow, equal-width segments |
| `InlinePickerStyle` `.inline` | `SUI:7099` | options rendered inline as a list (no popup); selected row shows checkmark | used inside Lists/Forms |
| `WheelPickerStyle` `.wheel` | `SUI:995` | the iOS spinning drum | row height ~34pt, 3D cylinder, center selection band, haptic tick |
| `PalettePickerStyle` `.palette` | `SUI:14023` | row of icon "chips", selected chip highlighted | for emoji/reaction style choosers |
| `NavigationLinkPickerStyle` `.navigationLink` | `SUI:18779` | a row that pushes a sub-screen list | iOS Settings pattern; trailing value + chevron |
| `RadioGroupPickerStyle` `.radioGroup` | `SUI:5510` | vertical radio buttons (macOS) | macOS only; 16pt radio + label |
| `PopUpButtonPickerStyle` (macOS) | `SUI:22099` | macOS NSPopUpButton bezel | bordered popup |

### 3.3 Web replication — `<Picker>` (DESIGNED)
**Segmented** (most reused):
```html
<div class="sui-picker" role="radiogroup" data-variant="segmented">
  <button role="radio" aria-checked="true"  data-selected="true">Day</button>
  <button role="radio" aria-checked="false">Week</button>
  <button role="radio" aria-checked="false">Month</button>
</div>
```
```css
.sui-picker[data-variant="segmented"]{
  display:inline-flex; padding:2px; gap:0; height:32px; border-radius:9px;
  background:var(--sui-color-fill-tertiary,#78788029); position:relative;
}
.sui-picker[data-variant="segmented"] button{
  flex:1; border:0; background:none; font:500 13px/1 var(--sui-font-default);
  color:var(--sui-color-label); border-radius:7px; cursor:pointer; padding:0 12px;
  transition: background .2s;
}
.sui-picker[data-variant="segmented"] button[data-selected="true"]{
  background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.12), 0 1px 1px rgba(0,0,0,.04);
}
/* menu variant → a sui-button[bordered] that opens <Menu>; inline → list rows w/ trailing checkmark */
```
```tsx
interface PickerProps<T extends string|number> {
  selection: T; onChange:(v:T)=>void;     // SelectionValue: Hashable
  variant?: 'automatic'|'menu'|'segmented'|'inline'|'wheel'|'palette'|'navigationLink'|'radioGroup';
  options: { value:T; label:React.ReactNode }[];
  label?: React.ReactNode;                // the Picker's own title
}
```
`.menu` → render a trigger button + the `<Menu>` component (§6). `.inline` → a `<ul>` of rows, selected row gets a trailing `checkmark` SF symbol tinted `var(--sui-color-tint)`. `.wheel` → a CSS scroll-snap column with a centered selection band (`scroll-snap-type:y mandatory`).

---

## 4. Label family — `LabelStyle` (`.titleAndIcon` / `.iconOnly` / `.titleOnly`)

### 4.1 Protocol & config (KNOWN)
```swift
// SUI:23847 protocol + SUI:23853-23868 config (verbatim)
public protocol LabelStyle {
  associatedtype Body : View
  @ViewBuilder func makeBody(configuration: Self.Configuration) -> Self.Body
  typealias Configuration = SwiftUI.LabelStyleConfiguration
}
public struct LabelStyleConfiguration {
  public struct Title { public typealias Body = Never }   // the text
  public struct Icon  { public typealias Body = Never }   // the SF Symbol / image
  public var title: Configuration.Title { get }
  public var icon:  Configuration.Icon  { get }
}
```
→ **Slots: `title` + `icon`.** This is the cleanest Configuration: a Label is literally an icon-leading row of (icon, title). Every style is just a show/hide of those two slots.

### 4.2 Concrete styles (KNOWN type)
| Style | line | Renders |
|---|---|---|
| `DefaultLabelStyle` `.automatic` | `SUI:1290` | both, icon leading (context may hide one, e.g. nav bars show iconOnly) |
| `TitleAndIconLabelStyle` `.titleAndIcon` | `SUI:14424` | icon + title, **always both**, HStack |
| `IconOnlyLabelStyle` `.iconOnly` | `SUI:9660` | icon only; title still in a11y tree |
| `TitleOnlyLabelStyle` `.titleOnly` | `SUI:21743` | title only |

**Metrics (INFERRED):** icon–title gap ≈ **6pt** (iOS), icon sized to font cap-height (SF Symbol, `1em`). Icon tinted to `foregroundStyle` (label color) unless symbol is multicolor.

### 4.3 Web — `<Label>` (DESIGNED)
```html
<span class="sui-label" data-variant="titleAndIcon">
  <span class="sui-label__icon"><svg/></span>
  <span class="sui-label__title">Settings</span>
</span>
```
```css
.sui-label{ display:inline-flex; align-items:center; gap:6px; color:var(--sui-color-label); }
.sui-label__icon{ display:inline-grid; place-items:center; width:1em; height:1em; }
.sui-label[data-variant="iconOnly"]  .sui-label__title{ position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%); } /* visually-hidden, kept for a11y */
.sui-label[data-variant="titleOnly"] .sui-label__icon { display:none; }
```
```tsx
interface LabelProps { variant?:'automatic'|'titleAndIcon'|'iconOnly'|'titleOnly'; icon?:React.ReactNode; title:React.ReactNode; }
```

---

## 5. Progress family — `ProgressViewStyle` (`.linear` / `.circular`)

### 5.1 Protocol & config (KNOWN)
```swift
// SUI:11485 protocol + SUI:11491-11503 config (verbatim)
public protocol ProgressViewStyle {
  associatedtype Body : View
  @ViewBuilder func makeBody(configuration: Self.Configuration) -> Self.Body
  typealias Configuration = SwiftUI.ProgressViewStyleConfiguration
}
public struct ProgressViewStyleConfiguration {
  public struct Label : View { public typealias Body = Never }
  public struct CurrentValueLabel : View { public typealias Body = Never }
  public let fractionCompleted: Swift.Double?        // nil ⇒ INDETERMINATE (spinner)
  public var label: Configuration.Label?             // e.g. "Downloading…"
  public var currentValueLabel: Configuration.CurrentValueLabel?  // e.g. "3 of 10"
}
```
→ **Slots: `fractionCompleted` (0…1 or nil), `label`, `currentValueLabel`.** `fractionCompleted == nil` is the key branch — it means "I don't know how long" → render the spinning/indeterminate form.

### 5.2 Concrete styles
| Style | line | Determinate | Indeterminate (`fraction==nil`) |
|---|---|---|---|
| `LinearProgressViewStyle` `.linear` | `SUI:4654` | horizontal track + tint fill bar | barber-pole / sliding shimmer bar |
| `CircularProgressViewStyle` `.circular` | `SUI:4899` | (iOS shows spinner regardless; macOS shows determinate ring) | the **spinner** (8–12 fading spokes) |
| `DefaultProgressViewStyle` `.automatic` | `SUI:16020` | → `.linear` when a fraction is set, `.circular` spinner when nil | |

**Metrics (INFERRED):** Linear track height **4pt**, full radius (2pt), track `var(--sui-color-fill-quaternary)` ~`#7878801F`, fill `var(--sui-color-tint)`, fill animates width with `var(--sui-anim-smooth-css)`. Spinner: iOS **20pt** diameter, 8 spokes, each fades over a 0.8s rotation; macOS uses an actual rotating indeterminate.

### 5.3 Web — `<ProgressView>` (DESIGNED)
```html
<div class="sui-progress" data-variant="linear" role="progressbar"
     aria-valuenow="35" aria-valuemin="0" aria-valuemax="100">
  <span class="sui-progress__label">Downloading…</span>
  <span class="sui-progress__track"><span class="sui-progress__fill" style="width:35%"></span></span>
  <span class="sui-progress__value">3 of 10</span>
</div>
```
```css
.sui-progress__track{ display:block; height:4px; border-radius:2px; background:var(--sui-color-fill-quaternary,#7878801F); overflow:hidden; }
.sui-progress__fill{ display:block; height:100%; background:var(--sui-color-tint,#007AFF); border-radius:2px; transition:width .3s var(--sui-anim-smooth-css,ease); }
/* indeterminate linear */
.sui-progress[data-state="indeterminate"] .sui-progress__fill{ width:40%!important; animation: sui-bar 1.2s linear infinite; }
@keyframes sui-bar{ from{transform:translateX(-100%)} to{transform:translateX(350%)} }
/* circular spinner */
.sui-progress[data-variant="circular"] .sui-progress__track{ width:20px;height:20px;border-radius:50%;
  background:conic-gradient(var(--sui-color-secondary-label) 0 100%); mask:radial-gradient(circle 7px,transparent 98%,#000); animation:sui-spin .8s steps(8) infinite; }
@keyframes sui-spin{ to{ transform:rotate(360deg) } }
```
```tsx
interface ProgressViewProps {
  value?: number|null;            // fractionCompleted: nil ⇒ pass undefined/null ⇒ spinner
  total?: number;                 // default 1
  variant?: 'automatic'|'linear'|'circular';
  label?: React.ReactNode; currentValueLabel?: React.ReactNode;
}
```

---

## 6. Gauge family — `GaugeStyle` (5-slot config; `.accessoryCircular` / `.linearCapacity` / …)

### 6.1 Protocol & config (KNOWN — the richest Configuration in the cluster)
```swift
// SUI:19759 protocol + SUI:19766-19797 config (verbatim). iOS16+/macOS13+, tvOS UNAVAILABLE.
public struct GaugeStyleConfiguration {
  public struct Label : View {…}; public struct CurrentValueLabel : View {…}
  public struct MinimumValueLabel : View {…}; public struct MaximumValueLabel : View {…}
  public struct MarkedValueLabel : View {…}
  public var value: Swift.Double                     // 0…1 normalized position
  public var label: Configuration.Label
  public var currentValueLabel: Configuration.CurrentValueLabel?
  public var minimumValueLabel: Configuration.MinimumValueLabel?
  public var maximumValueLabel: Configuration.MaximumValueLabel?
}
```
→ **Slots: `value` (0…1) + five label slots** (label, current, min, max, marked). A gauge style decides which of the five it shows and the arc/bar geometry.

### 6.2 Concrete styles (KNOWN type, INFERRED visuals)
| Style | line | Geometry |
|---|---|---|
| `DefaultGaugeStyle` `.automatic` | `SUI:21913` | platform default (≈ linearCapacity on iOS) |
| `LinearCapacityGaugeStyle` `.linearCapacity` | `SUI:12701` | horizontal **filled-capacity bar** (like a battery), tint fill to `value`, label below |
| `LinearGaugeStyle` `.linear` (accessory) | `SUI:20557` | thin horizontal track + a moving tick mark at `value`, min/max at ends |
| `AccessoryLinearCapacityGaugeStyle` `.accessoryLinearCapacity` | `SUI:18447` | compact capacity bar for widgets/watch |
| `AccessoryLinearGaugeStyle` `.accessoryLinear` | `SUI:15345` | compact linear tick gauge |
| `CircularGaugeStyle` `.circular` | `SUI:10395` | full ring with a value tick |
| `AccessoryCircularGaugeStyle` `.accessoryCircular` | `SUI:24109` | **open-arc ring** (~270°), value fills the arc, center shows currentValueLabel |
| `AccessoryCircularCapacityGaugeStyle` `.accessoryCircularCapacity` | `SUI:10334` | closed ring "capacity" fill, center label |

**Metrics (INFERRED):** accessoryCircular arc spans **~270°** (gap at bottom), stroke width ~**4–5pt**, track `var(--sui-color-fill-tertiary)`, progress `var(--sui-color-tint)`, rounded line caps. Diameter ~**40–60pt** widget-dependent.

### 6.3 Web — `<Gauge>` (DESIGNED)
```html
<div class="sui-gauge" data-variant="accessoryCircular" style="--_v:.65">
  <svg viewBox="0 0 36 36" class="sui-gauge__ring">
    <circle class="track" cx="18" cy="18" r="15.5"/>
    <circle class="fill"  cx="18" cy="18" r="15.5"/>
  </svg>
  <span class="sui-gauge__center">65</span>
</div>
```
```css
.sui-gauge[data-variant="accessoryCircular"] .sui-gauge__ring circle{ fill:none; stroke-width:4; stroke-linecap:round;
  stroke-dasharray:73 97; transform:rotate(135deg); transform-origin:center; }  /* 270° arc */
.sui-gauge .track{ stroke:var(--sui-color-fill-tertiary,#78788029); }
.sui-gauge .fill { stroke:var(--sui-color-tint,#007AFF); stroke-dasharray:calc(73*var(--_v)) 200; transition:stroke-dasharray .4s; }
/* linearCapacity */
.sui-gauge[data-variant="linearCapacity"]{ display:grid; gap:4px; }
.sui-gauge[data-variant="linearCapacity"] .bar{ height:6px;border-radius:3px;background:var(--sui-color-fill-tertiary); }
.sui-gauge[data-variant="linearCapacity"] .bar>i{ display:block;height:100%;width:calc(var(--_v)*100%);background:var(--sui-color-tint);border-radius:3px; }
```
```tsx
interface GaugeProps {
  value:number; min?:number; max?:number;     // value normalized to 0…1
  variant?:'automatic'|'linearCapacity'|'linear'|'circular'|'accessoryCircular'|'accessoryCircularCapacity'|'accessoryLinear'|'accessoryLinearCapacity';
  label?:React.ReactNode; currentValueLabel?:React.ReactNode; minimumValueLabel?:React.ReactNode; maximumValueLabel?:React.ReactNode;
}
```

---

## 7. Menu family — `MenuStyle` + `MenuButtonStyle`

### 7.1 `MenuStyle` protocol & config (KNOWN)
```swift
// SUI:2832 protocol + SUI:2839-2850 config (verbatim). watchOS unavailable.
public struct MenuStyleConfiguration {
  public struct Label : View { public typealias Body = Never }   // the menu's trigger label
  public struct Content : View { public typealias Body = Never } // the menu items
}
```
→ **Slots: `label` (trigger) + `content` (the item list).** No selection state — a Menu is a command list, not a value picker.

### 7.2 Concrete menu styles
| Style | line | Trigger appearance |
|---|---|---|
| `DefaultMenuStyle` `.automatic` | `SUI:15422` | platform default popup menu |
| `BorderedButtonMenuStyle` `.borderedButton` | `SUI:3128` | trigger drawn as a `.bordered` button + chevron |
| `BorderlessButtonMenuStyle` `.borderlessButton` | `SUI:16472` | trigger is borderless (just label + chevron) |
| `ButtonMenuStyle` `.button` | `SUI:8834` | trigger styled per the ambient buttonStyle |
| `MenuButtonStyle` (protocol, AppKit-era) | `SUI:21456` | legacy NSPopUpButton styles — see §7.3 |

**Popup metrics (INFERRED):** menu panel = vibrancy material (`var(--sui-material-menu)`), corner **r ~13** (iOS) / 6 (macOS), item height ~**44pt** iOS / 22pt macOS, item padding 16pt, destructive items red, checkmark/leading-icon column, separators `var(--sui-color-separator)` `#3C3C434A`. Open animation: scale-from-anchor + fade, `var(--sui-anim-snappy-css)`.

### 7.3 `MenuButtonStyle` (legacy macOS, closed) — config (KNOWN)
```swift
// SUI:21456 protocol; SUI:21466-21486 _MenuButtonStyleConfiguration
public protocol MenuButtonStyle { /* _makeBody internal */ }
```
Concrete (all macOS, deprecated): `DefaultMenuButtonStyle` (`SUI:14403`), `BorderlessButtonMenuButtonStyle` (`SUI:13573`), `PullDownMenuButtonStyle` (`SUI:13535`), `BorderlessPullDownMenuButtonStyle` (`SUI:13554`), `_TexturedPullDownMenuButtonStyle` (`SUI:13592`). **Web:** all collapse to the same `<Menu>` trigger with `data-variant` = bordered/borderless/pulldown. Tabulated (low value — deprecated AppKit shims).

### 7.4 Web — `<Menu>` (DESIGNED)
```html
<div class="sui-menu" data-variant="borderedButton">
  <button class="sui-menu__trigger sui-button" data-variant="bordered" aria-haspopup="menu" aria-expanded="false">
    <span class="sui-menu__title">Options</span><svg class="sui-menu__chevron"/>
  </button>
  <div class="sui-menu__panel" role="menu" hidden>
    <button role="menuitem">Rename</button>
    <hr/>
    <button role="menuitem" data-role="destructive">Delete</button>
  </div>
</div>
```
```css
.sui-menu__panel{ position:absolute; min-width:200px; padding:6px; border-radius:13px;
  background:var(--sui-material-menu, rgba(250,250,250,.8)); backdrop-filter:blur(30px) saturate(1.8);
  box-shadow:0 10px 40px rgba(0,0,0,.18); transform-origin:top left;
  animation: sui-menu-in .18s var(--sui-anim-snappy-css, cubic-bezier(.2,.9,.3,1)); }
.sui-menu__panel [role="menuitem"]{ display:flex; align-items:center; gap:10px; width:100%; height:34px; padding:0 12px;
  border:0; background:none; font:400 15px/1 var(--sui-font-default); color:var(--sui-color-label); border-radius:7px; text-align:start; }
.sui-menu__panel [role="menuitem"]:hover{ background:var(--sui-color-tint,#007AFF); color:#fff; }
.sui-menu__panel [role="menuitem"][data-role="destructive"]{ color:var(--sui-color-destructive,#FF3B30); }
@keyframes sui-menu-in{ from{ opacity:0; transform:scale(.96) } to{ opacity:1; transform:scale(1) } }
```
```tsx
interface MenuProps { variant?:'automatic'|'borderedButton'|'borderlessButton'|'button'; label:React.ReactNode; children:React.ReactNode; }
```

---

## 8. List family — `ListStyle` (closed; `.plain`/`.grouped`/`.insetGrouped`/`.inset`/`.sidebar`)

### 8.1 Protocol (KNOWN — closed)
```swift
// SUI:523  — no Configuration. _ListValue<SelectionValue> carries the data.
public protocol ListStyle { /* _makeView via _ListValue */ }
public struct _ListValue<…> : ListStyle where SelectionValue: Hashable {}   // SUI:528
```
→ No author-overridable slot. A List's structure is fixed: sections → rows; the style sets background, insets, separators, corner treatment, header style.

### 8.2 Concrete styles — these are the highest-value visual variants
| Style | line | Row bg | Section corners | Separators | Inset |
|---|---|---|---|---|---|
| `DefaultListStyle` `.automatic` | `SUI:2240` | platform default | — | — | resolves to `.insetGrouped` (iOS settings) / `.plain` |
| `PlainListStyle` `.plain` | `SUI:11455` | transparent / systemBackground, edge-to-edge | none | full-width hairlines | content padding 16pt leading |
| `GroupedListStyle` `.grouped` | `SUI:6787` | `secondarySystemGroupedBackground` cards on `systemGroupedBackground` page | grouped, **no** outer rounding (pre-iOS13 look) | inset hairlines | group bg gray |
| `InsetGroupedListStyle` `.insetGrouped` | `SUI:10021` | white card, **rounded r10**, inset ~16pt from edges, on gray page | r**10** outer corners | inset hairlines leading-aligned to text | the iOS Settings look |
| `InsetListStyle` `.inset` | `SUI:5556` | edge-inset rows, no card | — | inset | macOS/iPad |
| `SidebarListStyle` `.sidebar` | `SUI:2743` | translucent sidebar material; collapsible sections w/ disclosure | rounded selection pill | none | selection = tinted rounded-rect |
| `BorderedListStyle` `.bordered` | `SUI:18559` | macOS bordered table-ish list, alternating rows | outer border + r6 | row dividers | macOS |
| `CarouselListStyle` (watchOS) | `SUI:18510` | focus-scaling carousel rows | — | — | watch |
| `EllipticalListStyle` (watchOS) | `SUI:15805` | curved-crown scroll | — | — | watch |
| `__UniversalListStyle` (internal) | `SUI:12884` | internal resolver | — | — | tabulated |

**Metrics (INFERRED, insetGrouped):** page bg `var(--sui-color-grouped-bg)` `#F2F2F7`, card `#FFF` dark `#1C1C1E`, card radius **10pt**, side inset **16/20pt**, row min-height **44pt**, row padding 16pt H / 11pt V, separator `var(--sui-color-separator)` `#3C3C4349` inset to text leading, separator height **0.33pt** (hairline). Header text: `text.footnote` uppercase secondary (grouped) or `text.title` (inset).

### 8.3 Web — `<List>` (DESIGNED)
```html
<div class="sui-list" data-variant="insetGrouped">
  <section class="sui-list__section">
    <h3 class="sui-list__header">GENERAL</h3>
    <div class="sui-list__card">
      <div class="sui-list__row">Wi-Fi <span class="sui-list__value">Home</span></div>
      <div class="sui-list__row">Bluetooth <span class="sui-list__value">On</span></div>
    </div>
  </section>
</div>
```
```css
.sui-list[data-variant="insetGrouped"]{ background:var(--sui-color-grouped-bg,#F2F2F7); padding:18px 0; }
.sui-list[data-variant="insetGrouped"] .sui-list__card{ margin:0 16px; background:#fff; border-radius:10px; overflow:hidden; }
.sui-list__header{ font:600 13px/1 var(--sui-font-default); letter-spacing:.06em; color:var(--sui-color-secondary-label,#3C3C4399);
  text-transform:uppercase; padding:0 32px 6px; }
.sui-list__row{ display:flex; align-items:center; justify-content:space-between; min-height:44px; padding:11px 16px;
  font:400 17px/1.2 var(--sui-font-default); color:var(--sui-color-label); }
.sui-list__row+.sui-list__row{ box-shadow:inset 0 .33px 0 var(--sui-color-separator,#3C3C4349); } /* hairline, text-leading inset can use margin-left on a ::before */
.sui-list__value{ color:var(--sui-color-secondary-label,#3C3C4399); }
/* plain */
.sui-list[data-variant="plain"]{ background:var(--sui-color-bg,#fff); padding:0; }
.sui-list[data-variant="plain"] .sui-list__card{ margin:0; border-radius:0; }
.sui-list[data-variant="plain"] .sui-list__row{ box-shadow:inset 0 -.33px 0 var(--sui-color-separator); }
/* sidebar */
.sui-list[data-variant="sidebar"]{ background:var(--sui-material-sidebar,rgba(246,246,246,.7)); backdrop-filter:blur(30px); }
.sui-list[data-variant="sidebar"] .sui-list__row[data-selected="true"]{ background:color-mix(in srgb,var(--sui-color-tint) 18%,transparent); border-radius:8px; margin:0 8px; }
```
```tsx
interface ListProps { variant?:'automatic'|'plain'|'grouped'|'insetGrouped'|'inset'|'sidebar'|'bordered'; children:React.ReactNode; }
```

---

## 9. Form family — `FormStyle` (`.grouped` / `.columns` / `.automatic`)

### 9.1 Protocol & config (KNOWN)
```swift
// SUI:15615 protocol + SUI:15621-15627 config (verbatim). iOS16+.
public struct FormStyleConfiguration {
  public struct Content : View { public typealias Body = Never }
  public let content: Configuration.Content     // the whole form body
}
```
→ **Slot: `content`.** A Form is "a List specialized for editing" — the style controls section grouping/columns.

### 9.2 Concrete styles
| Style | line | Layout |
|---|---|---|
| `AutomaticFormStyle` `.automatic` | `SUI:22710` | → `.grouped` on iOS; macOS uses aligned label/control columns |
| `GroupedFormStyle` `.grouped` | `SUI:14628` | insetGrouped-list look: sections with cards, labels leading, controls trailing |
| `ColumnsFormStyle` `.columns` | `SUI:1746` | macOS two-column: right-aligned labels in left column, controls in right column, baseline-aligned |

**Metrics:** `.grouped` inherits the insetGrouped List metrics (§8.2). `.columns`: label column right-aligned, ~`120pt` label width, 8pt row gap, control column left-aligned; macOS 13px.

### 9.3 Web — `<Form>` (DESIGNED)
```css
.sui-form[data-variant="grouped"]{ /* identical to .sui-list[data-variant=insetGrouped] */ }
.sui-form[data-variant="columns"]{ display:grid; grid-template-columns:max-content 1fr; gap:8px 12px; align-items:baseline; }
.sui-form[data-variant="columns"] .sui-form__label{ text-align:end; color:var(--sui-color-label); }
```
```tsx
interface FormProps { variant?:'automatic'|'grouped'|'columns'; children:React.ReactNode; }
```

---

## 10. DatePicker family — `DatePickerStyle` (richest binding config)

### 10.1 Protocol & config (KNOWN)
```swift
// SUI:24152 protocol + SUI:24164-24186 config (verbatim). watchOS10+, tvOS unavailable.
public struct DatePickerStyleConfiguration {
  public struct Label : View {…}
  @Binding public var selection: Foundation.Date     // the chosen date (two-way)
  public var $selection: Binding<Date> { get }
  public var minimumDate: Foundation.Date?
  public var maximumDate: Foundation.Date?
  public var displayedComponents: SwiftUI.DatePickerComponents   // .date / .hourAndMinute (OptionSet)
}
```
→ **Slots: `label`, `selection` binding, `minimumDate`/`maximumDate` clamp, `displayedComponents` (date | time | both).**

### 10.2 Concrete styles
| Style | line | UI |
|---|---|---|
| `DefaultDatePickerStyle` `.automatic` | `SUI:18306` | → `.compact` iOS / `.field`+stepper macOS |
| `CompactDatePickerStyle` `.compact` | `SUI:19390` | a tappable pill showing the date; tap → popover calendar/wheel |
| `GraphicalDatePickerStyle` `.graphical` | `SUI:18404` | full inline month calendar grid + (optional) time wheel |
| `WheelDatePickerStyle` `.wheel` | `SUI:16921` | spinning drum columns (month/day/year or hour/min) |
| `FieldDatePickerStyle` `.field` (macOS) | `SUI:18380` | editable text field `MM/DD/YYYY` |
| `StepperFieldDatePickerStyle` `.stepperField` (macOS) | `SUI:18354` | field + up/down stepper |

**Metrics:** `.compact` pill = `var(--sui-color-fill-tertiary)` bg, r6, padding 6×11pt, label `text.body`, value tinted `var(--sui-color-tint)`. `.graphical` calendar: 7-col grid, 36pt cells, today ring, selected = filled tint circle.

### 10.3 Web — `<DatePicker>` (DESIGNED)
```html
<div class="sui-datepicker" data-variant="compact">
  <span class="sui-datepicker__label">Date</span>
  <button class="sui-datepicker__pill" aria-haspopup="dialog">Jun 2, 2026</button>
</div>
```
```css
.sui-datepicker{ display:flex; align-items:center; justify-content:space-between; }
.sui-datepicker__pill{ background:var(--sui-color-fill-tertiary,#78788029); border:0; border-radius:6px;
  padding:6px 11px; font:400 17px/1 var(--sui-font-default); color:var(--sui-color-tint,#007AFF); cursor:pointer; }
/* graphical: a 7-col CSS grid calendar; selected day = filled circle var(--sui-color-tint) */
```
```tsx
interface DatePickerProps {
  selection:Date; onChange:(d:Date)=>void;
  variant?:'automatic'|'compact'|'graphical'|'wheel'|'field'|'stepperField';
  minimumDate?:Date; maximumDate?:Date;
  displayedComponents?:('date'|'hourAndMinute')[];   // DatePickerComponents OptionSet
  label?:React.ReactNode;
}
```

---

## 11. DisclosureGroup / GroupBox / LabeledContent / ControlGroup (container styles)

### 11.1 `DisclosureGroupStyle` (`SUI:4190`; config `SUI:4198-4227`, KNOWN)
```swift
public struct DisclosureGroupStyleConfiguration {
  public struct Label : View {…}   public let label
  public struct Content : View {…} public let content
  @Binding public var isExpanded: Swift.Bool      // open/closed (two-way)
}
```
→ **Slots: `label` (header row), `content` (collapsible body), `isExpanded` binding.** Only `AutomaticDisclosureGroupStyle` `.automatic` (`SUI:2630`) is concrete.
**Visual:** header row w/ leading/trailing chevron (`chevron.right`, rotates 90° to down when expanded), content slides/reveals. Chevron rotate animates `var(--sui-anim-smooth-css)`; macOS triangle `disclosure indicator`.
```html
<div class="sui-disclosure" data-expanded="false">
  <button class="sui-disclosure__header" aria-expanded="false"><svg class="chev"/>Advanced</button>
  <div class="sui-disclosure__body" hidden>…</div>
</div>
```
```css
.sui-disclosure__header .chev{ transition:transform .25s var(--sui-anim-smooth-css,ease); }
.sui-disclosure[data-expanded="true"] .chev{ transform:rotate(90deg); }
.sui-disclosure__body{ overflow:hidden; }
```
```tsx
interface DisclosureGroupProps{ isExpanded:boolean; onChange:(v:boolean)=>void; label:React.ReactNode; children:React.ReactNode; }
```

### 11.2 `GroupBoxStyle` (`SUI:21009`; config `SUI:21017-21032`, KNOWN; macOS/iOS, no tvOS/watch)
```swift
public struct GroupBoxStyleConfiguration { public let label: Label; public let content: Content }
```
→ **Slots: `label` + `content`.** Only `DefaultGroupBoxStyle` `.automatic` (`SUI:8375`). **Visual:** a titled rounded panel — secondary-fill bg, r**8**, padding ~12pt, optional bold title row on top.
```css
.sui-groupbox{ background:var(--sui-color-fill-quaternary,#7878801F); border-radius:8px; padding:12px; }
.sui-groupbox__label{ font-weight:600; margin-bottom:8px; color:var(--sui-color-label); }
```

### 11.3 `LabeledContentStyle` (`SUI:22746`; config `SUI:22752-22763`, KNOWN)
```swift
public struct LabeledContentStyleConfiguration { public let label: Label; public let content: Content }
```
→ **Slots: `label` (leading) + `content` (trailing value).** Only `AutomaticLabeledContentStyle` (`SUI:4338`). **Visual:** an HStack row, label leading (label color), content trailing (secondary color), space-between. This is the Settings "Version 1.0" row.
```css
.sui-labeledcontent{ display:flex; justify-content:space-between; align-items:center; }
.sui-labeledcontent__content{ color:var(--sui-color-secondary-label,#3C3C4399); }
```

### 11.4 `ControlGroupStyle` (`SUI:20206`; config `SUI:20213-20228`, KNOWN; watch unavailable)
```swift
public struct ControlGroupStyleConfiguration {
  public let content: Content       // the grouped controls
  public let label: Label           // iOS16+ optional group label
}
```
→ **Slots: `content` (the controls) + `label`.** Concrete: `AutomaticControlGroupStyle` `.automatic` (`SUI:8352`), `NavigationControlGroupStyle` `.navigation` (back/forward segment, `SUI:15824`), `PaletteControlGroupStyle` `.palette` (`SUI:7395`), `MenuControlGroupStyle` `.menu` (`SUI:16570`), `CompactMenuControlGroupStyle` `.compactMenu` (`SUI:16592`). **Visual:** controls fused into one segmented capsule (toolbar group), hairline dividers between, shared bordered bg.
```css
.sui-controlgroup{ display:inline-flex; background:var(--sui-color-fill-tertiary,#78788029); border-radius:8px; overflow:hidden; }
.sui-controlgroup>*{ border:0; background:none; padding:6px 12px; }
.sui-controlgroup>*+*{ box-shadow:inset 1px 0 0 var(--sui-color-separator,#3C3C434A); }
```
```tsx
interface ControlGroupProps{ variant?:'automatic'|'navigation'|'palette'|'menu'|'compactMenu'; label?:React.ReactNode; children:React.ReactNode; }
```

---

## 12. TextField / TextEditor — `TextFieldStyle` & `TextEditorStyle`

### 12.1 `TextFieldStyle` (`SUI:10412`, KNOWN — closed, `_body`-based)
```swift
public protocol TextFieldStyle {
  associatedtype _Body : View
  @ViewBuilder func _body(configuration: TextField<Self._Label>) -> Self._Body
  typealias _Label = SwiftUI._TextFieldStyleLabel
}
```
→ Closed; takes the whole `TextField` and re-skins it. No public Configuration → React closed `variant` union.

| Style | line | Look |
|---|---|---|
| `DefaultTextFieldStyle` `.automatic` | `SUI:1859` | iOS: plain underline-less inline; macOS: 1px bezel field |
| `PlainTextFieldStyle` `.plain` | `SUI:16715` | no border/bg, just the editable text |
| `RoundedBorderTextFieldStyle` `.roundedBorder` | `SUI:7666` | rounded-rect bordered box (the classic field) |
| `SquareBorderTextFieldStyle` `.squareBorder` (macOS) | `SUI:20676` | square 1px bezel |

**`.roundedBorder` metrics (INFERRED):** bg `var(--sui-color-bg)` / `#fff`, 1px border `var(--sui-color-separator)`/`#C7C7CC`, r**6** (macOS) / **10** (iOS-ish), padding 7×8pt, focus → border becomes `var(--sui-color-tint)` + subtle ring.
```css
.sui-textfield[data-variant="roundedBorder"]{ background:var(--sui-color-bg,#fff); border:1px solid #C7C7CC; border-radius:6px; padding:7px 8px; font:400 13px/1.2 var(--sui-font-default); }
.sui-textfield[data-variant="roundedBorder"]:focus-within{ border-color:var(--sui-color-tint,#007AFF); box-shadow:0 0 0 3px color-mix(in srgb,var(--sui-color-tint) 25%,transparent); }
.sui-textfield[data-variant="plain"]{ border:0; background:none; outline:none; }
```
```tsx
interface TextFieldProps{ variant?:'automatic'|'plain'|'roundedBorder'|'squareBorder'; value:string; onChange:(v:string)=>void; placeholder?:string; }
```

### 12.2 `TextEditorStyle` (`SUI:3034`; config `SUI:3042-3043` empty, KNOWN; iOS17+/macOS14+)
```swift
public protocol TextEditorStyle { associatedtype Body : View; func makeBody(configuration:Self.Configuration)->Self.Body; typealias Configuration = TextEditorStyleConfiguration }
public struct TextEditorStyleConfiguration {}   // empty — no exposed slots
```
Concrete: `AutomaticTextEditorStyle` `.automatic` (`SUI:8614`), `PlainTextEditorStyle` `.plain` (`SUI:16890`), `RoundedBorderTextEditorStyle` `.roundedBorder` (`SUI:12467`). Multiline `<textarea>` analog; same border recipe as TextField roundedBorder, min-height multi-line.
```tsx
interface TextEditorProps{ variant?:'automatic'|'plain'|'roundedBorder'; value:string; onChange:(v:string)=>void; }
```

## 13. Table — `TableStyle` (`.automatic`/`.inset`/`.bordered`)

### 13.1 Protocol & config (KNOWN)
```swift
// SUI:19729 protocol + SUI:19737 config (verbatim, EMPTY). iOS16+/macOS12+, no tvOS/watch.
public struct TableStyleConfiguration {}   // empty — Table data comes from TableColumn builders
```
Concrete: `AutomaticTableStyle` `.automatic` (`SUI:18432`), `InsetTableStyle` `.inset` (`SUI:12612`; supports `.inset(alternatesRowBackgrounds:)`), `BorderedTableStyle` `.bordered` (`SUI:21338`; supports `alternatesRowBackgrounds`). **Visual (macOS):** header row (sortable, light bg), data rows ~24pt, optional zebra striping `var(--sui-color-fill-quaternary)` on alternate rows, `.bordered` adds an outer 1px border + r6 + column dividers.
```css
.sui-table{ width:100%; border-collapse:collapse; font:400 13px/1 var(--sui-font-default); }
.sui-table thead th{ text-align:start; padding:4px 8px; background:var(--sui-color-fill-quaternary,#7878801F); font-weight:500; }
.sui-table tbody td{ padding:4px 8px; height:24px; }
.sui-table[data-variant="bordered"]{ border:1px solid var(--sui-color-separator); border-radius:6px; overflow:hidden; }
.sui-table[data-alternating="true"] tbody tr:nth-child(even){ background:var(--sui-color-fill-quaternary,#7878801F); }
```
```tsx
interface TableProps{ variant?:'automatic'|'inset'|'bordered'; alternatesRowBackgrounds?:boolean; columns:Column[]; rows:Row[]; }
```

---

## 14. SwiftUICore primitive drawing styles (NOT control variants — paint/geometry config)

These are value structs consumed by `Shape`/`Canvas`/modifiers, not control skins. They drive `fill()`, `stroke()`, `shadow()`, corner geometry. Critical because the whole kit's shapes/borders reference them.

### 14.1 `StrokeStyle` (`CORE:8630`, KNOWN verbatim)
```swift
@frozen public struct StrokeStyle : Equatable {
  public var lineWidth: CGFloat
  public var lineCap: CGLineCap          // .butt / .round / .square
  public var lineJoin: CGLineJoin        // .miter / .round / .bevel
  public var miterLimit: CGFloat
  public var dash: [CGFloat]
  public var dashPhase: CGFloat
  public init(lineWidth: CGFloat = 1, lineCap: CGLineCap = .butt, lineJoin: CGLineJoin = .miter,
              miterLimit: CGFloat = 10, dash: [CGFloat] = [], dashPhase: CGFloat = 0)
}
// + extension: Animatable (animatableData over lineWidth/miterLimit/dashPhase)
```
→ **Direct CSS/SVG map:** `lineWidth`→`stroke-width`, `lineCap`→`stroke-linecap` (`butt|round|square`), `lineJoin`→`stroke-linejoin` (`miter|round|bevel`), `miterLimit`→`stroke-miterlimit` (default **10**), `dash`→`stroke-dasharray`, `dashPhase`→`stroke-dashoffset`. Defaults are KNOWN: width 1, cap butt, join miter, miterLimit 10.
```tsx
interface StrokeStyle{ lineWidth?:number; lineCap?:'butt'|'round'|'square'; lineJoin?:'miter'|'round'|'bevel'; miterLimit?:number; dash?:number[]; dashPhase?:number; }
```

### 14.2 `FillStyle` (`CORE:6218`, KNOWN verbatim)
```swift
@frozen public struct FillStyle : Equatable {
  public var isEOFilled: Swift.Bool        // even-odd vs non-zero winding
  public var isAntialiased: Swift.Bool
  @inlinable public init(eoFill: Bool = false, antialiased: Bool = true)
}
```
→ **CSS/SVG:** `isEOFilled` → SVG `fill-rule:evenodd` (vs default `nonzero`); `isAntialiased` → `shape-rendering:auto` vs `crispEdges`. Defaults KNOWN: eoFill **false**, antialiased **true**.
```tsx
interface FillStyle{ eoFill?:boolean; antialiased?:boolean }
```

### 14.3 `ShadowStyle` (`CORE:8542`, KNOWN verbatim — note the exact default colors)
```swift
public struct ShadowStyle : Equatable, Sendable {
  public static func drop(color: Color = .init(.sRGBLinear, white: 0, opacity: 0.33),
                          radius: CGFloat, x: CGFloat = 0, y: CGFloat = 0) -> ShadowStyle
  public static func inner(color: Color = .init(.sRGBLinear, white: 0, opacity: 0.55),
                           radius: CGFloat, x: CGFloat = 0, y: CGFloat = 0) -> ShadowStyle
}
```
→ **KNOWN exact defaults:** drop shadow default color = **linear-sRGB black @ 0.33 opacity**; inner shadow default = **black @ 0.55 opacity**. `radius` is the blur. **CSS map:** `drop` → `box-shadow: x y (radius*2) color` (SwiftUI radius ≈ half the CSS blur — multiply by ~2); `inner` → `box-shadow: inset x y (radius*2) color`. **Caveat:** SwiftUI shadow `radius` is a Gaussian sigma, CSS blur ≈ 2×sigma → use `radius*2` for parity.
```tsx
type ShadowStyle = {kind:'drop'|'inner'; radius:number; x?:number; y?:number; color?:string};
// drop default color rgba(0,0,0,.33); inner default rgba(0,0,0,.55)
```

### 14.4 `RoundedCornerStyle` (`CORE:19017`, KNOWN verbatim enum)
```swift
public enum RoundedCornerStyle : Sendable { case circular; case continuous }
```
→ `.circular` = a true quarter-circle arc; `.continuous` = the Apple "squircle" (superellipse, smoother). **CSS:** `.circular` → plain `border-radius`. `.continuous` → there is NO native CSS squircle; approximate with a slightly larger radius (~1.2×) or an SVG/`paint()` superellipse mask. Most kit corners use `.continuous`. Use `--sui-container-radius` as the base.
```tsx
type RoundedCornerStyle = 'circular'|'continuous';
```

### 14.5 `ShapeStyle` (`CORE:9294`, KNOWN — the paint protocol)
The umbrella protocol for *anything that can paint a shape*: `Color`, gradients, materials, `.tint`, hierarchical levels (`.secondary`…). Key member: `func resolve(in:EnvironmentValues) -> Resolved` (iOS17+) — resolves semantic paint to concrete pixels given the environment (light/dark, tint). `.shadow(_:)` extension lets any ShapeStyle carry a ShadowStyle. **Web:** ShapeStyle = "a `background`/`color`/`fill` value" — a CSS color/gradient/`backdrop-filter`. Not a component; it's the value type your `fill`/`foregroundStyle` props accept. Tabulated at protocol level (concrete paints live in the color/material token clusters).

### 14.6 Misc SwiftUI style value structs
- **`PointerStyle`** (`SUI:20946`, KNOWN) — macOS cursor shapes. Static members map 1:1 to CSS `cursor`: `.default`→`default`, `.horizontalText`→`text`, `.link`→`pointer`, `.zoomIn`→`zoom-in`, `.zoomOut`→`zoom-out`, `.columnResize`→`col-resize`, `.rowResize`→`row-resize`, `.grabIdle`→`grab`, `.grabActive`→`grabbing`, `.frameResize(position:)`→`nwse-resize`/`nesw-resize`, `.image(_:hotSpot:)`→`url(...) x y`. **Web:** a `cursor` prop. KNOWN static list above.
- **`ScrollEdgeEffectStyle`** (`SUI:12150`, KNOWN) — `.automatic` / `.hard` / `.soft`. Controls the fade/blur at a scroll container's edge (iOS26 liquid-glass edge). **Web:** `.soft` → a `mask-image: linear-gradient(...)` fade at the edge; `.hard` → a sharp cutoff/solid bar; `.automatic` → soft. `Hashable`.
- **`ToolbarLabelStyle`** (`SUI:20886`, KNOWN) — `.automatic`/`.titleAndIcon`/`.iconOnly`/`.titleOnly` for toolbar items. Same render logic as `LabelStyle` (§4) but scoped to toolbars. `Equatable`.
- **`Chart3DRenderingStyle`** (`CHARTS:233`, KNOWN, `Hashable`) + `Chart3DSurfaceStyle` protocol (`CHARTS:473`) + `BasicChart3DSurfaceStyle` (`CHARTS:462`) + `_Chart3DResolvedSurfaceStyle` (`CHARTS:479`) — 3D chart surface shading (visionOS Charts). **Web:** out of scope for a 2D kit; tabulated. A web equivalent would be a WebGL/three.js material — not part of the DOM kit.

---

## 15. TabView / IndexView / Navigation styles (layout-container variants)

### 15.1 `TabViewStyle` (`SUI:4101`, KNOWN — closed, `_makeView` via `_TabViewValue<Style,SelectionValue:Hashable>`)
| Style | line | Render |
|---|---|---|
| `DefaultTabViewStyle` `.automatic` | `SUI:16853` | platform tab bar (bottom iOS / top macOS) |
| `PageTabViewStyle` `.page` | `SUI:10265` | swipeable full-page pager + dot index (`init(indexDisplayMode:)`) |
| `VerticalPageTabViewStyle` (`.verticalPage`) | `SUI:15854` | vertical swipe pager (watch/tv) |
| `CarouselTabViewStyle` (watchOS) | `SUI:278` | focus carousel |
| `GroupedTabViewStyle` | `SUI:19718` | grouped tab sections (iPad sidebar tabs) |
| `SidebarAdaptableTabViewStyle` `.sidebarAdaptable` | `SUI:7526` | tab bar that becomes a sidebar on wide layouts (iPadOS17+) |
| `TabBarOnlyTabViewStyle` `.tabBarOnly` | `SUI:12787` | force tab-bar even when sidebar-capable |

**`.page` web mapping (most reused):** a horizontal scroll-snap container + a dot pager.
```css
.sui-tabview[data-variant="page"]{ display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; }
.sui-tabview[data-variant="page"]>*{ flex:0 0 100%; scroll-snap-align:start; }
.sui-tabview__dots{ display:flex; gap:7px; justify-content:center; }
.sui-tabview__dot{ width:7px;height:7px;border-radius:50%;background:var(--sui-color-quaternary-label,#3C3C432E); }
.sui-tabview__dot[data-active="true"]{ background:var(--sui-color-label,#000); }
```
**`.automatic` (tab bar):** bottom bar, items = icon over caption, selected item tinted `var(--sui-color-tint)`, others secondary; iOS bar height **49pt** + safe area, translucent material bg.
```tsx
interface TabViewProps{ variant?:'automatic'|'page'|'verticalPage'|'sidebarAdaptable'|'tabBarOnly'|'grouped'; selection:any; onChange:(t:any)=>void; tabs:{tag:any;label:React.ReactNode;icon:React.ReactNode;content:React.ReactNode}[]; }
```

### 15.2 `IndexViewStyle` (`SUI:3946`, KNOWN — closed, empty `_IndexViewStyleConfiguration` `SUI:3959`; iOS/tvOS/watch, macOS unavailable)
Only `PageIndexViewStyle` `.page` (`SUI:20719`) — the dot row for a paged TabView. `init(backgroundDisplayMode:)` controls whether the dots sit on a dimmed pill. **Web:** the `.sui-tabview__dots` element above; `backgroundDisplayMode` → toggle a translucent rounded backdrop behind the dots.

### 15.3 `NavigationSplitViewStyle` (`SUI:5849`, KNOWN; empty config `SUI:5855`) & `NavigationViewStyle` (`SUI:9675`, closed; `_NavigationViewStyleConfiguration` `SUI:9687`)
| Style | line | Layout |
|---|---|---|
| `AutomaticNavigationSplitViewStyle` `.automatic` | `SUI:14525` | resolves balanced/prominentDetail per width |
| `BalancedNavigationSplitViewStyle` `.balanced` | `SUI:1729` | sidebar + content + detail, all share width; sidebar push shrinks detail |
| `ProminentDetailNavigationSplitViewStyle` `.prominentDetail` | `SUI:9104` | detail keeps full width; sidebar overlays |
| `StackNavigationViewStyle` `.stack` (legacy) | `SUI:23025` | single-column push/pop stack |
| `ColumnNavigationViewStyle` `.columns` (legacy) | `SUI:851` | multi-column (deprecated, pre-NavigationSplitView) |
| `DoubleColumnNavigationViewStyle` `.doubleColumn` (legacy) | `SUI:17880` | master-detail two column |
| `DefaultNavigationViewStyle` `.automatic` (legacy) | `SUI:14788` | platform default |

**Web:** a CSS grid `grid-template-columns: [sidebar] minmax(0,320px) [detail] 1fr`; `.balanced` keeps both columns laid out; `.prominentDetail` makes the sidebar an `position:absolute` overlay drawer. `.stack` → a single column with route-based push/pop transitions (`var(--sui-anim-smooth-css)`, slide-from-right).
```tsx
interface NavigationSplitViewProps{ variant?:'automatic'|'balanced'|'prominentDetail'; sidebar:React.ReactNode; content?:React.ReactNode; detail:React.ReactNode; }
```

---

## 16. Long-tail — tabulated (low web value for a 2D component kit, but cataloged)

These are platform-shell / desktop-window / config-plumbing types. None render an in-page DOM component a web kit would expose; they map to app-shell concepts or are pure data structs. Listed for completeness so nothing is silently dropped.

### 16.1 Window / Toolbar / MenuBar styles (macOS/visionOS app-shell — NOT web components)
| Type | line | Purpose | Web equivalent |
|---|---|---|---|
| `WindowStyle` (protocol) | `SUI:3534` | window chrome strategy | browser window / `<dialog>` shell — N/A |
| `DefaultWindowStyle` | `SUI:5908` | standard titled window | — |
| `TitleBarWindowStyle` | `SUI:3024` | show title bar | — |
| `HiddenTitleBarWindowStyle` | `SUI:9646` | hide title bar | borderless modal |
| `PlainWindowStyle` | `SUI:13761` | chromeless window (visionOS) | — |
| `WindowToolbarStyle` (protocol) | `SUI:18080` | toolbar layout in title bar | — |
| `DefaultWindowToolbarStyle` | `SUI:3837` | default | — |
| `ExpandedWindowToolbarStyle` | `SUI:22793` | expanded toolbar row | — |
| `UnifiedWindowToolbarStyle` | `SUI:19041` | unified title+toolbar | — |
| `UnifiedCompactWindowToolbarStyle` | `SUI:23903` | compact unified | — |
| `MenuBarExtraStyle` (protocol) | `SUI:16239` | menu-bar extra render | — |
| `AutomaticMenuBarExtraStyle` | `SUI:15995` | default | — |
| `WindowMenuBarExtraStyle` | `SUI:4629` | opens a window | — |
| `PullDownMenuBarExtraStyle` | `SUI:6186` | pulldown menu | — |

### 16.2 Immersion styles (visionOS spatial — no 2D web analog)
| Type | line | | Type | line |
|---|---|---|---|---|
| `ImmersionStyle` (protocol) | `SUI:23373` | | `AutomaticImmersionStyle` | `SUI:4683` |
| `FullImmersionStyle` `.full` | `SUI:17441` | | `MixedImmersionStyle` `.mixed` | `SUI:17725` |
| `ProgressiveImmersionStyle` `.progressive` | `SUI:21662` | | | |
*(visionOS RealityKit immersion levels — out of scope for a DOM kit; a web "equivalent" would be a WebXR session, not part of this kit.)*

### 16.3 Accessibility quick-action styles (assistive overlay — system-only)
| Type | line | | Type | line |
|---|---|---|---|---|
| `AccessibilityQuickActionStyle` (protocol) | `SUI:18872` | | `_AccessibilityQuickActionStyle` (internal) | `SUI:18862` |
| `AccessibilityQuickActionPromptStyle` `.prompt` | `SUI:18880` | | `AccessibilityQuickActionOutlineStyle` `.outline` | `SUI:18905` |
*(AssistiveTouch/Switch-Control quick-action presentation — system overlay, no app DOM.)*

### 16.4 Widget / Control configuration (WidgetKit app-extension plumbing — not in-page UI)
| Type | line | Purpose |
|---|---|---|
| `WidgetConfiguration` (protocol) | `SUI:16329` | a widget's config (kind, intent, supportedFamilies) |
| `EmptyWidgetConfiguration` | `SUI:3982` | no-op config |
| `TupleWidgetConfiguration` | `SUI:8029` | combine multiple widget configs (result-builder leaf) |
| `LimitedAvailabilityConfiguration` | `SUI:9018` | wraps an availability-gated config |
| `ControlWidgetConfiguration` (protocol) | `SUI:12974` | Control Center widget config |
| `EmptyControlWidgetConfiguration` | `SUI:541` | no-op |
| `ControlWidgetConfigurationBuilder` (result builder) | `SUI:12993` | DSL builder for control widgets |
*(These are `@main` widget-bundle declarations compiled into an app extension; a web kit has no equivalent runtime — could map to a "widget manifest" object but renders nothing in-page.)*

### 16.5 Document / file configuration (DocumentGroup plumbing — data structs)
| Type | line | Members (KNOWN) |
|---|---|---|
| `DocumentConfiguration` | `SUI:15172` | `isEditable`, `fileURL` — the open document's state |
| `FileDocumentConfiguration<Document:FileDocument>` | `SUI:17502` | `@Binding document`, `isEditable`, `fileURL` |
| `ReferenceFileDocumentConfiguration<Document>` | `SUI:7594` | `@ObservedObject document`, `isEditable`, `fileURL` |
| `FileDocumentReadConfiguration` | `SUI:5829` | `contentType`, `file` (read context) |
| `FileDocumentWriteConfiguration` | `SUI:5819` | `contentType`, `existingFile` (write context) |
*(File I/O context structs for `DocumentGroup` scenes; no DOM. Web equivalent = a File System Access API wrapper, out of scope.)*

### 16.6 Drag & Drop configuration (KNOWN structs — relevant to a web DnD layer)
- **`DragConfiguration`** (`SUI:14882`) — `operationsWithinApp` / `operationsOutsideApp` (`OperationsWithinApp(allowCopy=true, allowMove=false, allowDelete=false)`, `allowAlias` macOS). Convenience `init(allowMove:)`. → **Web:** maps to the HTML5 DnD `dataTransfer.effectAllowed` (`copy`/`move`/`copyMove`/`link`). `allowCopy`→copy, `allowMove`→move, `allowAlias`→link.
- **`DropConfiguration`** (`SUI:11466`) — `operation: DropOperation` (the resolved drop action), `acceptedItemCount` (macOS26). → **Web:** `dragover`/`drop` handler returning `dropEffect`.

### 16.7 Other config / internal style structs (plumbing)
| Type | line | Note |
|---|---|---|
| `SectionConfiguration` (`CORE`) | `CORE:18971` | `Identifiable`; `header`/`footer`/`content` are `SubviewsCollection`, `containerValues`. The data a custom container's section provides. → web: a `{header, footer, children}` section object. |
| `SystemFormatStyle` (enum, `CORE`) | `CORE:13952` | Foundation FormatStyle bridge (number/date formatting) — not visual. |
| `_RendererConfiguration` (`CORE`) | `CORE:14206` | internal renderer flags (color scheme, opacity, blend) — private. |
| `_BackgroundStyleModifier` / `_OverlayStyleModifier` (`CORE` ViewModifiers) | `CORE:15388` / `3248` | internal modifiers backing `.background(_:)` / `.overlay(_:)` with a ShapeStyle. → web: `background`/`::after` overlay. |
| `_ArchivedViewHostDelegate_URLConfiguration` (`CORE`) | `CORE:15795` | archived-view host plumbing — private. |
| `_DatePickerStyleLabel` / `_TextFieldStyleLabel` | `SUI:24201` / `10418` | internal label proxy views handed to closed styles. |
| `_IndexViewStyleConfiguration` / `_NavigationViewStyleConfiguration` / `_MenuButtonStyleConfiguration` | `SUI:3959` / `9687` / `21466` | internal configs for the closed styles above. |
| `_ListValue` / `_PickerValue` / `_TabViewValue` | `SUI:528` / `12672` / `4106` | the `_GraphValue` payloads (Style + `SelectionValue:Hashable`) that drive the closed `_makeView` styles. Confirm: closed styles carry the selection generic, so the React union needs a typed `selection`/`onChange`. |
| `__UniversalListStyle` | `SUI:12884` | internal list-style resolver. |
| `_TexturedPullDownMenuButtonStyle` | `SUI:13592` | deprecated macOS textured menu button. |

---

## 17. Coverage ledger

**Deep-covered (full HTML+CSS+prop-API mapping):**
Button family (`ButtonStyle`/`PrimitiveButtonStyle` + 11 concretes), Toggle (`.switch`/`.checkbox`/`.button`), Picker (8 concretes, segmented fully), Label (4), ProgressView (`.linear`/`.circular`), Gauge (8 concretes, 5-slot config), Menu (+MenuButton), List (10 concretes, insetGrouped fully), Form (3), DatePicker (6), DisclosureGroup, GroupBox, LabeledContent, ControlGroup (5), TextField (4), TextEditor (3), Table (3), and the SwiftUICore primitive styles `StrokeStyle`/`FillStyle`/`ShadowStyle`/`RoundedCornerStyle`/`ShapeStyle`/`PointerStyle`/`ScrollEdgeEffectStyle`/`ToolbarLabelStyle`. TabView (7, `.page` fully), IndexView, NavigationSplitView/NavigationView (7).

**Tabulated (cataloged with line + purpose + web-equivalent, not deep — app-shell/plumbing with no in-page DOM):**
Window styles (5), WindowToolbar styles (5), MenuBarExtra styles (4), Immersion styles (5), AccessibilityQuickAction styles (4), Widget/Control configs (7), Document/File configs (5), Drag/DropConfiguration (mapped to HTML5 DnD), SectionConfiguration, SystemFormatStyle, the Charts 3D surface styles (4), and ~14 internal `_`-prefixed style/config/value structs.

**Every Configuration's slot contract extracted (the GOLD):**
`ButtonStyleConfiguration{label,isPressed,role}` · `PrimitiveButtonStyleConfiguration{label,role,trigger()}` · `ToggleStyleConfiguration{label,$isOn,isMixed}` · `LabelStyleConfiguration{title,icon}` · `ProgressViewStyleConfiguration{fractionCompleted,label,currentValueLabel}` · `GaugeStyleConfiguration{value,label,current/min/max/markedValueLabel}` · `MenuStyleConfiguration{label,content}` · `FormStyleConfiguration{content}` · `DatePickerStyleConfiguration{label,$selection,min/maxDate,displayedComponents}` · `DisclosureGroupStyleConfiguration{label,content,$isExpanded}` · `GroupBoxStyleConfiguration{label,content}` · `LabeledContentStyleConfiguration{label,content}` · `ControlGroupStyleConfiguration{content,label}` · `TableStyleConfiguration{}` · `TextEditorStyleConfiguration{}` · `NavigationSplitViewStyleConfiguration{}`.
