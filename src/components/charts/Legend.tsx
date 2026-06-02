"use client";
/**
 * `chartLegend` (§14) — auto-generated swatch+label list below the plot.
 *
 * Appears when a `foregroundStyle(by:)` / `symbol(by:)` style scale exists. One
 * swatch + label per domain category: a filled circle for bar/point/area/sector,
 * a short rounded line for line/rule marks. Label = `text.caption` 12px
 * `secondaryLabel`. Rendered as HTML (not SVG) for crisp text. Default centered
 * below the plot.
 */
import * as React from "react";
import { cssVar } from "../../tokens/tokens";
import type { StyleScaleFn, SymbolScaleFn } from "./scales";
import type { LegendOption } from "./types";

export interface LegendProps {
  domain: string[];
  styleScale: StyleScaleFn;
  symbolScale: SymbolScaleFn;
  shape: "circle" | "line" | "swatch";
  legend: LegendOption;
}

const LABEL_FONT = `400 12px/16px ${cssVar("--sui-font-default")}`;
const LABEL_FILL = cssVar("--sui-color-secondary-label");

export function Legend({ domain, styleScale, shape, legend }: LegendProps): React.ReactElement | null {
  if (domain.length === 0) return null;

  const position = typeof legend === "object" ? legend.position : "automatic";
  const isTop = position === "top" || position === "topLeading" || position === "topTrailing";

  const items =
    typeof legend === "object" && legend.items
      ? legend.items
      : domain.map((key, i) => ({ key, color: styleScale(key, i), shape }));

  return (
    <div
      className="sui-chart-legend"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        justifyContent: "center",
        marginTop: isTop ? 0 : 8,
        marginBottom: isTop ? 8 : 0,
        order: isTop ? -1 : undefined,
        font: LABEL_FONT,
        color: LABEL_FILL,
      }}
    >
      {items.map((item) => (
        <span
          key={item.key}
          className="sui-legend-item"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Swatch shape={(item as { shape?: string }).shape ?? shape} color={item.color} />
          <span className="sui-legend-label">{item.key}</span>
        </span>
      ))}
    </div>
  );
}

Legend.displayName = "Legend";

function Swatch({ shape, color }: { shape: string; color: string }): React.ReactElement {
  if (shape === "line") {
    return (
      <span
        className="sui-legend-swatch"
        style={{ width: 12, height: 2, borderRadius: 1, background: color, display: "inline-block" }}
      />
    );
  }
  return (
    <span
      className="sui-legend-swatch"
      style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }}
    />
  );
}
