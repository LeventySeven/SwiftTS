"use client";
/**
 * `<AppleMusicApp>` — the modern, faithful macOS Apple Music window (the Tahoe /
 * Liquid-Glass redesign), composed entirely from the SwiftTS kit.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │● ● ●                                                          │ ← traffic lights
 *   │┌──────────────┐  ░░░  full-bleed artist photo  ░░░  (‹)(★)(…) │   FLOAT over content
 *   ││  ⌕ Search    │                                               │
 *   ││  Home        │  (▶) The Weeknd                               │ ← <MusicHome> scrolls
 *   ││  New · Radio │  Latest Release ───────────────────────────   │
 *   ││ LIBRARY      │  Top Songs ›   [▦ Timeless] [▦ Starboy] …     │
 *   ││  Pins …      │  Essential Albums  [▦][▦][▦][▦][▦]            │
 *   ││  Slade  ◐    │                                               │
 *   │└──────────────┘   ┌──── ◀ ▮▶ ▶ ──●── ▦ As You Are ⋯ ☰ ──┐    │ ← <NowPlayingPill>
 *   └───────────────────└──────── floats over content ─────────┘────┘   FLOATS, overlapping
 *
 * NO title bar. A BORDERLESS rounded (~10px) window with a big soft shadow: the
 * dark `<MusicSidebar>` and the scrollable `<MusicHome>` (ArtistHero + Latest
 * Release + Top Songs + Essential Albums) run EDGE-TO-EDGE. The macOS traffic
 * lights FLOAT at the top-left over the content; the `<NowPlayingPill>` FLOATS
 * centered near the bottom, overlapping the content.
 *
 * Self-contained: seeds The Weeknd demo catalog so it renders fully populated
 * out of the box. Owns three pieces of state — the selected sidebar row, the
 * now-playing track, and whether the full-screen `<NowPlayingScreen>` is open.
 * Clicking the pill's artwork (or its Lyrics button) expands the full-screen
 * Now Playing view; its close chevron collapses back to the window.
 *
 * Dark theme throughout. `"use client"` — owns selection + transport + overlay
 * state.
 */
import * as React from "react";
import {
  MusicSidebar,
  DEFAULT_MUSIC_SECTIONS,
  type MusicNavSection,
} from "./MusicSidebar";
import { MusicHome, type MusicSong } from "./MusicHome";
import { NowPlayingPill, type NowPlayingPillTrack } from "./NowPlayingPill";
import { NowPlayingScreen } from "./NowPlayingScreen";
import styles from "./applemusic.module.css";

/* ───────────────────────── seeded demo data ───────────────── */

/**
 * The seed now-playing track shown in the pill (and expanded into the
 * full-screen view). Matches the artist page (The Weeknd) so the whole window
 * reads as one coherent surface out of the box.
 */
const SEED_TRACK: NowPlayingPillTrack = {
  title: "Timeless",
  artist: "The Weeknd",
  album: "Hurry Up Tomorrow",
  durationSec: 256,
  starred: true,
  gradient: "linear-gradient(135deg,#3a0a12,#7a1020)",
};

/**
 * The Top-Songs catalog (mirrors `<MusicHome>`'s default seed) so a song tap can
 * resolve the tapped row → drive the pill. Kept here so a click anywhere in the
 * grid updates the now-playing track without `<MusicHome>` owning transport.
 */
const SONG_CATALOG: Record<string, NowPlayingPillTrack> = {
  s1: { title: "Timeless", artist: "The Weeknd", album: "Hurry Up Tomorrow", starred: true, durationSec: 256, gradient: "linear-gradient(135deg,#3a0a12,#7a1020)" },
  s2: { title: "Starboy", artist: "The Weeknd", album: "Starboy", durationSec: 230, gradient: "linear-gradient(135deg,#b80000,#1a0000)" },
  s3: { title: "São Paulo", artist: "The Weeknd", album: "Hurry Up Tomorrow", durationSec: 359, gradient: "linear-gradient(135deg,#5e2a8c,#1a0a2e)" },
  s4: { title: "One Of The Girls", artist: "The Weeknd, JENNIE, Lily-Rose Depp", album: "The Idol Vol. 1", starred: true, durationSec: 244, gradient: "linear-gradient(135deg,#c41e3a,#2a0a14)" },
  s5: { title: "Blinding Lights", artist: "The Weeknd", album: "After Hours", durationSec: 200, gradient: "linear-gradient(135deg,#e02020,#0a0a0a)" },
  s6: { title: "Save Your Tears", artist: "The Weeknd", album: "After Hours", durationSec: 215, gradient: "linear-gradient(135deg,#d4145a,#2a0a1e)" },
  s7: { title: "Die For You", artist: "The Weeknd", album: "Starboy", durationSec: 260, gradient: "linear-gradient(135deg,#b80000,#1a0000)" },
  s8: { title: "The Hills", artist: "The Weeknd", album: "Beauty Behind the Madness", durationSec: 242, gradient: "linear-gradient(135deg,#3a3a3c,#0a0a0a)" },
  s9: { title: "Call Out My Name", artist: "The Weeknd", album: "My Dear Melancholy,", starred: true, durationSec: 228, gradient: "linear-gradient(135deg,#d4145a,#2a0a1e)" },
};

/* ───────────────────────── props ───────────────── */

export interface AppleMusicAppProps {
  /** Sidebar navigation tree. Defaults to the canonical Apple-Music tree. */
  sections?: MusicNavSection[];
  /** Initially-selected sidebar row id. Default `"artists"`. */
  defaultSelection?: string;
  /** The artist whose page fills the main content. Default "The Weeknd". */
  artistName?: string;
  /** Optional full-bleed hero photo URL (falls back to a gradient). */
  artistImage?: string;
  /** The track seeded into the now-playing pill. */
  nowPlaying?: NowPlayingPillTrack;
  className?: string;
  style?: React.CSSProperties;
}

/* ───────────────────────── component ───────────────── */

export function AppleMusicApp({
  sections = DEFAULT_MUSIC_SECTIONS,
  defaultSelection = "artists",
  artistName = "The Weeknd",
  artistImage,
  nowPlaying = SEED_TRACK,
  className,
  style,
}: AppleMusicAppProps = {}): React.ReactElement {
  // which sidebar row is lit
  const [selection, setSelection] = React.useState(defaultSelection);
  // the now-playing track shown in the pill / full-screen view
  const [track, setTrack] = React.useState<NowPlayingPillTrack>(nowPlaying);
  // transport
  const [playing, setPlaying] = React.useState(true);
  // whether the full-screen <NowPlayingScreen> is up
  const [fullScreen, setFullScreen] = React.useState(false);

  // A song-row tap resolves the tapped id → swaps the now-playing track + plays.
  const playSong = React.useCallback((id: string) => {
    const next = SONG_CATALOG[id];
    if (next) {
      setTrack(next);
      setPlaying(true);
    }
  }, []);

  // The hero red-play CTA starts the artist's top song.
  const playArtist = React.useCallback(() => {
    setTrack(SONG_CATALOG.s1 ?? SEED_TRACK);
    setPlaying(true);
  }, []);

  const openFullScreen = React.useCallback(() => setFullScreen(true), []);
  const closeFullScreen = React.useCallback(() => setFullScreen(false), []);

  return (
    <div
      className={[styles.window, className].filter(Boolean).join(" ")}
      data-scheme="dark"
      style={style}
      role="application"
      aria-label="Apple Music"
    >
      {/* macOS traffic lights — FLOAT over the content top-left (~x14, y14) */}
      <div className={styles.traffic} aria-hidden>
        <span className={`${styles.light} ${styles.lightClose}`} />
        <span className={`${styles.light} ${styles.lightMin}`} />
        <span className={`${styles.light} ${styles.lightZoom}`} />
      </div>

      {/* LEFT — the dark vibrant source-list (carries its own traffic safe-area) */}
      <div className={styles.sidebar}>
        <MusicSidebar
          sections={sections}
          selection={selection}
          onSelect={setSelection}
        />
      </div>

      {/* MAIN — the scrollable artist page; also the pill's positioning context */}
      <main className={styles.main}>
        <div className={styles.content}>
          <MusicHome
            name={artistName}
            artistImage={artistImage}
            onPlay={playArtist}
            onPlaySong={playSong}
          />
        </div>

        {/* FLOATING now-playing pill — centered near the bottom, over content. */}
        <div className={styles.pillDock}>
          <NowPlayingPill
            track={track}
            playing={playing}
            onPlayingChange={setPlaying}
            /* the pill defaults to position:fixed (viewport-pinned); override to
               position:static so it floats inside THIS window's bottom dock */
            style={{
              position: "static",
              left: "auto",
              bottom: "auto",
              transform: "none",
              maxInlineSize: "min(720px, calc(100% - 28px))",
            }}
            onArtworkClick={openFullScreen}
            onLyrics={openFullScreen}
          />
        </div>
      </main>

      {/* FULL-SCREEN Now Playing — slides up to cover the whole window */}
      {fullScreen ? (
        <div className={styles.npOverlay}>
          <NowPlayingScreen
            title={track.title}
            artist={track.artist}
            album={track.album}
            playing={playing}
            onPlayingChange={setPlaying}
            onClose={closeFullScreen}
          />
        </div>
      ) : null}
    </div>
  );
}

AppleMusicApp.displayName = "AppleMusicApp";

export default AppleMusicApp;
