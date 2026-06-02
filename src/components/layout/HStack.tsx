/**
 * `HStack` — SwiftUI's horizontal stack.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §2.
 *
 *   HStack(alignment: VerticalAlignment = .center, spacing: CGFloat? = nil) { … }
 *
 * Web mapping: `display:flex; flex-direction:row`. The `alignment` is the CROSS
 * axis (HStack lays out horizontally → aligns children vertically) and maps to
 * `align-items`. `.firstTextBaseline` → `align-items: baseline`;
 * `.lastTextBaseline` → `align-items: last baseline` (the closest CSS analogs).
 * `spacing` → main-axis `gap`; `nil`/undefined → 8px token. `width: max-content`
 * keeps the stack only as wide as the sum of its children (child disposes).
 *
 * Renders through `<View>` so every styling modifier prop is supported.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import type { VerticalAlignment } from "../../system/types";

/** VerticalAlignment (cross axis) → flex `align-items`. */
const V_ALIGN_TO_ITEMS: Record<VerticalAlignment, React.CSSProperties["alignItems"]> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
  firstTextBaseline: "baseline",
  // CSS "last baseline" keyword — the closest analog to `.lastTextBaseline`.
  lastTextBaseline: "last baseline" as React.CSSProperties["alignItems"],
};

export interface HStackProps extends Omit<ViewProps, "as"> {
  /** Cross-axis (vertical) alignment. SwiftUI default `.center`. */
  alignment?: VerticalAlignment;
  /** Main-axis gap in px. `null`/undefined → 8px (`space.stack.default`). */
  spacing?: number | null;
  children?: React.ReactNode;
}

/**
 * SwiftUI: a stack hugs its content (child disposes) UNLESS a child opts into
 * growth. A `Spacer` grows the stack's MAIN axis; a `frame(maxWidth/maxHeight:
 * .infinity)` child grows that specific axis. These helpers detect both so e.g.
 * `HStack { Text; Spacer; Text }` spreads to the full width instead of
 * collapsing to content width, and a `VStack` with a `maxWidth:.infinity` child
 * stretches its width.
 */
export function stackHasSpacer(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some((c) => {
    if (!React.isValidElement(c)) return false;
    const t = c.type as { suiRole?: string; displayName?: string } | undefined;
    return t?.suiRole === "spacer" || t?.displayName === "Spacer";
  });
}
export function stackHasFrameInfinity(
  children: React.ReactNode,
  axis: "maxWidth" | "maxHeight",
): boolean {
  return React.Children.toArray(children).some((c) => {
    if (!React.isValidElement(c)) return false;
    const frame = (c.props as { frame?: Record<string, unknown> } | undefined)?.frame;
    const v = frame?.[axis];
    return v === "infinity" || v === Infinity;
  });
}

export const HStack = React.forwardRef<HTMLElement, HStackProps>(function HStack(
  { alignment = "center", spacing = null, style, children, ...rest },
  ref,
) {
  // main axis = width: a Spacer or maxWidth:.infinity child fills it
  const fillW = stackHasSpacer(children) || stackHasFrameInfinity(children, "maxWidth");
  const stackStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "row",
    alignItems: V_ALIGN_TO_ITEMS[alignment],
    gap: spacing != null ? `${spacing}px` : "var(--sui-space-stack-default, 8px)",
    width: fillW ? "100%" : "max-content",
  };
  return (
    <View ref={ref} style={mergeStyles(stackStyle, style)} {...rest}>
      {children}
    </View>
  );
});

HStack.displayName = "HStack";
