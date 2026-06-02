/**
 * `src/blocks/apps` — full, faithful re-creations of real Apple apps, each
 * built end-to-end from the SwiftTS kit and macOS window chrome.
 *
 * Each app lives in its own subfolder with its own barrel; this aggregates
 * them. Names are disjoint across apps, so a flat re-export is unambiguous.
 *
 *   • music/  — macOS Apple Music (AppleMusicApp + MusicSidebar / AlbumCard /
 *               AlbumShelf / NowPlayingBar)
 *   • notes/  — macOS Apple Notes (AppleNotesApp + folder/list/editor columns)
 */
export * from "./music";
export * from "./notes";
