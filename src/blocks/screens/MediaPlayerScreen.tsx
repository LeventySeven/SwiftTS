"use client";
/**
 * `<MediaPlayerScreen>` — the Liquid-Glass showcase (Now Playing).
 *
 * The whole scene IS the Liquid-Glass demo:
 *   • the album art is painted huge and BLURRED edge-to-edge behind a dark scrim
 *     (the iOS "Now Playing" art-driven backdrop),
 *   • the foreground (art / title / scrubber / transport) sits on top,
 *   • the transport block is wrapped in a `<GlassEffect>` capsule — frosted blur +
 *     specular rim + sheen — over the blurred art, so the glass visibly refracts
 *     the colorful backdrop.
 *
 * Controls (all from the kit):
 *   • `<Slider>` scrubber — drag to seek; the elapsed/remaining times update,
 *   • a second `<Slider>` for volume between two speaker `<SymbolGlyph>`s,
 *   • glass transport buttons (shuffle / backward / play-pause / forward / repeat)
 *     drawn with `<SymbolGlyph>` (`backward.fill` / `play.fill` / `pause.fill` /
 *     `forward.fill`).
 *
 * Client component — owns play state, scrub position, and volume.
 */
import * as React from "react";
import { Slider } from "../../components/Slider";
import { GlassEffect } from "../../system/effects";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./screens.module.css";

/** mm:ss from a 0..1 fraction of the track duration. */
function fmt(fraction: number, durationSec: number): string {
  const total = Math.max(0, Math.round(fraction * durationSec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface MediaPlayerScreenProps {
  title?: string;
  artist?: string;
  album?: string;
  /** Album-art image URL. Falls back to a vivid CSS gradient when omitted. */
  artworkUrl?: string;
  /** Track length in seconds (drives the scrubber timestamps). */
  durationSec?: number;
}

const FALLBACK_ART =
  "radial-gradient(circle at 30% 25%, #ff2d55 0%, transparent 55%)," +
  "radial-gradient(circle at 75% 30%, #5e5ce6 0%, transparent 55%)," +
  "radial-gradient(circle at 50% 85%, #ff9f0a 0%, transparent 60%)," +
  "linear-gradient(135deg, #1c1c2e, #2c1640)";

export function MediaPlayerScreen({
  title = "Midnight City",
  artist = "M83",
  album = "Hurry Up, We're Dreaming",
  artworkUrl,
  durationSec = 244,
}: MediaPlayerScreenProps = {}): React.ReactElement {
  const [playing, setPlaying] = React.useState(true);
  const [progress, setProgress] = React.useState(0.34);
  const [volume, setVolume] = React.useState(0.62);
  const [liked, setLiked] = React.useState(false);
  const [shuffle, setShuffle] = React.useState(false);
  const [repeat, setRepeat] = React.useState(false);

  const artStyle: React.CSSProperties = artworkUrl
    ? { backgroundImage: `url(${artworkUrl})` }
    : { backgroundImage: FALLBACK_ART };

  return (
    <div className={`${styles.scene} ${styles.media}`}>
      {/* blurred-art backdrop + scrim */}
      <div className={styles.mediaArtBackdrop} style={artStyle} aria-hidden />
      <div className={styles.mediaScrim} aria-hidden />

      <div className={styles.mediaContent}>
        {/* top bar */}
        <div className={styles.mediaTopBar}>
          <SymbolGlyph name="chevron.down" size={18} color="rgba(255,255,255,0.85)" />
          <span>{album}</span>
          <SymbolGlyph name="ellipsis.circle" size={18} color="rgba(255,255,255,0.85)" />
        </div>

        {/* album art */}
        <div
          className={styles.albumArt}
          style={artStyle}
          role="img"
          aria-label={`${title} — ${artist}`}
        />

        {/* title / artist + like */}
        <div className={styles.trackRow}>
          <div style={{ minInlineSize: 0 }}>
            <div className={styles.trackTitle}>{title}</div>
            <div className={styles.trackArtist}>{artist}</div>
          </div>
          <span
            className={styles.mediaHeart}
            role="button"
            aria-label={liked ? "Unlike" : "Like"}
            onClick={() => setLiked((l) => !l)}
          >
            <SymbolGlyph
              name="heart.fill"
              size={20}
              color={liked ? "var(--sui-color-system-pink)" : "rgba(255,255,255,0.85)"}
            />
          </span>
        </div>

        {/* scrubber */}
        <div className={styles.scrubBlock}>
          <Slider value={progress} onChange={setProgress} bounds={[0, 1]} />
          <div className={styles.scrubTimes}>
            <span>{fmt(progress, durationSec)}</span>
            <span>-{fmt(1 - progress, durationSec)}</span>
          </div>
        </div>

        {/* ── Glass transport panel ── */}
        <GlassEffect
          glass="clear"
          shape={{ rounded: 28 }}
          className={styles.glassPanel}
          style={{ padding: "18px 16px", marginBlockStart: 22 }}
        >
          <div className={styles.transport}>
            <button
              className={styles.transportBtn}
              aria-label="Shuffle"
              aria-pressed={shuffle}
              onClick={() => setShuffle((s) => !s)}
              style={{ fontSize: 20, color: shuffle ? "var(--sui-color-system-green)" : "#fff" }}
            >
              <SymbolGlyph name="shuffle" size={20} color="currentColor" />
            </button>

            <button className={styles.transportBtn} aria-label="Previous">
              <SymbolGlyph name="backward.fill" size={28} color="#fff" />
            </button>

            <button
              className={`${styles.transportBtn} ${styles.playBtn}`}
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => setPlaying((p) => !p)}
            >
              <SymbolGlyph name={playing ? "pause.fill" : "play.fill"} size={34} color="#fff" />
            </button>

            <button className={styles.transportBtn} aria-label="Next">
              <SymbolGlyph name="forward.fill" size={28} color="#fff" />
            </button>

            <button
              className={styles.transportBtn}
              aria-label="Repeat"
              aria-pressed={repeat}
              onClick={() => setRepeat((r) => !r)}
              style={{ fontSize: 20, color: repeat ? "var(--sui-color-system-green)" : "#fff" }}
            >
              <SymbolGlyph name="arrow.clockwise" size={20} color="currentColor" />
            </button>
          </div>

          {/* volume */}
          <div className={styles.volumeRow}>
            <SymbolGlyph name="speaker.slash" size={16} color="rgba(255,255,255,0.7)" />
            <Slider value={volume} onChange={setVolume} bounds={[0, 1]} />
            <SymbolGlyph name="speaker.wave.2" size={16} color="rgba(255,255,255,0.7)" />
          </div>

          {/* output routing row — lyrics · AirPlay · up-next */}
          <div className={styles.mediaBottomBar}>
            <SymbolGlyph name="text.alignleft" size={20} color="rgba(255,255,255,0.78)" />
            <SymbolGlyph name="speaker.wave.2" size={20} color="rgba(255,255,255,0.78)" />
            <SymbolGlyph name="list.bullet" size={20} color="rgba(255,255,255,0.78)" />
          </div>
        </GlassEffect>
      </div>
    </div>
  );
}

export { MediaPlayerScreen as MusicScreen };
MediaPlayerScreen.displayName = "MediaPlayerScreen";
