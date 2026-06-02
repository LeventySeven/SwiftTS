/**
 * `src/blocks` — the BLOCKS layer: polished, drop-in iOS-26 (Liquid Glass)
 * surfaces composed from the SwiftTS kit. Three families:
 *
 *   - shells/  — app-shell + chrome (AppShell, DashboardLayout, GlassNavBar,
 *                GlassSidebar, GlassTabBar, GlassToolbar)
 *   - cards/   — data-display surfaces (Card, StatTile, MetricGrid,
 *                SettingsGroup, ProfileCard, Banner, ActivityRow, …)
 *   - screens/ — full composed screen templates (SettingsScreen,
 *                DashboardScreen, ProfileScreen, SearchScreen,
 *                MediaPlayerScreen)
 *
 * Collision resolution (mirrors the main barrel's pattern): `StatTile` is
 * exported by BOTH shells (an `interface` describing a DashboardLayout stat
 * row) and cards (the standalone `StatTile` component). The cards component is
 * the canonical `StatTile`; the shells row-data type is re-exported below as
 * `DashboardStatTile`. Everything else is non-overlapping, so a plain
 * `export *` is unambiguous.
 */

export * from "./cards";
export * from "./screens";

// shells re-export, minus the colliding `StatTile` type (re-aliased below).
export {
  AppShell,
  SidebarToggleButton,
  DashboardLayout,
  DashGrid,
  DashCard,
  StatCard,
  GlassNavBar,
  GlassSidebar,
  SidebarRow,
  SidebarSection,
  GlassTabBar,
  GlassToolbar,
  ToolbarButton,
  ToolbarDivider,
} from "./shells";
export type {
  AppShellProps,
  DashboardLayoutProps,
  DashGridProps,
  DashCardProps,
  GlassNavBarProps,
  GlassNavBarVariant,
  GlassNavBarTitleAlign,
  BarButtonItem,
  GlassSidebarProps,
  SidebarItem,
  SidebarSectionData,
  SidebarHeaderInfo,
  SidebarRowProps,
  SidebarSectionProps,
  GlassTabBarProps,
  TabBarItem,
  GlassToolbarProps,
  GlassToolbarShape,
  GlassToolbarOrientation,
  ToolbarButtonProps,
  ToolbarEntry,
} from "./shells";

// Canonical: cards' `StatTile` is the component (passed through by `export *`).
// shells' `StatTile` is the DashboardLayout row-data shape → re-aliased.
export type { StatTile as DashboardStatTile } from "./shells";
