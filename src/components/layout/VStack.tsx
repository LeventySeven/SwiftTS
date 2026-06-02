/**
 * `VStack` — SwiftUI's vertical stack.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §1.
 *
 *   VStack(alignment: HorizontalAlignment = .center, spacing: CGFloat? = nil) { … }
 *
 * Web mapping: `display:flex; flex-direction:column`. The `alignment` is the
 * CROSS axis (VStack stacks vertically → aligns children horizontally) and maps
 * to `align-items`. `spacing` is the main-axis `gap`; `nil`/undefined → the
 * `--sui-space-stack-default` token (8px). `width: max-content` reproduces the
 * "child disposes" rule — a VStack is only as wide as its widest child and does
 * not stretch to its parent unless a child opts into growth.
 *
 * Renders through `<View>` so every styling modifier prop is supported.
 * Purely presentational — no client directive.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import type { HorizontalAlignment } from "../../system/types";

/** HorizontalAlignment (cross axis) → flex `align-items`. */
const H_ALIGN_TO_ITEMS: Record<HorizontalAlignment, React.CSSProperties["alignItems"]> = {
  leading: "flex-start",
  center: "center",
  trailing: "flex-end",
};

export interface VStackProps extends Omit<ViewProps, "as"> {
  /** Cross-axis (horizontal) alignment. SwiftUI default `.center`. */
  alignment?: HorizontalAlignment;
  /** Main-axis gap in px. `null`/undefined → 8px (`space.stack.default`). */
  spacing?: number | null;
  children?: React.ReactNode;
}

export const VStack = React.forwardRef<HTMLElement, VStackProps>(function VStack(
  { alignment = "center", spacing = null, style, children, ...rest },
  ref,
) {
  const stackStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: H_ALIGN_TO_ITEMS[alignment],
    gap: spacing != null ? `${spacing}px` : "var(--sui-space-stack-default, 8px)",
    width: "max-content",
  };
  return (
    <View ref={ref} style={mergeStyles(stackStyle, style)} {...rest}>
      {children}
    </View>
  );
});

VStack.displayName = "VStack";
