/**
 * `<Divider>` — SwiftUI's hairline separator (C1 §5).
 *
 * Spec: teardowns/SWIFTUI_C1_content-primitives.md §5.
 *
 * SwiftUI `Divider()` has NO parameters; its orientation is derived from the
 * parent stack axis (inside an HStack → vertical line; inside a VStack/List →
 * horizontal line). CSS cannot read the SwiftUI stack intent, so the replica
 * takes an explicit `axis` prop (default `"horizontal"`, the VStack/List case).
 * The kit's HStack can pass `axis="vertical"` for its dividers.
 *
 * Thickness is 1 logical px (0.5px on @2x via media query) in the translucent
 * `--sui-color-separator`. Purely presentational → server-compatible.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import type { Axis } from "../../system/types";
import styles from "./Divider.module.css";

export interface DividerProps extends Omit<ViewProps, "as" | "children"> {
  /**
   * Line orientation. SwiftUI infers this from the parent stack:
   *   - inside a VStack / List → `"horizontal"` (full-width line) — default.
   *   - inside an HStack       → `"vertical"`   (full-height line).
   */
  axis?: Axis;
}

export const Divider = React.forwardRef<HTMLElement, DividerProps>(function Divider(
  { axis = "horizontal", className, ...rest },
  ref,
) {
  const orientationClass =
    axis === "vertical" ? styles.vertical : styles.horizontal;
  const mergedClassName =
    [styles.divider, orientationClass, className].filter(Boolean).join(" ") ||
    undefined;

  return (
    <View
      ref={ref}
      as="div"
      role="separator"
      aria-orientation={axis}
      className={mergedClassName}
      {...rest}
    />
  );
});

Divider.displayName = "Divider";
