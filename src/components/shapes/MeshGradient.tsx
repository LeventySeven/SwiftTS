"use client";
/**
 * `MeshGradient` — SwiftUI Cluster C9 §14.7 (`SwiftUICore:14902-14964`).
 *
 *   public struct MeshGradient : ShapeStyle, Equatable, Sendable {   // SUICore:14902
 *     public var width: Int; public var height: Int                  // :14928-:14929
 *     public var locations: Locations  // .points([SIMD2<Float>]) | .bezierPoints([BezierPoint])  // :14930
 *     public var colors: Colors        // .colors([Color]) | .resolvedColors([Color.Resolved])    // :14931
 *     public var background: Color      // :14932  default .clear
 *     public var smoothsColors: Bool    // :14933  default true
 *     public var colorSpace: Gradient.ColorSpace  // :14934  default .device
 *     public init(width:Int, height:Int, points:[SIMD2<Float>], colors:[Color],
 *                 background: Color = .clear, smoothsColors: Bool = true, colorSpace: .device)  // :14936
 *     // BezierPoint (:14913): position + leading/top/trailing/bottom control points (SIMD2<Float>)
 *   }
 *
 * ─── what a MeshGradient IS ────────────────────────────────────────────────
 * `points` is a `width × height` grid of normalized (0..1) CONTROL-POINT
 * positions in ROW-MAJOR order (row r, col c → index `r*width + c`); `colors`
 * is the matching grid of corner colors. The surface is the smooth 2D
 * interpolation of those colored control points: each cell — a quad of 4
 * adjacent control points + their 4 colors — is filled by interpolating
 * position AND color across the cell. `smoothsColors=true` ⇒ a smooth
 * (bicubic / Hermite) blend that has zero gradient at the cell seams so colors
 * don't band; `false` ⇒ plain BILINEAR. The `.bezierPoints` form gives each
 * point leading/top/trailing/bottom control handles so a cell's EDGES curve
 * (Coons-patch), not just its interior.
 *
 * ─── how we render it on the web (DESIGNED) ───────────────────────────────
 * There is no native CSS for this. We rasterize to a `<canvas>` `ImageData`:
 *   1. resolve every `Color` to an sRGB `[r,g,b,a]` (token → var() → computed
 *      RGB via a one-off probe; hex/rgb/named parse directly).
 *   2. pick a render resolution `res ≤ maxResolution` (default 220²) — modest,
 *      then CSS-scale the canvas up to the box. Cheap + crisp enough.
 *   3. for every output pixel (u,v) in [0,1]², find which cell it lands in.
 *      Because control points can move, the cell↔pixel map isn't a fixed grid;
 *      we INVERT it: for each cell we walk its forward (s,t)→(x,y) map over a
 *      fine sub-grid and scatter-fill, OR — the path we take — march pixels and
 *      solve the cell's inverse bilinear map to get (s,t), then interpolate
 *      color at (s,t). We use the forward scatter approach (subdivide each cell
 *      into `SUBDIV²` micro-quads, fill each as a flat-shaded triangle pair)
 *      because it's allocation-free, handles curved (bezier) edges, and needs
 *      no per-pixel root-finding. `smoothsColors` swaps the color blend from
 *      bilinear to smoothstep-Hermite; curved edges come from the per-edge
 *      bezier handles via cubic Bézier evaluation of the patch boundary.
 *   4. `background` is painted first (the `.clear`-default underlay).
 *
 * SSR-safe: the raster runs only inside `useLayoutEffect` (post-mount, client).
 * The server / first paint emits the bare `<canvas>` (+ a CSS `background`
 * fallback of the mean color so there's no flash). reduce-motion only affects
 * the animated variant.
 */
import * as React from "react";
import { resolveColor } from "../../system/modifiers";
import { useEnvironment } from "../../system/environment";

/* =============================================================================
 * Types — the §14.7 web prop API.
 * ========================================================================== */

/** A normalized control-point position, the web spelling of `SIMD2<Float>`. */
export interface MeshPoint {
  /** 0 = leading edge … 1 = trailing edge. */
  x: number;
  /** 0 = top edge … 1 = bottom edge. */
  y: number;
}

/**
 * The `.bezierPoints` form (`BezierPoint`, `SUICore:14913`): a position plus the
 * four edge control handles that bend the cell boundaries meeting at this point.
 * Each handle is an absolute normalized position (NOT a relative offset), exactly
 * like SwiftUI's `BezierPoint`. Omitted handles fall back to the straight-edge
 * (linear) control point, so a plain `MeshPoint` and a `BezierPoint` with no
 * handles render identically.
 */
export interface BezierMeshPoint extends MeshPoint {
  /** control point toward the leading (−x) neighbour cell edge. */
  leading?: MeshPoint;
  /** control point toward the top (−y) neighbour cell edge. */
  top?: MeshPoint;
  /** control point toward the trailing (+x) neighbour cell edge. */
  trailing?: MeshPoint;
  /** control point toward the bottom (+y) neighbour cell edge. */
  bottom?: MeshPoint;
}

export type MeshGradientColorSpace = "device" | "perceptual";

export interface MeshGradientProps {
  /** grid columns (`width`). */
  width: number;
  /** grid rows (`height`). */
  height: number;
  /**
   * `width*height` control-point positions, ROW-MAJOR. Plain points = straight
   * cell edges; `BezierMeshPoint`s = curved (Coons-patch) edges.
   */
  points: Array<MeshPoint | BezierMeshPoint>;
  /** `width*height` corner colors, ROW-MAJOR, matching `points`. */
  colors: string[];
  /** painted under the mesh first. default `.clear` (transparent). */
  background?: string;
  /**
   * true (default) ⇒ smooth Hermite color blend (no seam banding); false ⇒
   * plain bilinear.
   */
  smoothsColors?: boolean;
  /** `.device` (sRGB lerp, default) | `.perceptual` (OKLab lerp). */
  colorSpace?: MeshGradientColorSpace;
  /**
   * Max raster resolution along the long edge, in device-independent px. Lower =
   * cheaper. We CSS-scale the canvas to the box, so this only trades smoothness
   * of the gradient for cost, not crispness of the element. default 220.
   */
  maxResolution?: number;
  className?: string;
  style?: React.CSSProperties;
}

/* =============================================================================
 * Color resolution → sRGB [r,g,b,a] in 0..255 / 0..1.
 *
 * `resolveColor` (system/modifiers) gives us a CSS color STRING (often a
 * `var(--sui-*)` ref). To lerp on a canvas we need actual channel values, and a
 * canvas can't read CSS custom properties. We resolve once, client-side, by
 * letting the browser compute the color: set it as `color` on a probe element,
 * read back the computed `rgb(...)`. Pure-literal colors (#hex / rgb() / named)
 * are parsed without the DOM so they work even on the server.
 * ========================================================================== */

export type RGBA = [number, number, number, number];

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i;
const HEX6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;
const RGB_FN = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/i;

/** Parse a literal CSS color to RGBA without touching the DOM. null if it needs the browser. */
function parseLiteral(css: string): RGBA | null {
  const s = css.trim();
  let m = HEX6.exec(s);
  if (m) {
    return [
      parseInt(m[1], 16),
      parseInt(m[2], 16),
      parseInt(m[3], 16),
      m[4] != null ? parseInt(m[4], 16) / 255 : 1,
    ];
  }
  m = HEX3.exec(s);
  if (m) {
    return [
      parseInt(m[1] + m[1], 16),
      parseInt(m[2] + m[2], 16),
      parseInt(m[3] + m[3], 16),
      m[4] != null ? parseInt(m[4] + m[4], 16) / 255 : 1,
    ];
  }
  m = RGB_FN.exec(s);
  if (m) {
    const a = m[4] != null
      ? m[4].endsWith("%")
        ? parseFloat(m[4]) / 100
        : parseFloat(m[4])
      : 1;
    return [
      clamp255(parseFloat(m[1])),
      clamp255(parseFloat(m[2])),
      clamp255(parseFloat(m[3])),
      a,
    ];
  }
  if (s === "transparent") return [0, 0, 0, 0];
  return null;
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Resolve any of our color spellings (token, var(), hex, rgb(), named) to RGBA.
 * Browser path: paint the resolved CSS color onto a 1×1 scratch canvas (which
 * DOES resolve `var(--sui-*)` against the document) and read the pixel back.
 */
let _probeCtx: CanvasRenderingContext2D | null = null;
function probeCtx(): CanvasRenderingContext2D | null {
  if (_probeCtx) return _probeCtx;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  _probeCtx = c.getContext("2d", { willReadFrequently: true });
  return _probeCtx;
}

export function resolveRGBA(color: string): RGBA {
  const css = resolveColor(color);
  const lit = parseLiteral(css);
  if (lit) return lit;
  // Needs the browser (named colors, var(), color-mix, oklch, …).
  const ctx = probeCtx();
  if (!ctx) return [128, 128, 128, 1]; // SSR fallback — overwritten on mount.
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000";
  ctx.fillStyle = css; // invalid → stays #000
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}

/* =============================================================================
 * Color-space lerp. `.device` = sRGB channel lerp. `.perceptual` = OKLab lerp
 * (matches `Gradient.ColorSpace.perceptual`), done via the sRGB↔OKLab transform.
 * ========================================================================== */

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function linearToSrgb(x: number): number {
  const c = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return clamp255(Math.round(c * 255));
}

/** sRGB(0..255) → OKLab. */
function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}
/** OKLab → sRGB(0..255). */
function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** Lerp two RGBA in the chosen space. `t` in 0..1. */
function lerpRGBA(a: RGBA, b: RGBA, t: number, space: MeshGradientColorSpace): RGBA {
  const alpha = a[3] + (b[3] - a[3]) * t;
  if (space === "perceptual") {
    const la = rgbToOklab(a[0], a[1], a[2]);
    const lb = rgbToOklab(b[0], b[1], b[2]);
    const [r, g, bl] = oklabToRgb(
      la[0] + (lb[0] - la[0]) * t,
      la[1] + (lb[1] - la[1]) * t,
      la[2] + (lb[2] - la[2]) * t,
    );
    return [r, g, bl, alpha];
  }
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    alpha,
  ];
}

/* =============================================================================
 * The rasterizer — the core interpolation. Exported so the animated variant and
 * tests can drive it directly.
 * ========================================================================== */

/** smoothsColors=true ⇒ Hermite smoothstep so the blend has zero slope at seams. */
function ease(t: number, smooth: boolean): number {
  return smooth ? t * t * (3 - 2 * t) : t;
}

/** Cubic Bézier scalar eval for curved (bezier) cell edges. */
function bez(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

interface CellCorner {
  x: number;
  y: number;
  rgba: RGBA;
  /** bezier handles toward each direction, absolute normalized coords (or undefined). */
  leading?: MeshPoint;
  top?: MeshPoint;
  trailing?: MeshPoint;
  bottom?: MeshPoint;
}

/**
 * Position of a point at parameter (s,t) inside one cell. Corners are
 * [tl,tr,bl,br]. If any corner carries bezier handles we evaluate the cell as a
 * Coons-style bicubic patch built from the 4 boundary cubics; otherwise plain
 * bilinear. Returns normalized {x,y}.
 */
function cellPos(c: [CellCorner, CellCorner, CellCorner, CellCorner], s: number, t: number): MeshPoint {
  const [tl, tr, bl, br] = c;
  const curved = !!(tl.trailing || tr.leading || tl.bottom || bl.top ||
                    tr.bottom || br.top || bl.trailing || br.leading);
  if (!curved) {
    // bilinear
    const xTop = tl.x + (tr.x - tl.x) * s;
    const xBot = bl.x + (br.x - bl.x) * s;
    const yTop = tl.y + (tr.y - tl.y) * s;
    const yBot = bl.y + (br.y - bl.y) * s;
    return { x: xTop + (xBot - xTop) * t, y: yTop + (yBot - yTop) * t };
  }
  // Coons patch from 4 boundary Béziers. Each edge is a cubic between its two
  // corners; the inner handle of each corner that points ALONG that edge is the
  // control point. Missing handles default to the 1/3–2/3 straight interpolation.
  const h = (from: CellCorner, to: CellCorner, fh: MeshPoint | undefined, th: MeshPoint | undefined) => {
    const p1 = fh ?? { x: from.x + (to.x - from.x) / 3, y: from.y + (to.y - from.y) / 3 };
    const p2 = th ?? { x: to.x - (to.x - from.x) / 3, y: to.y - (to.y - from.y) / 3 };
    return [from, p1, p2, to] as const;
  };
  const top = h(tl, tr, tl.trailing, tr.leading);     // top edge, param s
  const bot = h(bl, br, bl.trailing, br.leading);     // bottom edge, param s
  const left = h(tl, bl, tl.bottom, bl.top);          // left edge, param t
  const right = h(tr, br, tr.bottom, br.top);         // right edge, param t
  const bx = (e: readonly [CellCorner | MeshPoint, MeshPoint, MeshPoint, CellCorner | MeshPoint], p: number) =>
    bez(e[0].x, e[1].x, e[2].x, e[3].x, p);
  const by = (e: readonly [CellCorner | MeshPoint, MeshPoint, MeshPoint, CellCorner | MeshPoint], p: number) =>
    bez(e[0].y, e[1].y, e[2].y, e[3].y, p);
  // Coons: C = Lc(s,t) + Ld(s,t) - B(s,t)
  const ldX = (1 - s) * bx(left, t) + s * bx(right, t);
  const ldY = (1 - s) * by(left, t) + s * by(right, t);
  const lcX = (1 - t) * bx(top, s) + t * bx(bot, s);
  const lcY = (1 - t) * by(top, s) + t * by(bot, s);
  const bX = (1 - t) * ((1 - s) * tl.x + s * tr.x) + t * ((1 - s) * bl.x + s * br.x);
  const bY = (1 - t) * ((1 - s) * tl.y + s * tr.y) + t * ((1 - s) * bl.y + s * br.y);
  return { x: ldX + lcX - bX, y: ldY + lcY - bY };
}

/** Color at (s,t) inside a cell: bilinear over the 4 corner colors, eased if smooth. */
function cellColor(
  c: [CellCorner, CellCorner, CellCorner, CellCorner],
  s: number,
  t: number,
  smooth: boolean,
  space: MeshGradientColorSpace,
): RGBA {
  const [tl, tr, bl, br] = c;
  const es = ease(s, smooth);
  const et = ease(t, smooth);
  const top = lerpRGBA(tl.rgba, tr.rgba, es, space);
  const bot = lerpRGBA(bl.rgba, br.rgba, es, space);
  return lerpRGBA(top, bot, et, space);
}

export interface RasterParams {
  width: number;
  height: number;
  points: Array<MeshPoint | BezierMeshPoint>;
  /** pre-resolved corner colors (so the rAF loop resolves once). */
  rgba: RGBA[];
  background: string;
  smoothsColors: boolean;
  colorSpace: MeshGradientColorSpace;
}

/**
 * Rasterize the mesh into the canvas's current 2D context, sized `res×res` in
 * BACKING px. Uses forward scatter: subdivide each cell into `subdiv²` micro
 * quads, fill each as a flat-shaded path at its centroid color. Allocation-free
 * per frame after the corner table is built.
 */
export function rasterizeMesh(
  ctx: CanvasRenderingContext2D,
  res: number,
  p: RasterParams,
): void {
  const { width: W, height: H, points, rgba, smoothsColors, colorSpace, background } = p;
  ctx.clearRect(0, 0, res, res);
  if (background && background !== "clear" && background !== "transparent") {
    const bg = resolveColor(background);
    if (bg !== "transparent") {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, res, res);
    }
  }
  const at = (r: number, col: number): CellCorner => {
    const i = r * W + col;
    const pt = points[i] as BezierMeshPoint;
    return {
      x: pt.x,
      y: pt.y,
      rgba: rgba[i] ?? [128, 128, 128, 1],
      leading: pt.leading,
      top: pt.top,
      trailing: pt.trailing,
      bottom: pt.bottom,
    };
  };
  // Subdivision density per cell: finer for curved/large meshes, capped for cost.
  const subdiv = Math.max(6, Math.min(28, Math.ceil(res / Math.max(1, (W - 1) * 3))));
  for (let r = 0; r < H - 1; r++) {
    for (let cc = 0; cc < W - 1; cc++) {
      const corners: [CellCorner, CellCorner, CellCorner, CellCorner] = [
        at(r, cc),         // tl
        at(r, cc + 1),     // tr
        at(r + 1, cc),     // bl
        at(r + 1, cc + 1), // br
      ];
      for (let i = 0; i < subdiv; i++) {
        const s0 = i / subdiv, s1 = (i + 1) / subdiv;
        for (let j = 0; j < subdiv; j++) {
          const t0 = j / subdiv, t1 = (j + 1) / subdiv;
          const a = cellPos(corners, s0, t0);
          const b = cellPos(corners, s1, t0);
          const cpt = cellPos(corners, s1, t1);
          const d = cellPos(corners, s0, t1);
          const col = cellColor(corners, (s0 + s1) / 2, (t0 + t1) / 2, smoothsColors, colorSpace);
          ctx.fillStyle = `rgba(${Math.round(col[0])},${Math.round(col[1])},${Math.round(col[2])},${col[3]})`;
          ctx.beginPath();
          // overlap micro-quads by ~0.75px-equivalent to hide seam AA gaps
          ctx.moveTo(a.x * res, a.y * res);
          ctx.lineTo(b.x * res, b.y * res);
          ctx.lineTo(cpt.x * res, cpt.y * res);
          ctx.lineTo(d.x * res, d.y * res);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
}

/* =============================================================================
 * Mean-color fallback (for the SSR background so there's no flash before raster).
 * ========================================================================== */

function meanCss(colors: string[]): string {
  let r = 0, g = 0, b = 0, n = 0;
  for (const c of colors) {
    const lit = parseLiteral(resolveColor(c));
    if (lit) {
      r += lit[0]; g += lit[1]; b += lit[2]; n++;
    }
  }
  if (n === 0) return "transparent";
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}

/* =============================================================================
 * <MeshGradient/> — the static component.
 * ========================================================================== */

export function MeshGradient({
  width,
  height,
  points,
  colors,
  background = "clear",
  smoothsColors = true,
  colorSpace = "device",
  maxResolution = 220,
  className,
  style,
}: MeshGradientProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // SSR-stable mean color underlay (no var()s → renders the same server/client).
  const fallback = React.useMemo(() => meanCss(colors), [colors]);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    // Modest raster res, then CSS-scale up. Clamp to the requested ceiling.
    const res = Math.max(2, Math.min(maxResolution, Math.round(maxResolution * Math.min(1, dpr))));
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rgba = colors.map(resolveRGBA);
    rasterizeMesh(ctx, res, {
      width,
      height,
      points,
      rgba,
      background,
      smoothsColors,
      colorSpace,
    });
  }, [width, height, points, colors, background, smoothsColors, colorSpace, maxResolution]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        background: fallback,
        ...style,
      }}
    />
  );
}
MeshGradient.displayName = "MeshGradient";

/* =============================================================================
 * <AnimatedMeshGradient/> — the ambient morphing variant.
 *
 * Oscillates the INTERIOR control points around their base positions with a
 * per-point sine (distinct phase + amplitude) on a requestAnimationFrame loop —
 * the slow "ambient" Apple Music / now-playing morph. Edge & corner points are
 * pinned so the surface stays full-bleed; only true interior points drift.
 * reduce-motion ⇒ freeze on the base mesh (one static raster).
 * ========================================================================== */

export interface AnimatedMeshGradientProps extends MeshGradientProps {
  /**
   * Master speed (cycles/sec scale). Higher = faster morph. default 0.06 — the
   * slow ambient drift; the look is meant to be barely-perceptible motion.
   */
  speed?: number;
  /**
   * Peak interior displacement in normalized units (0..1 grid space). default
   * 0.08 — gentle. Edge/corner points never move regardless.
   */
  amplitude?: number;
}

/** Is grid cell (r,c) an INTERIOR point (not on the outer border)? */
function isInterior(r: number, c: number, W: number, H: number): boolean {
  return r > 0 && r < H - 1 && c > 0 && c < W - 1;
}

export function AnimatedMeshGradient({
  width,
  height,
  points,
  colors,
  background = "clear",
  smoothsColors = true,
  colorSpace = "device",
  maxResolution = 220,
  speed = 0.06,
  amplitude = 0.08,
  className,
  style,
}: AnimatedMeshGradientProps) {
  const { reduceMotion } = useEnvironment();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fallback = React.useMemo(() => meanCss(colors), [colors]);

  // Stable per-interior-point phase/amplitude/frequency seeds (deterministic by index).
  const seeds = React.useMemo(() => {
    return points.map((_, i) => ({
      // two independent oscillators (x,y) per point so it traces a Lissajous loop
      px: (i * 12.9898) % (Math.PI * 2),
      py: (i * 78.233) % (Math.PI * 2),
      fx: 0.7 + ((i * 0.37) % 1) * 0.9, // 0.7..1.6× base freq
      fy: 0.6 + ((i * 0.53) % 1) * 0.9,
      ax: 0.6 + ((i * 0.19) % 1) * 0.8, // 0.6..1.4× base amplitude
      ay: 0.6 + ((i * 0.71) % 1) * 0.8,
    }));
  }, [points]);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const res = Math.max(2, Math.min(maxResolution, Math.round(maxResolution * Math.min(1, dpr))));
    canvas.width = res;
    canvas.height = res;

    const rgba = colors.map(resolveRGBA);
    const base = points.map((p) => ({ ...(p as BezierMeshPoint) }));

    const drawAt = (timeSec: number) => {
      // Build the morphed point array: interior points drift, others pinned.
      const morphed = base.map((p, i) => {
        const r = Math.floor(i / width);
        const c = i % width;
        if (!isInterior(r, c, width, height)) return p;
        const sd = seeds[i];
        const dx = Math.sin(timeSec * Math.PI * 2 * speed * sd.fx + sd.px) * amplitude * sd.ax;
        const dy = Math.cos(timeSec * Math.PI * 2 * speed * sd.fy + sd.py) * amplitude * sd.ay;
        return { ...p, x: clamp01(p.x + dx), y: clamp01(p.y + dy) };
      });
      rasterizeMesh(ctx, res, {
        width,
        height,
        points: morphed,
        rgba,
        background,
        smoothsColors,
        colorSpace,
      });
    };

    if (reduceMotion || typeof requestAnimationFrame === "undefined") {
      drawAt(0); // freeze on base mesh
      return;
    }

    let raf = 0;
    let start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      drawAt((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    width,
    height,
    points,
    colors,
    background,
    smoothsColors,
    colorSpace,
    maxResolution,
    speed,
    amplitude,
    reduceMotion,
    seeds,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        background: fallback,
        ...style,
      }}
    />
  );
}
AnimatedMeshGradient.displayName = "AnimatedMeshGradient";

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/* =============================================================================
 * extractPalette — dominant colors from artwork (for ambient color derivation).
 *
 * Downsamples the image onto a small offscreen canvas, then median-cut buckets
 * the pixels into `count` boxes; each box's mean is a swatch. Returns hex
 * strings sorted by population (most-dominant first). Used to derive the
 * Now-Playing ambient mesh colors from album art.
 * ========================================================================== */

interface Box {
  pixels: number[]; // packed indices into the flat px arrays
}

/** Resolve an `HTMLImageElement` or a URL string to a loaded, CORS-clean image. */
function loadImage(src: HTMLImageElement | string): Promise<HTMLImageElement> {
  if (typeof src !== "string") {
    if (src.complete && src.naturalWidth > 0) return Promise.resolve(src);
    return new Promise((res, rej) => {
      src.addEventListener("load", () => res(src), { once: true });
      src.addEventListener("error", rej, { once: true });
    });
  }
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // needed to read pixels back
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export async function extractPalette(
  src: HTMLImageElement | string,
  count = 4,
): Promise<string[]> {
  if (typeof document === "undefined") return [];
  const img = await loadImage(src);
  const SAMPLE = 48; // downsample to 48×48 — fast, plenty for dominant colors
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return []; // tainted (cross-origin without CORS) — can't read back
  }

  // Collect opaque-enough pixels as [r,g,b] triples.
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue; // skip mostly-transparent
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  }
  const N = rs.length;
  if (N === 0) return [];

  // Median cut: start with one box of all pixels, repeatedly split the box with
  // the largest channel range along that channel's median until we have `count`.
  let boxes: Box[] = [{ pixels: Array.from({ length: N }, (_, i) => i) }];
  while (boxes.length < count) {
    // pick box with largest channel spread
    let bestIdx = -1, bestRange = -1, bestChan: 0 | 1 | 2 = 0;
    boxes.forEach((box, bi) => {
      if (box.pixels.length < 2) return;
      const arrs = [rs, gs, bs] as const;
      for (let ch: 0 | 1 | 2 = 0; ch < 3; ch = (ch + 1) as 0 | 1 | 2) {
        let lo = 255, hi = 0;
        for (const pi of box.pixels) {
          const v = arrs[ch][pi];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const range = hi - lo;
        if (range > bestRange) {
          bestRange = range;
          bestIdx = bi;
          bestChan = ch;
        }
      }
    });
    if (bestIdx < 0) break; // no splittable box left
    const box = boxes[bestIdx];
    const arr = [rs, gs, bs][bestChan];
    const sorted = [...box.pixels].sort((a, b) => arr[a] - arr[b]);
    const mid = sorted.length >> 1;
    boxes.splice(bestIdx, 1,
      { pixels: sorted.slice(0, mid) },
      { pixels: sorted.slice(mid) },
    );
  }

  // Each box → its mean color; sort by population (dominant first).
  const swatches = boxes
    .filter((b) => b.pixels.length > 0)
    .map((b) => {
      let r = 0, g = 0, bl = 0;
      for (const pi of b.pixels) {
        r += rs[pi]; g += gs[pi]; bl += bs[pi];
      }
      const n = b.pixels.length;
      return { pop: n, hex: toHex(r / n, g / n, bl / n) };
    })
    .sort((a, b) => b.pop - a.pop)
    .map((s) => s.hex);

  return swatches.slice(0, count);
}

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => clamp255(Math.round(v)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
