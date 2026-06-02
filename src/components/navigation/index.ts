/**
 * Navigation cluster barrel — SwiftUI Cluster C7.
 * RE'd from `teardowns/SWIFTUI_C7_navigation.md`.
 *
 * Containers: NavigationStack, NavigationSplitView, TabView.
 * Links/registration: NavigationLink, NavigationDestination.
 * Descriptors: Tab.
 * Chrome modifiers: Toolbar, ToolbarItem, ToolbarItemGroup, ToolbarSpacer,
 *   NavigationBarConfig (navigationTitle / navigationBarTitleDisplayMode /
 *   navigationBarBackButtonHidden / navigationBarHidden / toolbarBackground /
 *   toolbarColorScheme).
 * Context/hooks: useNavigation, useNavigationBar, useToolbar,
 *   useNavigationBarModifiers + the placement/visibility vocabulary types.
 */
export * from "./NavigationStack";
export * from "./NavigationLink";
export * from "./NavigationDestination";
export * from "./NavigationSplitView";
export * from "./TabView";
export * from "./Tab";
export * from "./Toolbar";
export {
  useNavigation,
  useNavigationBar,
  useToolbar,
  canonicalPlacement,
} from "./NavigationContext";
export type {
  NavPathEntry,
  NavigationContextValue,
  NavBarConfig,
  TitleDisplayMode,
  BarColorScheme,
  BarBackground,
  ToolbarPlacement,
  ToolbarEntry,
} from "./NavigationContext";

/* Liquid Glass (iOS-26) navigation helpers — the design-mode resolver, the
 * floating-bar class/style builders, and the scroll-edge / tab-minimize
 * resolvers. The vocab TYPES (`ScrollEdgeEffectStyle`, `TabBarMinimizeBehavior`)
 * are NOT re-exported here: they are owned by `system/effects`/`system/modifiers`
 * and already reach the public barrel via those — re-exporting them here would
 * make `src/index.ts`'s `export *` ambiguous (TS2308). */
export {
  isLiquidGlassMode,
  useLiquidGlassMode,
  resolveBarSurface,
  glassBarClass,
  glassBarStyle,
  resolveScrollEdge,
  resolveMinimizeBehavior,
  shouldMinimize,
} from "./liquidGlassNav";
