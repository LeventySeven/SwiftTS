/**
 * `Grid` — SwiftUI's column-aligning 2-D grid (iOS 16+).
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §6.
 *
 *   Grid(alignment: Alignment = .center,
 *        horizontalSpacing: CGFloat? = nil, verticalSpacing: CGFloat? = nil) { … }
 *
 * Every cell in column `c` across all rows shares the same width (the max of that
 * column) — exactly CSS Grid behaviour. Web mapping: `display: grid` with
 * `grid-template-columns: repeat(columns, auto)`; each `<GridRow>` is a subgrid
 * row that inherits the parent's column tracks (→ cross-row column alignment).
 * `horizontalSpacing`/`verticalSpacing` → `column-gap`/`row-gap` (`nil`→8px).
 * `alignment` (2-D) → `justify-items`/`align-items`. A bare view placed directly
 * in the Grid (not in a GridRow) spans all columns — that's the consumer's job
 * via `gridColumn: '1 / -1'`; we expose `gridCellColumns(n)` for colspan.
 *
 * DESIGNED caveat: SwiftUI infers column count from the widest row; CSS needs it
 * declared, so `columns` is a required prop.
 *
 * Renders through `<View>` so styling modifiers are supported.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import type { Alignment } from "../../system/types";

/** 2-D Alignment → [justify-items (inline/H), align-items (block/V)]. */
const ALIGN_TO_ITEMS: Record<Alignment, [string, string]> = {
  center: ["center", "center"],
  leading: ["start", "center"],
  trailing: ["end", "center"],
  top: ["center", "start"],
  bottom: ["center", "end"],
  topLeading: ["start", "start"],
  topTrailing: ["end", "start"],
  bottomLeading: ["start", "end"],
  bottomTrailing: ["end", "end"],
};

export interface GridProps extends Omit<ViewProps, "as"> {
  /** Number of columns (DESIGNED: CSS can't infer from the widest row like SwiftUI). */
  columns: number;
  /** Default 2-D alignment for every cell. Default `.center`. */
  alignment?: Alignment;
  /** Column gap in px. `null`/undefined → 8px. */
  horizontalSpacing?: number | null;
  /** Row gap in px. `null`/undefined → 8px. */
  verticalSpacing?: number | null;
  children?: React.ReactNode;
}

export const Grid = React.forwardRef<HTMLElement, GridProps>(function Grid(
  {
    columns,
    alignment = "center",
    horizontalSpacing = null,
    verticalSpacing = null,
    style,
    children,
    ...rest
  },
  ref,
) {
  const [justifyItems, alignItems] = ALIGN_TO_ITEMS[alignment];
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, auto)`,
    columnGap:
      horizontalSpacing != null
        ? `${horizontalSpacing}px`
        : "var(--sui-space-stack-default, 8px)",
    rowGap:
      verticalSpacing != null
        ? `${verticalSpacing}px`
        : "var(--sui-space-stack-default, 8px)",
    justifyItems: justifyItems as React.CSSProperties["justifyItems"],
    alignItems: alignItems as React.CSSProperties["alignItems"],
    width: "max-content",
  };
  return (
    <View ref={ref} style={mergeStyles(gridStyle, style)} {...rest}>
      {children}
    </View>
  );
});

Grid.displayName = "Grid";

/** `gridCellColumns(n)` → the colspan style for a cell inside a GridRow. */
export function gridCellColumns(count: number): React.CSSProperties {
  return { gridColumn: `span ${count}` };
}
