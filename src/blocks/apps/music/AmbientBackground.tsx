"use client";
/**
 * `<AmbientBackground>` — the heavily-blurred, slowly-morphing ambient gradient
 * that fills the whole Apple Music full-screen "Now Playing" / Lyrics view.
 *
 * This is THE thing the reference shows: a smoky, dreamy field of colors pulled
 * from the album artwork, drifting on its own — very smooth, very slow, very
 * soft. Apple's real player blurs a morphing mesh of the art's dominant colors
 * across the entire screen and lays a dark vignette over it for legibility.
 *
 * Composition (front→back):
 *
 *   1. <AnimatedMeshGradient>  — a 4×4 lattice whose colors come from
 *      `extractPalette(artwork)`; interior nodes drift on a slow Lissajous so the
 *      whole surface morphs. Over-scanned past the box and CSS-blurred HARD
 *      (`blur(72px)`) so the look reads as depth, never a rectangle. We run TWO
 *      stacked, counter-drifting copies (the second rotated + offset + a touch
 *      slower) so the blend never looks like a single tiling mesh — that is the
 *      trick that makes Apple's gradient feel infinitely smooth rather than a
 *      4-color radial. The second layer is `mix-blend-mode: screen` so its color
 *      adds light, brightening the seams between the first layer's nodes.
 *   2. a dark scrim — radial vignette + vertical wash that anchors the white type
 *      and gives the Apple "smoky" depth, plus a soft inner vignette ring.
 *
 * Colors: the caller may pass an explicit `colors` palette (e.g. derived once at
 * a higher level), OR pass `artworkUrl` and let this component run
 * `extractPalette` itself on mount. A `fallbackColors` palette renders on the
 * server / before extraction completes so there's never a flash of empty black.
 *
 * SSR-safe: `extractPalette` only runs inside an effect (it touches `Image`,
 * `canvas`, `document`); the first paint uses `fallbackColors`. reduce-motion is
 * handled by `<AnimatedMeshGradient>` itself (it freezes on the base mesh) and we
 * additionally disable the CSS "breathing" wobble below.
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
  /**
   * Master morph speed (passed to `<AnimatedMeshGradient speed>`). Default 0.022
   * — DELIBERATELY very slow so the motion is barely-perceptible, like Apple's.
   */
  speed?: number;
  /**
   * Peak interior drift (passed to `<AnimatedMeshGradient amplitude>`). Default
   * 0.13 — generous travel, but because it's slow + heavily blurred it reads as
   * a soft morph, not a wobble.
   */
  amplitude?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A pleasant default palette (Apple-Music-ish warm magenta→violet→ember) used
 * when no artwork and no colors are supplied, and for the SSR first paint.
 */
const DEFAULT_PALETTE = ["#f0356a", "#7b2ff7", "#ff7a45", "#2a0a3a"];

/**
 * Build a `n×n` lattice of evenly-spaced control points, with the interior nodes
 * nudged off-grid so the base mesh already looks organic (the animation then
 * drifts them further). Edge/corner nodes stay pinned to the border so the
 * surface is always full-bleed. `phase` rotates the jitter pattern so two
 * stacked lattices don't land their nodes in the same places (decorrelation =
 * smoothness).
 */
function latticePoints(n: number, phase = 0): MeshPoint[] {
  const pts: MeshPoint[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let x = c / (n - 1);
      let y = r / (n - 1);
      const interior = r > 0 && r < n - 1 && c > 0 && c < n - 1;
      if (interior) {
        // deterministic jitter by index so SSR + client agree
        const i = r * n + c;
        x += (((i * 0.137 + phase) % 1) - 0.5) * 0.2;
        y += (((i * 0.291 + phase) % 1) - 0.5) * 0.2;
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
 * rather than striped. The most-dominant color seeds the upper-left "light
 * source"; the darkest swatch is biased into the bottom row for the Apple
 * "fades to dark at the floor" depth. `rotate` shifts the whole arrangement so
 * the second (overlay) layer carries different colors in different places.
 */
function meshColors(palette: string[], n: number, rotate = 0): string[] {
  const base = palette.length ? palette : DEFAULT_PALETTE;
  // ensure we have at least 4 swatches to draw from
  const pool = base.length >= 4 ? base : [...base, ...DEFAULT_PALETTE].slice(0, 4);
  const out: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const idx = (r * 2 + c * 1 + (r % 2 ? 1 : 0) + rotate) % pool.length;
      let col = pool[idx];
      // bottom row biases toward the darkest swatch (last, least-dominant)
      if (r === n - 1) col = pool[pool.length - 1];
      // top-left corner gets the most-dominant color (the "light source")
      if (r === 0 && c === 0 && rotate === 0) col = pool[0];
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
  speed = 0.022,
  amplitude = 0.13,
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
  // memoize the two decorrelated lattices (stable) but recompute colors when the
  // palette changes. The second layer is phase-shifted so its nodes/colors fall
  // in different places — stacking two slow meshes is what kills all banding.
  const pointsA = React.useMemo(() => latticePoints(n, 0), [n]);
  const pointsB = React.useMemo(() => latticePoints(n, 0.41), [n]);
  const colsA = React.useMemo(() => meshColors(palette, n, 0), [palette, n]);
  const colsB = React.useMemo(() => meshColors(palette, n, 2), [palette, n]);

  const cls = [styles.ambient, className].filter(Boolean).join(" ");

  return (
    <div className={cls} style={style} aria-hidden>
      {/* wrapper carries the over-scan + heavy CSS blur + slow "breathe" wobble;
          each canvas fills the wrapper 100%. Two stacked, counter-drifting
          meshes blend into one continuous smoke. (AnimatedMeshGradient forwards
          only className/style, so the data-attr lives on this div.) */}
      <div
        className={styles.ambientMesh}
        data-breathe={reduceMotion ? "false" : "true"}
      >
        {/* base layer — the dominant smoke */}
        <AnimatedMeshGradient
          width={n}
          height={n}
          points={pointsA}
          colors={colsA}
          smoothsColors
          colorSpace="perceptual"
          speed={speed}
          amplitude={amplitude}
          maxResolution={180}
          className={styles.ambientLayerA}
        />
        {/* overlay layer — slower, rotated, screen-blended → fills the gaps with
            soft light so the field never resolves into discrete color blobs */}
        <AnimatedMeshGradient
          width={n}
          height={n}
          points={pointsB}
          colors={colsB}
          smoothsColors
          colorSpace="perceptual"
          speed={speed * 0.66}
          amplitude={amplitude * 0.82}
          maxResolution={180}
          className={styles.ambientLayerB}
        />
      </div>
      <div className={styles.scrim} />
    </div>
  );
}

AmbientBackground.displayName = "AmbientBackground";
