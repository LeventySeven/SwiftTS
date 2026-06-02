/**
 * `<Image>` — SwiftUI's bitmap / vector / SF-Symbol primitive (C1 §2).
 *
 * Spec: teardowns/SWIFTUI_C1_content-primitives.md §2.
 *
 * Three content kinds mirror the Swift inits:
 *   - named raster asset (`Image("photo")`)              → `<img>`
 *   - SF Symbol (`Image(systemName: "star")`)            → <SymbolGlyph> (open-icon map)
 *   - decorative CGImage / explicit src                  → `<img alt="">`
 *
 * The chained Swift modifiers (`resizable`, `renderingMode`, `interpolation`,
 * `symbolRenderingMode`) are value-returning (`Image → Image`); here they're
 * props folded onto the element. Purely presentational → server-compatible.
 */
import * as React from "react";
import { mergeStyles, type ViewProps } from "../View";
import { applyModifiers, type ViewModifierProps } from "../../system/modifiers";
import { SymbolGlyph, type SymbolWeight } from "../controls/SymbolGlyph";
import styles from "./Image.module.css";

/** Color treatment for SF Symbols (`.symbolRenderingMode(_:)`). */
export type SymbolRenderingMode =
  | "monochrome"
  | "multicolor"
  | "hierarchical"
  | "palette";

export type ResizingMode = "stretch" | "tile";
export type TemplateRenderingMode = "template" | "original";
export type Interpolation = "none" | "low" | "medium" | "high";
export type SymbolVariant =
  | "none"
  | "circle"
  | "square"
  | "rectangle"
  | "fill"
  | "slash";
export type ImageScale = "small" | "medium" | "large";

export interface ImageProps
  extends Omit<ViewProps, "as" | "children" | "symbolVariant"> {
  /** `Image(systemName:)` — SF Symbol; mapped to an inline-SVG sprite. */
  systemName?: string;
  /** `Image(_:bundle:)` — named asset. Combined with `bundle` for the URL. */
  name?: string;
  /** Explicit raster source URL (decorative or named asset resolved to a URL). */
  src?: string;
  /** Asset bundle base path; prefixed onto `name` when no `src` is given. */
  bundle?: string;
  /** Accessibility label. Omit for decorative images (renders `alt=""`). */
  label?: string;
  /** `0…1` variable-color fill fraction (SF Symbol variable rendering). */
  variableValue?: number;

  /** `.resizable()` — stretch or tile to fill the frame. */
  resizable?: boolean | { mode?: ResizingMode };
  /** `.renderingMode(_:)`. */
  renderingMode?: TemplateRenderingMode;
  /** `.interpolation(_:)`. */
  interpolation?: Interpolation;
  /** `.antialiased(_:)`. */
  antialiased?: boolean;

  /** `.symbolRenderingMode(_:)` — color treatment for SF Symbols. */
  symbolRenderingMode?: SymbolRenderingMode;
  /** `.symbolVariant(_:)` — composable (`['circle','fill']` → `.circle.fill`). */
  symbolVariant?: SymbolVariant[];
  /** Palette colors for `.palette` rendering (resolved per symbol layer). */
  paletteColors?: string[];
  /** `.imageScale(_:)`. */
  scale?: ImageScale;
}

export const Image = React.forwardRef<HTMLElement, ImageProps>(function Image(
  {
    systemName,
    name,
    src,
    bundle,
    label,
    variableValue,
    resizable,
    renderingMode,
    interpolation,
    antialiased,
    symbolRenderingMode,
    symbolVariant,
    paletteColors,
    scale,
    className,
    style: styleProp,
    ...rest
  },
  ref,
) {
  // Run the rest of the modifier bag (frame/foreground/padding/etc.) through the
  // shared compiler. `foregroundStyle` sets `color`, which the symbol's
  // `currentColor` fill picks up.
  const { style: modStyle, className: modClassName, rest: domRest } = applyModifiers(
    rest as ViewModifierProps & Record<string, unknown>,
  );

  // ── SF Symbol path ──────────────────────────────────────────────────────
  // Routes through the canonical <SymbolGlyph> renderer (open-icon map). The
  // composed name folds `.symbolVariant(.circle/.fill/…)` suffixes onto the
  // base, matching SF's dotted naming (`star` + ['circle','fill'] → `star.circle.fill`).
  if (systemName != null) {
    const variantSuffix = (symbolVariant ?? [])
      .filter((v) => v !== "none")
      .map((v) => v);
    const composedName = [systemName, ...variantSuffix].join(".");

    const scaleClass =
      scale === "small"
        ? styles.symbolScaleSmall
        : scale === "large"
          ? styles.symbolScaleLarge
          : undefined;
    const symClassName =
      [styles.symbol, scaleClass, modClassName, className]
        .filter(Boolean)
        .join(" ") || undefined;

    // `.fontWeight` (or `.bold`) flows to the symbol's outline stroke-width.
    const symbolWeight: SymbolWeight | undefined =
      (rest as { fontWeight?: SymbolWeight }).fontWeight ??
      ((rest as { bold?: boolean }).bold === true ? "bold" : undefined);

    return (
      <SymbolGlyph
        ref={ref as React.Ref<SVGSVGElement>}
        className={symClassName}
        name={composedName}
        weight={symbolWeight}
        label={label}
        style={mergeStyles(modStyle, styleProp)}
        data-rendering-mode={symbolRenderingMode}
        data-symbol-variant={variantSuffix.length ? variantSuffix.join(".") : undefined}
        {...(domRest as React.SVGProps<SVGSVGElement>)}
      />
    );
  }

  // ── Raster asset path ───────────────────────────────────────────────────
  const resolvedSrc =
    src ?? (name != null ? `${bundle ?? ""}${name}` : undefined);

  const isResizable = resizable === true || (typeof resizable === "object" && resizable != null);
  const tile = typeof resizable === "object" && resizable?.mode === "tile";

  const imgClassName =
    [
      styles.image,
      isResizable ? styles.resizable : undefined,
      tile ? styles.tile : undefined,
      interpolation === "none"
        ? styles.interpNone
        : interpolation === "low"
          ? styles.interpLow
          : undefined,
      modClassName,
      className,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <img
      ref={ref as React.Ref<HTMLImageElement>}
      className={imgClassName}
      src={resolvedSrc}
      alt={label ?? ""}
      style={mergeStyles(modStyle, styleProp)}
      data-rendering={renderingMode}
      data-interp={interpolation}
      data-antialiased={antialiased === false ? "false" : undefined}
      data-variable-value={variableValue}
      {...(domRest as React.ImgHTMLAttributes<HTMLImageElement>)}
    />
  );
});

Image.displayName = "Image";
