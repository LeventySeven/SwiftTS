"use client";
/**
 * `NavigationSplitView` — SwiftUI's 2/3-column master-detail container.
 *
 * RE'd from `teardowns/SWIFTUI_C7_navigation.md` §2. Mirrors the four column
 * shapes ({3-col, 2-col} × {uncontrolled, controlled visibility}): omitting the
 * `content` slot ⇒ 2-column (`Content == EmptyView`). `columnVisibility` maps to
 * `data-visibility` (`all` | `doubleColumn` | `detailOnly` | `automatic`), which
 * the grid in navigation.global.css collapses by zeroing column tracks (§2.4).
 *
 * Sidebar ≈ 320pt grouped background; content ≈ 320pt; detail flexes. 0.5px
 * separators between columns. Selected sidebar rows get the accent-tinted
 * rounded highlight (`.sui-row[aria-selected]`) via the CSS, NOT a push — the
 * split view does not own selection; you wire it via bindings (§2.3). Under
 * compact width (≤700px) it collapses to a single column keyed by
 * `preferredCompactColumn`.
 */
import * as React from "react";
import { View, type ViewProps } from "../../View";
import type { NavigationSplitViewStyleName } from "../../../system/styles";
import { type Glass, type GlassVariant } from "../../../system/effects";
import {
  useLiquidGlassMode,
  resolveBarSurface,
  glassBarClass,
  glassBarStyle,
} from "../liquidGlassNav";
import "../navigation.global.css";

export type NavigationSplitViewVisibility =
  | "all"
  | "doubleColumn"
  | "detailOnly"
  | "automatic";

export type NavigationSplitViewColumn = "sidebar" | "content" | "detail";

/**
 * `navigationSplitViewColumnWidth(_:)` value: a fixed px width, or the
 * `(min:ideal:max:)` form. `min`/`max` are optional; `ideal` is required in the
 * three-arg SwiftUI overload.
 */
export type ColumnWidth =
  | number
  | { min?: number; ideal: number; max?: number };

/** Resolve a `ColumnWidth` to a CSS grid track string. */
function columnTrack(w: ColumnWidth | undefined): string | undefined {
  if (w == null) return undefined;
  if (typeof w === "number") return `${w}px`;
  const min = w.min != null ? `${w.min}px` : "min-content";
  const max = w.max != null ? `${w.max}px` : "1fr";
  // ideal seeds the preferred size via clamp() inside the minmax() floor/ceiling.
  return `minmax(${min}, clamp(${min}, ${w.ideal}px, ${max}))`;
}

export interface NavigationSplitViewProps extends Omit<ViewProps, "as" | "content"> {
  /** The sidebar (master) column. */
  sidebar: React.ReactNode;
  /** The middle content column. Omit ⇒ 2-column (Content == EmptyView). */
  content?: React.ReactNode;
  /** The detail column. */
  detail: React.ReactNode;
  /** Controlled column visibility (mirrors the `columnVisibility:` binding inits). */
  columnVisibility?: NavigationSplitViewVisibility;
  /** Fired when the sidebar toggle changes visibility. */
  onColumnVisibilityChange?: (v: NavigationSplitViewVisibility) => void;
  /** Which column is the visible root when collapsed to compact width (iOS17+). */
  preferredCompactColumn?: NavigationSplitViewColumn;
  /** `.navigationSplitViewStyle(.balanced | .prominentDetail)`. */
  splitStyle?: NavigationSplitViewStyleName;
  /** Sidebar width override (px). Default 320. */
  sidebarWidth?: number;
  /** Content width override (px). Default 320. */
  contentWidth?: number;
  /**
   * `navigationSplitViewColumnWidth(_:)` / `(min:ideal:max:)` per column. In
   * SwiftUI this modifier is applied INSIDE each column's view; on the web the
   * split-view container owns the grid tracks, so we surface the same control as
   * a per-column descriptor here. A number sets a fixed track; the `{min,ideal,
   * max}` form maps to a `minmax()`/`clamp()` track that resizes within bounds.
   * `sidebarWidth`/`contentWidth` remain as fixed-width shorthands.
   */
  sidebarColumnWidth?: ColumnWidth;
  contentColumnWidth?: ColumnWidth;
  detailColumnWidth?: ColumnWidth;
  /**
   * iOS-26 Liquid Glass sidebar. When the app design mode is iOS-26 the sidebar
   * panel renders as a translucent Liquid-Glass surface (specular rim + sheen)
   * over the page rather than the opaque grouped-background. Pass `glass={false}`
   * (or `material`) for the classic opaque sidebar; pass a `Glass` value/variant
   * to configure the surface (e.g. `.clear` for a more transparent panel).
   */
  glass?: boolean | Glass | GlassVariant;
  /** Opt out to the classic (non-glass) opaque sidebar background. */
  material?: boolean;
}

export const NavigationSplitView = React.forwardRef<HTMLDivElement, NavigationSplitViewProps>(
  function NavigationSplitView(
    {
      sidebar,
      content,
      detail,
      columnVisibility = "automatic",
      onColumnVisibilityChange,
      preferredCompactColumn = "detail",
      splitStyle,
      sidebarWidth,
      contentWidth,
      sidebarColumnWidth,
      contentColumnWidth,
      detailColumnWidth,
      glass,
      material,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    const twoColumn = content === undefined;
    // `.onColumnVisibilityChange` is part of the controlled contract even when the
    // host doesn't drive a toggle yet; reference it so the binding stays wired.
    void onColumnVisibilityChange;

    const liquidGlassMode = useLiquidGlassMode();
    const surface = resolveBarSurface({ glass, material, liquidGlassMode });
    const useGlass = surface.kind === "glass";

    const gridStyle: React.CSSProperties = { ...style };
    // Fixed-width shorthands seed the sidebar/content track vars.
    if (sidebarWidth != null)
      (gridStyle as Record<string, string>)["--sidebar-w"] = `${sidebarWidth}px`;
    if (contentWidth != null)
      (gridStyle as Record<string, string>)["--content-w"] = `${contentWidth}px`;
    // navigationSplitViewColumnWidth(_:) — the richer per-column track. A plain
    // number on a column overrides the *-w shorthand; the {min,ideal,max} form
    // produces a resizable minmax()/clamp() track read by navigation.global.css.
    const sidebarTrack = columnTrack(sidebarColumnWidth);
    const contentTrack = columnTrack(contentColumnWidth);
    const detailTrack = columnTrack(detailColumnWidth);
    if (sidebarTrack)
      (gridStyle as Record<string, string>)["--sidebar-track"] = sidebarTrack;
    if (contentTrack)
      (gridStyle as Record<string, string>)["--content-track"] = contentTrack;
    if (detailTrack)
      (gridStyle as Record<string, string>)["--detail-track"] = detailTrack;

    const sidebarClass = useGlass
      ? glassBarClass("sui-split-sidebar", surface.glass)
      : "sui-split-sidebar";

    return (
      <View
        ref={ref}
        className={["sui-splitview", className].filter(Boolean).join(" ")}
        data-visibility={columnVisibility}
        data-columns={twoColumn ? "2" : "3"}
        data-compact-column={preferredCompactColumn}
        data-split-style={splitStyle}
        data-sidebar-glass={useGlass ? "true" : undefined}
        style={gridStyle}
        {...rest}
      >
        <aside className={sidebarClass} style={useGlass ? glassBarStyle(surface.glass) : undefined}>
          {sidebar}
        </aside>
        {!twoColumn && <section className="sui-split-content">{content}</section>}
        <main className="sui-split-detail">{detail}</main>
      </View>
    );
  },
);

NavigationSplitView.displayName = "NavigationSplitView";
