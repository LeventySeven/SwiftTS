/**
 * SymbolGlyph — the canonical SF-Symbol renderer for the whole kit.
 *
 * SF Symbols are an Apple-proprietary glyph database we legally cannot ship. We
 * map the symbol *name* SwiftUI code passes (`Image(systemName:)`,
 * `Label(systemImage:)`, the C2 action controls) to a visually-similar OPEN icon
 * (`sf-symbols-map.ts`) and render it as inline SVG. This is a DESIGNED
 * approximation — clean and iOS-like — and it NEVER renders the raw symbol name
 * as text. Unmapped names fall back to a neutral rounded-square "app" glyph.
 *
 * Sizing: the glyph defaults to ~1em (so it inherits the surrounding font-size,
 * matching body text at 17px). Pass `size` for an explicit px box, or let the
 * `.imageScale` CSS class scale the 1em box. `color` defaults to `currentColor`
 * so it follows `foregroundStyle`. `weight` maps to outline stroke-width.
 *
 * Purely presentational — no client directive, SSR-safe.
 */
import * as React from "react";
import {
  resolveGlyph,
  FALLBACK_GLYPH,
  type GlyphGeometry,
} from "./sf-symbols-map";

/** SF symbol font-weight scale → outline stroke-width (px on the 24-grid). */
export type SymbolWeight =
  | "ultraLight"
  | "thin"
  | "light"
  | "regular"
  | "medium"
  | "semibold"
  | "bold"
  | "heavy"
  | "black";

const WEIGHT_STROKE: Record<SymbolWeight, number> = {
  ultraLight: 1,
  thin: 1.25,
  light: 1.5,
  regular: 1.75,
  medium: 2,
  semibold: 2.25,
  bold: 2.5,
  heavy: 2.75,
  black: 3,
};

export interface SymbolGlyphProps
  extends Omit<React.SVGProps<SVGSVGElement>, "name" | "color"> {
  /** SF Symbol name (e.g. "house.fill"). Alias of `systemName`. */
  name?: string;
  /** SF Symbol name — accepted as an alias of `name` for `Image`-style call sites. */
  systemName?: string;
  /** Explicit glyph box in px. Omit to inherit ~1em from the surrounding text. */
  size?: number;
  /** Symbol weight → outline stroke-width. Defaults to `regular`. */
  weight?: SymbolWeight;
  /** Glyph color. Defaults to `currentColor` (follows `foregroundStyle`). */
  color?: string;
  /** Accessible label; when omitted the glyph is `aria-hidden`. */
  label?: string;
}

/** Render a geometry's stroke + fill paths with the resolved paint. */
function renderGeometry(
  geo: GlyphGeometry,
  strokeWidth: number,
): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  if (geo.fill) {
    nodes.push(
      <path
        key="f"
        d={geo.fill}
        fill="currentColor"
        fillRule={geo.rule ?? "nonzero"}
        clipRule={geo.rule ?? "nonzero"}
        stroke="none"
      />,
    );
  }
  if (geo.stroke) {
    nodes.push(
      <path
        key="s"
        d={geo.stroke}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap={geo.square ? "butt" : "round"}
        strokeLinejoin={geo.square ? "miter" : "round"}
      />,
    );
  }
  return nodes;
}

/**
 * Render the named SF Symbol as an inline 24×24 SVG. Unknown names render the
 * neutral rounded-square placeholder — never the raw symbol text.
 */
export const SymbolGlyph = React.forwardRef<SVGSVGElement, SymbolGlyphProps>(
  function SymbolGlyph(
    { name, systemName, size, weight = "regular", color, label, style, ...rest },
    ref,
  ) {
    const symbol = name ?? systemName ?? "";
    const geo = resolveGlyph(symbol);

    if (geo == null && process.env.NODE_ENV !== "production" && symbol) {
      // eslint-disable-next-line no-console
      console.warn(
        `[SymbolGlyph] no glyph mapped for "${symbol}" — rendering generic placeholder.`,
      );
    }

    const geometry = geo ?? FALLBACK_GLYPH;
    const strokeWidth = WEIGHT_STROKE[weight];

    // size → explicit px box; otherwise inherit 1em from the surrounding text.
    const box = size != null ? `${size}px` : "1em";

    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        width={box}
        height={box}
        role={label ? "img" : undefined}
        aria-hidden={label ? undefined : true}
        aria-label={label}
        focusable="false"
        data-symbol={symbol || undefined}
        data-symbol-missing={geo == null && symbol ? symbol : undefined}
        style={{
          display: "inline-block",
          verticalAlign: "-0.125em",
          flex: "0 0 auto",
          color: color,
          ...style,
        }}
        {...rest}
      >
        {renderGeometry(geometry, strokeWidth)}
      </svg>
    );
  },
);

SymbolGlyph.displayName = "SymbolGlyph";
