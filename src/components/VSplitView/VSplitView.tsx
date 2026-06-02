"use client";
/**
 * `VSplitView` — SwiftUI's vertical resizable split container (macOS-only).
 *
 * RE'd from the macOS SDK `.swiftinterface`:
 *
 *   @available(macOS 10.15, *) @available(iOS/tvOS/watchOS/visionOS, unavailable)
 *   public struct VSplitView<Content> : View where Content : View {
 *     public init(@ViewBuilder content: () -> Content)
 *   }
 *
 * The vertical twin of `HSplitView`: panes are laid out in ROWS separated by
 * draggable HORIZONTAL dividers that resize the two adjacent rows. Like the
 * macOS struct, the init takes ONLY a `@ViewBuilder` of panes — there is no
 * spacing/divider parameter; the per-pane drag clamps come from each pane's
 * `.frame(minHeight:idealHeight:maxHeight:)` (read here off `minHeight` /
 * `maxHeight` / `idealHeight` props or a `frame={{…}}` modifier).
 *
 * The whole engine is shared with HSplitView — `VSplitView` is a thin wrapper
 * that delegates to `SplitViewImpl` with `vertical=true`, exactly the way the
 * two AppKit subclasses share `NSSplitView`. Panes pass height-axis constraints
 * (`minHeight` / `maxHeight` / `idealHeight`) instead of width-axis ones.
 */
import * as React from "react";
import {
  SplitViewImpl,
  type HSplitViewProps,
  type SplitPaneProps,
} from "../HSplitView/HSplitView";

/** VSplitView shares HSplitView's prop surface (children + dividerThickness). */
export type VSplitViewProps = HSplitViewProps;
export type { SplitPaneProps };

/**
 * `VSplitView { … }` — vertical split: panes laid out in ROWS, separated by
 * draggable HORIZONTAL dividers that resize the two adjacent rows.
 *
 *   <VSplitView>
 *     <Editor minHeight={120} idealHeight={400} />
 *     <Console minHeight={80} maxHeight={300} />
 *   </VSplitView>
 *
 * A VSplitView fills its parent's height by default (so the rows have a height
 * to distribute); give the parent an explicit height/`.frame(height:)`.
 */
export const VSplitView = React.forwardRef<HTMLElement, VSplitViewProps>(
  function VSplitView(props, _ref) {
    return <SplitViewImpl {...props} vertical={true} />;
  },
);

VSplitView.displayName = "VSplitView";
