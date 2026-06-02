/**
 * `Spacer` — SwiftUI's flexible gap.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §5.
 *
 *   Spacer(minLength: CGFloat? = nil)
 *
 * A Spacer is an empty flex item that consumes all free space on the parent
 * stack's main axis. `flex: 1 1 0%` is the exact analog of "consume all free
 * space, equally among multiple spacers." Direction is inherited from the parent
 * stack's `flex-direction`, matching SwiftUI's "expands along the stack's axis."
 * `minLength` → `min-inline-size`/`min-block-size` (only the axis-relevant one
 * matters; setting both is safe). Purely presentational.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";

export interface SpacerProps extends Omit<ViewProps, "as" | "children"> {
  /** Minimum length along the stack's axis, in px. `null`/undefined → 0 floor. */
  minLength?: number | null;
}

export const Spacer = React.forwardRef<HTMLElement, SpacerProps>(function Spacer(
  { minLength = null, style, ...rest },
  ref,
) {
  const spacerStyle: React.CSSProperties = {
    flex: "1 1 0%",
    alignSelf: "stretch",
    ...(minLength != null
      ? { minInlineSize: `${minLength}px`, minBlockSize: `${minLength}px` }
      : null),
  };
  return <View ref={ref} style={mergeStyles(spacerStyle, style)} {...rest} />;
});

Spacer.displayName = "Spacer";
