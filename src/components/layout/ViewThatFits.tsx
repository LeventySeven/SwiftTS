"use client";
/**
 * `ViewThatFits` — pick the first candidate child that fits.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §9.
 *
 *   ViewThatFits(in axes: Axis.Set = [.horizontal, .vertical]) { … }
 *
 * Evaluates its candidate children IN ORDER and renders the FIRST whose ideal
 * size fits the proposed size in the specified axes. The LAST child is the
 * fallback — always rendered if none fit (load-bearing rule, encoded as the
 * initial pick). CSS has no native "pick first that fits", so we measure: each
 * candidate is rendered into a hidden, intrinsically-sized off-screen layer; a
 * `ResizeObserver` on the container re-measures on resize and selects the first
 * candidate whose measured width/height fits the container along the tested axes.
 *
 * Client component — needs refs + ResizeObserver + state.
 */
import * as React from "react";

export type FitAxis = "horizontal" | "vertical";

export interface ViewThatFitsProps {
  /** Axes to test fit against. Default both. */
  axes?: FitAxis[];
  /** Candidate children, in priority order (first that fits wins; last = fallback). */
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const offscreenLayer: React.CSSProperties = {
  position: "absolute",
  visibility: "hidden",
  pointerEvents: "none",
  // intrinsic measurement: don't let the parent constrain the candidate's size.
  width: "max-content",
  height: "max-content",
  inset: 0,
};

export function ViewThatFits({
  axes = ["horizontal", "vertical"],
  children,
  className,
  style,
}: ViewThatFitsProps) {
  const candidates = React.useMemo(() => React.Children.toArray(children), [children]);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const measureRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  // fallback = last candidate (SwiftUI renders the last child if nothing fits).
  const [pick, setPick] = React.useState(() => Math.max(0, candidates.length - 1));

  const testHorizontal = axes.includes("horizontal");
  const testVertical = axes.includes("vertical");

  const choose = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    for (let i = 0; i < candidates.length; i++) {
      const m = measureRefs.current[i];
      if (!m) continue;
      const cw = m.scrollWidth;
      const ch = m.scrollHeight;
      // small epsilon to tolerate sub-pixel rounding
      const wOk = !testHorizontal || cw <= width + 0.5;
      const hOk = !testVertical || ch <= height + 0.5;
      if (wOk && hOk) {
        setPick(i);
        return;
      }
    }
    setPick(Math.max(0, candidates.length - 1));
  }, [candidates.length, testHorizontal, testVertical]);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => choose());
    ro.observe(container);
    choose();
    return () => ro.disconnect();
  }, [choose]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", ...style }}
    >
      {/* hidden measuring layer — every candidate at intrinsic size */}
      <div style={offscreenLayer} aria-hidden="true">
        {candidates.map((child, i) => (
          <div
            key={`measure-${i}`}
            ref={(el) => {
              measureRefs.current[i] = el;
            }}
            style={{ width: "max-content" }}
          >
            {child}
          </div>
        ))}
      </div>
      {/* visible layer — only the chosen candidate */}
      {candidates[pick]}
    </div>
  );
}

ViewThatFits.displayName = "ViewThatFits";
