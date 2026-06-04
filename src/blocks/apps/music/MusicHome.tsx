"use client";
/**
 * `<MusicHome>` — the full scrollable main content of an Apple-Music ARTIST
 * page (the The Weeknd reference, dark mode). It stacks:
 *
 *   1. `<ArtistHero>`        — full-bleed photo + glass chrome + red play CTA
 *   2. "Latest Release"      — thumbnail + date + bold title (+E) + count + ⤓
 *   3. "Top Songs ›"         — a 3-column grid of `<SongRow>` (~3 rows each)
 *   4. "Essential Albums"    — a horizontal row of square album cards
 *
 * Everything below the hero sits on the dark content bg (#161616) the photo
 * fades into. The whole thing is one vertical scroller (`.root`).
 *
 * Demo data is seeded with The Weeknd's catalog so the page renders fully
 * populated out of the box; pass props to override the artist + sections.
 *
 * Interactive (scroll + click-through to play) → `"use client"`. SSR-safe.
 */
import * as React from "react";
import { AsyncImage } from "../../../components/AsyncImage";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import { ArtistHero } from "./ArtistHero";
import { SongRow } from "./SongRow";
import styles from "./music-content.module.css";

/* ───────────────────────── data model ───────────────────────── */

/** A "Top Songs" entry. */
export interface MusicSong {
  id: string;
  title: string;
  /** "Album · Year". */
  subtitle: string;
  artwork?: string;
  gradient?: string;
  explicit?: boolean;
  starred?: boolean;
}

/** An "Essential Albums" entry. */
export interface MusicAlbum {
  id: string;
  title: string;
  subtitle: string;
  artwork?: string;
  gradient?: string;
}

/** The "Latest Release" callout row. */
export interface MusicLatestRelease {
  /** Uppercased date, e.g. "11 FEB 2025". */
  date: string;
  title: string;
  /** Track count, e.g. "27 songs". */
  count: string;
  explicit?: boolean;
  artwork?: string;
  gradient?: string;
}

export interface MusicHomeProps {
  /** Artist display name. Default "The Weeknd". */
  name?: string;
  /** Full-bleed hero photo URL (falls back to a gradient if omitted). */
  artistImage?: string;
  /** The "Latest Release" row. */
  latestRelease?: MusicLatestRelease;
  /** The "Top Songs" pool (laid out into a 3-column grid). */
  topSongs?: MusicSong[];
  /** The "Essential Albums" shelf. */
  essentialAlbums?: MusicAlbum[];
  /** Hero red-play CTA. */
  onPlay?: () => void;
  /** A song row tap. */
  onPlaySong?: (id: string) => void;
  /** An album card tap. */
  onOpenAlbum?: (id: string) => void;
  className?: string;
}

/* ───────────────── seeded demo catalog (The Weeknd) ───────────── */

const G = {
  timeless: "linear-gradient(135deg,#3a0a12,#7a1020)",
  starboy: "linear-gradient(135deg,#b80000,#1a0000)",
  saoPaulo: "linear-gradient(135deg,#5e2a8c,#1a0a2e)",
  girls: "linear-gradient(135deg,#c41e3a,#2a0a14)",
  blinding: "linear-gradient(135deg,#e02020,#0a0a0a)",
  saveYourTears: "linear-gradient(135deg,#d4145a,#2a0a1e)",
  hurry: "linear-gradient(135deg,#7a0a14,#160a0c)",
  afterHours: "linear-gradient(135deg,#b00010,#1c0608)",
  beauty: "linear-gradient(135deg,#3a3a3c,#0a0a0a)",
} as const;

const DEFAULT_LATEST: MusicLatestRelease = {
  date: "11 FEB 2025",
  title: "Hurry Up Tomorrow (Video Album)",
  count: "27 songs",
  explicit: true,
  gradient: G.hurry,
};

const DEFAULT_TOP_SONGS: MusicSong[] = [
  { id: "s1", title: "Timeless", subtitle: "Hurry Up Tomorrow · 2024", explicit: true, starred: true, gradient: G.timeless },
  { id: "s2", title: "Starboy", subtitle: "Starboy · 2016", explicit: true, gradient: G.starboy },
  { id: "s3", title: "São Paulo", subtitle: "Hurry Up Tomorrow · 2024", explicit: true, gradient: G.saoPaulo },
  { id: "s4", title: "One Of The Girls", subtitle: "The Idol Vol. 1 · 2023", explicit: true, starred: true, gradient: G.girls },
  { id: "s5", title: "Blinding Lights", subtitle: "After Hours · 2020", gradient: G.blinding },
  { id: "s6", title: "Save Your Tears", subtitle: "After Hours · 2020", gradient: G.saveYourTears },
  { id: "s7", title: "Die For You", subtitle: "Starboy · 2016", explicit: true, gradient: G.starboy },
  { id: "s8", title: "The Hills", subtitle: "Beauty Behind the Madness · 2015", explicit: true, gradient: G.beauty },
  { id: "s9", title: "Call Out My Name", subtitle: "My Dear Melancholy, · 2018", explicit: true, starred: true, gradient: G.saveYourTears },
];

const DEFAULT_ESSENTIAL: MusicAlbum[] = [
  { id: "alb-starboy", title: "Starboy", subtitle: "2016 · Album", gradient: G.starboy },
  { id: "alb-afterhours", title: "After Hours", subtitle: "2020 · Album", gradient: G.afterHours },
  { id: "alb-beauty", title: "Beauty Behind the Madness", subtitle: "2015 · Album", gradient: G.beauty },
  { id: "alb-hurry", title: "Hurry Up Tomorrow", subtitle: "2025 · Album", gradient: G.hurry },
  { id: "alb-dawn", title: "Dawn FM", subtitle: "2022 · Album", gradient: G.saoPaulo },
];

/* ───────────────────────── helpers ───────────────────────── */

/** Split a flat song list into N roughly-equal sequential columns. */
function toColumns<T>(items: T[], cols: number): T[][] {
  const per = Math.ceil(items.length / cols);
  const out: T[][] = [];
  for (let c = 0; c < cols; c++) {
    out.push(items.slice(c * per, c * per + per));
  }
  return out;
}

/* ───────────────────────── component ───────────────────────── */

export function MusicHome({
  name = "The Weeknd",
  artistImage,
  latestRelease = DEFAULT_LATEST,
  topSongs = DEFAULT_TOP_SONGS,
  essentialAlbums = DEFAULT_ESSENTIAL,
  onPlay,
  onPlaySong,
  onOpenAlbum,
  className,
}: MusicHomeProps = {}): React.ReactElement {
  const columns = React.useMemo(() => toColumns(topSongs, 3), [topSongs]);
  const latestFallback = latestRelease.gradient ?? "linear-gradient(135deg,#3a3a3c,#1c1c1e)";

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <ArtistHero name={name} artistImage={artistImage} onPlay={onPlay} />

      <div className={styles.body}>
        {/* ── Latest Release ── */}
        <section aria-label="Latest Release">
          <h2 className={styles.sectionHead}>Latest Release</h2>
          <div className={styles.latest}>
            <span
              className={styles.latestArt}
              aria-hidden
              style={{ background: latestFallback }}
            >
              {latestRelease.artwork ? (
                <AsyncImage
                  url={latestRelease.artwork}
                  content={(src) => (
                    <img className={styles.latestArtImg} src={src} alt="" />
                  )}
                  placeholder={() => null}
                />
              ) : null}
            </span>

            <div className={styles.latestMeta}>
              <div className={styles.latestDate}>{latestRelease.date}</div>
              <div className={styles.latestTitle}>
                <span className={styles.latestTitleText}>{latestRelease.title}</span>
                {latestRelease.explicit ? (
                  <span className={styles.explicit} aria-label="Explicit">E</span>
                ) : null}
              </div>
              <div className={styles.latestCount}>{latestRelease.count}</div>
            </div>

            <button
              type="button"
              className={styles.download}
              aria-label={`Download ${latestRelease.title}`}
            >
              <SymbolGlyph name="arrow.down" size={15} weight="semibold" color="currentColor" />
            </button>
          </div>
        </section>

        {/* ── Top Songs ── */}
        <section aria-label="Top Songs">
          <button type="button" className={styles.sectionHead}>
            <span>Top Songs</span>
            <span className={styles.sectionChev}>
              <SymbolGlyph name="chevron.right" size={17} weight="bold" color="currentColor" />
            </span>
          </button>

          <div className={styles.songGrid}>
            {columns.map((col, ci) => (
              <div className={styles.songCol} key={`col-${ci}`}>
                {col.map((s) => (
                  <SongRow
                    key={s.id}
                    artwork={s.artwork}
                    gradient={s.gradient}
                    title={s.title}
                    subtitle={s.subtitle}
                    explicit={s.explicit}
                    starred={s.starred}
                    onPlay={() => onPlaySong?.(s.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ── Essential Albums ── */}
        <section aria-label="Essential Albums">
          <h2 className={styles.sectionHead}>Essential Albums</h2>
          <div className={styles.albumRow}>
            {essentialAlbums.map((a) => {
              const fallback = a.gradient ?? "linear-gradient(135deg,#3a3a3c,#1c1c1e)";
              return (
                <button
                  type="button"
                  className={styles.albumCard}
                  key={a.id}
                  aria-label={`${a.title} — ${a.subtitle}`}
                  onClick={() => onOpenAlbum?.(a.id)}
                >
                  <span className={styles.albumArt} aria-hidden style={{ background: fallback }}>
                    {a.artwork ? (
                      <AsyncImage
                        url={a.artwork}
                        content={(src) => (
                          <img className={styles.albumArtImg} src={src} alt="" />
                        )}
                        placeholder={() => null}
                      />
                    ) : null}
                  </span>
                  <span className={styles.albumTitle}>{a.title}</span>
                  <span className={styles.albumSub}>{a.subtitle}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

MusicHome.displayName = "MusicHome";
