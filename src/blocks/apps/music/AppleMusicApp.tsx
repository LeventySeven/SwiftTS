"use client";
/**
 * `<AppleMusicApp>` — a faithful macOS Apple Music window template, composed
 * entirely from the SwiftTS kit.
 *
 *   ┌───────────────┬──────────────────────────────────────────┐
 *   │ ● ● ●         │  ‹ ›        [ Search ]                    │  titlebar
 *   │ Apple Music   ├──────────────────────────────────────────┤
 *   │   Home        │  ┌────────── Listen Now hero ──────────┐  │
 *   │   New         │  │  ARTWORK · CTA                       │  │
 *   │   Radio       │  └──────────────────────────────────────┘ │
 *   │ Library       │  Recently Added  ›        [card][card]…   │  shelves
 *   │   …           │  Made for You    ›        [card][card]…   │
 *   │ Playlists     │  Browse by Category       [tile][tile]…   │  grid
 *   │   ▦ Late…     │                                            │
 *   ├───────────────┴──────────────────────────────────────────┤
 *   │ ▦ Title — Artist  ⤺ ◀ ▮▶ ▶ ⟳   ──●──  🔈──●── ☰          │  now-playing bar
 *   └──────────────────────────────────────────────────────────┘
 *
 * The window is a CSS grid (sidebar | main / bar). The titlebar carries macOS
 * traffic lights, back/forward nav arrows, and a centered search field. The
 * main column is the Apple-Music browse surface: a Listen-Now hero, a stack of
 * horizontally-scrolling `<AlbumShelf>`s, and a Browse-by-category grid. The
 * pinned `<NowPlayingBar>` runs across the full width.
 *
 * Color scheme follows `useEnvironment().colorScheme` (Apple Music ships dark
 * by default but renders correctly in light too). `"use client"` — owns
 * selection + the now-playing transport state.
 */
import * as React from "react";
import { useEnvironment } from "../../../system/environment";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import {
  MusicSidebar,
  DEFAULT_MUSIC_SECTIONS,
  type MusicNavSection,
} from "./MusicSidebar";
import { AlbumShelf } from "./AlbumShelf";
import { type AlbumItem, seedGradient } from "./AlbumCard";
import { NowPlayingBar, type NowPlayingTrack } from "./NowPlayingBar";
import styles from "./music.module.css";

/* ───────────────────────── demo catalog ───────────────── */

function makeItems(titles: [string, string][]): AlbumItem[] {
  return titles.map(([title, subtitle], i) => ({
    id: `${title}-${i}`,
    title,
    subtitle,
    gradient: seedGradient(title),
  }));
}

const RECENTLY_ADDED = makeItems([
  ["Solar Power", "Lorde"],
  ["After Hours", "The Weeknd"],
  ["Currents", "Tame Impala"],
  ["Blonde", "Frank Ocean"],
  ["Random Access Memories", "Daft Punk"],
  ["In Rainbows", "Radiohead"],
  ["Channel Orange", "Frank Ocean"],
  ["Melodrama", "Lorde"],
]);

const MADE_FOR_YOU: AlbumItem[] = [
  { id: "mfy-1", title: "New Music Mix", subtitle: "Updated Friday", gradient: "linear-gradient(135deg,#fc3c44,#ff7a45)" },
  { id: "mfy-2", title: "Favorites Mix", subtitle: "Updated Tuesday", gradient: "linear-gradient(135deg,#7d2ae8,#fc3c44)" },
  { id: "mfy-3", title: "Get Up! Mix", subtitle: "Updated Monday", gradient: "linear-gradient(135deg,#0aa2ff,#7d2ae8)" },
  { id: "mfy-4", title: "Chill Mix", subtitle: "Updated Sunday", gradient: "linear-gradient(135deg,#34c759,#0aa2ff)" },
  { id: "mfy-5", title: "Heavy Rotation", subtitle: "Made for You", gradient: "linear-gradient(135deg,#ff9f0a,#fc3c44)" },
  { id: "mfy-6", title: "Discovery Station", subtitle: "Made for You", gradient: "linear-gradient(135deg,#5e5ce6,#34c759)" },
];

const STATIONS = makeItems([
  ["Pop Hits Radio", "Apple Music"],
  ["Hip-Hop / R&B", "Apple Music"],
  ["Dance Station", "Apple Music"],
  ["Indie Radio", "Apple Music"],
  ["Classic Rock", "Apple Music"],
  ["Lo-Fi Beats", "Apple Music"],
]);

const ARTISTS: AlbumItem[] = [
  { id: "a-1", title: "Lorde", round: true, gradient: seedGradient("Lorde") },
  { id: "a-2", title: "Frank Ocean", round: true, gradient: seedGradient("Frank Ocean") },
  { id: "a-3", title: "Tame Impala", round: true, gradient: seedGradient("Tame Impala") },
  { id: "a-4", title: "Daft Punk", round: true, gradient: seedGradient("Daft Punk") },
  { id: "a-5", title: "The Weeknd", round: true, gradient: seedGradient("The Weeknd") },
  { id: "a-6", title: "Radiohead", round: true, gradient: seedGradient("Radiohead") },
];

const CATEGORIES: { id: string; label: string; gradient: string }[] = [
  { id: "c-pop", label: "Pop", gradient: "linear-gradient(135deg,#fc3c44,#ff7a45)" },
  { id: "c-hh", label: "Hip-Hop", gradient: "linear-gradient(135deg,#1d1d1f,#5e5ce6)" },
  { id: "c-dance", label: "Dance", gradient: "linear-gradient(135deg,#0aa2ff,#34c759)" },
  { id: "c-rock", label: "Rock", gradient: "linear-gradient(135deg,#8e8e93,#1d1d1f)" },
  { id: "c-chill", label: "Chill", gradient: "linear-gradient(135deg,#5ac8fa,#7d2ae8)" },
  { id: "c-acoustic", label: "Acoustic", gradient: "linear-gradient(135deg,#ff9f0a,#ffd60a)" },
];

const DEFAULT_NOW_PLAYING: NowPlayingTrack = {
  title: "Green Light",
  artist: "Lorde",
  album: "Melodrama",
  durationSec: 234,
  gradient: seedGradient("Melodrama"),
};

/* ───────────────────────── pieces ───────────────── */

function TitleBar(): React.ReactElement {
  return (
    <header className={styles.titlebar}>
      <div className={styles.navArrows}>
        <button type="button" className={styles.navArrow} disabled aria-label="Back">
          <SymbolGlyph name="chevron.left" size={16} weight="semibold" color="currentColor" />
        </button>
        <button type="button" className={styles.navArrow} aria-label="Forward">
          <SymbolGlyph name="chevron.right" size={16} weight="semibold" color="currentColor" />
        </button>
      </div>
      <label className={styles.search}>
        <SymbolGlyph name="list.bullet" size={13} color="currentColor" aria-hidden />
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search"
          aria-label="Search Apple Music"
        />
      </label>
    </header>
  );
}

function Hero({
  onPlay,
}: {
  onPlay?: () => void;
}): React.ReactElement {
  return (
    <section className={styles.hero} aria-label="Listen Now featured">
      <div
        className={styles.heroArt}
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 20%, #fc3c44 0%, transparent 55%)," +
            "radial-gradient(circle at 80% 30%, #7d2ae8 0%, transparent 55%)," +
            "radial-gradient(circle at 55% 90%, #ff9f0a 0%, transparent 60%)," +
            "linear-gradient(135deg, #2a0a1c, #1a0a2e)",
        }}
        aria-hidden
      />
      <div className={styles.heroScrim} aria-hidden />
      <div className={styles.heroBody}>
        <div className={styles.heroKicker}>Listen Now · Top Pick</div>
        <div className={styles.heroTitle}>Melodrama</div>
        <div className={styles.heroSub}>Lorde · The album that defined a generation of pop.</div>
        <button type="button" className={styles.heroPlay} onClick={onPlay}>
          <SymbolGlyph name="play.fill" size={14} color="currentColor" />
          <span>Play</span>
        </button>
      </div>
    </section>
  );
}

/* ───────────────────────── the app ───────────────── */

export interface AppleMusicAppProps {
  /** Sidebar navigation tree. Defaults to the canonical Apple-Music tree. */
  sections?: MusicNavSection[];
  /** Initially-selected sidebar row id. Default `"home"`. */
  defaultSelection?: string;
  /** The track shown in the now-playing bar. */
  nowPlaying?: NowPlayingTrack;
  className?: string;
  style?: React.CSSProperties;
}

export function AppleMusicApp({
  sections = DEFAULT_MUSIC_SECTIONS,
  defaultSelection = "home",
  nowPlaying = DEFAULT_NOW_PLAYING,
  className,
  style,
}: AppleMusicAppProps = {}): React.ReactElement {
  const env = useEnvironment();
  const scheme = env.colorScheme === "dark" ? "dark" : "light";

  const [selection, setSelection] = React.useState(defaultSelection);
  const [track, setTrack] = React.useState<NowPlayingTrack>(nowPlaying);
  const [playing, setPlaying] = React.useState(true);

  // Find an album by id across the demo catalog → drive the now-playing bar.
  const playItem = React.useCallback((id: string) => {
    const all: AlbumItem[] = [
      ...RECENTLY_ADDED,
      ...MADE_FOR_YOU,
      ...STATIONS,
      ...ARTISTS,
    ];
    const found = all.find((a) => a.id === id);
    if (found) {
      setTrack({
        title: found.title,
        artist: found.subtitle ?? "Apple Music",
        album: found.subtitle,
        gradient: found.gradient ?? seedGradient(found.title),
        durationSec: 200 + (found.title.length % 7) * 12,
      });
      setPlaying(true);
    }
  }, []);

  return (
    <div
      className={[styles.app, className].filter(Boolean).join(" ")}
      data-scheme={scheme}
      style={style}
      role="application"
      aria-label="Apple Music"
    >
      {/* macOS traffic lights (drawn over the sidebar's top-left) */}
      <div className={styles.traffic} aria-hidden>
        <span className={`${styles.light} ${styles.lightClose}`} />
        <span className={`${styles.light} ${styles.lightMin}`} />
        <span className={`${styles.light} ${styles.lightZoom}`} />
      </div>

      <TitleBar />

      <MusicSidebar sections={sections} selection={selection} onSelect={setSelection} />

      <main className={styles.main}>
        <div className={styles.mainScroll}>
          <Hero onPlay={() => playItem(MADE_FOR_YOU[0].id)} />

          <AlbumShelf
            title="Recently Added"
            items={RECENTLY_ADDED}
            onPlayItem={playItem}
          />

          <AlbumShelf
            title="Made for You"
            subtitle="Mixes refreshed for your taste"
            items={MADE_FOR_YOU}
            cardSize={190}
            onPlayItem={playItem}
          />

          <AlbumShelf
            title="Artists You Follow"
            items={ARTISTS}
            cardSize={140}
            onPlayItem={playItem}
          />

          <AlbumShelf
            title="Stations by Apple Music"
            items={STATIONS}
            onPlayItem={playItem}
          />

          {/* Browse-by-category grid */}
          <section className={styles.gridSection} aria-label="Browse by category">
            <h2 className={styles.shelfTitle} style={{ cursor: "default" }}>
              Browse by Category
            </h2>
            <div className={styles.grid}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={styles.gridTile}
                  onClick={() => setSelection("new")}
                >
                  <span className={styles.gridTileArt} style={{ background: c.gradient }} aria-hidden />
                  <span className={styles.gridTileLabel}>{c.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>

      <NowPlayingBar
        track={track}
        playing={playing}
        onPlayingChange={setPlaying}
      />
    </div>
  );
}

AppleMusicApp.displayName = "AppleMusicApp";
