/**
 * Chart symbol shapes — SwiftUI Cluster C9 §19.4.
 *
 *   BasicChartSymbolShape: .circle .square .triangle .diamond .pentagon
 *                          .plus .cross .asterisk    // Charts:1810-1828
 *
 * The built-in point-mark glyphs for scatter/line marks. Each is a `Shape` with
 * a `perceptualUnitRect` so glyphs of different shapes read as the same visual
 * weight. Web: a lookup of 8 fixed `d`-strings on a unit (0..1) viewBox, centered
 * at (0.5,0.5). Scale by the symbol's relative `weight` so areas match.
 *
 * Pure data — server-compatible.
 */

export type ChartSymbolName =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "plus"
  | "cross"
  | "asterisk";

/**
 * Unit-box `d` strings (viewBox 0 0 1 1), centered at (0.5,0.5). Sized to roughly
 * matched perceptual area (circle/square baseline; thin glyphs slightly larger).
 */
export const CHART_SYMBOL_PATHS: Record<ChartSymbolName, string> = {
  // circle r=0.5
  circle: "M0 0.5A0.5 0.5 0 1 0 1 0.5A0.5 0.5 0 1 0 0 0.5Z",
  // square full box
  square: "M0 0H1V1H0Z",
  // upward triangle
  triangle: "M0.5 0L1 0.9H0L0.5 0Z",
  // diamond
  diamond: "M0.5 0L1 0.5L0.5 1L0 0.5Z",
  // regular pentagon (point up)
  pentagon:
    "M0.5 0L0.976 0.345L0.794 0.905H0.206L0.024 0.345Z",
  // plus / cross-bar (thick +)
  plus: "M0.35 0H0.65V0.35H1V0.65H0.65V1H0.35V0.65H0V0.35H0.35Z",
  // X cross
  cross:
    "M0.15 0L0.5 0.35L0.85 0L1 0.15L0.65 0.5L1 0.85L0.85 1L0.5 0.65L0.15 1L0 0.85L0.35 0.5L0 0.15Z",
  // asterisk (6-arm thin star approximated by 3 crossing bars)
  asterisk:
    "M0.44 0H0.56V0.38L0.89 0.19L0.95 0.29L0.62 0.48L0.95 0.67L0.89 0.77L0.56 0.58V1H0.44V0.58L0.11 0.77L0.05 0.67L0.38 0.48L0.05 0.29L0.11 0.19L0.44 0.38Z",
};

/**
 * Relative perceptual weight (area scale) per symbol so they look equal-weight
 * — circle/square = 1.0 baseline; thin glyphs scaled up (`perceptualUnitRect`).
 */
export const CHART_SYMBOL_WEIGHT: Record<ChartSymbolName, number> = {
  circle: 1.0,
  square: 0.9,
  triangle: 1.1,
  diamond: 1.15,
  pentagon: 1.05,
  plus: 1.2,
  cross: 1.25,
  asterisk: 1.3,
};
