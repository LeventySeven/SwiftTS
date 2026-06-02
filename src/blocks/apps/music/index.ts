/**
 * `src/blocks/apps/music` — a faithful macOS Apple Music app template built on
 * the SwiftTS kit.
 *
 * Exports the full window (`AppleMusicApp`) plus every sub-piece so they can be
 * dropped into other layouts:
 *   • `MusicSidebar`   — the vibrant three-section navigation column
 *   • `AlbumCard`      — one rounded-artwork card (square or circular)
 *   • `AlbumShelf`     — a titled horizontal scroller of `AlbumCard`s
 *   • `NowPlayingBar`  — the pinned bottom transport bar (scrubber + controls)
 *
 * `seedGradient` (deterministic title→gradient) is re-exported for callers that
 * want matching placeholder artwork.
 */
export { AppleMusicApp } from "./AppleMusicApp";
export type { AppleMusicAppProps } from "./AppleMusicApp";

export {
  MusicSidebar,
  DEFAULT_MUSIC_SECTIONS,
} from "./MusicSidebar";
export type {
  MusicSidebarProps,
  MusicNavItem,
  MusicNavSection,
} from "./MusicSidebar";

export { AlbumCard, seedGradient } from "./AlbumCard";
export type { AlbumCardProps, AlbumItem } from "./AlbumCard";

export { AlbumShelf } from "./AlbumShelf";
export type { AlbumShelfProps } from "./AlbumShelf";

export { NowPlayingBar } from "./NowPlayingBar";
export type { NowPlayingBarProps, NowPlayingTrack } from "./NowPlayingBar";

/* ── Full-screen "Now Playing" / Lyrics view (ambient mesh + synced lyrics) ── */
export { NowPlayingScreen } from "./NowPlayingScreen";
export type { NowPlayingScreenProps } from "./NowPlayingScreen";

export { LyricsView } from "./LyricsView";
export type { LyricsViewProps, LyricLine } from "./LyricsView";

export { AmbientBackground } from "./AmbientBackground";
export type { AmbientBackgroundProps } from "./AmbientBackground";
