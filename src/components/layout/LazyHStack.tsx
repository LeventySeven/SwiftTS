/**
 * `LazyHStack` — SwiftUI's on-demand horizontal stack.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §4.
 *
 *   LazyHStack(alignment: VerticalAlignment = .center, spacing: CGFloat? = nil,
 *              pinnedViews: PinnedScrollableViews = .init()) { … }
 *
 * IDENTICAL alignment/spacing semantics to `HStack` (same `.center` default, same
 * `nil`→8 gap). The only difference is materialization (must live inside a
 * horizontal `ScrollView`). Same pinned-views support as `LazyVStack`.
 *
 * Renders through `<View>` so styling modifiers are supported.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import type { VerticalAlignment } from "../../system/types";
import type { PinnedScrollableView } from "./LazyVStack";

const V_ALIGN_TO_ITEMS: Record<VerticalAlignment, React.CSSProperties["alignItems"]> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
  firstTextBaseline: "baseline",
  lastTextBaseline: "last baseline" as React.CSSProperties["alignItems"],
};

export interface LazyHStackProps extends Omit<ViewProps, "as"> {
  /** Cross-axis (vertical) alignment. Default `.center`. */
  alignment?: VerticalAlignment;
  /** Main-axis gap in px. `null`/undefined → 8px. */
  spacing?: number | null;
  /** Which Section headers/footers stick to the scroll edge. */
  pinnedViews?: PinnedScrollableView[];
  children?: React.ReactNode;
}

export const LazyHStack = React.forwardRef<HTMLElement, LazyHStackProps>(function LazyHStack(
  { alignment = "center", spacing = null, pinnedViews, style, children, ...rest },
  ref,
) {
  const pinned = (pinnedViews ?? [])
    .map((p) => (p === "sectionHeaders" ? "headers" : "footers"))
    .join(" ");
  const stackStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "row",
    alignItems: V_ALIGN_TO_ITEMS[alignment],
    gap: spacing != null ? `${spacing}px` : "var(--sui-space-stack-default, 8px)",
  };
  return (
    <View
      ref={ref}
      className="sui-lazy-hstack"
      data-pinned={pinned || undefined}
      style={mergeStyles(stackStyle, style)}
      {...rest}
    >
      {children}
    </View>
  );
});

LazyHStack.displayName = "LazyHStack";
