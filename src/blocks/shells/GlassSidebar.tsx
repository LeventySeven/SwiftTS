"use client";
/**
 * GlassSidebar — a Liquid-Glass sidebar template.
 *
 * The "everything-layer" sidebar: a full-height glass column built from the
 * kit's glass classes (`glassClass` from ../../system/effects) with
 *   • a HEADER (app icon + name, or a profile chip),
 *   • SECTIONS of selectable ROWS (SF-symbol icon + label + optional badge),
 *   • a FOOTER slot (settings, account, sign-out).
 *
 * Data-driven (`sections` prop) OR composed by hand (children + the exported
 * `SidebarRow` / `SidebarSection` primitives). Selection is controlled via
 * `selection` + `onSelect`, matching SwiftUI's `List(selection:)` idiom; rows
 * carry `aria-selected` so the §6.7 glass-selection CSS lights up.
 *
 * Stateful (selection callback) → `"use client"`. SSR-safe.
 */
import * as React from "react";
import { glassClass } from "../../system/effects";
import type { Glass, GlassVariant } from "../../system/effects";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./shells.module.css";

/** A selectable sidebar row descriptor. */
export interface SidebarItem {
  /** Stable id used for selection + key. */
  id: string;
  /** Row label text. */
  label: string;
  /** SF Symbol name (leading icon). */
  systemImage?: string;
  /** Badge: a count (number) or short text (string). */
  badge?: number | string;
  /** Badge tone — `"alert"` (red, default) or `"neutral"` (gray pill). */
  badgeTone?: "alert" | "neutral";
  /** Show a trailing chevron (disclosure). */
  chevron?: boolean;
  /** Render as a link instead of a button. */
  href?: string;
  /** Disable the row. */
  disabled?: boolean;
  /** Per-row click (in addition to selection). */
  onClick?: () => void;
}

/** A titled group of rows. */
export interface SidebarSectionData {
  /** Optional uppercase section header. */
  title?: string;
  /** Stable key (falls back to title/index). */
  id?: string;
  items: SidebarItem[];
}

export interface SidebarHeaderInfo {
  /** App / profile name. */
  title: string;
  /** Secondary line (workspace, email, role…). */
  subtitle?: string;
  /** SF Symbol for the leading square icon. */
  systemImage?: string;
  /** Image URL (avatar) — overrides `systemImage`. */
  imageURL?: string;
}

export interface GlassSidebarProps {
  /** Header descriptor (app/profile). Omit + use `header` for a custom node. */
  headerInfo?: SidebarHeaderInfo;
  /** Custom header node (overrides `headerInfo`). */
  header?: React.ReactNode;

  /** Data-driven sections. Omit + use `children` to compose by hand. */
  sections?: SidebarSectionData[];
  /** Hand-composed body (SidebarSection / SidebarRow). */
  children?: React.ReactNode;

  /** Footer slot (settings, account, sign-out). */
  footer?: React.ReactNode;

  /** Controlled selected row id. */
  selection?: string;
  /** Selection change callback. */
  onSelect?: (id: string) => void;

  /** Render the glass surface (iOS-26). Default `true`. */
  glass?: boolean | Glass | GlassVariant;

  className?: string;
  style?: React.CSSProperties;
}

/* ───────────────────────── primitives (compose by hand) ───────────────── */

export interface SidebarRowProps {
  item?: SidebarItem;
  /** Inline form (when not passing an `item`). */
  id?: string;
  label?: string;
  systemImage?: string;
  badge?: number | string;
  badgeTone?: "alert" | "neutral";
  chevron?: boolean;
  href?: string;
  disabled?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onClick?: () => void;
}

export function SidebarRow(props: SidebarRowProps): React.ReactElement {
  const it: SidebarItem = props.item ?? {
    id: props.id ?? "",
    label: props.label ?? "",
    systemImage: props.systemImage,
    badge: props.badge,
    badgeTone: props.badgeTone,
    chevron: props.chevron,
    href: props.href,
    disabled: props.disabled,
    onClick: props.onClick,
  };
  const select = () => {
    if (it.disabled) return;
    it.onClick?.();
    if (it.id) props.onSelect?.(it.id);
  };

  const inner = (
    <>
      {it.systemImage ? (
        <span className={styles.rowIcon}>
          <SymbolGlyph name={it.systemImage} size={20} weight="medium" />
        </span>
      ) : null}
      <span className={styles.rowLabel}>{it.label}</span>
      {it.badge != null && it.badge !== "" ? (
        <span className={styles.rowBadge} data-tone={it.badgeTone === "neutral" ? "neutral" : undefined}>
          {it.badge}
        </span>
      ) : null}
      {it.chevron ? (
        <span className={styles.rowChevron}>
          <SymbolGlyph name="chevron.right" size={13} weight="semibold" />
        </span>
      ) : null}
    </>
  );

  const common = {
    className: styles.row,
    "data-selected": props.selected ? "true" : undefined,
    "aria-selected": props.selected,
    "data-row-id": it.id || undefined,
  } as const;

  if (it.href && !it.disabled) {
    return (
      <a href={it.href} {...common} onClick={select}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" {...common} disabled={it.disabled} onClick={select}>
      {inner}
    </button>
  );
}

export interface SidebarSectionProps {
  title?: string;
  children?: React.ReactNode;
}

export function SidebarSection({
  title,
  children,
}: SidebarSectionProps): React.ReactElement {
  return (
    <div className={styles.sidebarSection} role="group" aria-label={title}>
      {title ? <div className={styles.sidebarSectionTitle}>{title}</div> : null}
      {children}
    </div>
  );
}

/* ───────────────────────── header ───────────────── */

function SidebarHeader({ info }: { info: SidebarHeaderInfo }): React.ReactElement {
  return (
    <div className={styles.sidebarHeader}>
      <span className={styles.sidebarHeaderIcon}>
        {info.imageURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.imageURL}
            alt=""
            style={{ width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover" }}
          />
        ) : (
          <SymbolGlyph name={info.systemImage ?? "app.fill"} size={20} weight="semibold" />
        )}
      </span>
      <span className={styles.sidebarHeaderText}>
        <span className={styles.sidebarHeaderTitle}>{info.title}</span>
        {info.subtitle ? (
          <span className={styles.sidebarHeaderSubtitle}>{info.subtitle}</span>
        ) : null}
      </span>
    </div>
  );
}

/* ───────────────────────── the sidebar ───────────────── */

export const GlassSidebar = React.forwardRef<HTMLDivElement, GlassSidebarProps>(
  function GlassSidebar(
    {
      headerInfo,
      header,
      sections,
      children,
      footer,
      selection,
      onSelect,
      glass = true,
      className,
      style,
    },
    ref,
  ) {
    const isGlass = glass !== false;
    // Reuse the canonical glass surface class so the panel shares rim/sheen/glow.
    const glassSurface = isGlass
      ? glassClass(glass === true ? "regular" : glass)
      : "";

    const cls = [
      styles.sidebar,
      isGlass ? styles.sidebarGlass : styles.sidebarPlain,
      glassSurface,
      "sui-glassbar",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <nav ref={ref} className={cls} style={style} aria-label="Sidebar">
        {header ?? (headerInfo ? <SidebarHeader info={headerInfo} /> : null)}

        <div className={styles.sidebarBody}>
          {sections
            ? sections.map((sec, si) => (
                <SidebarSection key={sec.id ?? sec.title ?? si} title={sec.title}>
                  {sec.items.map((it) => (
                    <SidebarRow
                      key={it.id}
                      item={it}
                      selected={selection === it.id}
                      onSelect={onSelect}
                    />
                  ))}
                </SidebarSection>
              ))
            : children}
        </div>

        {footer ? <div className={styles.sidebarFooter}>{footer}</div> : null}
      </nav>
    );
  },
);

GlassSidebar.displayName = "GlassSidebar";
