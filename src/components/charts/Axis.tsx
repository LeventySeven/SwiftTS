"use client";
/**
 * Axis layer (§10) — gridlines + ticks + value labels for X and Y.
 *
 * A default axis draws, per tick value: a full-span gridline
 * (`--sui-color-separator`, 1px), a short tick stub at the axis edge, and a
 * `text.caption` 12px `secondaryLabel` value label. X default position `.bottom`,
 * Y `.leading`. Tick values come from the "nice numbers" generator (linear/time)
 * or one-per-category (band). Renders inside the chart `<svg>`.
 */
import * as React from "react";
import { cssVar } from "../../tokens/tokens";
import type { ChartRender } from "./context";
import { ticksForValues } from "./scales";
import type { AxisSpec, AxisGridLineSpec, AxisTickSpec, AxisValueLabelSpec } from "./types";

export interface AxisLayerProps {
  render: ChartRender;
  xAxis: AxisSpec;
  yAxis: AxisSpec;
  xLabel?: string;
  yLabel?: string;
  xHidden: boolean;
  yHidden: boolean;
}

const TICK_LEN = 4;
const LABEL_GAP = 6;
const AXIS_FONT = `400 12px/16px ${cssVar("--sui-font-default")}`;
const LABEL_FILL = cssVar("--sui-color-secondary-label");
const LINE_STROKE = cssVar("--sui-color-separator");

export function AxisLayer({
  render,
  xAxis,
  yAxis,
  xLabel,
  yLabel,
  xHidden,
  yHidden,
}: AxisLayerProps): React.ReactElement {
  const { xScale, yScale, plot } = render;

  // ---- Y axis (leading) ---------------------------------------------------
  const yTicks = axisTicks(yScale, yAxis);
  const yGrid = gridCfg(yAxis.gridline);
  const yTick = tickCfg(yAxis.tick);
  const yLab = labelCfg(yAxis.label);
  const yFmt = yLab.format ?? defaultFormat;

  // ---- X axis (bottom) ----------------------------------------------------
  const xTicks = axisTicks(xScale, xAxis);
  const xGrid = gridCfg(xAxis.gridline);
  const xTick = tickCfg(xAxis.tick);
  const xLab = labelCfg(xAxis.label);
  const xFmt = xLab.format ?? defaultFormat;

  return (
    <>
      {!yHidden && (
        <g className="sui-chart-yaxis">
          {yTicks.map((t, i) => {
            const py = t.pos;
            return (
              <g key={`y${i}`}>
                {!yGrid.hidden && (
                  <line
                    className="sui-gridline"
                    x1={plot.x}
                    x2={plot.x + plot.w}
                    y1={py}
                    y2={py}
                    stroke={LINE_STROKE}
                    strokeWidth={1}
                    strokeDasharray={yGrid.dash}
                  />
                )}
                {!yTick.hidden && (
                  <line
                    className="sui-tick"
                    x1={plot.x - TICK_LEN}
                    x2={plot.x}
                    y1={py}
                    y2={py}
                    stroke={LINE_STROKE}
                    strokeWidth={1}
                  />
                )}
                {!yLab.hidden && (
                  <text
                    className="sui-axislabel"
                    x={plot.x - TICK_LEN - LABEL_GAP}
                    y={py}
                    textAnchor="end"
                    dominantBaseline="middle"
                    style={{ font: AXIS_FONT, fill: LABEL_FILL }}
                  >
                    {yFmt(t.value)}
                  </text>
                )}
              </g>
            );
          })}
          {yLabel && (
            <text
              className="sui-axis-title"
              x={12}
              y={plot.y + plot.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(-90 12 ${plot.y + plot.h / 2})`}
              style={{ font: AXIS_FONT, fill: LABEL_FILL }}
            >
              {yLabel}
            </text>
          )}
        </g>
      )}

      {!xHidden && (
        <g className="sui-chart-xaxis">
          {xTicks.map((t, i) => {
            const px = t.pos;
            const vertical = xLab.orientation === "vertical" || xLab.orientation === "verticalReversed";
            return (
              <g key={`x${i}`}>
                {!xGrid.hidden && xScale.kind !== "band" && (
                  <line
                    className="sui-gridline"
                    x1={px}
                    x2={px}
                    y1={plot.y}
                    y2={plot.y + plot.h}
                    stroke={LINE_STROKE}
                    strokeWidth={1}
                    strokeDasharray={xGrid.dash}
                  />
                )}
                {!xTick.hidden && (
                  <line
                    className="sui-tick"
                    x1={px}
                    x2={px}
                    y1={plot.y + plot.h}
                    y2={plot.y + plot.h + TICK_LEN}
                    stroke={LINE_STROKE}
                    strokeWidth={1}
                  />
                )}
                {!xLab.hidden && (
                  <text
                    className="sui-axislabel"
                    x={px}
                    y={plot.y + plot.h + TICK_LEN + LABEL_GAP}
                    textAnchor={vertical ? "end" : "middle"}
                    dominantBaseline={vertical ? "middle" : "hanging"}
                    transform={vertical ? `rotate(-90 ${px} ${plot.y + plot.h + TICK_LEN + LABEL_GAP})` : undefined}
                    style={{ font: AXIS_FONT, fill: LABEL_FILL }}
                  >
                    {xFmt(t.value)}
                  </text>
                )}
              </g>
            );
          })}
          {xLabel && (
            <text
              className="sui-axis-title"
              x={plot.x + plot.w / 2}
              y={plot.y + plot.h + 24}
              textAnchor="middle"
              dominantBaseline="hanging"
              style={{ font: AXIS_FONT, fill: LABEL_FILL }}
            >
              {xLabel}
            </text>
          )}
        </g>
      )}
    </>
  );
}

AxisLayer.displayName = "AxisLayer";

/* ---- tick generation ----------------------------------------------------- */

interface RenderTick {
  value: unknown;
  pos: number; // pixel
}

function axisTicks(scale: ChartRender["xScale"], spec: AxisSpec): RenderTick[] {
  if (spec.values && (Array.isArray(spec.values) ? false : false)) {
    /* fallthrough */
  }
  if (scale.kind === "band") {
    const cats = scale.categories ?? [];
    return cats.map((c) => ({ value: c, pos: scale.scale(c) }));
  }
  const [d0, d1] = scale.domain as [number, number];
  const nums = ticksForValues(spec.values, d0, d1);
  const isTime = scale.kind === "time";
  return nums.map((n) => ({
    value: isTime ? new Date(n) : n,
    pos: scale.scale(n),
  }));
}

/* ---- per-axis config resolution ----------------------------------------- */

function gridCfg(g: AxisGridLineSpec | false | undefined): { hidden: boolean; dash?: string } {
  if (g === false) return { hidden: true };
  if (g == null) return { hidden: false };
  return {
    hidden: g.hidden === true,
    dash: g.stroke?.dash && g.stroke.dash.length ? g.stroke.dash.join(",") : undefined,
  };
}
function tickCfg(t: AxisTickSpec | false | undefined): { hidden: boolean } {
  if (t === false) return { hidden: true };
  if (t == null) return { hidden: false };
  return { hidden: t.hidden === true };
}
function labelCfg(l: AxisValueLabelSpec | false | undefined): {
  hidden: boolean;
  orientation?: AxisValueLabelSpec["orientation"];
  format?: AxisValueLabelSpec["format"];
} {
  if (l === false) return { hidden: true };
  if (l == null) return { hidden: false };
  return { hidden: l.hidden === true, orientation: l.orientation, format: l.format };
}

function defaultFormat(v: unknown): string {
  if (v instanceof Date) {
    return v.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
}
