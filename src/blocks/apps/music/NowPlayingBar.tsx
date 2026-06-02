"use client";
/**
 * `<NowPlayingBar>` — the pinned bottom transport bar of macOS Apple Music.
 *
 * Three-zone grid:
 *   LEFT   — album thumbnail · title/artist · a like (heart) toggle
 *   CENTER — transport row (shuffle · backward · play/pause · forward · repeat)
 *            over a scrubber: elapsed time · `<Slider variant="macos">` · -remaining
 *   RIGHT  — volume cluster (mute symbol · `<Slider>` · loud symbol) · lyrics ·
 *            AirPlay · up-next queue
 *
 * Transport glyphs are `<SymbolGlyph>` (`backward.fill` / `play.fill` /
 * `pause.fill` / `forward.fill` / `shuffle` / `repeat`). Both sliders are the
 * kit `<Slider variant="macos">` (the ⌀18 knob). The whole bar is a Liquid-Glass
 * surface (the system `glassClass` layered over the structural wash).
 *
 * Fully controllable, with internal-state fallbacks so it runs as a standalone
 * demo. `"use client"` — owns play/scrub/volume state.
 */
import * as React from "react";
import { Slider } from "../../../components/Slider";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import styles from "./music.module.css";

/** mm:ss from a 0..1 fraction of the track duration. */
function fmt(fraction: number, durationSec: number): string {
  const total = Math.max(0, Math.round(fraction * durationSec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface NowPlayingTrack {
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  /** Gradient artwork override (CSS `background`). */
  gradient?: string;
  durationSec?: number;
}

export interface NowPlayingBarProps {
  track?: NowPlayingTrack;

  /* play/pause */
  playing?: boolean;
  onPlayingChange?: (playing: boolean) => void;

  /* scrub (0..1) */
  progress?: number;
  onProgressChange?: (p: number) => void;

  /* volume (0..1) */
  volume?: number;
  onVolumeChange?: (v: number) => void;

  /* toggles */
  shuffle?: boolean;
  onShuffleChange?: (on: boolean) => void;
  repeat?: boolean;
  onRepeatChange?: (on: boolean) => void;
  liked?: boolean;
  onLikedChange?: (on: boolean) => void;

  /* transport */
  onPrev?: () => void;
  onNext?: () => void;

  /* trailing icons */
  onLyrics?: () => void;
  onAirPlay?: () => void;
  onQueue?: () => void;

  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_TRACK: NowPlayingTrack = {
  title: "Midnight City",
  artist: "M83",
  album: "Hurry Up, We're Dreaming",
  durationSec: 244,
  gradient: "linear-gradient(135deg, hsl(338 80% 55%), hsl(268 70% 42%))",
};

/** A controlled-or-internal boolean/number hook (controlled wins). */
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

export function NowPlayingBar({
  track = DEFAULT_TRACK,
  playing: playingProp,
  onPlayingChange,
  progress: progressProp,
  onProgressChange,
  volume: volumeProp,
  onVolumeChange,
  shuffle: shuffleProp,
  onShuffleChange,
  repeat: repeatProp,
  onRepeatChange,
  liked: likedProp,
  onLikedChange,
  onPrev,
  onNext,
  onLyrics,
  onAirPlay,
  onQueue,
  className,
  style,
}: NowPlayingBarProps): React.ReactElement {
  const [playing, setPlaying] = useControlled(playingProp, onPlayingChange, true);
  const [progress, setProgress] = useControlled(progressProp, onProgressChange, 0.32);
  const [volume, setVolume] = useControlled(volumeProp, onVolumeChange, 0.7);
  const [shuffle, setShuffle] = useControlled(shuffleProp, onShuffleChange, false);
  const [repeat, setRepeat] = useControlled(repeatProp, onRepeatChange, false);
  const [liked, setLiked] = useControlled(likedProp, onLikedChange, false);

  const dur = track.durationSec ?? 244;
  const thumbBg = track.gradient ?? "linear-gradient(135deg, #fc3c44, #7d2ae8)";
  const thumbStyle: React.CSSProperties = track.artworkUrl
    ? { backgroundImage: `url(${track.artworkUrl})` }
    : { background: thumbBg };

  // flat translucent transport bar (the `.bar` module material) — NOT glassClass
  // (capsule default radius would round the full-width bar into a pill).
  const cls = [styles.bar, className].filter(Boolean).join(" ");

  return (
    <div className={cls} style={style} role="group" aria-label="Now playing">
      {/* ── LEFT: track ── */}
      <div className={styles.npTrack}>
        <div className={styles.npThumb} style={thumbStyle} role="img" aria-label={track.album ?? track.title} />
        <div className={styles.npMeta}>
          <span className={styles.npTitle}>{track.title}</span>
          <span className={styles.npArtist}>
            {track.artist}
            {track.album ? ` — ${track.album}` : ""}
          </span>
        </div>
        <button
          type="button"
          className={styles.npLike}
          data-on={liked ? "true" : "false"}
          aria-pressed={liked}
          aria-label={liked ? "Remove from favorites" : "Add to favorites"}
          onClick={() => setLiked(!liked)}
        >
          <SymbolGlyph name="heart.fill" size={16} color="currentColor" />
        </button>
      </div>

      {/* ── CENTER: transport + scrubber ── */}
      <div className={styles.npCenter}>
        <div className={styles.transport}>
          <button
            type="button"
            className={styles.tBtn}
            data-on={shuffle ? "true" : "false"}
            aria-pressed={shuffle}
            aria-label="Shuffle"
            onClick={() => setShuffle(!shuffle)}
          >
            <SymbolGlyph name="line.3.horizontal" size={15} color="currentColor" />
          </button>

          <button type="button" className={styles.tBtn} aria-label="Previous" onClick={onPrev}>
            <SymbolGlyph name="backward.fill" size={18} color="currentColor" />
          </button>

          <button
            type="button"
            className={`${styles.tBtn} ${styles.tPlay}`}
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => setPlaying(!playing)}
          >
            <SymbolGlyph name={playing ? "pause.fill" : "play.fill"} size={24} color="currentColor" />
          </button>

          <button type="button" className={styles.tBtn} aria-label="Next" onClick={onNext}>
            <SymbolGlyph name="forward.fill" size={18} color="currentColor" />
          </button>

          <button
            type="button"
            className={styles.tBtn}
            data-on={repeat ? "true" : "false"}
            aria-pressed={repeat}
            aria-label="Repeat"
            onClick={() => setRepeat(!repeat)}
          >
            <SymbolGlyph name="arrow.clockwise" size={15} color="currentColor" />
          </button>
        </div>

        <div className={styles.scrubRow}>
          <span className={styles.scrubTime}>{fmt(progress, dur)}</span>
          <div className={styles.scrubSlider}>
            <Slider
              value={progress}
              onChange={setProgress}
              bounds={[0, 1]}
              variant="macos"
              label="Seek"
            />
          </div>
          <span className={`${styles.scrubTime} ${styles.scrubTimeEnd}`}>
            -{fmt(1 - progress, dur)}
          </span>
        </div>
      </div>

      {/* ── RIGHT: volume + queue/airplay ── */}
      <div className={styles.npRight}>
        <div className={styles.volRow}>
          <SymbolGlyph name="speaker.slash" size={13} color="var(--am-fg-2)" />
          <div className={styles.volSlider}>
            <Slider
              value={volume}
              onChange={setVolume}
              bounds={[0, 1]}
              variant="macos"
              label="Volume"
            />
          </div>
          <SymbolGlyph name="speaker.wave.2" size={13} color="var(--am-fg-2)" />
        </div>

        <button type="button" className={styles.iconBtn} aria-label="Lyrics" onClick={onLyrics}>
          <SymbolGlyph name="text.alignleft" size={15} color="currentColor" />
        </button>
        <button type="button" className={styles.iconBtn} aria-label="AirPlay" onClick={onAirPlay}>
          <SymbolGlyph name="square.and.arrow.up" size={16} color="currentColor" />
        </button>
        <button type="button" className={styles.iconBtn} aria-label="Playing Next" onClick={onQueue}>
          <SymbolGlyph name="list.bullet" size={16} color="currentColor" />
        </button>
      </div>
    </div>
  );
}

NowPlayingBar.displayName = "NowPlayingBar";
