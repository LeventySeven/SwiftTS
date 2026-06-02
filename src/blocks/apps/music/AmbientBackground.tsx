"use client";
/**
 * `<AmbientBackground>` — the heavily-blurred, slowly-morphing ambient gradient
 * that sits behind the Apple Music "Now Playing" / Lyrics view.
 *
 * It is exactly the thing the reference shows: a smoky, dreamy field of colors
 * pulled from the album artwork, drifting on its own. Composition (front→back):
 *
 *   1. <AnimatedMeshGradient>  — a 4×4 (or 3×3) lattice whose colors come from
 *      `extractPalette(artwork)`; interior nodes drift on a slow sine so the
 *      whole surface morphs. Over-scanned past the box and CSS-blurred heavily
 *      (`blur(58px)`) so the look is depth, not a rectangle.
 *   2. a dark scrim  — radial vignette + vertical wash that anchors the white
 *      type and gives the Apple "smoky" depth.
 *
 * Colors: the caller may pass an explicit `colors` palette (e.g. derived once at
 * a higher level), OR pass `artworkUrl` and let this component run
 * `extractPalette` itself on mount. A `fallbackColors` palette renders on the
 * server / before extraction completes so there's never a flash of empty black.
 *
 * SSR-safe: `extractPalette` only runs inside an effect (it touches `Image`,
 * `canvas`, `document`); the first paint uses `fallbackColors`. reduce-motion is
 * handled by `<AnimatedMeshGradient>` itself (it freezes on the base mesh) and we
 * additionally disable the CSS "breathing" wobble.
 */
import * as React from "react";
import {
  AnimatedMeshGradient,
  extractPalette,
  type MeshPoint,
} from "../../../components/shapes/MeshGradient";
import { useEnvironment } from "../../../system/environment";
import styles from "./nowplaying.module.css";

export interface AmbientBackgroundProps {
  /**
   * Explicit palette to build the mesh from (most-dominant first). If omitted,
   * the component derives it from `artworkUrl` via `extractPalette`.
   */
  colors?: string[];
  /** Album-art URL to derive the palette from when `colors` isn't given. */
  artworkUrl?: string;
  /** Palette used on the server + until extraction resolves. */
  fallbackColors?: string[];
  /** Mesh lattice size. 4 = richer (16 nodes), 3 = simpler (9 nodes). Default 4. */
  grid?: 3 | 4;
  /** Master morph speed (passed to `<AnimatedMeshGradient speed>`). Default 0.05. */
  speed?: number;
  /** Peak interior drift (passed to `<AnimatedMeshGradient amplitude>`). Default 0.09. */
  amplitude?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A pleasant default palette (Apple-Music-ish warm magenta→violet) used when no
 * artwork and no colors are supplied, and for the SSR first paint.
 */
const DEFAULT_PALETTE = ["#f0356a", "#7b2ff7", "#ff7a45", "#2a0a3a"];

/**
 * Build a `width×height` lattice of evenly-spaced control points, with the
 * interior nodes nudged off-grid so the base mesh already looks organic (the
 * animation then drifts them further). Edge/corner nodes stay pinned to the
 * border so the surface is always full-bleed.
 */
function latticePoints(n: number): MeshPoint[] {
  const pts: MeshPoint[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let x = c / (n - 1);
      let y = r / (n - 1);
      const interior = r > 0 && r < n - 1 && c > 0 && c < n - 1;
      if (interior) {
        // deterministic jitter by index so SSR + client agree
        const i = r * n + c;
        x += (((i * 0.137) % 1) - 0.5) * 0.18;
        y += (((i * 0.291) % 1) - 0.5) * 0.18;
      }
      pts.push({ x, y });
    }
  }
  return pts;
}

/**
 * Expand a (possibly short) palette into exactly `n*n` colors arranged so that
 * adjacent lattice cells blend pleasantly. We cycle the palette but offset each
 * row so the same color never tiles in a column — that keeps the field varied
 * rather than striped. A darker tail color is salted into the bottom row for the
 * Apple "fades to dark at the floor" depth.
 */
function meshColors(palette: string[], n: number): string[] {
  const base = palette.length ? palette : DEFAULT_PALETTE;
  // ensure we have at least 4 swatches to draw from
  const pool = base.length >= 4 ? base : [...base, ...DEFAULT_PALETTE].slice(0, 4);
  const out: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const idx = (r * 2 + c * 1 + (r % 2 ? 1 : 0)) % pool.length;
      let col = pool[idx];
      // bottom row biases toward the darkest swatch (last, least-dominant)
      if (r === n - 1) col = pool[pool.length - 1];
      // top-left corner gets the most-dominant color (the "light source")
      if (r === 0 && c === 0) col = pool[0];
      out.push(col);
    }
  }
  return out;
}

export function AmbientBackground({
  colors,
  artworkUrl,
  fallbackColors = DEFAULT_PALETTE,
  grid = 4,
  speed = 0.05,
  amplitude = 0.09,
  className,
  style,
}: AmbientBackgroundProps): React.ReactElement {
  const { reduceMotion } = useEnvironment();

  // The live palette: explicit `colors` win; else extracted-from-artwork; else
  // fallback. We keep extracted in state so the effect can fill it post-mount.
  const [extracted, setExtracted] = React.useState<string[] | null>(null);
  const palette = colors ?? extracted ?? fallbackColors;

  React.useEffect(() => {
    // only derive when we have no explicit palette but DO have artwork
    if (colors || !artworkUrl) return;
    let live = true;
    extractPalette(artworkUrl, 5)
      .then((p) => {
        if (live && p.length) setExtracted(p);
      })
      .catch(() => {
        /* tainted / load failure → keep the fallback */
      });
    return () => {
      live = false;
    };
  }, [colors, artworkUrl]);

  const n = grid;
  // memoize the lattice (stable) but recompute colors when the palette changes
  const points = React.useMemo(() => latticePoints(n), [n]);
  const meshCols = React.useMemo(() => meshColors(palette, n), [palette, n]);

  const cls = [styles.ambient, className].filter(Boolean).join(" ");

  return (
    <div className={cls} style={style} aria-hidden>
      {/* wrapper carries the over-scan + heavy CSS blur + slow "breathe" wobble;
          the canvas itself fills the wrapper 100%. (AnimatedMeshGradient forwards
          only className/style, so the data-attr lives on this div.) */}
      <div
        className={styles.ambientMesh}
        data-breathe={reduceMotion ? "false" : "true"}
      >
        <AnimatedMeshGradient
          width={n}
          height={n}
          points={points}
          colors={meshCols}
          smoothsColors
          colorSpace="perceptual"
          speed={speed}
          amplitude={amplitude}
          maxResolution={200}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div className={styles.scrim} />
    </div>
  );
}

AmbientBackground.displayName = "AmbientBackground";
