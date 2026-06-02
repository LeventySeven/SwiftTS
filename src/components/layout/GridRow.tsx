/**
 * `GridRow` — one row of a `Grid`.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §6.
 *
 *   GridRow(alignment: VerticalAlignment? = nil) { … }
 *
 * Each top-level view inside the row is ONE cell; the number of cells in the
 * widest row sets the column count. Web mapping: the row is itself a `display:
 * grid` that spans all parent columns (`grid-column: 1 / -1`) and uses
 * `grid-template-columns: subgrid` so it INHERITS the parent Grid's column tracks
 * — that is what makes column `c` share width across all rows (SwiftUI's exact
 * contract). `alignment` (optional) overrides the row's vertical cell alignment.
 *
 * Renders through `<View>` so styling modifiers are supported.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import type { VerticalAlignment } from "../../system/types";

const V_ALIGN_TO_ITEMS: Record<VerticalAlignment, React.CSSProperties["alignItems"]> = {
  top: "start",
  center: "center",
  bottom: "end",
  firstTextBaseline: "baseline",
  lastTextBaseline: "last baseline" as React.CSSProperties["alignItems"],
};

export interface GridRowProps extends Omit<ViewProps, "as"> {
  /** Override the row's vertical cell alignment. `null`/undefined → inherit Grid's. */
  alignment?: VerticalAlignment | null;
  children?: React.ReactNode;
}

export const GridRow = React.forwardRef<HTMLElement, GridRowProps>(function GridRow(
  { alignment = null, style, children, ...rest },
  ref,
) {
  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridColumn: "1 / -1",
    // subgrid → inherit the parent Grid's column tracks for cross-row alignment.
    gridTemplateColumns: "subgrid",
    columnGap: "inherit",
    ...(alignment != null ? { alignItems: V_ALIGN_TO_ITEMS[alignment] } : null),
  };
  return (
    <View ref={ref} style={mergeStyles(rowStyle, style)} {...rest}>
      {children}
    </View>
  );
});

GridRow.displayName = "GridRow";
