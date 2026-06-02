"use client";
/**
 * `<NowPlayingScreen>` — the full-screen Apple Music "Now Playing" / Lyrics view.
 *
 * Composition (matches the reference photo):
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  <AmbientBackground>  (morphing mesh from artwork + dark scrim)│
 *   │                                                               │
 *   │   ┌── album art ──┐          Did you forget? Do it for life   │
 *   │   │  white card   │          Chicago that time, all bullshit… │  ← <LyricsView>
 *   │   └───────────────┘          Wonderful vibe, wonderful night  │
 *   │   Trance                     Did it with Trav                 │
 *   │   Travis Scott — HEROES…     All I can hear is you and I      │
 *   │   ▷ ──────●────────────                                       │
 *   └──────────────────────────────────────────────────────────────┘
 *
 *   • LEFT  — the album art in a WHITE rounded card, Title + "Artist — Album"
 *     beneath, then an inline transport (play/pause + the kit <Slider> scrubber).
 *   • RIGHT — the time-synced <LyricsView>.
 *   • BEHIND — <AmbientBackground>: an <AnimatedMeshGradient> built from the
 *     artwork palette, heavily blurred, under a dark scrim.
 *
 * Fully controllable (`currentTime` / `playing` / `onSeek` / `onPlayingChange`),
 * with internal-state fallbacks AND a built-in playback SIMULATION so the demo
 * animates live: a `useEffect` advances `currentTime` ~10×/s while playing, and
 * the <Slider> scrubs it. `"use client"` — owns playback state + rAF-free timer.
 */
import * as React from "react";
import { Slider } from "../../../components/Slider";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import { AmbientBackground } from "./AmbientBackground";
import { LyricsView, type LyricLine } from "./LyricsView";
import styles from "./nowplaying.module.css";

export interface NowPlayingScreenProps {
  /** Track metadata. */
  title?: string;
  artist?: string;
  album?: string;
  /** Album-art URL (used both for the card AND to derive the ambient palette). */
  artworkUrl?: string;
  /** Explicit ambient palette (skips artwork extraction). */
  ambientColors?: string[];
  /** Track length in seconds (for the scrubber + lyric windows). */
  durationSec?: number;
  /** Timed lyric lines. */
  lyrics?: LyricLine[];

  /** Controlled playback position (seconds). Falls back to internal simulation. */
  currentTime?: number;
  onTimeChange?: (t: number) => void;
  /** Controlled play/pause. */
  playing?: boolean;
  onPlayingChange?: (playing: boolean) => void;

  /** Disable the built-in playback simulation (e.g. when fully controlled). */
  simulate?: boolean;

  className?: string;
  style?: React.CSSProperties;
}

/* ─────────────────────────────────────────────────────────────────────────
 * The reference track — Travis Scott & Young Thug, "Trance" (HEROES & VILLAINS,
 * 2022). ~12 timed lyric lines incl. the lines called out in the brief. Times
 * are illustrative (seconds) so the demo demonstrates active/past/upcoming +
 * an instrumental intro gap and a mid-song break.
 * ───────────────────────────────────────────────────────────────────────── */
const TRANCE_LYRICS: LyricLine[] = [
  { time: 6, text: "Did you forget? Do it for life" },
  { time: 11, text: "Chicago that time, all bullshit aside" },
  { time: 16, text: "Wonderful vibe, wonderful night" },
  { time: 21, text: "Did it with Trav" },
  { time: 25, text: "All I can hear is you and I" },
  { time: 30, text: "Top off the Wraith, do it for hours" },
  { time: 35, text: "Diamonds, they dance, dance in the light" },
  { time: 40, text: "Codeine convention, no need to hide" },
  // a longer instrumental break here (40 → 52) triggers the "•••" indicator
  { time: 52, text: "Whippin' the Phantom, lost in a trance" },
  { time: 57, text: "Hundred on the wrist, that's a hundred on the dance" },
  { time: 62, text: "She want the fame, I just want the advance" },
  { time: 67, text: "Did it with Trav, now we doin' it again" },
];

const TRANCE_DURATION = 78;

/**
 * A self-contained album-cover for the demo: a dark, smoky cover (no network).
 * `extractPalette` reads this same data-URI so the ambient mesh derives from it.
 * The colors here (deep magenta / violet / ember / near-black) are the palette
 * the ambient gradient picks up.
 */
const TRANCE_ARTWORK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>
      <defs>
        <radialGradient id='g1' cx='32%' cy='28%' r='85%'>
          <stop offset='0%' stop-color='#ff5e8a'/>
          <stop offset='38%' stop-color='#c0298f'/>
          <stop offset='70%' stop-color='#5b1c87'/>
          <stop offset='100%' stop-color='#140a22'/>
        </radialGradient>
        <radialGradient id='g2' cx='78%' cy='82%' r='70%'>
          <stop offset='0%' stop-color='#ff8a3d' stop-opacity='0.85'/>
          <stop offset='55%' stop-color='#b83a2e' stop-opacity='0.4'/>
          <stop offset='100%' stop-color='#140a22' stop-opacity='0'/>
        </radialGradient>
      </defs>
      <rect width='600' height='600' fill='#140a22'/>
      <rect width='600' height='600' fill='url(#g1)'/>
      <rect width='600' height='600' fill='url(#g2)'/>
      <text x='50%' y='52%' text-anchor='middle' font-family='-apple-system,Helvetica,Arial' font-size='150' font-weight='800' fill='#ffffff' fill-opacity='0.92' letter-spacing='-6'>H&amp;V</text>
    </svg>`,
  );

/** controlled-or-internal value hook (controlled wins). */
function useControlled<T>(
  value: T | undefined,
  onChange: ((v: T) => void) | undefined,
  initial: T,
): [T, (v: T) => void] {
  const [internal, setInternal] = React.useState(initial);
  const isControlled = value !== undefined;
  const current = isControlled ? (value as T) : internal;
  const set = React.useCallback(
    (v: T) => {
      if (!isControlled) setInternal(v);
      onChange?.(v);
    },
    [isControlled, onChange],
  );
  return [current, set];
}

/** mm:ss from a seconds value. */
function fmt(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NowPlayingScreen({
  title = "Trance",
  artist = "Travis Scott & Young Thug",
  album = "HEROES & VILLAINS",
  artworkUrl,
  ambientColors,
  durationSec,
  lyrics,
  currentTime: timeProp,
  onTimeChange,
  playing: playingProp,
  onPlayingChange,
  simulate = true,
  className,
  style,
}: NowPlayingScreenProps): React.ReactElement {
  // Use the bundled Trance demo defaults when the caller doesn't override them.
  const usingDemoTrack = lyrics === undefined && artworkUrl === undefined;
  const resolvedLyrics = lyrics ?? TRANCE_LYRICS;
  const resolvedArt = artworkUrl ?? (usingDemoTrack ? TRANCE_ARTWORK : undefined);
  const dur =
    durationSec ?? (usingDemoTrack ? TRANCE_DURATION : Math.max(60, lyricsEnd(resolvedLyrics)));

  const [currentTime, setCurrentTime] = useControlled(timeProp, onTimeChange, 0);
  const [playing, setPlaying] = useControlled(playingProp, onPlayingChange, true);

  // ── built-in playback simulation ──
  // advance currentTime while playing; loop at the end so the demo runs forever.
  React.useEffect(() => {
    if (!simulate || !playing) return;
    if (typeof window === "undefined") return;
    const STEP_MS = 100;
    const id = window.setInterval(() => {
      setCurrentTime(prevWrap(timeProp, currentTimeRef.current, dur, STEP_MS));
    }, STEP_MS);
    return () => window.clearInterval(id);
    // we intentionally read live time from a ref so this effect isn't restarted
    // every tick; it only re-subscribes on play/pause or duration change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulate, playing, dur, timeProp]);

  // keep a live ref of currentTime for the interval closure
  const currentTimeRef = React.useRef(currentTime);
  currentTimeRef.current = currentTime;

  const progress = dur > 0 ? clamp01(currentTime / dur) : 0;

  const cls = [styles.screen, className].filter(Boolean).join(" ");

  return (
    <div className={cls} style={style} role="group" aria-label={`Now playing: ${title}`}>
      {/* ── behind everything: the morphing ambient gradient ── */}
      <AmbientBackground
        colors={ambientColors}
        artworkUrl={resolvedArt}
        fallbackColors={["#ff5e8a", "#c0298f", "#ff8a3d", "#140a22"]}
        grid={4}
      />

      {/* ── LEFT: art card + meta + transport ── */}
      <div className={styles.left}>
        <div className={styles.artCard} data-playing={playing ? "true" : "false"}>
          {resolvedArt ? (
            // plain <img> so object-fit:cover + our radius apply cleanly
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.artImg}
              src={resolvedArt}
              alt={`${album} cover`}
              draggable={false}
            />
          ) : (
            <div
              className={styles.artGradient}
              style={{
                background:
                  "linear-gradient(135deg, #ff5e8a, #c0298f 45%, #5b1c87 80%, #140a22)",
              }}
            />
          )}
        </div>

        <div className={styles.meta}>
          <h2 className={styles.title} title={title}>
            {title}
          </h2>
          <p className={styles.subtitle} title={`${artist} — ${album}`}>
            {artist}
            {album ? ` — ${album}` : ""}
          </p>
        </div>

        <div className={styles.controls}>
          <div className={styles.transportRow}>
            <button
              type="button"
              className={styles.tBtn}
              aria-label="Previous"
              onClick={() => setCurrentTime(0)}
            >
              <SymbolGlyph name="backward.fill" size={22} color="currentColor" />
            </button>
            <button
              type="button"
              className={`${styles.tBtn} ${styles.tPlay}`}
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => setPlaying(!playing)}
            >
              <SymbolGlyph name={playing ? "pause.fill" : "play.fill"} size={22} color="#fff" />
            </button>
            <button
              type="button"
              className={styles.tBtn}
              aria-label="Next"
              onClick={() => setCurrentTime(dur)}
            >
              <SymbolGlyph name="forward.fill" size={22} color="currentColor" />
            </button>
          </div>

          <div className={styles.scrubRow}>
            <span className={styles.scrubTime}>{fmt(currentTime)}</span>
            <div className={styles.scrubSlider}>
              <Slider
                value={progress}
                onChange={(p) => setCurrentTime(p * dur)}
                bounds={[0, 1]}
                variant="macos"
                label="Seek"
              />
            </div>
            <span className={`${styles.scrubTime} ${styles.scrubTimeEnd}`}>
              -{fmt(Math.max(0, dur - currentTime))}
            </span>
          </div>
        </div>
      </div>

      {/* ── RIGHT: synced lyrics ── */}
      <LyricsView
        lines={resolvedLyrics}
        currentTime={currentTime}
        onSeek={(t) => setCurrentTime(t)}
      />
    </div>
  );
}

NowPlayingScreen.displayName = "NowPlayingScreen";

/* ── helpers ── */

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** last lyric timestamp + a tail, for an unknown duration. */
function lyricsEnd(lines: LyricLine[]): number {
  let max = 0;
  for (const l of lines) if (l.time > max) max = l.time;
  return max + 12;
}

/**
 * Advance time by STEP_MS, wrapping to 0 at the end so the demo loops. Returns
 * the live value (read from the ref) + step; if the parent fully controls time,
 * the controlled value wins (we never advance past what the parent provides).
 */
function prevWrap(
  controlled: number | undefined,
  live: number,
  dur: number,
  stepMs: number,
): number {
  if (controlled !== undefined) return controlled; // parent owns time
  const next = live + stepMs / 1000;
  return next >= dur ? 0 : next;
}
