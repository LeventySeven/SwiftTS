/**
 * `<MetricGrid>` — a responsive grid of metric tiles (data-display BLOCK).
 *
 * The dashboard header band: a CSS grid that auto-flows `<StatTile>`s into N
 * columns, collapsing to fewer columns as the container narrows. Mirrors the
 * SwiftUI `LazyVGrid(columns: [GridItem(.adaptive(minimum:))])` idiom but driven
 * by a real CSS `repeat(auto-fill, minmax(...))` so it reflows without JS.
 *
 * Pass `<StatTile>` children directly, or a `metrics` array of StatTile props
 * for the data-driven form (`MetricGrid(data){ … }` flavor). Server-compatible.
 */
import * as React from "react";
import { StatTile, type StatTileProps } from "./StatTile";

export interface MetricGridProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * Fixed column count. When set, the grid is exactly `columns` wide and does
   * not reflow (use for a known 2- or 4-up band). Omit for adaptive columns.
   */
  columns?: number;
  /**
   * Minimum tile width (px) for the adaptive grid. Default `150`. The grid fits
   * as many `minmax(minTileWidth, 1fr)` columns as the width allows.
   */
  minTileWidth?: number;
  /** Gap between tiles (px). Default `12`. */
  spacing?: number;
  /** Data-driven form: an array of StatTile props (each becomes a tile). */
  metrics?: StatTileProps[];
  /** Or pass `<StatTile>` elements directly. */
  children?: React.ReactNode;
}

export const MetricGrid = React.forwardRef<HTMLDivElement, MetricGridProps>(
  function MetricGrid(
    {
      columns,
      minTileWidth = 150,
      spacing = 12,
      metrics,
      children,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    const gridTemplateColumns =
      columns != null
        ? `repeat(${columns}, minmax(0, 1fr))`
        : `repeat(auto-fill, minmax(${minTileWidth}px, 1fr))`;

    const content =
      children ??
      (metrics
        ? metrics.map((m, i) => <StatTile key={i} {...m} />)
        : null);

    return (
      <div
        ref={ref}
        className={className}
        style={{
          display: "grid",
          gridTemplateColumns,
          gap: `${spacing}px`,
          width: "100%",
          ...style,
        }}
        {...rest}
      >
        {content}
      </div>
    );
  },
);

MetricGrid.displayName = "MetricGrid";
