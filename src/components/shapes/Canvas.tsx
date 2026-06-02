"use client";
/**
 * `Canvas` — immediate-mode drawing — SwiftUI Cluster C9 §15.
 *
 *   public struct Canvas<Symbols>   // SUICore:17245
 *   var renderer: (inout GraphicsContext, CGSize) -> Void   // :17247
 *   init(opaque: Bool = false, colorMode: ColorRenderingMode = .nonLinear,
 *        rendersAsynchronously: Bool = false, renderer: …, @ViewBuilder symbols:)  // :17260
 *
 * Hidden logic: `Canvas` gives a retained-mode-free `GraphicsContext` + the
 * view's size; you draw imperatively each frame. Direct analog of an HTML
 * `<canvas>` 2D context. We scale the backing store by devicePixelRatio for
 * crisp output, then hand the renderer a `GraphicsContext2D` (§15.2 adapter)
 * and the CSS-px size.
 *
 * `symbols` are pre-rendered views referenced by id; rendered into a hidden
 * layer for callers that draw them via the raw 2D context (out of the core
 * draw loop — provided as an offscreen slot).
 */
import * as React from "react";
import { GraphicsContext2D } from "./GraphicsContext";

export type ColorRenderingMode = "nonLinear" | "linear" | "extendedLinear";

export interface CanvasProps {
  opaque?: boolean;
  colorMode?: ColorRenderingMode;
  rendersAsynchronously?: boolean;
  /** the draw callback, re-run on resize / when `renderer` identity changes. */
  renderer: (ctx: GraphicsContext2D, size: { width: number; height: number }) => void;
  /** pre-rendered symbols referenced by id inside the renderer. */
  symbols?: Record<string, React.ReactNode>;
  className?: string;
  style?: React.CSSProperties;
}

export function Canvas({
  opaque = false,
  renderer,
  symbols,
  className,
  style,
}: CanvasProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    const c = canvas.getContext("2d", { alpha: !opaque });
    if (!c) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.scale(dpr, dpr);
    if (opaque) {
      c.save();
      c.fillStyle = "var(--sui-color-system-background)";
      // fillStyle won't resolve a CSS var on canvas; fall back to white/clear.
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, size.width, size.height);
      c.restore();
    }
    renderer(new GraphicsContext2D(c), { width: size.width, height: size.height });
  }, [size, renderer, opaque]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      {symbols && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {Object.entries(symbols).map(([id, node]) => (
            <div key={id} data-symbol-id={id}>
              {node}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Canvas.displayName = "Canvas";
