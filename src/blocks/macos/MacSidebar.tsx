"use client";
/**
 * MacSidebar — the translucent macOS SOURCE LIST (a vibrant sidebar).
 *
 * A full-height column on the AppKit sidebar vibrancy material
 * (`macVibrancyClass("sidebar")`) with:
 *   - small-caps GRAY SECTION HEADERS (optionally COLLAPSIBLE — a disclosure
 *     twisty that reveals on hover, rotating when collapsed),
 *   - selectable ROWS — an SF-symbol leading icon + label + optional COUNT
 *     BADGE, sitting on the platform's source-list row density
 *     (`.sui-mac-sidebar-row`, ~28px) with the rounded accent SELECTION PILL
 *     (`data-selected` → `.sui-mac-selection`),
 *   - an optional FOOTER slot (account chip / settings) pinned to the bottom.
 *
 * Data-driven (`sections` prop) OR composed by hand (children + the exported
 * `MacSidebarSection` / `MacSidebarRow` primitives). Selection is controlled via
 * `selection` + `onSelect`, matching SwiftUI's `List(selection:)`. The
 * unfocused-window gray selection is driven by `windowActive=false`.
 *
 * Stateful (selection callbacks, collapse state) → `"use client"`. SSR-safe.
 */
import * as React from "react";
import {
  MAC_SIDEBAR_ROW_CLASS,
  macVibrancyClass,
} from "../../system/platform";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./macos.module.css";

/* ───────────────────────── data shapes ───────────────── */

export interface MacSidebarItem {
  /** Stable id used for selection + key. */
  id: string;
  /** Row label. */
  label: string;
  /** SF Symbol name (leading icon). */
  systemImage?: string;
  /** Trailing count badge (a number or short text). */
  count?: number | string;
  /** Render as a link instead of a button. */
  href?: string;
  disabled?: boolean;
  /** Per-row click (in addition to selection). */
  onClick?: () => void;
}

export interface MacSidebarSectionData {
  /** Stable key (falls back to title/index). */
  id?: string;
  /** Small-caps section header text. */
  title?: string;
  /** Make the section header a collapsible disclosure. */
  collapsible?: boolean;
  /** Initially collapsed (uncontrolled). */
  defaultCollapsed?: boolean;
  items: MacSidebarItem[];
}

/* ───────────────────────── row primitive ───────────────── */

export interface MacSidebarRowProps {
  item?: MacSidebarItem;
  /** Inline form (when not passing an `item`). */
  id?: string;
  label?: string;
  systemImage?: string;
  count?: number | string;
  href?: string;
  disabled?: boolean;
  selected?: boolean;
  /** Window-active state — `false` → gray inactive selection pill. */
  windowActive?: boolean;
  onSelect?: (id: string) => void;
  onClick?: () => void;
}

export function MacSidebarRow(props: MacSidebarRowProps): React.ReactElement {
  const it: MacSidebarItem = props.item ?? {
    id: props.id ?? "",
    label: props.label ?? "",
    systemImage: props.systemImage,
    count: props.count,
    href: props.href,
    disabled: props.disabled,
    onClick: props.onClick,
  };

  const select = () => {
    if (it.disabled) return;
    it.onClick?.();
    if (it.id) props.onSelect?.(it.id);
  };

  // The platform source-list row class supplies density + hover + the pill.
  const common = {
    className: [styles.sidebarRow, MAC_SIDEBAR_ROW_CLASS].join(" "),
    "data-selected": props.selected ? "true" : undefined,
    "data-window-active": props.selected
      ? props.windowActive === false
        ? "false"
        : "true"
      : undefined,
    "aria-selected": props.selected,
    "data-row-id": it.id || undefined,
  } as const;

  const inner = (
    <>
      {it.systemImage ? (
        <span className={styles.sidebarRowIcon}>
          <SymbolGlyph name={it.systemImage} size={16} weight="regular" />
        </span>
      ) : null}
      <span className={styles.sidebarRowLabel}>{it.label}</span>
      {it.count != null && it.count !== "" ? (
        <span className={styles.sidebarRowCount}>{it.count}</span>
      ) : null}
    </>
  );

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
MacSidebarRow.displayName = "MacSidebarRow";

/* ───────────────────────── section primitive ───────────────── */

export interface MacSidebarSectionProps {
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Controlled collapse state (overrides the internal state). */
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  children?: React.ReactNode;
}

export function MacSidebarSection({
  title,
  collapsible,
  defaultCollapsed,
  collapsed,
  onToggle,
  children,
}: MacSidebarSectionProps): React.ReactElement {
  const [inner, setInner] = React.useState(!!defaultCollapsed);
  const isCollapsed = collapsed !== undefined ? collapsed : inner;

  const toggle = () => {
    const next = !isCollapsed;
    if (collapsed === undefined) setInner(next);
    onToggle?.(next);
  };

  const header =
    title != null ? (
      collapsible ? (
        <button
          type="button"
          className={[styles.sectionHeader, styles.sectionHeaderButton].join(" ")}
          aria-expanded={!isCollapsed}
          onClick={toggle}
        >
          <span className={styles.sectionTwisty} aria-hidden="true">
            <SymbolGlyph name="chevron.down" size={9} weight="bold" />
          </span>
          {title}
        </button>
      ) : (
        <div className={styles.sectionHeader}>{title}</div>
      )
    ) : null;

  return (
    <div
      className={styles.section}
      data-collapsed={isCollapsed ? "true" : undefined}
      role="group"
      aria-label={title}
    >
      {header}
      <div className={styles.sectionRows}>{children}</div>
    </div>
  );
}
MacSidebarSection.displayName = "MacSidebarSection";

/* ───────────────────────── the sidebar ───────────────── */

export interface MacSidebarProps {
  /** Data-driven sections. Omit + use `children` to compose by hand. */
  sections?: MacSidebarSectionData[];
  children?: React.ReactNode;

  /** Footer slot (account chip / settings), pinned to the bottom. */
  footer?: React.ReactNode;

  /** Controlled selected row id. */
  selection?: string;
  onSelect?: (id: string) => void;

  /** Window-active — `false` → gray inactive selection pill. Default `true`. */
  windowActive?: boolean;

  /** Sidebar width in px (default 220, the macOS source-list width). */
  width?: number;

  /** The vibrancy material. Defaults to `"sidebar"`. */
  material?: Parameters<typeof macVibrancyClass>[0];

  className?: string;
  style?: React.CSSProperties;
}

export const MacSidebar = React.forwardRef<HTMLElement, MacSidebarProps>(
  function MacSidebar(
    {
      sections,
      children,
      footer,
      selection,
      onSelect,
      windowActive = true,
      width,
      material = "sidebar",
      className,
      style,
    },
    ref,
  ) {
    const cls = [styles.sidebar, macVibrancyClass(material), className]
      .filter(Boolean)
      .join(" ");

    return (
      <nav
        ref={ref as React.Ref<HTMLElement>}
        className={cls}
        style={{
          ...(width != null ? { ["--mac-sidebar-w" as string]: `${width}px` } : null),
          ...style,
        }}
        aria-label="Sidebar"
      >
        <div className={styles.sidebarScroll}>
          {sections
            ? sections.map((sec, si) => (
                <MacSidebarSection
                  key={sec.id ?? sec.title ?? si}
                  title={sec.title}
                  collapsible={sec.collapsible}
                  defaultCollapsed={sec.defaultCollapsed}
                >
                  {sec.items.map((it) => (
                    <MacSidebarRow
                      key={it.id}
                      item={it}
                      selected={selection === it.id}
                      windowActive={windowActive}
                      onSelect={onSelect}
                    />
                  ))}
                </MacSidebarSection>
              ))
            : children}
        </div>

        {footer ? <div className={styles.sidebarFooter}>{footer}</div> : null}
      </nav>
    );
  },
);

MacSidebar.displayName = "MacSidebar";
