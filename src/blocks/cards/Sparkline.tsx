/**
 * `<Sparkline>` — a tiny inline trend line for metric tiles.
 *
 * A self-contained, dependency-light SVG line (optionally area-filled) sized to
 * fill its box via `preserveAspectRatio="none"`, so it stretches to whatever
 * width/height the tile gives it. Deliberately NOT the full Swift-Charts engine:
 * a metric sparkline wants zero axes, zero ticks, and a single smoothed stroke —
 * this keeps a StatTile cheap and SSR-safe (pure geometry, no hooks).
 *
 * The path is a Catmull-Rom-style smoothed polyline through the normalized
 * points; the stroke uses `currentColor` so it inherits the delta tint. An
 * optional soft area gradient sits under the line (the iOS widget look).
 */
import * as React from "react";

export interface SparklineProps {
  /** Y-values, oldest → newest. Need ≥2 points to draw a line. */
  data: number[];
  /** Line color. Defaults to `currentColor` (inherits the tile/delta tint). */
  color?: string;
  /** Stroke width in the 100×32 viewBox units. Default `2`. */
  strokeWidth?: number;
  /** Fill a soft area under the line (gradient down to transparent). Default `true`. */
  fill?: boolean;
  /** CSS width. Default `"100%"`. */
  width?: number | string;
  /** CSS height in px. Default `32`. */
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

const VW = 100;
const VH = 32;
const PAD = 2; // keep the stroke off the edges

/** Map raw values into the viewBox, leaving PAD on every edge. */
function project(data: number[]): Array<[number, number]> {
  const n = data.length;
  if (n === 0) return [];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const innerW = VW - PAD * 2;
  const innerH = VH - PAD * 2;
  return data.map((v, i) => {
    const x = PAD + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    // invert y (SVG y grows downward; higher value → higher on screen)
    const y = PAD + innerH - ((v - min) / span) * innerH;
    return [x, y];
  });
}

/** A smooth Catmull-Rom → cubic-Bézier line through the points. */
function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  const d: string[] = [`M ${pts[0][0]} ${pts[0][1]}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0]} ${p2[1]}`);
  }
  return d.join(" ");
}

let gidCounter = 0;

export function Sparkline({
  data,
  color = "currentColor",
  strokeWidth = 2,
  fill = true,
  width = "100%",
  height = 32,
  className,
  style,
}: SparklineProps): React.ReactElement {
  // SSR-safe stable id for the area gradient.
  const reactId = (React as { useId?: () => string }).useId?.();
  const gidRef = React.useRef<string | null>(null);
  if (gidRef.current === null) {
    gidRef.current = reactId
      ? `sui-spark-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`
      : `sui-spark-${gidCounter++}`;
  }
  const gid = gidRef.current;

  const pts = project(data);
  const line = smoothPath(pts);
  const area =
    pts.length > 1
      ? `${line} L ${pts[pts.length - 1][0]} ${VH} L ${pts[0][0]} ${VH} Z`
      : "";

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", color, overflow: "visible", ...style }}
    >
      {fill && area ? (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} stroke="none" />
        </>
      ) : null}
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

Sparkline.displayName = "Sparkline";
