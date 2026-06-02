"use client";
/**
 * `<AlbumShelf>` — a titled, horizontally-scrolling row of `<AlbumCard>`s, the
 * fundamental unit of every Apple-Music browse page ("Recently Added", "Made
 * for You", "New Music Mix", "Stations by Genre", …).
 *
 *   ┌ Title  ›                                   See All ┐
 *   │ optional subtitle                                  │
 *   │ [card] [card] [card] [card] [card] …  →scroll→      │
 *   └────────────────────────────────────────────────────┘
 *
 * The header title is a clickable disclosure (chevron nudges on hover, the
 * Apple-Music "tap a shelf title to open the room" affordance). The track is a
 * native horizontal scroller with snap.
 */
import * as React from "react";
import { AlbumCard, type AlbumItem } from "./AlbumCard";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import styles from "./music.module.css";

export interface AlbumShelfProps {
  title: string;
  subtitle?: string;
  items: AlbumItem[];
  /** Card edge length (px) for this shelf. Default 168. */
  cardSize?: number;
  /** Show the trailing "See All" affordance. Default true. */
  showSeeAll?: boolean;
  onOpenShelf?: (title: string) => void;
  onOpenItem?: (id: string) => void;
  onPlayItem?: (id: string) => void;
  className?: string;
}

export function AlbumShelf({
  title,
  subtitle,
  items,
  cardSize = 168,
  showSeeAll = true,
  onOpenShelf,
  onOpenItem,
  onPlayItem,
  className,
}: AlbumShelfProps): React.ReactElement {
  return (
    <section className={[styles.shelf, className].filter(Boolean).join(" ")}>
      <header className={styles.shelfHead}>
        <button
          type="button"
          className={styles.shelfTitle}
          onClick={() => onOpenShelf?.(title)}
        >
          <span>{title}</span>
          <span className={styles.chev}>
            <SymbolGlyph name="chevron.right" size={15} weight="bold" color="currentColor" />
          </span>
        </button>
        {showSeeAll ? (
          <button
            type="button"
            className={styles.shelfMore}
            onClick={() => onOpenShelf?.(title)}
          >
            See All
          </button>
        ) : null}
      </header>
      {subtitle ? <div className={styles.shelfSub}>{subtitle}</div> : null}

      <div className={styles.shelfTrack}>
        {items.map((it) => (
          <AlbumCard
            key={it.id}
            {...it}
            size={cardSize}
            onOpen={onOpenItem}
            onPlay={onPlayItem}
          />
        ))}
      </div>
    </section>
  );
}

AlbumShelf.displayName = "AlbumShelf";
