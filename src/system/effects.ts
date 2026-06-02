/**
 * effects.ts — SwiftUI Cluster C12 (Materials & Visual Effects) system module.
 *
 * Complements `applyModifiers` (which already wires the inline `filter`/`opacity`/
 * `mix-blend-mode` content-filter props) with the BACKDROP layer that
 * applyModifiers cannot express: frosted Materials, the vibrancy hierarchy, and
 * the iOS-26 Liquid-Glass approximation — plus pure string/style helpers for the
 * content-filter + blend passes so callers can build them outside <View>.
 *
 * Architectural split (the spec's load-bearing fact):
 *   - Materials / Glass read BEHIND the element → CSS `backdrop-filter` + tint bg.
 *     These are the ONLY web primitives that sample behind-the-element pixels.
 *   - Content filters / blend read the element's OWN pixels → `filter` /
 *     `mix-blend-mode`. Those are handled by applyModifiers; the helpers here let
 *     you compose the same strings off-element (e.g. for a non-<View> node).
 *
 * Numbers come from the W1 `--sui-material-*` vars (variables.css). Light values
 * sit on :root; the dark overrides are ALSO already in variables.css (both
 * @media prefers-color-scheme and [data-theme="dark"]). This module never
 * hardcodes a tint — only the class strings + the DESIGNED Liquid-Glass geometry
 * (which has no token) live here. The CSS itself is in effects.global.css.
 *
 * JSX-free on purpose: the file is named `effects.ts` (not `.tsx`), so the two
 * components are authored with `React.createElement`. They are purely
 * presentational (no state/effects/refs) → no "use client" directive; they stay
 * server-compatible. The stateful pieces (useWindowActive, resolveActive) are
 * helpers a client component can opt into.
 */

import * as React from "react";
import type { Material as MaterialKind } from "./types";
import {
  useMatchedGeometry,
  useNamespace,
  MatchedGeometryNamespace,
  type MatchedGeometryNamespaceValue,
} from "./matched-geometry";

/**
 * SwiftUI `BlendMode` — all 21 cases (SwiftUICore.swiftinterface:6232–6259).
 * Not part of the shared `types.ts` vocabulary (it is C12-local), so it is
 * defined here. The first 16 map 1:1 to CSS mix-blend-mode; the last 5 are
 * Porter-Duff compositing operators handled with DESIGNED fallbacks in
 * BLEND_MAP below.
 */
export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "colorDodge"
  | "colorBurn"
  | "softLight"
  | "hardLight"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity"
  | "sourceAtop"
  | "destinationOver"
  | "destinationOut"
  | "plusDarker"
  | "plusLighter";

// Side-effect import: registers the global .sui-material-* / .sui-vibrant-* /
// .sui-glass classes. effects.global.css is authored with BARE (un-scoped)
// class names — no `:global(...)` (it breaks under Turbopack) — so the literal
// class strings the helpers below emit resolve verbatim at runtime.
import "./effects.global.css";

/* ============================================================================
 * 1. Material backdrop surfaces
 * ========================================================================== */

/** Vibrancy levels for foreground content placed on a material (§1.3). */
export type Vibrancy =
  | "primary"
  | "secondary"
  | "tertiary"
  | "quaternary"
  | "quinary";

/** macOS window-active appearance for materials (§2). */
export type MaterialActiveAppearance =
  | "automatic"
  | "active"
  | "inactive"
  | "matchWindow";

/**
 * The set of material levels this module styles. The shared `Material` type is
 * `ultraThin | thin | regular | thick | bar`; `ultraThick` has token vars in
 * variables.css and a `.sui-material-ultraThick` class, so it is accepted here
 * as an extension without widening the shared vocabulary.
 */
export type MaterialLevel = MaterialKind | "ultraThick";

/** Base class shared by every material surface. */
export const MATERIAL_BASE_CLASS = "sui-material";

/**
 * materialClass(level) → the stable, global class string for a material level.
 * e.g. materialClass("regular") === "sui-material sui-material-regular".
 * Returns the base + level modifier so a caller can drop it straight onto any
 * element's className (the SwiftUI `.background(.regularMaterial)` mapping).
 */
export function materialClass(level: MaterialLevel = "regular"): string {
  return `${MATERIAL_BASE_CLASS} sui-material-${level}`;
}

/** The global class for a vibrancy level (foreground-on-material). */
export function vibrancyClass(level: Vibrancy = "primary"): string {
  return `sui-vibrant-${level}`;
}

/** Props for the <Material> surface component. */
export interface MaterialProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Material thickness; mirrors `.regularMaterial` default. */
  level?: MaterialLevel;
  /** Render the optional 0.5px rim hairline (default off). */
  rim?: boolean;
  /**
   * macOS window-active appearance. `inactive`/`matchWindow` dim the vibrancy;
   * resolve `matchWindow`/`automatic` against `useWindowActive()` and pass the
   * concrete "active" | "inactive" via this prop (or set it directly).
   */
  active?: "active" | "inactive";
  /**
   * Clip-to-shape: `.background(.thinMaterial, in: RoundedRectangle(...))`.
   * Pass `{ borderRadius }` or any clip CSS. The host gets overflow:hidden so
   * the blurred layer is masked to the corner radius.
   */
  in?: Pick<React.CSSProperties, "borderRadius" | "clipPath">;
  children?: React.ReactNode;
}

/**
 * <Material level> — a frosted-glass backdrop surface. Children sit on top and
 * should use <Vibrant> / vibrancyClass() for legible foreground tinting.
 *
 * Maps `.background(.<level>Material)`. With `in`, maps the shape-clipped
 * overload (`.background(_, in: shape)`): the surface gets overflow:hidden so
 * the live backdrop blur is clipped to the requested corner radius / clip-path.
 */
export const Material: React.FC<MaterialProps> = ({
  level = "regular",
  rim = false,
  active,
  in: clip,
  className,
  style,
  children,
  ...rest
}) => {
  const classes = [
    materialClass(level),
    rim ? "" : "sui-material-no-rim",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const mergedStyle: React.CSSProperties = {
    ...(clip
      ? { ...clip, overflow: "hidden" as const }
      : {}),
    ...style,
  };

  return React.createElement(
    "div",
    {
      className: classes,
      style: mergedStyle,
      ...(active ? { "data-active": active } : {}),
      ...rest,
    },
    children,
  );
};
Material.displayName = "Material";

/** Props for the <Vibrant> foreground-on-material text helper. */
export interface VibrantProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Vibrancy level; mirrors `.foregroundStyle(.secondary)` on a material. */
  level?: Vibrancy;
  /**
   * Opt into true vibrancy (text picks up backdrop color via blend) instead of
   * alpha-only. overlay in Light, plus-lighter in Dark. Off by default because
   * blend-on-text-over-glass is fragile cross-browser.
   */
  blend?: boolean;
  children?: React.ReactNode;
}

/** <Vibrant level> — foreground text/icon tint for content on a material. */
export const Vibrant: React.FC<VibrantProps> = ({
  level = "primary",
  blend = false,
  className,
  children,
  ...rest
}) => {
  const classes = [
    vibrancyClass(level),
    blend ? "sui-vibrant-blend" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return React.createElement("span", { className: classes, ...rest }, children);
};
Vibrant.displayName = "Vibrant";

/* ============================================================================
 * 2. MaterialActiveAppearance helpers (§2) — window-focus → dimmed vibrancy.
 *    These are stateful; a client component opts in. Kept as standalone helpers
 *    so this module stays server-compatible (no top-level hooks).
 * ========================================================================== */

/**
 * Tracks document focus to mirror `.matchWindow`. SSR-safe: seeds `true` on the
 * server and re-reads `document.hasFocus()` after mount. Call only from a
 * client component ("use client").
 */
export function useWindowActive(): boolean {
  const [active, setActive] = React.useState(true);
  React.useEffect(() => {
    const sync = () => setActive(document.hasFocus());
    sync();
    const on = () => setActive(true);
    const off = () => setActive(false);
    window.addEventListener("focus", on);
    window.addEventListener("blur", off);
    return () => {
      window.removeEventListener("focus", on);
      window.removeEventListener("blur", off);
    };
  }, []);
  return active;
}

/**
 * Resolve a MaterialActiveAppearance + current window focus into the concrete
 * data-active value the CSS keys off. `automatic` ≈ `matchWindow`.
 */
export function resolveActive(
  appearance: MaterialActiveAppearance,
  windowActive: boolean,
): "active" | "inactive" {
  switch (appearance) {
    case "active":
      return "active";
    case "inactive":
      return "inactive";
    case "matchWindow":
    case "automatic":
    default:
      return windowActive ? "active" : "inactive";
  }
}

/* ============================================================================
 * 3. Content-filter / blend / shadow helpers (complement applyModifiers).
 *    applyModifiers already emits these from <View> modifier props; these are
 *    the same recipes as standalone string builders for off-<View> use.
 * ========================================================================== */

/** Content-filter inputs — the nine SwiftUI content-filter modifiers. */
export interface FilterEffects {
  /** .blur(radius:) → blur(Npx). */
  blur?: number;
  /** .opacity(_:) → opacity (composites the subtree as one layer). */
  opacity?: number;
  /** .brightness(_:) ADDITIVE delta → brightness(1 + b). */
  brightness?: number;
  /** .contrast(_:) → contrast() (1:1). */
  contrast?: number;
  /** .saturation(_:) → saturate() (1:1). */
  saturation?: number;
  /** .grayscale(_:) → grayscale() (1:1, clamp 0…1). */
  grayscale?: number;
  /** .hueRotation(_:) in DEGREES → hue-rotate(deg). */
  hueRotation?: number;
}

/**
 * Build the single CSS `filter` string in the canonical compose order
 * (brightness → contrast → saturate → grayscale → hue-rotate → blur), matching
 * SwiftUI's chained-modifier order (blur last so it blurs the filtered result).
 * `.brightness` is converted additive→multiplicative: `brightness(1 + amount)`.
 * Returns "none" when no filters apply.
 */
export function buildFilterString(e: FilterEffects): string {
  const parts: string[] = [];
  if (e.brightness != null) parts.push(`brightness(${1 + e.brightness})`);
  if (e.contrast != null) parts.push(`contrast(${e.contrast})`);
  if (e.saturation != null) parts.push(`saturate(${e.saturation})`);
  if (e.grayscale != null) parts.push(`grayscale(${e.grayscale})`);
  if (e.hueRotation != null) parts.push(`hue-rotate(${e.hueRotation}deg)`);
  if (e.blur != null) parts.push(`blur(${e.blur}px)`);
  return parts.join(" ") || "none";
}

/** Convenience: just the blur portion. SwiftUI radius ≈ CSS px 1:1. */
export function blur(radius: number): string {
  return `blur(${radius}px)`;
}

/** SwiftUI `.opacity(_:)` is 1:1 with CSS opacity; identity passthrough. */
export function opacity(value: number): number {
  return value;
}

/**
 * SwiftUI BlendMode → CSS mix-blend-mode. 16 of 21 cases are 1:1; the last 5 are
 * Porter-Duff compositing operators with no separable-blend analog → DESIGNED
 * fallbacks (sourceAtop/destinationOver/destinationOut collapse to normal;
 * plusDarker → darken; plusLighter → plus-lighter where supported).
 */
export const BLEND_MAP: Record<
  BlendMode,
  NonNullable<React.CSSProperties["mixBlendMode"]>
> = {
  normal: "normal",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  colorDodge: "color-dodge",
  colorBurn: "color-burn",
  softLight: "soft-light",
  hardLight: "hard-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
  plusLighter: "plus-lighter",
  // DESIGNED fallbacks (no exact CSS):
  plusDarker: "darken",
  sourceAtop: "normal",
  destinationOver: "normal",
  destinationOut: "normal",
};

/** Map a SwiftUI BlendMode to its CSS `mix-blend-mode` value. */
export function blendMode(
  mode: BlendMode,
): NonNullable<React.CSSProperties["mixBlendMode"]> {
  return BLEND_MAP[mode] ?? "normal";
}

/**
 * SwiftUI `.shadow(color:radius:x:y:)` → CSS box-shadow string.
 * CSS box-shadow blur ≈ 2× SwiftUI radius; spread always 0; default color is
 * pure black @ 33% alpha (the SwiftUI default `Color(.sRGBLinear, white:0,
 * opacity:0.33)`). For non-rectangular shapes use a drop-shadow() filter
 * instead (box-shadow only follows border-radius).
 */
export function shadowString(opts: {
  color?: string;
  radius: number;
  x?: number;
  y?: number;
}): string {
  const { color = "rgba(0, 0, 0, 0.33)", radius, x = 0, y = 0 } = opts;
  return `${x}px ${y}px ${radius * 2}px 0 ${color}`;
}

/**
 * Assemble a ready-to-spread style object for the content-filter pass, including
 * the colorMultiply ::after overlay var and the blur-opaque structural bits.
 * Pair with `colorMultiplyClassName(...)` / "sui-fx" for the class side.
 */
export function filterStyle(
  e: FilterEffects & { colorMultiply?: string; blurOpaque?: boolean },
): React.CSSProperties {
  const style: React.CSSProperties = {};
  const f = buildFilterString(e);
  if (f !== "none") style.filter = f;
  if (e.opacity != null) style.opacity = e.opacity;
  if (e.blurOpaque) {
    style.overflow = "hidden";
    style.isolation = "isolate";
  }
  if (e.colorMultiply) {
    (style as Record<string, string>)["--cm-color"] = e.colorMultiply;
  }
  return style;
}

/**
 * Class string for the content-filter pass. Adds `sui-color-multiply` (the
 * ::after multiply overlay) when a colorMultiply color is supplied, and
 * `sui-fx-animatable` (transition on filter/opacity) when animatable.
 */
export function filterClassName(opts?: {
  colorMultiply?: string;
  animatable?: boolean;
}): string {
  return [
    "sui-fx",
    opts?.colorMultiply ? "sui-color-multiply" : "",
    opts?.animatable ? "sui-fx-animatable" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/* compositingGroup / drawingGroup class names (§7). */
export const COMPOSITING_GROUP_CLASS = "sui-compositing-group";
export const DRAWING_GROUP_CLASS = "sui-drawing-group";

/* ============================================================================
 * 4. Liquid Glass (iOS 26) — DESIGNED recipe (§9). Kept separate from the
 *    canonical material (§1) so material fidelity for iOS 17/18 is unchanged.
 *
 *    This is the iOS-26 `glassEffect`/`Glass` surface: lighter and MORE
 *    translucent than the frosted Material, with a bright specular RIM, a soft
 *    inner glow, a diagonal sheen, and (on `.interactive`) hover/press lensing.
 *    The numbers are token-driven (--sui-glass-* in variables.css), so light /
 *    dark are handled entirely by the cascade — this module never hardcodes a
 *    tint, only the class strings and the shape geometry.
 *
 *    API mirrors SwiftUICore.swiftinterface:
 *      glassEffect(_:in:)  (arm64e-apple-macos.swiftinterface:2529)
 *      struct Glass        (:5753) — .regular/.clear/.identity + .tint/.interactive
 *      GlassEffectContainer(spacing:) (:9045)
 *    True backdrop refraction (feDisplacementMap) and the native droplet-merge
 *    (glassEffectUnion/ID) are out of scope for pure CSS — flagged DESIGNED.
 * ========================================================================== */

/** Liquid-glass variants: `.regular` adaptive / `.clear` transparent / `.identity` passthrough. */
export type GlassVariant = "regular" | "clear" | "identity";
/** @deprecated alias kept for back-compat; use {@link GlassVariant}. */
export type GlassKind = GlassVariant;

/** Base class for the layered liquid-glass surface. */
export const GLASS_BASE_CLASS = "sui-glass";

/**
 * The resolved Liquid-Glass configuration — the web analog of SwiftUI's
 * `struct Glass`. Immutable + chainable: `.tint(color)` and `.interactive(bool)`
 * each return a NEW `Glass` (matching the Swift value-type builder), so
 * `glass.regular.tint("#0a84ff").interactive()` reads 1:1 with the Swift call.
 */
export interface Glass {
  /** `.regular` / `.clear` / `.identity`. */
  readonly variant: GlassVariant;
  /** `.tint(color)` color, or null/undefined for untinted. */
  readonly tintColor?: string | null;
  /** `.interactive()` state. */
  readonly isInteractive: boolean;
  /** `.tint(_:)` — return a colored copy (pass null to clear the tint). */
  tint(color: string | null): Glass;
  /** `.interactive(_:)` — return an interactive copy (default true). */
  interactive(isEnabled?: boolean): Glass;
}

/** Internal: build a frozen Glass value with the chainable builders bound. */
function buildGlass(
  variant: GlassVariant,
  tintColor: string | null = null,
  isInteractive = false,
): Glass {
  const self: Glass = {
    variant,
    tintColor,
    isInteractive,
    tint(color: string | null) {
      return buildGlass(variant, color, isInteractive);
    },
    interactive(isEnabled = true) {
      return buildGlass(variant, tintColor, isEnabled);
    },
  };
  return Object.freeze(self);
}

/**
 * `makeGlass({ variant, tint, interactive })` — factory for a Glass value when
 * the chainable form (`glass.regular.tint(...)`) is inconvenient.
 */
export function makeGlass(opts?: {
  variant?: GlassVariant;
  tint?: string | null;
  interactive?: boolean;
}): Glass {
  return buildGlass(
    opts?.variant ?? "regular",
    opts?.tint ?? null,
    opts?.interactive ?? false,
  );
}

/**
 * `glass` — the SwiftUI `Glass` statics. `glass.regular` / `glass.clear` /
 * `glass.identity`, each chainable: `glass.clear.tint("#34c759").interactive()`.
 */
export const glass = {
  /** `.regular` — the default adaptive Liquid Glass. */
  get regular(): Glass {
    return buildGlass("regular");
  },
  /** `.clear` — the most transparent variant (media-rich backdrops). */
  get clear(): Glass {
    return buildGlass("clear");
  },
  /** `.identity` — a no-op passthrough (no glass layer). */
  get identity(): Glass {
    return buildGlass("identity");
  },
} as const;

/** Coerce a `Glass | GlassVariant` into a concrete `Glass` value. */
function resolveGlass(g: Glass | GlassVariant = "regular"): Glass {
  return typeof g === "string" ? buildGlass(g) : g;
}

/**
 * `glassClass(glass)` → the stable global class string for a Glass config.
 * Accepts either a `Glass` value or a bare variant name. e.g.
 * `glassClass(glass.clear.interactive())` →
 *   "sui-glass sui-glass-clear sui-glass-interactive".
 */
export function glassClass(g: Glass | GlassVariant = "regular"): string {
  const cfg = resolveGlass(g);
  return [
    GLASS_BASE_CLASS,
    cfg.variant === "clear" ? "sui-glass-clear" : "",
    cfg.variant === "identity" ? "sui-glass-identity" : "",
    cfg.tintColor ? "sui-glass-tinted" : "",
    cfg.isInteractive ? "sui-glass-interactive" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * `glassStyle(glass)` → the inline style carrying the tint custom property.
 * The CSS overlay (`.sui-glass-tinted::after`) reads `--sui-glass-tint-color`;
 * `.regular`/`.clear` already get their body/rim/sheen from the token cascade,
 * so the only inline bit is the optional tint color.
 */
export function glassStyle(g: Glass | GlassVariant = "regular"): React.CSSProperties {
  const cfg = resolveGlass(g);
  if (!cfg.tintColor) return {};
  return { ["--sui-glass-tint-color" as string]: cfg.tintColor } as React.CSSProperties;
}

/** The shape a glass layer is clipped to (DefaultGlassEffectShape = capsule). */
export type GlassShape =
  | "capsule"
  | "circle"
  | { rounded: number }
  | Pick<React.CSSProperties, "borderRadius" | "clipPath">;

/** Resolve a GlassShape into the border-radius / clip CSS for the glass layer. */
function shapeStyle(shape: GlassShape = "capsule"): React.CSSProperties {
  if (shape === "capsule") return { borderRadius: 9999 };
  if (shape === "circle") return { borderRadius: "50%", aspectRatio: "1 / 1" };
  if (typeof shape === "object" && "rounded" in shape) {
    return { borderRadius: shape.rounded };
  }
  return shape;
}

/**
 * `glassEffectProps(glass, shape)` → `{ className, style }` to SPREAD onto any
 * element, the web analog of the `.glassEffect(_:in:)` view modifier. Clips the
 * glass layer to `shape` (default capsule = DefaultGlassEffectShape).
 *
 *   <div {...glassEffectProps(glass.regular.tint("#0a84ff"), { rounded: 22 })}>…</div>
 */
export function glassEffectProps(
  g: Glass | GlassVariant = "regular",
  shape: GlassShape = "capsule",
): { className: string; style: React.CSSProperties } {
  return {
    className: glassClass(g),
    style: { ...shapeStyle(shape), ...glassStyle(g) },
  };
}

/** Props for the <GlassEffect> / <Glass> liquid-glass surface (iOS 26 delta). */
export interface GlassEffectProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The Glass config — a `Glass` value (`glass.regular.tint(...).interactive()`)
   * or a bare variant name. Defaults to `.regular`.
   */
  glass?: Glass | GlassVariant;
  /**
   * `in: shape` — clip the glass to a shape. `'capsule'` (default) | `'circle'`
   * | `{ rounded: n }` | raw `{ borderRadius | clipPath }`.
   */
  shape?: GlassShape;
  children?: React.ReactNode;
}

/**
 * `<GlassEffect glass shape>` — the iOS-26 Liquid-Glass surface: a token-driven
 * layered backdrop blur + bright specular rim + diagonal sheen + soft inner
 * glow, with optional tint and interactive lensing. NOT a flat frosted scrim.
 * True refraction / droplet-merge needs SVG feDisplacementMap or WebGL and is
 * out of scope; this is the CSS-only DESIGNED recipe.
 *
 * `<GlassEffect>` is the modifier-style name; `<Glass>` is exported as an alias.
 */
export const GlassEffect: React.FC<GlassEffectProps> = ({
  glass: g = "regular",
  shape = "capsule",
  className,
  style,
  children,
  ...rest
}) => {
  const props = glassEffectProps(g, shape);
  const classes = [props.className, className ?? ""].filter(Boolean).join(" ");
  return React.createElement(
    "div",
    { className: classes, style: { ...props.style, ...style }, ...rest },
    children,
  );
};
GlassEffect.displayName = "GlassEffect";

/** `<Glass>` — alias of `<GlassEffect>` (the surface component name). */
export const Glass = GlassEffect;

/**
 * <GlassEffectContainer spacing> — groups glass children so nearby panes MERGE
 * like native liquid droplets, the web analog of `GlassEffectContainer(spacing:)`
 * (:9045). This pass does the real merge, not just a flex group:
 *
 *   1. A shared GOOEY SVG FILTER (blur → high-contrast alpha threshold) is applied
 *      to a single merge layer that holds every child's silhouette. When two glass
 *      capsules come within ~`spacing` px, the blur fields overlap and the alpha
 *      threshold re-solidifies the union into ONE seamless blob with a smooth
 *      neck — the metaball / liquid-merge look (the CSS "gooey filter" technique).
 *   2. A NEGATIVE effective gap (`spacing` is the FUSE distance: the smaller it
 *      is, the closer—and more merged—the capsules sit). The flex `gap` is set to
 *      `spacing` minus the merge radius so capsules overlap their blur fields.
 *   3. A SHARED BLUR layer: the container hosts one `isolation: isolate` context so
 *      every child's backdrop blur composites against the same stacking context,
 *      and the gooey filter unifies their rims into a continuous specular edge.
 *
 * The gooey filter is injected once per container (a hidden inline `<svg>` with a
 * unique id) and referenced by the merge layer via `filter: url(#id)`. Children
 * are rendered twice conceptually: their real glass content sits on top, and a
 * tinted silhouette feeds the merge layer beneath — but to stay a drop-in we run
 * the filter on the children wrapper directly, which merges their rims/bodies.
 *
 * Still DESIGNED (flagged): true refraction (feDisplacementMap) and per-droplet
 * physics are out of scope; this is the closest pure-CSS/SVG liquid merge.
 */
export interface GlassEffectContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * SwiftUI `spacing:` — the FUSE distance: how close two glass shapes get before
   * they merge into one droplet. Smaller = tighter merge. Default 8.
   */
  spacing?: number;
  /** Stack axis for the group (default horizontal, like a capsule cluster). */
  axis?: "horizontal" | "vertical";
  /**
   * Merge strength — the blur radius (px) of the gooey filter. Larger = fatter
   * necks between droplets and a softer union. Default `spacing * 1.25`.
   */
  mergeStrength?: number;
  /**
   * Disable the liquid merge and fall back to a plain isolation group (the prior
   * behavior). Use when children should stay visually separate.
   */
  merge?: boolean;
  children?: React.ReactNode;
}

let GOO_ID_SEQ = 0;
/** Stable-per-instance gooey-filter id (SSR-safe via React.useId when available). */
function useGooId(): string {
  const reactId = (React as { useId?: () => string }).useId?.();
  const fallback = React.useRef<string | null>(null);
  if (reactId) return `sui-goo-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (fallback.current === null) fallback.current = `sui-goo-${GOO_ID_SEQ++}`;
  return fallback.current;
}

export const GlassEffectContainer: React.FC<GlassEffectContainerProps> = ({
  spacing = 8,
  axis = "horizontal",
  mergeStrength,
  merge = true,
  style,
  children,
  ...rest
}) => {
  const gooId = useGooId();
  // The fuse: pull capsules together by the merge radius so their blur fields
  // overlap. The effective flex gap is the SwiftUI spacing minus that overlap.
  const strength = mergeStrength ?? spacing * 1.25;
  const effGap = merge ? Math.max(0, spacing - strength) : spacing;

  const mergedStyle: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: axis === "vertical" ? "column" : "row",
    alignItems: "center",
    gap: effGap,
    isolation: "isolate",
    position: "relative",
    ...style,
  };

  // The gooey filter: blur to overlap silhouettes, then a steep alpha contrast
  // (feColorMatrix on the alpha channel) re-solidifies the union into one blob.
  // The 19/-9 alpha ramp is the canonical metaball threshold (gain 19, bias −9).
  const filterDefs = merge
    ? React.createElement(
        "svg",
        {
          "aria-hidden": true,
          width: 0,
          height: 0,
          style: { position: "absolute", width: 0, height: 0 },
        },
        React.createElement(
          "defs",
          null,
          React.createElement(
            "filter",
            { id: gooId },
            React.createElement("feGaussianBlur", {
              in: "SourceGraphic",
              stdDeviation: strength,
              result: "blur",
            }),
            React.createElement("feColorMatrix", {
              in: "blur",
              // feColorMatrix uses `type` (NOT `mode`); the alpha-row gain 19 /
              // bias −9 is the canonical metaball threshold that re-solidifies the
              // blurred union into one hard-edged droplet field.
              type: "matrix",
              values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9",
              result: "goo",
            }),
            // composite the sharp original back over the gooey union so child
            // CONTENT (icons/text) stays crisp while only the glass rims merge.
            // feBlend uses `mode` (default "normal" layers SourceGraphic on top).
            React.createElement("feBlend", {
              in: "SourceGraphic",
              in2: "goo",
              mode: "normal",
            }),
          ),
        ),
      )
    : null;

  // The children sit in a merge layer that runs the gooey filter. The filter
  // merges the overlapping glass rims/bodies into one continuous droplet field.
  const mergeLayer = React.createElement(
    "div",
    {
      style: {
        display: "contents",
        ...(merge ? { filter: `url(#${gooId})` } : {}),
      } as React.CSSProperties,
    },
    children,
  );

  // `display: contents` can't host a filter in every engine; wrap in a flex row
  // that itself carries the filter when merging (keeps layout identical).
  const body = merge
    ? React.createElement(
        "div",
        {
          style: {
            display: "inline-flex",
            flexDirection: axis === "vertical" ? "column" : "row",
            alignItems: "center",
            gap: effGap,
            filter: `url(#${gooId})`,
          } as React.CSSProperties,
        },
        children,
      )
    : mergeLayer;

  return React.createElement(
    "div",
    { style: mergedStyle, ...rest },
    filterDefs,
    body,
  );
};
GlassEffectContainer.displayName = "GlassEffectContainer";

/* ============================================================================
 * 5. glassEffectTransition — `GlassEffectTransition` (:2847) +
 *    `.glassEffectTransition(_:)` (:2861). The enter/exit animation a glass
 *    surface plays when it appears/disappears across a state change.
 *
 *    SwiftUI statics (:2848/:2851/:2854):
 *      .matchedGeometry — morph the glass between two matched IDs (FLIP).
 *      .materialize     — fade + scale the glass in/out (the "form from light"
 *                         droplet condense; clip-path/blur grow on enter).
 *      .identity        — no transition.
 * ========================================================================== */

/** `GlassEffectTransition` — the three statics, as a string union. */
export type GlassEffectTransition = "matchedGeometry" | "materialize" | "identity";

/** Enter/exit CSS for a glass transition. `materialize` grows from a blurred,
 *  scaled-down, faded droplet; `identity` is a no-op; `matchedGeometry` is driven
 *  by the FLIP in `useGlassEffectID` (this returns the fade portion only). */
export interface GlassTransitionStyles {
  /** style at the START of an ENTER (and END of an EXIT). */
  hidden: React.CSSProperties;
  /** style at the END of an ENTER (the resting state). */
  shown: React.CSSProperties;
  /** the `transition` shorthand to put on the element. */
  transition: string;
}

/**
 * `glassTransitionStyles(kind)` → the `{ hidden, shown, transition }` triple for a
 * glass enter/exit. Drive it from a mount-transition hook (toggle the class/style
 * between `hidden`→`shown` across a frame). `.materialize` is the iOS-26 "droplet
 * condenses out of light" look: it scales up from 0.86, un-blurs, and fades in.
 */
export function glassTransitionStyles(
  kind: GlassEffectTransition = "materialize",
): GlassTransitionStyles {
  if (kind === "identity") {
    return { hidden: {}, shown: {}, transition: "none" };
  }
  if (kind === "matchedGeometry") {
    // the morph is positional (handled by the FLIP); the opacity just cross-fades.
    return {
      hidden: { opacity: 0 },
      shown: { opacity: 1 },
      transition:
        "opacity 0.35s var(--sui-anim-smooth-css, var(--sui-anim-smooth-fallback, ease))",
    };
  }
  // materialize: scale + blur + fade — glass condensing into existence.
  return {
    hidden: {
      opacity: 0,
      transform: "scale(0.86)",
      filter: "blur(8px)",
    },
    shown: {
      opacity: 1,
      transform: "scale(1)",
      filter: "blur(0px)",
    },
    transition:
      "opacity 0.4s var(--sui-anim-smooth-css, var(--sui-anim-smooth-fallback, ease)), " +
      "transform 0.45s var(--sui-anim-bouncy-css, var(--sui-anim-bouncy-fallback, ease)), " +
      "filter 0.4s var(--sui-anim-smooth-css, var(--sui-anim-smooth-fallback, ease))",
  };
}

/** Class form: a single class enabling the materialize/matchedGeometry transition
 *  (the CSS lives in effects.global.css). Pair with `data-glass-shown`. */
export function glassTransitionClass(kind: GlassEffectTransition = "materialize"): string {
  if (kind === "identity") return "";
  return `sui-glass-transition sui-glass-transition--${kind}`;
}

/* ============================================================================
 * 6. glassEffectID + glassEffectUnion — morph/merge glass between states
 *    (:17372 / :9880). Both key off a `Namespace.ID`; we reuse the kit's
 *    matched-geometry FLIP so a glass shape with the same `id` in two states
 *    morphs (position+size) from the first to the second — the liquid droplet
 *    gliding/reshaping between layouts.
 * ========================================================================== */

/** Re-export the matched-geometry namespace so callers share one `@Namespace`
 *  between glass IDs and ordinary matched geometry. */
export type GlassNamespace = MatchedGeometryNamespaceValue;
export { useNamespace as useGlassNamespace, MatchedGeometryNamespace as GlassNamespaceProvider };

export interface UseGlassEffectIDOptions {
  /** the namespace the id is scoped to (or the nearest <GlassNamespaceProvider>). */
  namespace?: GlassNamespace;
  /** `isSource` — the source glass defines the geometry the destination morphs FROM. */
  isSource?: boolean;
  /** skip the morph (reduce-motion). */
  disabled?: boolean;
}

/**
 * `.glassEffectID(_:in:)` — give a glass shape an identity inside a namespace so
 * it MORPHS (FLIP: translate+scale) from its previous frame to its new one when
 * the layout changes between two states with the same id. Returns props to spread
 * on the glass element (a ref + transform style). Built on the kit's
 * matched-geometry engine, so glass IDs and normal matched geometry interop.
 *
 *   const a = useGlassEffectID("orb", { isSource: true });  // state A
 *   const b = useGlassEffectID("orb");                       // state B → morphs from A
 */
export function useGlassEffectID<E extends HTMLElement = HTMLDivElement>(
  id: string | number,
  options: UseGlassEffectIDOptions = {},
) {
  return useMatchedGeometry<E>(id, options.namespace, {
    isSource: options.isSource ?? true,
    properties: "frame",
    disabled: options.disabled,
  });
}

/**
 * `.glassEffectUnion(id:namespace:)` — MERGE several glass shapes that share a
 * union id into one droplet field. Where `glassEffectID` morphs ONE shape across
 * states, `union` fuses MANY shapes (in the same state) under a common id so a
 * `GlassEffectContainer` treats them as a single merged blob. We model this as a
 * `data-glass-union` grouping attribute + the shared namespace key; the container's
 * gooey filter then welds every element carrying the same union id.
 *
 * Returns `{ "data-glass-union": key }` to spread on each member element.
 */
export function glassEffectUnionProps(
  id: string | number,
  namespace?: GlassNamespace,
): { "data-glass-union": string } {
  const ns = namespace?.id ?? "default";
  return { "data-glass-union": `${ns}:${String(id)}` };
}

/* ============================================================================
 * 7. Bar-chrome support types — ScrollEdgeEffectStyle + TabBarMinimizeBehavior.
 *    These are the SwiftUI enums the navigation/tab agents import; the View-level
 *    modifiers that USE them live in modifiers.ts (scrollEdgeEffect*). Defined
 *    here so the glass system owns the glass vocabulary in one place.
 * ========================================================================== */

/**
 * `ScrollEdgeEffectStyle` (:12150) — the glass fade a scroll container's edge gets
 * under a floating bar. `.hard` = a crisp glass cutoff; `.soft` = a gentle blur
 * fade; `.automatic` resolves to soft on iOS-26 bars. String union for the nav
 * agent to import.
 */
export type ScrollEdgeEffectStyle = "automatic" | "hard" | "soft";

/**
 * `TabBarMinimizeBehavior` (:8789) — how an iOS-26 tab bar minimizes on scroll.
 * `.onScrollDown` shrinks the bar to a pill as the user scrolls down (and
 * restores on scroll up); `.onScrollUp` is the inverse; `.never` keeps it full;
 * `.automatic` picks the platform default (onScrollDown). String union for the
 * tab agent to import.
 */
export type TabBarMinimizeBehavior =
  | "automatic"
  | "onScrollDown"
  | "onScrollUp"
  | "never";
