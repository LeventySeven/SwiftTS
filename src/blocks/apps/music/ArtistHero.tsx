"use client";
/**
 * `<ArtistHero>` — the full-bleed top of an Apple-Music ARTIST page (the The
 * Weeknd reference): a large artist photo filling ~58% of the content height,
 * fading via a bottom linear-gradient into the dark content bg, with floating
 * glass chrome and a red play CTA.
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │ (‹)                                        (★) (…)       │  glass circles
 *   │                                                          │
 *   │            ░░░  full-bleed artist photo  ░░░             │
 *   │                                                          │
 *   │ (▶red)  The Weeknd                                       │  play + name
 *   └──────────────── fades to dark bg ───────────────────────┘
 *
 * The three chrome circles (back / favorite / more) are translucent-gray
 * LIQUID-GLASS circles built from `glassEffectProps(glass.regular, "circle")`
 * (the kit's iOS-26 glass surface) — the module CSS only layers size + the
 * white icon centering on top. The play button is a solid Apple-Music-RED
 * (#FA2D48) circle (~52px); the artist name is 40px white bold beside it.
 *
 * The photo resolves through `<AsyncImage>` when `artistImage` is given; a CSS
 * gradient fallback is always drawn beneath so a missing/loading URL never
 * shows a gray box.
 *
 * Interactive (button handlers) → `"use client"`. SSR-safe.
 */
import * as React from "react";
import { AsyncImage } from "../../../components/AsyncImage";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import { glass, glassEffectProps } from "../../../system/effects";
import styles from "./music-content.module.css";

export interface ArtistHeroProps {
  /** The artist display name, e.g. "The Weeknd". */
  name: string;
  /** Full-bleed hero photo URL. Omit → the gradient fallback fills the frame. */
  artistImage?: string;
  /** Whether the favorite star is filled (favorited). */
  favorited?: boolean;
  /** Red play button → start the artist's station / top songs. */
  onPlay?: () => void;
  /** "‹" back button. */
  onBack?: () => void;
  /** Star (favorite) toggle. */
  onFavorite?: () => void;
  /** "…" more menu. */
  onMore?: () => void;
  className?: string;
}

/** The shared glass-circle props (translucent-gray liquid-glass, clipped to a
 *  circle). Spread onto each chrome button so back/star/more share one surface. */
function glassCircleProps() {
  const props = glassEffectProps(glass.regular, "circle");
  return props;
}

export function ArtistHero({
  name,
  artistImage,
  favorited = false,
  onPlay,
  onBack,
  onFavorite,
  onMore,
  className,
}: ArtistHeroProps): React.ReactElement {
  const gp = glassCircleProps();

  return (
    <section
      className={[styles.hero, className].filter(Boolean).join(" ")}
      aria-label={`${name} — artist`}
    >
      {/* gradient fallback (always present, beneath the photo) */}
      <div className={styles.heroFallback} aria-hidden />

      {/* the full-bleed photo */}
      {artistImage ? (
        <AsyncImage
          url={artistImage}
          content={(src) => (
            <img className={styles.heroImg} src={src} alt={name} />
          )}
          placeholder={() => <></>}
        />
      ) : null}

      {/* top vignette + bottom fade-to-bg */}
      <div className={styles.heroTopWash} aria-hidden />
      <div className={styles.heroScrim} aria-hidden />

      {/* top chrome: back (left) · star + more (right) */}
      <div className={styles.heroTop}>
        <button
          type="button"
          {...gp}
          className={`${gp.className} ${styles.glassCircle}`}
          aria-label="Back"
          onClick={onBack}
        >
          <SymbolGlyph name="chevron.left" size={17} weight="semibold" color="currentColor" />
        </button>

        <div className={styles.heroTopRight}>
          <button
            type="button"
            {...gp}
            className={`${gp.className} ${styles.glassCircle}`}
            aria-label={favorited ? "Remove favorite" : "Favorite"}
            aria-pressed={favorited}
            onClick={onFavorite}
          >
            <SymbolGlyph
              name="star.fill"
              size={15}
              color={favorited ? "#FA2D48" : "currentColor"}
            />
          </button>

          <button
            type="button"
            {...gp}
            className={`${gp.className} ${styles.glassCircle}`}
            aria-label="More"
            onClick={onMore}
          >
            <SymbolGlyph name="ellipsis" size={17} color="currentColor" />
          </button>
        </div>
      </div>

      {/* bottom: red play button + artist name */}
      <div className={styles.heroBottom}>
        <button
          type="button"
          className={styles.heroPlay}
          aria-label={`Play ${name}`}
          onClick={onPlay}
        >
          <SymbolGlyph name="play.fill" size={22} color="currentColor" />
        </button>
        <h1 className={styles.heroName}>{name}</h1>
      </div>
    </section>
  );
}

ArtistHero.displayName = "ArtistHero";
