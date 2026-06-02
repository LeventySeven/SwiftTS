"use client";
/**
 * `<MusicSidebar>` — the vibrant left navigation column of macOS Apple Music.
 *
 * Three stacked groups, exactly like the real app:
 *   • "Apple Music" — Home, New, Radio
 *   • "Library"     — Recently Added, Artists, Albums, Songs, Made for You
 *   • "Playlists"   — playlist rows, each with a tiny gradient artwork chip
 *
 * Rows are SF-Symbol + label (via `<SymbolGlyph>`); the selected row lights up
 * in the Apple-Music RED accent. Playlist rows swap the symbol for an 19px
 * rounded-square gradient (mirrors the real per-playlist thumbnail).
 *
 * The column is translucent/vibrant: the structural wash lives in the CSS
 * module and the kit's `glassClass()` is layered on top for the system rim +
 * sheen + glow. Selection is controlled (`selection` + `onSelect`).
 */
import * as React from "react";
import { glassClass } from "../../../system/effects";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import { seedGradient } from "./AlbumCard";
import styles from "./music.module.css";

/** One sidebar entry. A playlist entry carries a gradient chip, not an icon. */
export interface MusicNavItem {
  id: string;
  label: string;
  /** SF Symbol for the leading icon (library/nav rows). */
  systemImage?: string;
  /** Gradient artwork chip (playlist rows) — overrides `systemImage`. */
  artwork?: string;
}

export interface MusicNavSection {
  title?: string;
  items: MusicNavItem[];
}

export interface MusicSidebarProps {
  sections: MusicNavSection[];
  selection?: string;
  onSelect?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/** The default Apple-Music navigation tree. */
export const DEFAULT_MUSIC_SECTIONS: MusicNavSection[] = [
  {
    title: "Apple Music",
    items: [
      { id: "home", label: "Home", systemImage: "house.fill" },
      { id: "new", label: "New", systemImage: "square.grid.2x2" },
      { id: "radio", label: "Radio", systemImage: "speaker.wave.2" },
    ],
  },
  {
    title: "Library",
    items: [
      { id: "recent", label: "Recently Added", systemImage: "clock.fill" },
      { id: "artists", label: "Artists", systemImage: "mic.fill" },
      { id: "albums", label: "Albums", systemImage: "bookmark.fill" },
      { id: "songs", label: "Songs", systemImage: "list.bullet" },
      { id: "made", label: "Made for You", systemImage: "person.crop.circle.fill" },
    ],
  },
  {
    title: "Playlists",
    items: [
      { id: "pl-chill", label: "Late Night Drive", artwork: seedGradient("Late Night Drive") },
      { id: "pl-focus", label: "Deep Focus", artwork: seedGradient("Deep Focus") },
      { id: "pl-throw", label: "2000s Throwbacks", artwork: seedGradient("2000s Throwbacks") },
      { id: "pl-work", label: "Workout Heat", artwork: seedGradient("Workout Heat") },
      { id: "pl-acou", label: "Acoustic Mornings", artwork: seedGradient("Acoustic Mornings") },
    ],
  },
];

function NavRow({
  item,
  selected,
  onSelect,
}: {
  item: MusicNavItem;
  selected: boolean;
  onSelect?: (id: string) => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      className={styles.sbRow}
      data-selected={selected ? "true" : "false"}
      aria-current={selected ? "page" : undefined}
      onClick={() => onSelect?.(item.id)}
    >
      {item.artwork ? (
        <span className={styles.sbArt} style={{ backgroundImage: item.artwork }} aria-hidden />
      ) : (
        <span className={styles.sbRowIcon}>
          <SymbolGlyph name={item.systemImage ?? "music.note"} size={15} weight="semibold" color="currentColor" />
        </span>
      )}
      <span className={styles.sbRowLabel}>{item.label}</span>
    </button>
  );
}

export function MusicSidebar({
  sections,
  selection,
  onSelect,
  className,
  style,
}: MusicSidebarProps): React.ReactElement {
  // Layer the system glass surface (rim + sheen + glow) over the structural
  // vibrant wash from the CSS module.
  const cls = [styles.sidebar, glassClass("regular"), "sui-glassbar", className]
    .filter(Boolean)
    .join(" ");

  return (
    <nav className={cls} style={style} aria-label="Music library">
      <div className={styles.sidebarScroll}>
        {sections.map((sec, si) => (
          <div className={styles.sbSection} key={sec.title ?? si} role="group" aria-label={sec.title}>
            {sec.title ? <div className={styles.sbSectionTitle}>{sec.title}</div> : null}
            {sec.items.map((it) => (
              <NavRow
                key={it.id}
                item={it}
                selected={selection === it.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

MusicSidebar.displayName = "MusicSidebar";
