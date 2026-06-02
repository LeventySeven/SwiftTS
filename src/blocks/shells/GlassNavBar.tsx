"use client";
/**
 * GlassNavBar — a standalone floating Liquid-Glass navigation bar template.
 *
 * This is the "everything-layer" block: it composes the kit's glass nav helpers
 * (`useLiquidGlassMode` / `resolveBarSurface` / `glassBarClass` / `glassBarStyle`
 * from ../../components/navigation) so the bar shares the EXACT same specular rim
 * + sheen + glow tokens as every other `.sui-glass` surface, and layers the
 * floating-bar geometry (concentric corners, float inset, soft drop) from
 * shells.module.css on top.
 *
 * Three real-world iOS configurations, all driven by props:
 *   • compact         — leading / centered-or-leading title / trailing slots
 *   • large-title     — adds the `.large` title row below the compact row
 *   • search          — adds an inline search field row (UISearchController look)
 *
 * Slots: `leading`, `trailing`, `title` accept arbitrary children, OR use the
 * shorthand props (`title` string, `leadingItems` / `trailingItems` button
 * descriptors). Built so a developer can drop it over any content area.
 *
 * Stateful only for the (optional) search field, so it is `"use client"`.
 * SSR-safe: no layout effects on first paint, no window reads at module scope.
 */
import * as React from "react";
import {
  useLiquidGlassMode,
  resolveBarSurface,
  glassBarClass,
  glassBarStyle,
} from "../../components/navigation";
import type { Glass, GlassVariant } from "../../system/effects";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./shells.module.css";

/** A bar slot button descriptor (the shorthand for leading/trailing items). */
export interface BarButtonItem {
  /** Stable key (falls back to index). */
  id?: string;
  /** SF Symbol name rendered via SymbolGlyph. */
  systemImage?: string;
  /** Text label (shown after the icon, or alone). */
  label?: string;
  /** Click handler. */
  onClick?: () => void;
  /** Filled tint pill (e.g. a primary "Done"/"Add" action). */
  prominent?: boolean;
  /** Disable the control. */
  disabled?: boolean;
  /** Accessible label when icon-only. */
  accessibilityLabel?: string;
}

export type GlassNavBarVariant = "compact" | "large" | "search";
export type GlassNavBarTitleAlign = "leading" | "center";

export interface GlassNavBarProps {
  /** Title string (used for compact + large rows). Omit + use `titleContent`. */
  title?: string;
  /** Secondary line under a large title. */
  subtitle?: string;
  /** Override the centered title node entirely. */
  titleContent?: React.ReactNode;
  /** Compact-title horizontal alignment. iOS default is `center`. */
  titleAlign?: GlassNavBarTitleAlign;

  /** Leading slot children (overrides `leadingItems`). */
  leading?: React.ReactNode;
  /** Trailing slot children (overrides `trailingItems`). */
  trailing?: React.ReactNode;
  /** Shorthand leading buttons. */
  leadingItems?: BarButtonItem[];
  /** Shorthand trailing buttons. */
  trailingItems?: BarButtonItem[];

  /** `compact` | `large` | `search`. Default `compact`. */
  variant?: GlassNavBarVariant;

  /** Search props (variant === "search"). Controlled. */
  searchText?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  /** Float the bar (inset + concentric corners + drop). Default `true` (iOS 26). */
  floating?: boolean;
  /** Force classic frosted `.bar` material instead of glass. */
  material?: boolean;
  /** Force/configure glass: a `Glass` value, variant string, or boolean. */
  glass?: boolean | Glass | GlassVariant;

  className?: string;
  style?: React.CSSProperties;
  /** Extra children appended below all rows (e.g. a segmented control). */
  children?: React.ReactNode;
}

/** Render a single shorthand bar button (icon and/or label). */
function BarButton({ item }: { item: BarButtonItem }): React.ReactElement {
  const iconOnly = item.systemImage != null && !item.label;
  return (
    <button
      type="button"
      className={styles.barButton}
      data-prominent={item.prominent ? "true" : undefined}
      disabled={item.disabled}
      onClick={item.onClick}
      aria-label={item.accessibilityLabel ?? (iconOnly ? item.systemImage : undefined)}
    >
      {item.systemImage ? (
        <SymbolGlyph name={item.systemImage} size={20} weight="medium" />
      ) : null}
      {item.label ? <span>{item.label}</span> : null}
    </button>
  );
}

function renderItems(items?: BarButtonItem[]): React.ReactNode {
  if (!items?.length) return null;
  return items.map((it, i) => <BarButton key={it.id ?? i} item={it} />);
}

export const GlassNavBar = React.forwardRef<HTMLDivElement, GlassNavBarProps>(
  function GlassNavBar(
    {
      title,
      subtitle,
      titleContent,
      titleAlign = "center",
      leading,
      trailing,
      leadingItems,
      trailingItems,
      variant = "compact",
      searchText = "",
      onSearchChange,
      searchPlaceholder = "Search",
      floating = true,
      material,
      glass,
      className,
      style,
      children,
    },
    ref,
  ) {
    const liquidGlassMode = useLiquidGlassMode();
    const surface = resolveBarSurface({ glass, material, liquidGlassMode });
    const isGlass = surface.kind === "glass";

    // Glass surface classes come from the kit (shared rim/sheen/glow); the bar
    // geometry (float inset, concentric corners) from the module CSS.
    const surfaceClass = isGlass
      ? glassBarClass("sui-navbar", surface.glass)
      : "sui-material sui-material-bar";
    const surfaceStyle = isGlass ? glassBarStyle(surface.glass) : undefined;

    const showFloat = floating && isGlass;

    const cls = [
      styles.navbar,
      showFloat ? styles.navbarFloating : styles.navbarPinned,
      surfaceClass,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const titleNode = titleContent ?? (title ? (
      <span className={styles.navbarTitleText}>{title}</span>
    ) : null);

    return (
      <div
        ref={ref}
        className={cls}
        style={{ ...surfaceStyle, ...style }}
        data-variant={variant}
      >
        {/* compact row — always present */}
        <div className={styles.navbarRow}>
          <div className={styles.navbarLeading}>
            {leading ?? renderItems(leadingItems)}
          </div>
          {/* In large-title mode the centered title collapses to the left edge
              once scrolled; here we keep the compact title only for non-large. */}
          {variant !== "large" ? (
            <div className={styles.navbarTitle} data-align={titleAlign}>
              {titleNode}
            </div>
          ) : (
            <div className={styles.navbarTitle} data-align="center" aria-hidden />
          )}
          <div className={styles.navbarTrailing}>
            {trailing ?? renderItems(trailingItems)}
          </div>
        </div>

        {/* large-title row */}
        {variant === "large" && (title || subtitle) ? (
          <div className={styles.navbarLargeRow}>
            {title ? <div className={styles.navbarLargeTitle}>{title}</div> : null}
            {subtitle ? (
              <div className={styles.navbarLargeSubtitle}>{subtitle}</div>
            ) : null}
          </div>
        ) : null}

        {/* inline search row */}
        {variant === "search" ? (
          <div className={styles.searchRow}>
            <div className={styles.searchField}>
              <SymbolGlyph name="magnifyingglass" size={17} weight="semibold" />
              <input
                type="search"
                value={searchText}
                placeholder={searchPlaceholder}
                onChange={(e) => onSearchChange?.(e.currentTarget.value)}
                aria-label={searchPlaceholder}
                enterKeyHint="search"
              />
              {searchText ? (
                <button
                  type="button"
                  className={styles.barButton}
                  style={{ minWidth: 22, height: 22, padding: 0 }}
                  aria-label="Clear search"
                  onClick={() => onSearchChange?.("")}
                >
                  <SymbolGlyph name="xmark.circle.fill" size={17} />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {children}
      </div>
    );
  },
);

GlassNavBar.displayName = "GlassNavBar";
