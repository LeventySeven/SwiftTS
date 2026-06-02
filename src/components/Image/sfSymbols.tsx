/**
 * SF Symbols → inline-SVG strategy (C1 §2.5 / §11).
 *
 * SF Symbols are a proprietary Apple font + glyph database; the web cannot ship
 * the system symbol font legally or cross-platform. The strategy:
 *
 *   1. Map `systemName` (+ `symbolVariant`) → an inline `<svg>` whose paths use
 *      `fill: currentColor`, sized at `1em`, `vertical-align: -0.125em`, so the
 *      symbol inherits text color + metrics exactly like a native font-locked
 *      symbol.
 *   2. `symbolVariant(.fill/.circle/.slash)` selects a different sprite id
 *      (e.g. `star` → `star.fill`), composed by appending the variant suffix to
 *      the lookup key.
 *   3. `symbolRenderingMode`:
 *        .monochrome   → single `fill: currentColor`
 *        .hierarchical → multi-<path> with opacity 1 / 0.5 / 0.25 per layer
 *        .palette      → per-<path> fill from the foregroundStyle color list
 *        .multicolor   → the SVG's own baked colors (ignore currentColor)
 *   4. Unknown symbol names fall back to a **styled glyph slot**: a rounded
 *      monospace badge rendering the (shortened) symbol name, so layout is
 *      preserved and the missing symbol is obvious in dev. This keeps the kit
 *      functional without bundling the full ~5,000-symbol Apple set.
 *
 * The curated set below covers the highest-frequency UI symbols. A real
 * deployment would generate this map from an open SF-equivalent SVG pack
 * (keyed by SF name + variant) at build time; the runtime contract here is
 * stable regardless of how many entries the map holds.
 */
import * as React from "react";

/** One layer of a symbol — a path plus an optional hierarchical-opacity rank. */
export interface SymbolLayer {
  /** SVG path `d`. */
  d: string;
  /** Hierarchical depth (0 = primary 100%, 1 = secondary 50%, 2 = tertiary 25%). */
  rank?: 0 | 1 | 2;
  /** Baked color for `.multicolor` (overrides currentColor in that mode). */
  color?: string;
}

export interface SymbolDef {
  /** 0 0 W H viewBox; SF Symbols paths here are authored on a 16×16 grid. */
  viewBox: string;
  layers: SymbolLayer[];
}

/**
 * Curated, hand-authored 16×16 symbol paths for the most common UI glyphs.
 * Geometry is approximate-but-recognizable, not pixel-traced from Apple assets
 * (which are proprietary). `fill` is omitted so `currentColor` applies.
 */
const SYMBOLS: Record<string, SymbolDef> = {
  star: {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M8 1.2l1.9 3.9 4.3.6-3.1 3 .8 4.3L8 13.4 4.1 16l.8-4.3-3.1-3 4.3-.6z",
      },
    ],
  },
  "star.fill": {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M8 1.2l1.9 3.9 4.3.6-3.1 3 .8 4.3L8 12l-3.9 2 .8-4.3-3.1-3 4.3-.6z",
      },
    ],
  },
  heart: {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M8 14S1.5 9.8 1.5 5.5A3.5 3.5 0 018 4a3.5 3.5 0 016.5 1.5C14.5 9.8 8 14 8 14z",
      },
    ],
  },
  "heart.fill": {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M8 14S1.5 9.8 1.5 5.5A3.5 3.5 0 018 4a3.5 3.5 0 016.5 1.5C14.5 9.8 8 14 8 14z",
      },
    ],
  },
  plus: {
    viewBox: "0 0 16 16",
    layers: [{ d: "M7 1h2v6h6v2H9v6H7V9H1V7h6z" }],
  },
  minus: {
    viewBox: "0 0 16 16",
    layers: [{ d: "M1 7h14v2H1z" }],
  },
  xmark: {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M3.3 1.9l4.7 4.7 4.7-4.7 1.4 1.4L9.4 8l4.7 4.7-1.4 1.4L8 9.4l-4.7 4.7-1.4-1.4L6.6 8 1.9 3.3z",
      },
    ],
  },
  checkmark: {
    viewBox: "0 0 16 16",
    layers: [{ d: "M6.2 11.4L2.4 7.6 3.8 6.2l2.4 2.4 6-6 1.4 1.4z" }],
  },
  "chevron.right": {
    viewBox: "0 0 16 16",
    layers: [{ d: "M5.5 2.5l1.4-1.4L13.8 8l-6.9 6.9-1.4-1.4L11 8z" }],
  },
  "chevron.left": {
    viewBox: "0 0 16 16",
    layers: [{ d: "M10.5 1.1l1.4 1.4L5 8l6.9 5.5-1.4 1.4L2.2 8z" }],
  },
  "chevron.down": {
    viewBox: "0 0 16 16",
    layers: [{ d: "M1.1 5.5l1.4-1.4L8 11l5.5-6.9 1.4 1.4L8 13.8z" }],
  },
  "chevron.up": {
    viewBox: "0 0 16 16",
    layers: [{ d: "M14.9 10.5l-1.4 1.4L8 5l-5.5 6.9-1.4-1.4L8 2.2z" }],
  },
  trash: {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M6 1h4l.5 1H14v2H2V2h3.5zM3 5h10l-.8 9.2A1 1 0 0111.2 15H4.8a1 1 0 01-1-.8z",
      },
    ],
  },
  gear: {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M8 5.5A2.5 2.5 0 108 10.5 2.5 2.5 0 008 5.5zM14 9l-1.6.5a4.5 4.5 0 01-.5 1.2l.9 1.4-1.7 1.7-1.4-.9a4.5 4.5 0 01-1.2.5L8 16H6l-.5-1.6a4.5 4.5 0 01-1.2-.5l-1.4.9L1.2 13l.9-1.4a4.5 4.5 0 01-.5-1.2L0 10V8l1.6-.5a4.5 4.5 0 01.5-1.2L1.2 5l1.7-1.7 1.4.9a4.5 4.5 0 011.2-.5L6 2h2l.5 1.6a4.5 4.5 0 011.2.5l1.4-.9L12.8 5l-.9 1.4a4.5 4.5 0 01.5 1.2L16 8z",
      },
    ],
  },
  magnifyingglass: {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M6.5 1a5.5 5.5 0 014.4 8.8l4.4 4.4-1.4 1.4-4.4-4.4A5.5 5.5 0 116.5 1zm0 2a3.5 3.5 0 100 7 3.5 3.5 0 000-7z",
      },
    ],
  },
  person: {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M8 8a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm0 1.5c-3 0-6 1.5-6 4V15h12v-1.5c0-2.5-3-4-6-4z",
      },
    ],
  },
  "person.fill": {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M8 8a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm0 1.5c-3 0-6 1.5-6 4V15h12v-1.5c0-2.5-3-4-6-4z",
      },
    ],
  },
  bell: {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M8 1a1 1 0 011 1v.3A4.5 4.5 0 0112.5 7v2.5l1.5 2v.5H2v-.5l1.5-2V7A4.5 4.5 0 017 2.3V2a1 1 0 011-1zM6.2 13h3.6a1.8 1.8 0 01-3.6 0z",
      },
    ],
  },
  "exclamationmark.triangle": {
    viewBox: "0 0 16 16",
    layers: [
      {
        d: "M8 1l7 13H1zM7 6h2v4H7zm0 5h2v2H7z",
      },
    ],
  },
  info: {
    viewBox: "0 0 16 16",
    layers: [{ d: "M7 7h2v6H7zM7 3h2v2H7z" }],
  },
  "info.circle": {
    viewBox: "0 0 16 16",
    layers: [
      {
        rank: 0,
        d: "M8 0a8 8 0 100 16A8 8 0 008 0zm0 2a6 6 0 110 12A6 6 0 018 2z",
      },
      { rank: 1, d: "M7 7h2v5H7zM7 4h2v2H7z" },
    ],
  },
};

/** Variant order → SF naming suffix (`.circle.fill`). Composable. */
const VARIANT_SUFFIX: Record<string, string> = {
  circle: "circle",
  square: "square",
  rectangle: "rectangle",
  fill: "fill",
  slash: "slash",
};

/**
 * Compose the lookup key from base name + variants, then fall back from the most
 * specific composed name to the bare name (e.g. `star.circle.fill` → `star.fill`
 * → `star`) so a partial sprite set still renders something sensible.
 */
export function resolveSymbolKey(
  systemName: string,
  variants?: string[],
): string | undefined {
  const suffixes = (variants ?? [])
    .filter((v) => v !== "none" && VARIANT_SUFFIX[v])
    .map((v) => VARIANT_SUFFIX[v]);

  // try full composed key first, then progressively drop suffixes
  for (let i = suffixes.length; i >= 0; i--) {
    const key = [systemName, ...suffixes.slice(0, i)].join(".");
    if (SYMBOLS[key]) return key;
  }
  return SYMBOLS[systemName] ? systemName : undefined;
}

export type SymbolRenderingMode =
  | "monochrome"
  | "multicolor"
  | "hierarchical"
  | "palette";

const HIERARCHICAL_OPACITY: Record<0 | 1 | 2, number> = { 0: 1, 1: 0.5, 2: 0.25 };

/**
 * Render the resolved symbol's layers, applying the rendering mode.
 * Returns `null` if the key is unknown (caller renders the glyph-slot fallback).
 */
export function renderSymbolLayers(
  key: string,
  mode: SymbolRenderingMode | undefined,
  paletteColors: string[] | undefined,
): { viewBox: string; nodes: React.ReactNode } | null {
  const def = SYMBOLS[key];
  if (!def) return null;
  const nodes = def.layers.map((layer, i) => {
    const props: React.SVGProps<SVGPathElement> = { d: layer.d };
    if (mode === "multicolor" && layer.color) {
      props.fill = layer.color;
    } else if (mode === "palette" && paletteColors && paletteColors.length) {
      props.fill = paletteColors[i % paletteColors.length];
    } else if (mode === "hierarchical") {
      props.fillOpacity = HIERARCHICAL_OPACITY[layer.rank ?? 0];
    }
    // monochrome / default: omit fill → inherits `currentColor` from CSS.
    return <path key={i} {...props} />;
  });
  return { viewBox: def.viewBox, nodes };
}

/** True if a curated sprite exists for this composed name. */
export function hasSymbol(key: string | undefined): key is string {
  return key != null && key in SYMBOLS;
}
