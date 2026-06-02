# SwiftUI → Web Kit — Coverage / Completeness Audit

**Audited:** 2026-06-02
**Kit:** `products/swiftui-web/src/`
**Reference surface:** `swiftui/INVENTORY.json` (SwiftUI 7.4.27 / SwiftUICore / Charts, macOS 26.4 SDK) — 169 `view_types`, 502 `view_modifiers`.

How coverage is judged: a `view_type` counts as **IMPLEMENTED** only if a real component file (or system component) exists and is exported from `src/index.ts`. Many of the 169 inventory entries are not user-facing components at all — they are internal default-label/style structs (`DefaultButtonLabel`, `*NavigationViewStyle`), variadic/layout roots (`_VariadicView_*`, `_LayoutRoot`), platform-host wrappers (`NSHostingView`, `NSViewRepresentable`), and other plumbing. Those are marked **N/A (not-missing)** and excluded from the denominator. A modifier counts as **covered** if it is compiled by `applyModifiers` (`C`), delivered as a system hook/component (`H`), or wired as a component prop / cluster API (`P`).

---

## Headline numbers

| Metric | Value |
| --- | --- |
| **User-facing component coverage** | **65 / 72 = 90%** |
| view_types total | 169 |
| — IMPLEMENTED | 65 |
| — N/A (internal/plumbing, excluded) | 97 |
| — genuinely MISSING (user-facing) | 7 |
| **User-facing modifier coverage** (top ~158 sampled) | **122 / 158 = 77%** |
| — compiled by `applyModifiers` (`C`) | 64 keys in `MODIFIER_KEYS` |
| — system hook/component (`H`) | gestures, animation, transition, presentation, effects |
| — component prop / cluster (`P`) | styles, nav/toolbar, scroll, list, presentation detents |
| — MISSING | 36 |

The styling/layout/text/transform spine is essentially complete — `applyModifiers` (`src/system/modifiers.ts`) implements all 64 of the high-frequency visual modifiers (padding, frame, background, foregroundStyle, font, cornerRadius, shadow, clipShape, opacity, offset, rotationEffect, scaleEffect, blur, the full text bundle, etc.). The gaps are concentrated in three areas: **lifecycle/data hooks** (`onAppear`/`task`/`onChange`-as-modifier), **search**, and **drag-and-drop**.

---

## Component coverage table (user-facing view_types)

### IMPLEMENTED (65)

| Component | File |
| --- | --- |
| AnyView / View | `components/View/View.tsx` |
| HStack / VStack / ZStack | `components/layout/{HStack,VStack,ZStack}.tsx` |
| LazyHStack / LazyVStack | `components/layout/Lazy{HStack,VStack}.tsx` |
| LazyHGrid / LazyVGrid | `components/layout/Lazy{HGrid,VGrid}.tsx` |
| Grid / GridLayout / GridRow | `components/layout/{Grid,GridRow}.tsx`, `GridItem.tsx` |
| GeometryReader | `components/layout/GeometryReader.tsx` |
| ViewThatFits | `components/layout/ViewThatFits.tsx` |
| (Group / Spacer / ForEach — present, not in view_types list) | `components/layout/{Group,Spacer,ForEach}.tsx` |
| Button | `components/Button/Button.tsx` |
| Text | `components/Text/Text.tsx` |
| Image | `components/Image/Image.tsx` (+ `sfSymbols.tsx`) |
| Label | `components/Label/Label.tsx` |
| Link | `components/Link/Link.tsx` |
| List | `components/List/List.tsx` (+ `ListRow`, `ListContext`) |
| Menu | `components/Menu/Menu.tsx` |
| Form | `components/Form/Form.tsx` (+ `FormRow`) |
| Section | `components/Section/Section.tsx` + `layout/Section.tsx` |
| Divider | `components/Divider/Divider.tsx` |
| Gauge | `components/Gauge/Gauge.tsx` |
| Slider | `components/Slider/Slider.tsx` |
| Stepper | `components/Stepper/Stepper.tsx` |
| Toggle | `components/Toggle/Toggle.tsx` |
| Picker | `components/Picker/Picker.tsx` |
| Table | `components/Table/Table.tsx` |
| TextField | `components/TextField/TextField.tsx` |
| TextEditor | `components/TextEditor/TextEditor.tsx` |
| SecureField | `components/SecureField/SecureField.tsx` |
| DatePicker | `components/DatePicker/DatePicker.tsx` (+ calendar, drum wheel) |
| MultiDatePicker | `components/MultiDatePicker/MultiDatePicker.tsx` |
| ColorPicker | `components/ColorPicker/ColorPicker.tsx` |
| ProgressView | `components/ProgressView/ProgressView.tsx` |
| ScrollView / ScrollViewReader | `components/ScrollView/{ScrollView,ScrollViewReader}.tsx` |
| DisclosureGroup | `components/DisclosureGroup/DisclosureGroup.tsx` |
| OutlineGroup / OutlineSubgroupChildren / GroupElementsOfContent | `components/OutlineGroup/OutlineGroup.tsx` |
| GroupSectionsOfContent | `components/Section/Section.tsx` |
| ControlGroup | `components/ControlGroup/ControlGroup.tsx` |
| EditButton / PasteButton / RenameButton / HelpLink | `components/{EditButton,PasteButton,RenameButton,HelpLink}/…` |
| ShareLink | `components/ShareLink/ShareLink.tsx` |
| SignInWithAppleButton | `components/SignInWithAppleButton/SignInWithAppleButton.tsx` |
| NavigationStack / NavigationSplitView / NavigationLink | `components/navigation/…` |
| TabView | `components/navigation/TabView/TabView.tsx` |
| ContextMenu | `components/presentation/ContextMenu.tsx` |
| Shape / ShapeView / FillShapeView / StrokeShapeView / StrokeBorderShapeView | `components/shapes/Shape.tsx`, `strokeBorder.ts` |
| Canvas | `components/shapes/Canvas.tsx` |
| LinearGradient / RadialGradient / AngularGradient / EllipticalGradient | `components/shapes/Gradients.tsx` |
| Chart / ChartAxisContent / ChartPlotContent | `components/charts/Chart.tsx`, `Axis.tsx` |
| GlassEffectContainer | `system/effects.ts` |

Plus marks (`BarMark`, `LineMark`, `AreaMark`, `PointMark`, `RuleMark`, `RectangleMark`, `SectorMark`) and `Material`/`Vibrant`/`Glass` host components (`system/effects.ts`) — present but not in the `view_types` list.

### MISSING — genuinely user-facing (7)

| Component | Status | Note |
| --- | --- | --- |
| **AsyncImage** | MISSING | No `AsyncImage` anywhere; `Image` exists but no async-URL loader with `phase` placeholder/error states. High value. |
| **ContentUnavailableView** | MISSING | The standard empty-state view (icon + title + description + actions). Very common in modern SwiftUI apps. |
| **GroupBox** | MISSING | Only `GroupBoxStyleConfiguration`/`GroupBoxStyleProvider` types exist in `system/styles.ts`; no `<GroupBox>` component. |
| **Chart3D** | MISSING | 3D chart container (+ `chart3DPose`/`chart3DCameraProjection`/`chartZAxis` family). Niche; reasonable to defer. |
| **LabeledContent** | MISSING | Only `LabeledContentStyleConfiguration` type exists; no component. (Not in `view_types` but is a real public view; flagged from `view_modifiers`/styles.) |
| NavigationView | MISSING (deprecated) | Superseded by NavigationStack/NavigationSplitView (both implemented) → low priority. |
| HSplitView / VSplitView | MISSING (macOS-only) | Resizable split panes; macOS-desktop only → low priority. |

### N/A — internal / plumbing (97, excluded from coverage)

Excluded because they are not components a kit user writes. Representative groups:
- **Default label/content structs:** `DefaultButtonLabel`, `DefaultDateProgressLabel`, `DefaultShareLinkLabel`, `DefaultTabLabel`, `DefaultSettingsLinkLabel`, `DefaultWindowVisibilityToggleLabel`, `DefaultDocumentGroupLaunchActions`, `LabeledControlGroupContent`, `LabeledToolbarItemGroupContent`, `_DatePickerStyleLabel`, `_TextFieldStyleLabel`.
- **`*Style` structs (style is delivered as a prop/provider, not a component):** `AutomaticNavigationSplitViewStyle`, `BalancedNavigationSplitViewStyle`, `ProminentDetailNavigationSplitViewStyle`, `CircularProgressViewStyle`, `LinearProgressViewStyle`, `DefaultProgressViewStyle`, `CarouselTabViewStyle`, `PageTabViewStyle`, `VerticalPageTabViewStyle`, `GroupedTabViewStyle`, `SidebarAdaptableTabViewStyle`, `TabBarOnlyTabViewStyle`, `PageIndexViewStyle`, `DefaultTabViewStyle`, `ColumnNavigationViewStyle`, `StackNavigationViewStyle`, `DoubleColumnNavigationViewStyle`, `DefaultNavigationViewStyle` — all covered by the `StyleProvider`/`*Style` prop machinery in `system/styles.ts`.
- **Variadic / layout roots:** `_VariadicView_*`, `_LayoutRoot`, `_LayoutTrait`, `_UnaryViewAdaptor`, `_ZStackLayout`, `_OverlayLayout`, `_SizeFittingRoot`, `_ScrollViewRoot`, `_SplitViewContainer`, `TupleView`, `IDView`, `EquatableView`, `Subview`.
- **Platform-host wrappers (no web analog):** `NSHostingController`, `NSHostingView`, `NSViewRepresentable(+Context)`, `NSViewControllerRepresentable(+Context)`, `_CALayerView`, `_WKStoryboardContent`, `TouchBar`.
- **Effect/animator structs (delivered via system hooks):** `_AnimatableView`, `_AnimationView`, `KeyframeAnimator`, `PhaseAnimator`, `GeometryEffect`, `_ShadowView`, `_MaskEffect`, `_BackdropEffect`, `_DrawingGroupEffect`, all the `_Scroll*`/`_Mask*`/`_*Effect` internal modifier views.
- **Document / window / preview / subscription scaffolding:** `DocumentLaunchView`, `NewDocumentButton`, `SettingsLink`, `WindowVisibilityToggle`, `PresentedWindowContent`, `SubscriptionView`, `PreviewModifierContent`, `MenuButton`, `TextFieldLink` (the deprecated/legacy or app-shell-only views).
- **Misc internals:** `DebugReplaceableView`, `DynamicViewContent`, `PlaceholderContentView`, `EmptyView` (rendered as `null`), `_ViewModifier_Content`, `Shape`-internal `_ShapeView`.

---

## Modifier coverage

### Compiled by `applyModifiers` (`src/system/modifiers.ts`, 64 keys — `C`)

Layout: `frame`, `padding`, `position`, `offset`, `fixedSize`, `layoutPriority`, `zIndex`, `clipped`, `clipShape`, `cornerRadius`, `aspectRatio`, `scaledToFit`, `scaledToFill`.
Fill/stroke: `foregroundStyle`, `foregroundColor`, `background`, `backgroundStyle`, `tint`, `border`, `shadow`.
Text: `font`, `fontWeight`, `fontDesign`, `bold`, `italic`, `underline`, `strikethrough`, `kerning`, `tracking`, `baselineOffset`, `lineLimit`, `lineSpacing`, `lineHeight`, `multilineTextAlignment`, `minimumScaleFactor`, `truncationMode`, `allowsTightening`, `textCase`, `monospaced`, `monospacedDigit`, `textScale`.
State: `opacity`, `hidden`, `disabled`, `redacted`, `allowsHitTesting`, `contentShape`.
Transform/filter: `rotationEffect`, `scaleEffect`, `rotation3DEffect`, `transformEffect`, `blur`, `brightness`, `contrast`, `saturation`, `grayscale`, `hueRotation`, `colorInvert`, `blendMode`, `compositingGroup`, `drawingGroup`, `geometryGroup`.
Control/env: `controlSize`, `labelsHidden`, `imageScale`, `symbolRenderingMode`, `symbolVariant`, `preferredColorScheme`.

### Delivered as system hooks / components (`H`)

| Modifier | Where |
| --- | --- |
| `onTapGesture`, `onLongPressGesture`, `gesture`, `highPriorityGesture`, `simultaneousGesture` | `system/gestures.ts` (`useTapGesture`, `useLongPressGesture`, `useGesture`, recognizers + `sequenced`/`simultaneously`/`exclusively`) |
| `onHover`, `onContinuousHover` | `system/gestures.ts` (`useOnHover`, `useOnContinuousHover`) |
| `onKeyPress`, `onMoveCommand`, `focusable` | `system/gestures.ts` (`useOnKeyPress`, `useOnMoveCommand`, `useButtonGesture`) |
| `animation`, `withAnimation`, `transition` | `system/animation.ts` (`useAnimation`, `withAnimation`, `transitionStyles`, `useMountTransition`) + `system/Transition.tsx` |
| `sheet`, `fullScreenCover`, `popover`, `alert`, `confirmationDialog`, `contextMenu` | `components/presentation/*` (component + `useSheet`/`useAlert`/… imperative hooks, portal into `#sui-presentation-root`) |
| `glassEffect`, `material`, vibrancy | `system/effects.ts` (`Glass`, `Material`, `Vibrant`, `glassClass`) |
| `colorScheme` / environment | `system/environment.tsx` (`SwiftUIProvider`, `EnvironmentOverride`, `useEnvironment`) |
| `overlay`/`mask`-as-view | partial — `ZStack`/effects host overlays; **no general `.overlay(_:)`/`.mask(_:)` modifier** (see MISSING) |

### Delivered as component props / cluster APIs (`P`)

`*Style` family (`buttonStyle`, `listStyle`, `pickerStyle`, `toggleStyle`, `menuStyle`, `gaugeStyle`, `progressViewStyle`, `textFieldStyle`, `labelStyle`, `tabViewStyle`, `datePickerStyle`, `tableStyle`, `formStyle`, …) → `system/styles.ts` providers.
Navigation/toolbar (`navigationTitle`, `navigationDestination`, `toolbar`, `navigationBarBackButtonHidden`, `navigationBarHidden`, `toolbarBackground`, `tabItem`, `badge`) → `components/navigation/*`.
Presentation tuning (`presentationDetents`, `presentationDragIndicator`, `interactiveDismissDisabled`) → `components/presentation/*`.
List/scroll (`swipeActions` → `List/ListRow`; `refreshable`, `scrollTargetBehavior`, `scrollPosition` → `ScrollView`).
Data (`onChange`, `onSubmit`) → wired into individual controls (TextField, Picker, Toggle, …) but **not** available as a general view modifier.

### MISSING modifiers (36 of the sampled 158 — `X`)

Grouped by theme, highest user-impact first:

**Lifecycle / data (no general modifier — the biggest gap):**
`onAppear`, `onDisappear`, `task`, `onChange` (general form), `onReceive`.

**Search:**
`searchable`, `searchScopes` (no search infrastructure at all).

**Drag & drop:**
`draggable`, `onDrag`, `onDrop`, `dropDestination`.

**Scroll behavior (beyond the few wired into ScrollView):**
`scrollDisabled`, `scrollIndicators`, `scrollClipDisabled`, `scrollTransition`, `scrollContentBackground`.

**Composition / effects:**
`overlay(_:)` (view overlay, vs the color one), `mask(_:)`, `visualEffect`, `matchedGeometryEffect`, `contentTransition`, `symbolEffect`, `sensoryFeedback`, `containerBackground`, `containerShape`.

**Safe area / layout:**
`ignoresSafeArea`, `edgesIgnoringSafeArea`, `safeAreaPadding`, `scenePadding`, `containerRelativeFrame`.

**Text / interaction:**
`textSelection`, `textRenderer`, `keyboardShortcut`, `hoverEffect`, `focused` (focus-state binding), `help` (tooltip), `tag`, `id`.

> Note: the full inventory lists 502 modifier names, but the long tail is platform-shell / OS-integration surface (`fileImporter`, `onOpenURL`, `userActivity`, `windowResizeBehavior`, `digitalCrownRotation`, `touchBar*`, `immersive*`, `previewDevice`, the `chart*` axis/scale family, the `accessibility*` family, the `file*Dialog*` family, etc.) that has no meaningful web analog or is intentionally out of scope. Those are excluded from the 158-modifier user-facing denominator. The 77% figure is over the modifiers a real web app actually reaches for.

---

## PRIORITIZED missing list (genuinely user-facing — implement in this order)

Excludes pure plumbing (EnvironmentValues keys, `_Layout*` roots, default-label/`*Configuration` structs, OS-shell modifiers).

### Components
1. **AsyncImage** — async URL image with `phase` (empty/success/failure) placeholder + error states. Ubiquitous.
2. **ContentUnavailableView** — standard empty/error state (icon + title + description + actions). Ubiquitous in modern apps.
3. **GroupBox** — boxed titled container; style scaffolding already exists, only the component is missing.
4. **LabeledContent** — label-value row; style config already exists.
5. **Chart3D** — 3D charts (+ `chart3D*`/`chartZAxis` family). Niche; defer.
6. **HSplitView / VSplitView / NavigationView** — deprecated or macOS-desktop-only; lowest priority (modern replacements already shipped).

### Modifiers / behaviors
7. **`onAppear` / `onDisappear`** — lifecycle hooks; trivially common, currently absent.
8. **`task`** — async-on-appear with cancellation; pairs with #1 AsyncImage.
9. **`onChange(of:)`** as a *general* view modifier (today only wired per-control).
10. **`searchable` + `searchScopes`** — no search infrastructure exists; high value for List/NavigationStack.
11. **`overlay(_:)` / `mask(_:)`** — view-content overlay and masking (only the color-`background` path exists in the compiler).
12. **`matchedGeometryEffect`** — hero/shared-element transitions; high polish value.
13. **Drag & drop** — `draggable` / `dropDestination` (and legacy `onDrag`/`onDrop`).
14. **Scroll behavior set** — `scrollDisabled`, `scrollIndicators`, `scrollContentBackground`, `scrollTransition`.
15. **`ignoresSafeArea` / `safeAreaPadding`**, **`focused`** (focus-state binding), **`keyboardShortcut`**, **`help`** (tooltip), **`symbolEffect`/`sensoryFeedback`/`contentTransition`** — smaller, frequently-reached-for polish modifiers.
