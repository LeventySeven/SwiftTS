# SwiftUI Cluster C3 — Value-Input Controls (RE Teardown → Web Replica Spec)

**Cluster:** C3 `value-input` · **Module:** SwiftUI (all 6 types) · **Target:** pixel-1:1 TS/React (Next.js) UI kit.

**Source of truth (Tier-1A):** `SwiftUI.framework/.../arm64e-apple-macos.swiftinterface` (cited as `SwiftUI:LINE`) and `SwiftUICore.framework/.../arm64e-apple-macos.swiftinterface` (`SUICore:LINE`). Visual metrics that the interface cannot show are labeled **INFERRED** (Apple HIG / AppKit-UIKit RE / runtime inspection) or **DESIGNED** (my engineering for the web). Token names (`var(--sui-color-*)`, `.sui-body`, `radius.*`) reference the W1 token spec in `swiftui/tokens/{colors,typography,spacing,shapes-effects}.md`.

**Types covered (all 6 deep-covered):**

| Type | kind | decl line | Web equivalent |
|---|---|---|---|
| `TextField` | struct | `SwiftUI:5193` | `<input type="text">` / `<textarea>` (axis=.vertical) wrapped |
| `SecureField` | struct | `SwiftUI:16397` | `<input type="password">` wrapped |
| `TextEditor` | struct | `SwiftUI:3057` | `<textarea>` (scrolling, multiline) wrapped |
| `Slider` | struct | `SwiftUI:3655` | `role=slider` div (track + fill + thumb) — NOT native `<input range>` |
| `Stepper` | struct | `SwiftUI:19824` | `−`/`+` button pair `<div role=group>` |
| `ColorPicker` | struct | `SwiftUI:23334` | swatch button → `<input type=color>` / custom popover |

All six are `SwiftUICore.View` structs whose real `init`s live in `extension` blocks (the base `struct` decl only exposes `body`). Each section below quotes the actual `init` signatures from those extensions.

---

## 0. Shared foundations (apply to every C3 control)

### 0.1 The `Binding<Value>` two-way contract — KNOWN

Every C3 control takes a `SwiftUICore.Binding<T>` for its value (`text:`, `value:`, `selection:`). A `Binding` is a `{ get, set }` pair. The web analog for **all** of them:

```tsx
// DESIGNED — the universal binding shim. Every C3 component takes value + onChange,
// OR a single `binding={[value, setValue]}` tuple to mirror SwiftUI's $value.
type Binding<T> = { value: T; onChange: (next: T) => void };
// Usage parity:  TextField("Name", text: $name)  ⇄  <TextField value={name} onChange={setName} />
```

### 0.2 The label / title / prompt triad — KNOWN (`SwiftUI:5203`, `:16407`, `:142`)

Three label sources recur across TextField/SecureField/Stepper/ColorPicker:
- **`titleKey: LocalizedStringKey`** / **`title: S where S: StringProtocol`** — the *accessibility label* AND, on some platforms/styles, a leading visible label. For a bare iOS `TextField`, the title doubles as the placeholder when no `prompt:` is given.
- **`prompt: Text?`** (iOS 15+/macOS 12+, `SwiftUI:5238`) — the **placeholder**. When present it overrides the title for placeholder duty; the title stays as a11y label only.
- **`@ViewBuilder label: () -> Label`** — arbitrary view label (the `where Label == Text` extensions are the convenience overloads).

**Web mapping (DESIGNED, used by all text controls):**
```tsx
// label (string|node) → aria-label + optional visible <label>; prompt → placeholder attr.
// Precedence mirrors SwiftUI: prompt ?? title  →  placeholder; title → aria-label always.
const placeholder = prompt ?? (typeof label === "string" ? label : undefined);
const ariaLabel   = typeof label === "string" ? label : undefined;
```

### 0.3 Environment that every control reads — KNOWN (cross-cluster)

- **`.disabled(Bool)`** → `EnvironmentValues.isEnabled`. Disabled visual = **0.3–0.35 opacity** of the whole control (INFERRED, the canonical iOS disabled alpha). Web: `[disabled]{opacity:.3;pointer-events:none}`.
- **`.tint(_:)` / `Color.accentColor`** (`SUICore:1918`, default `systemBlue` = `#007AFF` light / `#0A84FF` dark) → the fill of Slider, the on-state, the focus ring, the ColorPicker chrome. Web: `var(--sui-color-tint)`.
- **`.controlSize(_:)`** (`.mini/.small/.regular/.large/.extraLarge`) → scales height/font of macOS text controls, slider, stepper. Default `.regular`. See spacing token §4.
- **`@FocusState` + `.focused(_:equals:)`** → drives the focus ring. Web: native `:focus-visible` + a `focused` controlled prop.
- **`.foregroundStyle` / text color** → `var(--sui-color-label)` (primary label) for entered text; placeholder = `var(--sui-color-placeholder-text)` (= `rgba(60,60,67,0.3)` light / `rgba(235,235,245,0.3)` dark, from colors token §2 — numerically identical to `tertiaryLabel`).

### 0.4 Typography — KNOWN-from-tokens

Text content in **all** C3 text controls renders at **`.body`** = `.sui-body` = 17px / 400 / 22px line-height / −0.41px tracking (typography token `:218`). On macOS `.regular` controlSize the effective size renders ~13px in the desktop metrics; the kit targets the iOS canonical 17px body and scales down via `controlSize`. Slider min/max value labels and Stepper value render at `.body` too unless restyled.

---

## 1. TextField — `SwiftUI:5193`

```swift
public struct TextField<Label> : SwiftUICore.View where Label : SwiftUICore.View   // SwiftUI:5193
```

The single-line (and, with `axis:`, multi-line-growing) text entry primitive. `Label` defaults to `Text` via the convenience extensions.

### 1.1 Exact API — KNOWN (verbatim, with cite)

**A. String binding — the everyday form** (`SwiftUI:5275`, `:5286`, `:5290–5298`):
```swift
// where Label == Text:
init(_ titleKey: LocalizedStringKey, text: Binding<String>)                                    // SwiftUI:5291 (calls onEditingChanged:{_ in}, onCommit:{})
init<S>(_ title: S, text: Binding<String>) where S : StringProtocol                            // SwiftUI:5297
init(_ titleKey: LocalizedStringKey, text: Binding<String>, prompt: Text?)                     // SwiftUI:5238
init<S>(_ title: S, text: Binding<String>, prompt: Text?) where S : StringProtocol             // SwiftUI:5246
// arbitrary label:
init(text: Binding<String>, prompt: Text? = nil, @ViewBuilder label: () -> Label)              // SwiftUI:5252
```

**B. Multiline-growing — the `axis:` form (iOS 16 / macOS 13)** (`SwiftUI:5205`, `:5217`, `:5234`):
```swift
init(_ titleKey: LocalizedStringKey, text: Binding<String>, axis: Axis)                                  // SwiftUI:5205
init(_ titleKey: LocalizedStringKey, text: Binding<String>, prompt: Text?, axis: Axis)                   // SwiftUI:5217
init<S>(_ title: S, text: Binding<String>, axis: Axis) where S : StringProtocol                          // SwiftUI:5228
init<S>(_ title: S, text: Binding<String>, prompt: Text?, axis: Axis) where S : StringProtocol           // SwiftUI:5230
init(text: Binding<String>, prompt: Text? = nil, axis: Axis, @ViewBuilder label: () -> Label)            // SwiftUI:5234
```
`Axis` is `SUICore` `@frozen public enum Axis : Int8, CaseIterable` (`SUICore:2440`) with cases **`.horizontal`** and **`.vertical`**. `axis: .vertical` makes the field grow downward as lines wrap (combine with `.lineLimit(_:reservesSpace:)` to cap/floor the height) — this is the SwiftUI "multiline TextField."

**C. Text-selection form (iOS 18 / macOS 15)** (`SwiftUI:5263`, `:5272`):
```swift
init(_ titleKey: LocalizedStringKey, text: Binding<String>, selection: Binding<TextSelection?>, prompt: Text? = nil, axis: Axis? = nil)   // SwiftUI:5263
init(text: Binding<String>, selection: Binding<TextSelection?>, prompt: Text? = nil, axis: Axis? = nil, @ViewBuilder label: () -> Label)  // SwiftUI:5272
```
`TextSelection` is `public struct TextSelection : Equatable, Hashable` (`SwiftUI:19500`) — exposes the caret/range. Web analog = `selectionStart`/`selectionEnd` on the DOM input.

**D. FormatStyle binding — typed values (numbers/dates) through a parser** (`SwiftUI:116`, `:144`, `:171`, `:175`):
```swift
// value + ParseableFormatStyle (the modern, preferred numeric/date entry):
init<F>(_ titleKey: LocalizedStringKey, value: Binding<F.FormatInput?>, format: F, prompt: Text? = nil)   // SwiftUI:116
        where F : ParseableFormatStyle, F.FormatOutput == String
init<F>(_ titleKey: LocalizedStringKey, value: Binding<F.FormatInput>,  format: F, prompt: Text? = nil)   // SwiftUI:128
init<F>(value: Binding<F.FormatInput?>, format: F, prompt: Text? = nil, @ViewBuilder label: () -> Label)  // SwiftUI:144
init<F>(value: Binding<F.FormatInput>,  format: F, prompt: Text? = nil, @ViewBuilder label: () -> Label)  // SwiftUI:146
// value + legacy Foundation.Formatter:
init<V>(_ titleKey: LocalizedStringKey, value: Binding<V>, formatter: Formatter, prompt: Text?)           // SwiftUI:150
init<V>(value: Binding<V>, formatter: Formatter, prompt: Text? = nil, @ViewBuilder label: () -> Label)    // SwiftUI:165
```
**This is how SwiftUI does "numeric input."** `TextField(value: $amount, format: .number)` or `.currency(code:)` / `.percent`; `format: .dateTime` for dates. The field holds a `String` internally, parses on commit via the `ParseableFormatStyle`, and writes back the typed `F.FormatInput`. **Web replica MUST replicate this** as a parse-on-blur/commit pipeline (see §1.4 prop API `format`).

`onEditingChanged:`/`onCommit:` variants exist but are **deprecated** (`SwiftUI:190+`, message: "Use `View.onSubmit(of:_:)` … Use `FocusState`"). The replica exposes `onSubmit` + `onFocusChange` instead.

### 1.2 The three TextFieldStyles — KNOWN (`SwiftUI:10412`, `:1859`, `:7666`, `:16715`, `:20676`)

```swift
public protocol TextFieldStyle { /* … */ }                                    // SwiftUI:10412
public struct DefaultTextFieldStyle  : TextFieldStyle { }                      // SwiftUI:1859
public struct RoundedBorderTextFieldStyle : TextFieldStyle { }                 // SwiftUI:7666
public struct PlainTextFieldStyle    : TextFieldStyle { }                      // SwiftUI:16715
public struct SquareBorderTextFieldStyle : TextFieldStyle { }                  // SwiftUI:20676 (macOS only)
nonisolated public func textFieldStyle<S>(_ style: S) -> some View where S : TextFieldStyle  // SwiftUI:10427
```
Applied via `.textFieldStyle(.roundedBorder)` / `.plain` / `.automatic`. On **macOS** `.automatic` (Default) renders as a 1px-bordered bezel field; on **iOS** `.automatic` = `.plain` (borderless, the field gets its chrome from the surrounding `Form`/`List`). `.roundedBorder` is the classic rounded-rect bezel. `.squareBorder` is macOS-only (sharp corners).

### 1.3 Visual anatomy + metrics — INFERRED (HIG / runtime)

**Sub-elements:** `[ optional leading label ] [ text run / caret / placeholder ] [ optional clear button (iOS) ]` inside a **container** (the bezel, present only for `.roundedBorder`/`.default`-on-macOS).

| Property | `.plain` | `.roundedBorder` | `.default` (macOS bezel) | Token |
|---|---|---|---|---|
| Height (iOS `.regular`) | content-driven (~30pt min hit) | **30pt** | — | `metric.control.regular ≈ 30` |
| Height (macOS `.regular`) | ~19pt text | **~21–22pt** | ~21pt | spacing token §4 |
| H-padding (inner) | 0 | **7pt** | 7pt | DESIGNED `8px` |
| V-padding (inner) | 0 | **~6–7pt** | 6pt | |
| Corner radius | 0 | **6pt continuous** | 6pt (macOS) / 0 sharp (square) | `radius.field ≈ 6` continuous |
| Border (idle) | none | `1px` `var(--sui-color-separator)` / `systemGray4` | 1px bezel | `#3C3C434A` light |
| Background | clear | `var(--sui-color-secondary-system-background)` / white-ish | textBackgroundColor | |
| Text color | `var(--sui-color-label)` | same | same | `.sui-body` 17px |
| Placeholder color | `var(--sui-color-placeholder-text)` `rgba(60,60,67,0.3)` | same | same | |
| Caret color | `var(--sui-color-tint)` | same | same | |

**Focus ring (KEY visual):**
- **macOS:** a **3px accentColor glow** around the field. RE/community confirm the focused style ≈ blue stroke at **opacity 0.7, lineWidth 3** ([fullstackstanley](https://www.fullstackstanley.com/articles/replicating-the-macos-search-textfield-in-swiftui/)). Replica: `box-shadow: 0 0 0 3px color-mix(in srgb, var(--sui-color-tint) 60%, transparent)`.
- **iOS:** `.roundedBorder` shows **no** focus ring by default; focus is implied by the blinking caret. `.plain` inside a Form shows a subtle selection.

**Clear button (iOS):** trailing ⓧ (`xmark.circle.fill`, `systemGray3`) appearing while-editing when non-empty. ~17pt glyph. Web: a `<button>` `×` shown on `:focus-within` + non-empty.

### 1.4 Behavior — INFERRED

- **State machine:** `idle → focused (caret on, onFocusChange(true)) → editing (text mutates binding live) → commit (Return/blur → onSubmit + onCommit, parse if format) → idle`.
- **Multiline (`axis:.vertical`):** Return inserts newline UNLESS `.lineLimit(1)`; field height = `lineHeight × lineCount` clamped to `lineLimit` range; grows with a smooth `~0.2s ease` (DESIGNED — native uses an implicit layout animation).
- **Submit:** `.onSubmit { }` fires on Return; `.submitLabel(_:)` (`SwiftUI:8739`, struct `SubmitLabel` `:8708`) sets the keyboard return-key glyph: cases `.done .go .send .join .route .search .return .next .continue` (`SwiftUI:8708+`). Web: maps to `enterkeyhint` attr (`done→done, go→go, send→send, search→search, next→next, return→enter, continue→enter`).
- **Keyboard/content:** iOS `.keyboardType(_:)` & `.textContentType(_:)` (`SwiftUI:18712`, AppKit `NSTextContentType`); `.textInputAutocapitalization`, `.autocorrectionDisabled(_:)` (`SwiftUI:20377`). Web: `inputmode` + `autocomplete` + `autocapitalize` + `autocorrect="off"`.
- **No animation on the bezel itself**; only the focus glow fades in (`~0.15s ease-out`, DESIGNED).

### 1.5 Web replication — HTML + CSS + React prop API

**HTML structure:**
```html
<div class="sui-textfield sui-tfs-roundedBorder" data-focused="false" data-disabled="false">
  <!-- optional leading label slot -->
  <input class="sui-textfield__input sui-body" type="text"
         placeholder="…" aria-label="…" enterkeyhint="done" inputmode="text" />
  <button class="sui-textfield__clear" aria-label="Clear">✕</button> <!-- iOS, while-editing+nonempty -->
</div>
<!-- axis=.vertical swaps <input> for <textarea rows=1> with auto-grow -->
```

**CSS (verbatim — paste-ready):**
```css
.sui-textfield {                       /* the bezel container */
  display: flex; align-items: center; gap: 6px;
  font: var(--sui-text-body-weight) var(--sui-text-body-size)/var(--sui-text-body-lineHeight) "SF Pro Text", -apple-system, system-ui, sans-serif;
  letter-spacing: var(--sui-text-body-tracking);
  color: var(--sui-color-label);
}
.sui-textfield__input {
  flex: 1 1 auto; min-width: 0; border: none; background: transparent;
  font: inherit; letter-spacing: inherit; color: inherit;
  caret-color: var(--sui-color-tint); outline: none; padding: 0;
}
.sui-textfield__input::placeholder { color: var(--sui-color-placeholder-text); opacity: 1; }

/* .roundedBorder */
.sui-tfs-roundedBorder {
  padding: 7px 8px; border-radius: 6px;                 /* radius.field, continuous fallback */
  border: 1px solid var(--sui-color-separator);
  background: var(--sui-color-secondary-system-background);
  transition: box-shadow .15s ease-out, border-color .15s ease-out;
}
.sui-tfs-roundedBorder[data-focused="true"] {
  border-color: var(--sui-color-tint);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sui-color-tint) 60%, transparent);  /* macOS focus ring */
}
/* .plain */
.sui-tfs-plain { padding: 0; border: none; background: transparent; }
/* .squareBorder (macOS) — same as roundedBorder but border-radius:0 */
.sui-tfs-squareBorder { border-radius: 0; }

/* error state (DESIGNED — SwiftUI has no built-in error style; convention = red border) */
.sui-textfield[data-invalid="true"] { border-color: var(--sui-color-system-red); }
.sui-textfield[data-disabled="true"] { opacity: .3; pointer-events: none; }

.sui-textfield__clear {
  display: grid; place-items: center; width: 17px; height: 17px; border: none;
  border-radius: 50%; background: var(--sui-color-system-gray-3); color: var(--sui-color-secondary-system-background);
  font-size: 11px; cursor: default;
}
```

**React prop API (idiomatic mirror):**
```tsx
type TextFieldStyle = "automatic" | "plain" | "roundedBorder" | "squareBorder";
type Axis = "horizontal" | "vertical";
type SubmitLabel = "done"|"go"|"send"|"join"|"route"|"search"|"return"|"next"|"continue";

interface TextFieldProps {
  value: string;                       // ⇄ text: Binding<String>
  onChange: (s: string) => void;       // the binding setter
  title?: string;                      // ⇄ _ titleKey  (a11y label + iOS placeholder fallback)
  prompt?: string;                     // ⇄ prompt: Text?  → placeholder
  axis?: Axis;                         // ⇄ axis:  ("vertical" → <textarea> auto-grow)
  lineLimit?: number | { min?: number; max: number; reservesSpace?: boolean };
  fieldStyle?: TextFieldStyle;         // ⇄ .textFieldStyle()  (default "automatic")
  submitLabel?: SubmitLabel;           // ⇄ .submitLabel()  → enterkeyhint
  onSubmit?: () => void;               // ⇄ .onSubmit
  onFocusChange?: (focused: boolean) => void;
  disabled?: boolean;
  // numeric/typed entry (⇄ value:format:) — DESIGNED parse pipeline:
  format?: { parse: (s: string) => unknown | null; render: (v: unknown) => string };
  // iOS input hints:
  keyboardType?: "default"|"numberPad"|"decimalPad"|"emailAddress"|"phonePad"|"url";
  textContentType?: string;            // → autocomplete
  autocapitalization?: "never"|"words"|"sentences"|"characters";
  autocorrectionDisabled?: boolean;
  invalid?: boolean;                   // DESIGNED error state
}
// <TextField title="Name" value={name} onChange={setName} prompt="Enter name" fieldStyle="roundedBorder" />
// <TextField value={amount} onChange={setAmount} format={currencyUSD} fieldStyle="roundedBorder" />
```
The `format` prop replicates `TextField(value:format:)`: render `format.render(typedValue)` into the input, and on submit/blur run `format.parse(inputString)` — on `null`, reject and revert; otherwise write the typed value back.

---

## 2. SecureField — `SwiftUI:16397`

```swift
public struct SecureField<Label> : SwiftUICore.View where Label : SwiftUICore.View   // SwiftUI:16397
```

A `TextField` that masks its content (password entry). **Single-line only** — there is no `axis:` overload. It is otherwise a strict subset of TextField's string-binding API.

### 2.1 Exact API — KNOWN (verbatim)

```swift
// where Label == Text:
init(_ titleKey: LocalizedStringKey, text: Binding<String>)                                 // SwiftUI:16430 (calls onCommit:{})
init<S>(_ title: S, text: Binding<String>) where S : StringProtocol                         // SwiftUI:16440
init(_ titleKey: LocalizedStringKey, text: Binding<String>, prompt: Text?)                  // SwiftUI:16408
init<S>(_ title: S, text: Binding<String>, prompt: Text?) where S : StringProtocol          // SwiftUI:16419
// arbitrary label:
init(text: Binding<String>, prompt: Text? = nil, @ViewBuilder label: () -> Label)           // SwiftUI:16423
// deprecated onCommit variants (renamed → SecureField.init(_:text:), use .onSubmit):
init(_ titleKey: LocalizedStringKey, text: Binding<String>, onCommit: @escaping () -> Void) // SwiftUI:16453
init<S>(_ title: S, text: Binding<String>, onCommit: @escaping () -> Void) where S : StringProtocol // SwiftUI:16459
```
Notice there is **no `value:format:`, no `axis:`, no `selection:`** overload — confirming SecureField is single-line, string-only. (Differs from TextField only by masking + reduced API.)

### 2.2 Visual anatomy + metrics — INFERRED

Identical container/bezel to TextField (`.textFieldStyle` applies the same way — `.roundedBorder`/`.plain`/`.automatic`). The ONLY visual differences:
- **Masked glyphs:** each character renders as **`•` U+2022 BULLET**, color `var(--sui-color-label)`, sized to the body font. No reveal/eye toggle is provided by SwiftUI (you build your own with a `TextField`/`SecureField` swap).
- **Strong-password / autofill:** iOS shows the system "Strong Password" yellow autofill bar above the keyboard when `.textContentType(.newPassword)` is set — a system overlay the web cannot replicate (browser password-manager UI is the analog).
- Metrics (height, padding, radius, focus ring) are **exactly** TextField's table in §1.3.

### 2.3 Behavior — INFERRED

- Same focus/commit state machine as TextField. **Paste shows dots, not text.** Caret behaves identically.
- iOS clears the field on app-background for security (a system behavior; replica may optionally clear on `visibilitychange`).
- No clear (ⓧ) button while editing on iOS (security — avoids exposing length affordances beyond the dots).

### 2.4 Web replication — HTML + CSS + React prop API

**HTML:** identical wrapper to TextField, `type="password"` (the browser masks natively, so no manual `•` rendering needed):
```html
<div class="sui-textfield sui-tfs-roundedBorder" data-focused="false">
  <input class="sui-textfield__input sui-body" type="password"
         autocomplete="current-password" placeholder="Password" aria-label="Password" />
</div>
```
**CSS:** reuses **all** `.sui-textfield*` classes from §1.5 unchanged. The browser's native `type=password` masking matches the `•` look on every platform (Safari/Chrome/Firefox all render `•` or `*` — set `-webkit-text-security: disc;` on a `type=text` fallback if you need a custom reveal toggle). Optional explicit dot enforcement:
```css
.sui-securefield input { -webkit-text-security: disc; } /* only if using type=text for a reveal toggle */
```

**React prop API:**
```tsx
interface SecureFieldProps {
  value: string;
  onChange: (s: string) => void;
  title?: string;                 // ⇄ titleKey (a11y + placeholder fallback)
  prompt?: string;                // → placeholder
  fieldStyle?: TextFieldStyle;    // default "automatic"
  onSubmit?: () => void;          // ⇄ .onSubmit (replaces deprecated onCommit)
  textContentType?: "password" | "newPassword" | string;  // → autocomplete current/new-password
  disabled?: boolean;
  reveal?: boolean;               // DESIGNED — SwiftUI has none; toggles type password↔text
}
// <SecureField title="Password" value={pw} onChange={setPw} fieldStyle="roundedBorder" />
```
`reveal` is a DESIGNED extension (SwiftUI provides no built-in show-password). When `reveal`, swap `type` to `text`.

---

## 3. TextEditor — `SwiftUI:3057`

```swift
public struct TextEditor : SwiftUICore.View                                          // SwiftUI:3057
```

A **scrolling, always-multiline** rich text region (vs TextField's grow-to-fit). No generic `Label` — it has no inline label; it's a bare editable block. macOS/iOS/visionOS only (tvOS/watchOS unavailable, `SwiftUI:3068`).

### 3.1 Exact API — KNOWN (verbatim, all 3 inits)

```swift
init(text: Binding<String>)                                                                  // SwiftUI:3058
@available(iOS 18.0, macOS 15.0, visionOS 2.0, *)
init(text: Binding<String>, selection: Binding<TextSelection?>)                               // SwiftUI:3061
@available(iOS 26.0, macOS 26.0, visionOS 26.0, *)
init(text: Binding<AttributedString>, selection: Binding<AttributedTextSelection>? = nil)     // SwiftUI:3066
```
- **`text: Binding<String>`** — plain-text editor (the everyday form).
- **`selection:`** (iOS 18+) — observe/control the caret+range.
- **`text: Binding<AttributedString>`** (iOS 26+) — **rich text** editor (bold/italic/links inline). This is the modern formatted-text surface.

### 3.2 The three TextEditorStyles — KNOWN (`SwiftUI:3034`, `:8614`, `:12467`, `:16890`)

```swift
@preconcurrency @MainActor public protocol TextEditorStyle { … }                  // SwiftUI:3034
public struct AutomaticTextEditorStyle    : TextEditorStyle { }                    // SwiftUI:8614  (.automatic)
public struct RoundedBorderTextEditorStyle: TextEditorStyle { }                    // SwiftUI:12467 (.roundedBorder)
public struct PlainTextEditorStyle        : TextEditorStyle { }                    // SwiftUI:16890 (.plain)
nonisolated public func textEditorStyle(_ style: some TextEditorStyle) -> some View // SwiftUI:3051
```
`.automatic` ≈ plain on iOS, bezel on macOS; `.roundedBorder` adds the rounded bezel; `.plain` is borderless.

### 3.3 Visual anatomy + metrics — INFERRED

**Sub-elements:** `[ scroll container [ text run with caret + multi-line wrap ] ]`. No placeholder support natively (a common gotcha — you overlay a `Text` yourself when empty).

| Property | value | Token |
|---|---|---|
| Min height | content-driven; commonly framed (e.g. `.frame(height: 200)`) — no intrinsic min | DESIGNED `min-height: 80px` |
| Background | `var(--sui-color-system-background)` (iOS) — **toggle with `.scrollContentBackground(.hidden)`** (`SwiftUI:10844`) | |
| Text color | `var(--sui-color-label)` `.sui-body` 17px | |
| Inner inset (iOS) | ~5pt leading text-container inset | DESIGNED `8px` |
| Corner (`.roundedBorder`) | 6pt continuous, 1px `var(--sui-color-separator)` | `radius.field` |
| Line wrapping | word-wrap, soft-wrap on width | |
| Scroll | vertical scroll when content > height; scrollbar = system | |
| Caret | `var(--sui-color-tint)` | |

`.lineSpacing(_:)` adjusts inter-line gap; `.scrollContentBackground(_:)` (`SwiftUI:10844`, takes `Visibility`) hides the default editor background so you can apply your own.

### 3.4 Behavior — INFERRED

- **Always multiline**, Return inserts newline (never submits — TextEditor has no `onSubmit` concept).
- Standard selection / copy-paste / undo-redo (system text engine). On iOS 26+ with `AttributedString`, inline formatting commands (⌘B/⌘I) and a formatting toolbar appear.
- Focus ring: macOS shows the same accent glow as TextField when `.roundedBorder`; iOS none.
- `.findNavigator(isPresented:)` (`SwiftUI:2361`) adds a find/replace bar (⌘F) — web analog is a custom find overlay (out of default scope).

### 3.5 Web replication — HTML + CSS + React prop API

**HTML:** a `<textarea>` (or `contenteditable` div for the AttributedString variant):
```html
<div class="sui-texteditor sui-tes-roundedBorder" data-focused="false">
  <textarea class="sui-texteditor__area sui-body" rows="6" aria-label="Editor"></textarea>
  <!-- empty-state placeholder overlay (DESIGNED — SwiftUI has none) -->
  <span class="sui-texteditor__placeholder" aria-hidden="true">Write something…</span>
</div>
```
**CSS (paste-ready):**
```css
.sui-texteditor { position: relative; display: flex; min-height: 80px; }
.sui-texteditor__area {
  flex: 1; resize: none; border: none; outline: none; background: transparent;
  padding: 8px; color: var(--sui-color-label);
  font: var(--sui-text-body-weight) var(--sui-text-body-size)/var(--sui-text-body-lineHeight) "SF Pro Text", -apple-system, system-ui, sans-serif;
  letter-spacing: var(--sui-text-body-tracking);
  caret-color: var(--sui-color-tint);
  overflow-y: auto;
}
.sui-tes-roundedBorder {
  border: 1px solid var(--sui-color-separator); border-radius: 6px;
  background: var(--sui-color-system-background);
  transition: box-shadow .15s ease-out, border-color .15s ease-out;
}
.sui-tes-roundedBorder[data-focused="true"] {
  border-color: var(--sui-color-tint);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sui-color-tint) 60%, transparent);
}
.sui-tes-plain { border: none; background: transparent; }
.sui-texteditor__placeholder {
  position: absolute; top: 8px; left: 8px; pointer-events: none;
  color: var(--sui-color-placeholder-text);
  font: inherit; /* matches body */
}
.sui-texteditor[data-empty="false"] .sui-texteditor__placeholder { display: none; }
```
**React prop API:**
```tsx
type TextEditorStyle = "automatic" | "plain" | "roundedBorder";
interface TextEditorProps {
  value: string;                            // ⇄ text: Binding<String>
  onChange: (s: string) => void;
  editorStyle?: TextEditorStyle;            // ⇄ .textEditorStyle() (default "automatic")
  placeholder?: string;                     // DESIGNED — SwiftUI lacks native placeholder
  lineSpacing?: number;                     // ⇄ .lineSpacing()
  scrollBackgroundHidden?: boolean;         // ⇄ .scrollContentBackground(.hidden)
  rich?: boolean;                           // ⇄ AttributedString variant → contenteditable
  disabled?: boolean;
  onFocusChange?: (f: boolean) => void;
}
// <TextEditor value={notes} onChange={setNotes} editorStyle="roundedBorder" placeholder="Notes…" />
```

---

## 4. Slider — `SwiftUI:3655`

```swift
public struct Slider<Label, ValueLabel> : SwiftUICore.View
    where Label : SwiftUICore.View, ValueLabel : SwiftUICore.View                    // SwiftUI:3655
```

Continuous (or stepped) value selection by dragging a thumb along a track. Two generic slots: `Label` (accessibility/leading) and `ValueLabel` (the min/max end captions). **tvOS unavailable** (`SwiftUI:3666`).

### 4.1 Exact API — KNOWN (verbatim, the canonical inits)

**Bare (no labels)** — `where Label == EmptyView, ValueLabel == EmptyView` (`SwiftUI:3712`):
```swift
init<V>(value: Binding<V>, in bounds: ClosedRange<V> = 0...1, onEditingChanged: @escaping (Bool) -> Void = { _ in })          // SwiftUI:3712
        where V : BinaryFloatingPoint, V.Stride : BinaryFloatingPoint
init<V>(value: Binding<V>, in bounds: ClosedRange<V>, step: V.Stride = 1, onEditingChanged: @escaping (Bool) -> Void = {_ in}) // SwiftUI:3714
        where V : BinaryFloatingPoint, V.Stride : BinaryFloatingPoint
```
- **`value: Binding<V>`** — the bound floating value.
- **`in bounds: ClosedRange<V> = 0...1`** — the range. **Default `0...1`** (KNOWN).
- **`step: V.Stride = 1`** — when present, snaps to discrete increments; **default step = 1** but the *no-step* overload is continuous.
- **`onEditingChanged: (Bool) -> Void`** — fires `true` on drag-begin, `false` on drag-end. **Default `{ _ in }`** (KNOWN).

**With end labels** — `where ValueLabel == EmptyView` (custom `Label` only, `SwiftUI:3693`), and the full form with both end labels (`SwiftUI:3669`):
```swift
init<V>(value: Binding<V>, in bounds: ClosedRange<V> = 0...1,
        @ViewBuilder label: () -> Label,
        @ViewBuilder minimumValueLabel: () -> ValueLabel,
        @ViewBuilder maximumValueLabel: () -> ValueLabel,
        onEditingChanged: @escaping (Bool) -> Void = { _ in })                       // SwiftUI:3669
        where V : BinaryFloatingPoint, V.Stride : BinaryFloatingPoint
// + step: variant at SwiftUI:3679
```
`minimumValueLabel`/`maximumValueLabel` render at the **leading/trailing ends** of the track (e.g. a small speaker icon on each side for a volume slider).

**iOS 26 / macOS 26 superset** (`SwiftUI:22470`) — adds **neutral value, enabled sub-range, current-value label, and tick marks**:
```swift
init<V>(value: Binding<V>, in bounds: ClosedRange<V> = 0...1,
        neutralValue: V? = nil, enabledBounds: ClosedRange<V>? = nil,
        @ViewBuilder label: () -> Label,
        @ViewBuilder currentValueLabel: () -> some View = { EmptyView() },
        @ViewBuilder minimumValueLabel: () -> ValueLabel = { EmptyView() },
        @ViewBuilder maximumValueLabel: () -> ValueLabel = { EmptyView() },
        @SliderTickBuilder<V> ticks: () -> some SliderTickContent<V>,
        onEditingChanged: @escaping (Bool) -> Void = { _ in })                       // SwiftUI:22472
```
- **`neutralValue:`** — a "zero/default" anchor; the fill draws **from neutralValue to thumb** (e.g. a pan/balance control filling left OR right of center) instead of always from the minimum.
- **`enabledBounds:`** — a draggable sub-range inside `bounds` (the rest is shown but locked).
- **`ticks:` via `@SliderTickBuilder`** — explicit tick marks. `SliderTick(_ titleKey:, _ value:)` (`SwiftUI:22456`) places a labeled tick at `value`. Also a per-value `tick: (V) -> SliderTick<V>?` closure form (`SwiftUI:22474`).

### 4.2 Visual anatomy + metrics — INFERRED (HIG / runtime)

**Sub-elements (left→right):** `[ minimumValueLabel ]  [ track [ filled-portion | thumb | unfilled-portion ] (+ tick marks) ]  [ maximumValueLabel ]`.

| Part | iOS metric | macOS metric | Token / color |
|---|---|---|---|
| **Track height** | **4pt** | ~4pt (3–4) | `var(--sui-color-system-gray-5)` unfilled (iOS) / `tertiaryFill` |
| **Track corner** | fully rounded (height/2 = 2pt) | 2pt | pill |
| **Filled portion** | from min → thumb, **`var(--sui-color-tint)`** | tint | systemBlue |
| **Thumb (knob)** | **circle ⌀ 28pt** (iOS), white, `box-shadow` soft drop | **circle ⌀ ~16–20pt** | white `#FFFFFF` + shadow `radius 1, y 0.5` |
| **Thumb shadow** | `0 0.5pt 4pt rgba(0,0,0,0.12)` + `0 0 1pt rgba(0,0,0,0.04)` | subtler | INFERRED |
| **Overall control height** | ~28pt (thumb-driven) | ~21pt | hit target ≥ 28 |
| **Tick marks (26)** | small vertical strokes on/under track, `var(--sui-color-separator)` | hairlines | |
| **Disabled** | whole slider `opacity 0.3` | same | |

Community/UIKit RE: the **iOS `UISlider` thumb is ~28pt diameter** with a soft white knob; custom-slider tutorials use 26–28pt for visual parity ([swdevnotes](https://swdevnotes.com/swift/2021/how-to-customise-the-slider-in-swiftui/)). The **default track placeholder height is 4pt** in those same references. macOS `NSSlider` linear-slider knob is smaller (~16–20pt).

### 4.3 Behavior — INFERRED

- **Drag:** thumb follows finger/cursor along the axis; value = `bounds.lower + (dragX − trackLeft)/trackWidth × (bounds.upper − bounds.lower)`, clamped, then **snapped to `step`** if a step overload is used (`round((v−lo)/step)×step + lo`).
- **`onEditingChanged(true)`** on `pointerdown`, **`(false)`** on `pointerup`. The thumb grows slightly / gains a pressed shadow while dragging (iOS thumb scales ~1.0→ subtle highlight; DESIGNED `transform: scale(1.0)` + deeper shadow).
- **Tap on track (iOS):** jumps thumb to tap location (animated, ~0.2s). macOS: page-jumps toward click.
- **Keyboard (macOS / focus):** ←/→ (or ↓/↑) nudge by one `step` (or 1% if continuous); ⇧+arrow larger; Home/End → min/max.
- **Animation:** value changes from taps animate with a spring; direct drags are 1:1 (no lag). Spring ≈ `.smooth`/interactive (token animation file). Web: `transition: left .18s cubic-bezier(.4,0,.2,1)` applied ONLY on programmatic/tap changes, disabled during active drag.

### 4.4 Web replication — HTML + CSS + React prop API

**HTML (ARIA slider — NOT `<input type=range>`, to get pixel-1:1 thumb/track):**
```html
<div class="sui-slider" data-disabled="false">
  <span class="sui-slider__minlabel">🔈</span>
  <div class="sui-slider__track" role="slider"
       tabindex="0" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0.5" aria-label="…">
    <div class="sui-slider__fill" style="width:50%"></div>
    <!-- optional ticks -->
    <div class="sui-slider__tick" style="left:25%"></div>
    <div class="sui-slider__thumb" style="left:50%"></div>
  </div>
  <span class="sui-slider__maxlabel">🔊</span>
</div>
```
**CSS (paste-ready — exact metrics):**
```css
.sui-slider { display: flex; align-items: center; gap: 8px; opacity: 1; }
.sui-slider[data-disabled="true"] { opacity: .3; pointer-events: none; }

.sui-slider__track {
  position: relative; flex: 1 1 auto; height: 4px; border-radius: 2px;
  background: var(--sui-color-system-gray-5);           /* unfilled */
  cursor: pointer; touch-action: none;
}
.sui-slider__fill {
  position: absolute; left: 0; top: 0; height: 100%; border-radius: 2px;
  background: var(--sui-color-tint);                     /* filled = systemBlue */
}
.sui-slider__thumb {
  position: absolute; top: 50%; width: 28px; height: 28px;   /* iOS knob ⌀28 */
  transform: translate(-50%, -50%); border-radius: 50%;
  background: #fff;
  box-shadow: 0 0.5px 4px rgba(0,0,0,.12), 0 0 1px rgba(0,0,0,.04);
  cursor: grab;
}
.sui-slider__track:active .sui-slider__thumb { cursor: grabbing; box-shadow: 0 1px 6px rgba(0,0,0,.18); }
.sui-slider__track:focus-visible { outline: none; }
.sui-slider__track:focus-visible .sui-slider__thumb {
  box-shadow: 0 0.5px 4px rgba(0,0,0,.12), 0 0 0 3px color-mix(in srgb, var(--sui-color-tint) 60%, transparent);
}
.sui-slider__tick {
  position: absolute; top: 50%; transform: translate(-50%,-50%);
  width: 1px; height: 8px; background: var(--sui-color-separator);
}
/* macOS knob variant: width/height 18px */
.sui-slider--macos .sui-slider__thumb { width: 18px; height: 18px; }

/* animate fill/thumb only on tap/programmatic changes, NOT during drag: */
.sui-slider[data-animating="true"] .sui-slider__fill,
.sui-slider[data-animating="true"] .sui-slider__thumb { transition: left .18s cubic-bezier(.4,0,.2,1), width .18s cubic-bezier(.4,0,.2,1); }
```
**React prop API:**
```tsx
interface SliderProps {
  value: number;                       // ⇄ value: Binding<V>
  onChange: (v: number) => void;
  bounds?: [number, number];           // ⇄ in: ClosedRange  (default [0,1])
  step?: number;                       // ⇄ step: V.Stride   (omit → continuous)
  onEditingChanged?: (editing: boolean) => void;  // ⇄ onEditingChanged (true on drag start)
  minimumValueLabel?: React.ReactNode; // ⇄ minimumValueLabel
  maximumValueLabel?: React.ReactNode; // ⇄ maximumValueLabel
  label?: string;                      // ⇄ label (aria-label)
  // iOS26 superset:
  neutralValue?: number;               // ⇄ neutralValue (fill anchored here, not at min)
  enabledBounds?: [number, number];    // ⇄ enabledBounds
  ticks?: { value: number; label?: string }[];    // ⇄ @SliderTickBuilder ticks
  disabled?: boolean;
}
// percentFill = (value - bounds[0]) / (bounds[1] - bounds[0]) * 100
// neutralValue → fill spans from min(neutral,value) to max(neutral,value)
// <Slider value={vol} onChange={setVol} bounds={[0,1]} minimumValueLabel={<SpeakerLow/>} />
```
Implement drag with Pointer Events: `pointerdown` → `setPointerCapture`, compute value from `clientX` vs `track.getBoundingClientRect()`, snap to `step`, set `data-animating=false` during drag and `true` for tap-jumps.

---

## 5. Stepper — `SwiftUI:19824`

```swift
public struct Stepper<Label> : SwiftUICore.View where Label : SwiftUICore.View       // SwiftUI:19824
```

A `−` / `+` pair that increments/decrements a value (or fires arbitrary callbacks). **tvOS unavailable** (`SwiftUI:19836`). The base struct ships the primary init inline (`SwiftUI:19825`):

### 5.1 Exact API — KNOWN (verbatim)

**Primary callback form** (`SwiftUI:19825`, base struct):
```swift
init(@ViewBuilder label: () -> Label,
     onIncrement: (() -> Void)?, onDecrement: (() -> Void)?,
     onEditingChanged: @escaping (Bool) -> Void = { _ in })                          // SwiftUI:19825
```
Passing `nil` for `onIncrement`/`onDecrement` **disables that arrow** (greyed +/−). `onEditingChanged(true)` fires while the user holds an arrow (continuous repeat), `(false)` on release.

**Bound-value form (the common one)** — `extension Stepper` (`SwiftUI:19846`, `:19857`):
```swift
init<V>(value: Binding<V>, step: V.Stride = 1,
        @ViewBuilder label: () -> Label, onEditingChanged: @escaping (Bool) -> Void = {_ in}) where V : Strideable   // SwiftUI:19846
init<V>(value: Binding<V>, in bounds: ClosedRange<V>, step: V.Stride = 1,
        @ViewBuilder label: () -> Label, onEditingChanged: @escaping (Bool) -> Void = {_ in}) where V : Strideable   // SwiftUI:19857
```
- **`step: V.Stride = 1`** — increment size; **default 1** (KNOWN).
- **`in bounds:`** — clamps the value; arrows auto-disable at the ends.
- `V : Strideable` → works for `Int`, `Double`, `Date` (via `Calendar.Component`), etc.

**Text-label convenience** — `where Label == Text` (`SwiftUI:19869`+):
```swift
init(_ titleKey: LocalizedStringKey, onIncrement: (() -> Void)?, onDecrement: (() -> Void)?, onEditingChanged: ... = {_ in})  // SwiftUI:19872
init<V>(_ titleKey: LocalizedStringKey, value: Binding<V>, step: V.Stride = 1, onEditingChanged: ... = {_ in}) where V : Strideable     // SwiftUI:19890
init<V>(_ titleKey: LocalizedStringKey, value: Binding<V>, in bounds: ClosedRange<V>, step: V.Stride = 1, onEditingChanged: ...) where V : Strideable  // SwiftUI:19906
// + String (S: StringProtocol) and LocalizedStringResource disfavored overloads alongside each
```

**FormatStyle form** (iOS 16+, `SwiftUI:19922`, `:19928`):
```swift
init<F>(value: Binding<F.FormatInput>, step: F.FormatInput.Stride = 1, format: F,
        @ViewBuilder label: () -> Label, onEditingChanged: ... = {_ in})
        where F : ParseableFormatStyle, F.FormatInput : BinaryFloatingPoint, F.FormatOutput == String   // SwiftUI:19922
// + in: bounds variant + titleKey/title text-label variants (SwiftUI:19954+)
```

### 5.2 Visual anatomy + metrics — INFERRED

**Sub-elements:** in a `Form`/`List` row the layout is `[ label (leading, fills) ] … [ − | divider | + ] (trailing segmented control) ]`. Standalone it's just the `[ − | + ]` segmented pair.

| Part | iOS metric | macOS metric | Token/color |
|---|---|---|---|
| Stepper segmented control width | ~94pt (two 47pt halves) | ~30pt (tiny ▲▼ on macOS!) | — |
| Segment height | ~32pt | ~21pt | hit ≥ 32 |
| Background | `var(--sui-color-tertiary-system-fill)` `#7676801F` | bezel | rounded |
| Corner radius | **8pt continuous** (iOS pill segments) | ~5pt | `radius.button ≈ 8` |
| Divider between − and + | 1px `var(--sui-color-separator)` | — | hairline |
| Glyphs | `minus` / `plus` SF Symbols, `var(--sui-color-label)` | ▲ / ▼ chevrons (macOS uses stacked up/down!) | |
| Glyph size | ~17pt | ~9pt | |
| Disabled arrow (at bound / nil) | glyph `opacity 0.3` | greyed | |
| Pressed segment | momentary `var(--sui-color-system-gray-4)` highlight | — | |

> **Platform divergence (KNOWN behavior, INFERRED metrics):** iOS Stepper = a **horizontal `[−][+]` pill**. macOS Stepper = a tiny **vertical ▲▼ "little arrows"** control (`NSStepper`). The kit targets the **iOS horizontal pill** as default and offers a `variant="macStepper"` for the stacked arrows.

### 5.3 Behavior — INFERRED

- **Tap −/+:** one `step` change, clamped to `bounds`. At a bound the arrow disables (greyed, no-op).
- **Press-and-hold:** **auto-repeat** — first repeat after ~0.5s, then accelerating (~0.1s interval, speeds up). `onEditingChanged(true)` for the duration. Replica: `setTimeout(500)` → `setInterval(~120ms)`, clear on `pointerup`.
- **Pressed visual:** the held half lights up (`systemGray4`), releases on pointerup.
- **No keyboard text entry** in the stepper itself; ↑/↓ when focused = +/− one step.

### 5.4 Web replication — HTML + CSS + React prop API

**HTML:**
```html
<div class="sui-stepper-row">
  <span class="sui-stepper__label sui-body">Quantity</span>
  <div class="sui-stepper" role="group" aria-label="Quantity stepper">
    <button class="sui-stepper__btn sui-stepper__minus" aria-label="Decrement" disabled>−</button>
    <span class="sui-stepper__divider" aria-hidden="true"></span>
    <button class="sui-stepper__btn sui-stepper__plus"  aria-label="Increment">+</button>
  </div>
</div>
```
**CSS (paste-ready):**
```css
.sui-stepper-row { display: flex; align-items: center; gap: 8px; }
.sui-stepper__label { flex: 1 1 auto; color: var(--sui-color-label); }
.sui-stepper {
  display: inline-flex; align-items: stretch; height: 32px;
  background: var(--sui-color-tertiary-system-fill);   /* #7676801F */
  border-radius: 8px; overflow: hidden;
}
.sui-stepper__btn {
  width: 47px; border: none; background: transparent; cursor: default;
  color: var(--sui-color-label); font-size: 17px; line-height: 1;
  display: grid; place-items: center;
  transition: background-color .1s ease;
}
.sui-stepper__btn:active:not(:disabled) { background: var(--sui-color-system-gray-4); }
.sui-stepper__btn:disabled { opacity: .3; cursor: default; }
.sui-stepper__divider { width: 1px; background: var(--sui-color-separator); }
/* macOS stacked ▲▼ variant */
.sui-stepper--mac { flex-direction: column; height: 21px; width: 16px; border-radius: 4px; }
.sui-stepper--mac .sui-stepper__btn { width: 100%; height: 50%; font-size: 8px; }
.sui-stepper--mac .sui-stepper__divider { width: 100%; height: 1px; }
```
**React prop API:**
```tsx
interface StepperProps {
  value?: number;                      // ⇄ value: Binding<V>  (omit → pure callback mode)
  onChange?: (v: number) => void;
  step?: number;                       // ⇄ step (default 1)
  bounds?: [number, number];           // ⇄ in: ClosedRange — auto-disables arrows at ends
  label?: React.ReactNode;             // ⇄ label / titleKey
  onIncrement?: () => void;            // ⇄ onIncrement (nil-equivalent: omit → disables +)
  onDecrement?: () => void;            // ⇄ onDecrement
  onEditingChanged?: (editing: boolean) => void;
  format?: (v: number) => string;      // ⇄ format: — for an adjacent value display
  variant?: "ios" | "mac";            // DESIGNED — horizontal pill vs stacked ▲▼
  disabled?: boolean;
}
// inc = () => onChange?.(clamp(value+step, bounds)); auto-repeat on hold via timer.
// <Stepper label="Quantity" value={qty} onChange={setQty} bounds={[0,10]} step={1} />
```
Auto-repeat: on `pointerdown` call the handler once, then `repeatTimer = setTimeout(() => { interval = setInterval(handler, 120) }, 500)`; clear both on `pointerup`/`pointerleave`. Disable `+`/`−` when `value >= bounds[1]` / `value <= bounds[0]`.

---

## 6. ColorPicker — `SwiftUI:23334`

```swift
public struct ColorPicker<Label> : SwiftUICore.View where Label : SwiftUICore.View   // SwiftUI:23334
```

A labeled **swatch** that, when tapped, opens the **system color picker** (iOS color wheel sheet / macOS `NSColorPanel`). **tvOS & watchOS unavailable** (`SwiftUI:23342–23343`). The two inits are declared **inline** in the base struct (`SwiftUI:23335–23336`):

### 6.1 Exact API — KNOWN (verbatim, both inits)

```swift
init(selection: Binding<Color>,   supportsOpacity: Bool = true, @ViewBuilder label: () -> Label)   // SwiftUI:23335
init(selection: Binding<CGColor>, supportsOpacity: Bool = true, @ViewBuilder label: () -> Label)   // SwiftUI:23336
```
- **`selection: Binding<Color>`** (or `CGColor`) — the bound color (two-way).
- **`supportsOpacity: Bool = true`** — **default `true`**; when `false` the system picker hides the alpha/opacity slider and forces full-opacity colors (KNOWN).
- **`@ViewBuilder label`** — the leading label.

Convenience `where Label == Text` overloads (`titleKey` / `title: S`) also exist (standard pattern); the kit exposes `label?: string`.

### 6.2 Visual anatomy + metrics — INFERRED

**Sub-elements (in a Form/List row):** `[ label (leading, fills) ] … [ color swatch (trailing) ]`.

| Part | iOS metric | macOS metric | Color/token |
|---|---|---|---|
| Swatch shape | **circle ⌀ ~28pt** | rounded-rect well ~24×16pt | the selected color fill |
| Swatch ring | thin `var(--sui-color-separator)` 1px stroke | bezel | hairline so white swatch is visible |
| Swatch (with opacity) | checkerboard alpha behind the color | checkerboard | `conic-gradient` checker |
| Gloss | subtle radial highlight (iOS gives a faint sheen) | — | INFERRED |
| Label | `var(--sui-color-label)` `.sui-body` | same | |
| Disabled | `opacity 0.3` | same | |

The swatch shows the **current** selection. iOS draws it as a filled circle with a faint outer ring; if `supportsOpacity` and the color has alpha < 1, a checkerboard shows through.

### 6.3 Behavior — INFERRED

- **Tap swatch:** presents the **system picker**. iOS = a sheet with three tabs (Grid / Spectrum / Sliders) + eyedropper + opacity slider (if `supportsOpacity`). macOS = `NSColorPanel` floating window. **The picker chrome itself is NOT replicable on web** — it's a system surface.
- Selecting a color writes back through the `Binding` live (the swatch updates immediately as you drag in the picker).
- **Web replica decision (DESIGNED):** use the **native `<input type="color">`** for the picker surface (browser-provided, the closest analog), styled so its *trigger* is our circular swatch. For opacity support (which `<input type=color>` lacks), fall back to a custom popover with H/S/V + alpha sliders.

### 6.4 Web replication — HTML + CSS + React prop API

**HTML:**
```html
<div class="sui-colorpicker-row">
  <span class="sui-colorpicker__label sui-body">Accent</span>
  <label class="sui-colorpicker__swatch" style="--swatch:#FF3B30;">
    <input type="color" class="sui-colorpicker__input" value="#FF3B30" aria-label="Accent color" />
  </label>
</div>
```
**CSS (paste-ready):**
```css
.sui-colorpicker-row { display: flex; align-items: center; gap: 8px; }
.sui-colorpicker__label { flex: 1 1 auto; color: var(--sui-color-label); }
.sui-colorpicker__swatch {
  position: relative; width: 28px; height: 28px; border-radius: 50%;
  /* checkerboard for alpha, with the chosen color layered on top */
  background:
    var(--swatch),
    conic-gradient(#bbb 25%, #fff 0 50%, #bbb 0 75%, #fff 0) 0/8px 8px;
  box-shadow: inset 0 0 0 1px var(--sui-color-separator);   /* visibility ring */
  cursor: pointer; overflow: hidden; display: inline-block;
}
.sui-colorpicker__input {
  position: absolute; inset: 0; opacity: 0; cursor: pointer;   /* native picker, visually hidden */
  width: 100%; height: 100%; border: none; padding: 0;
}
.sui-colorpicker-row[data-disabled="true"] { opacity: .3; pointer-events: none; }
/* macOS rectangular well variant */
.sui-colorpicker--mac .sui-colorpicker__swatch { width: 38px; height: 22px; border-radius: 5px; }
```
**React prop API:**
```tsx
interface ColorPickerProps {
  color: string;                       // ⇄ selection: Binding<Color>  (hex/rgba)
  onChange: (color: string) => void;
  label?: string;                      // ⇄ titleKey / label
  supportsOpacity?: boolean;           // ⇄ supportsOpacity (default true) — if false, strip alpha
  variant?: "ios" | "mac";             // swatch shape: circle vs rounded well
  disabled?: boolean;
}
// Renders the swatch as the trigger; <input type=color> provides the OS picker.
// supportsOpacity=false → coerce onChange value to full alpha; hide alpha popover.
// <ColorPicker label="Accent" color={c} onChange={setC} supportsOpacity={false} />
```
**Opacity note:** native `<input type=color>` returns only opaque hex. When `supportsOpacity` is required, replace the `<input>` with a custom popover (HSV square + hue strip + alpha strip) writing `rgba()` — that is the DESIGNED path for full parity.

---

## 7. Cross-component summary

| Component | Native render core | Web core element | Key default constants (KNOWN/INFERRED) |
|---|---|---|---|
| TextField | bezel + text run + caret | `<input>`/`<textarea>` in `.sui-textfield` | radius 6 continuous, border 1px separator, focus ring 3px tint@60%; placeholder `placeholder-text`; axis `.vertical`→grow |
| SecureField | bezel + `•` dots | `<input type=password>` (reuses TextField CSS) | `•` mask, no clear button, no axis |
| TextEditor | scroll + multiline text | `<textarea>` in `.sui-texteditor` | always multiline, no native placeholder, scrollContentBackground toggle |
| Slider | track(4pt) + fill(tint) + thumb(⌀28) | ARIA `role=slider` div trio | bounds default `0...1`, step default 1, track 4pt, thumb 28pt iOS/18pt mac, fill = tint |
| Stepper | `[−][+]` pill (iOS) / ▲▼ (mac) | two `<button>` `role=group` | step default 1, height 32pt, radius 8, auto-repeat 500ms→120ms |
| ColorPicker | swatch → system picker | swatch `<label>` + `<input type=color>` | swatch ⌀28 iOS, supportsOpacity default true, checker for alpha |

**Shared tokens used:** `var(--sui-color-tint)` (fill/focus/caret/on), `var(--sui-color-label)` (text), `var(--sui-color-placeholder-text)` (placeholder), `var(--sui-color-separator)` (borders/rings), `var(--sui-color-system-gray-5)` (slider track), `var(--sui-color-tertiary-system-fill)` (stepper bg), `.sui-body` typography (17/400/22/−0.41), `radius.field≈6` / `radius.button≈8` continuous, disabled `opacity .3`.

**Coverage:** all 6 types **deep-covered** (full API + anatomy + behavior + HTML/CSS/prop-API). No types tabulated-only. Subsidiary types referenced inline at full depth where load-bearing: `Axis` (`SUICore:2440`), `TextSelection` (`SwiftUI:19500`), `SubmitLabel` (`SwiftUI:8708`), `TextFieldStyle`/`TextEditorStyle` protocols + concrete styles, `SliderTick`/`SliderTickBuilder` (`SwiftUI:22456`+), `ParseableFormatStyle` binding path.

**web_ready = true** — every deep-covered component has its HTML structure + verbatim CSS + React prop API mapping.
