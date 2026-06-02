/**
 * ui-system — UI / system / navigation / action SF Symbols → open-icon geometry.
 *
 * A DESIGNED approximation of ~110 of Apple's most-used UI/system glyphs (the
 * navigation chrome, action bars, settings, toolbars, and status marks that a
 * SwiftUI app reaches for constantly). SF Symbols are a proprietary Apple glyph
 * database we legally cannot ship, so each SF Symbol *name* maps to a
 * visually-equivalent OPEN icon re-authored on a 24×24 grid from
 * permissively-licensed geometry (Lucide / Bootstrap-Icons / Phosphor
 * silhouettes). Goal: iOS-like layout + instant recognizability, not a
 * pixel-trace of Apple's assets.
 *
 * Conventions (shared with the parent `sf-symbols-map.ts` renderer):
 *   - `viewBox` is always "0 0 24 24"; paint is `currentColor`.
 *   - STROKE glyphs ⇒ `{ stroke }` (fill:none, stroke:currentColor, width = weight).
 *   - FILL glyphs   ⇒ `{ fill }`  (fill:currentColor).
 *   - A glyph may carry BOTH (outline circle + inner mark); both emit in order.
 *   - `rule: "evenodd"` opts a fill into even-odd winding (donut / knockout).
 *
 * Pure data, no React, SSR-safe. Spread into the main map (or queried directly
 * by `resolveGlyph`'s variant-decay).
 */

import type { GlyphGeometry } from "../sf-symbols-map";

/** A round-cap stroke-only glyph (chevrons, arrows, the simple marks). */
const STROKE = (d: string): GlyphGeometry => ({ stroke: d });

/** A standard 24-grid circle outline, reused as the base of `.circle` variants. */
const CIRCLE = "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";
/** A standard 10.5-radius solid disc, reused as the base of `.circle.fill`. */
const DISC =
  "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Z";

export const UI_SYSTEM_SYMBOLS: Record<string, GlyphGeometry> = {
  // ── house ──────────────────────────────────────────────────────────────────
  house: {
    stroke:
      "M3 11.5 12 4l9 7.5M5.2 9.8V19a1 1 0 0 0 1 1H10v-5h4v5h3.8a1 1 0 0 0 1-1V9.8",
  },
  "house.fill": {
    fill: "M11.3 3.5a1 1 0 0 1 1.4 0l8.6 7.6a.8.8 0 0 1-.5 1.4H20V19a1.5 1.5 0 0 1-1.5 1.5H14.5V15a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v5.5H5.5A1.5 1.5 0 0 1 4 19v-6.5h-1.8a.8.8 0 0 1-.5-1.4Z",
  },

  // ── gearshape / gear ────────────────────────────────────────────────────────
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
  "gearshape.2": {
    stroke:
      "M14.5 14a1.4 1.4 0 0 0 .28 1.55l.05.05a1.7 1.7 0 1 1-2.4 2.4l-.05-.05a1.4 1.4 0 0 0-1.55-.28 1.4 1.4 0 0 0-.85 1.28V19a1.7 1.7 0 0 1-3.4 0v-.05a1.4 1.4 0 0 0-.92-1.28 1.4 1.4 0 0 0-1.55.28l-.05.05a1.7 1.7 0 1 1-2.4-2.4l.05-.05a1.4 1.4 0 0 0 .28-1.55 1.4 1.4 0 0 0-1.28-.85H.23a1.7 1.7 0 0 1 0-3.4h.05a1.4 1.4 0 0 0 1.28-.92 1.4 1.4 0 0 0-.28-1.55l-.05-.05a1.7 1.7 0 1 1 2.4-2.4l.05.05a1.4 1.4 0 0 0 1.55.28H5.3a1.4 1.4 0 0 0 .85-1.28V4.23a1.7 1.7 0 0 1 3.4 0v.05a1.4 1.4 0 0 0 .85 1.28 1.4 1.4 0 0 0 1.55-.28l.05-.05a1.7 1.7 0 1 1 2.4 2.4M11 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M19.5 11a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z",
  },

  // ── person ──────────────────────────────────────────────────────────────────
  person: {
    stroke: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0",
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
  "person.badge.plus": {
    stroke:
      "M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 20.5a7 7 0 0 1 12.5-4.3M18 14v6M15 17h6",
  },

  // ── bell ────────────────────────────────────────────────────────────────────
  bell: {
    stroke: "M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 19a2 2 0 0 0 4 0",
  },
  "bell.fill": {
    fill: "M12 2.5A6 6 0 0 0 6 8.5c0 4.5-1.6 5.8-2.4 6.4a1 1 0 0 0 .6 1.8h15.6a1 1 0 0 0 .6-1.8C19.6 14.3 18 13 18 8.5a6 6 0 0 0-6-6ZM10 19a2 2 0 0 0 4 0Z",
  },
  "bell.slash": {
    stroke:
      "M6 9a6 6 0 0 1 9.5-4.9M18 12c.4 2 1 2.5 2 3H8M10 19a2 2 0 0 0 4 0M3 3l18 18",
  },
  "bell.badge": {
    stroke:
      "M19 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M16 4.4A6 6 0 0 0 6 9c0 5-2 6-2 6h16s-1.4-.7-1.8-4M10 19a2 2 0 0 0 4 0",
    fill: "M19 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z",
  },

  // ── search ──────────────────────────────────────────────────────────────────
  magnifyingglass: {
    stroke: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5",
  },
  "plus.magnifyingglass": {
    stroke: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5M7.5 10.5h6M10.5 7.5v6",
  },
  "minus.magnifyingglass": {
    stroke: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5M7.5 10.5h6",
  },

  // ── plus / minus ────────────────────────────────────────────────────────────
  plus: { stroke: "M12 5v14M5 12h14" },
  "plus.circle": { stroke: `${CIRCLE}M12 8v8M8 12h8` },
  "plus.circle.fill": {
    fill: `${DISC}M13 7v4h4v2h-4v4h-2v-4H7v-2h4V7Z`,
    rule: "evenodd",
  },
  "plus.app": {
    stroke:
      "M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5ZM12 8v8M8 12h8",
  },
  "plus.rectangle": {
    stroke:
      "M3.5 6A1.5 1.5 0 0 1 5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18ZM12 8.5v7M8.5 12h7",
  },
  minus: { stroke: "M5 12h14" },
  "minus.circle": { stroke: `${CIRCLE}M8 12h8` },

  // ── xmark ───────────────────────────────────────────────────────────────────
  xmark: { stroke: "M6 6l12 12M18 6 6 18" },
  "xmark.circle": { stroke: `${CIRCLE}M9 9l6 6M15 9l-6 6` },
  "xmark.circle.fill": {
    fill: `${DISC}M8.5 7.1 12 10.6l3.5-3.5 1.4 1.4L13.4 12l3.5 3.5-1.4 1.4L12 13.4l-3.5 3.5-1.4-1.4L10.6 12 7.1 8.5Z`,
    rule: "evenodd",
  },

  // ── checkmark ───────────────────────────────────────────────────────────────
  checkmark: { stroke: "M5 12.5 9.5 17 19 7" },
  "checkmark.circle": { stroke: `${CIRCLE}M8 12l2.8 2.8L16 9` },
  "checkmark.circle.fill": {
    fill: "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm5 7.7-6 6.1-3.4-3.4 1.4-1.4 2 2 4.6-4.7Z",
    rule: "evenodd",
  },
  "checkmark.seal": {
    stroke:
      "M9.6 3.3a3 3 0 0 1 4.8 0 3 3 0 0 0 2 .8 3 3 0 0 1 3.4 3.4 3 3 0 0 0 .8 2 3 3 0 0 1 0 4.8 3 3 0 0 0-.8 2 3 3 0 0 1-3.4 3.4 3 3 0 0 0-2 .8 3 3 0 0 1-4.8 0 3 3 0 0 0-2-.8 3 3 0 0 1-3.4-3.4 3 3 0 0 0-.8-2 3 3 0 0 1 0-4.8 3 3 0 0 0 .8-2 3 3 0 0 1 3.4-3.4 3 3 0 0 0 2-.8ZM8.5 12l2.5 2.5L15.5 10",
  },
  "checkmark.shield": {
    stroke:
      "M12 3.2 5 6v5c0 4.5 3 7.8 7 9.3 4-1.5 7-4.8 7-9.3V6ZM8.8 12l2.2 2.2L15.4 10",
  },

  // ── chevrons ────────────────────────────────────────────────────────────────
  "chevron.right": STROKE("M9 5l7 7-7 7"),
  "chevron.left": STROKE("M15 5l-7 7 7 7"),
  "chevron.up": STROKE("M5 15l7-7 7 7"),
  "chevron.down": STROKE("M5 9l7 7 7-7"),
  "chevron.forward": STROKE("M9 5l7 7-7 7"),
  "chevron.backward": STROKE("M15 5l-7 7 7 7"),
  "chevron.up.chevron.down": { stroke: "M7 9l5-5 5 5M7 15l5 5 5-5" },

  // ── arrows ──────────────────────────────────────────────────────────────────
  "arrow.up": { stroke: "M12 19V5M5 12l7-7 7 7" },
  "arrow.down": { stroke: "M12 5v14M5 12l7 7 7-7" },
  "arrow.left": { stroke: "M19 12H5M12 5l-7 7 7 7" },
  "arrow.right": { stroke: "M5 12h14M12 5l7 7-7 7" },
  "arrow.up.arrow.down": { stroke: "M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" },
  "arrow.clockwise": {
    stroke: "M20 7a8 8 0 1 0 1.4 6M20 4v3.5a.5.5 0 0 1-.5.5H16",
  },
  "arrow.counterclockwise": {
    stroke: "M4 7a8 8 0 1 1-1.4 6M4 4v3.5a.5.5 0 0 0 .5.5H8",
  },
  "arrow.uturn.left": {
    stroke: "M9 4 4 9l5 5M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5h-3",
  },
  "arrow.up.arrow.down.circle": {
    stroke: `${CIRCLE}M9 8v8M9 16l-2-2M9 16l2-2M15 16V8M15 8l-2 2M15 8l2 2`,
  },
  "arrow.triangle.2.circlepath": {
    stroke:
      "M20 8a8 8 0 0 0-13.7-2.4L4 8M4 4v4h4M4 16a8 8 0 0 0 13.7 2.4L20 16M20 20v-4h-4",
  },

  // ── ellipsis / overflow ─────────────────────────────────────────────────────
  ellipsis: {
    fill: "M5 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM19 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
  },
  "ellipsis.circle": {
    stroke: CIRCLE,
    fill: "M8 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM16 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  },

  // ── lines / filters / lists ─────────────────────────────────────────────────
  "line.3.horizontal": { stroke: "M4 7h16M4 12h16M4 17h16" },
  "line.3.horizontal.decrease": { stroke: "M4 7h16M6 12h12M9 17h6" },
  "slider.horizontal.3": {
    stroke:
      "M4 7h10M18 7h2M4 12h2M10 12h10M4 17h10M18 17h2 M14 5v4M6 10v4M14 15v4",
  },
  "list.bullet": {
    stroke: "M8 7h12M8 12h12M8 17h12",
    fill: "M4 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM4 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM4 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  },
  "list.dash": { stroke: "M3 7h2M3 12h2M3 17h2M8 7h12M8 12h12M8 17h12" },
  "list.number": {
    stroke: "M9 7h11M9 12h11M9 17h11M4 5v3.5M4 8.5h-.8M3.4 12h1.2l-1.4 2.5h1.4M3.2 17h1.6v1.5H3.4v1.5h1.4",
  },
  "rectangle.grid.1x2": {
    stroke:
      "M4.5 4.5h15A1 1 0 0 1 20.5 5.5v4a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-4A1 1 0 0 1 4.5 4.5ZM4.5 13.5h15a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-4A1 1 0 0 1 4.5 13.5Z",
  },

  // ── grids ───────────────────────────────────────────────────────────────────
  "square.grid.2x2": {
    stroke:
      "M4 5.5h5.5v5.5H4ZM14.5 5.5H20v5.5h-5.5ZM4 14.5h5.5V20H4ZM14.5 14.5H20V20h-5.5Z",
  },
  "square.grid.2x2.fill": {
    fill: "M4 4.5h6v6H4ZM14 4.5h6v6h-6ZM4 14.5h6v6H4ZM14 14.5h6v6h-6Z",
  },
  "square.grid.3x3": {
    stroke:
      "M3.5 4h4v4h-4ZM10 4h4v4h-4ZM16.5 4h4v4h-4ZM3.5 10h4v4h-4ZM10 10h4v4h-4ZM16.5 10h4v4h-4ZM3.5 16h4v4h-4ZM10 16h4v4h-4ZM16.5 16h4v4h-4Z",
  },

  // ── sidebars / panels ───────────────────────────────────────────────────────
  "sidebar.left": {
    stroke:
      "M4 6A1.5 1.5 0 0 1 5.5 4.5h13A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18ZM9 4.5v15",
  },
  "sidebar.right": {
    stroke:
      "M4 6A1.5 1.5 0 0 1 5.5 4.5h13A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18ZM15 4.5v15",
  },

  // ── trash ───────────────────────────────────────────────────────────────────
  trash: {
    stroke:
      "M4 6h16M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 6l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 10v6M14 10v6",
  },
  "trash.fill": {
    fill: "M9 3a1 1 0 0 0-1 1v1H4v2h1l1 13.1A1 1 0 0 0 7 21h10a1 1 0 0 0 1-.9L19 7h1V5h-4V4a1 1 0 0 0-1-1Zm1 7h1.5v8H10Zm4.5 0H16v8h-1.5Z",
    rule: "evenodd",
  },
  "trash.slash": {
    stroke:
      "M4 6h4M11 6h9M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.2 8.2 7 19a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l.5-7M3 3l18 18",
  },

  // ── pencil / edit ───────────────────────────────────────────────────────────
  pencil: { stroke: "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" },
  "pencil.circle": {
    stroke: `${CIRCLE}M14.5 7.5a1.4 1.4 0 0 1 2 2L10 16l-2.7.7.7-2.7Z`,
  },
  "square.and.pencil": {
    stroke:
      "M16 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h12A1.5 1.5 0 0 0 19.5 18V9M14.5 3.5a2 2 0 0 1 2.8 2.8L11 12.6l-3 .7.7-3Z",
  },

  // ── share ───────────────────────────────────────────────────────────────────
  "square.and.arrow.up": {
    stroke:
      "M12 3l4 4M12 3 8 7M12 3v12M7 10H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1",
  },
  "square.and.arrow.down": {
    stroke:
      "M12 15 8 11M12 15l4-4M12 15V3M7 10H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1",
  },

  // ── shapes ──────────────────────────────────────────────────────────────────
  "rectangle.portrait": {
    stroke:
      "M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5A1.5 1.5 0 0 1 6.5 3.5Z",
  },

  // ── touch / pointer / draw ──────────────────────────────────────────────────
  "hand.tap": {
    stroke:
      "M8 11V6a2 2 0 0 1 4 0v5M12 9.5a1.8 1.8 0 0 1 3.5.5M15.5 11a1.8 1.8 0 0 1 3.5.5v3.5a5 5 0 0 1-5 5h-1.5a5 5 0 0 1-3.6-1.5l-3.4-3.5a1.8 1.8 0 0 1 2.6-2.5L8 14V9.5a1.8 1.8 0 0 1 3.5 0",
  },
  "hand.draw": {
    stroke:
      "M9 11.5V5.5a1.75 1.75 0 0 1 3.5 0v5M12.5 9a1.75 1.75 0 0 1 3.5 0v1.5M16 10.5a1.75 1.75 0 0 1 3.5 0v4a5.5 5.5 0 0 1-5.5 5.5h-1a5.5 5.5 0 0 1-4-1.7l-3.8-4a1.75 1.75 0 0 1 2.5-2.5L9 13V9a1.75 1.75 0 0 1 3.5 0",
  },
  cursorarrow: {
    stroke: "M5 3l4.5 16 2.6-6.3 6.4-2.6Z",
  },

  // ── gauge / switches / dials / power ────────────────────────────────────────
  gauge: {
    stroke:
      "M3.5 18a9 9 0 1 1 17 0M12 13l4-4M12 13a1.4 1.4 0 1 0 0-.1",
  },
  "switch.2": {
    stroke:
      "M3 8a4 4 0 0 1 4-4h10a4 4 0 0 1 0 8H7a4 4 0 0 1-4-4ZM17 16a4 4 0 0 1 0 8H7a4 4 0 0 1-4-4 4 4 0 0 1 4-4M16 8a1 1 0 1 0 0-.1M8 20a1 1 0 1 0 0-.1",
  },
  "dial.min": {
    stroke:
      "M3.5 18a9 9 0 1 1 17 0M12 12 7.5 8.5M12 12a1.3 1.3 0 1 0 0-.1",
  },
  power: { stroke: "M12 3v8M7.5 6.5a7 7 0 1 0 9 0" },

  // ── lock / key / biometrics ─────────────────────────────────────────────────
  lock: {
    stroke:
      "M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM8 11V8a4 4 0 0 1 8 0v3",
  },
  "lock.fill": {
    fill: "M12 2a4 4 0 0 0-4 4v3H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2V6a4 4 0 0 0-4-4Zm-2 7V6a2 2 0 1 1 4 0v3Z",
    rule: "evenodd",
  },
  "lock.open": {
    stroke:
      "M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM8 11V8a4 4 0 0 1 7.6-1.8",
  },
  key: {
    stroke:
      "M14.5 3a6 6 0 1 0 2.7 11.4L19 16.2 21 14.2l-1.8-1.8 1.8-1.8-1.8-1.8A6 6 0 0 0 14.5 3ZM12.5 9a1 1 0 1 0 0-.1",
  },
  "key.fill": {
    fill: "M14.5 2.5a6.5 6.5 0 0 0-6.2 8.5L2.8 16.5a1 1 0 0 0-.3.7V20a1 1 0 0 0 1 1h2.8a1 1 0 0 0 .7-.3l.8-.8a1 1 0 0 0 .3-.7v-1.2h1.2a1 1 0 0 0 .7-.3l1-1a1 1 0 0 0 .3-.7v-1.3l1-1a1 1 0 0 0 .2 0 6.5 6.5 0 1 0 .7-12.9ZM16.5 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z",
    rule: "evenodd",
  },
  faceid: {
    stroke:
      "M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16M8.5 9v2M15.5 9v2M12 9v3.5h-1.2M9 15a4 4 0 0 0 6 0",
  },
  touchid: {
    stroke:
      "M5.5 10a8 8 0 0 1 13 0M8 11a4.2 4.2 0 0 1 8 0v1.5M8 14.5v1A4 4 0 0 0 12 19.5M12 11v4a2 2 0 0 0 2 2M15.8 13.5v1.5a4 4 0 0 1-.5 2",
  },

  // ── eye ─────────────────────────────────────────────────────────────────────
  eye: {
    stroke:
      "M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  },
  "eye.fill": {
    fill: "M12 5C5 5 1.5 12 1.5 12S5 19 12 19s10.5-7 10.5-7S19 5 12 5Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    rule: "evenodd",
  },
  "eye.slash": {
    stroke:
      "M9.9 5.2A10 10 0 0 1 12 5c7 0 10.5 7 10.5 7a18 18 0 0 1-3 3.9M6.5 7A18 18 0 0 0 1.5 12s3.5 7 10.5 7a10 10 0 0 0 3.6-.7M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18",
  },

  // ── status marks: question / exclamation / info ─────────────────────────────
  questionmark: {
    stroke: "M8.5 8.7A3.5 3.5 0 0 1 15.5 9c0 2.3-3.5 3-3.5 5.5M12 19h.01",
  },
  "questionmark.circle": {
    stroke: `${CIRCLE}M9.5 9.2A2.5 2.5 0 0 1 14.5 9.5c0 1.7-2.5 2.2-2.5 4M12 16.5h.01`,
  },
  "questionmark.circle.fill": {
    fill: "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21ZM12 6.2a3.4 3.4 0 0 1 3.4 3.4c0 1.6-1 2.3-1.8 2.8-.7.5-1 .8-1 1.6v.3h-2v-.4c0-1.7 1-2.4 1.7-2.9.6-.4 1-.7 1-1.4a1.3 1.3 0 1 0-2.6 0H8.6A3.4 3.4 0 0 1 12 6.2ZM12 16a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z",
    rule: "evenodd",
  },
  exclamationmark: { stroke: "M12 4v10M12 19h.01" },
  "exclamationmark.circle": { stroke: `${CIRCLE}M12 7v6M12 16.5h.01` },
  "exclamationmark.triangle": {
    stroke:
      "M10.3 3.9 1.8 18.5A2 2 0 0 0 3.5 21.5h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v5M12 17.5h.01",
  },
  "exclamationmark.triangle.fill": {
    fill: "M10.3 3.9a2 2 0 0 1 3.4 0l8.5 14.6a2 2 0 0 1-1.7 3h-17a2 2 0 0 1-1.7-3ZM11 9v5h2V9Zm0 6.5V18h2v-2.5Z",
    rule: "evenodd",
  },
  "info.circle": { stroke: `${CIRCLE}M12 11v5M12 7.5h.01` },
  "info.circle.fill": {
    fill: `${DISC}M11 10.5h2v6h-2ZM12 6.4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z`,
    rule: "evenodd",
  },

  // ── tools ───────────────────────────────────────────────────────────────────
  wrench: {
    stroke:
      "M14.5 6.5a4 4 0 0 0 5.2 5.2l-2-2 .8-3.2-3.2.8-2-2A4 4 0 0 0 14.5 6.5ZM11.7 9.3 4.4 16.6a2 2 0 0 0 2.8 2.8l7.3-7.3",
  },
  "wrench.and.screwdriver": {
    stroke:
      "M13.5 6.5a3.5 3.5 0 0 0 4.6 4.6l-1.8-1.8.7-2.8-2.8.7ZM12.2 8.8 4 17a2 2 0 0 0 2.8 2.8l7.5-7.5M16 13l4 4a2 2 0 0 1-2.8 2.8l-2.4-2.4M5.5 4 4 5.5l4 4 1.5-1.5L9 6.5h2L9.5 4Z",
  },
  hammer: {
    stroke:
      "M14 6 9 11M14 6l2-2a2.8 2.8 0 0 1 4 4l-2 2M14 6l4 4M9 11l-5.8 5.8a1.8 1.8 0 0 0 2.5 2.5L11.5 13.5",
  },
  paintbrush: {
    stroke:
      "M14 8 9.5 12.5a3 3 0 0 1-.5 4.8c-1.5 1-4 1.2-6 1 1-1 1-2 1.2-3.2A3 3 0 0 1 9 11.5L13.5 7M14 8l3-3a2.1 2.1 0 0 1 3 3l-3 3M14 8l3 3",
  },
  scissors: {
    stroke:
      "M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM7 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8.8 8.2 20 19M8.8 15.8 20 5M9 12l3 2.4",
  },
};
