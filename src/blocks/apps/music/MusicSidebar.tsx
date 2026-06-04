"use client";
/**
 * `<MusicSidebar>` — the DARK vibrant left source-list of macOS Apple Music,
 * encoded to match the reference screenshot (The Weeknd artist page, dark mode).
 *
 * Top → bottom, exactly like the real app:
 *   • traffic-light SAFE-AREA spacer (clears the floating window buttons)
 *   • a recessed RED "Search" pill (leading red magnifyingglass + red text)
 *   • nav rows — Home / New / Radio — RED leading SF-Symbols
 *   • "Library" gray uppercase header
 *       – "Pins" (expandable, disclosure chevron) → Favourite Songs (red ★),
 *         "S" gradient thumbnail
 *       – Recently Added, Artists, Albums, Songs — RED icons
 *   • "Playlists" gray header → All Playlists, Favourite Songs (★), "S" thumb
 *   • pinned FOOTER — circular gradient avatar + "Slade" name
 *
 * The Apple-Music RED accent (#FA2D48) paints every leading icon, the search
 * text, and the stars. The selected row lights up with a subtle white-8%
 * rounded highlight; hover is slightly lighter. The dark NSVisualEffectView
 * vibrancy comes from the kit's `macVibrancyClass("sidebar")` layered on the
 * column; the structural dark wash + layout live in `sidebar.module.css`.
 *
 * Selection is controlled (`selection` + `onSelect`).
 */
import * as React from "react";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import { macVibrancyClass } from "../../../system/platform";
import { seedGradient } from "./AlbumCard";
import styles from "./sidebar.module.css";

/**
 * One source-list entry. Most rows are an SF-Symbol + label; a row can instead
 * carry a small gradient `thumb` (the per-item artwork chip). A `pin` parent is
 * expandable and renders its `children` indented when open.
 */
export interface MusicNavItem {
  id: string;
  label: string;
  /** SF Symbol for the leading icon (nav / library rows). */
  systemImage?: string;
  /** When true the icon is rendered in the RED accent as a star (Favourite). */
  isStar?: boolean;
  /**
   * Small rounded gradient thumbnail (overrides `systemImage`). Pass a CSS
   * gradient string, or `true` to derive one from the label via `seedGradient`.
   * `thumbInitial` overlays a single character (e.g. "S").
   */
  thumb?: string | boolean;
  thumbInitial?: string;
  /** Expandable parent (e.g. "Pins") — renders `children` indented when open. */
  expandable?: boolean;
  /** Children shown indented under an expanded parent. */
  children?: MusicNavItem[];
}

export interface MusicNavSection {
  title?: string;
  items: MusicNavItem[];
}

export interface MusicSidebarProps {
  sections: MusicNavSection[];
  selection?: string;
  onSelect?: (id: string) => void;
  /** Footer identity — circular gradient avatar + name. */
  accountName?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** The default Apple-Music navigation tree (matches the screenshot). */
export const DEFAULT_MUSIC_SECTIONS: MusicNavSection[] = [
  {
    items: [
      { id: "home", label: "Home", systemImage: "house.fill" },
      { id: "new", label: "New", systemImage: "square.grid.2x2" },
      {
        id: "radio",
        label: "Radio",
        systemImage: "dot.radiowaves.left.and.right",
      },
    ],
  },
  {
    title: "Library",
    items: [
      {
        id: "pins",
        label: "Pins",
        systemImage: "pin",
        expandable: true,
        children: [
          {
            id: "pin-fav",
            label: "Favourite Songs",
            systemImage: "star.fill",
            isStar: true,
          },
          { id: "pin-s", label: "S", thumb: true, thumbInitial: "S" },
        ],
      },
      { id: "recent", label: "Recently Added", systemImage: "clock" },
      { id: "artists", label: "Artists", systemImage: "mic" },
      { id: "albums", label: "Albums", systemImage: "square.stack" },
      { id: "songs", label: "Songs", systemImage: "music.note" },
    ],
  },
  {
    title: "Playlists",
    items: [
      { id: "all-pl", label: "All Playlists", systemImage: "music.note.list" },
      {
        id: "pl-fav",
        label: "Favourite Songs",
        systemImage: "star.fill",
        isStar: true,
      },
      { id: "pl-s", label: "S", thumb: true, thumbInitial: "S" },
    ],
  },
];

/** Resolve the gradient string for a thumb (`true` → derive from label). */
function thumbGradient(item: MusicNavItem): string {
  if (typeof item.thumb === "string") return item.thumb;
  return seedGradient(item.thumbInitial ?? item.label);
}

/** A single source-list row (nav / library / playlist / pin-child). */
function Row({
  item,
  selected,
  indented,
  expandable,
  expanded,
  onActivate,
}: {
  item: MusicNavItem;
  selected: boolean;
  indented?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onActivate: () => void;
}): React.ReactElement {
  const cls = [styles.row, indented ? styles.child : ""]
    .filter(Boolean)
    .join(" ");

  let leading: React.ReactElement;
  if (item.thumb) {
    leading = (
      <span
        className={styles.thumb}
        style={{ backgroundImage: thumbGradient(item) }}
        aria-hidden
      >
        {item.thumbInitial ?? ""}
      </span>
    );
  } else {
    leading = (
      <span
        className={[styles.icon, item.isStar ? styles.iconStar : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <SymbolGlyph
          name={item.systemImage ?? "music.note"}
          size={item.isStar ? 14 : 16}
          weight="semibold"
          color="currentColor"
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      data-selected={selected ? "true" : "false"}
      aria-current={selected ? "page" : undefined}
      aria-expanded={expandable ? Boolean(expanded) : undefined}
      onClick={onActivate}
    >
      {leading}
      <span className={styles.label}>{item.label}</span>
      {expandable ? (
        <span
          className={[styles.disclosure, expanded ? styles.disclosureOpen : ""]
            .filter(Boolean)
            .join(" ")}
          aria-hidden
        >
          <SymbolGlyph
            name="chevron.right"
            size={11}
            weight="semibold"
            color="currentColor"
          />
        </span>
      ) : null}
    </button>
  );
}

export function MusicSidebar({
  sections,
  selection,
  onSelect,
  accountName = "Slade",
  className,
  style,
}: MusicSidebarProps): React.ReactElement {
  // Expanded state per expandable parent ("Pins" starts open in the screenshot).
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({
    pins: true,
  });

  const toggle = React.useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // The dark vibrant source-list material (macVibrancyClass) layered on the
  // structural wash. NOT glassClass() — its default shape would balloon a
  // full-height column into a capsule.
  const cls = [styles.sidebar, macVibrancyClass("sidebar"), className]
    .filter(Boolean)
    .join(" ");

  return (
    <nav className={cls} style={style} aria-label="Music library">
      {/* traffic-light safe area */}
      <div className={styles.safeArea} aria-hidden />

      <div className={styles.scroll}>
        {/* search field — recessed RED pill */}
        <div className={styles.search} role="search">
          <span className={styles.searchIcon} aria-hidden>
            <SymbolGlyph
              name="magnifyingglass"
              size={13}
              weight="semibold"
              color="currentColor"
            />
          </span>
          <span className={styles.searchText}>Search</span>
        </div>

        {sections.map((sec, si) => (
          <div
            className={styles.section}
            key={sec.title ?? `sec-${si}`}
            role="group"
            aria-label={sec.title}
          >
            {sec.title ? (
              <div className={styles.sectionHeader}>{sec.title}</div>
            ) : null}

            {sec.items.map((it) => {
              if (it.expandable) {
                const isOpen = Boolean(expanded[it.id]);
                return (
                  <React.Fragment key={it.id}>
                    <Row
                      item={it}
                      selected={selection === it.id}
                      expandable
                      expanded={isOpen}
                      onActivate={() => toggle(it.id)}
                    />
                    {isOpen
                      ? (it.children ?? []).map((child) => (
                          <Row
                            key={child.id}
                            item={child}
                            selected={selection === child.id}
                            indented
                            onActivate={() => onSelect?.(child.id)}
                          />
                        ))
                      : null}
                  </React.Fragment>
                );
              }
              return (
                <Row
                  key={it.id}
                  item={it}
                  selected={selection === it.id}
                  onActivate={() => onSelect?.(it.id)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* pinned footer — circular gradient avatar + name */}
      <div className={styles.footer}>
        <span className={styles.avatar} aria-hidden>
          {accountName.trim().charAt(0).toUpperCase() || "S"}
        </span>
        <span className={styles.footerName}>{accountName}</span>
      </div>
    </nav>
  );
}

MusicSidebar.displayName = "MusicSidebar";
