"use client";
/**
 * `<Shape>` — the universal shape renderer every concrete shape reuses.
 *
 * RE'd from `teardowns/SWIFTUI_C9_shapes-drawing.md` §1.3 / §17.
 *
 *   protocol Shape { func path(in rect: CGRect) -> Path }   // SUICore:9593
 *
 * The render contract (§intro): a `Shape` IS a function `path(in:)->Path`,
 * drawn through `_ShapeView<Content,Style>` (`SUICore:17630`) which pairs the
 * path with a fill/stroke. The uniform web mapping: every shape compiles to an
 * SVG `<path d=…>` and the style compiles to `fill` / `stroke`. This component
 * measures its box (ResizeObserver — shapes are resolution-independent and
 * evaluated against the live offered size) and calls the concrete shape's
 * `pathIn(w,h)` callback to get the `d` string.
 *
 * A shape with both a `fill` and a `stroke`/`strokeBorder` renders TWO stacked
 * `<path>`s in one `<svg>` — the exact analog of layered `ShapeView`s (§17.2):
 * the earlier (fill) call becomes the background of the later (stroke) call.
 *
 * Client component — needs a ref + ResizeObserver for the live size.
 */
import * as React from "react";
import {
  strokeAttrs,
  fillAttrs,
  type StrokeStyleProps,
  type FillStyleProps,
} from "./style";

export type ShapeRole = "fill" | "stroke" | "separator";

/** Props shared by every concrete shape (its paint, not its geometry). */
export interface ShapeStyleProps {
  /** any CSS paint: a color var, a hex, or `url(#gradId)`. default label. */
  fill?: string;
  /** stroke paint; when set the shape is stroked (centered on the path edge). */
  stroke?: string;
  strokeStyle?: StrokeStyleProps;
  fillStyle?: FillStyleProps;
  role?: ShapeRole;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Layered background shape view (§17.2). Rendered as a `<path>` BENEATH this
   * shape's path — mirrors `.fill(...).stroke(...)` composition.
   */
  background?: React.ReactNode;
}

export interface ShapeProps extends ShapeStyleProps {
  /** `path(in:)` — returns the SVG `d` string in the shape's own px coords. */
  pathIn: (w: number, h: number) => string;
  /**
   * When `true`, the geometry is inset by half the stroke width before drawing
   * (the `strokeBorder` inside-stroke trick, §10.2). The renderer passes an
   * inset (w,h) and shifts the path so the whole stroke stays inside bounds.
   */
  insetStrokeBorder?: boolean;
}

/** Measure the host box; recompute the path on resize. */
function useBoxSize(): [React.RefObject<HTMLDivElement | null>, { w: number; h: number }] {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current;
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
  return [ref, size];
}

export function Shape({
  pathIn,
  fill = "var(--sui-color-label)",
  stroke,
  strokeStyle,
  fillStyle,
  insetStrokeBorder = false,
  className,
  style,
  background,
}: ShapeProps) {
  const [ref, size] = useBoxSize();
  const { w, h } = size;

  const lineWidth = strokeStyle?.lineWidth ?? (stroke ? 1 : 0);
  const inset = insetStrokeBorder ? lineWidth / 2 : 0;
  // strokeBorder: shrink the box by `inset` on all sides, draw the path in the
  // inner box, then translate it back by `inset` so it stays centered.
  const innerW = Math.max(0, w - inset * 2);
  const innerH = Math.max(0, h - inset * 2);

  const d = w && h ? pathIn(innerW, innerH) : "";
  const { fillRule, shapeRendering } = fillAttrs(fillStyle);
  const isStroke = !!stroke;

  return (
    <div
      ref={ref}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    >
      {w > 0 && h > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ display: "block", overflow: "visible" }}
        >
          <g transform={inset ? `translate(${inset} ${inset})` : undefined}>
            {background}
            <path
              d={d}
              fill={isStroke ? "none" : fill}
              fillRule={fillRule}
              shapeRendering={shapeRendering}
              stroke={stroke}
              {...strokeAttrs(strokeStyle)}
            />
          </g>
        </svg>
      )}
    </div>
  );
}

Shape.displayName = "Shape";
