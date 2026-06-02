"use client";
/**
 * `<AlbumCard>` — one card in an Apple-Music shelf: a rounded square of artwork
 * with a title + subtitle underneath, a hover-reveal play button, and an
 * optional circular variant (for Artists / "Made for You" face rows).
 *
 * Artwork resolves through the kit's `<AsyncImage>` when an `artworkUrl` is
 * given; otherwise it falls back to a deterministic vivid CSS gradient derived
 * from the title (so a placeholder catalog still looks like cover art, never a
 * gray box).
 *
 * Stateful only through the parent's click handlers — but it renders an
 * interactive play button, so it lives behind `"use client"`. SSR-safe.
 */
import * as React from "react";
import { AsyncImage } from "../../../components/AsyncImage";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import styles from "./music.module.css";

/** A single album / playlist / station entry. */
export interface AlbumItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Cover-art URL. Omit → a title-seeded gradient placeholder is drawn. */
  artworkUrl?: string;
  /** Explicit gradient override (CSS `background` value). */
  gradient?: string;
  /** Render artwork as a circle (artists / face piles). */
  round?: boolean;
}

export interface AlbumCardProps extends AlbumItem {
  /** Edge length of the square artwork in px. Default 168. */
  size?: number;
  /** Click → "open" this item. */
  onOpen?: (id: string) => void;
  /** Play button → start this item. */
  onPlay?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/** Two vivid hues seeded from the title → a stable diagonal gradient. */
export function seedGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 40 + ((h >> 8) % 80)) % 360;
  return (
    `linear-gradient(135deg, ` +
    `hsl(${h1} 78% 56%) 0%, ` +
    `hsl(${h2} 70% 44%) 100%)`
  );
}

export function AlbumCard({
  id,
  title,
  subtitle,
  artworkUrl,
  gradient,
  round = false,
  size = 168,
  onOpen,
  onPlay,
  className,
  style,
}: AlbumCardProps): React.ReactElement {
  const bg = gradient ?? seedGradient(title || id);

  const artStyle: React.CSSProperties = { background: bg };

  return (
    <div
      className={[styles.card, className].filter(Boolean).join(" ")}
      data-round={round ? "true" : "false"}
      style={{ ["--card-w" as string]: `${size}px`, ...style }}
      role="button"
      tabIndex={0}
      aria-label={subtitle ? `${title} — ${subtitle}` : title}
      onClick={() => onOpen?.(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(id);
        }
      }}
    >
      <div className={styles.cardArtWrap}>
        {artworkUrl ? (
          <AsyncImage
            url={artworkUrl}
            content={(src) => (
              <span
                className={styles.cardArt}
                style={{ backgroundImage: `url(${src})` }}
              />
            )}
            placeholder={() => <span className={styles.cardArt} style={artStyle} />}
            className={styles.cardArt}
          />
        ) : (
          <span className={styles.cardArt} style={artStyle} aria-hidden />
        )}

        <div className={styles.cardArtOverlay}>
          <button
            type="button"
            className={styles.cardPlay}
            aria-label={`Play ${title}`}
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.(id);
            }}
          >
            <SymbolGlyph name="play.fill" size={15} color="currentColor" />
          </button>
        </div>
      </div>

      <div className={styles.cardTitle}>{title}</div>
      {subtitle ? <div className={styles.cardSub}>{subtitle}</div> : null}
    </div>
  );
}

AlbumCard.displayName = "AlbumCard";
