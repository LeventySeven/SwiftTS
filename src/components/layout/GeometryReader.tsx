"use client";
/**
 * `GeometryReader` — read the proposed size, build content from it.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §10.
 *
 *   GeometryReader { proxy in … proxy.size … }
 *
 * GeometryReader GREEDILY takes ALL the space its parent proposes (unlike most
 * views, which take their ideal size) and hands the resolved `size` to the render
 * closure. Children are anchored TOP-LEADING by default (NOT center — the famous
 * gotcha). Web mapping: a `100%×100%` container observed by a `ResizeObserver`;
 * the measured `contentRect` feeds a render-prop `content({ size })`; inner
 * content is `flex-start`/`flex-start` anchored.
 *
 * Client component — needs a ref + ResizeObserver.
 */
import * as React from "react";

export interface GeometryProxy {
  size: { width: number; height: number };
  safeAreaInsets?: { top: number; leading: number; bottom: number; trailing: number };
}

export interface GeometryReaderProps {
  /** Render-prop: receives the resolved geometry. */
  content: (proxy: GeometryProxy) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function GeometryReader({ content, className, style }: GeometryReaderProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-start",
        }}
      >
        {/* children anchored top-leading — matches SwiftUI */}
        {content({ size })}
      </div>
    </div>
  );
}

GeometryReader.displayName = "GeometryReader";
