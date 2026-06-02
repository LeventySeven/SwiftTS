"use client";
/**
 * AppShell — a responsive desktop/tablet app frame.
 *
 *   ┌──────────┬────────────────────────────┐
 *   │          │  GlassNavBar (top)          │
 *   │  Glass   ├────────────────────────────┤
 *   │ Sidebar  │  scrollable content area    │
 *   │ (left)   │  (content scrolls BEHIND    │
 *   │          │   the floating glass navbar)│
 *   └──────────┴────────────────────────────┘
 *
 * A CSS-grid frame: a collapsible Liquid-Glass sidebar column + a main column
 * holding a glass top NavBar over a scrollable content region. Below the
 * responsive breakpoint (820px) the sidebar OVERLAYS the content with a dimming
 * scrim instead of pushing it.
 *
 * Fully composable:
 *   • Drive the sidebar with `sidebarSections` + `sidebarHeader` (shorthand),
 *     OR pass a whole `sidebar` node (any <GlassSidebar/> or custom panel).
 *   • Drive the navbar with `title` / `navBarProps`, OR pass a `navBar` node.
 *   • Collapse is controlled (`collapsed` + `onCollapsedChange`) or internal
 *     (`defaultCollapsed`); a leading toggle button is injected into the navbar
 *     automatically unless you supply your own navbar node.
 *
 * `"use client"` for collapse state + selection. SSR-safe (grid renders on the
 * server; the overlay/scrim only matters once interactive).
 */
import * as React from "react";
import {
  GlassSidebar,
  type SidebarSectionData,
  type SidebarHeaderInfo,
} from "./GlassSidebar";
import {
  GlassNavBar,
  type GlassNavBarProps,
  type BarButtonItem,
} from "./GlassNavBar";
import type { Glass, GlassVariant } from "../../system/effects";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./shells.module.css";

export interface AppShellProps {
  /* ── sidebar ── */
  /** Custom sidebar node (overrides the shorthand). */
  sidebar?: React.ReactNode;
  /** Shorthand sidebar header (app / profile). */
  sidebarHeader?: SidebarHeaderInfo;
  /** Shorthand sidebar sections. */
  sidebarSections?: SidebarSectionData[];
  /** Shorthand sidebar footer. */
  sidebarFooter?: React.ReactNode;
  /** Controlled selected sidebar row id. */
  selection?: string;
  /** Selection change callback. */
  onSelect?: (id: string) => void;
  /** Sidebar width in px (expanded). Default 264. */
  sidebarWidth?: number;
  /** Rail width when collapsed (px). 0 fully hides on desktop. Default 0. */
  railWidth?: number;

  /* ── navbar ── */
  /** Custom navbar node (overrides the shorthand; no auto toggle injected). */
  navBar?: React.ReactNode;
  /** Shorthand navbar title. */
  title?: string;
  /** Extra props forwarded to the built-in GlassNavBar. */
  navBarProps?: Partial<GlassNavBarProps>;
  /** Trailing navbar buttons (shorthand). */
  navBarTrailing?: BarButtonItem[];

  /* ── collapse ── */
  /** Controlled collapsed state. */
  collapsed?: boolean;
  /** Collapse change callback. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Uncontrolled initial collapsed state. Default false. */
  defaultCollapsed?: boolean;
  /** Inject the sidebar-toggle button into the built-in navbar. Default true. */
  showSidebarToggle?: boolean;

  /* ── surface ── */
  /** Glass config shared by sidebar + navbar. Default `true` (iOS-26). */
  glass?: boolean | Glass | GlassVariant;
  /** Float the navbar (inset glass). Default true. */
  floatingNavBar?: boolean;

  /** Main content. */
  children?: React.ReactNode;

  className?: string;
  style?: React.CSSProperties;
  /** Content-region className (e.g. to add a max-width wrapper). */
  contentClassName?: string;
  /** Content-region style. */
  contentStyle?: React.CSSProperties;
}

export const AppShell = React.forwardRef<HTMLDivElement, AppShellProps>(
  function AppShell(
    {
      sidebar,
      sidebarHeader,
      sidebarSections,
      sidebarFooter,
      selection,
      onSelect,
      sidebarWidth = 264,
      railWidth = 0,
      navBar,
      title,
      navBarProps,
      navBarTrailing,
      collapsed: collapsedProp,
      onCollapsedChange,
      defaultCollapsed = false,
      showSidebarToggle = true,
      glass = true,
      floatingNavBar = true,
      children,
      className,
      style,
      contentClassName,
      contentStyle,
    },
    ref,
  ) {
    const [internalCollapsed, setInternalCollapsed] =
      React.useState(defaultCollapsed);
    const isControlled = collapsedProp != null;
    const collapsed = isControlled ? collapsedProp : internalCollapsed;

    const toggleCollapsed = React.useCallback(() => {
      const next = !collapsed;
      if (!isControlled) setInternalCollapsed(next);
      onCollapsedChange?.(next);
    }, [collapsed, isControlled, onCollapsedChange]);

    const closeSidebar = React.useCallback(() => {
      if (collapsed) return;
      if (!isControlled) setInternalCollapsed(true);
      onCollapsedChange?.(true);
    }, [collapsed, isControlled, onCollapsedChange]);

    const sidebarNode =
      sidebar ?? (
        <GlassSidebar
          headerInfo={sidebarHeader}
          sections={sidebarSections}
          footer={sidebarFooter}
          selection={selection}
          onSelect={onSelect}
          glass={glass}
        />
      );

    // Built-in navbar with an auto-injected sidebar toggle (unless a custom
    // navbar node was provided).
    const toggleItem: BarButtonItem = {
      id: "__sidebar-toggle",
      systemImage: "sidebar.left",
      accessibilityLabel: collapsed ? "Show sidebar" : "Hide sidebar",
      onClick: toggleCollapsed,
    };

    const navBarNode =
      navBar ?? (
        <GlassNavBar
          title={title}
          titleAlign="leading"
          floating={floatingNavBar}
          glass={glass}
          leadingItems={showSidebarToggle ? [toggleItem] : undefined}
          trailingItems={navBarTrailing}
          {...navBarProps}
        />
      );

    const shellStyle: React.CSSProperties = {
      ["--shell-sidebar-w" as string]: `${sidebarWidth}px`,
      ["--shell-rail-w" as string]: `${railWidth}px`,
      ...style,
    };

    return (
      <div
        ref={ref}
        className={[styles.shell, className].filter(Boolean).join(" ")}
        style={shellStyle}
        data-collapsed={collapsed ? "true" : "false"}
      >
        <div className={styles.sidebarColumn}>{sidebarNode}</div>

        {/* Mobile overlay scrim: closes the sidebar when it overlays content. */}
        {!collapsed ? (
          <button
            type="button"
            className={styles.scrim}
            aria-label="Close sidebar"
            onClick={closeSidebar}
            data-shell-scrim="true"
          />
        ) : null}

        <div className={styles.mainColumn}>
          {navBarNode}
          <div
            className={[styles.content, contentClassName].filter(Boolean).join(" ")}
            style={contentStyle}
            data-bar-floating={floatingNavBar ? "true" : "false"}
          >
            {children}
          </div>
        </div>
      </div>
    );
  },
);

AppShell.displayName = "AppShell";

/**
 * SidebarToggleButton — a standalone leading toggle you can drop into a CUSTOM
 * navbar's leading slot when you supply your own `navBar` node to AppShell.
 */
export function SidebarToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      className={styles.barButton}
      aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
      onClick={onToggle}
    >
      <SymbolGlyph name="sidebar.left" size={20} weight="medium" />
    </button>
  );
}
