"use client";
/**
 * `<Chart>` — the Swift Charts container (§0).
 *
 * Owns the `<svg>`, computes scales from the union of every mark's plottable
 * values, lays out the plot rectangle inset by the axis gutters, and exposes
 * `{ xScale, yScale, plot, styleScale, symbolScale }` via `ChartContext` so each
 * mark positions itself. Mirrors Charts' two-phase
 * `_collect…`→`_layout…`→`_render…` as a single React render with a COLLECT pass
 * (marks register their channels) followed by a RENDER pass.
 *
 * Three constructor shapes (§0.1):
 *   <Chart>{…marks…}</Chart>                         // static ChartContentBuilder
 *   <Chart data={rows}>{(row)=> …}</Chart>           // Chart(data){ row in … }
 *   <Chart data={rows} id={r=>r.id}>{(row)=> …}</Chart>
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import { useEnvironment } from "../../system/environment";
import {
  ChartContext,
  type CollectedMark,
  type ChartCollector,
  type ChartRender,
} from "./context";
import {
  buildScale,
  emptyChannel,
  makeGradientScale,
  makeStyleScale,
  makeSymbolScale,
  observe,
  stack,
  type ChannelInfo,
  type StackRow,
} from "./scales";
import { AxisLayer } from "./Axis";
import { Legend } from "./Legend";
import {
  type AxisSpec,
  type LegendOption,
  type ScaleSpec,
  type StyleScaleSpec,
  type SymbolScaleSpec,
  plottableKey,
  plottableNumber,
  isPlottable,
} from "./types";

export interface ChartPlotPadding {
  leading?: number;
  trailing?: number;
  top?: number;
  bottom?: number;
}

/**
 * `chartPlotStyle { plotContent in … }` — style the plot rectangle itself (the
 * drawing area inside the axes). On the web this is the cheap subset the modifier
 * is used for: a background fill, a border, and a corner radius around the plot.
 */
export interface ChartPlotStyle {
  /** Fill behind the marks (CSS color). */
  background?: string;
  /** Border around the plot rect (CSS color). */
  borderColor?: string;
  /** Border width in px (default 1 when `borderColor` set). */
  borderWidth?: number;
  /** Corner radius of the plot rect (px). */
  cornerRadius?: number;
}

export interface ChartProps extends Omit<ViewProps, "children" | "id"> {
  /** Data-driven form: `Chart(data){ row in … }`. Omit for static children. */
  data?: readonly unknown[];
  /** `id: keyPath` for the data-driven `ForEach`. */
  id?: (row: unknown, index: number) => string | number;
  /** ChartContentBuilder closure or static marks. */
  children: React.ReactNode | ((row: unknown, index: number) => React.ReactNode);

  // scale + axis overrides (resolved from props or <Chart.XAxis/> children)
  xScale?: ScaleSpec;
  yScale?: ScaleSpec;
  foregroundStyleScale?: StyleScaleSpec;
  symbolScale?: SymbolScaleSpec;
  xAxis?: AxisSpec | "hidden" | "visible";
  yAxis?: AxisSpec | "hidden" | "visible";
  xAxisLabel?: string;
  yAxisLabel?: string;
  legend?: LegendOption;
  plotPadding?: ChartPlotPadding;
  /** `chartPlotStyle { … }` — background/border/corner for the plot rectangle. */
  plotStyle?: ChartPlotStyle;

  /** `chartXSelection(value:)` — selected x domain key. §13 */
  xSelection?: { value: unknown; onChange?: (value: unknown) => void };
  /** `chartYSelection(value:)` — selected y value (pointer y → yScale.invert). §13 */
  ySelection?: { value: unknown; onChange?: (value: unknown) => void };
}

/** Default gutters sized to fit a 12px caption tick label (§0.4, DESIGNED). */
const GUTTER_LEADING = 40;
const GUTTER_BOTTOM = 28;
const PAD_TOP = 8;
const PAD_TRAILING = 12;

function normalizeAxis(a: AxisSpec | "hidden" | "visible" | undefined): AxisSpec {
  if (a === "hidden") return { visibility: "hidden" };
  if (a === "visible") return { visibility: "visible" };
  return a ?? {};
}

export function Chart({
  data,
  id,
  children,
  xScale: xScaleSpec,
  yScale: yScaleSpec,
  foregroundStyleScale,
  symbolScale,
  xAxis,
  yAxis,
  xAxisLabel,
  yAxisLabel,
  legend = "automatic",
  plotPadding,
  plotStyle,
  xSelection,
  ySelection,
  ...viewProps
}: ChartProps) {
  const env = useEnvironment();
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<{ width: number; height: number }>({
    width: 320,
    height: 200,
  });

  // ResizeObserver — measure device pixels for crisp strokes (§0.4 note).
  React.useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const r = e.contentRect;
        if (r.width > 0 && r.height > 0) {
          setSize({ width: r.width, height: r.height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- resolve children into a flat element list (data-driven → map) -------
  const markChildren = React.useMemo<React.ReactNode>(() => {
    if (typeof children === "function") {
      const rows = data ?? [];
      return rows.map((row, i) => {
        const key = id ? id(row, i) : i;
        return (
          <React.Fragment key={String(key)}>
            {(children as (row: unknown, index: number) => React.ReactNode)(row, i)}
          </React.Fragment>
        );
      });
    }
    return children;
  }, [children, data, id]);

  // ---- COLLECT pass: gather every mark's channels -------------------------
  //
  // React renders children AFTER the parent body runs, so the collect subtree
  // can't populate the registry in time for THIS render's scale math. We run the
  // collect subtree as a dedicated committed child (<CollectPass>) that reports
  // its registered marks up via a post-commit effect; the parent holds them in
  // state so the next render builds its scales from the populated data. Mutating
  // refs during render is avoided (Strict-Mode / concurrent safe). This only
  // changes WHEN `collected` is available — every downstream scale / mark / axis
  // computation below is untouched.
  const [collected, setCollected] = React.useState<CollectedMark[]>([]);

  const onCollected = React.useCallback((marks: CollectedMark[]) => {
    setCollected((prev) =>
      collectionSig(prev) === collectionSig(marks) ? prev : marks,
    );
  }, []);

  // Hidden collect render (marks return null; they only register).
  const collectTree = <CollectPass onCollected={onCollected}>{markChildren}</CollectPass>;

  // ---- build channels from collected marks --------------------------------
  const xCh: ChannelInfo = emptyChannel();
  const yCh: ChannelInfo = emptyChannel();
  let xLabel = xAxisLabel;
  let yLabel = yAxisLabel;
  const styleDomainSet: string[] = [];
  const symbolDomainSet: string[] = [];
  let anyBaselineZero = false;
  let gradientMin = Infinity;
  let gradientMax = -Infinity;

  // collect stack contributions across all bar/area marks (§1.3)
  const allStackRows: StackRow[] = [];
  let stackMethod: import("./types").StackingMethod = "standard";
  const dodgeKeys: string[] = [];
  const series = new Map<string, Array<{ x: unknown; y: unknown }>>();

  for (const m of collected) {
    if (m.point) {
      const skey = `${m.type}|${m.point.series}`;
      const arr = series.get(skey) ?? [];
      arr.push({ x: m.point.x, y: m.point.y });
      series.set(skey, arr);
    }
    for (const x of m.xs) observe(xCh, valueOf(x));
    for (const y of m.ys) observe(yCh, valueOf(y));
    if (!xLabel && m.xLabel) xLabel = m.xLabel;
    if (!yLabel && m.yLabel) yLabel = m.yLabel;
    if (m.baselineZero) anyBaselineZero = true;
    for (const k of m.styleKeys) if (!styleDomainSet.includes(k)) styleDomainSet.push(k);
    for (const k of m.symbolKeys) if (!symbolDomainSet.includes(k)) symbolDomainSet.push(k);
    for (const k of m.groupKeys ?? []) if (!dodgeKeys.includes(k)) dodgeKeys.push(k);
    if (m.stacking) stackMethod = m.stacking;
    if (m.stackRows) allStackRows.push(...m.stackRows.map((r) => ({ ...r, y0: 0, y1: 0 })));
    if (m.type === "rect") {
      for (const y of m.ys) {
        const n = plottableNumber(valueOf(y));
        if (!isNaN(n)) {
          gradientMin = Math.min(gradientMin, n);
          gradientMax = Math.max(gradientMax, n);
        }
      }
    }
  }

  // run the stacking layout pass → lookup + extend y-domain to the stack tops
  const seriesOrder = styleDomainSet.length ? styleDomainSet : ["__default__"];
  if (allStackRows.length) stack(allStackRows, stackMethod, seriesOrder);
  const stackMap = new Map<string, { y0: number; y1: number }>();
  for (const r of allStackRows) {
    stackMap.set(`${r.cat}|${r.series}`, { y0: r.y0, y1: r.y1 });
    observe(yCh, r.y1);
    observe(yCh, r.y0);
  }
  const stackLookup = (cat: string, series: string) => stackMap.get(`${cat}|${series}`);

  const dodge = dodgeKeys.length > 1 ? { order: dodgeKeys, count: dodgeKeys.length } : null;

  // sector slices → normalized cumulative angles (§8)
  const sectorSlices = collected.filter((m) => m.sector).map((m) => m.sector!);
  const sectorTotal = sectorSlices.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  const sectors: ChartRender["sectors"] = [];
  {
    let acc = 0;
    sectorSlices.forEach((slice, index) => {
      const frac = Math.max(0, slice.value) / sectorTotal;
      const a0 = acc * 2 * Math.PI;
      acc += frac;
      const a1 = acc * 2 * Math.PI;
      sectors.push({ key: slice.key, value: slice.value, a0, a1, index });
      if (!styleDomainSet.includes(slice.key)) styleDomainSet.push(slice.key);
    });
  }

  const hasSector = collected.some((m) => m.type === "sector");

  // ---- plot rect (gutters) ------------------------------------------------
  const yAxisCfg = normalizeAxis(yAxis);
  const xAxisCfg = normalizeAxis(xAxis);
  const yHidden = yAxisCfg.visibility === "hidden" || hasSector;
  const xHidden = xAxisCfg.visibility === "hidden" || hasSector;

  const gutterL = (yHidden ? 0 : GUTTER_LEADING) + (yLabel ? 16 : 0) + (plotPadding?.leading ?? 0);
  const gutterB = (xHidden ? 0 : GUTTER_BOTTOM) + (xLabel ? 16 : 0) + (plotPadding?.bottom ?? 0);
  const padTop = PAD_TOP + (plotPadding?.top ?? 0);
  const padTrailing = PAD_TRAILING + (plotPadding?.trailing ?? 0);

  const plot = {
    x: gutterL,
    y: padTop,
    w: Math.max(1, size.width - gutterL - padTrailing),
    h: Math.max(1, size.height - padTop - gutterB),
  };

  // ---- scales (x left→right, y bottom→top) --------------------------------
  const xScale = buildScale(xCh, [plot.x, plot.x + plot.w], xScaleSpec, false);
  const yScale = buildScale(
    yCh,
    [plot.y + plot.h, plot.y], // inverted: 0 at bottom
    yScaleSpec,
    anyBaselineZero,
  );

  const styleScale = makeStyleScale(foregroundStyleScale);
  const symbolScaleFn = makeSymbolScale(symbolScale);
  const gradientScale =
    isFinite(gradientMin) && isFinite(gradientMax)
      ? makeGradientScale(foregroundStyleScale, gradientMin, gradientMax)
      : undefined;

  const selectedKey =
    xSelection && xSelection.value != null ? plottableKey(xSelection.value) : null;

  const render: ChartRender = {
    collecting: false,
    xScale,
    yScale,
    plot,
    size,
    styleScale,
    symbolScale: symbolScaleFn,
    styleDomain: styleDomainSet,
    gradientScale,
    styleSpec: foregroundStyleScale,
    symbolSpec: symbolScale,
    selectedKey,
    stackLookup,
    dodge,
    series,
    claimed: new Set<string>(),
    sectors,
  };

  // ---- legend visibility --------------------------------------------------
  const legendVisible =
    legend !== "hidden" &&
    !(typeof legend === "object" && legend.visible === false) &&
    (styleDomainSet.length > 1 || symbolDomainSet.length > 1 || hasSector);

  // ---- selection pointer handler (§13) ------------------------------------
  // A pointer over the plot maps to an x value (xScale.invert) and/or a y value
  // (yScale.invert). Either or both selection bindings may be present.
  const onPointer =
    xSelection?.onChange || ySelection?.onChange
      ? (e: React.PointerEvent<SVGRectElement>) => {
          const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
          if (xSelection?.onChange) {
            const px = e.clientX - rect.left + plot.x; // overlay sits at plot origin
            xSelection.onChange(xScale.invert(px));
          }
          if (ySelection?.onChange) {
            const py = e.clientY - rect.top + plot.y;
            ySelection.onChange(yScale.invert(py));
          }
        }
      : undefined;

  const reduce = env.reduceMotion;

  return (
    <View
      {...viewProps}
      ref={hostRef as unknown as React.Ref<HTMLElement>}
      className={["sui-chart", viewProps.className].filter(Boolean).join(" ")}
      style={{ position: "relative", width: "100%", ...(viewProps.style ?? {}) }}
      data-reduce-motion={reduce ? "true" : undefined}
    >
      {/* COLLECT pass renders into a 0-size, hidden tree (marks only register) */}
      <div style={{ display: "none" }} aria-hidden>
        {collectTree}
      </div>

      <svg
        className="sui-chart-svg"
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        style={{ display: "block", width: "100%", height: "100%", overflow: "visible" }}
        role="img"
        aria-label={chartAriaLabel(xLabel, yLabel, collected.length)}
      >
        <defs>
          <clipPath id={`sui-plot-clip-${plotKey(plot)}`}>
            <rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} />
          </clipPath>
        </defs>

        {/* chartPlotStyle — background/border around the plot rectangle */}
        {!hasSector && plotStyle && (plotStyle.background || plotStyle.borderColor) && (
          <rect
            className="sui-chart-plot-bg"
            x={plot.x}
            y={plot.y}
            width={plot.w}
            height={plot.h}
            rx={plotStyle.cornerRadius ?? 0}
            ry={plotStyle.cornerRadius ?? 0}
            fill={plotStyle.background ?? "none"}
            stroke={plotStyle.borderColor ?? "none"}
            strokeWidth={plotStyle.borderColor ? (plotStyle.borderWidth ?? 1) : 0}
          />
        )}

        {!hasSector && (
          <AxisLayer
            render={render}
            xAxis={xAxisCfg}
            yAxis={yAxisCfg}
            xLabel={xLabel}
            yLabel={yLabel}
            xHidden={xHidden}
            yHidden={yHidden}
          />
        )}

        {/* RENDER pass: marks read scales from context and emit SVG. Hold the
            first frame (before the collect pass has populated the domain) so we
            never paint NaN-coordinate marks; the post-commit effect re-renders
            with valid scales. */}
        {collected.length > 0 && (
          <ChartContext.Provider value={render}>
            <g className="sui-chart-marks" clipPath={hasSector ? undefined : `url(#sui-plot-clip-${plotKey(plot)})`}>
              {markChildren}
            </g>
          </ChartContext.Provider>
        )}

        {/* selection overlay (invisible pointer surface over the plot) */}
        {onPointer && (
          <rect
            className="sui-chart-overlay"
            x={plot.x}
            y={plot.y}
            width={plot.w}
            height={plot.h}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
          />
        )}
      </svg>

      {legendVisible && (
        <Legend
          domain={styleDomainSet.length ? styleDomainSet : symbolDomainSet}
          styleScale={styleScale}
          symbolScale={symbolScaleFn}
          shape={legendShapeFor(collected)}
          legend={legend}
        />
      )}
    </View>
  );
}

Chart.displayName = "Chart";

/* ---- collect pass -------------------------------------------------------- */

/**
 * Renders the mark subtree in COLLECT mode (marks return null, only registering
 * their channels) and reports the gathered marks up after commit. Lives in its
 * own component so collection happens in a committed render — not as a render-
 * time side effect of the parent — which is Strict-Mode / concurrent safe.
 */
function CollectPass({
  children,
  onCollected,
}: {
  children: React.ReactNode;
  onCollected: (marks: CollectedMark[]) => void;
}): React.ReactElement {
  // Fresh per-render bucket + collector. The collector closes over THIS render's
  // bucket (no memoization / no mutation of a shared object), so the marks push
  // into the same array the post-commit effect reads — even across the re-render
  // that promoting the collection triggers.
  const bucket: CollectedMark[] = [];
  const collector = React.useRef<ChartCollector>({ collecting: true, register: () => {} });
  collector.current = { collecting: true, register: (m: CollectedMark) => bucket.push(m) };

  // After this subtree commits, hand the freshly collected marks to the parent.
  const bucketRef = React.useRef(bucket);
  bucketRef.current = bucket;
  React.useEffect(() => {
    onCollected(bucketRef.current);
    // re-collection is driven by `children` identity (new data → new marks)
  });

  return (
    <ChartContext.Provider value={collector.current}>{children}</ChartContext.Provider>
  );
}

/** Stable signature of a collected mark list (drives collect-equality). */
function collectionSig(arr: CollectedMark[]): string {
  return arr
    .map(
      (m) =>
        `${m.type}|${m.xs.map(keyish).join(",")}|${m.ys.map(keyish).join(",")}|` +
        `${m.styleKeys.join(",")}|${m.symbolKeys.join(",")}|${m.sector ? `${m.sector.key}:${m.sector.value}` : ""}`,
    )
    .join(";");
}

/* ---- helpers ------------------------------------------------------------- */

function valueOf(x: unknown): unknown {
  return isPlottable(x) ? x.value : x;
}

/** Stable scalar key for a collected x/y observation (used in the collect signature). */
function keyish(x: unknown): string {
  const v = isPlottable(x) ? (x as { value: unknown }).value : x;
  if (v instanceof Date) return String(v.getTime());
  return String(v);
}

function plotKey(p: { x: number; y: number; w: number; h: number }): string {
  return `${Math.round(p.x)}-${Math.round(p.y)}-${Math.round(p.w)}-${Math.round(p.h)}`;
}

function chartAriaLabel(x?: string, y?: string, n = 0): string {
  const parts = ["Chart"];
  if (y && x) parts.push(`of ${y} by ${x}`);
  parts.push(`with ${n} marks`);
  return parts.join(" ");
}

function legendShapeFor(marks: CollectedMark[]): "circle" | "line" | "swatch" {
  if (marks.some((m) => m.type === "line" || m.type === "rule")) return "line";
  if (marks.some((m) => m.type === "bar" || m.type === "rect" || m.type === "sector" || m.type === "area"))
    return "swatch";
  return "circle";
}
