/**
 * `LazyHGrid` — SwiftUI's scrollable on-demand horizontal-flowing grid.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §8.
 *
 *   LazyHGrid(rows: [GridItem], alignment: VerticalAlignment = .center,
 *             spacing: CGFloat? = nil, pinnedViews: PinnedScrollableViews = .init()) { … }
 *
 * Mirror of `LazyVGrid`: you describe the ROWS as `[GridItem]`; content flows
 * left-to-right via `grid-auto-flow: column`. Web mapping: `display: grid` with
 * `grid-template-rows` built from the `rows` array; `alignment` (VerticalAlignment)
 * → `align-items`; `spacing` is the inter-COLUMN gap. Must live inside a
 * horizontal `ScrollView` (`overflow:auto`).
 *
 * Renders through `<View>` so styling modifiers are supported.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import type { VerticalAlignment } from "../../system/types";
import { gridItemsToTemplate, type GridItemSpec } from "./GridItem";
import type { PinnedScrollableView } from "./LazyVStack";

const V_ALIGN_TO_ITEMS: Record<VerticalAlignment, React.CSSProperties["alignItems"]> = {
  top: "start",
  center: "center",
  bottom: "end",
  firstTextBaseline: "baseline",
  lastTextBaseline: "last baseline" as React.CSSProperties["alignItems"],
};

export interface LazyHGridProps extends Omit<ViewProps, "as"> {
  /** Row track descriptors. */
  rows: GridItemSpec[];
  /** Vertical alignment of items within rows. Default `.center`. */
  alignment?: VerticalAlignment;
  /** Inter-column gap in px. `null`/undefined → 8px. */
  spacing?: number | null;
  /** Which Section headers/footers stick to the scroll edge. */
  pinnedViews?: PinnedScrollableView[];
  children?: React.ReactNode;
}

export const LazyHGrid = React.forwardRef<HTMLElement, LazyHGridProps>(function LazyHGrid(
  { rows, alignment = "center", spacing = null, pinnedViews, style, children, ...rest },
  ref,
) {
  const pinned = (pinnedViews ?? [])
    .map((p) => (p === "sectionHeaders" ? "headers" : "footers"))
    .join(" ");
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridAutoFlow: "column",
    gridTemplateRows: gridItemsToTemplate(rows),
    columnGap: spacing != null ? `${spacing}px` : "var(--sui-space-stack-default, 8px)",
    rowGap: "var(--sui-space-stack-default, 8px)",
    alignItems: V_ALIGN_TO_ITEMS[alignment],
  };
  return (
    <View
      ref={ref}
      className="sui-lazy-hgrid"
      data-pinned={pinned || undefined}
      style={mergeStyles(gridStyle, style)}
      {...rest}
    >
      {children}
    </View>
  );
});

LazyHGrid.displayName = "LazyHGrid";
