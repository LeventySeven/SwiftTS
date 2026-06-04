"use client";
/**
 * `<NowPlayingPill>` — the FLOATING Liquid-Glass now-playing transport of the
 * modern macOS Apple Music app (the Tahoe / Liquid-Glass redesign seen on the
 * artist page). Unlike the old pinned full-width `<NowPlayingBar>`, this is a
 * horizontally-centered TRANSLUCENT CAPSULE that floats ~16px above the bottom
 * of the window, ~720px wide and ~58px tall, with a bright specular rim, a soft
 * drop shadow, and a live backdrop blur.
 *
 * Three clusters inside the pill:
 *   LEFT   — shuffle · backward.fill (⏮) · play.fill/pause.fill (center, larger)
 *            · forward.fill (⏭) · repeat. All `<SymbolGlyph>`, white, ~16–18px.
 *   CENTER — a ~38px rounded album thumbnail + a two-line block: title (white
 *            13px + a tiny red ★ when starred) over subtitle (gray 11px,
 *            "Artist — Album"). A thin progress scrubber underlays the metadata
 *            (drag to seek).
 *   RIGHT  — ellipsis (…) · lyrics (text.quote → text.alignleft) · queue
 *            (list.bullet) · volume (speaker.wave.2.fill + a short `<Slider>`).
 *
 * Liquid Glass: the surface composes the kit's `glassClass(glass.regular)`
 * (specular rim + sheen + backdrop blur from the `--sui-glass-*` token cascade)
 * UNDER a DESIGNED dark translucent wash, so the pill reads dark/translucent
 * regardless of the page theme — it floats over album art, like the real app.
 *
 * `"use client"` — owns play / scrub / volume state (controlled-or-internal).
 */
import * as React from "react";
import { Slider } from "../../../components/Slider";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import { glass, glassClass } from "../../../system/effects";
import styles from "./player.module.css";

/** The track the pill displays. */
export interface NowPlayingPillTrack {
  title: string;
  artist: string;
  album?: string;
  /** Artwork image URL. Falls back to a gradient swatch when absent. */
  artwork?: string;
  /** Gradient artwork override (CSS `background`) when no `artwork` URL. */
  gradient?: string;
  /** Show the tiny red ★ next to the title (a "Loved"/starred track). */
  starred?: boolean;
  /** Track length in seconds — drives the scrubber → time mapping. */
  durationSec?: number;
}

export interface NowPlayingPillProps {
  track?: NowPlayingPillTrack;

  /* play / pause (controlled-or-internal) */
  playing?: boolean;
  onPlayingChange?: (playing: boolean) => void;

  /* scrub position, 0..1 (controlled-or-internal) */
  progress?: number;
  onSeek?: (p: number) => void;

  /* volume, 0..1 (controlled-or-internal) */
  volume?: number;
  onVolumeChange?: (v: number) => void;

  /* toggles */
  shuffle?: boolean;
  onShuffleChange?: (on: boolean) => void;
  repeat?: boolean;
  onRepeatChange?: (on: boolean) => void;

  /* transport */
  onPrev?: () => void;
  onNext?: () => void;

  /* trailing actions */
  onMore?: () => void;
  onLyrics?: () => void;
  onQueue?: () => void;

  /**
   * Click on the artwork thumbnail → expand to the full-screen Now Playing view
   * (exactly like clicking the artwork in the real macOS Apple Music pill). When
   * provided, the thumb becomes a button; otherwise it's a static swatch.
   */
  onArtworkClick?: () => void;

  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_TRACK: NowPlayingPillTrack = {
  title: "As You Are",
  artist: "The Weeknd",
  album: "Beauty Behind the Madness",
  durationSec: 320,
  starred: true,
  gradient: "linear-gradient(135deg, #6c5a52 0%, #2b2422 55%, #120f0e 100%)",
};

/** A controlled-or-internal value hook (a passed `value` always wins). */
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

/**
 * The floating Liquid-Glass now-playing pill. The surface = the kit's
 * `glassClass(glass.regular)` (rim/sheen/blur) + the module `.pill` dark wash.
 */
export function NowPlayingPill({
  track = DEFAULT_TRACK,
  playing: playingProp,
  onPlayingChange,
  progress: progressProp,
  onSeek,
  volume: volumeProp,
  onVolumeChange,
  shuffle: shuffleProp,
  onShuffleChange,
  repeat: repeatProp,
  onRepeatChange,
  onPrev,
  onNext,
  onMore,
  onLyrics,
  onQueue,
  onArtworkClick,
  className,
  style,
}: NowPlayingPillProps): React.ReactElement {
  const [playing, setPlaying] = useControlled(playingProp, onPlayingChange, true);
  const [progress, setProgress] = useControlled(progressProp, onSeek, 0.36);
  const [volume, setVolume] = useControlled(volumeProp, onVolumeChange, 0.72);
  const [shuffle, setShuffle] = useControlled(shuffleProp, onShuffleChange, false);
  const [repeat, setRepeat] = useControlled(repeatProp, onRepeatChange, false);

  // Artwork swatch: image URL → background-image; else a gradient fallback.
  const artBg = track.gradient ?? "linear-gradient(135deg, #fc3c44, #7d2ae8)";
  const thumbStyle: React.CSSProperties = track.artwork
    ? { backgroundImage: `url(${track.artwork})` }
    : { background: artBg };

  // Compose the Liquid-Glass surface class under the module's dark wash. The
  // glass layer supplies the specular rim + sheen + backdrop blur; `.pill`
  // supplies the dark translucent tint, capsule radius, and float shadow.
  const surfaceClass = [styles.pill, glassClass(glass.regular), className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={surfaceClass}
      style={style}
      role="group"
      aria-label={`Now playing: ${track.title} by ${track.artist}`}
    >
      {/* ── LEFT: transport cluster ── */}
      <div className={styles.transport}>
        <button
          type="button"
          className={styles.tBtn}
          data-on={shuffle ? "true" : "false"}
          aria-pressed={shuffle}
          aria-label="Shuffle"
          onClick={() => setShuffle(!shuffle)}
        >
          <SymbolGlyph name="line.3.horizontal" size={16} color="currentColor" />
        </button>

        <button
          type="button"
          className={styles.tBtn}
          aria-label="Previous"
          onClick={onPrev}
        >
          <SymbolGlyph name="backward.fill" size={17} color="currentColor" />
        </button>

        <button
          type="button"
          className={`${styles.tBtn} ${styles.tPlay}`}
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => setPlaying(!playing)}
        >
          <SymbolGlyph
            name={playing ? "pause.fill" : "play.fill"}
            size={22}
            color="currentColor"
          />
        </button>

        <button
          type="button"
          className={styles.tBtn}
          aria-label="Next"
          onClick={onNext}
        >
          <SymbolGlyph name="forward.fill" size={17} color="currentColor" />
        </button>

        <button
          type="button"
          className={styles.tBtn}
          data-on={repeat ? "true" : "false"}
          aria-pressed={repeat}
          aria-label="Repeat"
          onClick={() => setRepeat(!repeat)}
        >
          <SymbolGlyph name="arrow.clockwise" size={16} color="currentColor" />
        </button>
      </div>

      {/* ── CENTER: artwork + metadata over the scrubber ── */}
      <div className={styles.nowInfo}>
        {onArtworkClick ? (
          <button
            type="button"
            className={styles.thumb}
            style={thumbStyle}
            aria-label={`Open full screen — ${track.album ?? track.title}`}
            onClick={onArtworkClick}
          />
        ) : (
          <div
            className={styles.thumb}
            style={thumbStyle}
            role="img"
            aria-label={track.album ?? track.title}
          />
        )}
        <div className={styles.infoText}>
          <div className={styles.titleRow}>
            <span className={styles.title}>{track.title}</span>
            {track.starred ? (
              <SymbolGlyph
                name="star.fill"
                size={9}
                color="var(--np-accent)"
                aria-hidden
              />
            ) : null}
          </div>
          <span className={styles.subtitle}>
            {track.artist}
            {track.album ? ` — ${track.album}` : ""}
          </span>
          {/* thin progress scrubber underlaying the metadata — drag to seek */}
          <div className={styles.scrub}>
            <Slider
              value={progress}
              onChange={setProgress}
              bounds={[0, 1]}
              variant="macos"
              thumbVisibility="hidden"
              label="Seek"
            />
          </div>
        </div>
      </div>

      {/* ── RIGHT: more / lyrics / queue / volume ── */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="More"
          onClick={onMore}
        >
          <SymbolGlyph name="ellipsis" size={16} color="currentColor" />
        </button>

        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Lyrics"
          onClick={onLyrics}
        >
          <SymbolGlyph name="text.alignleft" size={16} color="currentColor" />
        </button>

        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Playing Next"
          onClick={onQueue}
        >
          <SymbolGlyph name="list.bullet" size={16} color="currentColor" />
        </button>

        <div className={styles.volume}>
          <SymbolGlyph
            name="speaker.wave.2.fill"
            size={14}
            color="var(--np-fg-2)"
            aria-hidden
          />
          <div className={styles.volSlider}>
            <Slider
              value={volume}
              onChange={setVolume}
              bounds={[0, 1]}
              variant="macos"
              label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

NowPlayingPill.displayName = "NowPlayingPill";

export default NowPlayingPill;
