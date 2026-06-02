/**
 * The SwiftUI modifier compiler — `applyModifiers(props)`.
 *
 * RE'd from the C10 styling-modifiers spec (`teardowns/SWIFTUI_C10_styling-modifiers.md`).
 * This is the single styling engine every component in the kit consumes: an
 * idiomatic SwiftUI-shaped prop bag → a `{ style, className, rest }` triple.
 *
 *   - `style`  : a React.CSSProperties object built from the token CSS vars,
 *                using LOGICAL CSS props (padding-inline-*) so RTL flips like
 *                SwiftUI's leading/trailing.
 *   - `className`: space-joined utility classes for the cases that can't be a
 *                  pure inline style (redaction skeleton, labels-hidden, …).
 *   - `rest`   : every prop that ISN'T a modifier — spread straight onto the DOM
 *                node by the consuming component.
 *
 * Pure + SSR-safe: no `window`, no `document`, deterministic output. The exact
 * CSS for each modifier follows the spec's "Web mapping (DESIGNED)" tables
 * verbatim (frame→flex grid, shadow blur = 2×radius, brightness = 1+a, etc.).
 */
import "./modifiers.global.css";
// The `glassEffect` prop alias emits the `sui-glass*` classes whose CSS lives in
// effects.global.css; import it so a plain <View glassEffect> renders the surface
// even when effects.ts isn't otherwise loaded.
import "./effects.global.css";
import type * as React from "react";
import type {
  Alignment,
  Axis,
  ColorToken,
  ControlSize,
  Edge,
  EdgeSet,
  FontDesign,
  FontTextStyle,
  FontWeight,
} from "./types";

/* =============================================================================
 * Sub-shapes
 * ========================================================================== */

/** SwiftUI UnitPoint → CSS transform-origin anchor. */
export type UnitPoint =
  | "center"
  | "top" | "bottom" | "leading" | "trailing"
  | "topLeading" | "topTrailing"
  | "bottomLeading" | "bottomTrailing"
  | { x: number; y: number };

/** Length on a flexible-frame axis; `'infinity'` = `.frame(maxWidth: .infinity)`. */
export type FlexLength = number | "infinity";

export interface FrameProps {
  width?: FlexLength;
  height?: FlexLength;
  minWidth?: number;
  maxWidth?: FlexLength;
  idealWidth?: number;
  minHeight?: number;
  maxHeight?: FlexLength;
  idealHeight?: number;
  alignment?: Alignment;
}

/** `.padding()` true → system default 16; number → all edges; object → per-edge. */
export type PaddingProp =
  | boolean
  | number
  | Partial<Record<Edge | "horizontal" | "vertical" | "all", number>>;

export type ClipShape = "capsule" | "circle" | { rounded: number };

export interface ShadowProps {
  radius: number;
  x?: number;
  y?: number;
  color?: ColorToken | string;
}

export type FontProp =
  | FontTextStyle
  | { size: number; weight?: FontWeight; design?: FontDesign };

export type LinePattern = "solid" | "dot" | "dash" | "dashDot" | "dashDotDot";

export interface BorderProps {
  color: ColorToken | string;
  width?: number;
}

export interface AspectRatioProps {
  ratio?: number;
  contentMode?: "fit" | "fill";
}

export type FixedSizeProp = boolean | { horizontal?: boolean; vertical?: boolean };

export interface RotationEffectObj {
  degrees: number;
  anchor?: UnitPoint;
}

export type ScaleEffectProp =
  | number
  | { x?: number; y?: number; anchor?: UnitPoint };

export interface Rotation3DEffectProps {
  degrees: number;
  axis: [number, number, number];
  anchor?: UnitPoint;
  perspective?: number;
}

export interface OverlayProps {
  content: React.ReactNode;
  alignment?: Alignment;
}

/**
 * `.mask(alignment:_:)` — alpha/luminance mask from a view (C10 §B.9).
 *
 * Two shapes, mirroring the two web mask strategies:
 *   - a CSS string  → used directly as `mask-image` (e.g. a `linear-gradient(...)`
 *     edge-fade, or a `url(#svg)` reference). This is the cheap, zero-extra-DOM
 *     path used for gradient/shape masks.
 *   - a ReactNode   → rendered into an off-flow layer that `<View>` rasterizes to
 *     a CSS mask via `mask-image`/`-webkit-mask` (luminance or alpha). See
 *     `<View>` for the rendering approach.
 */
export type MaskProp =
  | string
  | { image: string; mode?: "alpha" | "luminance" }
  | { content: React.ReactNode; alignment?: Alignment; mode?: "alpha" | "luminance" };

/**
 * `.fontWidth(_:)` — SwiftUICore `Font.Width` (compressed/condensed/standard/
 * expanded). KNOWN cases from the swiftinterface; the web target is the
 * `font-stretch` percentage axis (condensed < 100% < expanded).
 */
export type FontWidth = "compressed" | "condensed" | "standard" | "expanded";

/** `.symbolEffect(_:)` — the SF-Symbol animation names (Symbols framework). */
export type SymbolEffectName =
  | "bounce" | "pulse" | "scale" | "variableColor"
  | "wiggle" | "rotate" | "breathe" | "appear" | "disappear";

/**
 * `.symbolEffect(_:isActive:)` — bare name plays it; the object form mirrors the
 * `isActive:` parameter (KNOWN, default `true`) so the effect can be toggled off
 * without removing the prop.
 */
export type SymbolEffectProp =
  | SymbolEffectName
  | { effect: SymbolEffectName; isActive?: boolean };

/** `.contentTransition(_:)` — SwiftUICore.ContentTransition statics. */
export type ContentTransitionProp =
  | "identity" | "opacity" | "interpolate" | "numericText";

/**
 * `.ignoresSafeArea(_:edges:)` — KNOWN signature `(regions: SafeAreaRegions =
 * .all, edges: Edge.Set = .all)`. `true` → ignore all edges (the bare/common
 * call); the object form selects edges and/or the region.
 */
export type IgnoresSafeAreaProp =
  | boolean
  | {
      edges?: EdgeSet;
      regions?: "all" | "container" | "keyboard";
    };

/**
 * `.safeAreaPadding(_:_:)` — KNOWN overloads: `(EdgeInsets)`, `(Edge.Set, CGFloat?)`,
 * `(CGFloat)`. `true`/number → all edges (system inset if no length); object →
 * per-edge inset added ON TOP of the safe-area inset.
 */
export type SafeAreaPaddingProp =
  | boolean
  | number
  | Partial<Record<Edge | "horizontal" | "vertical" | "all", number>>;

/**
 * `.scenePadding(_:edges:)` — KNOWN `ScenePadding` cases `.minimum` /
 * `.navigationBar` (+ default). `true` → standard scene padding on all edges;
 * the object form selects the variant and/or edges.
 */
export type ScenePaddingProp =
  | boolean
  | "minimum" | "navigationBar"
  | { padding?: "minimum" | "navigationBar"; edges?: EdgeSet };

/**
 * `.containerRelativeFrame(_:…)` — KNOWN overloads. The simple form sizes the
 * view to 100% of the nearest container along the given axes. The grid form
 * (`count:span:spacing:`) sizes it to `span` of `count` columns minus the
 * inter-column spacing — compiled to a CSS `calc()`.
 */
export interface ContainerRelativeFrameProp {
  axes: Axis | "both";
  /** grid form — total columns the container is divided into */
  count?: number;
  /** grid form — how many of those columns this view spans (default 1) */
  span?: number;
  /** grid form — gap between columns in px */
  spacing?: number;
  alignment?: Alignment;
}

/**
 * `.visualEffect { content, proxy in … }` — a geometry-aware effect closure. The
 * web can't pass a live GeometryProxy into a build-time compiler, so the
 * DESIGNED contract is: accept a ready CSS style object and/or class string to
 * merge onto the view (the common use — a transform/opacity/blur keyed off
 * scroll position is applied by the caller's own effect).
 */
export type VisualEffectProp =
  | string
  | React.CSSProperties
  | { style?: React.CSSProperties; className?: string };

/* =============================================================================
 * iOS-26 Liquid-Glass chrome modifiers (the glass-bar / scroll-edge family).
 *
 * These three modifiers make a view participate in the floating-glass-bar world:
 *   - backgroundExtensionEffect() — let the content BLEED edge-to-edge behind a
 *     translucent bar (content extends under the chrome instead of stopping at it).
 *   - scrollEdgeEffectStyle(_:for:) — the soft/hard glass FADE a scroll edge gets
 *     under a floating bar.
 *   - scrollEdgeEffectHidden(_:for:) — suppress that fade on chosen edges.
 *   - glassEffect — a prop alias for `.glassEffect(_:in:)` on a plain View.
 * ========================================================================== */

/**
 * `.backgroundExtensionEffect()` (SwiftUI:12093) / `.backgroundExtensionEffect(
 * isEnabled:)` (:12096) — the view's background extends EDGE-TO-EDGE behind
 * translucent chrome (nav/tab bars). `true` (bare) enables it; the object form
 * mirrors the `isEnabled:` parameter so it can be toggled without removing the
 * prop. Web mapping (DESIGNED): pull the view out under the safe-area insets so
 * its background bleeds under the floating bar, and mark it so the bar's blur
 * samples real content behind it.
 */
export type BackgroundExtensionEffectProp = boolean | { isEnabled?: boolean };

/**
 * `ScrollEdgeEffectStyle` (SwiftUI:12150) — the glass fade a scroll container's
 * edge gets under a floating bar. `.hard` = crisp glass cutoff; `.soft` = gentle
 * blur fade; `.automatic` = soft on iOS-26.
 *
 * NOT re-exported publicly: the CANONICAL `ScrollEdgeEffectStyle` is the one
 * exported from `system/effects.ts` (which the navigation barrel imports/re-
 * exports). This local copy exists only so modifiers.ts has no value/import cycle
 * with effects.ts; it is intentionally module-private to avoid an `export *`
 * name collision at `src/index.ts`.
 */
type ScrollEdgeEffectStyle = "automatic" | "hard" | "soft";

/**
 * `.scrollEdgeEffectStyle(_:for:)` (:12169) — set the edge fade style for chosen
 * edges of a scroll container. The bare style applies to all edges; the object
 * form selects edges (`.top`/`.bottom`/…). `null` clears the effect.
 */
export type ScrollEdgeEffectStyleProp =
  | ScrollEdgeEffectStyle
  | null
  | { style: ScrollEdgeEffectStyle | null; edges?: EdgeSet };

/**
 * `.scrollEdgeEffectHidden(_:for:)` (:12169) — hide the scroll-edge effect on the
 * chosen edges. `true` (bare) hides all; the object form selects edges.
 */
export type ScrollEdgeEffectHiddenProp =
  | boolean
  | { hidden?: boolean; edges?: EdgeSet };

/* =============================================================================
 * ViewModifierProps — the idiomatic prop bag (1:1 with SwiftUI modifier names)
 * ========================================================================== */

export interface ViewModifierProps {
  // ---- LAYOUT (Part B) ----
  frame?: FrameProps;
  padding?: PaddingProp;
  position?: { x: number; y: number };
  offset?: { x?: number; y?: number };
  fixedSize?: FixedSizeProp;
  layoutPriority?: number;
  zIndex?: number;
  clipped?: boolean;
  clipShape?: ClipShape;
  cornerRadius?: number;
  aspectRatio?: AspectRatioProps;
  scaledToFit?: boolean;
  scaledToFill?: boolean;
  /** `.containerRelativeFrame(_:…)` → width/height as a % of the nearest container. */
  containerRelativeFrame?: ContainerRelativeFrameProp;
  /**
   * `.alignmentGuide(_:computeValue:)` — best-effort: SwiftUI recomputes a stack's
   * alignment from an arbitrary closure over `ViewDimensions`, which has no pure
   * CSS analog. We accept a static nudge `{ horizontal?, vertical? }` (px) applied
   * as a `translate(...)` so simple constant guides work; complex closures are a
   * documented no-op (see applyModifiers).
   */
  alignmentGuide?: { horizontal?: number; vertical?: number };

  // ---- SAFE AREA (SwiftUICore) ----
  /** `.ignoresSafeArea(_:edges:)` → negative margins via `env(safe-area-inset-*)`. */
  ignoresSafeArea?: IgnoresSafeAreaProp;
  /** `.safeAreaPadding(_:_:)` → padding via `env(safe-area-inset-*)`. */
  safeAreaPadding?: SafeAreaPaddingProp;
  /** `.scenePadding(_:edges:)` → standard scene/reading-width padding token. */
  scenePadding?: ScenePaddingProp;

  // ---- FILL / STROKE (Part C) ----
  foregroundStyle?: ColorToken | string;
  foregroundColor?: ColorToken | string;
  background?: ColorToken | string;
  backgroundStyle?: ColorToken | string;
  tint?: ColorToken | string;
  border?: BorderProps;
  shadow?: boolean | ShadowProps;

  // ---- LAYERS (overlay / background-view / mask) — rendered by <View> ----
  /**
   * `.overlay(alignment:){ content }` — an arbitrary view drawn IN FRONT of the
   * content (C10 §C.6). Does NOT affect layout (absolutely positioned over the
   * content box). `overlayAlignment` anchors a smaller overlay (default center).
   * The color/ShapeStyle `overlay` is just a `Color`-filled node passed here.
   */
  overlayContent?: React.ReactNode;
  overlayAlignment?: Alignment;
  /**
   * `.background(alignment:){ content }` — an arbitrary view drawn BEHIND the
   * content (C10 §C.2). Like overlay, it does NOT change the content's layout
   * size (the content measures the box; the background fills it). The simple
   * `.background(Color.red)` COLOR path stays on the `background` prop above —
   * this is only for a ReactNode background (gradient view, material, badge…).
   */
  backgroundContent?: React.ReactNode;
  backgroundAlignment?: Alignment;
  /**
   * `.mask(_:)` — cut out the content with a mask's alpha/luminance (C10 §B.9).
   * String → used directly as `mask-image`. Object with `content` → rendered to
   * an off-flow layer and rasterized to a CSS mask by `<View>`.
   */
  mask?: MaskProp;

  // ---- TEXT (Part D) ----
  font?: FontProp;
  fontWeight?: FontWeight;
  fontDesign?: FontDesign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean | { pattern?: LinePattern; color?: ColorToken | string };
  strikethrough?: boolean | { pattern?: LinePattern; color?: ColorToken | string };
  kerning?: number;
  tracking?: number;
  baselineOffset?: number;
  lineLimit?: number | null;
  lineSpacing?: number;
  lineHeight?: number;
  multilineTextAlignment?: "leading" | "center" | "trailing";
  minimumScaleFactor?: number;
  truncationMode?: "head" | "tail" | "middle";
  allowsTightening?: boolean;
  textCase?: "uppercase" | "lowercase" | null;
  monospaced?: boolean;
  monospacedDigit?: boolean;
  textScale?: "default" | "secondary";
  /** `.fontWidth(_:)` → `font-stretch` percentage (condensed < 100% < expanded). */
  fontWidth?: FontWidth;
  /** `.textSelection(_:)` → `user-select: text | none`. */
  textSelection?: "enabled" | "disabled";
  /** `.flipsForRightToLeftLayoutDirection(_:)` → mirror via `scaleX(-1)` in RTL. */
  flipsForRightToLeftLayoutDirection?: boolean;

  // ---- STATE / VISIBILITY (Part E) ----
  opacity?: number;
  hidden?: boolean;
  disabled?: boolean;
  redacted?: "placeholder" | "privacy";
  /** `.unredacted()` → force-clear any inherited redaction (wins over `redacted`). */
  unredacted?: boolean;
  /** `.privacySensitive(_:)` → blur/obscure content on capture (default `true`). */
  privacySensitive?: boolean;
  /** `.help(_:)` → native tooltip via the `title` attribute. */
  help?: string;
  /** `.contentTransition(_:)` → a class enabling smooth value-change transitions. */
  contentTransition?: ContentTransitionProp;
  /** `.badgeProminence(_:)` → `data-badge-prominence` for badge-styling CSS. */
  badgeProminence?: "standard" | "increased";
  /** `.headerProminence(_:)` → `data-header-prominence` for section-header CSS. */
  headerProminence?: "standard" | "increased";
  // ---- Accessibility (SwiftUI `.accessibility*` → ARIA) --------------------
  /** `.accessibilityLabel(_:)` → `aria-label`. */
  accessibilityLabel?: string;
  /** `.accessibilityHint(_:)` → `aria-description` (falls back to `title`). */
  accessibilityHint?: string;
  /** `.accessibilityValue(_:)` → `aria-valuetext`. */
  accessibilityValue?: string;
  /** `.accessibilityHidden(_:)` → `aria-hidden`. */
  accessibilityHidden?: boolean;
  /** `.accessibilityIdentifier(_:)` → stable test id (`data-testid`). */
  accessibilityIdentifier?: string;
  /** `.accessibilityAddTraits`/role → the ARIA `role`. */
  accessibilityRole?: React.AriaRole;
  /** `.accessibilitySortPriority(_:)` → DOM tab order hint. */
  accessibilitySortPriority?: number;
  allowsHitTesting?: boolean;
  contentShape?: "rectangle" | "circle" | "capsule";

  // ---- TRANSFORM / FILTERS (Part F) ----
  rotationEffect?: number | RotationEffectObj;
  scaleEffect?: ScaleEffectProp;
  rotation3DEffect?: Rotation3DEffectProps;
  transformEffect?: [number, number, number, number, number, number];
  /**
   * `.projectionEffect(_:)` — a 3×3 ProjectionTransform (homogeneous matrix).
   * Compiled to a CSS `matrix3d(...)`. Row-major `[a,b,c, d,e,f, g,h,i]` where
   * the bottom row `[g,h,i]` carries the perspective/projection terms.
   */
  projectionEffect?: [number, number, number, number, number, number, number, number, number];
  /**
   * `.visualEffect { … }` — merge an arbitrary CSS style object / class onto the
   * view (DESIGNED closure substitute; see `VisualEffectProp`).
   */
  visualEffect?: VisualEffectProp;
  blur?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  grayscale?: number;
  hueRotation?: number;
  colorInvert?: boolean;
  blendMode?: React.CSSProperties["mixBlendMode"];
  compositingGroup?: boolean;
  drawingGroup?: boolean;
  geometryGroup?: boolean;

  // ---- iOS-26 LIQUID-GLASS CHROME (glass-bar / scroll-edge family) ----------
  /**
   * `.glassEffect(_:in:)` — apply the iOS-26 Liquid-Glass surface to this view.
   * `true` → the default `.regular` glass clipped to a capsule; the object form
   * selects the variant / tint / interactive / clip shape. This is the prop ALIAS
   * for the `<GlassEffect>` component (effects.ts owns the surface; here it's a
   * one-prop modifier that emits the same glass class + tint var inline).
   */
  glassEffect?:
    | boolean
    | {
        variant?: "regular" | "clear" | "identity";
        tint?: string;
        interactive?: boolean;
        shape?: "capsule" | "circle" | { rounded: number };
      };
  /** `.backgroundExtensionEffect()` — bleed the background edge-to-edge behind chrome. */
  backgroundExtensionEffect?: BackgroundExtensionEffectProp;
  /** `.scrollEdgeEffectStyle(_:for:)` — soft/hard glass fade at a scroll edge. */
  scrollEdgeEffectStyle?: ScrollEdgeEffectStyleProp;
  /** `.scrollEdgeEffectHidden(_:for:)` — hide the scroll-edge fade on edges. */
  scrollEdgeEffectHidden?: ScrollEdgeEffectHiddenProp;

  // ---- CONTROL / ENV (Part G) ----
  controlSize?: ControlSize;
  labelsHidden?: boolean;
  imageScale?: "small" | "medium" | "large";
  symbolRenderingMode?: "monochrome" | "multicolor" | "hierarchical" | "palette";
  symbolVariant?: "none" | "circle" | "square" | "rectangle" | "fill" | "slash";
  /** `.symbolEffect(_:isActive:)` → a CSS keyframe-animation class (bounce/pulse/…). */
  symbolEffect?: SymbolEffectProp;
  /** `.symbolColorRenderingMode(_:)` → `data-symbol-color-mode` (flat | gradient). */
  symbolColorRenderingMode?: "flat" | "gradient";
  preferredColorScheme?: "light" | "dark";
}

/** The exact set of keys `applyModifiers` consumes — used to split out `rest`. */
const MODIFIER_KEYS = new Set<string>([
  // layout
  "frame", "padding", "position", "offset", "fixedSize", "layoutPriority",
  "zIndex", "clipped", "clipShape", "cornerRadius", "aspectRatio",
  "scaledToFit", "scaledToFill", "containerRelativeFrame", "alignmentGuide",
  // safe area
  "ignoresSafeArea", "safeAreaPadding", "scenePadding",
  // fill/stroke
  "foregroundStyle", "foregroundColor", "background", "backgroundStyle",
  "tint", "border", "shadow",
  // layers (overlay/background-view/mask) — consumed by <View>, never a DOM attr
  "overlayContent", "overlayAlignment", "backgroundContent", "backgroundAlignment",
  "mask",
  // text
  "font", "fontWeight", "fontDesign", "bold", "italic", "underline",
  "strikethrough", "kerning", "tracking", "baselineOffset", "lineLimit",
  "lineSpacing", "lineHeight", "multilineTextAlignment", "minimumScaleFactor",
  "truncationMode", "allowsTightening", "textCase", "monospaced",
  "monospacedDigit", "textScale", "fontWidth", "textSelection",
  "flipsForRightToLeftLayoutDirection",
  // state
  "opacity", "hidden", "disabled", "redacted", "unredacted", "privacySensitive",
  "help", "contentTransition", "badgeProminence", "headerProminence",
  "accessibilityLabel", "accessibilityHint", "accessibilityValue", "accessibilityHidden",
  "accessibilityIdentifier", "accessibilityRole", "accessibilitySortPriority",
  "allowsHitTesting", "contentShape",
  // transform
  "rotationEffect", "scaleEffect", "rotation3DEffect", "transformEffect",
  "projectionEffect", "visualEffect",
  "blur", "brightness", "contrast", "saturation", "grayscale", "hueRotation",
  "colorInvert", "blendMode", "compositingGroup", "drawingGroup", "geometryGroup",
  // iOS-26 liquid-glass chrome
  "glassEffect", "backgroundExtensionEffect",
  "scrollEdgeEffectStyle", "scrollEdgeEffectHidden",
  // control/env
  "controlSize", "labelsHidden", "imageScale", "symbolRenderingMode",
  "symbolVariant", "symbolEffect", "symbolColorRenderingMode",
  "preferredColorScheme",
]);

/* =============================================================================
 * Color resolution
 *
 * The `ColorToken` type uses SwiftUI-shaped names (`secondaryLabel`, `red`,
 * `gray2`, `systemBackground`). The CSS vars are kebab-case with `system-`
 * prefixes. This table maps every known token → its `--sui-color-*` var.
 * Unknown strings are treated as raw CSS colors and passed through.
 * ========================================================================== */

const SYSTEM_PALETTE = new Set([
  "red", "orange", "yellow", "green", "mint", "teal", "cyan",
  "blue", "indigo", "purple", "pink", "brown",
  "gray", "gray2", "gray3", "gray4", "gray5", "gray6",
]);

const COLOR_TOKEN_TO_VAR: Record<string, string> = {
  // foregroundStyle hierarchy (.primary/.secondary/.tertiary/.quaternary)
  primary: "--sui-color-label",
  secondary: "--sui-color-secondary-label",
  tertiary: "--sui-color-tertiary-label",
  quaternary: "--sui-color-quaternary-label",
  // label hierarchy
  label: "--sui-color-label",
  secondaryLabel: "--sui-color-secondary-label",
  tertiaryLabel: "--sui-color-tertiary-label",
  quaternaryLabel: "--sui-color-quaternary-label",
  placeholderText: "--sui-color-placeholder-text",
  // separators & link
  separator: "--sui-color-separator",
  opaqueSeparator: "--sui-color-opaque-separator",
  link: "--sui-color-link",
  // backgrounds — base family
  systemBackground: "--sui-color-system-background",
  secondarySystemBackground: "--sui-color-secondary-system-background",
  tertiarySystemBackground: "--sui-color-tertiary-system-background",
  // backgrounds — grouped family
  systemGroupedBackground: "--sui-color-system-grouped-background",
  secondarySystemGroupedBackground: "--sui-color-secondary-system-grouped-background",
  tertiarySystemGroupedBackground: "--sui-color-tertiary-system-grouped-background",
  // fills
  fill: "--sui-color-system-fill",
  secondaryFill: "--sui-color-secondary-system-fill",
  tertiaryFill: "--sui-color-tertiary-system-fill",
  quaternaryFill: "--sui-color-quaternary-system-fill",
  // tint / accent
  tint: "--sui-color-tint",
  accentColor: "--sui-color-tint",
  // fixed colors
  white: "--sui-color-fixed-white",
  black: "--sui-color-fixed-black",
  clear: "--sui-color-fixed-clear",
};

/**
 * Token → CSS color. Known `ColorToken` → `var(--sui-color-…)`; anything else
 * (hex, rgb(), named CSS color, an already-`var(...)` ref) passes through raw.
 */
export function resolveColor(token: ColorToken | string): string {
  if (typeof token !== "string") return String(token);
  // already a CSS function / var / custom-property ref → pass through
  if (token.startsWith("var(") || token.startsWith("--") || token.includes("(")) {
    return token;
  }
  const direct = COLOR_TOKEN_TO_VAR[token];
  if (direct) return `var(${direct})`;
  // system palette short names → --sui-color-system-<name>
  if (SYSTEM_PALETTE.has(token)) return `var(--sui-color-system-${token})`;
  // raw CSS color (#hex, "rebeccapurple", "transparent", …)
  return token;
}

/* =============================================================================
 * Text-style resolution
 * ========================================================================== */

/**
 * `.font(.body)` → the 4-var bundle (size/weight/lineHeight/tracking). The text
 * style keys are camelCase in the CSS layer (`--sui-text-body-size`,
 * `--sui-text-largeTitle-lineHeight`), so the key passes straight through.
 */
export function resolveTextStyle(style: FontTextStyle): React.CSSProperties {
  return {
    fontSize: `var(--sui-text-${style}-size)`,
    fontWeight: `var(--sui-text-${style}-weight)` as unknown as React.CSSProperties["fontWeight"],
    lineHeight: `var(--sui-text-${style}-lineHeight)`,
    letterSpacing: `var(--sui-text-${style}-tracking)`,
  };
}

/* =============================================================================
 * Small helpers
 * ========================================================================== */

const px = (n: number | string): string => (typeof n === "number" ? `${n}px` : n);

/** SwiftUI 9-point Alignment → [align-items (vertical), justify-content (horizontal)]. */
export function alignToFlex(a: Alignment): [string, string] {
  const v = { top: "flex-start", center: "center", bottom: "flex-end" } as const;
  const h = { leading: "flex-start", center: "center", trailing: "flex-end" } as const;
  const map: Record<Alignment, [string, string]> = {
    topLeading: [v.top, h.leading], top: [v.top, h.center], topTrailing: [v.top, h.trailing],
    leading: [v.center, h.leading], center: [v.center, h.center], trailing: [v.center, h.trailing],
    bottomLeading: [v.bottom, h.leading], bottom: [v.bottom, h.center], bottomTrailing: [v.bottom, h.trailing],
  };
  return map[a];
}

/** UnitPoint → CSS transform-origin `"x% y%"`. */
function originToCSS(anchor: UnitPoint | undefined): string | undefined {
  if (anchor === undefined) return undefined;
  if (typeof anchor === "object") return `${anchor.x * 100}% ${anchor.y * 100}%`;
  const table: Record<Exclude<UnitPoint, object>, [number, number]> = {
    center: [0.5, 0.5],
    top: [0.5, 0], bottom: [0.5, 1], leading: [0, 0.5], trailing: [1, 0.5],
    topLeading: [0, 0], topTrailing: [1, 0],
    bottomLeading: [0, 1], bottomTrailing: [1, 1],
  };
  const [x, y] = table[anchor];
  return `${x * 100}% ${y * 100}%`;
}

const LINE_PATTERN_TO_CSS: Record<LinePattern, string> = {
  solid: "solid",
  dot: "dotted",
  dash: "dashed",
  dashDot: "dashed",
  dashDotDot: "dashed",
};

/* =============================================================================
 * applyModifiers — the compiler
 * ========================================================================== */

export interface AppliedModifiers {
  style: React.CSSProperties;
  className: string;
  /** Non-modifier props to spread onto the DOM node. */
  rest: Record<string, any>;
}

export function applyModifiers(
  props: ViewModifierProps & Record<string, any>,
): AppliedModifiers {
  const m = props as ViewModifierProps;
  const style: React.CSSProperties = {};
  const cls: string[] = [];
  const rest: Record<string, any> = {};
  const transforms: string[] = [];
  const filters: string[] = [];

  // split modifier props from the rest (pass-through DOM props)
  for (const key in props) {
    if (!MODIFIER_KEYS.has(key)) rest[key] = props[key];
  }

  // ---- LAYOUT (Part B) ------------------------------------------------------
  if (m.frame) {
    const f = m.frame;
    if (f.width != null) style.width = f.width === "infinity" ? "100%" : px(f.width);
    if (f.height != null) style.height = f.height === "infinity" ? "100%" : px(f.height);
    if (f.minWidth != null) style.minWidth = px(f.minWidth);
    if (f.maxWidth != null) style.maxWidth = f.maxWidth === "infinity" ? "100%" : px(f.maxWidth);
    if (f.minHeight != null) style.minHeight = px(f.minHeight);
    if (f.maxHeight != null) style.maxHeight = f.maxHeight === "infinity" ? "100%" : px(f.maxHeight);
    // idealWidth/idealHeight = preferred size; only authoritative when no proposal,
    // which for the web is "auto" — emit as width/height when no explicit dim set.
    if (f.idealWidth != null && f.width == null) style.width = px(f.idealWidth);
    if (f.idealHeight != null && f.height == null) style.height = px(f.idealHeight);
    if (f.alignment) {
      style.display = "flex";
      const [ai, jc] = alignToFlex(f.alignment);
      style.alignItems = ai;
      style.justifyContent = jc;
    }
  }

  if (m.padding !== undefined) Object.assign(style, paddingToCSS(m.padding));

  if (m.position) {
    style.position = "absolute";
    style.left = px(m.position.x);
    style.top = px(m.position.y);
    transforms.push("translate(-50%, -50%)");
  }

  if (m.offset) {
    transforms.push(`translate(${m.offset.x ?? 0}px, ${m.offset.y ?? 0}px)`);
  }

  if (m.fixedSize) {
    // `true` (bare) = both axes; object form fixes only the axes set to `true`.
    const fs = m.fixedSize;
    const horizontal = fs === true || fs.horizontal === true;
    const vertical = fs === true || fs.vertical === true;
    if (horizontal) {
      style.width = "max-content";
      style.whiteSpace = "nowrap";
    }
    if (vertical) style.height = "max-content";
  }

  if (m.layoutPriority != null) {
    style.flexShrink = m.layoutPriority > 0 ? 0 : 1;
    style.flexGrow = Math.max(0, m.layoutPriority);
  }

  if (m.zIndex != null) style.zIndex = Math.round(m.zIndex);
  if (m.clipped) style.overflow = "hidden";
  if (m.clipShape) Object.assign(style, clipShapeToCSS(m.clipShape));
  if (m.cornerRadius != null) {
    style.borderRadius = px(m.cornerRadius);
    style.overflow = "hidden";
  }

  // aspectRatio + scaledToFit/scaledToFill
  if (m.aspectRatio) {
    if (m.aspectRatio.ratio != null) style.aspectRatio = String(m.aspectRatio.ratio);
    const mode = m.aspectRatio.contentMode;
    if (mode === "fit") style.objectFit = "contain";
    else if (mode === "fill") style.objectFit = "cover";
  }
  if (m.scaledToFit) {
    style.objectFit = "contain";
    style.width = "100%";
    style.height = "100%";
  }
  if (m.scaledToFill) {
    style.objectFit = "cover";
    style.width = "100%";
    style.height = "100%";
  }

  // containerRelativeFrame → % of the nearest container (the grid form solves a
  // single column-span width via calc against the spacing). `both` sizes both axes.
  if (m.containerRelativeFrame) {
    const c = m.containerRelativeFrame;
    const dim = columnSpanCSS(c);
    if (c.axes === "horizontal" || c.axes === "both") style.width = dim;
    if (c.axes === "vertical" || c.axes === "both") style.height = dim;
    if (c.alignment) {
      style.display = "flex";
      const [ai, jc] = alignToFlex(c.alignment);
      style.alignItems = ai;
      style.justifyContent = jc;
    }
  }

  // alignmentGuide → best-effort static nudge (a translate); a closure-driven
  // guide has no CSS analog, so only the constant offset case is honoured.
  if (m.alignmentGuide) {
    const dx = m.alignmentGuide.horizontal ?? 0;
    const dy = m.alignmentGuide.vertical ?? 0;
    if (dx !== 0 || dy !== 0) transforms.push(`translate(${px(dx)}, ${px(dy)})`);
  }

  // ---- SAFE AREA -----------------------------------------------------------
  // ignoresSafeArea → negative margins pulling the edge out under the inset.
  if (m.ignoresSafeArea) Object.assign(style, ignoresSafeAreaToCSS(m.ignoresSafeArea));
  // safeAreaPadding → padding driven by env(safe-area-inset-*) (+ any extra).
  if (m.safeAreaPadding !== undefined) {
    Object.assign(style, safeAreaPaddingToCSS(m.safeAreaPadding));
  }
  // scenePadding → the standard scene/reading-width padding token.
  if (m.scenePadding) Object.assign(style, scenePaddingToCSS(m.scenePadding));

  // ---- FILL / STROKE (Part C) ----------------------------------------------
  if (m.foregroundStyle != null) style.color = resolveColor(m.foregroundStyle);
  if (m.foregroundColor != null) style.color = resolveColor(m.foregroundColor);
  if (m.background != null) style.backgroundColor = resolveColor(m.background);
  if (m.backgroundStyle != null) {
    setVar(style, "--sui-current-background", resolveColor(m.backgroundStyle));
  }
  if (m.tint != null) setVar(style, "--sui-color-tint", resolveColor(m.tint));
  if (m.border) {
    const width = m.border.width ?? 1; // KNOWN: default border width = 1
    style.border = `${px(width)} solid ${resolveColor(m.border.color)}`;
    style.boxSizing = "border-box";
  }
  if (m.shadow) style.boxShadow = shadowToCSS(m.shadow);

  // ---- LAYERS / MASK (Part B.9 / C.2 / C.6) --------------------------------
  // The STRING / {image} mask forms compile to a pure CSS mask-image here (no
  // extra DOM). The ReactNode forms (mask.content, overlayContent,
  // backgroundContent) are rendered as positioned layers by <View>, which also
  // sets `position: relative` to anchor them — see View.tsx.
  if (m.mask != null) {
    const mk = m.mask;
    if (typeof mk === "string") {
      Object.assign(style, maskToCSS(mk));
    } else if ("image" in mk) {
      Object.assign(style, maskToCSS(mk));
    }
    // the `{ content }` ReactNode form is rendered/rasterized by <View>.
  }

  // ---- TEXT (Part D) --------------------------------------------------------
  if (m.font) Object.assign(style, fontToCSS(m.font));
  if (m.fontWeight) {
    style.fontWeight = `var(--sui-weight-${m.fontWeight})` as unknown as React.CSSProperties["fontWeight"];
  }
  if (m.fontDesign) style.fontFamily = `var(--sui-font-${m.fontDesign})`;
  // bold/italic — bold(true)→700, applied after fontWeight so it wins (matches Text overload order)
  if (m.bold === true) style.fontWeight = 700;
  else if (m.bold === false) style.fontWeight = 400;
  if (m.italic === true) style.fontStyle = "italic";
  else if (m.italic === false) style.fontStyle = "normal";

  const decoration = decorationToCSS(m.underline, m.strikethrough);
  if (decoration) Object.assign(style, decoration);

  if (m.kerning != null) {
    style.letterSpacing = px(m.kerning);
    style.fontKerning = "normal";
  }
  if (m.tracking != null) {
    style.letterSpacing = px(m.tracking);
    style.fontVariantLigatures = "none";
  }
  if (m.baselineOffset != null) style.verticalAlign = px(m.baselineOffset);
  if (m.lineLimit !== undefined) Object.assign(style, lineLimitToCSS(m.lineLimit));
  if (m.lineSpacing != null) {
    // added to the natural leading; default leading from body unless a font sets it
    style.lineHeight = `calc(var(--sui-text-body-lineHeight) + ${px(m.lineSpacing)})`;
  }
  if (m.lineHeight != null) style.lineHeight = px(m.lineHeight);
  if (m.multilineTextAlignment) {
    style.textAlign = { leading: "start", center: "center", trailing: "end" }[
      m.multilineTextAlignment
    ] as React.CSSProperties["textAlign"];
  }
  if (m.minimumScaleFactor != null) {
    setVar(style, "--sui-min-scale-factor", String(m.minimumScaleFactor));
  }
  if (m.truncationMode === "tail") style.textOverflow = "ellipsis";
  if (m.allowsTightening) style.letterSpacing = "-0.02em";
  if (m.textCase != null) style.textTransform = m.textCase;
  else if (m.textCase === null) style.textTransform = "none";
  if (m.monospaced) style.fontFamily = "var(--sui-font-monospaced)";
  if (m.monospacedDigit) {
    style.fontVariantNumeric = "tabular-nums";
    style.fontFeatureSettings = '"tnum"';
  }
  if (m.textScale === "secondary") style.fontSize = "0.8em";
  if (m.fontWidth) style.fontStretch = FONT_WIDTH_TO_STRETCH[m.fontWidth];
  if (m.textSelection) {
    style.userSelect = m.textSelection === "enabled" ? "text" : "none";
    (style as Record<string, string>).WebkitUserSelect =
      m.textSelection === "enabled" ? "text" : "none";
  }
  if (m.flipsForRightToLeftLayoutDirection) {
    // mirror the view only in an RTL context; LTR is untouched. The :dir()
    // selector can't be inline, so we flag it for the consumer's CSS via a
    // data-attr AND apply the cheap unconditional default of a CSS var hook.
    rest["data-flips-rtl"] = "true";
  }

  // ---- STATE / VISIBILITY (Part E) -----------------------------------------
  if (m.opacity != null) style.opacity = m.opacity;
  if (m.hidden) style.visibility = "hidden";
  if (m.disabled) {
    rest["data-disabled"] = "true";
    style.pointerEvents = "none";
    const base = typeof style.opacity === "number" ? style.opacity : 1;
    style.opacity = base * 0.35; // iOS dimmed-control look (DESIGNED; calibrate)
    style.cursor = "default";
  }
  // `.unredacted()` wins over `.redacted(...)` — emit no redaction class when set.
  if (m.redacted && !m.unredacted) cls.push(`sui-redacted--${m.redacted}`);
  // `.privacySensitive()` — blur/obscure on capture (independent of redaction).
  if (m.privacySensitive && !m.unredacted) cls.push("sui-privacy-sensitive");
  // `.help(_:)` — native tooltip via the `title` attribute (pass-through to DOM).
  if (m.help != null) rest["title"] = m.help;
  // `.contentTransition(_:)` — smooth value-change transitions (class-driven).
  if (m.contentTransition) {
    cls.push("sui-content-transition");
    if (m.contentTransition !== "opacity" && m.contentTransition !== "interpolate") {
      cls.push(`sui-content-transition--${m.contentTransition}`);
    }
  }
  // badge/header prominence — data-attrs read by badge/section-header CSS.
  if (m.badgeProminence) rest["data-badge-prominence"] = m.badgeProminence;
  if (m.headerProminence) rest["data-header-prominence"] = m.headerProminence;
  // accessibility (.accessibility* → ARIA)
  if (m.accessibilityLabel != null) rest["aria-label"] = m.accessibilityLabel;
  if (m.accessibilityHint != null) rest["aria-description"] = m.accessibilityHint;
  if (m.accessibilityValue != null) rest["aria-valuetext"] = m.accessibilityValue;
  if (m.accessibilityHidden != null) rest["aria-hidden"] = m.accessibilityHidden;
  if (m.accessibilityIdentifier != null) rest["data-testid"] = m.accessibilityIdentifier;
  if (m.accessibilityRole != null) rest["role"] = m.accessibilityRole;
  if (m.accessibilitySortPriority != null) rest["tabIndex"] = m.accessibilitySortPriority;
  if (m.allowsHitTesting === false) style.pointerEvents = "none";
  if (m.contentShape === "circle") style.clipPath = "circle(50%)";

  // ---- TRANSFORM / FILTERS (Part F) ----------------------------------------
  // transform order: offset → scale → rotate → 3D → matrix (offset already pushed)
  if (m.scaleEffect != null) {
    const s = scaleToCSS(m.scaleEffect);
    transforms.push(s.transform);
    if (s.origin) style.transformOrigin = s.origin;
  }
  if (m.rotationEffect != null) {
    const deg = typeof m.rotationEffect === "number" ? m.rotationEffect : m.rotationEffect.degrees;
    const anchor = typeof m.rotationEffect === "number" ? undefined : m.rotationEffect.anchor;
    transforms.push(`rotate(${deg}deg)`);
    const origin = originToCSS(anchor);
    if (origin) style.transformOrigin = origin;
  }
  if (m.rotation3DEffect) {
    const r = m.rotation3DEffect;
    transforms.unshift(`perspective(${1000 / (r.perspective ?? 1)}px)`);
    transforms.push(`rotate3d(${r.axis.join(", ")}, ${r.degrees}deg)`);
    const origin = originToCSS(r.anchor);
    if (origin) style.transformOrigin = origin;
  }
  if (m.transformEffect) transforms.push(`matrix(${m.transformEffect.join(", ")})`);
  // projectionEffect → 3×3 ProjectionTransform → CSS matrix3d. Map the 3×3
  // homogeneous matrix [a,b,c, d,e,f, g,h,i] (row-major, last row = projection)
  // into the 4×4 column-major matrix3d, with z held identity.
  if (m.projectionEffect) transforms.push(projectionToCSS(m.projectionEffect));

  if (m.blur != null) filters.push(`blur(${px(m.blur)})`);
  if (m.brightness != null) filters.push(`brightness(${1 + m.brightness})`); // SwiftUI offset → CSS multiplier
  if (m.contrast != null) filters.push(`contrast(${m.contrast})`);
  if (m.saturation != null) filters.push(`saturate(${m.saturation})`);
  if (m.grayscale != null) filters.push(`grayscale(${m.grayscale})`);
  if (m.hueRotation != null) filters.push(`hue-rotate(${m.hueRotation}deg)`);
  if (m.colorInvert) filters.push("invert(1)");
  if (m.blendMode) style.mixBlendMode = m.blendMode;
  if (m.compositingGroup) style.isolation = "isolate";
  if (m.drawingGroup) {
    style.willChange = "transform";
    transforms.push("translateZ(0)");
  }
  if (m.geometryGroup) style.contain = "layout paint";

  // ---- iOS-26 LIQUID-GLASS CHROME ------------------------------------------
  // glassEffect — the prop alias for <GlassEffect>. Emits the same `sui-glass*`
  // classes + tint var that effects.ts's glassClass/glassStyle produce, so a
  // plain <View glassEffect> renders the iOS-26 glass surface with no wrapper.
  if (m.glassEffect) {
    Object.assign(style, glassEffectToCSS(m.glassEffect, cls));
  }
  // backgroundExtensionEffect — bleed the background edge-to-edge under chrome.
  if (m.backgroundExtensionEffect) {
    const enabled =
      m.backgroundExtensionEffect === true ||
      (typeof m.backgroundExtensionEffect === "object" &&
        m.backgroundExtensionEffect.isEnabled !== false);
    if (enabled) {
      cls.push("sui-bg-extension");
      // pull the view OUT under every safe-area inset so its background extends
      // edge-to-edge behind a floating bar (content keeps its own padding via
      // the bar's own safeAreaPadding). Negative margins == ignoresSafeArea(.all).
      Object.assign(style, ignoresSafeAreaToCSS(true));
      rest["data-bg-extension"] = "true";
    }
  }
  // scrollEdgeEffectStyle — soft/hard glass fade at the scroll edges. We don't
  // own the overlay-strip CSS (the bar agent renders `.sui-scroll-edge-*` strips);
  // here we publish the RESOLVED style + edges as data-attrs + CSS vars so a
  // scroll container (or the bar agent) can place the fade. `null` clears it.
  if (m.scrollEdgeEffectStyle !== undefined) {
    Object.assign(style, scrollEdgeStyleToCSS(m.scrollEdgeEffectStyle, rest));
  }
  // scrollEdgeEffectHidden — suppress the fade on chosen edges.
  if (m.scrollEdgeEffectHidden !== undefined) {
    const hidden =
      m.scrollEdgeEffectHidden === true ||
      (typeof m.scrollEdgeEffectHidden === "object" &&
        m.scrollEdgeEffectHidden.hidden !== false);
    const edges =
      typeof m.scrollEdgeEffectHidden === "object"
        ? edgesOf(m.scrollEdgeEffectHidden.edges)
        : edgesOf("all");
    if (hidden) rest["data-scroll-edge-hidden"] = edges.join(" ");
  }

  // ---- CONTROL / ENV (Part G) ----------------------------------------------
  if (m.controlSize) rest["data-control-size"] = m.controlSize;
  if (m.labelsHidden) cls.push("sui-labels-hidden");
  if (m.imageScale) {
    setVar(style, "--sui-symbol-scale", String({ small: 0.85, medium: 1, large: 1.2 }[m.imageScale]));
  }
  if (m.symbolRenderingMode) rest["data-symbol-mode"] = m.symbolRenderingMode;
  if (m.symbolVariant) rest["data-symbol-variant"] = m.symbolVariant;
  if (m.symbolColorRenderingMode) {
    rest["data-symbol-color-mode"] = m.symbolColorRenderingMode;
  }
  if (m.symbolEffect) {
    const eff = typeof m.symbolEffect === "string" ? m.symbolEffect : m.symbolEffect.effect;
    const active = typeof m.symbolEffect === "string" ? true : m.symbolEffect.isActive !== false;
    cls.push("sui-symbol-effect");
    cls.push(active ? `sui-symbol-effect--${eff}` : "sui-symbol-effect--inactive");
  }
  if (m.preferredColorScheme) cls.push(m.preferredColorScheme);

  // visualEffect — merge a caller-supplied style/class LAST so it composes over
  // the compiled modifiers (mirrors `.visualEffect` running after layout).
  if (m.visualEffect) {
    if (typeof m.visualEffect === "string") {
      cls.push(m.visualEffect);
    } else if ("style" in m.visualEffect || "className" in m.visualEffect) {
      if (m.visualEffect.style) Object.assign(style, m.visualEffect.style);
      if (m.visualEffect.className) cls.push(m.visualEffect.className);
    } else {
      Object.assign(style, m.visualEffect);
    }
  }

  if (transforms.length) style.transform = transforms.join(" ");
  if (filters.length) style.filter = filters.join(" ");

  return { style, className: cls.join(" "), rest };
}

/* =============================================================================
 * Per-modifier compilers
 * ========================================================================== */

/** Writes a CSS custom property onto a CSSProperties object (TS-safe escape hatch). */
function setVar(style: React.CSSProperties, name: string, value: string): void {
  (style as Record<string, string>)[name] = value;
}

/** padding → logical CSS props (RTL-safe). `true`/empty → system default 16px var. */
export function paddingToCSS(p: PaddingProp): React.CSSProperties {
  const out: React.CSSProperties = {};
  if (p === false) return out; // explicit `padding={false}` → no-op
  if (p === true) {
    out.padding = "var(--sui-space-padding-default, 16px)";
    return out;
  }
  if (typeof p === "number") {
    out.padding = px(p);
    return out;
  }
  // per-edge object — leading/trailing compile to inline-start/end for RTL
  if (p.all != null) out.padding = px(p.all);
  if (p.horizontal != null) out.paddingInline = px(p.horizontal);
  if (p.vertical != null) out.paddingBlock = px(p.vertical);
  if (p.top != null) out.paddingTop = px(p.top);
  if (p.bottom != null) out.paddingBottom = px(p.bottom);
  if (p.leading != null) out.paddingInlineStart = px(p.leading);
  if (p.trailing != null) out.paddingInlineEnd = px(p.trailing);
  return out;
}

/** clipShape → border-radius/clip-path + overflow:hidden. */
export function clipShapeToCSS(shape: ClipShape): React.CSSProperties {
  if (shape === "circle") return { borderRadius: "50%", overflow: "hidden" };
  if (shape === "capsule") return { borderRadius: "9999px", overflow: "hidden" };
  return { borderRadius: px(shape.rounded), overflow: "hidden" };
}

/**
 * glassEffect (prop alias) → the `sui-glass*` classes + tint/shape inline style.
 *
 * Mirrors effects.ts `glassClass()` / `glassStyle()` / `glassEffectProps()` WITHOUT
 * importing them (modifiers.ts has no runtime dep on effects.ts — it only emits the
 * stable class strings the `effects.global.css` cascade styles). Pushes the glass
 * classes onto `cls` and returns the inline shape + tint-var style.
 */
export function glassEffectToCSS(
  g: NonNullable<ViewModifierProps["glassEffect"]>,
  cls: string[],
): React.CSSProperties {
  const cfg = typeof g === "object" ? g : {};
  const variant = cfg.variant ?? "regular";
  cls.push("sui-glass");
  if (variant === "clear") cls.push("sui-glass-clear");
  if (variant === "identity") cls.push("sui-glass-identity");
  if (cfg.tint) cls.push("sui-glass-tinted");
  if (cfg.interactive) cls.push("sui-glass-interactive");

  const out: React.CSSProperties = {};
  // clip shape (default capsule = DefaultGlassEffectShape)
  const shape = cfg.shape ?? "capsule";
  if (shape === "capsule") out.borderRadius = 9999;
  else if (shape === "circle") {
    out.borderRadius = "50%";
    out.aspectRatio = "1 / 1";
  } else out.borderRadius = px(shape.rounded);
  if (cfg.tint) setVar(out, "--sui-glass-tint-color", resolveColor(cfg.tint));
  return out;
}

/**
 * scrollEdgeEffectStyle (`.scrollEdgeEffectStyle(_:for:)`) → resolved style +
 * edges published as data-attrs / CSS vars on the scroll container.
 *
 * We don't render the fade strip here (the bar agent owns `.sui-scroll-edge-*`
 * overlay strips); instead we expose `data-scroll-edge-style` (resolved soft/hard)
 * and `data-scroll-edge-edges`, plus a `--sui-scroll-edge-style` var, so a scroll
 * container's own edge layer (or the bar agent's overlay) can read which fade to
 * draw on which edges. `.automatic` resolves to `soft` (the iOS-26 default);
 * `null` clears the effect.
 */
export function scrollEdgeStyleToCSS(
  p: ScrollEdgeEffectStyleProp,
  rest: Record<string, any>,
): React.CSSProperties {
  const out: React.CSSProperties = {};
  const rawStyle = typeof p === "object" && p !== null ? p.style : p;
  if (rawStyle == null) {
    // null → clear: mark it off so any reader removes its fade.
    rest["data-scroll-edge-style"] = "none";
    return out;
  }
  // .automatic → soft (the iOS-26 default edge fade).
  const resolved = rawStyle === "automatic" ? "soft" : rawStyle;
  const edges =
    typeof p === "object" && p !== null ? edgesOf(p.edges) : edgesOf("all");
  rest["data-scroll-edge-style"] = resolved;
  rest["data-scroll-edge-edges"] = edges.join(" ");
  setVar(out, "--sui-scroll-edge-style", resolved);
  return out;
}

/**
 * shadow → box-shadow. `true` → token card shadow; object → `{dx}px {dy}px {2r}px 0 {color}`.
 * The radius→blur rule: CSS blur ≈ 2× SwiftUI radius (spread always 0). Default color
 * is the token shadow color rgba(0,0,0,0.33).
 */
export function shadowToCSS(s: boolean | ShadowProps): string {
  if (s === false) return "none"; // explicit `shadow={false}` → no shadow
  if (s === true) return "var(--sui-shadow-card)";
  const x = s.x ?? 0;
  const y = s.y ?? 0;
  const blur = s.radius * 2;
  const color = s.color != null ? resolveColor(s.color) : "var(--sui-shadow-default-color, rgba(0,0,0,0.33))";
  return `${px(x)} ${px(y)} ${px(blur)} 0 ${color}`;
}

/** font → the text-style bundle, or a system font (size/weight/design). */
export function fontToCSS(font: FontProp): React.CSSProperties {
  if (typeof font === "string") return resolveTextStyle(font);
  const out: React.CSSProperties = { fontSize: px(font.size) };
  if (font.weight) {
    out.fontWeight = `var(--sui-weight-${font.weight})` as unknown as React.CSSProperties["fontWeight"];
  }
  if (font.design) out.fontFamily = `var(--sui-font-${font.design})`;
  return out;
}

/** underline/strikethrough → text-decoration shorthand or line list. */
export function decorationToCSS(
  underline: ViewModifierProps["underline"],
  strikethrough: ViewModifierProps["strikethrough"],
): React.CSSProperties | undefined {
  const u = underline === true || (typeof underline === "object" && underline != null);
  const st = strikethrough === true || (typeof strikethrough === "object" && strikethrough != null);
  if (!u && !st) return undefined;

  const lines: string[] = [];
  if (u) lines.push("underline");
  if (st) lines.push("line-through");

  // a single styled decoration (one of the two) can carry pattern + color
  const styled =
    typeof underline === "object" && underline != null
      ? underline
      : typeof strikethrough === "object" && strikethrough != null
        ? strikethrough
        : undefined;

  const out: React.CSSProperties = { textDecorationLine: lines.join(" ") };
  if (styled?.pattern) out.textDecorationStyle = LINE_PATTERN_TO_CSS[styled.pattern] as React.CSSProperties["textDecorationStyle"];
  if (styled?.color != null) out.textDecorationColor = resolveColor(styled.color);
  return out;
}

/** lineLimit → clamp/nowrap. `1`→ellipsis nowrap, `n>1`→-webkit-line-clamp, `null`→unlimited. */
export function lineLimitToCSS(limit: number | null): React.CSSProperties {
  if (limit === null) {
    return {
      whiteSpace: "normal",
      ["-webkit-line-clamp" as any]: "none",
    } as React.CSSProperties;
  }
  if (limit === 1) {
    return {
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    };
  }
  return {
    display: "-webkit-box",
    ["-webkit-line-clamp" as any]: String(limit),
    ["-webkit-box-orient" as any]: "vertical",
    overflow: "hidden",
  } as React.CSSProperties;
}

/** scaleEffect → `scale(...)` + transform-origin. number→uniform, {x,y}→per-axis. */
export function scaleToCSS(s: ScaleEffectProp): { transform: string; origin?: string } {
  if (typeof s === "number") {
    return { transform: `scale(${s})` };
  }
  const x = s.x ?? 1;
  const y = s.y ?? 1;
  return { transform: `scale(${x}, ${y})`, origin: originToCSS(s.anchor) };
}

/**
 * mask (string / {image} form) → `mask-image` + `-webkit-mask-image` (C10 §B.9).
 *
 * SwiftUI's mask uses the mask view's ALPHA, and for gradients also its
 * LUMINANCE, to cut the content out. The CSS analog:
 *   - alpha mask (default for shapes/PNGs): `mask-mode: alpha` — the mask
 *     image's own alpha channel drives visibility (opaque→show, clear→hide).
 *   - luminance mask (gradients/grayscale): `mask-mode: luminance` — bright
 *     pixels show, black pixels hide; this matches SwiftUI's gradient-fade
 *     behaviour (`mask: LinearGradient(.white → .clear)`).
 * We always pin the mask to the box (`no-repeat; center / 100% 100%`) so a
 * `linear-gradient(...)` edge-fade spans the whole element. `-webkit-mask-*` is
 * emitted alongside the standard props for Safari/Chrome coverage.
 */
export function maskToCSS(
  mask: string | { image: string; mode?: "alpha" | "luminance" },
): React.CSSProperties {
  const image = typeof mask === "string" ? mask : mask.image;
  // gradients are luminance masks by default in SwiftUI; shapes/images are alpha.
  const mode =
    typeof mask === "string"
      ? mask.includes("gradient(")
        ? "luminance"
        : "alpha"
      : (mask.mode ?? (image.includes("gradient(") ? "luminance" : "alpha"));
  const out: React.CSSProperties = {};
  const set = (k: string, v: string) => ((out as Record<string, string>)[k] = v);
  for (const prefix of ["mask", "-webkit-mask"]) {
    set(`${prefix}-image`, image);
    set(`${prefix}-repeat`, "no-repeat");
    set(`${prefix}-position`, "center");
    set(`${prefix}-size`, "100% 100%");
    // -webkit- doesn't honour mask-mode; for alpha that's already the webkit
    // default, and luminance gradients still read fine via -webkit-mask-image.
    if (prefix === "mask") set("mask-mode", mode);
  }
  return out;
}

/* =============================================================================
 * fontWidth — Font.Width → CSS font-stretch percentage axis
 *
 * SwiftUI's four named widths map onto the CSS `font-stretch` percentage
 * keywords (condensed < 100% normal < expanded). KNOWN cases from the
 * swiftinterface (`compressed`/`condensed`/`standard`/`expanded`); `compressed`
 * is the tightest, so it gets the smallest stretch (≈ "ultra-condensed").
 * ========================================================================== */
const FONT_WIDTH_TO_STRETCH: Record<FontWidth, string> = {
  compressed: "75%", // ultra-condensed
  condensed: "87.5%", // semi-condensed
  standard: "100%", // normal
  expanded: "125%", // expanded
};

/* =============================================================================
 * containerRelativeFrame — % / column-span sizing against the nearest container
 *
 * Simple form (no count) → `100%` of the container along the axis.
 * Grid form (`count` columns, `span` of them, `spacing` gap) → the width of one
 * span block. With `count` columns there are `count - 1` gaps of `spacing`, so a
 * single column is `(100% - (count-1)*spacing) / count`; a `span`-wide block is
 * `span` columns plus the `span - 1` inner gaps it absorbs:
 *   span/count * (100% - (count-1)*spacing) + (span-1)*spacing
 * ========================================================================== */
function columnSpanCSS(c: ContainerRelativeFrameProp): string {
  const count = c.count ?? 0;
  if (count <= 0) return "100%";
  const span = c.span ?? 1;
  const spacing = c.spacing ?? 0;
  // total spacing removed from the container before dividing into columns
  const totalGap = `${count - 1} * ${spacing}px`;
  const innerGap = `${span - 1} * ${spacing}px`;
  return `calc(${span} / ${count} * (100% - (${totalGap})) + (${innerGap}))`;
}

/* =============================================================================
 * Safe-area modifiers — env(safe-area-inset-*) plumbing
 * ========================================================================== */

/** Normalize an EdgeSet to the concrete edge list it selects. */
function edgesOf(set: EdgeSet | undefined): Edge[] {
  const ALL: Edge[] = ["top", "leading", "bottom", "trailing"];
  if (set === undefined || set === true || set === "all") return ALL;
  if (set === "horizontal") return ["leading", "trailing"];
  if (set === "vertical") return ["top", "bottom"];
  if (Array.isArray(set)) return set;
  return [set];
}

/**
 * The physical CSS side for a SwiftUI edge. Note `leading`/`trailing` are
 * LOGICAL in SwiftUI; `env(safe-area-inset-*)` only exposes physical left/right,
 * so for the safe-area family we map leading→left / trailing→right (the inset is
 * a device-physical quantity, not a writing-direction one).
 */
const EDGE_TO_PHYSICAL: Record<Edge, "top" | "bottom" | "left" | "right"> = {
  top: "top",
  bottom: "bottom",
  leading: "left",
  trailing: "right",
};

/**
 * ignoresSafeArea → pull the element OUT under the safe-area inset with a
 * negative margin equal to the inset on each selected edge. `keyboard` region is
 * a no-op on the web (no keyboard inset env var), so only the container/all
 * regions produce margins.
 */
export function ignoresSafeAreaToCSS(p: IgnoresSafeAreaProp): React.CSSProperties {
  const edges =
    p === true ? edgesOf("all") : edgesOf(typeof p === "object" ? p.edges : "all");
  const region = typeof p === "object" ? (p.regions ?? "all") : "all";
  const out: React.CSSProperties = {};
  if (region === "keyboard") return out; // no env() for the keyboard on the web
  for (const e of edges) {
    const side = EDGE_TO_PHYSICAL[e];
    const key = (`margin${side[0].toUpperCase()}${side.slice(1)}`) as keyof React.CSSProperties;
    (out as Record<string, string>)[key] = `calc(-1 * env(safe-area-inset-${side}, 0px))`;
  }
  return out;
}

/**
 * safeAreaPadding → padding equal to the safe-area inset on each edge, plus any
 * explicit extra length. `true` → inset only; a number → inset + that length on
 * all edges; an object → inset + the per-edge length.
 */
export function safeAreaPaddingToCSS(p: SafeAreaPaddingProp): React.CSSProperties {
  const out: React.CSSProperties = {};
  const pad = (side: "top" | "bottom" | "left" | "right", extra: number) => {
    const key = (`padding${side[0].toUpperCase()}${side.slice(1)}`) as keyof React.CSSProperties;
    (out as Record<string, string>)[key] = `calc(env(safe-area-inset-${side}, 0px) + ${extra}px)`;
  };
  if (typeof p === "boolean") {
    if (p) for (const e of edgesOf("all")) pad(EDGE_TO_PHYSICAL[e], 0);
    return out; // `false` → no-op
  }
  if (typeof p === "number") {
    for (const e of edgesOf("all")) pad(EDGE_TO_PHYSICAL[e], p);
    return out;
  }
  // per-edge object — resolve the convenience keys first, then explicit edges
  const all = p.all ?? 0;
  const h = p.horizontal;
  const v = p.vertical;
  const top = p.top ?? v ?? all;
  const bottom = p.bottom ?? v ?? all;
  const left = p.leading ?? h ?? all;
  const right = p.trailing ?? h ?? all;
  pad("top", top);
  pad("bottom", bottom);
  pad("left", left);
  pad("right", right);
  return out;
}

/**
 * scenePadding → the standard scene/reading-width padding token. `.minimum` uses
 * the system layout margin; `.navigationBar` aligns to the nav-bar content
 * inset. Both fall back to the default padding token when the var is unset.
 */
export function scenePaddingToCSS(p: ScenePaddingProp): React.CSSProperties {
  const obj = typeof p === "object" ? p : null;
  const variant =
    obj != null ? (obj.padding ?? "minimum") : typeof p === "string" ? p : "minimum";
  const edges = obj != null ? edgesOf(obj.edges) : edgesOf("all");
  const token =
    variant === "navigationBar"
      ? "var(--sui-scene-padding-navbar, var(--sui-space-padding-default, 16px))"
      : "var(--sui-scene-padding-minimum, var(--sui-space-padding-default, 16px))";
  const out: React.CSSProperties = {};
  for (const e of edges) {
    const side = EDGE_TO_PHYSICAL[e];
    const key =
      e === "leading" || e === "trailing"
        ? ((`padding${e === "leading" ? "InlineStart" : "InlineEnd"}`) as keyof React.CSSProperties)
        : ((`padding${side[0].toUpperCase()}${side.slice(1)}`) as keyof React.CSSProperties);
    (out as Record<string, string>)[key] = token;
  }
  return out;
}

/**
 * projectionEffect — a 3×3 ProjectionTransform → CSS `matrix3d(...)`.
 *
 * SwiftUI's `ProjectionTransform` is a 3×3 homogeneous matrix laid out
 * row-major as `[m11,m12,m13, m21,m22,m23, m31,m32,m33]` operating on (x, y, w).
 * CSS `matrix3d` is a 4×4 COLUMN-major matrix on (x, y, z, w). We embed the 3×3
 * into the 4×4 keeping z identity:
 *   x' col = (m11, m12, 0, m13)   ← first matrix3d column
 *   y' col = (m21, m22, 0, m23)
 *   z' col = (0,   0,   1, 0)
 *   w  col = (m31, m32, 0, m33)   ← projection/perspective terms
 */
export function projectionToCSS(
  p: [number, number, number, number, number, number, number, number, number],
): string {
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = p;
  const m = [
    m11, m12, 0, m13,
    m21, m22, 0, m23,
    0, 0, 1, 0,
    m31, m32, 0, m33,
  ];
  return `matrix3d(${m.join(", ")})`;
}
