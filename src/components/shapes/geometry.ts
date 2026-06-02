/**
 * Shape geometry primitives — SwiftUI Cluster C9 (shapes & drawing).
 *
 * RE'd from `teardowns/SWIFTUI_C9_shapes-drawing.md` §2 (`Path`), §4 (the
 * `.continuous` squircle), §8 (Circle/Ellipse/Capsule paths), §14 (`UnitPoint`).
 *
 * Pure, server-compatible math: `UnitPoint`, the `PathBuilder` that emits SVG
 * `d` strings (§2.4), the figma-squircle path generator that fills the one
 * irreducible fidelity gap (`.continuous` corners, §4.3 — DESIGNED), and the
 * plain `.circular` rounded-rect / circle / ellipse path emitters (KNOWN
 * geometry). No React, no DOM — importable anywhere.
 */

/* =============================================================================
 * UnitPoint (SUICore:9720) — a fractional point in a shape's box, (0,0)=top-leading.
 * ========================================================================== */

export interface UnitPoint {
  /** 0 = leading edge, 1 = trailing edge. */
  x: number;
  /** 0 = top edge, 1 = bottom edge. */
  y: number;
}

/** The named `UnitPoint` constants SwiftUI exposes (`SUICore:9720`). */
export const UnitPoints = {
  center: { x: 0.5, y: 0.5 },
  leading: { x: 0, y: 0.5 },
  trailing: { x: 1, y: 0.5 },
  top: { x: 0.5, y: 0 },
  bottom: { x: 0.5, y: 1 },
  topLeading: { x: 0, y: 0 },
  topTrailing: { x: 1, y: 0 },
  bottomLeading: { x: 0, y: 1 },
  bottomTrailing: { x: 1, y: 1 },
  zero: { x: 0, y: 0 },
} as const satisfies Record<string, UnitPoint>;

/** Accept either a named point or a literal `{x,y}`. */
export type UnitPointInput = UnitPoint | keyof typeof UnitPoints;

export function resolveUnitPoint(p: UnitPointInput): UnitPoint {
  return typeof p === "string" ? UnitPoints[p] : p;
}

/* =============================================================================
 * PathBuilder (§2.4) — fluent emitter of an SVG `d` string. Method names mirror
 * SwiftUI's `Path` so shape code ports verbatim.
 * ========================================================================== */

export class PathBuilder {
  private d = "";
  private cur: [number, number] | null = null;

  /** `move(to:)` → `M`. */
  moveTo(x: number, y: number): this {
    this.d += `M${num(x)} ${num(y)}`;
    this.cur = [x, y];
    return this;
  }

  /** `addLine(to:)` → `L`. */
  addLine(x: number, y: number): this {
    this.d += `L${num(x)} ${num(y)}`;
    this.cur = [x, y];
    return this;
  }

  /** `addQuadCurve(to:control:)` → `Q`. */
  addQuadCurve(x: number, y: number, cx: number, cy: number): this {
    this.d += `Q${num(cx)} ${num(cy)} ${num(x)} ${num(y)}`;
    this.cur = [x, y];
    return this;
  }

  /** `addCurve(to:control1:control2:)` → `C`. */
  addCurve(
    x: number,
    y: number,
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
  ): this {
    this.d += `C${num(c1x)} ${num(c1y)} ${num(c2x)} ${num(c2y)} ${num(x)} ${num(y)}`;
    this.cur = [x, y];
    return this;
  }

  /** `closeSubpath()` → `Z`. */
  closeSubpath(): this {
    this.d += "Z";
    return this;
  }

  /**
   * `addArc(center:radius:startAngle:endAngle:clockwise:)` → SVG `A`.
   * Angles in radians; `clockwise` follows SwiftUI's y-down convention
   * (`clockwise===true` → SVG `sweep-flag=1`, see §2.4 note).
   */
  addArc(
    cx: number,
    cy: number,
    r: number,
    start: number,
    end: number,
    clockwise: boolean,
  ): this {
    const sx = cx + r * Math.cos(start);
    const sy = cy + r * Math.sin(start);
    const ex = cx + r * Math.cos(end);
    const ey = cy + r * Math.sin(end);
    if (!this.cur) this.moveTo(sx, sy);
    else this.addLine(sx, sy);
    const delta = end - start;
    const sweep = clockwise ? 1 : 0;
    const large = Math.abs(delta) > Math.PI ? 1 : 0;
    this.d += `A${num(r)} ${num(r)} 0 ${large} ${sweep} ${num(ex)} ${num(ey)}`;
    this.cur = [ex, ey];
    return this;
  }

  /** Append a raw `d` fragment (for `Path(string:)` / `addPath`). */
  append(raw: string): this {
    this.d += raw;
    return this;
  }

  build(): string {
    return this.d;
  }
}

/** Trim insignificant float noise so paths stay compact + deterministic. */
function num(v: number): number {
  // round to 3 decimals; avoid `-0`
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

/* =============================================================================
 * Concrete path emitters (KNOWN geometry).
 * ========================================================================== */

/** Plain axis-aligned rectangle (§3.1). */
export function rectPath(w: number, h: number): string {
  return `M0 0L${num(w)} 0L${num(w)} ${num(h)}L0 ${num(h)}Z`;
}

/**
 * `.circular` rounded rect (§4.3 KNOWN geometry) with independent x/y radii,
 * clamped so opposite corners never overlap.
 */
export function circularRoundRectPath(
  w: number,
  h: number,
  rx: number,
  ry: number,
): string {
  const cx = Math.min(Math.max(rx, 0), w / 2);
  const cy = Math.min(Math.max(ry, 0), h / 2);
  return new PathBuilder()
    .moveTo(cx, 0)
    .addLine(w - cx, 0)
    .addQuadCurve(w, cy, w, 0)
    .addLine(w, h - cy)
    .addQuadCurve(w - cx, h, w, h)
    .addLine(cx, h)
    .addQuadCurve(0, h - cy, 0, h)
    .addLine(0, cy)
    .addQuadCurve(cx, 0, 0, 0)
    .closeSubpath()
    .build();
}

/** Per-corner `.circular` rounded rect (UnevenRoundedRectangle, §5). */
export interface CornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export function unevenCircularPath(
  w: number,
  h: number,
  r: CornerRadii,
): string {
  const cap = Math.min(w, h) / 2;
  const tl = clamp(r.topLeft, 0, cap);
  const tr = clamp(r.topRight, 0, cap);
  const br = clamp(r.bottomRight, 0, cap);
  const bl = clamp(r.bottomLeft, 0, cap);
  return new PathBuilder()
    .moveTo(tl, 0)
    .addLine(w - tr, 0)
    .addQuadCurve(w, tr, w, 0)
    .addLine(w, h - br)
    .addQuadCurve(w - br, h, w, h)
    .addLine(bl, h)
    .addQuadCurve(0, h - bl, 0, h)
    .addLine(0, tl)
    .addQuadCurve(tl, 0, 0, 0)
    .closeSubpath()
    .build();
}

/** Circle — square-and-center on the offered box (§8.1). */
export function circlePath(w: number, h: number): string {
  const r = Math.min(w, h) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return `M${num(cx - r)} ${num(cy)}A${num(r)} ${num(r)} 0 1 0 ${num(cx + r)} ${num(cy)}A${num(r)} ${num(r)} 0 1 0 ${num(cx - r)} ${num(cy)}Z`;
}

/** Ellipse — inscribes the full box (§8.2). */
export function ellipsePath(w: number, h: number): string {
  const rx = w / 2;
  const ry = h / 2;
  return `M0 ${num(ry)}A${num(rx)} ${num(ry)} 0 1 0 ${num(w)} ${num(ry)}A${num(rx)} ${num(ry)} 0 1 0 0 ${num(ry)}Z`;
}

/** Capsule — radius = half the shorter side (§8.3). */
export function capsulePath(w: number, h: number): string {
  const r = Math.min(w, h) / 2;
  return circularRoundRectPath(w, h, r, r);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/* =============================================================================
 * figma-squircle (§4.3) — the DESIGNED `.continuous` corner renderer.
 *
 * The SwiftUI interface only NAMES `.continuous`; it never defines the spline.
 * We replicate Apple's superellipse corner with the same construction Figma's
 * "Smooth corners" uses: each corner is a Bézier ramp → circular arc → Bézier
 * ramp, parameterized by (cornerRadius, cornerSmoothing). `cornerSmoothing=0.6`
 * matches the Apple icon/control look. Port of the @phamfoo/figma-squircle
 * geometry, condensed and dependency-free.
 * ========================================================================== */

export interface SquircleParams {
  width: number;
  height: number;
  cornerRadius?: number;
  /** 0 = pure circular arc, 1 = maximally smoothed. Apple ≈ 0.6. */
  cornerSmoothing?: number;
  topLeftCornerRadius?: number;
  topRightCornerRadius?: number;
  bottomRightCornerRadius?: number;
  bottomLeftCornerRadius?: number;
}

interface CornerPathParams {
  a: number;
  b: number;
  c: number;
  d: number;
  p: number;
  arcSectionLength: number;
  cornerRadius: number;
}

/**
 * Derive the per-corner control offsets for a given radius + smoothing.
 * Mirrors figma-squircle's `getPathParamsForCorner`.
 */
function cornerParams(
  cornerRadius: number,
  cornerSmoothing: number,
  maxRadius: number,
): CornerPathParams {
  // clamp the radius so the rounding never exceeds half the shortest side
  let radius = cornerRadius;
  let smoothing = cornerSmoothing;
  if (radius > maxRadius) {
    radius = maxRadius;
  }
  // figma-squircle distributes a 90° corner into a true arc plus two ramps.
  // `p` is how far from the corner the rounding begins along each edge.
  // When the ideal `p` would exceed the half-side, reduce smoothing toward 0.
  let p = (1 + smoothing) * radius;
  const maxP = maxRadius;
  if (p > maxP) {
    const reduced = maxP / (1 + smoothing);
    // shrink radius rather than break geometry
    radius = Math.min(radius, reduced);
    p = (1 + smoothing) * radius;
  }

  const arcMeasure = (90 * (1 - smoothing)) / 2; // half the residual arc, in deg
  const arcSectionLength =
    Math.sin(toRad(arcMeasure / 2)) * radius * Math.SQRT2;

  const angleAlpha = (90 - 90 * (1 - smoothing)) / 4;
  const p3ToP4Distance = radius * Math.tan(toRad(angleAlpha / 2));

  const angleBeta = 45 * smoothing;
  const c = p3ToP4Distance * Math.cos(toRad(angleBeta));
  const d = c * Math.tan(toRad(angleBeta));

  const b = (p - arcSectionLength - c - d) / 3;
  const a = 2 * b;

  return { a, b, c, d, p, arcSectionLength, cornerRadius: radius };
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Emit the rounded-corner sub-path for ONE corner (figma-squircle). */
function drawCorner(
  cp: CornerPathParams,
  cornerSmoothing: number,
): string {
  const { a, b, c, d, p, arcSectionLength, cornerRadius } = cp;
  if (cornerRadius <= 0) {
    // degenerate: a hard corner is just a line of length `p` (== 0 here)
    return "";
  }
  if (cornerSmoothing <= 0) {
    // pure circular arc fallback
    return `a ${cornerRadius} ${cornerRadius} 0 0 1 ${num(cornerRadius)} ${num(cornerRadius)}`;
  }
  return (
    `c ${num(a)} 0 ${num(a + b)} 0 ${num(a + b + c)} ${num(d)} ` +
    `a ${num(cornerRadius)} ${num(cornerRadius)} 0 0 1 ${num(arcSectionLength)} ${num(arcSectionLength)} ` +
    `c ${num(d)} ${num(c)} ${num(d)} ${num(b + c)} ${num(d)} ${num(a + b + c)}`
  );
}

/**
 * Build the full continuous-corner `d` string for a box with per-corner radii.
 * Returns an SVG path that starts at the top edge and travels clockwise.
 */
export function squirclePath(params: SquircleParams): string {
  const { width, height, cornerSmoothing = 0.6 } = params;
  const base = params.cornerRadius ?? 0;
  const tl = params.topLeftCornerRadius ?? base;
  const tr = params.topRightCornerRadius ?? base;
  const br = params.bottomRightCornerRadius ?? base;
  const bl = params.bottomLeftCornerRadius ?? base;

  const maxRadius = Math.min(width, height) / 2;
  const pTL = cornerParams(tl, cornerSmoothing, maxRadius);
  const pTR = cornerParams(tr, cornerSmoothing, maxRadius);
  const pBR = cornerParams(br, cornerSmoothing, maxRadius);
  const pBL = cornerParams(bl, cornerSmoothing, maxRadius);

  // start just after the top-left corner's horizontal ramp
  const startX = pTL.cornerRadius > 0 ? pTL.p : 0;

  let dStr = `M ${num(startX)} 0`;
  // top edge → top-right corner
  dStr += ` L ${num(width - (pTR.cornerRadius > 0 ? pTR.p : 0))} 0`;
  dStr += rotateCorner(drawCorner(pTR, cornerSmoothing), 0, width, height, "tr");
  // right edge → bottom-right corner
  dStr += ` L ${num(width)} ${num(height - (pBR.cornerRadius > 0 ? pBR.p : 0))}`;
  dStr += rotateCorner(drawCorner(pBR, cornerSmoothing), 0, width, height, "br");
  // bottom edge → bottom-left corner
  dStr += ` L ${num(pBL.cornerRadius > 0 ? pBL.p : 0)} ${num(height)}`;
  dStr += rotateCorner(drawCorner(pBL, cornerSmoothing), 0, width, height, "bl");
  // left edge → top-left corner
  dStr += ` L 0 ${num(pTL.cornerRadius > 0 ? pTL.p : 0)}`;
  dStr += rotateCorner(drawCorner(pTL, cornerSmoothing), 0, width, height, "tl");
  dStr += " Z";
  return dStr;
}

/**
 * The relative `drawCorner` fragment is authored for the top-right corner's
 * orientation; the other corners reuse it by flipping the relative deltas. Since
 * `drawCorner` already emits RELATIVE (`c`/`a` lowercase) commands oriented for a
 * clockwise top-right turn, we re-orient per corner by transforming each command.
 */
function rotateCorner(
  fragment: string,
  _phase: number,
  _w: number,
  _h: number,
  corner: "tr" | "br" | "bl" | "tl",
): string {
  if (!fragment) return "";
  // `drawCorner` is authored for the TR corner (turning right→down).
  // For the others, rotate the relative vector deltas by 90°/180°/270° CW.
  // Rotation of a relative delta (dx,dy) clockwise in y-down space:
  //   tr: (dx,dy)           br: (-dy,dx)        bl: (-dx,-dy)      tl: (dy,-dx)
  const rot = (dx: number, dy: number): [number, number] => {
    switch (corner) {
      case "tr":
        return [dx, dy];
      case "br":
        return [-dy, dx];
      case "bl":
        return [-dx, -dy];
      case "tl":
        return [dy, -dx];
    }
  };
  return transformRelativeFragment(fragment, rot);
}

/**
 * Apply a 2D rotation to every relative command in a `c`/`a`-only fragment.
 * Handles lowercase `c` (cubic) and `a` (arc); the arc's flags are kept,
 * only its endpoint delta is rotated (radii are isotropic so unchanged).
 */
function transformRelativeFragment(
  fragment: string,
  rot: (dx: number, dy: number) => [number, number],
): string {
  const tokens = fragment.trim().split(/\s+/);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === "c") {
      const nums = tokens.slice(i + 1, i + 7).map(Number);
      const [x1, y1] = rot(nums[0], nums[1]);
      const [x2, y2] = rot(nums[2], nums[3]);
      const [x3, y3] = rot(nums[4], nums[5]);
      out.push(
        `c ${num(x1)} ${num(y1)} ${num(x2)} ${num(y2)} ${num(x3)} ${num(y3)}`,
      );
      i += 7;
    } else if (cmd === "a") {
      const rx = Number(tokens[i + 1]);
      const ry = Number(tokens[i + 2]);
      const xr = tokens[i + 3];
      const laf = tokens[i + 4];
      const sf = tokens[i + 5];
      const [ex, ey] = rot(Number(tokens[i + 6]), Number(tokens[i + 7]));
      out.push(`a ${num(rx)} ${num(ry)} ${xr} ${laf} ${sf} ${num(ex)} ${num(ey)}`);
      i += 8;
    } else {
      out.push(cmd);
      i += 1;
    }
  }
  return " " + out.join(" ");
}
