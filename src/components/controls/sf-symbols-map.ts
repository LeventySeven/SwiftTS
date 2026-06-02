/**
 * sf-symbols-map — name → open-icon SVG geometry for the SymbolGlyph renderer.
 *
 * SF Symbols are a proprietary Apple glyph database we legally cannot ship. This
 * map is a DESIGNED approximation: each SF Symbol *name* (the string SwiftUI code
 * passes to `Image(systemName:)` / `Label(systemImage:)`) maps to a visually
 * similar glyph drawn from permissively-licensed open icon geometry (Lucide /
 * Bootstrap-Icons-equivalent silhouettes, re-authored on a 24×24 grid). The goal
 * is iOS-like layout + recognizability, not pixel-tracing Apple's assets.
 *
 * Geometry conventions (so SymbolGlyph can render uniformly):
 *   - `viewBox` is always "0 0 24 24".
 *   - A glyph is either STROKE-based (outline icons: house, bell, person, …) or
 *     FILL-based (a solid silhouette, used for `.fill` variants and inherently
 *     solid marks like checkmark/xmark/chevron).
 *   - STROKE glyphs ⇒ `{ stroke: "<path d>" }` (rendered with fill:none,
 *     stroke:currentColor, the stroke-width driven by `weight`).
 *   - FILL glyphs   ⇒ `{ fill: "<path d>" }` (rendered with fill:currentColor).
 *   - A glyph may provide BOTH (e.g. a circle outline + an inner stroke mark);
 *     both are emitted in order.
 *   - `rule: "evenodd"` opts a fill path into even-odd winding (donut shapes:
 *     filled circle with a knocked-out inner mark).
 *
 * `.fill` variants share the base outline's silhouette filled in where a distinct
 * filled drawing isn't authored — the resolver in SymbolGlyph handles the
 * base↔fill fallback so we don't need to duplicate every path.
 *
 * Pure data, no React, SSR-safe.
 */

import { UI_SYSTEM_SYMBOLS } from "./symbols/ui-system";
import { COMM_MEDIA_SYMBOLS } from "./symbols/comm-media";
import { LIFE_MISC_SYMBOLS } from "./symbols/life-misc";

/** One glyph's drawable geometry on the 24×24 grid. */
export interface GlyphGeometry {
  /** Path(s) painted with `stroke: currentColor` (outline style). */
  stroke?: string;
  /** Path(s) painted with `fill: currentColor` (solid style). */
  fill?: string;
  /** Even-odd winding for the fill path (donut / knockout shapes). */
  rule?: "evenodd" | "nonzero";
  /** Override stroke-line caps/joins ("round" is the default for outline icons). */
  square?: boolean;
}

const ROUND_CHEVRON = (d: string): GlyphGeometry => ({ stroke: d });

/**
 * The map. Keys are exact SF Symbol names (including `.fill` / `.circle` /
 * `.slash` variant suffixes where the filled drawing differs from the outline).
 */
export const SF_SYMBOLS: Record<string, GlyphGeometry> = {
  // Satellite glyph sets are spread FIRST so the curated entries below win on
  // any key conflict (later object keys override earlier ones in a spread).
  ...UI_SYSTEM_SYMBOLS,
  ...COMM_MEDIA_SYMBOLS,
  ...LIFE_MISC_SYMBOLS,

  // ── house ────────────────────────────────────────────────────────────────
  house: {
    stroke:
      "M3 11.5 12 4l9 7.5M5.2 9.8V19a1 1 0 0 0 1 1H10v-5h4v5h3.8a1 1 0 0 0 1-1V9.8",
  },
  "house.fill": {
    fill: "M11.3 3.5a1 1 0 0 1 1.4 0l8.6 7.6a.8.8 0 0 1-.5 1.4H20V19a1.5 1.5 0 0 1-1.5 1.5H14.5V15a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v5.5H5.5A1.5 1.5 0 0 1 4 19v-6.5h-1.8a.8.8 0 0 1-.5-1.4Z",
  },

  // ── gearshape / gear ───────────────────────────────────────────────────────
  gearshape: {
    stroke:
      "M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 3.27 17l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7 3.27l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06A2 2 0 1 1 20.73 7l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  },
  gear: {
    stroke:
      "M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 3.27 17l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7 3.27l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06A2 2 0 1 1 20.73 7l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  },
  "gearshape.fill": {
    fill: "M9.7 2.4a1 1 0 0 1 1-.9h2.6a1 1 0 0 1 1 .9l.2 1.7a7 7 0 0 1 1.4.8l1.6-.6a1 1 0 0 1 1.2.5l1.3 2.2a1 1 0 0 1-.2 1.3l-1.3 1.1c0 .3.1.5.1.8s0 .5-.1.8l1.3 1.1a1 1 0 0 1 .2 1.3l-1.3 2.2a1 1 0 0 1-1.2.5l-1.6-.6a7 7 0 0 1-1.4.8l-.2 1.7a1 1 0 0 1-1 .9h-2.6a1 1 0 0 1-1-.9l-.2-1.7a7 7 0 0 1-1.4-.8l-1.6.6a1 1 0 0 1-1.2-.5L3.5 14.5a1 1 0 0 1 .2-1.3L5 12.1c0-.3-.1-.5-.1-.8s0-.5.1-.8L3.7 9.4a1 1 0 0 1-.2-1.3l1.3-2.2a1 1 0 0 1 1.2-.5l1.6.6a7 7 0 0 1 1.4-.8ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    rule: "evenodd",
  },
  "slider.horizontal.3": {
    stroke:
      "M4 7h10M18 7h2M4 12h2M10 12h10M4 17h10M18 17h2 M14 5v4M6 10v4M14 15v4",
  },

  // ── person ─────────────────────────────────────────────────────────────────
  person: {
    stroke:
      "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0",
  },
  "person.fill": {
    fill: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20.5A8 8 0 0 1 20 20.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z",
  },
  "person.circle": {
    stroke:
      "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6.6 18.4a6 6 0 0 1 10.8 0",
  },
  "person.circle.fill": {
    fill: "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm0 4.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 14a8.5 8.5 0 0 1-5.6-2.1c.6-1.9 3-3.2 5.6-3.2s5 1.3 5.6 3.2A8.5 8.5 0 0 1 12 20Z",
    rule: "evenodd",
  },
  "person.crop.circle": {
    stroke:
      "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6.6 18.4a6 6 0 0 1 10.8 0",
  },
  "person.crop.circle.fill": {
    fill: "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm0 4.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 14a8.5 8.5 0 0 1-5.6-2.1c.6-1.9 3-3.2 5.6-3.2s5 1.3 5.6 3.2A8.5 8.5 0 0 1 12 20Z",
    rule: "evenodd",
  },
  "person.2": {
    stroke:
      "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.2a3.5 3.5 0 0 1 0 6.6M17.5 14a6.5 6.5 0 0 1 4 6",
  },
  "person.2.fill": {
    fill: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.2 19.5A7 7 0 0 1 15.8 19.5a.9.9 0 0 1-.9 1.1H3.1a.9.9 0 0 1-.9-1.1ZM16 4.4a3.5 3.5 0 0 1 0 6.2 5 5 0 0 1 2 1 7 7 0 0 1 3.8 8.1.9.9 0 0 1-.9.7H17a8.5 8.5 0 0 0-1.6-7.6A4.5 4.5 0 0 0 16 4.4Z",
  },
  "person.3": {
    stroke:
      "M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 20a5 5 0 0 1 10 0M6 11a2.5 2.5 0 1 1 0-5M3 19a5 5 0 0 1 3-4.6M18 11a2.5 2.5 0 1 0 0-5M21 19a5 5 0 0 0-3-4.6",
  },
  "person.3.fill": {
    fill: "M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 20.5a5 5 0 0 1 10 0 .5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5ZM6 11a2.5 2.5 0 1 1 0-5 4 4 0 0 0 0 5ZM2.5 19a5 5 0 0 1 3-4.6A5.7 5.7 0 0 0 4.5 19ZM18 11a2.5 2.5 0 1 0 0-5 4 4 0 0 1 0 5ZM21.5 19a5 5 0 0 0-3-4.6A5.7 5.7 0 0 1 19.5 19Z",
  },

  // ── bell ───────────────────────────────────────────────────────────────────
  bell: {
    stroke:
      "M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 19a2 2 0 0 0 4 0",
  },
  "bell.fill": {
    fill: "M12 2.5A6 6 0 0 0 6 8.5c0 4.5-1.6 5.8-2.4 6.4a1 1 0 0 0 .6 1.8h15.6a1 1 0 0 0 .6-1.8C19.6 14.3 18 13 18 8.5a6 6 0 0 0-6-6ZM10 19a2 2 0 0 0 4 0Z",
  },
  "bell.badge": {
    stroke:
      "M19 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M16 4.4A6 6 0 0 0 6 9c0 5-2 6-2 6h16s-1.4-.7-1.8-4M10 19a2 2 0 0 0 4 0",
    fill: "M19 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z",
  },
  "bell.slash": {
    stroke:
      "M6 9a6 6 0 0 1 9.5-4.9M18 12c.4 2 1 2.5 2 3H8M10 19a2 2 0 0 0 4 0M3 3l18 18",
  },

  // ── search ─────────────────────────────────────────────────────────────────
  magnifyingglass: {
    stroke: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5",
  },

  // ── plus / minus ───────────────────────────────────────────────────────────
  plus: { stroke: "M12 5v14M5 12h14" },
  "plus.circle": {
    stroke: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 8v8M8 12h8",
  },
  "plus.circle.fill": {
    fill: "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21ZM13 7v4h4v2h-4v4h-2v-4H7v-2h4V7Z",
    rule: "evenodd",
  },
  "plus.app": {
    stroke:
      "M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5ZM12 8v8M8 12h8",
  },
  minus: { stroke: "M5 12h14" },
  "minus.circle": {
    stroke: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 12h8",
  },

  // ── xmark ──────────────────────────────────────────────────────────────────
  xmark: { stroke: "M6 6l12 12M18 6 6 18" },
  "xmark.circle": {
    stroke: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 9l6 6M15 9l-6 6",
  },
  "xmark.circle.fill": {
    fill: "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21ZM8.5 7.1 12 10.6l3.5-3.5 1.4 1.4L13.4 12l3.5 3.5-1.4 1.4L12 13.4l-3.5 3.5-1.4-1.4L10.6 12 7.1 8.5Z",
    rule: "evenodd",
  },

  // ── checkmark ──────────────────────────────────────────────────────────────
  checkmark: { stroke: "M5 12.5 9.5 17 19 7" },
  "checkmark.circle": {
    stroke: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 12l2.8 2.8L16 9",
  },
  "checkmark.circle.fill": {
    fill: "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm5 7.7-6 6.1-3.4-3.4 1.4-1.4 2 2 4.6-4.7Z",
    rule: "evenodd",
  },

  // ── chevrons ───────────────────────────────────────────────────────────────
  "chevron.right": ROUND_CHEVRON("M9 5l7 7-7 7"),
  "chevron.left": ROUND_CHEVRON("M15 5l-7 7 7 7"),
  "chevron.up": ROUND_CHEVRON("M5 15l7-7 7 7"),
  "chevron.down": ROUND_CHEVRON("M5 9l7 7 7-7"),
  "chevron.forward": ROUND_CHEVRON("M9 5l7 7-7 7"),
  "chevron.backward": ROUND_CHEVRON("M15 5l-7 7 7 7"),
  "chevron.up.chevron.down": { stroke: "M7 9l5-5 5 5M7 15l5 5 5-5" },

  // ── arrows ─────────────────────────────────────────────────────────────────
  "arrow.up": { stroke: "M12 19V5M5 12l7-7 7 7" },
  "arrow.down": { stroke: "M12 5v14M5 12l7 7 7-7" },
  "arrow.left": { stroke: "M19 12H5M12 5l-7 7 7 7" },
  "arrow.right": { stroke: "M5 12h14M12 5l7 7-7 7" },
  "arrow.clockwise": {
    stroke:
      "M20 7a8 8 0 1 0 1.4 6M20 4v3.5a.5.5 0 0 1-.5.5H16",
  },

  // ── star / heart ───────────────────────────────────────────────────────────
  star: {
    stroke:
      "M12 3.2l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.4l5.9-.9Z",
  },
  "star.fill": {
    fill: "M11.1 3.6a1 1 0 0 1 1.8 0l2.2 4.5 5 .7a1 1 0 0 1 .5 1.7l-3.6 3.5.9 4.9a1 1 0 0 1-1.5 1.1L12 17.7l-4.4 2.3a1 1 0 0 1-1.5-1.1l.9-4.9-3.6-3.5a1 1 0 0 1 .5-1.7l5-.7Z",
  },
  heart: {
    stroke:
      "M12 20.5C7 16.5 3 13 3 8.8 3 6 5.2 4 7.6 4 9.3 4 10.9 5 12 6.6 13.1 5 14.7 4 16.4 4 18.8 4 21 6 21 8.8c0 4.2-4 7.7-9 11.7Z",
  },
  "heart.fill": {
    fill: "M12 20.5C7 16.5 3 13 3 8.8 3 6 5.2 4 7.6 4 9.3 4 10.9 5 12 6.6 13.1 5 14.7 4 16.4 4 18.8 4 21 6 21 8.8c0 4.2-4 7.7-9 11.7Z",
  },
  "hand.thumbsup": {
    stroke:
      "M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM7 11l4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 18 19H7",
  },

  // ── trash ──────────────────────────────────────────────────────────────────
  trash: {
    stroke:
      "M4 6h16M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 6l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 10v6M14 10v6",
  },
  "trash.fill": {
    fill: "M9 3a1 1 0 0 0-1 1v1H4v2h1l1 13.1A1 1 0 0 0 7 21h10a1 1 0 0 0 1-.9L19 7h1V5h-4V4a1 1 0 0 0-1-1Zm1 2V5h4v0Zm0 5h1.5v8H10Zm4.5 0H16v8h-1.5Z",
    rule: "evenodd",
  },

  // ── share / pencil ─────────────────────────────────────────────────────────
  "square.and.arrow.up": {
    stroke:
      "M12 3l4 4M12 3 8 7M12 3v12M7 10H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1",
  },
  "square.and.arrow.down": {
    stroke:
      "M12 15 8 11M12 15l4-4M12 15V3M7 10H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1",
  },
  pencil: {
    stroke:
      "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  },
  "doc.on.clipboard": {
    stroke:
      "M9 4.5h6M9 4.5a1.5 1.5 0 0 0-1.5 1.5H6a1.5 1.5 0 0 0-1.5 1.5V19A1.5 1.5 0 0 0 6 20.5h6a1.5 1.5 0 0 0 1.5-1.5M9 4.5a1.5 1.5 0 0 1 1.5 1.5h1.5M13.5 9h4.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 10 18.5V10.5A1.5 1.5 0 0 1 11.5 9Z",
  },

  // ── document / folder ──────────────────────────────────────────────────────
  doc: {
    stroke:
      "M7 3.5h6l5 5V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5ZM13 3.5V9h5",
  },
  "doc.fill": {
    fill: "M7.5 2A1.5 1.5 0 0 0 6 3.5v17A1.5 1.5 0 0 0 7.5 22h9a1.5 1.5 0 0 0 1.5-1.5V8l-6-6Zm5.5 1.5L17.5 8H14a1 1 0 0 1-1-1Z",
    rule: "evenodd",
  },
  "doc.text": {
    stroke:
      "M7 3.5h6l5 5V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5ZM13 3.5V9h5M9 13h6M9 16.5h6",
  },
  folder: {
    stroke:
      "M3 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h8A1.5 1.5 0 0 1 20 9.5V18a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3 18Z",
  },
  "folder.fill": {
    fill: "M3 7a1.5 1.5 0 0 1 1.5-1.5h4a1 1 0 0 1 .8.4L10.5 8h8A1.5 1.5 0 0 1 20 9.5V18a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3 18Z",
  },

  // ── photo / camera ─────────────────────────────────────────────────────────
  photo: {
    stroke:
      "M4 5.5h16A1.5 1.5 0 0 1 21.5 7v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5ZM8 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M3 17l5-5 4 4 3-3 6 6",
  },
  "photo.fill": {
    fill: "M3.5 4A1.5 1.5 0 0 0 2 5.5v13A1.5 1.5 0 0 0 3.5 20h17a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 20.5 4Zm4.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM4 18l5-5 3.5 3.5L16 13l4 5Z",
    rule: "evenodd",
  },
  camera: {
    stroke:
      "M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.2-2A1 1 0 0 1 9 4.5h6a1 1 0 0 1 .8.5L17 7h2.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5ZM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  },
  "camera.fill": {
    fill: "M9 4.5a1 1 0 0 0-.85.47L7 7H4.5A1.5 1.5 0 0 0 3 8.5v9A1.5 1.5 0 0 0 4.5 19h15a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 19.5 7H17l-1.15-2.03A1 1 0 0 0 15 4.5Zm3 5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z",
    rule: "evenodd",
  },

  // ── calendar / clock ───────────────────────────────────────────────────────
  calendar: {
    stroke:
      "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5ZM4 9.5h16M8 3.5v3M16 3.5v3",
  },
  "calendar.badge.plus": {
    stroke:
      "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v6M4 9.5h16M8 3.5v3M16 3.5v3M17 15v6M14 18h6",
  },
  clock: {
    stroke: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3.5 2",
  },
  "clock.fill": {
    fill: "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21ZM13 7v4.4l3.1 1.8-1 1.7L11 12.5V7Z",
    rule: "evenodd",
  },

  // ── envelope / phone / message ─────────────────────────────────────────────
  envelope: {
    stroke:
      "M3 7A1.5 1.5 0 0 1 4.5 5.5h15A1.5 1.5 0 0 1 21 7v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17ZM3.5 6.5 12 13l8.5-6.5",
  },
  "envelope.fill": {
    fill: "M4.5 5.5A1.5 1.5 0 0 0 3 7v.3l9 6.9 9-6.9V7a1.5 1.5 0 0 0-1.5-1.5Zm16.5 4-9 6.9-9-6.9V17A1.5 1.5 0 0 0 4.5 18.5h15A1.5 1.5 0 0 0 21 17Z",
    rule: "evenodd",
  },
  phone: {
    stroke:
      "M6.6 3.5a1 1 0 0 1 1 .6l1.3 3a1 1 0 0 1-.3 1.1L7.2 9.6a13 13 0 0 0 6 6l1.4-1.4a1 1 0 0 1 1.1-.3l3 1.3a1 1 0 0 1 .6 1V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5.5a2 2 0 0 1 2-2Z",
  },
  "phone.fill": {
    fill: "M6.6 3.5a1 1 0 0 1 1 .6l1.3 3a1 1 0 0 1-.3 1.1L7.2 9.6a13 13 0 0 0 6 6l1.4-1.4a1 1 0 0 1 1.1-.3l3 1.3a1 1 0 0 1 .6 1V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5.5a2 2 0 0 1 2-2Z",
  },
  message: {
    stroke:
      "M4 5.5h16A1.5 1.5 0 0 1 21.5 7v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V16.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z",
  },
  "message.fill": {
    fill: "M3.5 4A1.5 1.5 0 0 0 2 5.5v9A1.5 1.5 0 0 0 3.5 16H4v3.5a.5.5 0 0 0 .8.4L9.5 16h11A1.5 1.5 0 0 0 22 14.5v-9A1.5 1.5 0 0 0 20.5 4Z",
  },
  paperplane: {
    stroke: "M21 3 3 10.5l7 3 3 7Z M21 3 10 13.5",
  },
  "paperplane.fill": {
    fill: "M20.6 3.4a1 1 0 0 1 1 1.2l-3 14a1 1 0 0 1-1.6.6L13 16l-2.8 3.4a.6.6 0 0 1-1-.4V14L19 6 8.6 12.7 3.4 11a1 1 0 0 1 0-1.9l16-6a1 1 0 0 1 1.2.3Z",
  },

  // ── ellipsis ───────────────────────────────────────────────────────────────
  ellipsis: {
    fill: "M5 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM19 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
  },
  "ellipsis.circle": {
    stroke: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    fill: "M8 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM16 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  },

  // ── lines / lists ──────────────────────────────────────────────────────────
  "line.3.horizontal": { stroke: "M4 7h16M4 12h16M4 17h16" },
  "list.bullet": {
    stroke: "M8 7h12M8 12h12M8 17h12",
    fill: "M4 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM4 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM4 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  },
  "text.alignleft": { stroke: "M4 6h16M4 10h10M4 14h16M4 18h10" },
  "square.grid.2x2": {
    stroke:
      "M4 5.5h5.5v5.5H4ZM14.5 5.5H20v5.5h-5.5ZM4 14.5h5.5V20H4ZM14.5 14.5H20V20h-5.5Z",
  },

  // ── lock / wifi / battery ──────────────────────────────────────────────────
  lock: {
    stroke:
      "M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM8 11V8a4 4 0 0 1 8 0v3",
  },
  "lock.fill": {
    fill: "M12 2a4 4 0 0 0-4 4v3H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2V6a4 4 0 0 0-4-4Zm-2 7V6a2 2 0 1 1 4 0v3Z",
    rule: "evenodd",
  },
  wifi: {
    stroke:
      "M3 8.5a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 15.5a4 4 0 0 1 6 0",
    fill: "M12 18.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z",
  },
  "battery.100": {
    stroke:
      "M2.5 8.5A1.5 1.5 0 0 1 4 7h13a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 17 16H4a1.5 1.5 0 0 1-1.5-1.5ZM20.5 10.5v3",
    fill: "M5 9h11v6H5Z",
  },

  // ── audio ──────────────────────────────────────────────────────────────────
  "speaker.wave.2": {
    stroke:
      "M3 9h3l4-3.5v13L6 15H3ZM15 8.5a4 4 0 0 1 0 7M18 6a8 8 0 0 1 0 12",
  },
  "speaker.slash": {
    stroke: "M3 9h3l4-3.5v13L6 15H3ZM16 9l5 6M21 9l-5 6",
  },
  "play.fill": { fill: "M6 4.5v15a1 1 0 0 0 1.5.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 6 4.5Z" },
  "pause.fill": { fill: "M7 4h3v16H7ZM14 4h3v16h-3Z" },
  "stop.fill": { fill: "M5 5h14v14H5Z" },
  "forward.fill": {
    fill: "M3 5.5v13a1 1 0 0 0 1.6.8L12 13v5.5a1 1 0 0 0 1.6.8l8-6.5a1 1 0 0 0 0-1.6l-8-6.5A1 1 0 0 0 12 5.5V11L4.6 4.7A1 1 0 0 0 3 5.5Z",
  },
  "backward.fill": {
    fill: "M21 5.5v13a1 1 0 0 1-1.6.8L12 13v5.5a1 1 0 0 1-1.6.8l-8-6.5a1 1 0 0 1 0-1.6l8-6.5A1 1 0 0 1 12 5.5V11l7.4-6.3A1 1 0 0 1 21 5.5Z",
  },

  // ── weather ────────────────────────────────────────────────────────────────
  "sun.max": {
    stroke:
      "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19",
  },
  moon: {
    stroke:
      "M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z",
  },
  "moon.fill": {
    fill: "M20.4 14.2a.7.7 0 0 0-.8-.9 7 7 0 0 1-8.9-8.9.7.7 0 0 0-.9-.8 8.5 8.5 0 1 0 10.6 10.6Z",
  },
  cloud: {
    stroke:
      "M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 3.5 3.5 0 0 0 7 18Z",
  },
  "cloud.fill": {
    fill: "M7 18.5h10.5a4.5 4.5 0 0 0 .6-9A6.5 6.5 0 0 0 5.6 9 4 4 0 0 0 7 18.5Z",
  },

  // ── location / map ─────────────────────────────────────────────────────────
  location: {
    stroke: "M21 3 3 10.5l7.5 2.5L13 20.5Z",
  },
  "location.fill": {
    fill: "M20.6 3.4a1 1 0 0 0-1-1L3.7 9.6a1 1 0 0 0 .1 1.9l6.4 2 2 6.4a1 1 0 0 0 1.9.1Z",
  },
  map: {
    stroke:
      "M9 4.5 3.5 6v13.5L9 18l6 2 5.5-1.5V5L15 6.5ZM9 4.5V18M15 6.5v13.5",
  },
  "map.fill": {
    fill: "M9 3.8a1 1 0 0 0-.3 0L3.2 5.5A1 1 0 0 0 2.5 6.4v12.8a1 1 0 0 0 1.3 1l4.7-1.4 6 1.9a1 1 0 0 0 .6 0l5.2-1.6a1 1 0 0 0 .7-1V5.4a1 1 0 0 0-1.3-1L15 5.9ZM9 5.9l5.5 1.7v11.3L9 17.2Z",
    rule: "evenodd",
  },

  // ── commerce ───────────────────────────────────────────────────────────────
  cart: {
    stroke:
      "M2.5 4h2l1.5 11a1 1 0 0 0 1 .9h9.6a1 1 0 0 0 1-.8L19 7H6M9 20a1 1 0 1 0 0 .1M17 20a1 1 0 1 0 0 .1",
  },
  "cart.fill": {
    fill: "M2.5 3a1 1 0 0 0 0 2h1.6l1.5 10.7A2 2 0 0 0 7.6 17.5h9.5a1 1 0 0 0 1-.8L19.5 8a1 1 0 0 0-1-1.2H6.3l-.3-2A1 1 0 0 0 5 3ZM9 19a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM16 19a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
  },
  bag: {
    stroke:
      "M6 7h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1ZM8.5 7V6a3.5 3.5 0 0 1 7 0v1",
  },
  "bag.fill": {
    fill: "M8.5 6a3.5 3.5 0 0 1 7 0v1H18l1 12.1a1 1 0 0 1-1 1.1H6a1 1 0 0 1-1-1.1L6 7h2.5Zm2 1h3V6a1.5 1.5 0 0 0-3 0Z",
    rule: "evenodd",
  },
  creditcard: {
    stroke:
      "M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5ZM3 10h18M6.5 14h4",
  },
  tag: {
    stroke:
      "M11 3.5H5.5A2 2 0 0 0 3.5 5.5V11l9 9a1.4 1.4 0 0 0 2 0l5.5-5.5a1.4 1.4 0 0 0 0-2ZM7.5 8a1 1 0 1 0 0-.1",
  },
  "tag.fill": {
    fill: "M11.4 3.1a1.5 1.5 0 0 0-1-.4H5.2A2.5 2.5 0 0 0 2.7 5.2v5.2a1.5 1.5 0 0 0 .4 1l9.3 9.3a1.5 1.5 0 0 0 2.1 0l5.6-5.6a1.5 1.5 0 0 0 0-2.1ZM7 7.7A1 1 0 1 1 7 5.7a1 1 0 0 1 0 2Z",
    rule: "evenodd",
  },

  // ── flags / bookmarks ──────────────────────────────────────────────────────
  flag: {
    stroke: "M5 3v18M5 4h11l-1.5 3.5L16 11H5",
  },
  "flag.fill": {
    fill: "M5 2a1 1 0 0 0-1 1v18a1 1 0 0 0 2 0v-9h9.5a1 1 0 0 0 .9-1.4L15.1 7l1.3-3.6A1 1 0 0 0 15.5 2Z",
  },
  bookmark: {
    stroke: "M6 4.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V5.5a1 1 0 0 1 1-1Z",
  },
  "bookmark.fill": {
    fill: "M6 3a1.5 1.5 0 0 0-1.5 1.5V21a1 1 0 0 0 1.5.86L12 18.2l6 3.66A1 1 0 0 0 19.5 21V4.5A1.5 1.5 0 0 0 18 3Z",
  },

  // ── misc ───────────────────────────────────────────────────────────────────
  paperclip: {
    stroke:
      "M20 11.5 11.5 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9 17.6a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6",
  },
  link: {
    stroke:
      "M9.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1.5 1.5M14.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1.5-1.5",
  },
  eye: {
    stroke:
      "M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  },
  "eye.slash": {
    stroke:
      "M9.9 5.2A10 10 0 0 1 12 5c7 0 10.5 7 10.5 7a18 18 0 0 1-3 3.9M6.5 7A18 18 0 0 0 1.5 12s3.5 7 10.5 7a10 10 0 0 0 3.6-.7M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18",
  },
  mic: {
    stroke:
      "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6",
  },
  "mic.fill": {
    fill: "M12 2.5A3.5 3.5 0 0 0 8.5 6v6a3.5 3.5 0 0 0 7 0V6A3.5 3.5 0 0 0 12 2.5ZM6 11a6 6 0 0 0 5 5.9V20H8.5a1 1 0 0 0 0 2h7a1 1 0 0 0 0-2H13v-3.1A6 6 0 0 0 18 11a1 1 0 0 0-2 0 4 4 0 0 1-8 0 1 1 0 0 0-2 0Z",
  },
  "info.circle": {
    stroke: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v5M12 7.5h.01",
  },
  "info.circle.fill": {
    fill: "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21ZM11 10.5h2v6h-2ZM12 6.4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z",
    rule: "evenodd",
  },
  "exclamationmark.triangle": {
    stroke:
      "M10.3 3.9 1.8 18.5A2 2 0 0 0 3.5 21.5h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v5M12 17.5h.01",
  },
  "exclamationmark.triangle.fill": {
    fill: "M10.3 3.9a2 2 0 0 1 3.4 0l8.5 14.6a2 2 0 0 1-1.7 3h-17a2 2 0 0 1-1.7-3ZM11 9v5h2V9Zm0 6.5V18h2v-2.5Z",
    rule: "evenodd",
  },
  "questionmark.circle": {
    stroke:
      "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.5 9.2A2.5 2.5 0 0 1 14.5 9.5c0 1.7-2.5 2.2-2.5 4M12 16.5h.01",
  },
  questionmark: {
    stroke: "M8.5 8.7A3.5 3.5 0 0 1 15.5 9c0 2.3-3.5 3-3.5 5.5M12 19h.01",
  },
  gift: {
    stroke:
      "M4 11h16v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1ZM3.5 7.5h17a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 1-.5.5h-17A.5.5 0 0 1 3 10.5V8a.5.5 0 0 1 .5-.5ZM12 7.5V20M12 7.5C12 5.5 10.5 4 8.7 4A2.2 2.2 0 0 0 12 7.5ZM12 7.5C12 5.5 13.5 4 15.3 4A2.2 2.2 0 0 1 12 7.5Z",
  },
  bold: {
    stroke:
      "M6 4h7a4 4 0 0 1 0 8H6ZM6 12h8a4 4 0 0 1 0 8H6Z",
    square: true,
  },
  italic: { stroke: "M10 4h8M6 20h8M14.5 4 9.5 20", square: true },
  underline: { stroke: "M7 4v7a5 5 0 0 0 10 0V4M5 21h14", square: true },
  applelogo: {
    fill: "M17.05 12.5c0-2.4 1.95-3.55 2.04-3.6a4.4 4.4 0 0 0-3.46-1.87c-1.47-.15-2.87.86-3.62.86-.75 0-1.9-.84-3.12-.82a4.6 4.6 0 0 0-3.88 2.36c-1.66 2.88-.42 7.13 1.2 9.46.79 1.14 1.74 2.42 2.98 2.37 1.2-.05 1.65-.77 3.1-.77 1.44 0 1.85.77 3.11.75 1.28-.02 2.1-1.16 2.89-2.31a9.6 9.6 0 0 0 1.3-2.68 4.18 4.18 0 0 1-2.54-3.83ZM14.7 5.45A4.1 4.1 0 0 0 15.66 2.5a4.18 4.18 0 0 0-2.7 1.4 3.9 3.9 0 0 0-.99 2.83 3.46 3.46 0 0 0 2.73-1.28Z",
  },
};

/** A neutral rounded-square placeholder ("generic app icon") for unmapped names. */
export const FALLBACK_GLYPH: GlyphGeometry = {
  stroke:
    "M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z",
};

/* ---------------------------------------------------------------------------
 * Resolution
 * ------------------------------------------------------------------------- */

/** Variant suffix order so a `.circle.fill` lookup can decay to `.fill`→base. */
const VARIANT_SUFFIXES = ["fill", "slash", "circle", "square", "rectangle"];

/**
 * Resolve a symbol name to its geometry, decaying through variant suffixes so a
 * partial map still renders something sensible (e.g. `gearshape.circle.fill`
 * → `gearshape.fill` → `gearshape`). Returns `null` if nothing matches.
 */
export function resolveGlyph(name: string): GlyphGeometry | null {
  if (SF_SYMBOLS[name]) return SF_SYMBOLS[name];

  const parts = name.split(".");
  // Progressively drop trailing variant suffixes.
  for (let end = parts.length; end > 0; end--) {
    const candidate = parts.slice(0, end).join(".");
    if (SF_SYMBOLS[candidate]) return SF_SYMBOLS[candidate];
    // also try the candidate with a `.fill` if the base has a fill twin
    if (parts.slice(end).includes("fill") && SF_SYMBOLS[`${candidate}.fill`]) {
      return SF_SYMBOLS[`${candidate}.fill`];
    }
  }

  // Last resort: strip every known variant suffix and try the bare base.
  const base = parts.filter((p) => !VARIANT_SUFFIXES.includes(p)).join(".");
  if (base && SF_SYMBOLS[base]) return SF_SYMBOLS[base];

  return null;
}

/** True iff the map (or its variant decay) can render this name without fallback. */
export function hasGlyph(name: string): boolean {
  return resolveGlyph(name) != null;
}
