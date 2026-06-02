/**
 * `GraphicsContext` adapter — SwiftUI Cluster C9 §15.2.
 *
 * RE'd from `teardowns/SWIFTUI_C9_shapes-drawing.md` §15. Wraps a DOM
 * `CanvasRenderingContext2D` in an adapter that mirrors SwiftUI's immediate-mode
 * `GraphicsContext` API 1:1, so a SwiftUI `Canvas { ctx, size in … }` renderer
 * ports almost verbatim. `Path` `d` strings feed `new Path2D(d)` directly — the
 * §2 PathBuilder is reused unchanged.
 *
 * Default shadow constant (KNOWN, `SUICore:7192`): color sRGBLinear white 0
 * opacity 0.33, offset (0,0). That's the Apple soft-shadow seed.
 */

/** `GraphicsContext.Shading` (`SUICore:7270`) — the paint for a fill/stroke. */
export type Shading =
  | { kind: "color"; color: string }
  | {
      kind: "linearGradient";
      stops: Array<{ color: string; location: number }>;
      start: { x: number; y: number };
      end: { x: number; y: number };
    }
  | {
      kind: "radialGradient";
      stops: Array<{ color: string; location: number }>;
      center: { x: number; y: number };
      startRadius: number;
      endRadius: number;
    }
  | {
      kind: "conicGradient";
      stops: Array<{ color: string; location: number }>;
      center: { x: number; y: number };
      angle: number; // radians
    };

/** `GraphicsContext.BlendMode` (`SUICore:7007`) → canvas globalCompositeOperation. */
export const BLEND_MAP: Record<string, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  colorDodge: "color-dodge",
  colorBurn: "color-burn",
  softLight: "soft-light",
  hardLight: "hard-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
  clear: "destination-out",
  copy: "copy",
  sourceIn: "source-in",
  sourceOut: "source-out",
  sourceAtop: "source-atop",
  destinationOver: "destination-over",
  destinationIn: "destination-in",
  destinationOut: "destination-out",
  destinationAtop: "destination-atop",
  xor: "xor",
  plusLighter: "lighter",
  plusDarker: "multiply", // closest canvas equivalent
};

export interface CanvasStrokeStyle {
  lineWidth?: number;
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "miter" | "round" | "bevel";
  miterLimit?: number;
  dash?: number[];
  dashPhase?: number;
}

function resolveShading(
  c: CanvasRenderingContext2D,
  s: Shading,
): string | CanvasGradient {
  switch (s.kind) {
    case "color":
      return s.color;
    case "linearGradient": {
      const g = c.createLinearGradient(s.start.x, s.start.y, s.end.x, s.end.y);
      for (const st of s.stops) g.addColorStop(clamp01(st.location), st.color);
      return g;
    }
    case "radialGradient": {
      const g = c.createRadialGradient(
        s.center.x,
        s.center.y,
        s.startRadius,
        s.center.x,
        s.center.y,
        s.endRadius,
      );
      for (const st of s.stops) g.addColorStop(clamp01(st.location), st.color);
      return g;
    }
    case "conicGradient": {
      const g = c.createConicGradient(s.angle, s.center.x, s.center.y);
      for (const st of s.stops) g.addColorStop(clamp01(st.location), st.color);
      return g;
    }
  }
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

function applyStroke(c: CanvasRenderingContext2D, s?: CanvasStrokeStyle): void {
  c.lineWidth = s?.lineWidth ?? 1;
  c.lineCap = s?.lineCap ?? "butt";
  c.lineJoin = s?.lineJoin ?? "miter";
  c.miterLimit = s?.miterLimit ?? 10;
  c.setLineDash(s?.dash ?? []);
  c.lineDashOffset = s?.dashPhase != null ? -s.dashPhase : 0;
}

/**
 * The SwiftUI-shaped wrapper. Mirrors the §15.2 member list: opacity, blendMode,
 * transform stack (translateBy/scaleBy/rotate/concatenate), clip, fill, stroke,
 * shadow, drawLayer.
 */
export class GraphicsContext2D {
  constructor(private c: CanvasRenderingContext2D) {}

  /** Underlying 2D context (escape hatch for image/text drawing). */
  get raw(): CanvasRenderingContext2D {
    return this.c;
  }

  get opacity(): number {
    return this.c.globalAlpha;
  }
  set opacity(v: number) {
    this.c.globalAlpha = v;
  }

  set blendMode(m: string) {
    this.c.globalCompositeOperation = BLEND_MAP[m] ?? "source-over";
  }

  /** `transform` setter: a CGAffineTransform [a b c d tx ty]. */
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.c.setTransform(a, b, c, d, e, f);
  }

  translateBy(x: number, y: number): void {
    this.c.translate(x, y);
  }
  scaleBy(x: number, y: number): void {
    this.c.scale(x, y);
  }
  /** `rotate(by:)` — radians. */
  rotate(rad: number): void {
    this.c.rotate(rad);
  }
  /** `concatenate(_:)` — CGAffineTransform. */
  concatenate(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.c.transform(a, b, c, d, e, f);
  }

  /** Save/restore for `drawLayer { … }` scoping. */
  drawLayer(content: (ctx: GraphicsContext2D) => void): void {
    this.c.save();
    content(this);
    this.c.restore();
  }

  /** `clip(to:style:)` — intersect the clip region with a path. */
  clip(d: string, evenOdd = false): void {
    this.c.clip(new Path2D(d), evenOdd ? "evenodd" : "nonzero");
  }

  /** `fill(_:with:style:)`. */
  fill(d: string, shading: Shading, evenOdd = false): void {
    this.c.fillStyle = resolveShading(this.c, shading);
    this.c.fill(new Path2D(d), evenOdd ? "evenodd" : "nonzero");
  }

  /** `stroke(_:with:style:)`. */
  stroke(d: string, shading: Shading, style?: CanvasStrokeStyle): void {
    applyStroke(this.c, style);
    this.c.strokeStyle = resolveShading(this.c, shading);
    this.c.stroke(new Path2D(d));
  }

  /**
   * `GraphicsContext.Filter.shadow` (default color sRGBLinear white 0
   * opacity 0.33, offset 0,0). Applies to subsequent draws until cleared.
   */
  shadow(
    color = "rgba(0,0,0,0.33)",
    blur = 0,
    x = 0,
    y = 0,
  ): void {
    this.c.shadowColor = color;
    this.c.shadowBlur = blur;
    this.c.shadowOffsetX = x;
    this.c.shadowOffsetY = y;
  }

  clearShadow(): void {
    this.c.shadowColor = "transparent";
    this.c.shadowBlur = 0;
    this.c.shadowOffsetX = 0;
    this.c.shadowOffsetY = 0;
  }
}
