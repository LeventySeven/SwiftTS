"use client";
/**
 * `trim` / `_TrimmedShape` and `stroke` / `_StrokedShape` — SwiftUI Cluster C9 §12.
 *
 *   _TrimmedShape<S> { startFraction; endFraction }   // SUICore:5665
 *   Shape.trim(from: 0, to: 1) -> some Shape           // :5699
 *   _StrokedShape<S> { shape; style }                  // SUICore:9650
 *   Shape.stroke(style:) / stroke(lineWidth:)          // :9682/:9686
 *
 * Hidden logic: `trim(from:to:)` keeps the sub-segment of the path between
 * arc-length fractions [start,end]. Animating `endFraction` 0→1 is THE canonical
 * draw-on / progress-ring animation. Web technique A (§12.3): a stroked trim via
 * `stroke-dasharray` + `stroke-dashoffset` on a measured path — matches the trim
 * animation exactly. We render a single `<svg>` + `<path>`, measure its total
 * length on mount, and set the dash so only [start,end] is visible.
 */
import * as React from "react";
import { strokeAttrs, type StrokeStyleProps } from "./style";

export interface TrimmedShapeProps {
  /** the shape's `path(in:)` callback (in the box's own px coords). */
  pathIn: (w: number, h: number) => string;
  /** start fraction 0..1 (default 0). */
  from?: number;
  /** end fraction 0..1 (default 1). */
  to?: number;
  /** stroke paint (a trimmed shape is almost always stroked). */
  stroke?: string;
  strokeStyle?: StrokeStyleProps;
  /** when set, fills instead of strokes (rare — filled trim). */
  fill?: string;
  /** degrees to rotate the whole shape (e.g. -90 to start a ring at 12 o'clock). */
  rotation?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function TrimmedShape({
  pathIn,
  from = 0,
  to = 1,
  stroke = "var(--sui-color-label)",
  strokeStyle,
  fill,
  rotation = 0,
  className,
  style,
}: TrimmedShapeProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const pathRef = React.useRef<SVGPathElement>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [len, setLen] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.w === width && prev.h === height ? prev : { w: width, h: height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const d = size.w && size.h ? pathIn(size.w, size.h) : "";

  React.useLayoutEffect(() => {
    if (pathRef.current && d) {
      setLen(pathRef.current.getTotalLength());
    }
  }, [d]);

  const visible = (to - from) * len;
  const offset = -from * len;

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    >
      {size.w > 0 && size.h > 0 && (
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          style={{ display: "block", overflow: "visible" }}
        >
          <g
            transform={
              rotation
                ? `rotate(${rotation} ${size.w / 2} ${size.h / 2})`
                : undefined
            }
          >
            <path
              ref={pathRef}
              d={d}
              fill={fill ?? "none"}
              stroke={stroke}
              {...strokeAttrs(strokeStyle)}
              strokeDasharray={len ? `${visible} ${len}` : undefined}
              strokeDashoffset={len ? offset : undefined}
            />
          </g>
        </svg>
      )}
    </div>
  );
}

TrimmedShape.displayName = "TrimmedShape";
