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
    if (sidebarWidth != null)
      (gridStyle as Record<string, string>)["--sidebar-w"] = `${sidebarWidth}px`;
    if (contentWidth != null)
      (gridStyle as Record<string, string>)["--content-w"] = `${contentWidth}px`;

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
