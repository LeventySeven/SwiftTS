/**
 * `EmptyView` — `SwiftUICore.EmptyView` (SwiftUICore :13838).
 *
 *   @frozen public struct EmptyView : View {
 *     @inlinable nonisolated public init()
 *     public typealias Body = Never
 *   }
 *
 * SwiftUI's `EmptyView` renders nothing — it occupies no space and produces no
 * visual output. It is the default `Content` for container builders (e.g. a
 * `Menu`/`ToolbarItem` with no body), and a way to satisfy a `some View`
 * requirement on a branch that should draw nothing.
 *
 * The faithful web mapping is `null` (React renders nothing for it, contributes
 * no DOM, no layout). `EmptyView` takes no props — there is nothing to style on a
 * view that does not exist.
 *
 * Purely presentational; no client directive.
 */
import * as React from "react";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EmptyViewProps {}

export function EmptyView(_props: EmptyViewProps = {}): React.ReactElement | null {
  return null;
}

EmptyView.displayName = "EmptyView";
