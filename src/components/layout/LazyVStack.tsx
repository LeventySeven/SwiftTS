/**
 * `LazyVStack` — SwiftUI's on-demand vertical stack.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §4.
 *
 *   LazyVStack(alignment: HorizontalAlignment = .center, spacing: CGFloat? = nil,
 *              pinnedViews: PinnedScrollableViews = .init()) { … }
 *
 * IDENTICAL alignment/spacing semantics to `VStack` (same `.center` default, same
 * `nil`→8 gap). The only difference is materialization: a lazy stack only builds
 * children as they scroll into view (must live inside a `ScrollView` → `overflow:
 * auto`). We approximate that with `content-visibility: auto` +
 * `contain-intrinsic-size` per child (zero-JS cheap virtualization). `pinnedViews`
 * with `sectionHeaders`/`sectionFooters` makes Section headers/footers sticky.
 *
 * Renders through `<View>` so styling modifiers are supported.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import type { HorizontalAlignment } from "../../system/types";

const H_ALIGN_TO_ITEMS: Record<HorizontalAlignment, React.CSSProperties["alignItems"]> = {
  leading: "flex-start",
  center: "center",
  trailing: "flex-end",
};

export type PinnedScrollableView = "sectionHeaders" | "sectionFooters";

export interface LazyVStackProps extends Omit<ViewProps, "as"> {
  /** Cross-axis (horizontal) alignment. Default `.center`. */
  alignment?: HorizontalAlignment;
  /** Main-axis gap in px. `null`/undefined → 8px. */
  spacing?: number | null;
  /** Which Section headers/footers stick to the scroll edge. */
  pinnedViews?: PinnedScrollableView[];
  children?: React.ReactNode;
}

export const LazyVStack = React.forwardRef<HTMLElement, LazyVStackProps>(function LazyVStack(
  { alignment = "center", spacing = null, pinnedViews, style, children, ...rest },
  ref,
) {
  const pinned = (pinnedViews ?? [])
    .map((p) => (p === "sectionHeaders" ? "headers" : "footers"))
    .join(" ");
  const stackStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: H_ALIGN_TO_ITEMS[alignment],
    gap: spacing != null ? `${spacing}px` : "var(--sui-space-stack-default, 8px)",
  };
  return (
    <View
      ref={ref}
      className="sui-lazy-vstack"
      data-pinned={pinned || undefined}
      style={mergeStyles(stackStyle, style)}
      {...rest}
    >
      {children}
    </View>
  );
});

LazyVStack.displayName = "LazyVStack";
