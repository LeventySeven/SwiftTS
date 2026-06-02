/**
 * shells — app-shell + chrome BLOCKS.
 *
 * The "everything-layer": polished iOS-26 Liquid-Glass app screens composed from
 * the SwiftTS kit. Drop a whole frame in:
 *
 *   <AppShell sidebarHeader={…} sidebarSections={…} title="Home">…</AppShell>
 *   <DashboardLayout title="Overview" stats={…}>…</DashboardLayout>
 *
 * Standalone chrome templates:
 *   <GlassNavBar variant="large" … />
 *   <GlassSidebar headerInfo={…} sections={…} footer={…} />
 *   <GlassTabBar items={…} selection={id} onSelect={…} />
 *   <GlassToolbar items={…} />
 */

/* ── composite frames ── */
export { AppShell, SidebarToggleButton } from "./AppShell";
export type { AppShellProps } from "./AppShell";

export {
  DashboardLayout,
  DashGrid,
  DashCard,
  StatCard,
} from "./DashboardLayout";
export type {
  DashboardLayoutProps,
  DashGridProps,
  DashCardProps,
  StatTile,
} from "./DashboardLayout";

/* ── standalone chrome ── */
export { GlassNavBar } from "./GlassNavBar";
export type {
  GlassNavBarProps,
  GlassNavBarVariant,
  GlassNavBarTitleAlign,
  BarButtonItem,
} from "./GlassNavBar";

export {
  GlassSidebar,
  SidebarRow,
  SidebarSection,
} from "./GlassSidebar";
export type {
  GlassSidebarProps,
  SidebarItem,
  SidebarSectionData,
  SidebarHeaderInfo,
  SidebarRowProps,
  SidebarSectionProps,
} from "./GlassSidebar";

export { GlassTabBar } from "./GlassTabBar";
export type { GlassTabBarProps, TabBarItem } from "./GlassTabBar";

export {
  GlassToolbar,
  ToolbarButton,
  ToolbarDivider,
} from "./GlassToolbar";
export type {
  GlassToolbarProps,
  GlassToolbarShape,
  GlassToolbarOrientation,
  ToolbarButtonProps,
  ToolbarEntry,
} from "./GlassToolbar";
