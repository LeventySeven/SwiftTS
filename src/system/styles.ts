"use client";
/**
 * SwiftUI Style System — Cluster C15 (the variant engine contract).
 *
 * In SwiftUI a *style* is the strategy object a control's `makeBody(configuration:)`
 * uses to render itself. The control supplies a **Configuration** struct describing
 * its *semantic content* (label, icon, isPressed, isOn, fractionCompleted…); the
 * style turns that content into pixels.
 *
 * Web translation model (the spine of the whole cluster):
 *   • every style protocol  → a `variant` (string union) prop on the React component;
 *   • every concrete style  → one value of that union, realized as a `data-variant`
 *                             attribute + a CSS rule block (the DOM skeleton never
 *                             changes — only CSS custom properties / display rules);
 *   • every `*StyleConfiguration` → the render-prop / children contract: the exact
 *                             list of sub-view *slots* a control hands to its style.
 *
 * This file is INFRA — it ships ONLY the style *system* (the union types, the
 * Configuration shapes, and the React cascade contexts). The concrete control
 * visuals (`<Button>`, `<Toggle>`, `<Picker>`, `<List>`…) are built by the C2/C4/C6
 * component clusters, which import the types + `useResolvedStyle` + `StyleProvider`
 * from here.
 *
 * Source labels in the spec: KNOWN = verbatim from the `.swiftinterface`; INFERRED =
 * HIG/WWDC/RE for runtime visuals; DESIGNED = the React/CSS engineering below.
 */
import React, { createContext, useContext, useMemo } from "react";
import type { Role } from "./types";

// ============================================================================
// 0. The universal style-protocol shape
// ============================================================================
//
// Open (`makeBody`) protocols are user-overridable → the React component accepts a
// custom render fn `(cfg) => ReactNode` in addition to the named variant union.
// Closed (`_makeView`) protocols are system-only → a closed `variant` union, no
// custom slot. `CustomStyle<Cfg>` is the render-fn shape for the open ones.

/** A custom style for an OPEN style protocol: render the configuration to DOM. */
export type CustomStyle<Cfg> = (configuration: Cfg) => React.ReactNode;

// ============================================================================
// 1. Style-name unions (one per style protocol)
// ============================================================================

/** `ButtonStyle` / `PrimitiveButtonStyle` — `.buttonStyle(…)`. */
export type ButtonStyleName =
  | "automatic"
  | "bordered"
  | "borderedProminent"
  | "borderless"
  | "plain"
  | "link"
  | "glass"
  | "glassProminent";

/** `ToggleStyle` — `.toggleStyle(…)`. */
export type ToggleStyleName = "automatic" | "switch" | "button" | "checkbox";

/** `PickerStyle` (closed) — `.pickerStyle(…)`. */
export type PickerStyleName =
  | "automatic"
  | "menu"
  | "segmented"
  | "wheel"
  | "inline"
  | "palette"
  | "navigationLink"
  | "radioGroup";

/** `ListStyle` (closed) — `.listStyle(…)`. */
export type ListStyleName =
  | "automatic"
  | "plain"
  | "grouped"
  | "insetGrouped"
  | "inset"
  | "sidebar"
  | "bordered";

/** `LabelStyle` — `.labelStyle(…)`. */
export type LabelStyleName =
  | "automatic"
  | "titleAndIcon"
  | "iconOnly"
  | "titleOnly";

/** `ProgressViewStyle` — `.progressViewStyle(…)`. */
export type ProgressViewStyleName = "automatic" | "linear" | "circular";

/** `GaugeStyle` — `.gaugeStyle(…)` (iOS16+/macOS13+). */
export type GaugeStyleName =
  | "automatic"
  | "linearCapacity"
  | "linear"
  | "circular"
  | "accessoryCircular"
  | "accessoryCircularCapacity"
  | "accessoryLinear"
  | "accessoryLinearCapacity";

/** `TextFieldStyle` (closed) — `.textFieldStyle(…)`. */
export type TextFieldStyleName =
  | "automatic"
  | "plain"
  | "roundedBorder"
  | "squareBorder";

/** `TextEditorStyle` — `.textEditorStyle(…)` (iOS17+/macOS14+). */
export type TextEditorStyleName = "automatic" | "plain" | "roundedBorder";

/** `MenuStyle` — `.menuStyle(…)`. */
export type MenuStyleName =
  | "automatic"
  | "borderedButton"
  | "borderlessButton"
  | "button";

/** `ControlGroupStyle` — `.controlGroupStyle(…)`. */
export type ControlGroupStyleName =
  | "automatic"
  | "navigation"
  | "palette"
  | "menu"
  | "compactMenu";

/** `FormStyle` — `.formStyle(…)` (iOS16+). */
export type FormStyleName = "automatic" | "grouped" | "columns";

/** `DatePickerStyle` — `.datePickerStyle(…)`. */
export type DatePickerStyleName =
  | "automatic"
  | "compact"
  | "graphical"
  | "wheel"
  | "field"
  | "stepperField";

/** `TabViewStyle` (closed) — `.tabViewStyle(…)`. */
export type TabViewStyleName =
  | "automatic"
  | "page"
  | "verticalPage"
  | "sidebarAdaptable"
  | "tabBarOnly"
  | "grouped";

/** `TableStyle` — `.tableStyle(…)` (iOS16+/macOS12+). */
export type TableStyleName = "automatic" | "inset" | "bordered";

/** `NavigationSplitViewStyle` — `.navigationSplitViewStyle(…)`. */
export type NavigationSplitViewStyleName =
  | "automatic"
  | "balanced"
  | "prominentDetail";

/** `GroupBoxStyle` — only `.automatic` is concrete. */
export type GroupBoxStyleName = "automatic";

/** `DisclosureGroupStyle` — only `.automatic` is concrete. */
export type DisclosureGroupStyleName = "automatic";

/** `LabeledContentStyle` — only `.automatic` is concrete. */
export type LabeledContentStyleName = "automatic";

// ============================================================================
// 2. Configuration interfaces (the slot contracts)
// ============================================================================
//
// Each `*StyleConfiguration` is the AUTHORITATIVE list of sub-views a control hands
// its style — i.e. exactly which slots the React component must expose. These are
// passed to a `CustomStyle<Cfg>` render fn for the open protocols, and document the
// controlled-input contracts (isOn/selection bindings) for the closed ones.

/** `ButtonStyleConfiguration` (SUI:10359) — styling-only; system owns the gesture. */
export interface ButtonStyleConfiguration {
  /** The title+icon the user passed (the `.label` slot). */
  label: React.ReactNode;
  /** `.destructive` / `.cancel` / undefined — semantic intent. */
  role?: Role;
  /** True while finger/cursor is down (≈ CSS `:active`). */
  isPressed: boolean;
}

/** `PrimitiveButtonStyleConfiguration` (SUI:8298) — full-control; style owns the gesture. */
export interface PrimitiveButtonStyleConfiguration {
  label: React.ReactNode;
  role?: Role;
  /** Fire the button's action — == SwiftUI `trigger()`. The style decides *when*. */
  trigger: () => void;
}

/** `ToggleStyleConfiguration` (SUI:3083) — the canonical controlled-input contract. */
export interface ToggleStyleConfiguration {
  label: React.ReactNode;
  /** Two-way on/off — read AND write (`$isOn` binding). */
  isOn: boolean;
  onChange: (isOn: boolean) => void;
  /** iOS16+ tri-state: the indeterminate dash ("select all" partial). */
  isMixed?: boolean;
}

/** `LabelStyleConfiguration` (SUI:23853) — the cleanest config: an (icon, title) row. */
export interface LabelStyleConfiguration {
  title: React.ReactNode;
  icon: React.ReactNode;
}

/** `ProgressViewStyleConfiguration` (SUI:11491). `fractionCompleted == null` ⇒ indeterminate. */
export interface ProgressViewStyleConfiguration {
  /** 0…1, or null/undefined ⇒ INDETERMINATE (render the spinner/barber-pole). */
  fractionCompleted?: number | null;
  label?: React.ReactNode;
  currentValueLabel?: React.ReactNode;
}

/** `GaugeStyleConfiguration` (SUI:19766) — the richest config: value + five label slots. */
export interface GaugeStyleConfiguration {
  /** 0…1 normalized position. */
  value: number;
  label?: React.ReactNode;
  currentValueLabel?: React.ReactNode;
  minimumValueLabel?: React.ReactNode;
  maximumValueLabel?: React.ReactNode;
  markedValueLabel?: React.ReactNode;
}

/** `MenuStyleConfiguration` (SUI:2839) — a command list, NOT a value picker (no selection). */
export interface MenuStyleConfiguration {
  /** The menu's trigger label. */
  label: React.ReactNode;
  /** The menu items. */
  content: React.ReactNode;
}

/** `FormStyleConfiguration` (SUI:15621) — "a List specialized for editing". */
export interface FormStyleConfiguration {
  /** The whole form body. */
  content: React.ReactNode;
}

/** `DatePickerComponents` OptionSet — `.date` | `.hourAndMinute`. */
export type DatePickerComponent = "date" | "hourAndMinute";

/** `DatePickerStyleConfiguration` (SUI:24164) — richest binding config. */
export interface DatePickerStyleConfiguration {
  label?: React.ReactNode;
  /** The chosen date (two-way `$selection`). */
  selection: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Which fields to edit: date | time | both. */
  displayedComponents?: DatePickerComponent[];
}

/** `DisclosureGroupStyleConfiguration` (SUI:4198). */
export interface DisclosureGroupStyleConfiguration {
  /** Header row. */
  label: React.ReactNode;
  /** Collapsible body. */
  content: React.ReactNode;
  /** Open/closed (two-way `$isExpanded`). */
  isExpanded: boolean;
  onChange: (isExpanded: boolean) => void;
}

/** `GroupBoxStyleConfiguration` (SUI:21017) — a titled rounded panel. */
export interface GroupBoxStyleConfiguration {
  label: React.ReactNode;
  content: React.ReactNode;
}

/** `LabeledContentStyleConfiguration` (SUI:22752) — the Settings "Version 1.0" row. */
export interface LabeledContentStyleConfiguration {
  /** Leading. */
  label: React.ReactNode;
  /** Trailing value. */
  content: React.ReactNode;
}

/** `ControlGroupStyleConfiguration` (SUI:20213) — controls fused into one toolbar group. */
export interface ControlGroupStyleConfiguration {
  /** The grouped controls. */
  content: React.ReactNode;
  /** iOS16+ optional group label. */
  label?: React.ReactNode;
}

/**
 * `PickerStyleConfiguration` — Picker is a CLOSED protocol with NO SwiftUI
 * Configuration; this is the DESIGNED web slot contract (the content a Picker always
 * has). `SelectionValue: Hashable` ⇒ the key type is a primitive/id.
 */
export interface PickerStyleConfiguration<T extends string | number = string | number> {
  /** The Picker's own title. */
  label?: React.ReactNode;
  /** Current selection (the Hashable tag). */
  selection: T;
  onChange: (value: T) => void;
  /** `(tag, label)` options. */
  options: { value: T; label: React.ReactNode }[];
}

/**
 * `ListStyleConfiguration` — List is a CLOSED protocol (`_ListValue<SelectionValue>`)
 * with no author-overridable slot; structure is fixed (sections → rows). This is the
 * DESIGNED web slot contract. The style sets bg / insets / separators / corners.
 */
export interface ListStyleConfiguration {
  children: React.ReactNode;
}

/**
 * `TextFieldStyleConfiguration` — TextField is a CLOSED `_body`-based protocol that
 * re-skins the whole field (no public Configuration). DESIGNED web slot contract.
 */
export interface TextFieldStyleConfiguration {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** `TextEditorStyleConfiguration` (SUI:3042) — EMPTY in SwiftUI; DESIGNED web slots. */
export interface TextEditorStyleConfiguration {
  value: string;
  onChange: (value: string) => void;
}

/** `TableStyleConfiguration` (SUI:19737) — EMPTY; data comes from TableColumn builders. */
export interface TableStyleConfiguration {
  alternatesRowBackgrounds?: boolean;
}

/** `TabViewStyleConfiguration` — closed (`_TabViewValue<Style,SelectionValue>`). DESIGNED slots. */
export interface TabViewStyleConfiguration<T = unknown> {
  selection: T;
  onChange: (tag: T) => void;
  tabs: {
    tag: T;
    label: React.ReactNode;
    icon?: React.ReactNode;
    content: React.ReactNode;
  }[];
}

/** `NavigationSplitViewStyleConfiguration` (SUI:5855) — EMPTY in SwiftUI; DESIGNED slots. */
export interface NavigationSplitViewStyleConfiguration {
  sidebar: React.ReactNode;
  content?: React.ReactNode;
  detail: React.ReactNode;
}

// ============================================================================
// 3. SwiftUICore primitive drawing styles (paint/geometry value types)
// ============================================================================
//
// These are value structs consumed by Shape/Canvas/modifiers (fill/stroke/shadow/
// corner), NOT control skins. They map 1:1 to CSS/SVG. The whole kit's shapes and
// borders reference them, so they live in the style contract.

/** `StrokeStyle` (CORE:8630). Maps 1:1 to SVG stroke-* attributes. */
export interface StrokeStyle {
  /** → `stroke-width` (default 1). */
  lineWidth?: number;
  /** → `stroke-linecap` (default "butt"). */
  lineCap?: "butt" | "round" | "square";
  /** → `stroke-linejoin` (default "miter"). */
  lineJoin?: "miter" | "round" | "bevel";
  /** → `stroke-miterlimit` (default 10). */
  miterLimit?: number;
  /** → `stroke-dasharray` (default []). */
  dash?: number[];
  /** → `stroke-dashoffset` (default 0). */
  dashPhase?: number;
}

/** `FillStyle` (CORE:6218). */
export interface FillStyle {
  /** even-odd vs non-zero winding → SVG `fill-rule:evenodd` (default false). */
  eoFill?: boolean;
  /** → `shape-rendering:auto` vs `crispEdges` (default true). */
  antialiased?: boolean;
}

/**
 * `ShadowStyle` (CORE:8542). KNOWN defaults: drop = linear-sRGB black @ 0.33,
 * inner = black @ 0.55. SwiftUI `radius` is a Gaussian sigma → CSS blur ≈ radius*2.
 */
export interface ShadowStyle {
  kind: "drop" | "inner";
  /** Gaussian sigma (multiply by ~2 for CSS blur). */
  radius: number;
  x?: number;
  y?: number;
  /** Defaults: drop rgba(0,0,0,.33), inner rgba(0,0,0,.55). */
  color?: string;
}

/** `RoundedCornerStyle` (CORE:19017). `.continuous` = Apple squircle (superellipse). */
export type RoundedCornerStyle = "circular" | "continuous";

/** `PointerStyle` (SUI:20946) — macOS cursor shapes; the canonical name set. */
export type PointerStyleName =
  | "default"
  | "horizontalText"
  | "link"
  | "zoomIn"
  | "zoomOut"
  | "columnResize"
  | "rowResize"
  | "grabIdle"
  | "grabActive"
  | "frameResize"
  | "image";

/** `ScrollEdgeEffectStyle` (SUI:12150) — the fade/blur at a scroll container's edge. */
export type ScrollEdgeEffectStyleName = "automatic" | "hard" | "soft";

// ============================================================================
// 4. Constant defaults (KNOWN from the .swiftinterface)
// ============================================================================

/** KNOWN `StrokeStyle` defaults (CORE:8630 init). */
export const STROKE_STYLE_DEFAULTS: Required<Omit<StrokeStyle, "dash">> & {
  dash: number[];
} = {
  lineWidth: 1,
  lineCap: "butt",
  lineJoin: "miter",
  miterLimit: 10,
  dash: [],
  dashPhase: 0,
};

/** KNOWN `FillStyle` defaults (CORE:6218 init). */
export const FILL_STYLE_DEFAULTS: Required<FillStyle> = {
  eoFill: false,
  antialiased: true,
};

/** KNOWN `ShadowStyle` default colors (CORE:8542). */
export const SHADOW_DEFAULT_COLORS = {
  drop: "rgba(0,0,0,.33)",
  inner: "rgba(0,0,0,.55)",
} as const;

/** `PointerStyle` → CSS `cursor` map (KNOWN 1:1 from SUI:20946). */
export const POINTER_STYLE_CURSOR: Record<PointerStyleName, string> = {
  default: "default",
  horizontalText: "text",
  link: "pointer",
  zoomIn: "zoom-in",
  zoomOut: "zoom-out",
  columnResize: "col-resize",
  rowResize: "row-resize",
  grabIdle: "grab",
  grabActive: "grabbing",
  // .frameResize/.image are position/asset dependent — sensible defaults.
  frameResize: "nwse-resize",
  image: "auto",
};

// ============================================================================
// 5. The style-inheritance cascade (React contexts + useResolvedStyle)
// ============================================================================
//
// In SwiftUI a style set on a CONTAINER cascades to every descendant control of that
// kind: `.buttonStyle(.bordered)` on a VStack styles every Button inside; `.listStyle`
// on a List styles nested Lists; `.labelStyle` on a toolbar styles its Labels. We
// model this with ONE React context per control type. A `<StyleProvider>` (or the
// per-kind helpers) pushes a value; a descendant reads it via `useResolvedStyle`.
//
//   resolution order:  explicit prop  >  nearest provider in the tree  >  "automatic"
//
// "automatic" stays unresolved here — a control resolves it to a concrete look at
// render time using the environment (platform/context), which is the C2/C4/C6 job.

/** The control kinds that participate in style inheritance. */
export type StyleControlType =
  | "button"
  | "toggle"
  | "picker"
  | "list"
  | "label"
  | "progressView"
  | "gauge"
  | "textField"
  | "textEditor"
  | "menu"
  | "controlGroup"
  | "form"
  | "datePicker"
  | "tabView"
  | "table"
  | "navigationSplitView"
  | "groupBox"
  | "disclosureGroup"
  | "labeledContent";

/** Maps each control type to its style-name union (the value its context carries). */
export interface StyleNameByControl {
  button: ButtonStyleName;
  toggle: ToggleStyleName;
  picker: PickerStyleName;
  list: ListStyleName;
  label: LabelStyleName;
  progressView: ProgressViewStyleName;
  gauge: GaugeStyleName;
  textField: TextFieldStyleName;
  textEditor: TextEditorStyleName;
  menu: MenuStyleName;
  controlGroup: ControlGroupStyleName;
  form: FormStyleName;
  datePicker: DatePickerStyleName;
  tabView: TabViewStyleName;
  table: TableStyleName;
  navigationSplitView: NavigationSplitViewStyleName;
  groupBox: GroupBoxStyleName;
  disclosureGroup: DisclosureGroupStyleName;
  labeledContent: LabeledContentStyleName;
}

/** The value stored in a per-control style context (`undefined` = no ancestor set one). */
type StyleContextValue<K extends StyleControlType> = StyleNameByControl[K] | undefined;

// One context per control type. `undefined` default ⇒ "no inherited style".
const StyleContexts = {
  button: createContext<StyleContextValue<"button">>(undefined),
  toggle: createContext<StyleContextValue<"toggle">>(undefined),
  picker: createContext<StyleContextValue<"picker">>(undefined),
  list: createContext<StyleContextValue<"list">>(undefined),
  label: createContext<StyleContextValue<"label">>(undefined),
  progressView: createContext<StyleContextValue<"progressView">>(undefined),
  gauge: createContext<StyleContextValue<"gauge">>(undefined),
  textField: createContext<StyleContextValue<"textField">>(undefined),
  textEditor: createContext<StyleContextValue<"textEditor">>(undefined),
  menu: createContext<StyleContextValue<"menu">>(undefined),
  controlGroup: createContext<StyleContextValue<"controlGroup">>(undefined),
  form: createContext<StyleContextValue<"form">>(undefined),
  datePicker: createContext<StyleContextValue<"datePicker">>(undefined),
  tabView: createContext<StyleContextValue<"tabView">>(undefined),
  table: createContext<StyleContextValue<"table">>(undefined),
  navigationSplitView: createContext<StyleContextValue<"navigationSplitView">>(undefined),
  groupBox: createContext<StyleContextValue<"groupBox">>(undefined),
  disclosureGroup: createContext<StyleContextValue<"disclosureGroup">>(undefined),
  labeledContent: createContext<StyleContextValue<"labeledContent">>(undefined),
} as const;

// Give each context a stable displayName for React DevTools.
for (const key of Object.keys(StyleContexts) as StyleControlType[]) {
  (StyleContexts[key] as React.Context<unknown>).displayName = `SwiftUIStyle(${key})`;
}

/**
 * Resolve the active style for a control of `controlType`.
 *
 * @param controlType which control kind is asking (e.g. "button").
 * @param explicit    the style passed directly on the control (highest priority).
 * @returns explicit  ?? inherited (nearest provider) ?? "automatic".
 *
 * The returned value is always a concrete *name* of the right union; "automatic"
 * means "let the control pick a look from the environment at render time".
 */
export function useResolvedStyle<K extends StyleControlType>(
  controlType: K,
  explicit?: StyleNameByControl[K],
): StyleNameByControl[K] {
  const ctx = StyleContexts[controlType] as React.Context<StyleContextValue<K>>;
  const inherited = useContext(ctx);
  return (explicit ?? inherited ?? "automatic") as StyleNameByControl[K];
}

/**
 * Read the inherited style for a control kind WITHOUT applying the "automatic"
 * fallback — returns `undefined` when no ancestor set one. Useful for a container
 * that wants to forward an inherited style only when present.
 */
export function useInheritedStyle<K extends StyleControlType>(
  controlType: K,
): StyleNameByControl[K] | undefined {
  const ctx = StyleContexts[controlType] as React.Context<StyleContextValue<K>>;
  return useContext(ctx);
}

// ============================================================================
// 6. StyleProvider helpers (push a style into the cascade)
// ============================================================================

export interface StyleProviderProps<K extends StyleControlType> {
  /** Which control kind this style applies to. */
  controlType: K;
  /** The style name to cascade to descendants. */
  style: StyleNameByControl[K];
  children: React.ReactNode;
}

/**
 * Generic provider — the web equivalent of `.someStyle(...)` set on a container.
 * Pushes `style` into the per-control context so every descendant control of
 * `controlType` inherits it (unless it sets its own explicit style).
 *
 * For ergonomics each control cluster typically wraps this in a named helper
 * (`ButtonStyleProvider`, `ListStyleProvider`, …) generated by `makeStyleProvider`.
 */
export function StyleProvider<K extends StyleControlType>({
  controlType,
  style,
  children,
}: StyleProviderProps<K>): React.ReactElement {
  const Ctx = StyleContexts[controlType] as React.Context<StyleContextValue<K>>;
  const value = useMemo(() => style, [style]);
  return React.createElement(Ctx.Provider, { value }, children);
}

/**
 * Build a named, single-purpose provider for one control kind.
 *
 *   const ButtonStyleProvider = makeStyleProvider("button");
 *   <ButtonStyleProvider style="bordered"> … </ButtonStyleProvider>
 *
 * The returned component takes `{ style, children }` and cascades the style to all
 * descendant controls of that kind. This is the canonical way the C2/C4/C6 clusters
 * expose `.buttonStyle`, `.toggleStyle`, `.listStyle`, etc.
 */
export function makeStyleProvider<K extends StyleControlType>(
  controlType: K,
): React.FC<{ style: StyleNameByControl[K]; children: React.ReactNode }> {
  const Ctx = StyleContexts[controlType] as React.Context<StyleContextValue<K>>;
  const Provider: React.FC<{ style: StyleNameByControl[K]; children: React.ReactNode }> = ({
    style,
    children,
  }) => React.createElement(Ctx.Provider, { value: style }, children);
  Provider.displayName = `${controlType[0].toUpperCase()}${controlType.slice(1)}StyleProvider`;
  return Provider;
}

// Pre-built named providers for every control kind. A cluster can import the one it
// needs (e.g. C2 imports ButtonStyleProvider / ToggleStyleProvider) instead of
// threading `controlType` through the generic `<StyleProvider>`.
export const ButtonStyleProvider = makeStyleProvider("button");
export const ToggleStyleProvider = makeStyleProvider("toggle");
export const PickerStyleProvider = makeStyleProvider("picker");
export const ListStyleProvider = makeStyleProvider("list");
export const LabelStyleProvider = makeStyleProvider("label");
export const ProgressViewStyleProvider = makeStyleProvider("progressView");
export const GaugeStyleProvider = makeStyleProvider("gauge");
export const TextFieldStyleProvider = makeStyleProvider("textField");
export const TextEditorStyleProvider = makeStyleProvider("textEditor");
export const MenuStyleProvider = makeStyleProvider("menu");
export const ControlGroupStyleProvider = makeStyleProvider("controlGroup");
export const FormStyleProvider = makeStyleProvider("form");
export const DatePickerStyleProvider = makeStyleProvider("datePicker");
export const TabViewStyleProvider = makeStyleProvider("tabView");
export const TableStyleProvider = makeStyleProvider("table");
export const NavigationSplitViewStyleProvider = makeStyleProvider("navigationSplitView");
export const GroupBoxStyleProvider = makeStyleProvider("groupBox");
export const DisclosureGroupStyleProvider = makeStyleProvider("disclosureGroup");
export const LabeledContentStyleProvider = makeStyleProvider("labeledContent");

// ============================================================================
// 7. Convenience: render an open style (named variant OR custom render fn)
// ============================================================================

/**
 * The value a control accepts for an OPEN style protocol: either a built-in variant
 * name or a custom render fn that turns the configuration into DOM.
 */
export type StyleOf<Name extends string, Cfg> = Name | CustomStyle<Cfg>;

/** Narrow a style value to its custom render fn (vs. a built-in variant name). */
export function isCustomStyle<Cfg>(
  style: StyleOf<string, Cfg> | undefined,
): style is CustomStyle<Cfg> {
  return typeof style === "function";
}

/**
 * Resolve an open-protocol style to `{ variant, render }`: if the caller passed a
 * function it's a custom style (use `render(cfg)`); otherwise it's a named variant.
 */
export function resolveOpenStyle<Name extends string, Cfg>(
  style: StyleOf<Name, Cfg> | undefined,
  fallback: Name,
): { variant: Name; render?: CustomStyle<Cfg> } {
  if (isCustomStyle<Cfg>(style)) return { variant: fallback, render: style };
  return { variant: (style ?? fallback) as Name };
}
