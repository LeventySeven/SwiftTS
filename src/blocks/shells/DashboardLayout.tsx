"use client";
/**
 * DashboardLayout — an AppShell preset tuned for dashboards.
 *
 * Same frame as <AppShell/> (glass sidebar + glass top bar + scrollable
 * content) but pre-wired for the dashboard use case:
 *   • the top bar carries an inline SEARCH field (GlassNavBar `variant="search"`)
 *     plus a trailing actions cluster,
 *   • the content area lays out on a 12-column GRID (`DashGrid`) so cards/charts
 *     drop into responsive slots,
 *   • a `StatCard` helper renders the classic KPI tile (label + big value +
 *     delta) and a `DashCard` wraps any panel in the grouped inset card.
 *
 * Compose the grid yourself via `children`, or pass `stats` for an auto KPI row.
 * Everything is built from the kit + the shell blocks — nothing bespoke.
 *
 * `"use client"` (it wraps AppShell + owns the controlled search text). SSR-safe.
 */
import * as React from "react";
import { AppShell, type AppShellProps } from "./AppShell";
import { GlassNavBar, type BarButtonItem } from "./GlassNavBar";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./shells.module.css";

/* ───────────────────────── grid + card helpers ───────────────── */

export interface DashGridProps {
  /** Column count of the base grid. Default 12. */
  columns?: number;
  /** Gap (px). Default 16. */
  gap?: number;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** A responsive grid for dashboard slots (collapses to 1 col on narrow). */
export function DashGrid({
  columns = 12,
  gap = 16,
  children,
  className,
  style,
}: DashGridProps): React.ReactElement {
  return (
    <div
      className={[styles.dashGrid, className].filter(Boolean).join(" ")}
      style={{
        ["--dash-cols" as string]: String(columns),
        ["--dash-gap" as string]: `${gap}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface DashCardProps {
  /** Column span on the 12-col grid. Default 12 (full row). */
  span?: number;
  /** Row span. Default 1. */
  rowSpan?: number;
  /** Optional card title. */
  title?: string;
  /** Optional trailing accessory in the card header. */
  accessory?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** A grouped inset dashboard card occupying `span` grid columns. */
export function DashCard({
  span = 12,
  rowSpan = 1,
  title,
  accessory,
  children,
  className,
  style,
}: DashCardProps): React.ReactElement {
  return (
    <div
      className={[styles.card, className].filter(Boolean).join(" ")}
      style={{
        gridColumn: `span ${span} / span ${span}`,
        gridRow: rowSpan > 1 ? `span ${rowSpan} / span ${rowSpan}` : undefined,
        ...style,
      }}
    >
      {title || accessory ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: children ? 12 : 0,
          }}
        >
          {title ? (
            <span
              style={{
                font: "600 16px/1.2 var(--sui-font-default, -apple-system, system-ui, sans-serif)",
                color: "var(--sui-color-label, #000)",
              }}
            >
              {title}
            </span>
          ) : (
            <span />
          )}
          {accessory}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export interface StatTile {
  /** Stable key. */
  id?: string;
  /** Small uppercase metric label. */
  label: string;
  /** The big value (already formatted). */
  value: string;
  /** Delta text (e.g. "+12.4%"). */
  delta?: string;
  /** Delta direction → tint (green up / red down / neutral). */
  trend?: "up" | "down" | "flat";
  /** SF Symbol accent shown top-right. */
  systemImage?: string;
  /** Grid column span. Default 3 (4-up on a 12-col grid). */
  span?: number;
}

const TREND_COLOR: Record<NonNullable<StatTile["trend"]>, string> = {
  up: "var(--sui-color-system-green, #34c759)",
  down: "var(--sui-color-system-red, #ff3b30)",
  flat: "var(--sui-color-secondary-label, rgba(60,60,67,0.6))",
};
const TREND_ICON: Record<NonNullable<StatTile["trend"]>, string> = {
  up: "arrow.up.right",
  down: "arrow.down.right",
  flat: "minus",
};

/** A single KPI tile (label + big value + delta). */
export function StatCard({ tile }: { tile: StatTile }): React.ReactElement {
  const trend = tile.trend ?? "flat";
  return (
    <DashCard span={tile.span ?? 3}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span
          style={{
            font: "600 12px/1.3 var(--sui-font-default, -apple-system, system-ui, sans-serif)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--sui-color-secondary-label, rgba(60,60,67,0.6))",
          }}
        >
          {tile.label}
        </span>
        {tile.systemImage ? (
          <span style={{ color: "var(--sui-color-tint, #007aff)" }}>
            <SymbolGlyph name={tile.systemImage} size={18} weight="semibold" />
          </span>
        ) : null}
      </div>
      <div
        style={{
          marginTop: 8,
          font: "700 28px/1.05 var(--sui-font-default, -apple-system, system-ui, sans-serif)",
          letterSpacing: "0.01em",
          color: "var(--sui-color-label, #000)",
        }}
      >
        {tile.value}
      </div>
      {tile.delta ? (
        <div
          style={{
            marginTop: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            font: "600 13px/1 var(--sui-font-default, -apple-system, system-ui, sans-serif)",
            color: TREND_COLOR[trend],
          }}
        >
          <SymbolGlyph name={TREND_ICON[trend]} size={13} weight="bold" />
          {tile.delta}
        </div>
      ) : null}
    </DashCard>
  );
}

/* ───────────────────────── the layout ───────────────── */

export interface DashboardLayoutProps
  extends Omit<AppShellProps, "navBar" | "title" | "navBarTrailing"> {
  /** Header title (shown as the search bar's large title region). */
  title?: string;
  /** Search field text (controlled). Omit for an uncontrolled internal state. */
  searchText?: string;
  /** Search change callback. */
  onSearchChange?: (value: string) => void;
  /** Search placeholder. Default "Search". */
  searchPlaceholder?: string;
  /** Trailing navbar action buttons. */
  actions?: BarButtonItem[];
  /** Auto KPI row rendered above `children`. */
  stats?: StatTile[];
  /** Grid columns for the auto stats row / default grid. Default 12. */
  gridColumns?: number;
}

export const DashboardLayout = React.forwardRef<HTMLDivElement, DashboardLayoutProps>(
  function DashboardLayout(
    {
      title = "Dashboard",
      searchText,
      onSearchChange,
      searchPlaceholder = "Search",
      actions,
      stats,
      gridColumns = 12,
      children,
      ...shell
    },
    ref,
  ) {
    const [internalSearch, setInternalSearch] = React.useState("");
    const isControlled = searchText != null;
    const value = isControlled ? searchText : internalSearch;
    const onChange = (v: string) => {
      if (!isControlled) setInternalSearch(v);
      onSearchChange?.(v);
    };

    const defaultActions: BarButtonItem[] = actions ?? [
      { id: "notifications", systemImage: "bell", accessibilityLabel: "Notifications" },
      { id: "new", systemImage: "plus", accessibilityLabel: "New", prominent: true },
    ];

    const navBar = (
      <GlassNavBar
        variant="search"
        title={title}
        titleAlign="leading"
        searchText={value}
        onSearchChange={onChange}
        searchPlaceholder={searchPlaceholder}
        glass={shell.glass ?? true}
        floating={shell.floatingNavBar ?? true}
        leadingItems={
          shell.showSidebarToggle === false
            ? undefined
            : [
                {
                  id: "__sidebar-toggle",
                  systemImage: "sidebar.left",
                  accessibilityLabel: "Toggle sidebar",
                  // AppShell injects its own toggle when it builds the navbar;
                  // here we supply a custom navbar, so wire the toggle via the
                  // shell's collapse handler if provided.
                  onClick: () =>
                    shell.onCollapsedChange?.(!(shell.collapsed ?? false)),
                },
              ]
        }
        trailingItems={defaultActions}
      />
    );

    return (
      <AppShell ref={ref} {...shell} navBar={navBar}>
        {stats?.length ? (
          <DashGrid columns={gridColumns} style={{ marginBottom: 20 }}>
            {stats.map((s, i) => (
              <StatCard key={s.id ?? i} tile={s} />
            ))}
          </DashGrid>
        ) : null}
        {children}
      </AppShell>
    );
  },
);

DashboardLayout.displayName = "DashboardLayout";
