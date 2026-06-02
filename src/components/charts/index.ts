/**
 * Swift Charts → Web (SVG) — Cluster C14 barrel.
 * RE'd from `teardowns/SWIFTUI_C14_charts.md`.
 *
 * A declarative chart kit mirroring Swift Charts' grammar-of-graphics API
 * (`Chart { … marks … }`) rendered as an SVG layer (scales → SVG coordinates).
 */
export { Chart } from "./Chart";
export type { ChartProps, ChartPlotPadding } from "./Chart";

export { BarMark } from "./BarMark";
export type { BarMarkProps } from "./BarMark";
export { LineMark } from "./LineMark";
export type { LineMarkProps } from "./LineMark";
export { PointMark } from "./PointMark";
export type { PointMarkProps } from "./PointMark";
export { AreaMark } from "./AreaMark";
export type { AreaMarkProps } from "./AreaMark";
export { RuleMark } from "./RuleMark";
export type { RuleMarkProps } from "./RuleMark";
export { RectangleMark } from "./RectangleMark";
export type { RectangleMarkProps } from "./RectangleMark";
export { SectorMark } from "./SectorMark";
export type { SectorMarkProps } from "./SectorMark";

export { ChartOverlay, ChartBackground } from "./ChartProxy";
export type { ChartProxy, ChartProxyChildren } from "./ChartProxy";

export { Legend } from "./Legend";
export { AxisLayer } from "./Axis";

// data-binding primitives + value types
export {
  v,
  plottableKind,
  plottableNumber,
  plottableKey,
  isPlottable,
  resolveDim,
  MarkDimension,
  InterpolationMethod,
  DEFAULT_PADDING_INNER,
} from "./types";
export type {
  PlottableValue,
  PlottableKind,
  ValueOrNumber,
  StackingMethod,
  Interp,
  StrokeStyle,
  ScaleType,
  ScaleSpec,
  StyleScaleSpec,
  SymbolScaleSpec,
  BasicSymbol,
  AnnotationPosition,
  AnnotationSpec,
  AxisMarkPosition,
  AxisMarkValues,
  LabelOrientation,
  Collision,
  AxisGridLineSpec,
  AxisTickSpec,
  AxisValueLabelSpec,
  AxisSpec,
  LegendSpec,
  LegendOption,
  Scale,
} from "./types";

// scale engine (for advanced/custom use)
export {
  DEFAULT_PALETTE,
  PALETTE_TOKENS,
  paletteColor,
  niceTicks,
  ticksForValues,
  buildScale,
  stack,
  makeStyleScale,
  makeSymbolScale,
  makeGradientScale,
} from "./scales";

// svg path generators
export {
  linePath,
  areaPath,
  symbolPath,
  annularSectorPath,
  stepPath,
  cardinalPath,
  catmullRomPath,
  monotonePath,
} from "./paths";
export type { Pt } from "./paths";

export { ChartContext, useChart } from "./context";
export type { ChartCtx, ChartRender, ChartCollector, CollectedMark } from "./context";
