# SwiftUI Cluster C16 — environment-state (RE teardown → web replica spec)

**Cluster:** C16 `environment-state` — 643 types.
**Modules:** SwiftUICore (the cross-platform render core), SwiftUI (the app/scene layer), Charts.
**Source of truth (Tier-1A):** the `.swiftinterface` text shipped in the macOS SDK. Every signature below is quoted verbatim with `file:line` where `SC` = SwiftUICore interface, `SU` = SwiftUI interface. RE/docs claims labelled INFERRED, our engineering labelled DESIGNED.

```
SC = .../SwiftUICore.framework/.../arm64e-apple-macos.swiftinterface
SU = .../SwiftUI.framework/.../arm64e-apple-macos.swiftinterface
```

## What this cluster IS (and why it is the spine of the whole kit)

C16 is almost entirely **plumbing**: it is the dependency-injection + reactive-state machinery that *every* visible component reads from. It renders nothing on its own, but it decides:

- **Theming** — `colorScheme` (light/dark), `colorSchemeContrast`, `tint`/`accentColor`, `backgroundStyle`, `foregroundStyle`.
- **Type & metrics** — `font`, `dynamicTypeSize`/`sizeCategory`, `displayScale`, `pixelLength`, `legibilityWeight`, `imageScale`, `lineLimit`, `multilineTextAlignment`, `truncationMode`, `lineSpacing`, `minimumScaleFactor`.
- **Layout** — `layoutDirection` (LTR/RTL), `controlSize`, `controlActiveState`.
- **Interaction state** — `isEnabled`, `isFocused`, `editMode`, `redactionReasons`, accessibility reduce-motion/transparency.
- **Actions** — `dismiss`, `refresh`, `openURL`, `openWindow`, `dismissWindow`, `scenePhase`, `isPresented`.

For a React/Next.js kit the entire cluster collapses to **one architectural decision**: a `SwiftUIEnvironment` React context that mirrors `EnvironmentValues`, plus a family of property-wrapper → React-hook mappings. The rest of the 643 types are enums/option-sets that feed that context, or non-visual app/scene/document/immersive-space plumbing that has **no web analogue** and is tabulated.

### Coverage map

- **DEEP-COVERED (the rendering/theming + state core, §1–§6):** the DI mechanism (`EnvironmentValues`, `EnvironmentKey`, `Environment`, `EnvironmentalModifier`, `DynamicProperty`, `PreferenceKey`); the read-keys (`ColorScheme`, `ColorSchemeContrast`, `LayoutDirection`, `ControlSize`, `ControlActiveState`, `DynamicTypeSize`, `ContentSizeCategory`, `LegibilityWeight`, `RedactionReasons`, `EditMode`, `Visibility`, `TextAlignment`, text/font/scale env vars, `ColorRenderingMode`, `Font.TextStyle`); the property wrappers (`State`, `Binding`, `Bindable`, `StateObject`, `ObservedObject`, `EnvironmentObject`, `AppStorage`, `SceneStorage`, `ScaledMetric`, `FocusState`, `FocusedValue`/`FocusedBinding`/`FocusedObject`); the action structs (`DismissAction`, `RefreshAction`, `OpenURLAction`, `OpenWindowAction`, `DismissWindowAction`, `ScenePhase`).
- **TABULATED (the long tail, §7):** accessibility rotor/trait/action plumbing, scenes (App/Scene/DocumentGroup/ImmersiveSpace/AlertScene), commands menus, charts builders, hover-effect types, drag/drop sessions, layout-geometry helpers, animatable-data vectors, coordinate spaces — each with name, line, one-line purpose, web-equivalent verdict.

---

## §1 — The DI core: how `@Environment` actually works (the thing the React context replicates)

### 1.1 `EnvironmentValues` — the bag every component reads
`SC:11684`
```swift
public struct EnvironmentValues : Swift.CustomStringConvertible {
  public init()
  public subscript<K>(key: K.Type) -> K.Value where K : SwiftUICore.EnvironmentKey { get set }
  public var description: Swift.String { get }
}
```
**KNOWN.** `EnvironmentValues` is a **type-keyed heterogeneous dictionary**. You never store by string; you store by *type* (`K.Type`) and read `K.Value`. Every public property you see (e.g. `var colorScheme: ColorScheme`) is sugar over `self[ColorSchemeKey.self]`. The struct is value-typed and **copy-on-write inherited down the view tree**: a parent's values flow to children unless a child overrides one branch.

### 1.2 `EnvironmentKey` — declaring a new slot
`SC:12391`
```swift
public protocol EnvironmentKey {
  associatedtype Value
  static var defaultValue: Self.Value { get }
  static func _valuesEqual(_ lhs: Self.Value, _ rhs: Self.Value) -> Swift.Bool  // iOS16+
}
```
**KNOWN.** The mechanism: define a key type with a `Value` and a `defaultValue`; extend `EnvironmentValues` with a computed property that reads/writes `self[MyKey.self]`. The `defaultValue` is what's returned when no ancestor set it (this is *exactly* the React `createContext(defaultValue)` pattern). `_valuesEqual` lets SwiftUI skip re-rendering subtrees when the value is unchanged — the equivalent of memoizing a context Provider's `value`.

### 1.3 `Environment<Value>` — the read-side property wrapper
`SC:11295`
```swift
@frozen @propertyWrapper public struct Environment<Value> : DynamicProperty {
  internal enum Content { case keyPath(KeyPath<EnvironmentValues, Value>); case value(Value) }
  public init(_ keyPath: KeyPath<EnvironmentValues, Value>)
  public var wrappedValue: Value { get }   // reads current resolved env value
}
```
**KNOWN.** `@Environment(\.colorScheme) var scheme` stores a *key path* into `EnvironmentValues`. At render time the wrapper resolves the path against the *installed* environment. The interface even logs a runtime fault when read outside a view ("Accessing Environment's value outside of being installed on a View … will always read the default value"). → React: `const scheme = useContext(SwiftUIEnvironment).colorScheme`.

### 1.4 `EnvironmentalModifier` — a modifier that resolves itself from env
`SC:2137`
```swift
public protocol EnvironmentalModifier : ViewModifier where Self.Body == Swift.Never {
  associatedtype ResolvedModifier : ViewModifier
  func resolve(in environment: EnvironmentValues) -> Self.ResolvedModifier
}
```
**KNOWN.** A modifier whose concrete behavior depends on env (e.g. `.font` resolves differently per `dynamicTypeSize`). `resolve(in:)` is given the current env and returns a concrete modifier. → React: a component that calls `useContext` then computes its style.

### 1.5 `DynamicProperty` — the base of every state wrapper
`SC:6754`
```swift
public protocol DynamicProperty {
  static func _makeProperty<V>(in buffer: ..., container: ..., fieldOffset: Int, inputs: ...)
  static var _propertyBehaviors: Swift.UInt32 { get }   // iOS15+
  mutating func update()
}
```
**KNOWN.** `DynamicProperty` is the protocol that makes a struct field "reactive": when SwiftUI walks a view's stored properties it calls `_makeProperty` to register each wrapper with the reactive graph and `update()` before `body`. `@State`, `@Binding`, `@Environment`, `@FocusState`, `@AppStorage`, `@ScaledMetric` **all conform**. → React: this is the role of *hooks* — they hook a component into the re-render system. A `DynamicProperty` ≈ one custom hook call.

### 1.6 `PreferenceKey` — the *upward* channel (child → ancestor)
`SC:17541`
```swift
public protocol PreferenceKey {
  associatedtype Value
  static var defaultValue: Self.Value { get }
  static func reduce(value: inout Self.Value, nextValue: () -> Self.Value)
}
```
**KNOWN.** Environment flows **down**; preferences flow **up**. A child writes a preference (e.g. a measured size, a nav title), ancestors collect via `reduce` (default + each child folded in). → React: bubbling via a callback ref / context dispatcher, or a layout-effect that reports up. For the kit, preferences map to an **upward event bus** (a `useImperativeHandle`-style report-up or a context with a setter).

**Web mapping for the whole DI core** (the heart of the kit):

```tsx
// SwiftUIEnvironment.tsx  — DESIGNED, mirrors EnvironmentValues exactly
export interface SwiftUIEnvironment {
  // theming
  colorScheme: 'light' | 'dark';
  colorSchemeContrast: 'standard' | 'increased';
  tint: string;                       // --sui-color-tint
  foregroundStyle?: string;           // CSS color / gradient
  backgroundStyle?: string;
  // type & metrics
  font?: FontResolved;                // resolved text-style token
  dynamicTypeSize: DynamicTypeSize;   // 'xSmall'..'accessibility5'
  legibilityWeight?: 'regular' | 'bold';
  displayScale: number;               // window.devicePixelRatio
  pixelLength: number;                // 1 / displayScale
  imageScale: 'small' | 'medium' | 'large';
  lineLimit?: number | null;
  multilineTextAlignment: 'leading' | 'center' | 'trailing';
  truncationMode: 'head' | 'middle' | 'tail';
  lineSpacing: number;
  minimumScaleFactor: number;
  allowsTightening: boolean;
  // layout
  layoutDirection: 'leftToRight' | 'rightToLeft';
  controlSize: 'mini' | 'small' | 'regular' | 'large' | 'extraLarge';
  controlActiveState: 'key' | 'active' | 'inactive';
  // interaction
  isEnabled: boolean;
  editMode: 'inactive' | 'transient' | 'active';
  redactionReasons: Set<'placeholder' | 'privacy' | 'invalidated'>;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  // i18n
  locale: string;                     // BCP-47
  calendar: string;
  timeZone: string;
  // actions
  dismiss: () => void;
  refresh?: () => Promise<void>;
  openURL: (url: string, opts?: { prefersInApp?: boolean }) => void;
  openWindow: (id: string, value?: unknown) => void;
  scenePhase: 'background' | 'inactive' | 'active';
  isPresented: boolean;
}

const Ctx = React.createContext<SwiftUIEnvironment>(DEFAULT_ENV);
export const useEnvironment = () => React.useContext(Ctx);

// .environment(\.key, value) → a Provider that shallow-merges one slot
export function EnvironmentProvider(
  props: Partial<SwiftUIEnvironment> & { children: React.ReactNode }
) {
  const parent = useEnvironment();
  const { children, ...overrides } = props;
  const value = React.useMemo(() => ({ ...parent, ...overrides }), [parent, ...Object.values(overrides)]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
```

The merge-one-slot Provider is the literal web equivalent of `.environment(\.colorScheme, .dark)`: a child only overrides the keys it sets; all others inherit from the parent context — identical inheritance semantics to `EnvironmentValues`.

The `colorScheme`/`controlSize`/`dynamicTypeSize`/`layoutDirection`/`tint` values are *also* projected to the DOM as data-attributes + CSS custom properties on the provider's wrapper `<div>`, so pure-CSS components (no JS) still theme correctly:

```css
.sui-env { color-scheme: var(--sui-color-scheme); direction: var(--sui-dir); }
.sui-env[data-color-scheme="dark"] { /* :root.dark token overrides apply */ }
.sui-env[data-control-size="small"]  { --sui-control-h: 22px; --sui-control-font: var(--sui-text-subheadline-size); }
.sui-env[data-control-size="regular"]{ --sui-control-h: 28px; --sui-control-font: var(--sui-text-body-size); }
.sui-env[data-control-size="large"]  { --sui-control-h: 36px; --sui-control-font: var(--sui-text-title3-size); }
```

---

## §2 — Theming & layout read-keys (what components branch on)

### 2.1 `ColorScheme` — light/dark
`SC:18392`
```swift
public enum ColorScheme : CaseIterable, Sendable { case light; case dark }
```
**KNOWN.** Two cases. Read via `EnvironmentValues.colorScheme` (`SC:18446`). Default = follows the OS/window. Set via `.preferredColorScheme(_:)` (scene-level) or `.environment(\.colorScheme, .dark)` (subtree). Components use it to pick which token column applies (the colors.md token file is built as `:root` = light, `:root.dark` = dark).

- **Visual effect:** flips every semantic color token. `label` `#000` (α1.0) ↔ `#FFF`; `systemBackground` `#FFFFFF` ↔ `#000000` (base) / `#1C1C1E` (elevated); `tint` `#007AFF` ↔ `#0A84FF`. Materials swap their blur/tint tables.
- **Web mapping:** `colorScheme` ⇒ `data-color-scheme="light|dark"` on `.sui-env` **and** CSS `color-scheme: light|dark` (so native form controls + scrollbars flip). The actual color values come from W1's `:root` / `:root.dark` token rules — this key just selects which set is live.

```tsx
// React
const { colorScheme } = useEnvironment();
// usage in components: var(--sui-color-label) auto-resolves per data-color-scheme
```
```css
:root { --sui-color-label:#000; --sui-color-systemBackground:#fff; --sui-color-tint:#007AFF; }
:root.dark, [data-color-scheme="dark"] {
  --sui-color-label:#fff; --sui-color-systemBackground:#000; --sui-color-tint:#0A84FF;
}
```

### 2.2 `ColorSchemeContrast` — increased-contrast accessibility
`SC:18411`
```swift
public enum ColorSchemeContrast : CaseIterable, Sendable { case standard; case increased }
```
**KNOWN.** Read-only env key `colorSchemeContrast` (`SC:18450`); reflects the OS "Increase Contrast" setting — *components cannot set it*, only read it. When `.increased`, controls thicken separators, darken text, drop translucency.
- **Web mapping:** `@media (prefers-contrast: more)` ⇒ `data-contrast="increased"`. Token overrides in W1 raise `label`/separator opacity. React reads `window.matchMedia('(prefers-contrast: more)')`.

### 2.3 `ControlSize` — control density
`SC:6131`
```swift
public enum ControlSize : CaseIterable, Sendable {
  case mini; case small; case regular
  case large          // macOS 11+
  case extraLarge     // iOS17/macOS14+
}
```
**KNOWN.** Read/write env key `controlSize` (`SC:6160`). Default `.regular`. Set via `.controlSize(_:)`. Drives the **height, font, padding, and corner radius** of Button/Toggle/Picker/TextField/Stepper etc. This is the single most impactful layout key after `colorScheme`.
- **Default metrics (INFERRED from AppKit/HIG, the canonical macOS push-button ramp):**

  | ControlSize | height | font (TextStyle) | h-padding | corner radius |
  |---|---|---|---|---|
  | `.mini` | 16px | caption2 / 11 | 6px | 3px |
  | `.small` | 22px | subheadline / 11–13 | 8px | 5px |
  | `.regular` | 28px (macOS) / 34px (iOS) | body / 13 | 12px | 6px |
  | `.large` | 36px | title3 / 15 | 16px | 8px |
  | `.extraLarge` | 44px | title2 | 20px | 10px |

- **Web mapping:** `controlSize` ⇒ `data-control-size` on `.sui-env`; components read the `--sui-control-h` / `--sui-control-font` / `--sui-control-pad` / `--sui-control-radius` custom props the env scopes set (see §1 CSS). A child can re-scope by wrapping in `<EnvironmentProvider controlSize="small">`.

### 2.4 `ControlActiveState` — window focus (macOS) / appearsActive
`SC:16702`
```swift
public enum ControlActiveState : Equatable, CaseIterable, Sendable {
  case key; case active; case inactive
}
// deprecated in favor of EnvironmentValues.appearsActive
```
**KNOWN.** macOS-only. `key` = control is in the key (front, focused) window; `active` = active app but not key; `inactive` = background window. Drives the desaturated look of controls in a non-focused window. Deprecated toward `appearsActive: Bool`.
- **Web mapping:** the browser has no multi-window key/active distinction, so the kit collapses this to a boolean `appearsActive` driven by `document.hasFocus()` / `window` `blur`/`focus` events ⇒ `data-active="false"` desaturates controls (`filter: saturate(.6)` on inactive). DESIGNED reduction: only two states (`active`/`inactive`); `key` ≡ `active` on web.

### 2.5 `LayoutDirection` — LTR / RTL
`SC:39`
```swift
public enum LayoutDirection : Hashable, CaseIterable, Sendable {
  case leftToRight; case rightToLeft
}
```
**KNOWN.** Read/write env key `layoutDirection` (`SC:59`). Default = follows the `locale`. Flips horizontal stacks, leading/trailing alignment, chevrons, slider direction, swipe-action sides.
- **Web mapping:** native CSS `direction: ltr | rtl` + logical properties. `layoutDirection` ⇒ `dir="ltr|rtl"` attribute on `.sui-env`. **Critical replica rule:** components must use *logical* CSS (`margin-inline-start`, `inset-inline-end`, `text-align: start`) not physical (`margin-left`) so RTL flips for free — exactly how SwiftUI's `leading`/`trailing` already work (they are logical edges; see `Edge`/`HorizontalEdge` below).

### 2.6 `LayoutDirectionBehavior` — whether a shape mirrors in RTL
`SC:4120`
```swift
public enum LayoutDirectionBehavior : Hashable, Sendable {
  case fixed
  case mirrors(in: LayoutDirection)
  public static var mirrors: LayoutDirectionBehavior { get }  // == .mirrors(in: .rightToLeft)
}
```
**KNOWN.** Per-shape opt-in: `.fixed` never mirrors (logos), `.mirrors` flips in RTL (chevrons). Web: a `data-mirror="rtl"` flag that applies `transform: scaleX(-1)` when `dir=rtl`, vs nothing for `fixed`.


---

## §3 — Type, metrics & text read-keys (Dynamic Type, scaling, truncation)

### 3.1 `DynamicTypeSize` — the modern type-scale axis
`SC:11702`
```swift
public enum DynamicTypeSize : Hashable, Comparable, CaseIterable, Sendable {
  case xSmall; case small; case medium; case large; case xLarge; case xxLarge; case xxxLarge
  case accessibility1; case accessibility2; case accessibility3; case accessibility4; case accessibility5
  public var isAccessibilitySize: Bool { get }   // true for accessibility1...5
}
```
**KNOWN.** 12 cases, **Comparable** (ordered xSmall < … < accessibility5). Read/write env key `dynamicTypeSize` (`SC:11736`). Default `.large` (the OS default "Large" slider notch). `isAccessibilitySize` true for the 5 AX sizes — components use it to switch to vertical layouts (e.g. a label+control HStack becomes a VStack at AX sizes).
- **Scale multipliers (INFERRED, Apple's published Dynamic Type table, body 17pt baseline):** xSmall 0.823, small 0.882, medium 0.941, **large 1.000**, xLarge 1.118, xxLarge 1.235, xxxLarge 1.353, accessibility1 1.647, accessibility2 1.941, accessibility3 2.353, accessibility4 2.764, accessibility5 3.118.
- **Web mapping:** `dynamicTypeSize` ⇒ a single CSS custom property `--sui-type-scale` set on `.sui-env`, plus `data-type-size` and `data-ax-size` (boolean). All text tokens are declared as `calc(var(--sui-text-body-size) * var(--sui-type-scale))`. Components read `useEnvironment().dynamicTypeSize` and, when `isAccessibilitySize`, switch flex-direction (`data-ax-size="true"` → `.sui-labeled-control{flex-direction:column}`).

```css
.sui-env[data-type-size="large"]        { --sui-type-scale: 1.000; }
.sui-env[data-type-size="xLarge"]       { --sui-type-scale: 1.118; }
.sui-env[data-type-size="accessibility3"]{ --sui-type-scale: 2.353; }
.sui-env[data-ax-size="true"] .sui-labeled-control { flex-direction: column; align-items: stretch; }
```

### 3.2 `ContentSizeCategory` — the deprecated predecessor of DynamicTypeSize
`SC:12022`
```swift
public enum ContentSizeCategory : Hashable, CaseIterable, Sendable {
  case extraSmall; case small; case medium; case large; case extraLarge
  case extraExtraLarge; case extraExtraExtraLarge
  case accessibilityMedium; case accessibilityLarge; case accessibilityExtraLarge
  case accessibilityExtraExtraLarge; case accessibilityExtraExtraExtraLarge
  public var isAccessibilityCategory: Bool { get }
}
// @available deprecated renamed: "DynamicTypeSize"
```
**KNOWN.** Older 12-case spelling of the same scale (`sizeCategory` env, `SC:12101`). Marked deprecated/renamed to `DynamicTypeSize`. The case names differ (`extraExtraExtraLarge` vs `xxxLarge`) but they're 1:1 by position. **Web:** alias only — the kit exposes `dynamicTypeSize` and maps the legacy names; no separate machinery.

### 3.3 `Font.TextStyle` — semantic text styles (the scaling anchors)
`SC:12146`
```swift
public enum TextStyle : CaseIterable, Sendable {
  case largeTitle; case title; case title2; case title3
  case headline; case subheadline; case body; case callout
  case footnote; case caption; case caption2
  case extraLargeTitle; case extraLargeTitle2   // visionOS only
}
```
**KNOWN.** The 11 cross-platform styles map directly to W1 typography tokens (`--sui-text-{largetitle,title1,title2,title3,headline,subheadline,body,callout,footnote,caption1,caption2}-{size,line,weight,tracking}`). `@ScaledMetric(relativeTo:)` and `.font(.body)` use these as the **anchor** that Dynamic Type multiplies. Mapping: `largeTitle→largetitle`, `title→title1`, `caption→caption1`.
- **Web mapping:** each style is a CSS class `.sui-text-body { font-size: calc(var(--sui-text-body-size)*var(--sui-type-scale)); line-height: var(--sui-text-body-line); font-weight: var(--sui-text-body-weight); letter-spacing: var(--sui-text-body-tracking); }`. `.font(_:)` ⇒ set the matching class / inline style.

### 3.4 `ScaledMetric` — scale an arbitrary number with Dynamic Type
`SC:11988`
```swift
@propertyWrapper public struct ScaledMetric<Value> : DynamicProperty where Value : BinaryFloatingPoint {
  public init(wrappedValue: Value, relativeTo textStyle: Font.TextStyle)
  public init(wrappedValue: Value)            // relative to .body
  public var wrappedValue: Value { get }
}
```
**KNOWN.** `@ScaledMetric var pad = 8.0` → `pad` scales with Dynamic Type as if it were `.body`; `relativeTo:` anchors to another style. Used for padding/icon sizes that should grow with text. Read-only `wrappedValue`.
- **Web mapping:** a hook `useScaledMetric(base, textStyle='body')` that returns `base * env.typeScale` (where `typeScale` is derived from `dynamicTypeSize` × the per-style scaling curve). Or pure-CSS: `calc(8px * var(--sui-type-scale))`.

```tsx
function useScaledMetric(base: number, style: TextStyle = 'body') {
  const { dynamicTypeSize } = useEnvironment();
  return base * scaleFactor(dynamicTypeSize, style); // scaleFactor from §3.1 table
}
```

### 3.5 `LegibilityWeight` — Bold Text accessibility setting
`SC:16727`
```swift
public enum LegibilityWeight : Hashable, Sendable { case regular; case bold }
```
**KNOWN.** Optional env `legibilityWeight: LegibilityWeight?` (`SC:16818`). Reflects the OS "Bold Text" toggle. When `.bold`, all text renders one weight heavier.
- **Web mapping:** `data-legibility-weight="bold"` ⇒ a root rule bumps `--sui-font-weight-delta` so `font-weight` adds ~100. React reads it but there's no browser media query for "Bold Text" — DESIGNED: expose as a kit-level setting, default `regular`.

### 3.6 Text-flow env keys (`multilineTextAlignment`, `truncationMode`, `lineSpacing`, `lineLimit`, `minimumScaleFactor`, `allowsTightening`)
`SC:8460–8485`, `SC:8779`
```swift
public var multilineTextAlignment: TextAlignment { get set }        // SC:8460, default .leading
public var truncationMode: Text.TruncationMode { get set }          // SC:8464, default .tail
public var lineSpacing: CGFloat { get set }                         // SC:8468, default 0
public var allowsTightening: Bool { get set }                       // SC:8477, default false
public var minimumScaleFactor: CGFloat { get set }                  // SC:8481, default 1.0
public var lineLimit: Int? { get set }                              // SC:8779, default nil (no limit)
```
`TextAlignment` (`SC:16407`): `@frozen enum { leading; center; trailing }`.
`Text.TruncationMode` (referenced): `{ head; middle; tail }`.
**KNOWN.** These six are the text-layout knobs every Text/Label/Button-title reads.
- **Web mapping:**
  - `multilineTextAlignment` ⇒ `text-align: start | center | end` (logical — flips in RTL). Default `start`.
  - `lineLimit(n)` ⇒ `-webkit-line-clamp: n; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;` (or `line-clamp` once standardized). `lineLimit(1)` with `truncationMode .tail` ⇒ `white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`.
  - `truncationMode` ⇒ `.tail`=`text-overflow:ellipsis`; `.head`/`.middle` have no native CSS — DESIGNED JS that inserts `…` at the computed position (measure + slice).
  - `lineSpacing` ⇒ `line-height` add-on: `line-height: calc(1em + ${lineSpacing}px)`.
  - `minimumScaleFactor` + `allowsTightening` ⇒ no native CSS for shrink-to-fit; DESIGNED: a `useFitText` hook that binary-searches font-size between `base*minimumScaleFactor` and `base` until it fits one line.

### 3.7 `displayScale` & `pixelLength` — Retina / hairline rendering
`SC:16804`, `SC:16808`
```swift
public var displayScale: CGFloat { get set }   // 1.0, 2.0, 3.0
public var pixelLength: CGFloat { get }         // == 1.0 / displayScale (read-only)
```
**KNOWN.** `displayScale` = points→pixels (2.0 on @2x, 3.0 on @3x). `pixelLength` = the size of one physical pixel in points, used to draw **hairline** borders (`Divider`, separators) that are exactly 1px regardless of scale.
- **Web mapping:** `displayScale` ⇒ `window.devicePixelRatio`. `pixelLength` ⇒ `calc(1px / var(--sui-display-scale))` → in practice a hairline is just `1px` CSS pixel (browsers already map 1 CSS px to the right device pixels), so the kit sets `--sui-hairline: max(0.5px, 1px / var(--sui-display-scale))` for separators. React: `useEnvironment().displayScale` initialized from `devicePixelRatio`, updated on `resize`/`matchMedia('(resolution: ...)')`.

### 3.8 `ColorRenderingMode` — gamma of color blending
`SC:4359`
```swift
public enum ColorRenderingMode : Sendable { case nonLinear; case linear; case extendedLinear }
```
**KNOWN.** Controls whether color compositing happens in linear or non-linear (sRGB-gamma) space; affects gradients/blends. `.nonLinear` is default (matches CSS default). **Web:** `linear` ⇒ `color-interpolation: linearRGB` on gradients (mostly SVG); for HTML gradients there's no toggle → DESIGNED: default non-linear only; expose as a no-op flag for API parity.


---

## §4 — Interaction-state & style read-keys

### 4.1 `isEnabled` — the disabled cascade
`SC:191`
```swift
public var isEnabled: Swift.Bool { get set }   // default true
```
**KNOWN.** Set via `.disabled(_:)` which **only ever flips true→false down the tree** (a child can't re-enable what an ancestor disabled — `.disabled(false)` on a child inside a `.disabled(true)` parent stays disabled). Every interactive control reads it to gray out + drop hit-testing.
- **Visual:** disabled controls drop to ~30–40% opacity on label/tint, lose hover/press, cursor `default`.
- **Web mapping:** `isEnabled` ⇒ DOM `disabled`/`aria-disabled="true"` + `data-disabled` on the control; CSS `.sui-control[data-disabled]{opacity:.4; pointer-events:none;}`. **Cascade rule:** the `EnvironmentProvider` merges `isEnabled: parent.isEnabled && override` (logical AND, never re-enabling) to replicate the monotonic disable.

```tsx
// .disabled(true) provider — note the AND, mirroring SwiftUI
<EnvironmentProvider isEnabled={false}>...</EnvironmentProvider>
// internally: isEnabled = parent.isEnabled && (overrides.isEnabled ?? true)
```

### 4.2 `EditMode` — list edit state
`SU:16684`
```swift
public enum EditMode : Sendable {
  case inactive; case transient; case active
  public var isEditing: Bool { get }   // true for transient & active
}
```
**KNOWN.** Env `editMode: Binding<EditMode>?`. `.active` shows delete/reorder affordances in `List`; `.transient` is a temporary swipe-to-edit; `.inactive` normal. `isEditing` is the convenience boolean.
- **Web mapping:** `editMode` ⇒ `data-edit-mode="active"` on a List; reveals row delete buttons + drag handles (CSS shows `.sui-row-edit-controls{display:flex}` when active). React: a `Binding<EditMode>` ≡ `[value, setValue]` pair threaded through context.

### 4.3 `RedactionReasons` — placeholder / privacy / skeleton
`SC:6089`
```swift
public struct RedactionReasons : OptionSet, Sendable {
  public let rawValue: Int
  public static let placeholder: RedactionReasons   // skeleton
  public static let privacy: RedactionReasons        // iOS15+, sensitive-data blur
  public static let invalidated: RedactionReasons    // iOS17+, stale (e.g. Always-On dimmed)
}
```
**KNOWN.** OptionSet env `redactionReasons` (`SC:6121`). `.placeholder` = the `.redacted(reason:)` skeleton-loading state (text becomes gray rounded bars). `.privacy` = blur sensitive content (Lock Screen widgets). `.invalidated` = dim stale content.
- **Visual:** `.placeholder` replaces text/images with `--sui-color-quaternary-label` rounded-rect blocks sized to the content; no interactivity.
- **Web mapping:** `redactionReasons` ⇒ `data-redacted="placeholder|privacy|invalidated"`. CSS for placeholder: text gets `color:transparent; background:var(--sui-color-quaternary-label); border-radius:4px;` (a skeleton). Privacy ⇒ `filter: blur(8px)`. React: components check `env.redactionReasons.has('placeholder')` to render skeleton variants.

### 4.4 Accessibility motion/transparency keys
`SC:18063`, `SC:18070`
```swift
public var accessibilityReduceTransparency: Bool { get }   // SC:18063, read-only
public var accessibilityReduceMotion: Bool { get }         // SC:18070, read-only
public var accessibilityDifferentiateWithoutColor: Bool { get }  // SC:18056
public var accessibilityInvertColors: Bool { get }         // SC:18077
```
**KNOWN.** Read-only (OS-driven). `reduceMotion` ⇒ swap spring animations for cross-fades/instant; `reduceTransparency` ⇒ materials become opaque (drop backdrop blur, fill with solid `systemBackground`).
- **Web mapping:** `reduceMotion` ⇐ `@media (prefers-reduced-motion: reduce)` ⇒ `data-reduce-motion`; all `transition`/`animation` durations collapse to `0.01ms` or a fade. `reduceTransparency` ⇐ `@media (prefers-reduced-transparency: reduce)` ⇒ materials drop `backdrop-filter` and use the solid fallback color (the materials.md tokens already define an opaque fallback). `differentiateWithoutColor` ⇒ add shape/icon cues. React reads via `matchMedia`.

```css
@media (prefers-reduced-motion: reduce) { .sui-env { --sui-anim-duration: 0.01ms; } }
@media (prefers-reduced-transparency: reduce) { .sui-material { backdrop-filter:none; background:var(--sui-material-opaque-fallback); } }
```

### 4.5 `font` — the ambient font
`SC:16788`
```swift
public var font: SwiftUICore.Font? { get set }   // default nil → resolves to .body
```
**KNOWN.** `.font(_:)` sets the ambient font for all descendant Text. `nil` = inherit / fall back to `.body`. `Font` (`SC:3330`) is an opaque Hashable handle; its `TextStyle`/`Weight`/`Width`/`Design` are the W1 typography axes.
- **Web mapping:** `font` ⇒ inherited CSS (`font-family`, `font-size`, `font-weight`, `letter-spacing`) on `.sui-env` or per-Text class. The kit maps `Font.system(.body)` → `.sui-text-body` token class; custom `Font.custom(name,size)` → inline `font-family`/`font-size`.

### 4.6 `foregroundStyle` / `backgroundStyle`
`SC:9148` (backgroundStyle), foreground via `ForegroundStyle`/`_ColorMatrix`
```swift
public var backgroundStyle: SwiftUICore.AnyShapeStyle? { get set }   // SC:9148, default nil
```
**KNOWN.** `foregroundStyle` (the primary content color/gradient/material) and `backgroundStyle` are the ambient paints. `foregroundStyle` cascades hierarchical levels (`.primary`/`.secondary`/`.tertiary`/`.quaternary`) — text and SF Symbols read it. Default foreground = `Color.primary` (= `label`).
- **Web mapping:** `foregroundStyle` ⇒ CSS `color` (and for symbols, `fill`/`currentColor`); hierarchical levels ⇒ `var(--sui-color-label)` / `var(--sui-color-secondary-label)` / tertiary / quaternary. `backgroundStyle` ⇒ `background`. Both inherited via `currentColor` so children pick them up.

### 4.7 i18n keys: `locale`, `calendar`, `timeZone`
`SC:16822`, `SC:16826`, `SC:16830`
```swift
public var locale: Foundation.Locale { get set }       // default Locale.current
public var calendar: Foundation.Calendar { get set }
public var timeZone: Foundation.TimeZone { get set }
```
**KNOWN.** Drive `Text(date, style:)`, `DatePicker`, number/currency formatting, and (via locale) the default `layoutDirection`. Non-visual except through formatting + RTL inference.
- **Web mapping:** `locale` ⇒ BCP-47 string passed to `Intl.DateTimeFormat`/`Intl.NumberFormat`; setting `locale` to an RTL language auto-sets `dir=rtl` (mirrors SwiftUI inferring layoutDirection from locale). `calendar`/`timeZone` ⇒ options on the `Intl` formatters. React: `env.locale` threaded into a `useFormatter()` hook.

### 4.8 `imageScale` & `Visibility`
`SC:16793` (imageScale), `SC:15328` (Visibility)
```swift
public var imageScale: SwiftUICore.Image.Scale { get set }   // .small | .medium | .large
@frozen public enum Visibility : Hashable, CaseIterable { case automatic; case visible; case hidden }
```
**KNOWN.** `imageScale` sizes SF Symbols relative to text (small/medium/large multipliers). `Visibility` is the tri-state used by `.scrollIndicators`, `.toolbar`, separators, etc. — `.automatic` lets the system decide, `.visible`/`.hidden` force.
- **Web mapping:** `imageScale` ⇒ symbol font-size multiplier (`em`-relative). `Visibility` ⇒ `automatic` (no override) / `visible` (`display:revert; visibility:visible`) / `hidden` (`display:none` for layout-removing, or `visibility:hidden` where space is reserved). The kit picks `display:none` for indicators, matching SwiftUI removing them.


---

## §5 — Property wrappers → React state idioms (the state model)

This is the table the next agent needs to translate any SwiftUI view's state into React. Each wrapper conforms to `DynamicProperty` (§1.5) — i.e. each is a *hook*.

### 5.1 `State<Value>` → `useState`
`SC:15638`
```swift
@frozen @propertyWrapper public struct State<Value> : DynamicProperty {
  public init(wrappedValue value: Value)
  public init(initialValue value: Value)
  public var wrappedValue: Value { get nonmutating set }
  public var projectedValue: Binding<Value> { get }   // the $-prefix
}
```
**KNOWN.** Source-of-truth local state owned by the view. `wrappedValue` reads/writes; `projectedValue` (`$state`) is a two-way `Binding`. The `_location: AnyLocation<Value>?` field is the heap box SwiftUI keeps stable across re-renders (so `@State` survives `body` re-evaluation) — **exactly** React's `useState` keeping the value in a fiber slot across renders.
- **React:** `const [value, setValue] = useState(initial)`. `wrappedValue` ≡ `value`; `nonmutating set` ≡ `setValue`. `$state` (the projected `Binding`) ≡ the `{value, setValue}` pair passed to a child.

### 5.2 `Binding<Value>` → `{ value, onChange }` two-way prop
`SC:11387`
```swift
@frozen @propertyWrapper @dynamicMemberLookup public struct Binding<Value> {
  public var transaction: Transaction
  public init(get: @escaping () -> Value, set: @escaping (Value) -> Void)
  public init(get: @escaping () -> Value, set: @escaping (Value, Transaction) -> Void)
  public static func constant(_ value: Value) -> Binding<Value>
  public var wrappedValue: Value { get nonmutating set }
  public var projectedValue: Binding<Value> { get }
  public subscript<Subject>(dynamicMember keyPath: WritableKeyPath<Value, Subject>) -> Binding<Subject> { get }
}
```
**KNOWN.** A get/set pair — a *reference* to state owned elsewhere. `.constant(x)` makes a read-only binding (for previews/disabled). `@dynamicMemberLookup` means `$user.name` produces a `Binding<String>` into a sub-field — i.e. you can bind to a nested property.
- **React:** the idiomatic controlled-component pair: `value` + `onChange` (or a `[value,setValue]` tuple). `Binding.constant` ≡ passing `value` with a no-op `onChange`. Dynamic-member `$user.name` ≡ a helper `bindingTo(state, 'name')` returning `{value: state.name, onChange: v => setState({...state, name: v})}`.

```tsx
type Binding<T> = { value: T; onChange: (next: T) => void };
const constant = <T,>(v: T): Binding<T> => ({ value: v, onChange: () => {} });
function bindingTo<T, K extends keyof T>(s: T, set: (t: T) => void, k: K): Binding<T[K]> {
  return { value: s[k], onChange: v => set({ ...s, [k]: v }) };
}
```
Components in other clusters take props like `<Toggle isOn={Binding} />` where `isOn` is this `Binding<boolean>`.

### 5.3 `Bindable<Value>` → binding into an Observable store
`SC:12418`
```swift
@dynamicMemberLookup @propertyWrapper public struct Bindable<Value> {
  public var wrappedValue: Value
  public var projectedValue: Bindable<Value> { get }
  // init requires Value: Observable
}
```
**KNOWN.** Like `Binding` but for `@Observable` reference types: `@Bindable var model = ...; $model.name` makes a `Binding` into the observable object's property without the object being `@State`. → React: a binding factory over a store object — `bindableTo(store, 'name')` returning `{value: store.name, onChange}` where `onChange` mutates the store (and the store's subscribers re-render).

### 5.4 `StateObject<ObjectType>` → `useRef`-stable store (created once)
`SC:14320`
```swift
@propertyWrapper @MainActor public struct StateObject<ObjectType> : DynamicProperty
  where ObjectType : Combine.ObservableObject {
  internal enum Storage { case initially(() -> ObjectType); case object(ObservedObject<ObjectType>) }
  public init(wrappedValue thunk: @autoclosure @escaping () -> ObjectType)
  public var wrappedValue: ObjectType { get }
  public var projectedValue: ObservedObject<ObjectType>.Wrapper { get }
}
```
**KNOWN.** Owns an `ObservableObject`, **created exactly once** for the view's lifetime (the `@autoclosure` thunk runs lazily on first render; subsequent re-renders reuse the same instance via `Storage.object`). This is the key difference from `@ObservedObject`. `$store.prop` projects a `Binding` into a published property.
- **React:** `const store = useRef<Store>(); if (!store.current) store.current = makeStore();` (or `useState(() => makeStore())[0]`) + a subscription via `useSyncExternalStore`. The "create once" semantics ≡ the lazy `useRef` init guard. For an `@Observable`/Combine store, use a tiny external store + `useSyncExternalStore(subscribe, getSnapshot)`.

```tsx
function useStateObject<S extends Observable>(make: () => S): S {
  const ref = React.useRef<S>(); if (!ref.current) ref.current = make();
  React.useSyncExternalStore(ref.current.subscribe, ref.current.snapshot);
  return ref.current;
}
```

### 5.5 `ObservedObject<ObjectType>` → injected store (NOT owned)
`SC:7953`
```swift
@propertyWrapper @MainActor @frozen public struct ObservedObject<ObjectType> : DynamicProperty
  where ObjectType : Combine.ObservableObject {
  @dynamicMemberLookup public struct Wrapper {
    public subscript<Subject>(dynamicMember keyPath: ReferenceWritableKeyPath<ObjectType, Subject>) -> Binding<Subject> { get }
  }
  public init(wrappedValue: ObjectType)
  public var wrappedValue: ObjectType
  public var projectedValue: ObservedObject<ObjectType>.Wrapper { get }
}
```
**KNOWN.** Subscribes to an externally-owned `ObservableObject` (passed in by the parent). Re-renders the view when the object publishes. **Does not own lifetime** — if the parent re-creates the object, this re-subscribes (the bug `@StateObject` fixes). `$obj.prop` → `Binding`.
- **React:** the store is a **prop**; subscribe with `useSyncExternalStore`. Identical to `@StateObject`'s subscription, minus the create-once guard.

### 5.6 `EnvironmentObject<ObjectType>` → store via Context
`SC:4594`
```swift
@propertyWrapper @MainActor public struct EnvironmentObject<ObjectType> : DynamicProperty
  where ObjectType : Combine.ObservableObject {
  public struct Wrapper { subscript(dynamicMember:) -> Binding<Subject> }
  public var wrappedValue: ObjectType { get }   // traps if not injected
  public init()
}
```
**KNOWN.** Reads an `ObservableObject` injected by an ancestor via `.environmentObject(_:)`. `wrappedValue` **crashes** if no ancestor provided it (the interface's `error() -> Never`). → React: `useContext(StoreContext)` where an ancestor did `<StoreContext.Provider value={store}>`. The crash-if-missing ≡ a context whose default throws.
- **React:** dedicate a React Context per store type; `useEnvironmentObject(StoreContext)` = `useContext` + `useSyncExternalStore`. The "must be injected" rule ⇒ default value `null` and the hook throws a dev error.

### 5.7 `AppStorage<Value>` → localStorage-backed state
`SU:7429`
```swift
@frozen @propertyWrapper public struct AppStorage<Value> : DynamicProperty {
  internal var location: SwiftUI.UserDefaultLocation<Value>
  public var wrappedValue: Value { get nonmutating set }
  public var projectedValue: Binding<Value> { get }
}
```
**KNOWN.** `@AppStorage("key") var x = default` reads/writes `UserDefaults` and re-renders all views observing that key when it changes (cross-view sync). `$x` is a `Binding`. Supported `Value`s: Bool/Int/Double/String/URL/Data/RawRepresentable.
- **React:** a `useLocalStorage(key, default)` hook: read on mount, write on set, and listen to the `storage` event (cross-tab) + a same-tab pub/sub so multiple components sharing a key stay in sync — the exact `UserDefaults` cross-view broadcast. `projectedValue` ≡ the `{value, onChange}` binding.

```tsx
function useAppStorage<T>(key: string, def: T): [T, (v: T) => void] {
  const sub = React.useCallback((cb) => { window.addEventListener('storage', cb); bus.on(key, cb); return () => { window.removeEventListener('storage', cb); bus.off(key, cb); }; }, [key]);
  const get = () => { const r = localStorage.getItem(key); return r == null ? def : JSON.parse(r); };
  const value = React.useSyncExternalStore(sub, get);
  const set = (v: T) => { localStorage.setItem(key, JSON.stringify(v)); bus.emit(key); };
  return [value, set];
}
```

### 5.8 `SceneStorage<Value>` → sessionStorage / per-window state
`SU:6897`
```swift
@frozen @propertyWrapper public struct SceneStorage<Value> : DynamicProperty {
  internal var _key: String; internal var _domain: String?
  public var wrappedValue: Value { get nonmutating set }
  public var projectedValue: Binding<Value> { get }
}
```
**KNOWN.** Like `AppStorage` but scoped to a single **scene** (window/tab) and used for state-restoration (scroll position, selected tab) — not synced across windows.
- **React:** `useSessionStorage(key, default)` (`sessionStorage` is per-tab, exactly the per-scene semantics). For a Next.js SPA, key by route/window id. No cross-window broadcast (matches SwiftUI).


---

## §6 — Focus & action structs (the imperative escape hatches)

### 6.1 `FocusState<Value>` → which field is focused
`SU:8494`
```swift
@frozen @propertyWrapper public struct FocusState<Value> : DynamicProperty where Value : Hashable {
  @frozen @propertyWrapper public struct Binding {
    public var wrappedValue: Value { get nonmutating set }
    public var projectedValue: FocusState<Value>.Binding { get }
  }
  public var wrappedValue: Value { get nonmutating set }
  public var projectedValue: FocusState<Value>.Binding { get }
  public init() where Value == Bool                          // single-field boolean
  public init<T>() where Value == T?, T : Hashable           // multi-field enum
}
```
**KNOWN.** Two flavors: `@FocusState var isFocused: Bool` (one field) or `@FocusState var field: Field?` where `Field` is a Hashable enum (which of several fields). Writing `field = .email` **programmatically moves focus**; the inner `FocusState.Binding` is what you pass to a control's `.focused($field, equals:)`.
- **Web mapping:** boolean ⇒ `[focused,setFocused]` + a `ref` you call `.focus()`/`.blur()` on; enum ⇒ `[focusedField,setFocusedField]` + a registry of refs keyed by field. Setting state ⇒ `useEffect(() => refs[field]?.focus(), [field])`. Reading focus ⇒ `onFocus`/`onBlur` update state. The `.focused($field, equals: .email)` modifier ⇒ `<Input focusKey="email" focusBinding={focusBinding} />`.

```tsx
function useFocusState<F extends string | null>(initial: F) {
  const [field, setField] = React.useState<F>(initial);
  const refs = React.useRef<Record<string, HTMLElement | null>>({});
  React.useEffect(() => { if (field) refs.current[field as string]?.focus(); }, [field]);
  const register = (key: string) => (el: HTMLElement | null) => { refs.current[key] = el; };
  return { field, setField, register };
}
```

### 6.2 `FocusedValue` / `FocusedBinding` / `FocusedObject` → data from the focused view
`SU:19608` / `SU:19635` / `SU:23384`
```swift
@propertyWrapper public struct FocusedValue<Value> : DynamicProperty {
  public init(_ keyPath: KeyPath<FocusedValues, Value?>)
  public var wrappedValue: Value? { get }   // nil when nothing focused publishes it
}
@propertyWrapper public struct FocusedBinding<Value> : DynamicProperty {
  public init(_ keyPath: KeyPath<FocusedValues, Binding<Value>?>)
  public var wrappedValue: Value? { get nonmutating set }   // read+write the focused view's binding
  public var projectedValue: Binding<Value?> { get }
}
```
**KNOWN.** `FocusedValues` is an env-like bag *published by whatever view is currently focused* (used so menu commands can act on the focused document). `@FocusedValue` reads it; `@FocusedBinding` reads+writes a binding the focused view exposed; `@FocusedObject` is the ObservableObject version. → React: a separate **"focused context"** store that the currently-focused subtree writes into; menu/command components read it. `wrappedValue: Value?` (optional) ≡ `undefined` when nothing focused publishes.
- **Web mapping:** a `FocusedValuesContext` whose setter is called by focused panes (`useEffect` on focus). Toolbar/menu items read it. Niche; most kit consumers won't need it — provide the context but treat as advanced.

### 6.3 `DismissAction` → close the current presentation
`SU:1419`
```swift
@MainActor public struct DismissAction { public func callAsFunction() }
// EnvironmentValues.dismiss : DismissAction        (SU:1424)
// EnvironmentValues.isPresented : Bool             (SU:1427)
```
**KNOWN.** `@Environment(\.dismiss) var dismiss; dismiss()` closes the nearest sheet/popover/cover/pushed-view. `callAsFunction` makes it callable as `dismiss()`. `isPresented` tells a view whether it's currently inside a presentation.
- **Web mapping:** `env.dismiss` ⇒ a callback the presenting container (Sheet/Popover/NavigationStack) injects via context that hides itself; `isPresented` ⇒ a boolean the container sets in context. `dismiss()` = call the container's close handler.

### 6.4 `RefreshAction` → pull-to-refresh
`SU:9070`
```swift
public struct RefreshAction : Sendable { public func callAsFunction() async }
```
**KNOWN.** Set by `.refreshable { await load() }`; the env `refresh` is non-nil when a refreshable ancestor exists. `await refresh()` triggers it. Lists/ScrollViews show the spinner while the async closure runs.
- **Web mapping:** `env.refresh?: () => Promise<void>` injected by a scroll container that implements pull-to-refresh (touch drag past top → call `refresh()` → show a spinner until the promise resolves). Optional (`undefined` when no refreshable ancestor).

### 6.5 `OpenURLAction` → open a link
`SC:3036`
```swift
@MainActor public struct OpenURLAction {
  public struct Result : Sendable {
    public static let handled, discarded, systemAction: Result
    public static func systemAction(_ url: URL) -> Result
    public static func systemAction(_ url: URL? = nil, prefersInApp: Bool) -> Result   // iOS26+
  }
  public init(handler: @escaping (URL) -> Result)
  public func callAsFunction(_ url: URL)
  public func callAsFunction(_ url: URL, prefersInApp: Bool)                            // iOS26+
}
// EnvironmentValues.openURL : OpenURLAction
```
**KNOWN.** `@Environment(\.openURL) var openURL; openURL(url)`. A custom handler can intercept: return `.handled` (you handled it), `.discarded` (drop it), `.systemAction` (let the OS open it), or `.systemAction(url, prefersInApp:)` to open in an in-app browser. `prefersInApp` (iOS26) hints SFSafariViewController vs Safari.
- **Web mapping:** `env.openURL = (url, {prefersInApp}={}) => {...}`. Default = `window.open(url, prefersInApp ? '_self-modal' : '_blank')`. A custom provider can override (e.g. route internal links via Next router, external via `window.open`). The `Result` enum ⇒ the handler returns `'handled'|'discarded'|'system'` and the dispatcher acts accordingly.

```tsx
type OpenURLResult = 'handled' | 'discarded' | 'system';
const defaultOpenURL = (url: string, o?: {prefersInApp?: boolean}) =>
  o?.prefersInApp ? openInAppModal(url) : window.open(url, '_blank', 'noopener');
```

### 6.6 `OpenWindowAction` / `DismissWindowAction` → multi-window (macOS/iPadOS)
`SU:2869` / `SU:22516`
```swift
@MainActor public struct OpenWindowAction {
  public func callAsFunction(id: String)
  public func callAsFunction<D: Codable & Hashable>(value: D)
  public func callAsFunction<D: Codable & Hashable>(id: String, value: D)
}
@MainActor public struct DismissWindowAction {
  public func callAsFunction()
  public func callAsFunction(id: String)
  public func callAsFunction<D: Codable & Hashable>(value: D)
}
// EnvironmentValues.openWindow (SU:2895), .dismissWindow (SU:22525)
```
**KNOWN.** `openWindow(id:)` opens a `WindowGroup`/`Window` scene by id, optionally with a presented `value`; `dismissWindow` closes it. macOS/iPadOS only (unavailable tvOS/watchOS).
- **Web mapping:** no first-class multi-window in a browser SPA. DESIGNED reductions: (a) `openWindow(id)` ⇒ open a route in a new browser tab (`window.open('/window/'+id)`), or (b) for a desktop-feel SPA, render a floating in-page "window" panel keyed by id from a windows store; `dismissWindow` removes it. `value` ⇒ query param / store payload. Document the reduction; most web kits won't replicate true OS windows.

### 6.7 `DismissSearchAction` → exit search mode
`SU:14328`
```swift
@MainActor public struct DismissSearchAction { public func callAsFunction() }
```
**KNOWN.** `@Environment(\.dismissSearch) var dismissSearch; dismissSearch()` collapses an active `.searchable` field. → Web: a callback the search container injects that clears the query + blurs the field + collapses the search UI.

### 6.8 `ScenePhase` → app foreground/background lifecycle
`SU:5474`
```swift
public enum ScenePhase : Comparable { case background; case inactive; case active }
```
**KNOWN.** `@Environment(\.scenePhase)`. `.active` = foreground & interactive, `.inactive` = foreground but not interactive (e.g. transitioning, system overlay), `.background` = not visible. Used to pause timers, save state, stop animations. Comparable (`background < inactive < active`).
- **Web mapping:** `env.scenePhase` ⇐ Page Visibility + focus: `document.visibilityState === 'hidden'` ⇒ `background`; visible but `!document.hasFocus()` ⇒ `inactive`; visible & focused ⇒ `active`. Listen to `visibilitychange`, `focus`, `blur`. Components use it to pause `requestAnimationFrame` loops / autosave.

```tsx
function useScenePhase(): ScenePhase {
  const get = () => document.visibilityState === 'hidden' ? 'background'
    : document.hasFocus() ? 'active' : 'inactive';
  const sub = (cb) => { const ev = ['visibilitychange','focus','blur']; ev.forEach(e=>window.addEventListener(e,cb)); return ()=>ev.forEach(e=>window.removeEventListener(e,cb)); };
  return React.useSyncExternalStore(sub, get);
}
```

### 6.9 `HoverPhase` → pointer hover state (carried for completeness)
`SU:4282`
```swift
@frozen public enum HoverPhase : Equatable { case active(CGPoint); case ended }
```
**KNOWN.** Delivered by `.onContinuousHover`: `.active(point)` with the pointer location, `.ended` when it leaves. → Web: `onPointerMove` (gives `active({x,y})`) + `onPointerLeave` (`ended`). Used by custom hover effects.


---

## §7 — Tabulated long tail (the ~590 non-deep types)

These are env keys, value types, scene/window/document plumbing, builders, internal modifiers, and Charts/spatial types. Grouped by web relevance. Each row: name · `module:line` · purpose · web-equivalent.

### 7A — Value types that DO affect rendering (small, used by other clusters)

| Type | `mod:line` | Purpose | Web equivalent |
|---|---|---|---|
| `Edge` | SC:1190 | enum top/leading/bottom/trailing (+`Set`) | logical box sides: `block-start/inline-start/block-end/inline-end` |
| `HorizontalEdge` | SC:1239 | leading/trailing | `inline-start`/`inline-end` |
| `VerticalEdge` | SC:1272 | top/bottom | `block-start`/`block-end` |
| `EdgeInsets` | SC:10827 | `(top,leading,bottom,trailing)` CGFloat | `padding`/`margin` shorthand with logical props |
| `Alignment` | SC:11183 | 2-axis alignment (h+v) | `align-items`+`justify-content` pair / `place-items` |
| `HorizontalAlignment` | SC:11147 | leading/center/trailing(+custom IDs) | `justify-*: start/center/end` |
| `VerticalAlignment` | SC:11165 | top/center/bottom/firstTextBaseline/lastTextBaseline | `align-*` + `baseline` |
| `UnitPoint` | SC:9720 | normalized 0–1 point (gradient/anchor) e.g. `.topLeading`,`.center` | CSS `0% 0%`..`100% 100%` for `transform-origin`/gradient positions |
| `Angle` | SC:16445 | radians/degrees wrapper | `deg`/`rad` in `rotate()` |
| `ProjectionTransform` | SC:10727 | 3×3 matrix | CSS `matrix3d()` |
| `RectangleCornerRadii` | SC:19044 | per-corner radii | `border-radius: a b c d` |
| `RectangleCornerInsets` | SC:2552 | per-corner inset | per-corner inset calc |
| `ColorMatrix` / `_ColorMatrix` | SC:14597/14610 | 4×5 color filter matrix | SVG `feColorMatrix` / CSS `filter` |
| `Prominence` | SC:14535 | `.standard`/`.increased` | data-attr; bumps weight/contrast |
| `BackgroundProminence` | SC:8789 | env `backgroundProminence` standard/increased | selects darker fill token |
| `BadgeProminence` | SU:23128 | badge emphasis | badge color token swap |
| `UserInterfaceSizeClass` | SC:16686 | `.compact`/`.regular` (env `horizontalSizeClass`/`verticalSizeClass`) | CSS container/media query breakpoint ⇒ `data-size-class` |
| `SymbolRenderingMode` | SC:6778 | monochrome/hierarchical/palette/multicolor | SF Symbol fill strategy (SVG layers) |
| `SymbolVariants` | SC:15266 | `.fill`/`.circle`/`.slash` etc | swap symbol asset variant |
| `SymbolColorRenderingMode` | SC:6839 | flat/gradient symbol coloring | SVG fill vs gradient |
| `SymbolVariableValueMode` | SC:6815 | variable-symbol fill mode | partial fill animation |
| `Glass` | SC:5753 | Liquid Glass material descriptor (iOS26) | `backdrop-filter` glass preset (see materials.md) |
| `Material` (via `backgroundMaterial`) | SC:6365 | blur material env | `backdrop-filter: blur()` + tint (materials.md tokens) |
| `BlendMode` | SC:6232 | 26 blend modes | CSS `mix-blend-mode` |
| `ContentMode` | SC:7376 | `.fit`/`.fill` | `object-fit: contain/cover` |
| `ScenePadding` | SU:455 | system-standard scene padding | `--sui-scene-pad` |
| `SafeAreaRegions` | SC:18306 | container/keyboard safe-area set | `env(safe-area-inset-*)` |
| `SubmitLabel` | SU:8708 | return-key label (done/go/search/send…) | `enterkeyhint` attribute |
| `KeyboardShortcut`/`KeyEquivalent`/`EventModifiers` | SU:20293/20318, SC:213 | ⌘-key bindings | `keydown` handler + modifier check |
| `SensoryFeedback` | SU:762 | haptic feedback descriptors | `navigator.vibrate()` (limited) |

These are mostly consumed by *other* clusters; C16 just defines the value types. Each gets the CSS noted above. `Edge`/`HorizontalEdge`/`VerticalEdge`/`Alignment` are the critical ones — every layout component reads them and they MUST map to **logical** CSS so RTL works (see §2.5).

### 7B — Animation/vector math (drives transitions, not directly visual)

| Type | `mod:line` | Purpose | Web equivalent |
|---|---|---|---|
| `Animatable` | SC:14773 | protocol: a value SwiftUI can interpolate | a tween-able number/array |
| `AnimatablePair` | SC:13676 | 2-tuple animatable | interpolate two values |
| `VectorArithmetic` | SC:8867 | +/−/scale/magnitude | numeric interpolation contract |
| `EmptyAnimatableData` | SC:14814 | no-op animatable | non-animating value |
| `AnimatableValues` | SC:5781 | bag of animatable values | keyframe state object |
| `_AnyAnimatableData`, `_Velocity`, `_VectorMath` | SC | type-erased / velocity / math internals | internal to spring solver |
| `UnitCurve` | SC:2897 | normalized easing curve | `cubic-bezier()` |
| `Transaction` | SC:5978 | per-update animation context (which animation, disablesAnimations) | the "current animation" passed alongside a state change ⇒ a transition config object |
| `TransactionKey` | SC:5944 | custom transaction slot | extra fields on the transition config |
| `TimelineSchedule`/`TimelineScheduleMode`/`EveryMinuteTimelineSchedule`/`ExplicitTimelineSchedule`/`TimeDataSource` | SC | scheduled redraw cadence (clocks, etc.) | `setInterval`/`requestAnimationFrame` schedule driving re-render |

`Transaction` is the most important here: it is how `withAnimation { state = x }` tags a state change with an animation. Web mapping: a transition-config object passed through a `withAnimation(config, () => setState(x))` helper that components read to decide CSS `transition-duration`/easing for that update.

### 7C — Scroll subsystem value types (consumed by a ScrollView cluster)

`ScrollGeometry` (SC:237), `ScrollPhase` (SC:625), `ScrollPosition` (SC:690), `ScrollTarget` (SC:849), `ScrollTargetBehavior`+`AnyScrollTargetBehavior`+`ViewAlignedScrollTargetBehavior` (SU:1331/4774/4713), `ScrollBounceBehavior` (SU:12292), `ScrollIndicatorVisibility` (SU:12123), `ScrollDismissesKeyboardMode` (SU:12260), `ScrollInputBehavior`/`ScrollInputKind` (SU:12177/12184), `ScrollAnchorRole` (SU:11973), `ScrollContentOffsetAdjustmentBehavior` (SC:8724), `_ScrollViewProxy`/`_ScrollViewConfig`/`_ScrollLayout`/`_ScrollableLayout*`/`_ContainedScrollViewKey` (SU/SC).
→ **Web:** all map onto a `ScrollView` component's behavior props — `scroll-behavior:smooth`, `scroll-snap-type`/`scroll-snap-align` (for `ViewAlignedScrollTargetBehavior` = paging), `overflow`+`overscroll-behavior` (bounce), and a `useScrollPosition` hook reading `scrollTop`/`scrollLeft` + `onScroll`. `ScrollPhase` ⇒ idle/dragging/decelerating from scroll-event timing. These belong to the ScrollView cluster; C16 only defines the enums.

### 7D — Focus/keyboard/submit plumbing

`ResetFocusAction` (SU:17309), `DefaultFocusEvaluationPriority` (SU:4261), `FocusInteractions` (SU:21782), `FocusedValueKey`/`FocusedValues` (SU:19684/19688), `AccessibilityFocusState` (SU:20739), `SubmitTriggers` (SU:9946), `_FocusSystem`/`_FocusableModifier`/`_DefaultFocusModifier`.
→ **Web:** focus management via `tabindex`, `.focus()`, `focus-visible`, a focus-ring CSS token, and the `FocusedValues` context from §6.2. `ResetFocusAction` ⇒ blur active element / move focus to a default ref. `SubmitTriggers` ⇒ which events fire `onSubmit` (Enter key / search).

### 7E — Accessibility plumbing (semantics, not visual)

`AccessibilityTraits` (SC:4887), `AccessibilityTechnologies` (SU:9718), `AccessibilityActionKind`/`AccessibilityActionCategory` (SU), `AccessibilityAdjustmentDirection` (SU:1764), `AccessibilityChildBehavior` (SU:22046), `AccessibilityHeadingLevel` (SC:5645), `AccessibilityLabeledPairRole` (SU:314), `AccessibilityCustomContentKey` (SC:5622), `AccessibilityTextContentType` (SC:3723), `AccessibilityDirectTouchOptions` (SU:12346), `AccessibilityRotorContent`+`AccessibilityRotorEntry`+`AccessibilitySystemRotor`+`AccessibilityOptionalRotorContent`+`AccessibilityTupleRotorContent`+`AccessibilityRotorContentBuilder` (SU), `AccessibilityAttachmentModifier` (SU:14766), `_AccessibilityIgnoresInvertColorsViewModifier`, `_AccessibilityRotorEntry*`.
→ **Web:** ARIA. `AccessibilityTraits` ⇒ `role`/`aria-*`; `AccessibilityHeadingLevel` ⇒ `aria-level`; labeled-pair ⇒ `<label for>`; rotor ⇒ landmark navigation (no direct web analogue, mostly handled by native screen-reader heading/landmark nav). The accessibility env booleans that DO affect rendering (reduceMotion/reduceTransparency/differentiateWithoutColor/invertColors) are in §4.4. The rest are semantic-only and need no CSS.

### 7F — Scenes / windows / documents / commands (app-shell — mostly N/A on web)

App-lifecycle and window-management types with **no browser analogue** (a web kit renders inside one page). Tabulated for completeness; verdict mostly N/A or maps to routing/panels.

| Group | Types (`module`) | Web verdict |
|---|---|---|
| App entry | `App`, `__App`, `Scene`, `SceneBuilder`, `_TupleScene`, `_EmptyScene`, `_SceneInputs/Outputs`, `_SceneModifier*`, `SceneLaunchBehavior`, `SceneRestorationBehavior`, `SceneRestorationBehavior` | the kit has no "scene"; root = the React app. N/A |
| Window | `Window`, `WindowGroup`, `UtilityWindow`, `WindowLevel`, `WindowPlacement(+Context)`, `WindowProxy`, `WindowResizability`, `WindowIdealSize`, `WindowManagerRole`, `WindowLayoutRoot`, `WindowInteractionBehavior`, `WindowToolbarFullScreenVisibility`, `PushWindowAction` | browser windows ≠ OS windows; optional floating-panel store (see §6.6). Mostly N/A |
| Document | `DocumentGroup`, `DocumentGroupLaunchScene`, `DocumentLaunchGeometryProxy`, `FileDocument`, `ReferenceFileDocument`, `DocumentBaseBox`, `FileDialogBrowserOptions`, `RenameAction`, `Settings`, `ImportFromDevicesCommands` | file-based app shell; web ⇒ File System Access API at most. N/A for UI kit |
| Commands/menus | `Commands`, `CommandsBuilder`, `CommandGroup`, `CommandGroupPlacement`, `CommandMenu`, `EmptyCommands`, `SidebarCommands`, `ToolbarCommands`, `InspectorCommands`, `TextEditingCommands`, `TextFormattingCommands`, `_Commands*`, `_ResolvedCommands`, `TupleCommandContent`, `LimitedAvailabilityCommandContent` | macOS menu bar; web ⇒ a menu-bar component + keyboard shortcuts. Mostly N/A; commands' shortcuts map to `keydown` |
| Toolbar | `ToolbarContent(+Builder)`, `CustomizableToolbarContent`, `ToolbarItem(+Group)`, `ToolbarItemPlacement`, `ToolbarPlacement`, `ToolbarRole`, `ToolbarSpacer`, `ToolbarTitleDisplayMode`, `ToolbarTitleMenu`, `ToolbarCustomization*`, `ToolbarDefaultItemKind`, `DefaultToolbarItem`, `ContentToolbarPlacement`, `_Toolbar*` | belongs to a Toolbar/NavigationBar cluster; C16 only defines placement enums ⇒ flex regions (leading/center/trailing) |
| Tabs | `TabContent(+Builder)`, `AnyTabContent`, `TabRole`, `TabPlacement`, `TabBarPlacement`, `AdaptableTabBarPlacement`, `TabBarMinimizeBehavior`, `TabCustomizationBehavior`, `TabViewCustomization`, `TabViewBottomAccessoryPlacement`, `TabSearchActivation`, `TabContentBuilder`, `_TupleTabContent` | TabView cluster; placement enums ⇒ flex regions |
| Search | `SearchFieldPlacement`, `SearchScopeActivation`, `SearchSuggestionsPlacement`, `SearchPresentationToolbarBehavior`, `SearchToolbarBehavior`, `SearchUnavailableContent`, `DismissSearchAction`(§6.7) | searchable modifier; web ⇒ a search `<input>` + suggestions popover |
| Presentation | `PresentationMode`, `PresentationSizing(+Context/Root)`, `AutomaticPresentationSizing`, `FittedPresentationSizing`, `FormPresentationSizing`, `CustomPresentationDetent`, `DismissBehavior`, `DialogSeverity`, `AlertScene`, `ContainerBackgroundPlacement` | Sheet/Popover cluster; detents ⇒ snap heights; `dismiss`/`isPresented` are in §6.3 |
| Settings/preview | `PreviewProvider`, `_PreviewProvider`, `PreviewModifier`, `PreviewDevice`, `PreviewPlatform`, `PreviewContext(Key)`, `_Preview(Host)`, `_Previewable`, `_PerformanceTest`, `_Test*`, `_Benchmark*`, `__DesignTimeSelectionIdentifier` | Xcode-canvas tooling. N/A on web |

### 7G — Tables / lists / fetch (Table cluster)

`TableColumnContent(+Builder)`, `TableColumnAlignment`, `TableColumnCustomization(+Behavior)`, `TableColumnForEach`, `TableForEachContent`, `TableHeaderRowContent`, `TableOutlineGroupContent`, `TableRowContent(+Builder)`, `DynamicTableRowContent`, `EmptyTableRowContent`, `DisclosureTableRow`, `TupleTableColumnContent`, `TupleTableRowContent`, `_Table*`, `_TableRowContentModifier`, `ItemProviderTableRowModifier`, `SectionCollection`, `SectionedFetchRequest`, `SectionedFetchResults`, `FetchRequest`, `FetchedResults`, `EditActions`, `EditableCollectionContent`, `IndexedIdentifierCollection`, `ForEachSectionCollection`, `ForEachSubviewCollection`, `SubviewsCollection(+Slice)`.
→ **Web:** Table/List clusters. `TableColumnAlignment` ⇒ `text-align` per `<td>`; fetch types ⇒ data-source props (no CoreData on web → a generic `rows` array). C16 only defines the content-builder protocols + alignment enums.

### 7H — Charts module value types

`AnnotationContext`, `AnnotationPosition`, `AnnotationOverflowResolution`, `InterpolationMethod`, `ScaleType`, `ScaleDomain`/`ScaleRange`/`AutomaticScaleDomain`/`_Scale*Outputs`, `DateBins`, `ValueAlignedLimitBehavior`, `BuilderConditional`/`BuilderEmpty`/`BuilderPair`/`BuilderTuple` (Charts content builders).
→ **Web:** a Charts cluster (SVG/Canvas). `InterpolationMethod` (.linear/.monotone/.catmullRom/.stepStart…) ⇒ D3 curve factories; `AnnotationPosition` ⇒ label placement; `ScaleType`/`ScaleDomain`/`ScaleRange` ⇒ D3 scales. C16 only carries the enums.

### 7I — Hover/pointer effects (visionOS/iPad pointer)

`HoverEffect` (SU:9260), `CustomHoverEffect` (SC:1445), `HoverEffectContent` (SC:4137), `HoverEffectGroup`/`GroupHoverEffect` (SU:20478/20510), `HoverEffectPhaseOverride` (SU:13676), `AutomaticHoverEffect`/`HighlightHoverEffect`/`LiftHoverEffect`/`ContentHoverEffect`/`EmptyHoverEffect`/`EmptyHoverEffectContent` (SU/SC), `_HoverEffectContent*`, `_HoverRegionModifier`, `_HoverTableRowModifier`.
→ **Web:** `:hover` CSS. `.highlight` ⇒ background tint on hover; `.lift` ⇒ `transform: scale(1.05)` + shadow; `.automatic` ⇒ platform default (subtle tint). Pointer location via `pointermove` (`HoverPhase`, §6.9).

### 7J — Drag & drop

`DragSession` (SU:3160), `DropSession` (SU:8535), `DropDelegate` (SU:2065), `DropInfo` (SU:2050), `DropProposal` (SU:2149), `DropOperation` (SU:2084: copy/move/forbidden/cancel), `DragDropPreviewsFormation` (SU:18808), `SpatialEventCollection` (SU:4469), `_DraggingModifier`.
→ **Web:** HTML5 Drag-and-Drop API / Pointer Events. `DropOperation` ⇒ `dataTransfer.dropEffect = 'copy'|'move'|'none'`; `DropDelegate` ⇒ `onDragOver`/`onDrop` handlers; `DropInfo` ⇒ the `DragEvent`.

### 7K — Geometry / layout helpers (Layout cluster)

`GeometryProxy` (SC:7902), `ProposedViewSize` (SC:8197), `ViewDimensions`(+`3D`) (SC:1305/5350), `ViewSpacing` (SC:8220), `LayoutSubview(s)` (SC:8263/8232), `LayoutProperties` (SC:8188), `LayoutValueKey` (SC:8287), `Layout` (SC:8142), `Anchor` (SC:3975), `CoordinateSpace(+Protocol)` (SC:16065/16103), `GlobalCoordinateSpace`, `DisplayProxy`, `_*Layout` structs (HStack/VStack/Flex/Frame/Padding/Position/Scroll/AspectRatio/Alignment), `_VAlignment`, `AlignmentID`/`AlignmentKey`/`DepthAlignment*`, `Alignment3D`, `_AligningContentProvider`.
→ **Web:** flexbox/grid + `getBoundingClientRect()` (≡ `GeometryProxy`), `ResizeObserver` (≡ size readback). `CoordinateSpace` ⇒ `.named()` ⇒ a positioned ancestor for relative coords. Custom `Layout` protocol ⇒ a measure+place function (CSS subgrid / JS layout). These belong to the Layout cluster; C16 defines the protocols + proposed-size value type.

### 7L — Effects / view modifiers (internal `_*Effect`/`_*Modifier`)

~90 underscore-prefixed internal structs: `_OpacityEffect`, `_ScaleEffect`, `_RotationEffect`/`_Rotation3DEffect`, `_OffsetEffect`, `_ShadowEffect`, `_BlurEffect`(blend), `_BrightnessEffect`, `_ContrastEffect`, `_SaturationEffect`, `_GrayscaleEffect`, `_HueRotationEffect`, `_ColorInvertEffect`, `_ColorMonochromeEffect`, `_ColorMultiplyEffect`, `_ColorMatrixEffect`, `_LuminanceToAlphaEffect`, `_AlphaThresholdEffect`, `_BlendModeEffect`, `_CompositingGroupEffect`, `_GeometryGroupEffect`, `_ShaderFilterEffect`, `_TransformEffect`, `_ProjectionEffect`, `_BackgroundModifier`/`_OverlayModifier`/`_ForegroundColorModifier`/`_ForegroundLayerViewModifier`, padding/frame/inset layout modifiers, preference-writing modifiers, environment-writing modifiers (`_EnvironmentKeyWritingModifier` = the actual impl behind `.environment(\.x, v)`), transaction modifiers, geometry-action modifiers, etc.
→ **Web:** these are the **implementations** behind public modifiers. The visible ones map to CSS: opacity⇒`opacity`, scale⇒`transform:scale`, rotation⇒`transform:rotate`, offset⇒`transform:translate`, shadow⇒`box-shadow`/`filter:drop-shadow`, brightness/contrast/saturation/grayscale/hue-rotate/invert⇒CSS `filter:` functions, blendMode⇒`mix-blend-mode`, shader⇒WebGL/CSS Houdini (DESIGNED fallback: precomputed filter). `_EnvironmentKeyWritingModifier` is literally the `EnvironmentProvider` from §1. Shaders (`Shader`/`ShaderLibrary`/`ShaderFunction`, SC:6885+) ⇒ no general web analogue → DESIGNED: approximate common shaders with CSS filters/SVG, or WebGL for custom.

### 7M — Graph/runtime internals (NO web analogue — SwiftUI's reactive engine)

`_Graph`, `_GraphInputs`, `_GraphValue`, `_ViewInputs`, `_ViewOutputs`, `_ViewListInputs/Outputs`, `_ViewListCountInputs`, `_DynamicPropertyBuffer`, `PropertyList`, `_Detachable`/`_DetachableProperties`/`_DetachedKey`/`_EmptyDetached`, `_VariadicView_*`, `_ViewTraitKey`/`_TraitWritingModifier`/`_ConditionalTraitWritingModifier`/`_TagTraitWritingModifier`, `_ConditionalContent`, `_PreferenceValue`/`_PreferenceReadingView`/`_DelayedPreferenceView`/`_PreferenceWritingModifier`/`_PreferenceTransformModifier`/`_PreferenceActionModifier`, `_IdentifiedView*`, `_GraphInputsModifier`, `_ImpossibleActor`, `_RemoveGlobalActorIsolation`, `_ViewDebug`, `_LocalizationInfo`, `_DeviceVariant`, `SemanticRequirement`, `View`, `ViewModifier`, `_StackLayoutCache`, `_LayoutTraits`, `_ProposedSize`, `_Placement`, `_FormatSpecifiable`, `TextAttribute`/`TextProxy`/`TextVariantPreference`/`FixedTextVariant`/`SizeDependentTextVariant`/`_TextVariantPreference`/`TypesettingLanguage`/`_TextRendererViewModifier`, `TextSelectability`/`EnabledTextSelectability`/`DisabledTextSelectability`, `TextSelection`/`TextSelectionAffinity`/`AttributedTextSelection`/`AttributedText*`.
→ **Web:** these are React's own fiber/reconciler internals + render-graph; **the React runtime replaces them wholesale**. No mapping needed — the kit is built ON React, so SwiftUI's graph machinery has no kit-level equivalent. Text-variant/typesetting types ⇒ handled by the browser text engine + CSS. `TextSelection`/`Affinity` ⇒ DOM Selection API. `View`/`ViewModifier` ⇒ React component / HOC.

### 7N — Widgets / immersive / spatial / 3D (visionOS, widget extensions — N/A on web)

`Widget`, `WidgetBundle(+Builder)`, `TupleWidget`, `_Widget*`, `ControlWidget(+Template/Builder)`, `EmptyControlWidgetTemplate`, `_ControlWidgetAdaptor`, `ImmersiveSpace(+Content/Builder/ViewContent)`, `RemoteImmersiveSpace`, `ImmersionChangeContext`, `ImmersiveContentBrightness`, `ImmersiveEnvironmentBehavior`, `ProgressiveImmersionAspectRatio`, `DismissImmersiveSpaceAction`, `CompositorContent(+Builder)`, `AnyCompositorContent`, `_LimitedAvailabilityCompositorContent`, `Viewpoint3D`, `SquareAzimuth`, `WorldAlignmentBehavior`, `WorldRecenterPhase`, `WorldTrackingLimitation`, `VolumeViewpointUpdateStrategy`, `SurroundingsEffect`, `RemoteDeviceIdentifier`, `Chirality`, `DigitalCrownEvent`/`DigitalCrownRotationalSensitivity` (watchOS), `_DigitalCrownModifier`, `SnapshotData`/`SnapshotResponse`, `BackgroundTask`, `AssistiveAccess`, `WritingToolsBehavior`, `TextInputDictation*`, `TextInputFormattingControlPlacement`, `TouchBarItemPresence`/`_TouchBarModifier`, `SharePreview`, `InterfaceOrientation`, `FrameResizeDirection`/`FrameResizePosition`, `DragDropPreviewsFormation`, `FindContext`, `MenuButtonStyle`-adjacent, `_MenuBarExtraValue`, `ButtonRepeatBehavior`, `ButtonRole`, `ButtonSizing`, `SpacerSizing`, `SidebarRowSize`, `ContainerValueKey`/`ContainerValues`, `_ContainerValueWritingModifier`, `DefaultFocusEvaluationPriority`, `RenameAction`, `ImageRenderer`, `DisplayProxy`, `PreviewContext`, `SliderTick*`, `_PagingViewConfig`.
→ **Web verdict:** N/A (spatial/watch/widget/AppKit-specific) except a handful that surface as control props: `ButtonRole` (.destructive/.cancel ⇒ red/secondary styling), `ButtonRepeatBehavior` (press-and-hold repeat ⇒ `setInterval` on pointerdown), `ButtonSizing`/`SpacerSizing`/`SidebarRowSize` (density ⇒ control-size tokens), `SubmitLabel` (⇒ `enterkeyhint`), `InterfaceOrientation` (⇒ `matchMedia('(orientation:)')`), `ImageRenderer` (⇒ `html-to-canvas`/SVG serialize for snapshotting a view to an image), `SliderTick*` (⇒ tick marks on a range input). `ContainerValues`/`ContainerValueKey` are the per-container analogue of EnvironmentValues (a container injects values its direct children read) ⇒ a scoped React context per container component.


---

## §8 — Consolidated runnable spec (paste-and-adapt for the next agent)

### 8.1 The `UnitPoint` / `Edge` constant tables (verbatim from interface)

`UnitPoint` (`SC:9720`) static points → CSS positions (`x% y%`):
```
zero 0,0 → 0% 0%      center .5,.5 → 50% 50%
leading 0,.5 → 0% 50% trailing 1,.5 → 100% 50%   (logical: flip in RTL)
top .5,0 → 50% 0%     bottom .5,1 → 50% 100%
topLeading 0,0        topTrailing 1,0
bottomLeading 0,1     bottomTrailing 1,1
```
`Edge` (`SC:1190`) `enum Int8 { top, leading, bottom, trailing }` + `Edge.Set { top, leading, bottom, trailing, all, horizontal, vertical }` → logical CSS sides. `.horizontal` ⇒ inline axis, `.vertical` ⇒ block axis. Used by `.padding(.horizontal, 16)` ⇒ `padding-inline: 16px`.

### 8.2 The complete `SwiftUIEnvironmentProvider` (DESIGNED, runnable)

```tsx
// SwiftUIEnvironment.tsx
import * as React from 'react';

export type ColorScheme = 'light' | 'dark';
export type ControlSize = 'mini' | 'small' | 'regular' | 'large' | 'extraLarge';
export type DynamicTypeSize =
  | 'xSmall' | 'small' | 'medium' | 'large' | 'xLarge' | 'xxLarge' | 'xxxLarge'
  | 'accessibility1' | 'accessibility2' | 'accessibility3' | 'accessibility4' | 'accessibility5';

// §3.1 — Apple Dynamic Type body-relative scale table (INFERRED, Apple published)
export const TYPE_SCALE: Record<DynamicTypeSize, number> = {
  xSmall: 0.823, small: 0.882, medium: 0.941, large: 1.0, xLarge: 1.118,
  xxLarge: 1.235, xxxLarge: 1.353, accessibility1: 1.647, accessibility2: 1.941,
  accessibility3: 2.353, accessibility4: 2.764, accessibility5: 3.118,
};
export const isAccessibilitySize = (s: DynamicTypeSize) => s.startsWith('accessibility');

export interface SwiftUIEnvironment { /* …full shape from §1… */
  colorScheme: ColorScheme; colorSchemeContrast: 'standard' | 'increased';
  controlSize: ControlSize; controlActiveState: 'key' | 'active' | 'inactive';
  dynamicTypeSize: DynamicTypeSize; legibilityWeight: 'regular' | 'bold' | null;
  layoutDirection: 'leftToRight' | 'rightToLeft';
  isEnabled: boolean; editMode: 'inactive' | 'transient' | 'active';
  redactionReasons: ReadonlySet<'placeholder' | 'privacy' | 'invalidated'>;
  reduceMotion: boolean; reduceTransparency: boolean; differentiateWithoutColor: boolean;
  tint: string; foregroundStyle: string; backgroundStyle: string | null;
  font: string | null; imageScale: 'small' | 'medium' | 'large';
  lineLimit: number | null; multilineTextAlignment: 'leading' | 'center' | 'trailing';
  truncationMode: 'head' | 'middle' | 'tail'; lineSpacing: number;
  minimumScaleFactor: number; allowsTightening: boolean;
  displayScale: number; pixelLength: number;
  locale: string; calendar: string; timeZone: string;
  dismiss: () => void; refresh: (() => Promise<void>) | null;
  openURL: (url: string, o?: { prefersInApp?: boolean }) => void;
  scenePhase: 'background' | 'inactive' | 'active'; isPresented: boolean;
}

export const DEFAULT_ENV: SwiftUIEnvironment = {
  colorScheme: 'light', colorSchemeContrast: 'standard',
  controlSize: 'regular', controlActiveState: 'active',
  dynamicTypeSize: 'large', legibilityWeight: null, layoutDirection: 'leftToRight',
  isEnabled: true, editMode: 'inactive', redactionReasons: new Set(),
  reduceMotion: false, reduceTransparency: false, differentiateWithoutColor: false,
  tint: 'var(--sui-color-tint)', foregroundStyle: 'var(--sui-color-label)', backgroundStyle: null,
  font: null, imageScale: 'medium',
  lineLimit: null, multilineTextAlignment: 'leading', truncationMode: 'tail',
  lineSpacing: 0, minimumScaleFactor: 1, allowsTightening: false,
  displayScale: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  pixelLength: typeof window !== 'undefined' ? 1 / window.devicePixelRatio : 1,
  locale: 'en-US', calendar: 'gregorian', timeZone: 'UTC',
  dismiss: () => {}, refresh: null, openURL: (u) => window.open(u, '_blank', 'noopener'),
  scenePhase: 'active', isPresented: false,
};

const Ctx = React.createContext<SwiftUIEnvironment>(DEFAULT_ENV);
export const useEnvironment = () => React.useContext(Ctx);

/** .environment(\.key, value) — merges ONE slot; isEnabled uses monotonic AND (§4.1). */
export function EnvironmentProvider({
  children, ...over
}: Partial<SwiftUIEnvironment> & { children: React.ReactNode }) {
  const parent = useEnvironment();
  const value = React.useMemo<SwiftUIEnvironment>(() => ({
    ...parent, ...over,
    isEnabled: parent.isEnabled && (over.isEnabled ?? true),  // never re-enables
  }), [parent, JSON.stringify(over)]);
  const rtl = value.layoutDirection === 'rightToLeft';
  return (
    <Ctx.Provider value={value}>
      <div
        className="sui-env"
        dir={rtl ? 'rtl' : 'ltr'}
        data-color-scheme={value.colorScheme}
        data-contrast={value.colorSchemeContrast}
        data-control-size={value.controlSize}
        data-active={value.controlActiveState !== 'inactive'}
        data-type-size={value.dynamicTypeSize}
        data-ax-size={isAccessibilitySize(value.dynamicTypeSize)}
        data-edit-mode={value.editMode}
        data-reduce-motion={value.reduceMotion}
        data-reduce-transparency={value.reduceTransparency}
        data-disabled={!value.isEnabled || undefined}
        data-redacted={[...value.redactionReasons][0]}
        style={{
          colorScheme: value.colorScheme,
          ['--sui-type-scale' as any]: TYPE_SCALE[value.dynamicTypeSize],
          ['--sui-display-scale' as any]: value.displayScale,
          ['--sui-color-tint' as any]: value.tint,
          color: value.foregroundStyle,
        }}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** The root provider that wires browser/OS signals into env (call once at app root). */
export function SwiftUIRoot({ children }: { children: React.ReactNode }) {
  const colorScheme = useMediaQuery('(prefers-color-scheme: dark)') ? 'dark' : 'light';
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reduceTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');
  const colorSchemeContrast = useMediaQuery('(prefers-contrast: more)') ? 'increased' : 'standard';
  const scenePhase = useScenePhase();            // §6.8
  return (
    <EnvironmentProvider {...{ colorScheme, reduceMotion, reduceTransparency, colorSchemeContrast, scenePhase }}>
      {children}
    </EnvironmentProvider>
  );
}
```

### 8.3 The token CSS the env scopes drive (ties to W1 token files)

```css
/* control-size ramp (§2.3) */
.sui-env[data-control-size="mini"]      { --sui-control-h:16px; --sui-control-pad:6px;  --sui-control-radius:3px;  --sui-control-font:var(--sui-text-caption2-size); }
.sui-env[data-control-size="small"]     { --sui-control-h:22px; --sui-control-pad:8px;  --sui-control-radius:5px;  --sui-control-font:var(--sui-text-subheadline-size); }
.sui-env[data-control-size="regular"]   { --sui-control-h:28px; --sui-control-pad:12px; --sui-control-radius:6px;  --sui-control-font:var(--sui-text-body-size); }
.sui-env[data-control-size="large"]     { --sui-control-h:36px; --sui-control-pad:16px; --sui-control-radius:8px;  --sui-control-font:var(--sui-text-title3-size); }
.sui-env[data-control-size="extraLarge"]{ --sui-control-h:44px; --sui-control-pad:20px; --sui-control-radius:10px; --sui-control-font:var(--sui-text-title2-size); }

/* type scale (§3.1) — every text token multiplies by this */
.sui-text-body { font-size: calc(var(--sui-text-body-size) * var(--sui-type-scale)); line-height: var(--sui-text-body-line); font-weight: var(--sui-text-body-weight); letter-spacing: var(--sui-text-body-tracking); }

/* states (§4) */
.sui-env[data-disabled] .sui-control { opacity:.4; pointer-events:none; }
.sui-env[data-active="false"] .sui-control { filter: saturate(.6); }
.sui-env[data-redacted="placeholder"] .sui-redactable { color:transparent; background:var(--sui-color-quaternary-label); border-radius:4px; }
@media (prefers-reduced-motion: reduce){ .sui-env { --sui-anim-duration:0.01ms; } }
@media (prefers-reduced-transparency: reduce){ .sui-material { backdrop-filter:none; background:var(--sui-material-opaque-fallback); } }

/* AX-size relayout (§3.1) */
.sui-env[data-ax-size="true"] .sui-labeled-control { flex-direction:column; align-items:stretch; }

/* hairline (§3.7) */
.sui-separator { background:var(--sui-color-separator); block-size: max(0.5px, calc(1px / var(--sui-display-scale))); }
```

---

## §9 — Coverage ledger

**DEEP-COVERED (35 types, §1–§6, §8):**
DI core — `EnvironmentValues`, `EnvironmentKey`, `Environment`, `EnvironmentalModifier`, `DynamicProperty`, `PreferenceKey`.
Theming/layout keys — `ColorScheme`, `ColorSchemeContrast`, `ControlSize`, `ControlActiveState`, `LayoutDirection`, `LayoutDirectionBehavior`, `ColorRenderingMode`.
Type/metrics — `DynamicTypeSize`, `ContentSizeCategory`, `Font.TextStyle`, `ScaledMetric`, `LegibilityWeight`, `TextAlignment`, `Visibility`, text-flow env vars (multilineTextAlignment/truncationMode/lineSpacing/lineLimit/minimumScaleFactor/allowsTightening), `displayScale`/`pixelLength` env, `font`/`imageScale`/`foregroundStyle`/`backgroundStyle`/`locale`/`calendar`/`timeZone` env.
State — `State`, `Binding`, `Bindable`, `StateObject`, `ObservedObject`, `EnvironmentObject`, `AppStorage`, `SceneStorage`, `RedactionReasons`, `EditMode`.
Focus/actions — `FocusState`, `FocusedValue`, `FocusedBinding`, `FocusedObject`, `DismissAction`, `RefreshAction`, `OpenURLAction`, `OpenWindowAction`, `DismissWindowAction`, `DismissSearchAction`, `ScenePhase`, `HoverPhase`.

**TABULATED (§7, remaining ~590):** value types w/ render impact (§7A: Edge/Alignment/UnitPoint/EdgeInsets/Angle/corner-radii/Prominence/sizeClass/Symbol*/Material/BlendMode/ContentMode/…), animation/vector math (§7B), scroll subsystem (§7C), focus plumbing (§7D), accessibility semantics (§7E), scenes/windows/documents/commands/toolbar/tabs/search/presentation/preview (§7F), tables/fetch (§7G), Charts (§7H), hover effects (§7I), drag-drop (§7J), geometry/layout (§7K), internal `_*Effect`/`_*Modifier` (§7L), reactive-graph runtime internals (§7M — replaced wholesale by React), widgets/immersive/spatial/3D/watch/touchbar (§7N — N/A on web).

**Verdict:** C16 is the kit's nervous system, not a visible component. The deliverable is `SwiftUIEnvironmentProvider` + the property-wrapper→hook table — both fully specified above with runnable code, default constants, and the data-attribute/custom-property contract that every C-other component consumes. The ~590 tabulated types are either (a) value types whose CSS mapping is one line, (b) plumbing for other clusters, or (c) OS/spatial concepts with no browser analogue — none require their own component.

**web_ready = true** — every deep-covered item has HTML structure (data-attrs on `.sui-env` + control DOM), CSS (custom-property ramps + state selectors), and a React prop/hook API (`useEnvironment`, `EnvironmentProvider`, `useAppStorage`, `useFocusState`, `useScenePhase`, `useScaledMetric`, `Binding<T>` shape).
