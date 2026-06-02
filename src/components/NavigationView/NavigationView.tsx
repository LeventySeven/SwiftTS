"use client";
/**
 * `NavigationView` — DEPRECATED SwiftUI navigation container.
 *
 * RE'd from the SDK `.swiftinterface`:
 *
 *   @available(iOS, introduced: 13.0, deprecated: 100000.0,
 *     message: "use NavigationStack or NavigationSplitView instead")
 *   @available(macOS, introduced: 10.15, deprecated: 100000.0, …)
 *   public struct NavigationView<Content> : View where Content : View {
 *     public init(@ViewBuilder content: () -> Content)
 *   }
 *
 * Apple deprecated `NavigationView` in iOS 16 / macOS 13 in favor of
 * `NavigationStack` (single-column push/pop) and `NavigationSplitView`
 * (multi-column). The single-column drill-down form —
 *
 *   NavigationView {
 *     List { NavigationLink("Detail", destination: DetailView()) }
 *       .navigationTitle("Root")
 *   }
 *
 * — maps 1:1 onto `NavigationStack`. So rather than reimplement the nav chrome,
 * back button, push/pop slide, and edge-swipe (all of which `NavigationStack`
 * already owns), this is a paper-thin COMPAT shim that forwards its children
 * straight into `NavigationStack`. Legacy `NavigationView { … }` code keeps
 * working unchanged; new code should adopt `NavigationStack` directly.
 *
 * @deprecated Use `NavigationStack` (push/pop) or `NavigationSplitView`
 * (multi-column) instead. This wrapper exists only for source compatibility with
 * legacy SwiftUI code and simply delegates to `NavigationStack`.
 */
import * as React from "react";
import {
  NavigationStack,
  type NavigationStackProps,
} from "../navigation/NavigationStack";

/**
 * NavigationView's only init is `init(content:)`, so its props are exactly
 * NavigationStack's minus the stack-specific path controls that legacy
 * NavigationView never exposed — but we keep them available as a superset so the
 * shim is a drop-in for either API. `rootTitle` lets callers set the root screen
 * title the way `.navigationTitle` did inside the old container.
 */
export interface NavigationViewProps extends NavigationStackProps {}

/**
 * @deprecated Use `NavigationStack` or `NavigationSplitView`. `NavigationView`
 * is a compatibility wrapper that renders its `children` inside a
 * `NavigationStack`.
 *
 *   <NavigationView>
 *     <List>…</List>
 *   </NavigationView>
 *
 * is equivalent to:
 *
 *   <NavigationStack>
 *     <List>…</List>
 *   </NavigationStack>
 */
export const NavigationView = React.forwardRef<HTMLDivElement, NavigationViewProps>(
  function NavigationView({ children, ...rest }, ref) {
    return (
      <NavigationStack ref={ref} {...rest}>
        {children}
      </NavigationStack>
    );
  },
);

NavigationView.displayName = "NavigationView";
