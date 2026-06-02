/**
 * `AnyView` — `SwiftUICore.AnyView` (SwiftUICore :14443).
 *
 *   @frozen public struct AnyView : View {
 *     public init<V>(_ view: V) where V : View
 *     public init?(_fromValue value: Any)
 *   }
 *
 * SwiftUI's `AnyView` is a *type-eraser*: it boxes an arbitrary `some View` so a
 * heterogeneous collection (or a `var body` that returns different concrete
 * types on different branches) type-checks. It costs the framework its static
 * identity (diffing falls back to a slower path), but it changes NOTHING about
 * what is rendered.
 *
 * On the web there is no static type to erase — JSX `ReactNode` is already
 * uniform — so `AnyView` collapses to a transparent passthrough. To stay faithful
 * to "it's still a View", it renders through `<View>` so any modifier prop
 * applied to the erased view still lands (`<AnyView opacity={0.5}>…`). When NO
 * modifier/styling props are supplied it short-circuits to a bare Fragment so it
 * adds zero DOM — matching the fact that AnyView introduces no layout container
 * in SwiftUI.
 *
 * Purely presentational; no client directive.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";

export interface AnyViewProps extends ViewProps {
  children?: React.ReactNode;
}

/**
 * The set of props that, if present, force a real `<View>` host (so modifiers
 * compile to a DOM element). Anything else and we emit a zero-DOM Fragment.
 */
function hasHostProps(props: AnyViewProps): boolean {
  for (const key in props) {
    if (key === "children" || key === "as") continue;
    if ((props as Record<string, unknown>)[key] !== undefined) return true;
  }
  return false;
}

export const AnyView = React.forwardRef<HTMLElement, AnyViewProps>(
  function AnyView({ children, ...rest }, ref) {
    // No modifiers / DOM props → erase to a transparent Fragment (no extra box,
    // matching AnyView's "introduces no container" behaviour).
    if (!hasHostProps(rest)) {
      return <>{children}</>;
    }
    // Modifiers present → render a real host so they compile onto an element.
    return (
      <View ref={ref} {...rest}>
        {children}
      </View>
    );
  },
);

AnyView.displayName = "AnyView";
