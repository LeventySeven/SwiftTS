"use client";
/**
 * `<LyricsView>` — the time-synced lyrics column of the Apple Music "Now Playing"
 * view (the big bold left-aligned type on the right of the reference).
 *
 * Behaviour (matches the reference):
 *   • Lines are stacked vertically; each line owns a [time, nextTime) window.
 *   • The ACTIVE line (currentTime inside its window) is BRIGHT white, heavier,
 *     slightly larger, zero blur.
 *   • PAST lines dim to ~35% (already read).
 *   • UPCOMING lines ramp from ~55% down to ~15% with distance from active, and
 *     pick up a little progressive blur the further ahead they are.
 *   • Opacity / blur / scale transition on a snappy spring.
 *   • AUTO-SCROLL: the active line is kept ~40% down from the top of the column
 *     by translating the whole track (a transform spring, GPU-cheap).
 *   • INSTRUMENTAL GAP: when there's no active line for > ~4s (an intro, an outro,
 *     or a long musical break), a pulsing "•••" three-dot indicator is shown at
 *     the position of the upcoming line.
 *
 * Pure presentational + measurement; owns no track state — `currentTime` is
 * driven by the parent (the demo simulates it). `"use client"` because it
 * measures line offsets with refs/layout and animates with a rAF-free CSS spring.
 */
import * as React from "react";
import { useEnvironment } from "../../../system/environment";
import styles from "./nowplaying.module.css";

/** One timed lyric line. `time` is the second at which the line becomes active. */
export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsViewProps {
  /** Timed lyric lines. Need NOT be pre-sorted — we sort by `time`. */
  lines: LyricLine[];
  /** Current playback position in seconds (drives the active line + scroll). */
  currentTime: number;
  /**
   * Gap (seconds) with no active line before the "•••" instrumental indicator
   * appears. Default 4.
   */
  gapThreshold?: number;
  /**
   * Where the active line sits in the column, as a fraction from the top.
   * Default 0.4 (≈40% down, per the reference).
   */
  activeAnchor?: number;
  /** Click a line to seek to its timestamp. */
  onSeek?: (time: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

type LineState = "past" | "active" | "upcoming";

/**
 * Resolve, for `currentTime`, the index of the active line (or -1 if we're in a
 * gap before the first line / inside an instrumental break). A line is active
 * from its `time` until the next line's `time`.
 */
function activeIndex(sorted: LyricLine[], t: number): number {
  let idx = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (t >= sorted[i].time) idx = i;
    else break;
  }
  return idx;
}

export function LyricsView({
  lines,
  currentTime,
  gapThreshold = 4,
  activeAnchor = 0.4,
  onSeek,
  className,
  style,
}: LyricsViewProps): React.ReactElement {
  const { reduceMotion } = useEnvironment();

  // stable sorted copy (by time) — sorting in render is cheap for lyric-sized arrays
  const sorted = React.useMemo(
    () => [...lines].sort((a, b) => a.time - b.time),
    [lines],
  );

  const active = activeIndex(sorted, currentTime);

  // ── instrumental-gap detection ──
  // We're in a gap when there's no active line yet (intro) OR the time since the
  // current active line started is large AND the next line is still far away.
  const nextTime = active + 1 < sorted.length ? sorted[active + 1].time : Infinity;
  const sinceActive =
    active < 0 ? currentTime : currentTime - sorted[active].time;
  const untilNext = nextTime - currentTime;
  // intro gap (before first line) or a long musical break mid-song
  const inGap =
    (active < 0 && sorted.length > 0 && sorted[0].time - currentTime > gapThreshold) ||
    (active >= 0 && sinceActive > gapThreshold && untilNext > gapThreshold);

  // The index the "•••" indicator should sit BEFORE (the upcoming line). When
  // before the first line, that's 0; otherwise it's active+1.
  const dotsBeforeIndex = active < 0 ? 0 : active + 1;

  // ── auto-scroll: translate the track so the active line sits at `activeAnchor` ──
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const lineRefs = React.useRef<(HTMLParagraphElement | null)[]>([]);
  const [translateY, setTranslateY] = React.useState(0);

  // The element we anchor on: the active line, or (in a gap/intro) the dots row.
  const anchorIndex = active < 0 ? 0 : active;

  React.useLayoutEffect(() => {
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track) return;
    // Prefer the active line element; in a pre-first-line gap, anchor on line 0.
    const el =
      lineRefs.current[anchorIndex] ?? lineRefs.current[0] ?? null;
    if (!el) return;
    const vpH = vp.clientHeight;
    // offsetTop of the line within the track + half its height = its center
    const lineCenter = el.offsetTop + el.offsetHeight / 2;
    // we want lineCenter to land at `activeAnchor` of the viewport height
    const target = vpH * activeAnchor - lineCenter;
    setTranslateY(target);
  }, [anchorIndex, activeAnchor, sorted, inGap, dotsBeforeIndex]);

  // ── per-line visual state ──
  // active === -1 means we're before the first line → everything is upcoming.
  const stateFor = (i: number): LineState => {
    if (active >= 0 && i === active) return "active";
    if (active >= 0 && i < active) return "past";
    return "upcoming";
  };

  const cls = [styles.right, className].filter(Boolean).join(" ");

  // build the children, inserting the dots row at the gap position
  const items: React.ReactNode[] = [];
  sorted.forEach((line, i) => {
    if (inGap && i === dotsBeforeIndex) {
      items.push(<DotsIndicator key="__dots__" reduceMotion={reduceMotion} />);
    }
    const state = stateFor(i);
    // upcoming lines: opacity ramps 0.55 → 0.15 with distance; blur grows slightly
    let opacity = 1;
    let blurPx = 0;
    if (state === "upcoming") {
      const dist = active < 0 ? i + 1 : i - active; // 1,2,3…
      opacity = Math.max(0.15, 0.55 - (dist - 1) * 0.12);
      blurPx = Math.min(2.4, 0.4 + (dist - 1) * 0.45);
    } else if (state === "past") {
      opacity = 0.35;
    }
    items.push(
      <p
        key={i}
        ref={(el) => {
          lineRefs.current[i] = el;
        }}
        className={styles.line}
        data-state={state}
        style={{
          opacity,
          ["--np-line-blur" as string]: `${blurPx}px`,
        }}
        onClick={onSeek ? () => onSeek(line.time) : undefined}
      >
        {line.text}
      </p>,
    );
  });
  // dots after the last line (outro gap)
  if (inGap && dotsBeforeIndex >= sorted.length) {
    items.push(<DotsIndicator key="__dots_end__" reduceMotion={reduceMotion} />);
  }

  return (
    <div className={cls} style={style} aria-label="Lyrics" role="region">
      <div className={styles.lyricsViewport} ref={viewportRef}>
        <div
          className={styles.lyricsTrack}
          ref={trackRef}
          data-reduce={reduceMotion ? "true" : "false"}
          style={{ transform: `translate3d(0, ${translateY}px, 0)` }}
        >
          {items}
        </div>
      </div>
    </div>
  );
}

LyricsView.displayName = "LyricsView";

/** The pulsing "•••" three-dot instrumental-gap indicator. */
function DotsIndicator({
  reduceMotion,
}: {
  reduceMotion: boolean;
}): React.ReactElement {
  return (
    <div
      className={styles.dots}
      data-reduce={reduceMotion ? "true" : "false"}
      aria-label="Instrumental"
      role="img"
    >
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  );
}
