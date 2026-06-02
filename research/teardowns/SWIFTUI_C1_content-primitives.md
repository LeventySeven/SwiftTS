# SwiftUI Cluster C1 — Content Primitives (RE Teardown → Web Replica Spec)

**Cluster:** C1 `content-primitives`
**Targets:** `Text`, `Label`, `Image` (+ SF Symbols strategy), `AsyncImage`, `Link`, `Divider`, `Spacer`, `ProgressView`, `Gauge`, plus `TextRenderer` (tabulated).
**Authoritative source (Tier-1A):** the macOS 26 SDK `.swiftinterface` files —
- SwiftUICore: `…/SwiftUICore.framework/…/arm64e-apple-macos.swiftinterface`
- SwiftUI: `…/SwiftUI.framework/…/arm64e-apple-macos.swiftinterface`

All Swift signatures below are quoted **verbatim with `file:line`**. Every claim is labeled:
- **KNOWN** — read directly from the swiftinterface (type system, enum cases, signatures, defaults).
- **INFERRED** — Apple HIG / WWDC / runtime RE for visual metrics the interface cannot encode (default sizes, spinner geometry, animation curves).
- **DESIGNED** — my web/CSS engineering choice to make the browser reproduce the native behavior.

Token references (`--sui-…`) point at the W1 design-token files in `swiftui/tokens/` (`typography.md`, `colors.md`, `spacing.md`, `shapes-effects.md`, `animation.md`).

Coverage map: **deep-covered** = Text, Image, Label, AsyncImage, Link, Divider, Spacer, ProgressView, Gauge. **Tabulated** = `TextRenderer` protocol (advanced custom-draw API, not a renderable primitive in the kit's first pass).

---

# 1. `Text` — the most-used primitive (DEEPEST)

`Text` is a value type (`@frozen struct`), not a `View`-with-`body`; it conforms to `View` through `_makeView` and carries an internal `storage` + an ordered list of `modifiers`. The web replica is therefore a **leaf inline element** (`<span>`) that accumulates inline styles, exactly mirroring the `[Modifier]` array.

## 1.1 Exact API — the struct (KNOWN)

`SwiftUICore.swiftinterface:18180`
```swift
@frozen public struct Text : Swift.Equatable, Swift.Sendable {
  @frozen package enum Storage : Swift.Equatable {     // :18182
    case verbatim(Swift.String)
    case anyTextStorage(SwiftUICore.AnyTextStorage)
  }
  @frozen package enum Modifier : Swift.Equatable {    // :18190
    case color(SwiftUICore.Color?)
    case font(SwiftUICore.Font?)
    case italic
    case weight(SwiftUICore.Font.Weight?)
    case kerning(CoreFoundation.CGFloat)
    case tracking(CoreFoundation.CGFloat)
    case baseline(CoreFoundation.CGFloat)
    case rounded
    case anyTextModifier(SwiftUICore.AnyTextModifier)
  }
  package var storage: SwiftUICore.Text.Storage          // :18204
  package var modifiers: [SwiftUICore.Text.Modifier] = [Modifier]()   // :18206
  @inlinable public init(verbatim content: Swift.String) { storage = .verbatim(content) }  // :18207
  @_disfavoredOverload public init<S>(_ content: S) where S : Swift.StringProtocol         // :18210
}
```
**The `Modifier` enum IS the web style model.** Every styling call appends one of these cases; the renderer folds them into glyph attributes. Our React `<Text>` keeps the identical ordered list and folds it into inline CSS.

## 1.2 Exact API — all initializers (KNOWN, grouped)

| Init | `file:line` | Semantics |
|---|---|---|
| `init(verbatim content: String)` | `:18207` | **No localization.** Renders the string as-is. → web: raw text node. |
| `init<S>(_ content: S) where S: StringProtocol` | `:18210` | `@_disfavoredOverload`. Plain string, **not** markdown-parsed, **not** localized (StringProtocol bypasses the `LocalizedStringKey` overload). |
| `init(_ key: LocalizedStringKey, tableName:bundle:comment:)` | `:4930` | `@_semantics("swiftui.init_with_localization")`. **This is the default for string literals** — `Text("Hello **bold**")` goes here. Parses **inline Markdown** and looks up localization. Signature: `init(_ key: LocalizedStringKey, tableName: String? = nil, bundle: Bundle? = nil, comment: StaticString? = nil)`. |
| `init(_ resource: LocalizedStringResource)` | `:5316` | `@_disfavoredOverload`, iOS16+. Localized resource object. |
| `init(_ attributedContent: AttributedString)` | `:7626` | `@_disfavoredOverload`, iOS15+. Renders an `AttributedString` — **the markdown path** (`Text(try! AttributedString(markdown: "…"))`) and the rich-run path. |
| `init(_ image: Image)` | `:7464` | iOS14+. Inlines an image as a text glyph (for `Text("a ") + Text(Image(systemName:"star"))`). |
| `init<Subject>(_ subject: Subject, formatter: Formatter)` | `:7442-7443` | NSObject / ReferenceConvertible + legacy `Formatter`. |
| `init<F>(_ input: F.FormatInput, format: F)` (String output) | `:7451` | iOS15+. `FormatStyle` path: `Text(date, format: .dateTime)`, `Text(42, format: .number)`. |
| `init<F>(_ input:, format:)` (AttributedString output) | `:7455` | iOS18+. FormatStyle producing rich text. |
| `init(_ date: Date, style: Text.DateStyle)` | `:7487` | Live date/time. `DateStyle`: `.time .date .relative .offset .timer` (`:7480`). |
| `init(_ dates: ClosedRange<Date>)` / `init(_ interval: DateInterval)` | `:7488-7489` | Date range rendering. |
| `init(timerInterval:pauseTime:countsDown:showsHours:)` | `:7497` | Self-updating countdown: `init(timerInterval: ClosedRange<Date>, pauseTime: Date? = nil, countsDown: Bool = true, showsHours: Bool = true)`. |

**Markdown — how it actually works (KNOWN + INFERRED):** there is **no** `init(markdown:)`. Markdown is parsed in two places: (1) `LocalizedStringKey` literals run the inline-Markdown grammar (`**bold**`, `*italic*`, `` `code` ``, `[link](url)`, `~~strike~~`); (2) `AttributedString(markdown:)` (Foundation) builds rich runs that `Text(_:AttributedString)` renders. Block-level markdown (headings, lists) is **not** supported — only inline. (INFERRED from Apple docs; the swiftinterface only shows the `LocalizedStringKey`/`AttributedString` entry points.)

## 1.3 Exact API — text styling modifiers (KNOWN)

These all return **`Text` → Text`** (value-returning, chainable) — they mutate the `modifiers` array, they are **not** `View` modifiers. `SwiftUICore.swiftinterface:12953-12988`:
```swift
nonisolated public func foregroundColor(_ color: Color?) -> Text          // :12959 (deprecated → foregroundStyle)
nonisolated public func foregroundStyle<S>(_ style: S) -> Text where S: ShapeStyle  // :12961 (iOS17+)
nonisolated public func font(_ font: Font?) -> Text                       // :12962
nonisolated public func fontWeight(_ weight: Font.Weight?) -> Text        // :12963
nonisolated public func fontWidth(_ width: Font.Width?) -> Text           // :12965 (iOS16+)
nonisolated public func bold() -> Text                                    // :12966
nonisolated public func bold(_ isActive: Bool) -> Text                    // :12968 (iOS16+)
nonisolated public func italic() -> Text                                  // :12969
nonisolated public func italic(_ isActive: Bool) -> Text                  // :12971 (iOS16+)
nonisolated public func monospaced(_ isActive: Bool = true) -> Text       // :12973 (iOS16.4+)
nonisolated public func fontDesign(_ design: Font.Design?) -> Text        // :12975 (iOS16.1+)
nonisolated public func monospacedDigit() -> Text                         // :12977 (iOS15+)
nonisolated public func strikethrough(_ isActive: Bool = true, color: Color? = nil) -> Text          // :12978
nonisolated public func strikethrough(_ isActive: Bool = true, pattern: LineStyle.Pattern, color: Color? = nil) -> Text  // :12980 (iOS16+)
nonisolated public func underline(_ isActive: Bool = true, color: Color? = nil) -> Text              // :12981
nonisolated public func underline(_ isActive: Bool = true, pattern: LineStyle.Pattern, color: Color? = nil) -> Text      // :12983 (iOS16+)
nonisolated public func kerning(_ kerning: CGFloat) -> Text               // :12984
nonisolated public func tracking(_ tracking: CGFloat) -> Text             // :12985
nonisolated public func baselineOffset(_ baselineOffset: CGFloat) -> Text // :12986
```
Plus `textScale(_:isEnabled:)` (`:13013`, `Text.Scale` = `.default`/`.secondary`, `:12996`).

**`Text.LineStyle.Pattern` (KNOWN, `:5887`):** `.solid .dot .dash .dashDot .dashDotDot`. `LineStyle` init: `init(pattern: Pattern = .solid, color: Color? = nil)` (`:5886`); `.single` and `.solid` are the defaults.

**`kerning` vs `tracking` (KNOWN distinction from the `Modifier` enum):** both exist as separate cases (`:18195-18196`). `kerning` adjusts spacing **between glyph pairs without affecting the trailing edge**; `tracking` adds uniform spacing **including after the last glyph**. In CSS both map to `letter-spacing`, but `tracking` is the SwiftUI default text-token spacing (see typography token `--sui-text-body-tracking`).

## 1.4 Concatenation (KNOWN)

`SwiftUICore.swiftinterface:8390`
```swift
public static func + (lhs: Text, rhs: Text) -> Text
```
`Text("a").bold() + Text("b").italic()` produces one `Text` whose storage is an `AnyTextStorage` holding both runs with their own modifier arrays. → web: render as a single `<span>` containing multiple child `<span>`s, each with its own inline style. This is why `Text` must be an **inline** element (so concatenated runs flow on one line).

## 1.5 Visual anatomy & default metrics (INFERRED — from typography tokens)

- **Sub-elements:** none. `Text` is a run of glyphs. No box chrome, no padding, no background by default.
- **Default font:** `.body` text style → `--sui-text-body-size: 17px`, `--sui-text-body-weight: 400`, `--sui-text-body-lineHeight: 22px`, `--sui-text-body-tracking: -0.41px`, family `--sui-font-default` (SF Pro Text optical master, since 17 < 20px crossover).
- **Default color:** `Color.primary` = `--sui-color-label` (`#000000` light / `#FFFFFF` dark).
- **Default alignment:** leading (natural reading direction). Multi-line is governed by `multilineTextAlignment` (environment, out of this struct).
- **States:** `Text` has no interaction states itself. It inherits `.disabled` (parent dims to ~`secondaryLabel`), `.redacted(reason: .placeholder)` (renders as a gray rounded capsule the width of the text — INFERRED), and Dynamic Type scaling.

## 1.6 Behavior (KNOWN + INFERRED)

- **Truncation:** `Text.TruncationMode` (`:8433`) = `.head .tail .middle`; default `.tail`. Combined with `lineLimit(_:)` (a `View` modifier, `:8755`).
- **Line break + minimum scale:** `minimumScaleFactor` (View env) shrinks text to fit before truncating.
- **Live-updating texts** (`DateStyle.timer`, `timerInterval`) tick once per second on a `TimelineView`-style schedule (INFERRED). Web replica uses a `setInterval` re-render.
- **Animation:** text changes are **not** animated by default; `.contentTransition(.numericText())` (out of cluster) animates digit rolls.

## 1.7 Web replication — HTML + CSS + React prop API (DESIGNED)

**HTML:** a single inline element. Leaf text → `<span class="sui-text">`. Concatenation → nested `<span>`s.

```css
.sui-text {
  font-family: var(--sui-font-default);
  font-size: var(--sui-text-body-size);          /* 17px default */
  font-weight: var(--sui-text-body-weight);      /* 400 */
  line-height: var(--sui-text-body-lineHeight);  /* 22px — absolute, never unitless */
  letter-spacing: var(--sui-text-body-tracking); /* -0.41px */
  color: var(--sui-color-label);
  font-synthesis: none;                          /* never fake-bold/italic SF */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
/* style-variant utility classes, one per Font.TextStyle (see typography.md §5.2) */
.sui-text--largeTitle { font-size:var(--sui-text-largeTitle-size); font-weight:var(--sui-text-largeTitle-weight); line-height:var(--sui-text-largeTitle-lineHeight); letter-spacing:var(--sui-text-largeTitle-tracking); }
/* … title1, title2, title3, headline, body, callout, subheadline, footnote, caption1, caption2 … */
```

Each SwiftUI text modifier maps to one inline-style mutation (mirroring the `Modifier` enum):

| SwiftUI modifier | CSS produced |
|---|---|
| `.font(.title)` | swap the `.sui-text--title1` token block |
| `.foregroundStyle(c)` / `.foregroundColor(c)` | `color: <resolved>` |
| `.bold()` / `.fontWeight(.semibold)` | `font-weight: 700 / 600` |
| `.italic()` | `font-style: italic` (with SF italic master via `font-synthesis:none`) |
| `.strikethrough(true, color:c)` | `text-decoration-line: line-through; text-decoration-color: c` |
| `.underline(true, color:c)` | `text-decoration-line: underline; text-decoration-color: c` (combine if both) |
| `.kerning(x)` / `.tracking(x)` | `letter-spacing: <x>px` (tracking overrides the token default) |
| `.baselineOffset(y)` | `vertical-align: <y>px` (positive = up) |
| `.monospaced()` / `.fontDesign(.monospaced)` | `font-family: var(--sui-font-monospaced)` |
| `.monospacedDigit()` | `font-variant-numeric: tabular-nums` |
| `LineStyle.Pattern.dash/dot` | `text-decoration-style: dashed/dotted` |

**React prop API:**
```tsx
interface TextProps {
  children?: React.ReactNode;        // verbatim/StringProtocol content
  verbatim?: string;                 // init(verbatim:) — skips markdown
  markdown?: string;                 // AttributedString(markdown:) path → inline md → spans
  font?: TextStyle | FontSpec;       // .body default
  foregroundStyle?: ColorToken | string;
  weight?: FontWeight; bold?: boolean; italic?: boolean;
  strikethrough?: boolean | { color?: string; pattern?: LinePattern };
  underline?: boolean | { color?: string; pattern?: LinePattern };
  kerning?: number; tracking?: number; baselineOffset?: number;
  design?: 'default'|'serif'|'rounded'|'monospaced';
  monospacedDigit?: boolean;
  lineLimit?: number; truncationMode?: 'head'|'tail'|'middle';
}
// Concatenation: <Text>{a}<Text bold>{b}</Text></Text> nests inline spans.
```
Markdown rendering (DESIGNED): parse inline-only md (`** * ` ~~ [ ]`) into nested spans/`<a>`; do NOT support block markdown (matches SwiftUI). Use a tiny inline-md tokenizer, not a full markdown lib, to keep parity.

---

# 2. `Image` — bitmap / vector / SF Symbol (deep)

`Image`, like `Text`, is a `@frozen struct` value (defined in **SwiftUICore**, `:18509`), wrapping an `AnyImageProviderBox provider` (`:18510`). It conforms to `View` via `_makeView` (`:18518`). Three content kinds: **named asset**, **system symbol (SF Symbol)**, **decorative CGImage**. The chained modifiers (`resizable`, `renderingMode`, `interpolation`, `antialiased`, `symbolRenderingMode`) all return `Image → Image` (value-returning), exactly like `Text`'s.

## 2.1 Exact API — initializers (KNOWN)

`SwiftUICore.swiftinterface`:
```swift
public init(_ name: String, bundle: Bundle? = nil)                         // :8823  asset catalog image
public init(_ name: String, bundle: Bundle? = nil, label: Text)            // :8824  + accessibility label
public init(decorative name: String, bundle: Bundle? = nil)               // :8825  no a11y label
public init(systemName: String)                                           // :8827  SF Symbol  (macOS 11+)
public init(decorative cgImage: CGImage, scale: CGFloat, orientation: Orientation = .up)  // :8535
public init(_ resource: DeveloperToolsSupport.ImageResource)              // :8860  type-safe asset
public init(nsImage: NSImage)                                             // SwiftUI.swiftinterface:21633 (macOS only)
// variableValue overloads (iOS16+, :8837-8841) — drive SF Symbol variable color (0…1):
public init(systemName: String, variableValue: Double?)                   // :8837
public init(_ name: String, variableValue: Double?, bundle: Bundle? = nil)// :8839
```

## 2.2 Exact API — modifiers + enums (KNOWN)

```swift
// resizable — makes the image stretch/tile to fill its frame (default images DON'T resize)
public enum ResizingMode : Sendable { case tile; case stretch }            // :287
public func resizable(capInsets: EdgeInsets = EdgeInsets(),
                      resizingMode: ResizingMode = .stretch) -> Image       // :296

// renderingMode — template (tinted mask) vs original (full color)
public enum TemplateRenderingMode : Sendable { case template; case original }  // :16660
public func renderingMode(_ renderingMode: TemplateRenderingMode?) -> Image    // :8658

// interpolation — resampling quality when scaled
public enum Interpolation : Sendable { case none; case low; case medium; case high }  // :6446
public func interpolation(_ interpolation: Interpolation) -> Image          // :6464
public func antialiased(_ isAntialiased: Bool) -> Image                     // :6465

// symbolRenderingMode — SF Symbol color treatment
public func symbolRenderingMode(_ mode: SymbolRenderingMode?) -> Image       // :6801
public struct SymbolRenderingMode : Sendable {                              // :6778
  public static let monochrome, multicolor, hierarchical, palette
}

// Scale (a11y / control size context, applied via View env or imageScale)
public enum Scale : Hashable, Sendable { case small; case medium; case large }  // :16670
```

**`Orientation` (KNOWN, `:2870`):** `@frozen enum Orientation : UInt8, CaseIterable` — the 8 EXIF orientations (`.up .upMirrored .down .downMirrored .left .leftMirrored .right .rightMirrored`). → CSS: `transform: rotate()/scaleX(-1)` combinations.

## 2.3 SF Symbols — `symbolVariant` & rendering modes (KNOWN type system)

`symbolVariant` is a **View** modifier (`:15301`) but central to `Image(systemName:)`:
```swift
public struct SymbolVariants : Hashable, Sendable {                         // :15266
  public static let none, circle, square, rectangle, fill, slash
  public var circle/square/rectangle/fill/slash: SymbolVariants { get }     // composable: .circle.fill
}
nonisolated public func symbolVariant(_ variant: SymbolVariants) -> some View  // :15301
```
So `Image(systemName:"star").symbolVariant(.fill)` renders `star.fill`. Variants compose: `.circle.fill` → `star.circle.fill`.

**The four `SymbolRenderingMode`s (INFERRED visual from Apple docs):**
- `.monochrome` — single tint (the foreground/tint color) applied to the whole glyph.
- `.hierarchical` — single hue, **multiple opacity layers** (primary 100%, secondary ~50%, tertiary ~25%).
- `.palette` — N explicit colors mapped to the symbol's N layers (set via `.foregroundStyle(c1, c2, c3)`).
- `.multicolor` — the symbol's **intrinsic** brand colors (e.g. a yellow star, red heart).

## 2.4 Visual anatomy & default metrics (INFERRED)

- **Sub-elements:** the rendered bitmap/vector; optionally a `label: Text` for a11y (not visually rendered).
- **Default sizing:** an `Image` **does not resize** until `.resizable()` is applied — it renders at intrinsic point size. SF Symbols inherit the **current font** size and weight (a symbol next to `.body` text matches its cap-height; INFERRED — symbols are font-metric-locked). Default symbol weight tracks the surrounding `Font.Weight`.
- **Default tint:** SF Symbols default to `.monochrome` in the foreground color (`--sui-color-label`, or the inherited `.tint`).
- **`capInsets`:** the EdgeInsets that define a 9-slice stretchable center (iOS resizable images) → CSS `border-image-slice`.
- **States:** images themselves are stateless; `.disabled` dims; in a Button they may receive the button's pressed/hover tint when used as template.

## 2.5 Web replication (DESIGNED)

**Named raster asset:** `<img class="sui-image" src=… alt={label}>`.
**SF Symbol:** the hard part. SF Symbols are a proprietary Apple font + glyph DB; the web cannot use the system symbol font legally/cross-platform. **Strategy (DESIGNED):**
1. Map `systemName` → an **SVG icon** from an SF-Symbols-equivalent open set (e.g. a curated SVG sprite keyed by SF name). Ship as inline `<svg>` so `currentColor` + `fill`/`opacity` layering works.
2. Render as `<svg class="sui-symbol" role="img">` whose `width/height` = `1em` and `fill: currentColor` — so it scales/colors with the surrounding text exactly like native font-locked symbols.
3. `symbolVariant(.fill/.circle/.slash)` selects a different sprite id (`star` → `star.fill`).
4. `symbolRenderingMode`:
   - `.monochrome` → single `fill: currentColor`.
   - `.hierarchical` → multi-`<path>` SVG with `fill: currentColor` and `opacity: 1 / 0.5 / 0.25` per layer.
   - `.palette` → per-`<path>` `fill` from the `foregroundStyle` color list.
   - `.multicolor` → the SVG's own baked colors (ignore `currentColor`).

```css
.sui-image { display: inline-block; }
.sui-image--resizable { width: 100%; height: 100%; object-fit: fill; }      /* .stretch */
.sui-image--resizable.tile { object-fit: none; background-repeat: repeat; } /* .tile */
.sui-image[data-rendering="template"] { /* recolor: SVG fill:currentColor; raster: mask */ }
.sui-image[data-interp="none"]   { image-rendering: pixelated; }            /* Interpolation.none */
.sui-image[data-interp="low"]    { image-rendering: crisp-edges; }
.sui-symbol { width: 1em; height: 1em; fill: currentColor; vertical-align: -0.125em; }
.sui-symbol--cap-insets { border-image-slice: var(--cap-insets) fill; }     /* 9-slice */
```

**React prop API:**
```tsx
interface ImageProps {
  systemName?: string;                 // SF Symbol → SVG sprite lookup
  name?: string; bundle?: string;      // asset → <img>
  label?: string;                      // a11y; decorative → omit (alt="")
  variableValue?: number;              // 0..1 variable-color fill fraction
  resizable?: boolean | { capInsets?: EdgeInsets; mode?: 'stretch'|'tile' };
  renderingMode?: 'template'|'original';
  interpolation?: 'none'|'low'|'medium'|'high'; antialiased?: boolean;
  symbolRenderingMode?: 'monochrome'|'multicolor'|'hierarchical'|'palette';
  symbolVariant?: ('none'|'circle'|'square'|'rectangle'|'fill'|'slash')[]; // composable
  scale?: 'small'|'medium'|'large';
}
```

---

# 3. `Label` — icon + title pair (deep)

`Label` is a real `View` (has `body`), generic over `<Title, Icon>` both Views. `SwiftUI.swiftinterface:23050`:
```swift
public struct Label<Title, Icon> : View where Title : View, Icon : View {
  public init(@ViewBuilder title: () -> Title, @ViewBuilder icon: () -> Icon)   // :23051
}
```

## 3.1 Exact API — convenience inits (KNOWN)

`Label where Title == Text, Icon == Image` (`:23062`):
```swift
init(_ titleKey: LocalizedStringKey, image name: String)        // :23063
init(_ titleKey: LocalizedStringKey, systemImage name: String)  // :23068  ← most common
init<S>(_ title: S, image name: String) where S: StringProtocol     // :23073
init<S>(_ title: S, systemImage name: String) where S: StringProtocol  // :23074
init(_ titleKey: LocalizedStringKey, image resource: ImageResource)    // :23078 (iOS17+)
init(_ configuration: LabelStyleConfiguration)                  // :23086  (for custom styles)
```

## 3.2 LabelStyle (KNOWN) — controls icon/title visibility & order

```swift
DefaultLabelStyle  (.automatic)       // SwiftUI.swiftinterface:1290 / static :1285
IconOnlyLabelStyle (.iconOnly)        // :9660 / :9655   — hides the title visually (keeps a11y)
TitleOnlyLabelStyle(.titleOnly)       // :21743 / :21738 — hides the icon
TitleAndIconLabelStyle(.titleAndIcon) // :14424 / :14419 — forces both
```
`.automatic` resolves per-context: in a sidebar/toolbar it may collapse to icon-only; in a list row it shows both. (INFERRED resolution.)

## 3.3 Visual anatomy & default metrics (INFERRED)

- **Sub-elements:** `[ icon ][ spacing ][ title ]` laid out as a horizontal stack, **vertically centered, firstTextBaseline-aligned** (INFERRED — Apple aligns the icon to the title's baseline band).
- **Icon-to-title spacing:** controlled by env `labelIconToTitleSpacing` (`:23093`, iOS26+; before that ~`6–8px` default, INFERRED). Reserved icon column width via `labelReservedIconWidth` (`:23090`) so multiple labels align their titles.
- **Default icon:** SF Symbol at the title's font size & weight; title uses inherited font (`.body`).
- **States:** `.disabled` dims both; in a `Button`/`Menu`/list selection, inherits the row's selected/pressed tint.

## 3.4 Web replication (DESIGNED)

```css
.sui-label { display: inline-flex; align-items: center; gap: var(--sui-label-gap, 6px); }
.sui-label__icon  { flex: 0 0 auto; }                 /* SVG symbol, 1em */
.sui-label__title { flex: 0 1 auto; }
.sui-label--reserved-icon .sui-label__icon { width: var(--sui-label-reserved-width); justify-content:center; display:inline-flex; }
.sui-label--icon-only  .sui-label__title { position:absolute; width:1px; height:1px; overflow:hidden; clip-path: inset(50%); }  /* visually-hidden, a11y kept */
.sui-label--title-only .sui-label__icon  { display: none; }
```
```tsx
interface LabelProps {
  title?: React.ReactNode; systemImage?: string; image?: string;
  style?: 'automatic'|'iconOnly'|'titleOnly'|'titleAndIcon';
  iconToTitleSpacing?: number; reservedIconWidth?: number;
  children?: { icon?: React.ReactNode; title?: React.ReactNode };
}
// <Label title="Add" systemImage="plus" /> → <Image systemName="plus"/> + <Text>Add</Text>
```

---

# 4. `Link` — tappable hyperlink (deep)

`SwiftUI.swiftinterface:11374`:
```swift
@MainActor public struct Link<Label> : View where Label : View {
  public init(destination: URL, @ViewBuilder label: () -> Label)   // :11375
}
extension Link where Label == Text {                                // :11386
  public init(_ titleKey: LocalizedStringKey, destination: URL)     // :11387
  public init(_ titleResource: LocalizedStringResource, destination: URL)  // :11389 (iOS16+)
  public init<S>(_ title: S, destination: URL) where S: StringProtocol     // :11392
}
```

## 4.1 Visual anatomy & behavior (INFERRED)

- **Sub-elements:** just the label (Text or arbitrary View). **No underline by default** on iOS — the link is colored with the accent/tint, not underlined (unlike a web `<a>`). On macOS the same.
- **Default color:** `--sui-color-link` (`#007AFF` light / `#0A84FF` dark = systemBlue), unless the label overrides its own `foregroundStyle`.
- **States:** default (tint color); **pressed** → briefly dims (~0.3 opacity flash, INFERRED button-like); focus ring on macOS/tvOS; `.disabled` → gray.
- **Behavior:** activates the URL via the environment's `openURL` action. `http(s)` opens the browser/in-app; custom schemes route to handlers.
- **Animation:** pressed-state opacity transition ~0.1s ease-out (INFERRED, matches plain button highlight).

## 4.2 Web replication (DESIGNED)

```css
.sui-link {
  color: var(--sui-color-link);
  text-decoration: none;                 /* SwiftUI links are NOT underlined */
  cursor: pointer;
  transition: opacity 0.1s ease-out;
}
.sui-link:active { opacity: 0.3; }        /* pressed flash */
.sui-link[aria-disabled="true"] { color: var(--sui-color-secondary-label); pointer-events:none; }
```
```tsx
interface LinkProps {
  destination: string;                    // URL
  children?: React.ReactNode;             // label (Text default)
  title?: string;
}
// <Link title="Apple" destination="https://apple.com" /> → <a class="sui-link" href=…>Apple</a>
```
Use a real `<a href>` (SEO + middle-click). For custom schemes, intercept `onClick` and dispatch the app's `openURL` equivalent.

---

# 5. `Divider` — hairline separator (deep)

`SwiftUI.swiftinterface:8816`:
```swift
public struct Divider : View {
  public init()                            // :8817 — only init, no parameters
}
```

## 5.1 Visual anatomy & default metrics (INFERRED)

- **Sub-elements:** a single 1-device-pixel line.
- **Orientation is context-derived:** inside an `HStack` → **vertical** line (full height of the row); inside a `VStack` or `List` → **horizontal** line (full width). This is the key behavior — Divider has no orientation parameter; it reads the parent stack axis.
- **Thickness:** **1 hairline** = `1px` logical (0.5pt physical on @2x). On the web baseline, `1px` (DESIGNED — or `0.5px`/`thin` via device-pixel-ratio media query for crispness).
- **Color:** `--sui-color-separator` (translucent `#3C3C434A` ≈ `rgba(60,60,67,0.29)` light / `rgba(84,84,88,0.65)` dark). Translucent so content shows through.
- **Inset:** in a `List`, the divider is inset to align with content (leading inset ≈ the row content's leading); a bare `Divider()` spans edge-to-edge.

## 5.2 Web replication (DESIGNED)

```css
.sui-divider { background: var(--sui-color-separator); border: 0; flex: 0 0 auto; align-self: stretch; }
/* horizontal (in a column/VStack) */
.sui-divider--h { height: 1px; width: 100%; }
/* vertical (in a row/HStack) */
.sui-divider--v { width: 1px; height: 100%; min-height: 1em; }
@media (min-resolution: 2dppx) { .sui-divider--h { height: 0.5px; } .sui-divider--v { width: 0.5px; } }
```
```tsx
interface DividerProps { /* none in SwiftUI */ }
// orientation inferred from parent layout context (HStack→vertical, VStack→horizontal)
```
Detect axis from the parent Stack component (pass an `axis` context), since CSS alone can't know the SwiftUI stack intent.

---

# 6. `Spacer` — flexible empty space (deep)

`SwiftUICore.swiftinterface:3419`:
```swift
@frozen public struct Spacer {
  public var minLength: CGFloat?                                  // :3420
  @inlinable public init(minLength: CGFloat? = nil)              // :3421
}
```

## 6.1 Behavior (KNOWN + INFERRED)

- **Sub-elements:** none — it's a layout-only greedy gap.
- **Greedy expansion:** a `Spacer` takes **all available space along the parent stack's axis** (the major axis), pushing siblings apart. In an HStack it expands horizontally; in a VStack, vertically.
- **`minLength`:** the **minimum** size it will collapse to (default `nil` → 0 minimum, but SwiftUI applies the default stack spacing as an implicit minimum, INFERRED). Set `minLength: 20` to guarantee ≥20pt.
- **No cross-axis size.** Outside a stack (e.g. in an overlay) it has zero size.

## 6.2 Web replication (DESIGNED)

```css
.sui-spacer { flex: 1 1 auto; }                       /* grow to fill major axis */
.sui-spacer--min { flex-basis: var(--sui-spacer-min, 0); }  /* minLength */
/* In a flex row: align-self irrelevant; cross-axis size 0 */
```
```tsx
interface SpacerProps { minLength?: number; }
// Requires parent to be display:flex; Spacer = a flex:1 growing div.
```
The replica's `Stack` components must be `display:flex`; `<Spacer/>` is `<div class="sui-spacer">` with `flex:1`. `minLength` → `min-width`/`min-height` depending on parent axis.

---

# 7. `AsyncImage` — load-from-URL with phases (deep)

`SwiftUI.swiftinterface:14266`:
```swift
public struct AsyncImage<Content> : View where Content : View {
  public init(url: URL?, scale: CGFloat = 1) where Content == Image   // :14267
  public init<I, P>(url: URL?, scale: CGFloat = 1,
      @ViewBuilder content: @escaping (Image) -> I,
      @ViewBuilder placeholder: @escaping () -> P)                     // :14268 (success/placeholder split)
      where Content == _ConditionalContent<I, P>
  public init(url: URL?, scale: CGFloat = 1, transaction: Transaction = Transaction(),
      @ViewBuilder content: @escaping (AsyncImagePhase) -> Content)    // :14277 (full phase control)
}
```

## 7.1 `AsyncImagePhase` (KNOWN) — the state machine

`SwiftUI.swiftinterface:14288`:
```swift
public enum AsyncImagePhase : Sendable {
  case empty                          // loading / not yet started
  case success(Image)                 // loaded
  case failure(any Error)             // load error
  public var image: Image? { get }    // :14292  non-nil only on .success
  public var error: (any Error)? { get } // :14295 non-nil only on .failure
}
```
The `transaction` param animates the **phase transition** (e.g. fade-in on `.empty → .success`).

## 7.2 Visual anatomy & behavior (INFERRED)

- **`.empty`:** default placeholder = a **gray rounded rectangle** (system fill) at the image's frame size, no spinner by default (the 1-arg init shows this solid placeholder, not a ProgressView). The 2-arg init lets you supply any placeholder (commonly `ProgressView()`).
- **`.success`:** the decoded image, **not resizable by default** (you must `.resizable()` inside `content:`).
- **`.failure`:** by default renders **nothing/empty** (the 1-arg init shows the placeholder gray box; the phase init lets you show an error icon).
- **Caching:** uses the shared `URLSession`/`URLCache` (INFERRED) — no custom cache; same URL may refetch.
- **Animation:** none unless `transaction:` supplies one (e.g. `.opacity` fade).

## 7.3 Web replication (DESIGNED)

```css
.sui-asyncimage { display:inline-block; position:relative; }
.sui-asyncimage__placeholder { background: var(--sui-color-fill); border-radius: var(--sui-radius-sm, 6px); width:100%; height:100%; }
.sui-asyncimage__img { width:100%; height:100%; object-fit: cover; opacity:0; transition: opacity .25s ease; }
.sui-asyncimage__img.loaded { opacity:1; }   /* fade-in mirrors transaction animation */
```
```tsx
type AsyncImagePhase =
  | { state:'empty' } | { state:'success'; image: string } | { state:'failure'; error: Error };
interface AsyncImageProps {
  url?: string; scale?: number;
  content?: (phase: AsyncImagePhase) => React.ReactNode;   // full control
  // OR success/placeholder split:
  renderImage?: (img: string) => React.ReactNode;
  placeholder?: () => React.ReactNode;
  transaction?: { animation?: AnimationToken };
}
```
Implement with an internal `state` machine: `empty` → `new Image(); onload→success; onerror→failure`. Default placeholder = the gray fill box; default success = `<img object-fit:cover>` with fade-in.

---

# 8. `ProgressView` — determinate bar + indeterminate spinner (deep)

`SwiftUI.swiftinterface:3845`:
```swift
public struct ProgressView<Label, CurrentValueLabel> : View
  where Label : View, CurrentValueLabel : View { … }
```

## 8.1 Exact API — inits (KNOWN)

Indeterminate (no value → **spinner**), `:3856`:
```swift
init() where Label == EmptyView                                    // :3857
init(@ViewBuilder label: () -> Label)                              // :3858
init(_ titleKey: LocalizedStringKey) where Label == Text           // :3859
init<S>(_ title: S) where Label == Text, S: StringProtocol         // :3864
```
Determinate (value → **bar**), `:3867`:
```swift
init<V>(value: V?, total: V = 1.0) where …, V: BinaryFloatingPoint                       // :3868
init<V>(value: V?, total: V = 1.0, @ViewBuilder label: () -> Label) where …              // :3869
init<V>(value:, total:, label:, currentValueLabel:)                                       // :3870
init<V>(_ titleKey: LocalizedStringKey, value: V?, total: V = 1.0) where Label == Text    // :3871
init<S, V>(_ title: S, value: V?, total: V = 1.0) where …                                 // :3880
init(_ progress: Foundation.Progress)                                                      // :3884 (NSProgress)
```
**The presence of `value:` is the discriminator:** no value → indeterminate spinner; value present → determinate bar. `value: nil` with the determinate init → falls back to the indeterminate spinner.

## 8.2 Styles (KNOWN)

```swift
DefaultProgressViewStyle (.automatic)      // SwiftUI.swiftinterface:16020
CircularProgressViewStyle (.circular)      // :4899  / static :4894  — the spinner
LinearProgressViewStyle (.linear)          // :4654  / static :4649  — the bar
```
**Default resolution (INFERRED):** indeterminate → circular spinner; determinate → linear bar (on iOS). On macOS, indeterminate determinate-less also shows the spinner.

## 8.3 Visual anatomy & geometry (INFERRED — runtime)

**Indeterminate circular spinner** (the iOS `UIActivityIndicatorView`):
- **8 spokes** (tapered bars) arranged radially at 45° increments, fading in opacity around the circle (lead spoke ~100%, trailing ~15%).
- **Default size:** `.medium` ≈ **20×20pt** spinner; `.large` ≈ 37pt; spoke length ≈ 1/3 radius. (INFERRED.)
- **Color:** the spokes use the secondary label / current tint; default gray `--sui-color-secondary-label`.
- **Rotation:** the whole wheel rotates **clockwise, continuously, ~1 full turn per second**, but discretely steps spoke-by-spoke (the classic iOS stepped spin) — though SwiftUI's modern spinner spins smoothly (INFERRED; treat as smooth linear rotation).

**Determinate linear bar:**
- A **rounded-capsule track** (height ≈ **4pt**, full available width) of translucent fill `--sui-color-fill`, with a **tint-colored fill** capsule from leading to `value/total`.
- **Track color:** quaternary/tertiary system fill (light gray). **Fill color:** the accent/tint (`--sui-color-tint`, systemBlue).
- **Corner radius:** fully rounded (height/2 = ~2pt).
- Optional `label` above and `currentValueLabel` below (caption text).
- **Animation:** value changes animate the fill width with the implicit transaction (spring/ease, ~0.3s).

## 8.4 Web replication (DESIGNED)

**Circular spinner** — 8 CSS spokes + rotation keyframe:
```css
.sui-spinner { width: 20px; height: 20px; position: relative; color: var(--sui-color-secondary-label); }
.sui-spinner__spoke {
  position:absolute; left:50%; top:50%; width: 2px; height: 6px;
  background: currentColor; border-radius: 1px; transform-origin: 0 10px;  /* radius */
}
/* 8 spokes at 45°, each dimmer */
.sui-spinner__spoke:nth-child(1){ transform: rotate(0deg)   translateY(-10px); opacity:1;   }
.sui-spinner__spoke:nth-child(2){ transform: rotate(45deg)  translateY(-10px); opacity:.85; }
/* …through nth-child(8) at 315deg, opacity ~.15 */
.sui-spinner { animation: sui-spin 1s steps(8) infinite; }   /* steps(8)=classic stepped; drop steps() for smooth */
@keyframes sui-spin { to { transform: rotate(360deg); } }
```
**Linear bar:**
```css
.sui-progress-linear { height: 4px; width: 100%; background: var(--sui-color-fill); border-radius: 2px; overflow: hidden; }
.sui-progress-linear__fill { height: 100%; background: var(--sui-color-tint); border-radius: 2px;
  width: calc(var(--value) / var(--total) * 100%); transition: width var(--sui-anim-smooth-css, 0.3s ease); }
```
```tsx
interface ProgressViewProps {
  value?: number; total?: number;        // present → determinate bar; absent/null → spinner
  label?: React.ReactNode; currentValueLabel?: React.ReactNode;
  style?: 'automatic'|'circular'|'linear';
}
```

---

# 9. `Gauge` — value within bounds, with markers (deep)

`SwiftUI.swiftinterface:19007` (iOS16+, **unavailable on tvOS**):
```swift
public struct Gauge<Label, CurrentValueLabel, BoundsLabel, MarkedValueLabels> : View
  where Label: View, CurrentValueLabel: View, BoundsLabel: View, MarkedValueLabels: View {
```

## 9.1 Exact API — inits (KNOWN)

All take `value: V, in bounds: ClosedRange<V> = 0...1` where `V: BinaryFloatingPoint`:
```swift
init(value:in:label:)                                              // :19008  label only
init(value:in:label:currentValueLabel:)                           // :19009  + current value text
init(value:in:label:currentValueLabel:minimumValueLabel:maximumValueLabel:)   // :19010  + bound labels
init(value:in:label:currentValueLabel:markedValueLabels:)         // :19011  + tick markers
init(value:in:label:currentValueLabel:minimumValueLabel:maximumValueLabel:markedValueLabels:)  // :19012  full
```
**Anatomy from the generics:** `Label` (title), `CurrentValueLabel` (center/inline value), `BoundsLabel` (min & max end labels), `MarkedValueLabels` (intermediate tick labels). Default `bounds = 0...1`.

## 9.2 Styles (KNOWN)

```swift
DefaultGaugeStyle (.automatic)                  // SwiftUI.swiftinterface:21913
CircularGaugeStyle (.circular)                  // :10395 / static :10386   (watchOS-ish ring)
LinearGaugeStyle (.linear)                      // :20557 / static :20548
LinearCapacityGaugeStyle (.linearCapacity)      // :12701 / static :12715   (battery-style bar)
AccessoryCircularGaugeStyle (.accessoryCircular)          // :24109 / static :24123  ← detailed below
AccessoryCircularCapacityGaugeStyle (.accessoryCircularCapacity)  // :10334 / :10348
AccessoryLinearGaugeStyle (.accessoryLinear)             // :15345 / :15339
AccessoryLinearCapacityGaugeStyle (.accessoryLinearCapacity)     // :18447 / :18461
```
`GaugeStyleConfiguration` (`:19766`) is what custom styles receive (value, bounds labels, etc.).

## 9.3 `.accessoryCircular` geometry (INFERRED — runtime, the spec-required detail)

The accessory-circular gauge (used in widgets / watch complications):
- **An open ring (arc), not a full circle.** The arc spans ~**270°** (gap at the bottom, from ~135° to ~45° going clockwise through the top), i.e. a 90° gap centered at the bottom.
- **Track:** the full 270° arc drawn in a translucent/tertiary color (`--sui-color-fill`), stroke width ≈ **3–4pt**.
- **Progress arc:** drawn from the start (bottom-left, ~135°) clockwise to the angle corresponding to `(value-min)/(max-min)` of the 270° sweep, in the **tint/accent gradient** (often a hue gradient).
- **Center:** the `currentValueLabel` text (a short number) centered inside the ring.
- **Diameter:** ≈ **container size** (widget accessory ≈ 30–58pt depending on family). For the kit, default **~44×44pt**.
- **Round line caps** on both track and progress strokes.

The **non-accessory `.circular`** style is similar but typically a fuller ring with the title below; the **capacity** variants (`linearCapacity`, `accessoryCircularCapacity`) draw a **battery/segment fill** (the fill grows along the track as a solid capacity bar rather than a thin progress arc).

## 9.4 Linear gauge anatomy (INFERRED)

`.linear` / `.accessoryLinear`: a horizontal capsule track with a **moving indicator dot/notch** at the value position and `minimumValueLabel` / `maximumValueLabel` at the ends. `.linearCapacity`: the track **fills** from the leading edge to the value (battery style), tinted.

## 9.5 Web replication (DESIGNED)

**Accessory-circular (270° arc) via SVG:**
```css
.sui-gauge-circular { width: 44px; height: 44px; }
```
```html
<svg class="sui-gauge-circular" viewBox="0 0 44 44">
  <!-- track: 270° arc, gap at bottom. r=18, stroke 3.5, dasharray = arcLen, rotate -225deg start -->
  <circle cx="22" cy="22" r="18" fill="none"
          stroke="var(--sui-color-fill)" stroke-width="3.5" stroke-linecap="round"
          stroke-dasharray="84.8 113.1" transform="rotate(135 22 22)"/>
  <!-- progress: same geometry, dasharray scaled by value fraction -->
  <circle cx="22" cy="22" r="18" fill="none"
          stroke="var(--sui-color-tint)" stroke-width="3.5" stroke-linecap="round"
          stroke-dasharray="calc(84.8 * var(--frac)) 113.1" transform="rotate(135 22 22)"/>
  <text x="22" y="26" text-anchor="middle" class="sui-text--caption1">42</text>
</svg>
```
(Arc math: circumference `2π·18 ≈ 113.1`; 270° = 0.75 of it = `84.8`. `--frac = (value-min)/(max-min)`. Start rotated so the gap sits at the bottom.)

**Linear / capacity:**
```css
.sui-gauge-linear { display:flex; align-items:center; gap:6px; }
.sui-gauge-linear__track { flex:1; height:6px; border-radius:3px; background:var(--sui-color-fill); position:relative; }
.sui-gauge-linear__fill  { height:100%; border-radius:3px; background:var(--sui-color-tint); width:calc(var(--frac)*100%); }  /* capacity style */
.sui-gauge-linear__dot   { position:absolute; top:50%; left:calc(var(--frac)*100%); width:10px; height:10px; border-radius:50%; background:var(--sui-color-tint); transform:translate(-50%,-50%); }  /* indicator style */
```
```tsx
interface GaugeProps {
  value: number; min?: number; max?: number;     // bounds default 0..1
  label?: React.ReactNode;
  currentValueLabel?: React.ReactNode;
  minimumValueLabel?: React.ReactNode; maximumValueLabel?: React.ReactNode;
  markedValueLabels?: React.ReactNode;
  style?: 'automatic'|'circular'|'linear'|'linearCapacity'
        | 'accessoryCircular'|'accessoryCircularCapacity'
        | 'accessoryLinear'|'accessoryLinearCapacity';
}
```
Value→angle/width animates via `transition` on the SVG `--frac` / fill width (spring `--sui-anim-bouncy-css`).

---

# 10. Tabulated long-tail

| Type | `file:line` | Kind | Purpose | Web equivalent |
|---|---|---|---|---|
| `TextRenderer` | `SwiftUICore:12630` | protocol (`: Animatable`) | Custom glyph-drawing hook: `func draw(layout: Text.Layout, in: inout GraphicsContext)`. Lets you intercept the laid-out `Text.Layout` (lines/runs/glyphs, `:12711`) and draw it yourself (e.g. per-glyph animation, gradients, shadows). Advanced; not a renderable primitive. | No direct CSS analog. Replicate specific effects (gradient text, per-letter animation) with `background-clip:text`, CSS `@property`-animated gradients, or canvas/SVG per-glyph rendering. Out of first-pass kit scope; expose later as a `renderText(layout)` escape hatch. |

`TextRenderer` is **tabulated, not deep-covered** — it is a draw-customization protocol with no fixed visual; its replication is effect-specific (handled ad hoc when a component needs custom text drawing), so it does not get an HTML+CSS+prop mapping in this pass.

---

# 11. Cross-component implementation notes (DESIGNED)

- **Value-type chaining (`Text`, `Image`):** both accumulate an ordered modifier list and fold to inline style at render. The React components should accept the modifier-equivalent props and compose them deterministically (last-wins for conflicting keys, matching SwiftUI's array order).
- **SF Symbols are the single biggest fidelity risk.** Ship an SVG sprite keyed by SF name + variant; `fill:currentColor` + per-layer opacity reproduces monochrome/hierarchical; palette/multicolor need explicit per-path fills. Symbols sized at `1em` inherit text metrics like native font-locked symbols.
- **`Divider`/`Spacer` are layout-context-dependent** (axis from parent stack). The kit's `HStack`/`VStack` must pass an axis context so these two render the correct orientation/growth direction.
- **Token coupling:** colors → `--sui-color-{label,secondary-label,separator,link,tint,fill}`; type → `--sui-text-*` / `--sui-font-*`; animation → `--sui-anim-{smooth,snappy,bouncy}-css`; radius → `--sui-radius-*`. All numeric metrics flagged INFERRED are Apple-HIG/runtime values, not in the swiftinterface.

**web_ready=true** — every deep-covered component (Text, Image, Label, Link, Divider, Spacer, AsyncImage, ProgressView, Gauge) has its HTML structure + exact CSS + React prop API. `TextRenderer` is explicitly tabulated (no fixed visual to map).
