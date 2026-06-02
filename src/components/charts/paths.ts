/**
 * Swift Charts → Web — SVG path generators (§3.3, §4.3, §5.3, §8.3).
 *
 * Pure + SSR-safe. Implements every `InterpolationMethod` curve (linear,
 * monotone-X, step, cardinal, catmull-rom), the area-closing path, the basic
 * symbol shapes, and the annular-sector (pie/donut) arc. No React, no DOM.
 */
import type { Interp, BasicSymbol } from "./types";

export interface Pt {
  x: number;
  y: number;
}

const fmt = (n: number): string => (Number.isFinite(n) ? n.toFixed(3) : "0");
const M = (p: Pt): string => `M${fmt(p.x)},${fmt(p.y)}`;
const L = (p: Pt): string => `L${fmt(p.x)},${fmt(p.y)}`;

/* =============================================================================
 * Line interpolation (§1.4 / §3.3)
 * ========================================================================== */

export function linePath(pts: Pt[], interp: Interp = "linear"): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return M(pts[0]);
  if (interp === "linear") return M(pts[0]) + pts.slice(1).map(L).join("");
  if (interp === "monotone") return monotonePath(pts);
  if (interp === "stepStart") return stepPath(pts, 0);
  if (interp === "stepCenter") return stepPath(pts, 0.5);
  if (interp === "stepEnd") return stepPath(pts, 1);
  if (typeof interp === "object" && "catmullRom" in interp) {
    return catmullRomPath(pts, interp.catmullRom);
  }
  if (typeof interp === "object" && "cardinal" in interp) {
    return cardinalPath(pts, interp.cardinal);
  }
  return M(pts[0]) + pts.slice(1).map(L).join("");
}

/** Step path: knee at `t` fraction (0=start, .5=center, 1=end) of each segment. */
export function stepPath(pts: Pt[], t: number): string {
  let d = M(pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const kx = a.x + (b.x - a.x) * t;
    d += `L${fmt(kx)},${fmt(a.y)}L${fmt(kx)},${fmt(b.y)}L${fmt(b.x)},${fmt(b.y)}`;
  }
  return d;
}

/** Cardinal spline (tension 0 = Catmull-Rom-ish; higher tension = tighter). */
export function cardinalPath(pts: Pt[], tension = 0): string {
  if (pts.length < 3) return M(pts[0]) + pts.slice(1).map(L).join("");
  const k = (1 - tension) / 6;
  let d = M(pts[0]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * k;
    const c1y = p1.y + (p2.y - p0.y) * k;
    const c2x = p2.x - (p3.x - p1.x) * k;
    const c2y = p2.y - (p3.y - p1.y) * k;
    d += `C${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(p2.x)},${fmt(p2.y)}`;
  }
  return d;
}

/** Catmull-Rom spline parameterized by alpha (0.5 = centripetal, default). */
export function catmullRomPath(pts: Pt[], alpha = 0.5): string {
  if (pts.length < 3) return M(pts[0]) + pts.slice(1).map(L).join("");
  const dist = (a: Pt, b: Pt) => Math.pow(Math.hypot(b.x - a.x, b.y - a.y), alpha);
  let d = M(pts[0]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const d1 = dist(p0, p1) || 1e-6;
    const d2 = dist(p1, p2) || 1e-6;
    const d3 = dist(p2, p3) || 1e-6;
    const c1x = p1.x + ((d1 * (p2.x - p0.x)) / (d1 + d2) - (p2.x - p1.x)) * 0; // keep tangents stable
    void c1x;
    // standard centripetal Catmull-Rom → Bézier control points:
    const b1x = p1.x + (p2.x - p0.x) / (6 * (d1 + d2)) * d2;
    const b1y = p1.y + (p2.y - p0.y) / (6 * (d1 + d2)) * d2;
    const b2x = p2.x - (p3.x - p1.x) / (6 * (d2 + d3)) * d2;
    const b2y = p2.y - (p3.y - p1.y) / (6 * (d2 + d3)) * d2;
    d += `C${fmt(b1x)},${fmt(b1y)} ${fmt(b2x)},${fmt(b2y)} ${fmt(p2.x)},${fmt(p2.y)}`;
  }
  return d;
}

/** Monotone-X cubic (Fritsch-Carlson) — no overshoot between points. */
export function monotonePath(pts: Pt[]): string {
  const n = pts.length;
  if (n < 3) return M(pts[0]) + pts.slice(1).map(L).join("");
  const dx: number[] = [];
  const dy: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    slope[i] = dx[i] === 0 ? 0 : dy[i] / dx[i];
  }
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (slope[i - 1] + slope[i]) / 2;
    }
  }
  // enforce monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / slope[i];
      const b = m[i + 1] / slope[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        const f = 3 / h;
        m[i] = f * a * slope[i];
        m[i + 1] = f * b * slope[i];
      }
    }
  }
  let d = M(pts[0]);
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3;
    const c1y = pts[i].y + (m[i] * dx[i]) / 3;
    const c2x = pts[i + 1].x - dx[i] / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * dx[i]) / 3;
    d += `C${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(pts[i + 1].x)},${fmt(pts[i + 1].y)}`;
  }
  return d;
}

/* =============================================================================
 * Area path (§4.3) — top edge forward (interp) + bottom edge reversed, closed.
 * ========================================================================== */

export function areaPath(top: Pt[], bottom: Pt[], interp: Interp = "linear"): string {
  if (top.length === 0) return "";
  const topD = linePath(top, interp);
  const rev = [...bottom].reverse();
  // join: connect last top point to first reversed-bottom point, line back, close
  const bottomD = rev.length ? L(rev[0]) + rev.slice(1).map(L).join("") : "";
  return `${topD}${bottomD}Z`;
}

/* =============================================================================
 * Basic symbol shapes (§5.3) — centered at origin, scaled to `area` (pt²).
 * `s = sqrt(area)/2` is the half-extent.
 * ========================================================================== */

export function symbolPath(shape: BasicSymbol, area: number): string {
  const s = Math.sqrt(Math.max(1, area)) / 2;
  switch (shape) {
    case "circle":
      // r so that π r² = area
      {
        const r = Math.sqrt(area / Math.PI);
        return `M${fmt(-r)},0a${fmt(r)},${fmt(r)} 0 1,0 ${fmt(2 * r)},0a${fmt(r)},${fmt(r)} 0 1,0 ${fmt(-2 * r)},0`;
      }
    case "square":
      return `M${fmt(-s)},${fmt(-s)}h${fmt(2 * s)}v${fmt(2 * s)}h${fmt(-2 * s)}Z`;
    case "triangle":
      return `M0,${fmt(-s)}L${fmt(s)},${fmt(s)}L${fmt(-s)},${fmt(s)}Z`;
    case "diamond":
      return `M0,${fmt(-s)}L${fmt(s)},0L0,${fmt(s)}L${fmt(-s)},0Z`;
    case "pentagon": {
      const pts: string[] = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        pts.push(`${fmt(s * Math.cos(a))},${fmt(s * Math.sin(a))}`);
      }
      return `M${pts.join("L")}Z`;
    }
    case "plus": {
      const t = s / 3;
      return (
        `M${fmt(-t)},${fmt(-s)}h${fmt(2 * t)}v${fmt(s - t)}h${fmt(s - t)}v${fmt(2 * t)}` +
        `h${fmt(-(s - t))}v${fmt(s - t)}h${fmt(-2 * t)}v${fmt(-(s - t))}h${fmt(-(s - t))}` +
        `v${fmt(-2 * t)}h${fmt(s - t)}Z`
      );
    }
    case "cross": {
      // rotated plus (X)
      const t = s / 3;
      return `M${fmt(-s)},${fmt(-s + t)}L${fmt(-s + t)},${fmt(-s)}L0,${fmt(-t)}L${fmt(s - t)},${fmt(-s)}L${fmt(s)},${fmt(-s + t)}L${fmt(t)},0L${fmt(s)},${fmt(s - t)}L${fmt(s - t)},${fmt(s)}L0,${fmt(t)}L${fmt(-s + t)},${fmt(s)}L${fmt(-s)},${fmt(s - t)}L${fmt(-t)},0Z`;
    }
    case "asterisk": {
      // six radial strokes as a star outline
      const pts: string[] = [];
      const inner = s * 0.4;
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 6;
        const r = i % 2 === 0 ? s : inner;
        pts.push(`${fmt(r * Math.cos(a))},${fmt(r * Math.sin(a))}`);
      }
      return `M${pts.join("L")}Z`;
    }
    default:
      return symbolPath("circle", area);
  }
}

/* =============================================================================
 * Annular sector (pie / donut) (§8.3) — angles clockwise from 12 o'clock.
 * ========================================================================== */

export function annularSectorPath(
  cx: number,
  cy: number,
  ri: number,
  ro: number,
  a0: number,
  a1: number,
  inset = 0,
): string {
  const pad = ro > 0 ? inset / ro : 0;
  let s0 = a0 + pad;
  let s1 = a1 - pad;
  if (s1 < s0) {
    // collapse to midline when inset eats the whole slice
    const mid = (a0 + a1) / 2;
    s0 = mid;
    s1 = mid;
  }
  const p = (r: number, a: number): [number, number] => [
    cx + r * Math.sin(a),
    cy - r * Math.cos(a),
  ];
  const large = s1 - s0 > Math.PI ? 1 : 0;
  const [ox0, oy0] = p(ro, s0);
  const [ox1, oy1] = p(ro, s1);
  if (ri > 0) {
    const [ix1, iy1] = p(ri, s1);
    const [ix0, iy0] = p(ri, s0);
    return (
      `M${fmt(ox0)},${fmt(oy0)}A${fmt(ro)},${fmt(ro)} 0 ${large} 1 ${fmt(ox1)},${fmt(oy1)}` +
      `L${fmt(ix1)},${fmt(iy1)}A${fmt(ri)},${fmt(ri)} 0 ${large} 0 ${fmt(ix0)},${fmt(iy0)}Z`
    );
  }
  return `M${fmt(cx)},${fmt(cy)}L${fmt(ox0)},${fmt(oy0)}A${fmt(ro)},${fmt(ro)} 0 ${large} 1 ${fmt(ox1)},${fmt(oy1)}Z`;
}

/** Stroke-dasharray string from a dash number array. */
export function dashArray(dash?: number[]): string | undefined {
  return dash && dash.length ? dash.join(",") : undefined;
}
