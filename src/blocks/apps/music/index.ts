/**
 * `src/blocks/apps/music` — a faithful, modern macOS Apple Music app template
 * (the Tahoe / Liquid-Glass redesign) built on the SwiftTS kit.
 *
 * Exports the full borderless window (`AppleMusicApp`) plus every sub-piece so
 * they can be dropped into other layouts:
 *
 *   Window + navigation
 *   • `AppleMusicApp`   — the borderless window: dark sidebar + scrollable
 *                          artist page + floating now-playing pill + full-screen
 *                          Now Playing overlay
 *   • `MusicSidebar`    — the DARK vibrant source-list column
 *
 *   Main content (the artist page)
 *   • `MusicHome`       — the scrollable artist page (hero + Latest Release +
 *                          Top Songs grid + Essential Albums shelf)
 *   • `ArtistHero`      — the full-bleed artist photo + glass chrome + red CTA
 *   • `SongRow`         — one "Top Songs" entry (thumb + title/subtitle + ⋯)
 *
 *   Transport / Now Playing
 *   • `NowPlayingPill`  — the FLOATING Liquid-Glass now-playing capsule
 *   • `NowPlayingScreen`— the full-screen immersive Now Playing (ambient + lyrics)
 *   • `LyricsView`      — the time-synced lyrics column
 *   • `AmbientBackground` — the slow morphing mesh derived from the artwork
 *
 *   Legacy / building-block pieces (still exported for reuse)
 *   • `AlbumCard` / `AlbumShelf` — rounded-artwork card + titled horizontal
 *                          scroller; `seedGradient` (deterministic title→gradient)
 *   • `NowPlayingBar`   — the older pinned full-width transport bar
 */

/* ── the full borderless window ── */
export { AppleMusicApp } from "./AppleMusicApp";
export type { AppleMusicAppProps } from "./AppleMusicApp";

/* ── dark source-list sidebar ── */
export { MusicSidebar, DEFAULT_MUSIC_SECTIONS } from "./MusicSidebar";
export type {
  MusicSidebarProps,
  MusicNavItem,
  MusicNavSection,
} from "./MusicSidebar";

/* ── the scrollable artist page + its rows ── */
export { MusicHome } from "./MusicHome";
export type {
  MusicHomeProps,
  MusicSong,
  MusicAlbum,
  MusicLatestRelease,
} from "./MusicHome";

export { ArtistHero } from "./ArtistHero";
export type { ArtistHeroProps } from "./ArtistHero";

export { SongRow } from "./SongRow";
export type { SongRowProps } from "./SongRow";

/* ── floating now-playing pill ── */
export { NowPlayingPill } from "./NowPlayingPill";
export type { NowPlayingPillProps, NowPlayingPillTrack } from "./NowPlayingPill";

/* ── full-screen Now Playing / Lyrics / ambient mesh ── */
export { NowPlayingScreen } from "./NowPlayingScreen";
export type { NowPlayingScreenProps } from "./NowPlayingScreen";

export { LyricsView } from "./LyricsView";
export type { LyricsViewProps, LyricLine } from "./LyricsView";

export { AmbientBackground } from "./AmbientBackground";
export type { AmbientBackgroundProps } from "./AmbientBackground";

/* ── legacy building-block pieces (still exported for reuse) ── */
export { AlbumCard, seedGradient } from "./AlbumCard";
export type { AlbumCardProps, AlbumItem } from "./AlbumCard";

export { AlbumShelf } from "./AlbumShelf";
export type { AlbumShelfProps } from "./AlbumShelf";

export { NowPlayingBar } from "./NowPlayingBar";
export type { NowPlayingBarProps, NowPlayingTrack } from "./NowPlayingBar";
