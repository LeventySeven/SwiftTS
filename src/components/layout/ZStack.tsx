/**
 * `ZStack` — SwiftUI's depth (overlay) stack.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §3.
 *
 *   ZStack(alignment: Alignment = .center) { … }
 *
 * Web mapping: a SINGLE-CELL CSS grid (NOT absolute positioning — absolute would
 * collapse the parent's size; a single-cell grid sizes to the largest child).
 * All children are placed in `grid-area: 1 / 1` so they overlap; later children
 * paint on top (DOM order → paint order, no `z-index` needed). The 2-D
 * `alignment` maps to `place-items` (`align-items` block × `justify-items`
 * inline). No `spacing` parameter — children overlap, there is no gap.
 *
 * Children are wrapped so each occupies the same single grid cell. Renders
 * through `<View>` so every styling modifier prop is supported.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import type { Alignment } from "../../system/types";

/** 2-D Alignment → CSS `place-items` ("<align-items> <justify-items>"). */
const ALIGN_TO_PLACE_ITEMS: Record<Alignment, string> = {
  center: "center center",
  leading: "center start",
  trailing: "center end",
  top: "start center",
  bottom: "end center",
  topLeading: "start start",
  topTrailing: "start end",
  bottomLeading: "end start",
  bottomTrailing: "end end",
};

export interface ZStackProps extends Omit<ViewProps, "as"> {
  /** 2-D alignment of children within the union bounding box. Default `.center`. */
  alignment?: Alignment;
  children?: React.ReactNode;
}

export const ZStack = React.forwardRef<HTMLElement, ZStackProps>(function ZStack(
  { alignment = "center", style, children, ...rest },
  ref,
) {
  const stackStyle: React.CSSProperties = {
    display: "grid",
    placeItems: ALIGN_TO_PLACE_ITEMS[alignment],
    width: "max-content",
  };
  // All children share cell (1,1) → they overlap; source order = paint order.
  const layered = React.Children.map(children, (child) =>
    React.isValidElement(child) ? (
      <div style={{ gridArea: "1 / 1" }}>{child}</div>
    ) : (
      child
    ),
  );
  return (
    <View ref={ref} style={mergeStyles(stackStyle, style)} {...rest}>
      {layered}
    </View>
  );
});

ZStack.displayName = "ZStack";
