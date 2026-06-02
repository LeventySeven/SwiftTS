# SwiftUI Cluster C2 — Action Controls (RE Teardown / Web-Replication Spec)

**Goal:** pixel-1:1 web replica of SwiftUI's action controls as a TypeScript/React (Next.js) UI kit.
This file is the **spec** a later agent uses to write the actual `.tsx` + CSS — every section ends in an
HTML structure + exact CSS + React prop API so it is paste-and-adapt, not descriptive.

**Authoritative source (Tier-1A):** the macOS 26 SDK `.swiftinterface` files. All `file:line` cites below are
verbatim from:
- `SwiftUI` = `…/SwiftUI.framework/…/arm64e-apple-macos.swiftinterface`
- `SwiftUICore` = `…/SwiftUICore.framework/…/arm64e-apple-macos.swiftinterface`

**Label convention:** `KNOWN` = read directly from the swiftinterface; `INFERRED` = Apple HIG / UIKit-parity
/ RE tables (UISwitch defaults, control-size metrics); `DESIGNED` = our engineering decision for the web.

**W1 token references** (from `swiftui/tokens/*.md`): `var(--sui-color-tint)` (default `#007AFF` light /
`#0A84FF` dark), `system.green` = `#34C759` light / `#30D158` dark, `system.red` = `#FF3B30` / `#FF453A`,
`label`/`secondaryLabel`, `text.body` (17pt/22 lh, −0.41 tracking), `quaternarySystemFill`
(`#7474801A` light / `#7474802E` dark), spring presets `anim.smooth/snappy/bouncy`.

**Work-list coverage:** Button, Toggle, Menu, ControlGroup, EditButton, HelpLink, ShareLink, PasteButton,
RenameButton + universal control states + ControlSize (deep-covered). SignInWithAppleButton is **not** in the
SwiftUI interface (it lives in `AuthenticationServices.framework`) — covered from docs/RE + tabulated.

---

## 0. Universal control machinery (read first — every control below inherits this)

### 0.1 Control states (the state set every control renders)

SwiftUI controls do not expose per-state colors in the interface; the states are resolved by the platform
renderer. The canonical state set (INFERRED, UIKit/AppKit parity, stable iOS 13→26):

| State | Trigger | Visual delta (default) |
|---|---|---|
| **default / enabled** | resting | full opacity, tint = `var(--sui-color-tint)` |
| **hover** (macOS / pointer / visionOS) | pointer over | bordered bg lightens ~4–6%; plain text gains subtle bg highlight |
| **pressed** | active touch / mouse-down | **whole control dims to ~0.75 opacity** (the SwiftUI "press dim"); bordered fill darkens ~one step |
| **focused** (keyboard / tvOS) | `@FocusState` / tab | focus ring: 3–4 pt tint-colored ring outside the shape (macOS), scale-up on tvOS |
| **disabled** | `.disabled(true)` / `EnvironmentValues.isEnabled == false` | **opacity 0.3** (whole control, including label + bg) |
| **selected / on** | toggle on, menu item chosen | tint-filled (switch track green, checkbox tint, prominent button stays filled) |

The two numeric constants that matter for the web kit:
- **press dim** → `opacity: 0.75` while `:active` (DESIGNED to match observed iOS button press; some styles use a
  background-darken instead — noted per style).
- **disabled** → `opacity: 0.3` on the root (INFERRED; matches `UIControl` disabled alpha 0.3 / SwiftUI `.disabled`).

The driving environment flag is `EnvironmentValues.isEnabled` (KNOWN, SwiftUICore). It propagates down the
subtree, so a disabled container disables every control inside it. **Web mapping:** model as a React context
`ControlEnvContext { isEnabled, controlSize, tint, controlGroupStyle }` that every C2 component reads, plus the
native `disabled` attribute + `[aria-disabled]`.

### 0.2 ControlSize — `SwiftUICore.ControlSize` (KNOWN enum, INFERRED metrics)

> `public enum ControlSize : Swift.CaseIterable, Swift.Sendable { case mini; case small; case regular;
> case large; case extraLarge }` — SwiftUICore `:6131–6149`. `extension … : Comparable` `:6151`
> (`mini < small < regular < large < extraLarge`).

Applied via the environment modifier (KNOWN, SwiftUICore `:6171`):
> `@inlinable nonisolated public func controlSize(_ controlSize: SwiftUICore.ControlSize) -> some View`
> and the range form `:6176` `controlSize<T>(_ range: T) where T.Bound == ControlSize`.
Read back via `EnvironmentValues.controlSize` (`:6160`, default `.regular`).

Per-case metrics (INFERRED — not in the interface; from `swiftui/tokens/spacing.md` §5.2, iOS canon):

| ControlSize | Height | H-pad | V-pad | Font | corner |
|---|---|---|---|---|---|
| `.mini` | 24 pt | 8 | 3 | 11 (caption2) | 5 continuous |
| `.small` | 28 pt | 10 | 4 | 13 (footnote) | 6 continuous |
| `.regular` | 34 pt | 14 | 7 | 15–17 (body) | 7–8 continuous |
| `.large` | 50 pt | 20 | 12 | 17 (body) | 10–12 continuous |
| `.extraLarge` | 56 pt | 24 | 15 | 17 | 12 continuous |

**Web mapping (DESIGNED):** emit a data attribute `data-control-size="regular"` on every control root and key all
metrics off CSS custom props so one attribute re-sizes the whole control:

```css
:root, [data-control-size="regular"] {
  --ctl-h: 34px; --ctl-px: 14px; --ctl-py: 7px; --ctl-font: 17px; --ctl-radius: 8px;
}
[data-control-size="mini"]  { --ctl-h:24px; --ctl-px:8px;  --ctl-py:3px;  --ctl-font:11px; --ctl-radius:5px; }
[data-control-size="small"] { --ctl-h:28px; --ctl-px:10px; --ctl-py:4px;  --ctl-font:13px; --ctl-radius:6px; }
[data-control-size="large"] { --ctl-h:50px; --ctl-px:20px; --ctl-py:12px; --ctl-font:17px; --ctl-radius:11px;}
[data-control-size="extraLarge"]{ --ctl-h:56px; --ctl-px:24px; --ctl-py:15px; --ctl-font:17px; --ctl-radius:12px;}
```

React: a `<ControlSizeProvider size="regular">` context provider + a `useControlSize()` hook; every C2 component
reads it and sets `data-control-size`.

---

## 1. Button — `SwiftUI.Button<Label>`

`public struct Button<Label> : SwiftUICore.View where Label : SwiftUICore.View` — SwiftUI `:21934`.

### 1.1 Exact API (KNOWN, verbatim with cites)

**Base initializers** (`:21935`, and role ext. `:21990`):
```swift
// :21935  — action + ViewBuilder label
init(action: @escaping @MainActor () -> Void, @ViewBuilder label: () -> Label)
// :21990  — with role (iOS15/macOS12+)
init(role: ButtonRole?, action: @escaping @MainActor () -> Void, @ViewBuilder label: () -> Label)
```

**Text-label convenience** — `extension … where Label == Text` (`:21946`, `:21993`):
```swift
init(_ titleKey: LocalizedStringKey, action: @escaping @MainActor () -> Void)               // :21947
init(_ titleResource: LocalizedStringResource, action: …)                                   // :21949 (iOS16+)
init<S>(_ title: S, action: …) where S : StringProtocol                                     // :21953
init(_ titleKey: LocalizedStringKey, role: ButtonRole?, action: …)                          // :21994
init<S>(_ title: S, role: ButtonRole?, action: …) where S : StringProtocol                  // :21999
```

**systemImage convenience** — `extension … where Label == Label<Text, Image>` (`:21955`, `:22002`):
```swift
init(_ titleKey: LocalizedStringKey, systemImage: String, action: …)                        // :21957  (iOS14+)
init<S>(_ title: S, systemImage: String, action: …) where S : StringProtocol                // :21968
init(_ titleKey: LocalizedStringKey, systemImage: String, role: ButtonRole?, action: …)     // :22003  (iOS15+)
```
> `systemImage:` resolves an **SF Symbol** by name into the leading icon (e.g. `"trash"`, `"square.and.arrow.up"`).
> `image:` overloads (`:21976`, `:22022`) take a bundled `ImageResource` instead.

**Style-config init** — `extension … where Label == PrimitiveButtonStyleConfiguration.Label` (`:21984`):
```swift
init(_ configuration: PrimitiveButtonStyleConfiguration)   // :21987 — re-wrap inside a custom style
```

**iOS 26 role-only default-label init** (`:22032`):
```swift
init(role: ButtonRole, action: …) where Label == DefaultButtonLabel   // auto label from role (e.g. "Cancel")
```

### 1.2 ButtonRole — `SwiftUI.ButtonRole` (KNOWN, SwiftUI `:9336–9344`)

```swift
public struct ButtonRole : Equatable, Sendable {
  public static let destructive: ButtonRole   // :9337
  public static let cancel: ButtonRole        // :9338
  public static let confirm: ButtonRole       // :9340 (iOS26+)
  public static let close: ButtonRole         // :9342 (iOS26+)
}
```
Role → color (INFERRED, HIG):
- `.destructive` → label/fill resolves to **`system.red`** (`#FF3B30` light / `#FF453A` dark). In a Menu or
  confirmationDialog the row text is red; as a `.borderedProminent` button the fill is red.
- `.cancel` → standard tint label, rendered **bold / emphasized** in dialogs (it's the "safe" default action).
- `.confirm` (iOS26) → emphasized affirmative; `.close` → dismiss affordance.
- `nil` (no role) → normal tint.

`ButtonStyleConfiguration` (KNOWN, `:10360–10368`) exposes to a custom style: `let role: ButtonRole?`,
`let label: Label`, **`let isPressed: Bool`** — this `isPressed` is exactly the `:active` we map to in CSS.

### 1.3 Visual anatomy & default metrics

Sub-elements: `[ optional leading SF-Symbol icon ] [ title Text ]` inside a shape (or bare, for `.plain`).
- Label layout = horizontal stack, icon→title, default gap ≈ **6 pt** (matches `Label` spacing).
- Typography = `text.body` (17pt/22 lh, weight 400, tracking −0.41) at `.regular`; scales per ControlSize §0.2.
- Min height = `--ctl-h` (34 pt at regular). No hard min-width on iOS (hugs content).
- Corner radius = `--ctl-radius` (7–8 pt regular, **continuous**/squircle).

**Style matrix** (cross-ref C15 for the full style protocol; metrics from `spacing.md` §5.3, INFERRED):

| Style (accessor → type) | iOS line | Fill | Label color | Corner | Pressed |
|---|---|---|---|---|---|
| `.automatic` → `DefaultButtonStyle` | `:969`/`:974` | context (toolbar/list = bordered-ish; bare = tint text) | tint | ctx | dim 0.75 |
| `.bordered` → `BorderedButtonStyle` | `:16742`/`:16747` | tint @ ~15% = `quaternarySystemFill` | tint | 7–8 cont | fill darkens |
| `.borderedProminent` → `BorderedProminentButtonStyle` | `:20925`/`:20932` | **solid `var(--sui-color-tint)`** | **white** | 7–8 cont | fill darkens ~12% |
| `.plain` → `PlainButtonStyle` | `:8664`/`:8669` | none | label/`primary` | 0 | dim 0.75 |
| `.borderless` → `BorderlessButtonStyle` | `:1433`/`:1438` | none | **tint** | 0 | dim 0.75 |
| `.link` → `LinkButtonStyle` | `:5632`/`:5641` | none | tint, underline-on-hover | 0 | dim |
| `.glass` → `GlassButtonStyle` | `:1240`/`:1247` | Liquid-Glass material (iOS26) | adaptive | capsule | specular |
| `.glassProminent` → `GlassProminentButtonStyle` | `:3372`/`:3378` | tinted glass | white | capsule | specular |

`destructive` + `.borderedProminent` ⇒ fill = `system.red` instead of tint.

**ButtonBorderShape** — `SwiftUI.ButtonBorderShape` (KNOWN, `:14675–14685`) sets the bordered shape:
```swift
static let automatic; static let capsule; static let roundedRectangle
static func roundedRectangle(radius: CGFloat) -> ButtonBorderShape   // :14681
static let circle                                                    // :14683
```
Applied via `.buttonBorderShape(_:)`. `.capsule` ⇒ `border-radius: 9999px`; `.circle` ⇒ 1:1 aspect + 50% radius.

### 1.4 Behavior

- **Tap/click** fires `action` on **touch-up-inside** (release within bounds), not on press-down — except a Menu's
  `primaryAction` and a `.plain` tap, which still fire on up. If the finger slides out before release, no fire.
- **Press feedback** is immediate on down (`isPressed = true`), reverts on up/cancel. The transition is a short
  `anim.smooth`-class spring on opacity/scale (no bounce). DESIGNED CSS: `transition: opacity .12s, transform .12s`.
- **Disabled** ⇒ no `action`, root opacity 0.3, `pointer-events: none`.
- **Keyboard:** Space/Return activate when focused (native `<button>` gives this free).
- **`.keyboardShortcut`** can bind a key; **`.controlSize`** resizes; **`.tint(_:)`** recolors.

### 1.5 Web replication mapping

**HTML:** always a native `<button type="button">` (gives focus, Space/Return, `disabled`, ARIA for free).

```tsx
type ButtonRole = "destructive" | "cancel" | "confirm" | "close";
type ButtonStyleName =
  | "automatic" | "bordered" | "borderedProminent" | "plain"
  | "borderless" | "link" | "glass" | "glassProminent";

interface ButtonProps {
  title?: string;                    // .init(_ title:)  — or use children
  systemImage?: string;              // SF Symbol name → <Icon name>
  role?: ButtonRole;
  action: () => void;                // .init(action:)
  buttonStyle?: ButtonStyleName;     // .buttonStyle(_:)  (default "automatic")
  borderShape?: "automatic" | "capsule" | "roundedRectangle" | "circle";
  controlSize?: ControlSize;         // .controlSize(_:)
  tint?: string;                     // .tint(_:)  → overrides --sui-color-tint
  disabled?: boolean;                // .disabled(_:)
  children?: React.ReactNode;        // ViewBuilder label
}
```

```css
.sui-button {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: var(--ctl-h); padding: var(--ctl-py) var(--ctl-px);
  font: 400 var(--ctl-font)/1.294 -apple-system, "SF Pro Text", system-ui;
  letter-spacing: -0.41px;
  border: none; border-radius: var(--ctl-radius); cursor: pointer;
  color: var(--sui-color-tint);           /* default tint label */
  background: transparent;
  transition: opacity .12s ease, transform .12s ease, background-color .12s ease;
  -webkit-user-select: none; user-select: none;
}
.sui-button:active   { opacity: .75; }     /* press dim (plain/borderless) */
.sui-button:disabled { opacity: .3; pointer-events: none; cursor: default; }
.sui-button:focus-visible { outline: 3px solid color-mix(in srgb, var(--sui-color-tint) 60%, transparent); outline-offset: 2px; border-radius: var(--ctl-radius); }

/* --- styles --- */
.sui-button[data-style="bordered"] { background: var(--sui-fill-quaternary, #7474801A); color: var(--sui-color-tint); }
.sui-button[data-style="bordered"]:active { background: color-mix(in srgb, var(--sui-color-tint) 25%, transparent); opacity: 1; }
.sui-button[data-style="borderedProminent"] { background: var(--sui-color-tint); color: #fff; }
.sui-button[data-style="borderedProminent"]:active { background: color-mix(in srgb, var(--sui-color-tint) 88%, black); opacity: 1; }
.sui-button[data-style="plain"]       { color: var(--sui-color-label, #000); }
.sui-button[data-style="link"]        { color: var(--sui-color-tint); }
.sui-button[data-style="link"]:hover  { text-decoration: underline; }

/* --- role overrides --- */
.sui-button[data-role="destructive"]                              { color: var(--sui-color-red, #FF3B30); }
.sui-button[data-role="destructive"][data-style="borderedProminent"] { background: var(--sui-color-red, #FF3B30); color:#fff; }

/* --- border shape --- */
.sui-button[data-shape="capsule"] { border-radius: 9999px; }
.sui-button[data-shape="circle"]  { border-radius: 50%; aspect-ratio: 1; padding: var(--ctl-py); }
```

The `borderedProminent` press uses background-darken (opacity stays 1) because dimming a filled control looks
wrong; the plain/borderless/automatic styles use the opacity-0.75 dim. This split matches observed iOS behavior.

---

## 2. Toggle — `SwiftUI.Toggle<Label>`

`public struct Toggle<Label> : SwiftUICore.View where Label : SwiftUICore.View` — SwiftUI `:4916`.

### 2.1 Exact API (KNOWN, verbatim)

**Base** (`:4917`, `:4919`):
```swift
init(isOn: Binding<Bool>, @ViewBuilder label: () -> Label)                                  // :4917
init<C>(sources: C, isOn: KeyPath<C.Element, Binding<Bool>>, @ViewBuilder label: () -> Label)
        where C : RandomAccessCollection                                                    // :4919 (iOS16+)
```
The `sources:` form drives a **multi-selection / mixed** toggle: when the bound bools disagree, the toggle shows a
**mixed/indeterminate** state (see `isMixed` below).

**Text convenience** — `where Label == Text` (`:4935`):
```swift
init(_ titleKey: LocalizedStringKey, isOn: Binding<Bool>)                                   // :4937
init<S>(_ title: S, isOn: Binding<Bool>) where S : StringProtocol                           // :4942
init<C>(_ titleKey: LocalizedStringKey, sources: C, isOn: KeyPath<…>)                        // :4944 (iOS16+)
```
**systemImage convenience** — `where Label == Label<Text, Image>` (`:4952`):
```swift
init(_ titleKey: LocalizedStringKey, systemImage: String, isOn: Binding<Bool>)              // :4954
```
**Style-config init** — `where Label == ToggleStyleConfiguration.Label` (`:4930`):
```swift
init(_ configuration: ToggleStyleConfiguration)                                             // :4933
```

`ToggleStyleConfiguration` (KNOWN, `:3084–3101`) gives a custom style:
`let label: Label`, **`@Binding var isOn: Bool`** (`:3091`), `var $isOn: Binding<Bool>`,
**`var isMixed: Bool`** (`:3100`, iOS16+ — the tri-state flag).

### 2.2 ToggleStyle — switch / button / checkbox

`protocol ToggleStyle` (KNOWN, `:3077`): `func makeBody(configuration: ToggleStyleConfiguration) -> Body`.
Applied via `.toggleStyle(_:)` (`:3110`). Concrete styles:

| Accessor → type | line | Render |
|---|---|---|
| `.automatic` → `DefaultToggleStyle` | `:18469`/`:18474` | platform default: **switch** on iOS, **checkbox** on macOS |
| `.switch` → `SwitchToggleStyle` | `:23183`/`:23189` | the green sliding switch |
| `.button` → `ButtonToggleStyle` | `:1098`/`:1105` | a button that stays filled (selected) when on |
| `.checkbox` → `CheckboxToggleStyle` | `:12424`/`:12434` | macOS check box (✓) |

`SwitchToggleStyle` (`:23189`) has `init()` and a **deprecated** `init(tint: Color)` (`:23196`, "Use `.tint(_)`
instead") — so the modern on-color comes from `.tint(_:)`, defaulting to **`system.green`** (`#34C759`).

### 2.3 Visual anatomy — the switch (default iOS)

Sub-elements: `[ label (leading, fills width) ] … [ track (rounded capsule) [ knob (circle) ] ]` (trailing).
Exact geometry (INFERRED, UISwitch parity — confirmed: default UISwitch is **51×31**, thumb white; see Sources):

| Part | Metric | Token |
|---|---|---|
| track size | **51 × 31 pt** | `metric.toggle.width/height` (spacing.md §5.4) |
| track radius | 15.5 pt (full capsule = height/2) | — |
| knob diameter | **27 pt** | `metric.toggle.knobDiameter` |
| knob inset | 2 pt all sides (31 − 27 = 4 / 2) | — |
| knob travel | 51 − 27 − 2·2 = **20 pt** (off-left → on-right) | — |
| **off** track | `tertiarySystemFill` gray `#7676801F` (light) | fill token |
| **on** track | **`system.green`** `#34C759` (default; or `var(--sui-color-tint)` if tinted) | green/tint |
| knob | white `#FFFFFF`, drop shadow `0 3px 8px rgba(0,0,0,.15), 0 1px 1px rgba(0,0,0,.16)` | — |
| **mixed** | track shows a centered short dash / partial fill | — |
| **disabled** | whole control opacity 0.3 | — |

Label uses `text.body`; for a `Form`/`List` row the label is leading and the switch is trailing (space-between).

### 2.4 Behavior — the slide animation

- Tap anywhere on the row (or the switch) flips `isOn`. The knob **slides** left↔right and the track
  **cross-fades** gray↔green simultaneously.
- The slide is a **spring** (not linear). It reads as the `anim.smooth`/`snappy` family: a short, near-critically-
  damped spring with a tiny knob over-travel (the thumb momentarily widens ~ +2pt while moving, then snaps round —
  the classic iOS switch "stretch"). DESIGNED mapping: `anim.snappy` (duration 0.697s wall, ζ=0.85) for the knob
  transform, `anim.smooth` for the color cross-fade.
- Drag gesture: you can drag the knob; releasing past the midpoint commits, otherwise springs back.
- Keyboard: Space toggles when focused.

### 2.5 Web replication mapping

**HTML:** a `<button role="switch" aria-checked>` wrapping a track `<span>` + knob `<span>`; optional label.
Use `role="switch"` (not a checkbox) so it announces "on/off". For `.checkbox` style, swap to
`<input type="checkbox">` semantics.

```tsx
type ToggleStyleName = "automatic" | "switch" | "button" | "checkbox";
interface ToggleProps {
  isOn: boolean;
  onChange: (v: boolean) => void;     // mirrors Binding<Bool>
  label?: string;
  systemImage?: string;
  isMixed?: boolean;                  // tri-state (sources: form)
  toggleStyle?: ToggleStyleName;      // default "automatic" → "switch" on web
  tint?: string;                      // .tint(_:)  → on-track color (default green)
  disabled?: boolean;
  controlSize?: ControlSize;
}
```

```css
.sui-toggle { display:flex; align-items:center; justify-content:space-between; gap:8px;
  font:400 17px/1.294 -apple-system,system-ui; letter-spacing:-0.41px; }
.sui-switch {                              /* the track */
  position:relative; flex:0 0 auto; width:51px; height:31px; border-radius:15.5px;
  background: var(--sui-fill-tertiary, #7676801F);   /* OFF */
  border:none; padding:0; cursor:pointer;
  transition: background-color .3s cubic-bezier(.4,0,.2,1);
}
.sui-switch[aria-checked="true"]  { background: var(--toggle-on, var(--sui-color-green, #34C759)); }
.sui-switch[aria-checked="mixed"] { background: var(--sui-fill-secondary, #78788028); }
.sui-switch::after {                       /* the knob */
  content:""; position:absolute; top:2px; left:2px; width:27px; height:27px; border-radius:50%;
  background:#fff; box-shadow:0 3px 8px rgba(0,0,0,.15), 0 1px 1px rgba(0,0,0,.16);
  /* spring slide ≈ anim.snappy (0.697s) */
  transition: transform .35s linear(0,.0541 4.2%,.1761 8.3%,.3225 12.5%,.4678 16.7%,.5981 20.8%,.7076 25%,.7952 29.2%,.8624 33.3%,.9121 37.5%,.9474 41.7%,1 60%,1);
}
.sui-switch[aria-checked="true"]::after { transform: translateX(20px); }  /* 51−27−4 = 20 */
.sui-toggle[aria-disabled="true"] { opacity:.3; pointer-events:none; }
.sui-switch:focus-visible { outline:3px solid color-mix(in srgb,var(--sui-color-tint) 60%,transparent); outline-offset:2px; }
```

The on-track color is `--toggle-on`, defaulting to green; setting `tint` overrides it (matches the deprecated
`SwitchToggleStyle(tint:)` → `.tint(_:)` migration). `.button` style ⇒ reuse `<Button>` filled-when-on;
`.checkbox` ⇒ a 14×14 squircle that fills tint + draws an SF `checkmark` when on.

---

## 3. Menu — `SwiftUI.Menu<Label, Content>`

`public struct Menu<Label, Content> : View where Label : View, Content : View` — SwiftUI `:6960`.
(watchOS unavailable; iOS14/macOS11/tvOS17+.)

### 3.1 Exact API (KNOWN, verbatim)

**Base** (`:6975`):
```swift
init(@ViewBuilder content: () -> Content, @ViewBuilder label: () -> Label)                  // :6975
init(_ titleKey: LocalizedStringKey, @ViewBuilder content: () -> Content) where Label == Text// :6976
init<S>(_ title: S, @ViewBuilder content: …) where Label == Text, S : StringProtocol        // :6982
```
**Primary-action form** (`:6986` — tap fires action, long-press / chevron opens menu):
```swift
init(content:, label:, primaryAction: @escaping () -> Void)                                 // :6986
init(_ titleKey:, content:, primaryAction:) where Label == Text                             // :6987
```
**systemImage** — `where Label == Label<Text,Image>` (`:7001`):
```swift
init(_ titleKey: LocalizedStringKey, systemImage: String, @ViewBuilder content: () -> Content)   // :7003
init(_ titleKey:, systemImage:, content:, primaryAction:)                                        // :7027
```
**Style-config** — `where Label == MenuStyleConfiguration.Label, Content == …Content` (`:7072`):
```swift
init(_ configuration: MenuStyleConfiguration)                                               // :7074
```

### 3.2 MenuStyle (KNOWN)

`protocol MenuStyle` (`:2832`), applied via `.menuStyle(_:)`. Concrete:
- `.automatic` → `DefaultMenuStyle` (`:15415`) — pull-down trigger with trailing chevron.
- `.button` → `ButtonMenuStyle` (`:8828`) — renders the trigger as a button.
- `.borderedButton` → `BorderedButtonMenuStyle` (`:3119`); `.borderlessButton` → `BorderlessButtonMenuStyle` (`:16462`).
- `MenuStyleConfiguration` (`:2852`) gives `.label` and `.content`.

Related env: **`MenuActionDismissBehavior`** (`:13451`, `.automatic` default — chosen item dismisses the menu;
`.disabled` keeps it open for multi-select) and **`MenuOrder`** (`:4068`, `.automatic`/`.fixed`/`.priority` —
controls whether items list top-down or anchor-adjacent).

### 3.3 Visual anatomy

**Trigger:** `[ label ] [ chevron ]`. Default chevron = SF Symbol **`chevron.up.chevron.down`** (the small
up/down "pull-down" glyph) trailing the label, tint-colored, ~`secondaryLabel` weight. For a plain text menu the
trigger looks like a tappable tint label + chevron.

**Popup (the menu panel):**
- Appears anchored to the trigger; **continuous-corner** rounded rect, radius ≈ **13 pt** (iOS context-menu radius).
- **Material background** = `regularMaterial` blur (translucent vibrancy), thin hairline border.
- Drop shadow ≈ `0 10px 40px rgba(0,0,0,.20)`.
- Each **row**: leading title `text.body` + trailing SF Symbol icon, ~44 pt row height, 16 pt h-padding.
  Destructive rows render red (`system.red`). Hairline `separator` between groups.
- Appears with a **scale + fade** from the trigger anchor (≈ scale 0.9→1 over `anim.snappy`), origin = anchor edge.

### 3.4 Behavior

- Tap trigger → popup opens (scale/fade in). Tap a row → fires that item's action, popup dismisses (unless
  `menuActionDismissBehavior(.disabled)`). Tap outside / Esc → dismiss.
- **primaryAction** variant: single tap fires `primaryAction`; the menu only opens on long-press (or tapping the
  chevron affordance). This is the "split button" pattern.
- Keyboard: ↑/↓ move highlight, Return activates, Esc closes. Focus is trapped in the open popup.

### 3.5 Web replication mapping

**HTML:** trigger `<button aria-haspopup="menu" aria-expanded>` + a popup `<div role="menu">` with
`<button role="menuitem">` rows. Position with an anchor/popover library (or CSS Anchor Positioning / `popover`).

```tsx
interface MenuProps {
  label?: string; systemImage?: string;
  children: React.ReactNode;          // menu items (ViewBuilder content)
  primaryAction?: () => void;         // split-button form
  menuStyle?: "automatic" | "button" | "borderedButton" | "borderlessButton";
  dismissOnSelect?: boolean;          // menuActionDismissBehavior (default true)
}
interface MenuItemProps { title: string; systemImage?: string; role?: ButtonRole; action: () => void; }
```

```css
.sui-menu-trigger { display:inline-flex; align-items:center; gap:4px; color:var(--sui-color-tint);
  font:400 17px/1.294 -apple-system; letter-spacing:-0.41px; border:none; background:none; cursor:pointer; }
.sui-menu-trigger .chevron { font-size:.78em; color:var(--sui-color-secondary, #3C3C4399); }  /* chevron.up.chevron.down */
.sui-menu-popup {
  min-width:250px; padding:6px 0; border-radius:13px;
  background: color-mix(in srgb, var(--sui-bg, #fff) 80%, transparent);
  -webkit-backdrop-filter:blur(30px) saturate(180%); backdrop-filter:blur(30px) saturate(180%);
  box-shadow:0 10px 40px rgba(0,0,0,.20), 0 0 0 .5px rgba(0,0,0,.08);
  transform-origin: top center;
  animation: sui-menu-in .25s linear(0,.7076 25%,.9474 41.7%,1 60%,1);  /* anim.snappy scale/fade */
}
@keyframes sui-menu-in { from { opacity:0; transform:scale(.9); } to { opacity:1; transform:scale(1); } }
.sui-menu-item { display:flex; align-items:center; justify-content:space-between; gap:12px;
  width:100%; height:44px; padding:0 16px; border:none; background:none; cursor:pointer;
  font:400 17px/1.294 -apple-system; color:var(--sui-color-label,#000); }
.sui-menu-item:hover, .sui-menu-item:focus-visible { background: var(--sui-fill-quaternary,#7474801A); }
.sui-menu-item[data-role="destructive"] { color: var(--sui-color-red,#FF3B30); }
```

---

## 4. ControlGroup — `SwiftUI.ControlGroup<Content>`

`public struct ControlGroup<Content> : View where Content : View` — SwiftUI `:14966`. (watchOS unavailable.)

### 4.1 Exact API (KNOWN)

```swift
init(@ViewBuilder content: () -> Content)                                                   // :14967
// labeled form (iOS16+) — wraps in LabeledControlGroupContent<C,L>:
init<C,L>(@ViewBuilder content: () -> C, @ViewBuilder label: () -> L)
        where Content == LabeledControlGroupContent<C,L>                                     // :15000
init<C>(_ titleKey: LocalizedStringKey, @ViewBuilder content: () -> C) where Content == LabeledControlGroupContent<C,Text>  // :15006
init<C>(_ titleKey:, systemImage: String, content:) …                                       // :15025
init(_ configuration: ControlGroupStyleConfiguration) where Content == …Content             // :14995
```

### 4.2 ControlGroupStyle (KNOWN)

`protocol ControlGroupStyle` (`:20206`), `.controlGroupStyle(_:)`. Concrete:
- `.automatic` → `AutomaticControlGroupStyle` (`:8345`/`:8346`).
- `.navigation` → `NavigationControlGroupStyle` (`:15816`) — toolbar nav cluster.
- `.palette` → `PaletteControlGroupStyle` (`:7387`) — a row of icon swatches (used for color/emoji pickers).
- `.menu` → `MenuControlGroupStyle` (`:16563`); `.compactMenu` → `CompactMenuControlGroupStyle` (`:16584`).
- `ControlGroupStyleConfiguration` (`:20230`) gives `.content` + `.label`.

### 4.3 Visual anatomy & behavior

ControlGroup lays its child controls into a **single segmented/bordered cluster** — adjacent buttons share a
background with hairline dividers between them and **rounded outer corners only** (inner edges square). In a
toolbar it collapses to a compact grouped capsule. The whole group is one visual unit (one shadow, one border).

- Default: horizontal stack of buttons, each `--ctl-h` tall, dividers `separator` 0.5pt, group corner 7–8 pt.
- `.palette`: square icon cells, selected cell shows a tint ring/fill (`PaletteSelectionEffect`, `:10285`).
- `.menu`/`.compactMenu`: collapses the group into a single Menu trigger.

### 4.4 Web replication mapping

```tsx
interface ControlGroupProps {
  label?: string; systemImage?: string;
  controlGroupStyle?: "automatic" | "navigation" | "palette" | "menu" | "compactMenu";
  children: React.ReactNode;          // the member controls
}
```

```css
.sui-control-group { display:inline-flex; align-items:stretch;
  border-radius:var(--ctl-radius); overflow:hidden;
  background:var(--sui-fill-quaternary,#7474801A); box-shadow:0 0 0 .5px rgba(0,0,0,.08); }
.sui-control-group > * { border-radius:0 !important; box-shadow:none !important; background:transparent; }
.sui-control-group > * + * { border-left:.5px solid var(--sui-color-separator,#3C3C434A); }
.sui-control-group[data-style="palette"] { padding:4px; gap:4px; background:transparent; }
.sui-control-group[data-style="palette"] > * { border-radius:8px; }
.sui-control-group[data-style="palette"] > [aria-selected="true"] { box-shadow:0 0 0 2px var(--sui-color-tint); }
```

---

## 5. Prebuilt action buttons (EditButton, RenameButton, HelpLink, ShareLink, PasteButton)

These are zero/low-config buttons that render a fixed, system-defined affordance. They are thin wrappers over
`Button` + a fixed action, so they inherit §0 states and §1 button rendering. Each section gives the exact API,
the fixed label/icon, and the React mapping.

### 5.1 EditButton — `SwiftUI.EditButton` (iOS only)

> `public struct EditButton : View { public init() }` — SwiftUI `:20528–20530`. (macOS/tvOS/watchOS unavailable.)

- **What it does:** toggles `EditMode` in the environment (`@Environment(\.editMode)`). When inactive shows
  **"Edit"**; when active shows **"Done"** (bold). Used in a `List`/nav bar to enter row-reorder/delete mode.
- **Anatomy:** a `.plain`/`.borderless` text button, tint-colored, `text.body`. No icon. "Done" renders semibold.
- **Behavior:** tap flips `editMode` between `.inactive`/`.active`; the bound List shows delete/reorder handles.

```tsx
interface EditButtonProps { editMode: "inactive" | "active"; onChange: (m) => void; }
```
```css
.sui-edit-button { color:var(--sui-color-tint); background:none; border:none; cursor:pointer;
  font:400 17px/1.294 -apple-system; letter-spacing:-0.41px; }
.sui-edit-button[data-editing="true"] { font-weight:600; }   /* "Done" is semibold */
```
Label text is driven by `data-editing`: `false → "Edit"`, `true → "Done"` (localized).

### 5.2 RenameButton — `SwiftUI.RenameButton<Label>`

> `public struct RenameButton<Label> : View … { public init() where Label == Label<Text, Image> }` — `:22978`.

- **What it does:** placed inside a context menu or toolbar; triggers a **rename action** registered up the view
  tree via `.renameAction(_:)`. The default label is **"Rename"** + SF Symbol **`pencil`**.
- **Anatomy:** a `Label<Text,Image>` — leading `pencil` icon, "Rename" title. In a menu it's a standard menu row.
- **Behavior:** tap invokes the nearest `renameAction` closure (often focuses a text field for inline rename).

```tsx
interface RenameButtonProps { action: () => void; }  // wire to nearest renameAction
```
```css
.sui-rename-button { display:inline-flex; align-items:center; gap:6px; color:var(--sui-color-tint);
  background:none; border:none; cursor:pointer; font:400 17px/1.294 -apple-system; }
/* icon = SF "pencil"; label = "Rename" */
```

### 5.3 HelpLink — `SwiftUI.HelpLink` (macOS only)

`public struct HelpLink : View` — SwiftUI `:17907`. (iOS/tvOS/watchOS unavailable; macOS 14+.)

```swift
init(action: @escaping () -> Void)                       // :17909
init(destination: Foundation.URL)                        // :17910
init(anchor: NSHelpManager.AnchorName)                   // :17911
init(anchor: NSHelpManager.AnchorName, book: NSHelpManager.BookName)  // :17912
```

- **What it does:** the standard macOS **"?" help button** — a circular bordered button with a **`questionmark`**
  glyph, bottom-leading of a dialog/sheet. `action:` runs custom help, `destination:` opens a URL, `anchor:`/`book:`
  jump into the app's Help Book.
- **Anatomy:** **circle**, ~22 pt diameter, `bordered` style fill (gray translucent), centered `?` glyph tint/label.
- **Behavior:** standard button press; opens help.

```tsx
interface HelpLinkProps { action?: () => void; href?: string; }   // action XOR href
```
```css
.sui-help-link { width:22px; height:22px; border-radius:50%; display:inline-grid; place-items:center;
  background:var(--sui-fill-quaternary,#7474801A); color:var(--sui-color-label,#000); border:none; cursor:pointer;
  font:600 14px/1 -apple-system; }
.sui-help-link::before { content:"?"; }
.sui-help-link:active { background:color-mix(in srgb,var(--sui-color-label) 12%,transparent); }
```

### 5.4 ShareLink — `SwiftUI.ShareLink<Data, PreviewImage, PreviewIcon, Label>`

`public struct ShareLink<…> : View` — SwiftUI `:17935`. (tvOS unavailable; iOS16/macOS13/watchOS9+.)

**Key inits** (KNOWN):
```swift
// full form :17936
init(items: Data, subject: Text? = nil, message: Text? = nil,
     preview: @escaping (Data.Element) -> SharePreview<PreviewImage, PreviewIcon>,
     @ViewBuilder label: () -> Label)
// default-label (DefaultShareLinkLabel) forms — auto label "Share" + square.and.arrow.up:
init(items: Data, subject: Text? = nil, message: Text? = nil, preview: …)                   // :17984
init(_ titleKey: LocalizedStringKey, items: Data, …)                                        // :17985
// single-item + no-preview convenience (URL / String) :18018–18055:
init(item: URL, subject: Text? = nil, message: Text? = nil)                                 // :18052
init(item: String, subject:, message:)                                                      // :18053
```

- **What it does:** presents the system **share sheet** (`UIActivityViewController` / `NSSharingServicePicker`)
  for the given `items`. `subject`/`message` prefill mail; `preview` supplies the thumbnail+title shown in the sheet.
- **Anatomy (default label):** `Label<Text,Image>` — leading SF Symbol **`square.and.arrow.up`** + **"Share"**
  title, tint-colored, standard button rendering. Custom `label:` replaces this.
- **Behavior:** tap opens the share sheet anchored to the link; selecting a target shares the items.

```tsx
interface ShareLinkProps {
  items: string[] | URL[];            // Data
  item?: string | URL;                // single-item convenience
  subject?: string; message?: string;
  title?: string;                     // overrides default "Share"
  systemImage?: string;               // default "square.and.arrow.up"
  preview?: { title: string; image?: string };
  children?: React.ReactNode;         // custom label
  onShare?: () => void;               // web: invoke navigator.share()
}
```
Web: the action calls `navigator.share({ title, text, url })` (Web Share API) when available, else falls back to a
copy-link/popover sheet. Trigger renders identically to a `.bordered`/`.plain` Button with the share glyph.
```css
.sui-share-link { display:inline-flex; align-items:center; gap:6px; color:var(--sui-color-tint);
  background:none; border:none; cursor:pointer; font:400 17px/1.294 -apple-system; }
/* leading glyph = SF "square.and.arrow.up"; default text "Share" */
```

### 5.5 PasteButton — `SwiftUI.PasteButton` (iOS16/macOS11+; tvOS/watchOS unavailable)

`@MainActor public struct PasteButton : View` — SwiftUI `:21561`.
```swift
init(supportedContentTypes: [UTType], payloadAction: @escaping ([NSItemProvider]) -> Void)  // :21563
init<T>(payloadType: T.Type, onPaste: @escaping ([T]) -> Void) where T : Transferable       // :21571
init<Payload>(supportedContentTypes:, validator:, payloadAction:)   // macOS-deprecated      // :21567
```

- **What it does:** a **privacy-preserving paste affordance**. Tapping it reads the pasteboard **once** (no silent
  clipboard access) and delivers matching items to `payloadAction`/`onPaste`. `supportedContentTypes` filters by UTType.
- **Anatomy:** `.borderedProminent`-style filled button (tint fill, white label) — leading SF Symbol
  **`doc.on.clipboard`** + **"Paste"** title. Capsule/rounded.
- **Behavior:** enabled only when the pasteboard holds a compatible type (otherwise dimmed). Tap → reads & fires.

```tsx
interface PasteButtonProps {
  supportedContentTypes?: string[];   // MIME/UTType filter
  onPaste: (items: ClipboardItems) => void;
  disabled?: boolean;                 // auto-disabled when clipboard empty/incompatible
}
```
Web: on click call `navigator.clipboard.read()` (user-gesture-gated, mirrors the one-shot privacy model), filter by
type, fire `onPaste`. Renders as a prominent button with the clipboard glyph.
```css
.sui-paste-button { display:inline-flex; align-items:center; gap:6px;
  background:var(--sui-color-tint); color:#fff; border:none; border-radius:var(--ctl-radius);
  min-height:var(--ctl-h); padding:var(--ctl-py) var(--ctl-px); cursor:pointer;
  font:400 17px/1.294 -apple-system; letter-spacing:-0.41px; }
.sui-paste-button:active   { background:color-mix(in srgb,var(--sui-color-tint) 88%,black); }
.sui-paste-button:disabled { opacity:.3; pointer-events:none; }
```

---

## 6. SignInWithAppleButton (AuthenticationServices — NOT in SwiftUI interface)

**NOTE:** `SignInWithAppleButton` is declared in `AuthenticationServices.framework`, not SwiftUI, so it is **not**
in the cluster swiftinterface. Covered here from Apple docs + RE (INFERRED). It is a `View` that bridges
`ASAuthorizationAppleIDButton`.

**API (INFERRED, Apple docs):**
```swift
SignInWithAppleButton(_ label: SignInWithAppleButton.Label = .signIn,
                      onRequest: (ASAuthorizationAppleIDRequest) -> Void,
                      onCompletion: (Result<ASAuthorization, Error>) -> Void)
```
- `SignInWithAppleButton.Label`: **`.signIn`** ("Sign in with Apple"), **`.signUp`** ("Sign up with Apple"),
  **`.continue`** ("Continue with Apple").
- Style via `.signInWithAppleButtonStyle(_:)`: **`.black`**, **`.white`**, **`.whiteOutline`**.

**Visual anatomy (Apple-mandated — must match exactly or App Review rejects):**
- Full-width rounded rect, corner radius default ~ height/2 (capsule-ish) or set via `.cornerRadius`.
- Leading **Apple logo** () glyph + label text, centered as a unit.
- Font = **SF Pro**, the system "button" weight; min height 44 pt (HIG tappable min).
- **`.black`**: black bg, white logo+text. **`.white`**: white bg, black logo+text. **`.whiteOutline`**: white bg,
  black content, 1pt black border.
- Logo and text must keep Apple's fixed proportions/padding (Apple ships the exact margins; do not restyle).

**Behavior:** tap starts the ASAuthorization flow. Web equivalent = **"Sign in with Apple JS"** (`AppleID.auth`).

```tsx
type SIWALabel = "signIn" | "signUp" | "continue";
type SIWAStyle = "black" | "white" | "whiteOutline";
interface SignInWithAppleButtonProps {
  label?: SIWALabel; signInStyle?: SIWAStyle;
  onRequest?: () => void; onCompletion?: (r: { ok: boolean }) => void;
}
```
```css
.sui-siwa { display:inline-flex; align-items:center; justify-content:center; gap:8px;
  width:100%; min-height:44px; border-radius:8px; cursor:pointer;
  font:600 19px/1 -apple-system,"SF Pro Text",system-ui; }
.sui-siwa[data-style="black"]        { background:#000; color:#fff; border:none; }
.sui-siwa[data-style="white"]        { background:#fff; color:#000; border:none; }
.sui-siwa[data-style="whiteOutline"] { background:#fff; color:#000; border:1px solid #000; }
.sui-siwa .apple-logo { width:1em; height:1em; } /* the  glyph, fixed proportion */
```
Label text by `label`: `signIn → "Sign in with Apple"`, `signUp → "Sign up with Apple"`, `continue → "Continue with Apple"`.

---

## 7. Long-tail style/config types (tabulated — referenced above, not re-deep-covered)

These are the supporting style structs / config objects already cited inline. They have no independent visual of
their own (they parameterize a control), so they are tabulated, not deep-covered. Web-equivalent = the
`data-style` attribute / prop variant on the owning component.

| Type | Line | Purpose | Web equivalent |
|---|---|---|---|
| `DefaultButtonStyle` | `:974` | `.automatic` button | `data-style="automatic"` |
| `BorderedButtonStyle` | `:16747` | `.bordered` | `data-style="bordered"` |
| `BorderedProminentButtonStyle` | `:20932` | `.borderedProminent` | `data-style="borderedProminent"` |
| `PlainButtonStyle` | `:8669` | `.plain` | `data-style="plain"` |
| `BorderlessButtonStyle` | `:1438` | `.borderless` | `data-style="borderless"` |
| `LinkButtonStyle` | `:5641` | `.link` | `data-style="link"` |
| `GlassButtonStyle` | `:1247` | `.glass` (iOS26 Liquid Glass) | `data-style="glass"` |
| `GlassProminentButtonStyle` | `:3378` | `.glassProminent` | `data-style="glassProminent"` |
| `ButtonStyleConfiguration` | `:10359` | passed to custom `ButtonStyle.makeBody` (`role`, `label`, `isPressed`) | render-prop args |
| `PrimitiveButtonStyleConfiguration` | (`:8292` protocol) | custom primitive style (`role`, `label`, `trigger()`) | render-prop args |
| `ButtonBorderShape` | `:14675` | `.capsule`/`.roundedRectangle`/`.circle`/`.automatic` | `data-shape` |
| `DefaultButtonLabel` | `:22038` | iOS26 auto label from role | text from role map |
| `SwitchToggleStyle` | `:23189` | `.switch` | `toggleStyle="switch"` |
| `ButtonToggleStyle` | `:1105` | `.button` toggle | `toggleStyle="button"` |
| `CheckboxToggleStyle` | `:12434` | `.checkbox` (macOS) | `toggleStyle="checkbox"` |
| `DefaultToggleStyle` | `:18474` | `.automatic` toggle | `toggleStyle="automatic"` |
| `ToggleStyleConfiguration` | `:3084` | custom toggle style (`label`, `$isOn`, `isMixed`) | render-prop args |
| `DefaultMenuStyle` | (`:15415`) | `.automatic` menu | `menuStyle="automatic"` |
| `ButtonMenuStyle` | `:8828` | `.button` menu | `menuStyle="button"` |
| `BorderedButtonMenuStyle` | `:3119` | `.borderedButton` menu | `menuStyle="borderedButton"` |
| `BorderlessButtonMenuStyle` | `:16462` | `.borderlessButton` menu | `menuStyle="borderlessButton"` |
| `MenuStyleConfiguration` | `:2852` | custom menu style (`label`, `content`) | render-prop args |
| `MenuActionDismissBehavior` | `:13451` | `.automatic`/`.disabled` (keep open) | `dismissOnSelect` prop |
| `MenuOrder` | `:4068` | `.automatic`/`.fixed`/`.priority` item order | `menuOrder` prop |
| `AutomaticControlGroupStyle` | `:8346` | `.automatic` group | `data-style="automatic"` |
| `NavigationControlGroupStyle` | `:15816` | `.navigation` | `data-style="navigation"` |
| `PaletteControlGroupStyle` | `:7387` | `.palette` swatch row | `data-style="palette"` |
| `MenuControlGroupStyle` | `:16563` | `.menu` collapse | `data-style="menu"` |
| `CompactMenuControlGroupStyle` | `:16584` | `.compactMenu` | `data-style="compactMenu"` |
| `ControlGroupStyleConfiguration` | `:20230` | custom group style (`label`, `content`) | render-prop args |
| `LabeledControlGroupContent` | `:14981` | wrapper for labeled ControlGroup | internal |
| `DefaultShareLinkLabel` | (ext `:17983`) | auto "Share" + `square.and.arrow.up` | default label |
| `SharePreview` | (ShareLink param) | thumbnail+title in share sheet | `preview` prop |

---

## 8. Coverage summary

**Deep-covered (full anatomy + CSS + prop API):** universal control states, ControlSize, **Button** (all label
inits incl. systemImage/role; ButtonRole destructive/cancel/confirm/close; all 8 styles; ButtonBorderShape),
**Toggle** (switch geometry 51×31, knob 27pt, green on-track, slide spring; switch/button/checkbox styles),
**Menu** (trigger+chevron+popup+styles+dismiss behavior), **ControlGroup** (segmented cluster + 5 styles),
**EditButton, RenameButton, HelpLink, ShareLink, PasteButton** (each: fixed label/icon + behavior + CSS),
**SignInWithAppleButton** (from AuthenticationServices docs — not in SwiftUI interface).

**Tabulated (long tail — supporting style/config structs, §7):** 30 style/configuration types that parameterize the
deep-covered controls; each maps to a `data-style`/prop variant. None has independent visual rendering.

**Not in this interface:** `SignInWithAppleButton` (AuthenticationServices), `MenuButton`/`MenuBarExtra` (separate
macOS menu-bar APIs, out of cluster scope).

**Sources (runtime visuals beyond the interface):**
- [Apple — UISwitch / thumbTintColor (51×31 default size, white thumb, systemGreen on-tint)](https://developer.apple.com/documentation/uikit/uiswitch/1623684-thumbtintcolor)
- [iOS 13 UISwitch dimensions & customization (51×31, onTintColor systemGreen)](https://medium.com/@myshkinasasha/ios-13-uiswitch-modal-presentation-8e91c9add7f1)

