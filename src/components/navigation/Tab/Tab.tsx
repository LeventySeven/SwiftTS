/**
 * `Tab` (iOS 18+) — a value descriptor for one tab in a modern `TabView`.
 *
 * RE'd from `teardowns/SWIFTUI_C7_navigation.md` §5. A `Tab` does not render
 * itself: it bundles the tab's `value` (selection key), `label` (title +
 * SF-Symbol / image), optional `role` (`.search`), optional `badge`, and its
 * `content` (the screen). `<TabView>` maps over its `<Tab>` children and reads
 * these props to build both the bottom-bar item and the page (§5.4) — so this
 * component is intentionally inert (returns null) and ships no CSS of its own.
 *
 * Purely presentational descriptor — no client directive.
 */
import * as React from "react";

export type TabRole = "search";

export interface TabProps {
  /** Tab title (rendered under the icon). */
  title?: string;
  /** SF Symbol name → mapped to an inline icon by `<TabView>`. */
  systemImage?: string;
  /** Custom image asset name (alternative to `systemImage`). */
  image?: string;
  /** Selection key — set on the `TabView` selection when this item is chosen. */
  value: unknown;
  /** `TabRole` — `.search` gives the standardized search-tab treatment. */
  role?: TabRole;
  /** Count/text badge → the red pill (§4.4). */
  badge?: number | string;
  /** The tab's content screen. */
  children?: React.ReactNode;
  /** Fully custom label (overrides `title`/`systemImage`). */
  label?: React.ReactNode;
}

/** Inert descriptor — `<TabView>` reads its props; it renders nothing itself. */
export function Tab(_props: TabProps): React.ReactElement | null {
  return null;
}

Tab.displayName = "Tab";

/** The marker `<TabView>` uses to recognize `<Tab>` children. */
(Tab as unknown as { __suiTab: boolean }).__suiTab = true;
