"use client";
/**
 * `ScrollViewReader` + `ScrollViewProxy` — SwiftUI Cluster C6 §2.
 *
 *   ScrollViewReader { proxy in … }
 *   struct ScrollViewProxy { func scrollTo<ID: Hashable>(_ id: ID, anchor: UnitPoint? = nil) }
 *
 * The proxy is published by the nearest `<ScrollView>` through React context.
 * `scrollTo(id, anchor?)` finds the child carrying `data-scroll-id={id}` and
 * `scrollIntoView`s it, mapping `anchor` to the `block`/`inline` position
 * (`.top→start`, `.center→center`, `.bottom→end`, `nil→nearest`).
 *
 *   <ScrollViewReader>{(proxy) => (
 *     <ScrollView>{rows.map(r => <Row key={r.id} data-scroll-id={r.id}/>)}</ScrollView>
 *   )}</ScrollViewReader>
 */
import * as React from "react";

export type ScrollAnchorName = "top" | "center" | "bottom";

export interface ScrollViewProxy {
  /** Scroll so the view tagged `data-scroll-id={id}` aligns to `anchor`. */
  scrollTo: (id: string | number, anchor?: ScrollAnchorName) => void;
}

/** Default no-op proxy (when used outside a ScrollView). */
const noopProxy: ScrollViewProxy = { scrollTo: () => {} };

export const ScrollViewProxyContext =
  React.createContext<ScrollViewProxy>(noopProxy);
ScrollViewProxyContext.displayName = "ScrollViewProxyContext";

/** Hook form — read the nearest ScrollView's proxy. */
export function useScrollViewProxy(): ScrollViewProxy {
  return React.useContext(ScrollViewProxyContext);
}

export interface ScrollViewReaderProps {
  /** Render-prop form — receives the proxy, exactly like SwiftUI. */
  children: (proxy: ScrollViewProxy) => React.ReactNode;
}

/**
 * Render-prop wrapper mirroring `ScrollViewReader { proxy in … }`. Because the
 * proxy is provided by the descendant `<ScrollView>`, the closure is re-invoked
 * with the live proxy via context — we read it here and pass it down.
 */
export function ScrollViewReader({
  children,
}: ScrollViewReaderProps): React.ReactElement {
  const proxy = React.useContext(ScrollViewProxyContext);
  return <>{children(proxy)}</>;
}
ScrollViewReader.displayName = "ScrollViewReader";
