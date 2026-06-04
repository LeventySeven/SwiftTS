"use client";
/**
 * `<SongRow>` — one entry in the Apple-Music artist "Top Songs" grid.
 *
 *   ┌──────┬───────────────────────────────┬─────┐
 *   │ ▦44  │ Title  [E] ★                   │  …  │
 *   │      │ Album · Year                   │     │
 *   └──────┴───────────────────────────────┴─────┘
 *
 * A small rounded album thumbnail, a two-line title/subtitle stack (with an
 * optional "E" explicit badge and a red favorite star inline with the title),
 * and a trailing "…" overflow menu that fades in on hover. The whole row is a
 * button (tap → play); the "…" stops propagation so it opens the menu instead.
 *
 * Artwork resolves through `<AsyncImage>` when a URL is given, else a passed
 * gradient (or a neutral dark fill) is drawn — never a broken-image box.
 *
 * Interactive (hover reveal + click handlers) → `"use client"`. SSR-safe.
 */
import * as React from "react";
import { AsyncImage } from "../../../components/AsyncImage";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import styles from "./music-content.module.css";

export interface SongRowProps {
  /** Cover-art URL. Omit → the `gradient` (or a dark fill) is drawn. */
  artwork?: string;
  /** Title-seeded gradient fallback (CSS `background` value). */
  gradient?: string;
  title: string;
  /** Secondary line, e.g. "After Hours · 2020". */
  subtitle: string;
  /** Show the "E" explicit badge after the title. */
  explicit?: boolean;
  /** Show the red favorite star after the title. */
  starred?: boolean;
  /** Row tap → play this song. */
  onPlay?: () => void;
  /** "…" → open the overflow menu. */
  onMore?: () => void;
  className?: string;
}

export function SongRow({
  artwork,
  gradient,
  title,
  subtitle,
  explicit = false,
  starred = false,
  onPlay,
  onMore,
  className,
}: SongRowProps): React.ReactElement {
  const fallback = gradient ?? "linear-gradient(135deg,#3a3a3c,#1c1c1e)";

  return (
    <div
      className={[styles.song, className].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      aria-label={`${title} — ${subtitle}`}
      onClick={() => onPlay?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay?.();
        }
      }}
    >
      <span className={styles.songArt} aria-hidden style={{ background: fallback }}>
        {artwork ? (
          <AsyncImage
            url={artwork}
            content={(src) => (
              <img className={styles.songArtImg} src={src} alt="" />
            )}
            placeholder={() => null}
          />
        ) : null}
      </span>

      <span className={styles.songMeta}>
        <span className={styles.songTitleRow}>
          <span className={styles.songTitle}>{title}</span>
          {explicit ? (
            <span className={styles.explicit} aria-label="Explicit">
              E
            </span>
          ) : null}
          {starred ? (
            <span className={styles.songStar} aria-label="Loved">
              <SymbolGlyph name="star.fill" size={11} color="currentColor" />
            </span>
          ) : null}
        </span>
        <span className={styles.songSub}>{subtitle}</span>
      </span>

      <button
        type="button"
        className={styles.songMore}
        aria-label={`More options for ${title}`}
        onClick={(e) => {
          e.stopPropagation();
          onMore?.();
        }}
      >
        <SymbolGlyph name="ellipsis" size={16} color="currentColor" />
      </button>
    </div>
  );
}

SongRow.displayName = "SongRow";
