/**
 * `LazyVGrid` — SwiftUI's scrollable on-demand vertical-flowing grid.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §8.
 *
 *   LazyVGrid(columns: [GridItem], alignment: HorizontalAlignment = .center,
 *             spacing: CGFloat? = nil, pinnedViews: PinnedScrollableViews = .init()) { … }
 *
 * You describe the COLUMNS as `[GridItem]`; content flows top-to-bottom, wrapping
 * across the fixed column template. Web mapping: `display: grid` with
 * `grid-template-columns` built from the `columns` array via `gridItemsToTemplate`
 * (fixed → px, flexible → minmax, adaptive → repeat(auto-fill,minmax)). `spacing`
 * is the inter-ROW gap (`row-gap`); `alignment` (HorizontalAlignment) →
 * `justify-items`. A single `.adaptive` GridItem becomes
 * `repeat(auto-fill, minmax(min,1fr))` — the exact CSS analog of SwiftUI's
 * adaptive column. Must live inside a `ScrollView` (`overflow:auto`).
 *
 * Renders through `<View>` so styling modifiers are supported.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import type { HorizontalAlignment } from "../../system/types";
import { gridItemsToTemplate, type GridItemSpec } from "./GridItem";
import type { PinnedScrollableView } from "./LazyVStack";

const H_ALIGN_TO_JUSTIFY: Record<HorizontalAlignment, React.CSSProperties["justifyItems"]> = {
  leading: "start",
  center: "center",
  trailing: "end",
};

export interface LazyVGridProps extends Omit<ViewProps, "as"> {
  /** Column track descriptors. */
  columns: GridItemSpec[];
  /** Horizontal alignment of items within columns. Default `.center`. */
  alignment?: HorizontalAlignment;
  /** Inter-row gap in px. `null`/undefined → 8px. */
  spacing?: number | null;
  /** Which Section headers/footers stick to the scroll edge. */
  pinnedViews?: PinnedScrollableView[];
  children?: React.ReactNode;
}

export const LazyVGrid = React.forwardRef<HTMLElement, LazyVGridProps>(function LazyVGrid(
  { columns, alignment = "center", spacing = null, pinnedViews, style, children, ...rest },
  ref,
) {
  const pinned = (pinnedViews ?? [])
    .map((p) => (p === "sectionHeaders" ? "headers" : "footers"))
    .join(" ");
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: gridItemsToTemplate(columns),
    rowGap: spacing != null ? `${spacing}px` : "var(--sui-space-stack-default, 8px)",
    columnGap: "var(--sui-space-stack-default, 8px)",
    justifyItems: H_ALIGN_TO_JUSTIFY[alignment],
  };
  return (
    <View
      ref={ref}
      className="sui-lazy-vgrid"
      data-pinned={pinned || undefined}
      style={mergeStyles(gridStyle, style)}
      {...rest}
    >
      {children}
    </View>
  );
});

LazyVGrid.displayName = "LazyVGrid";
