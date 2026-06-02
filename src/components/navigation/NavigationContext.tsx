"use client";
/**
 * NavigationContext — the wiring spine of SwiftUI Cluster C7 (Navigation).
 *
 * RE'd from `teardowns/SWIFTUI_C7_navigation.md` §1.4 (`useNavigation()`),
 * §6.3 (`useNavigationBar()`), §7.4 (toolbar slot wiring), §10.2 (the
 * `navigationDestination(for:)` registry).
 *
 * `NavigationStack` is the single owner of all three contexts:
 *   - `NavigationContext` — the push/pop path + destination registry. Consumed
 *     by `<NavigationLink>` (push) and `<NavigationDestination>` (register).
 *   - `NavigationBarContext` — lets a child screen set `{ title, displayMode,
 *     backButtonHidden, toolbarBackground, toolbarColorScheme }` on the
 *     enclosing stack's bar (the `navigationTitle` / `navigationBarTitle-
 *     DisplayMode` / `toolbar*` modifiers).
 *   - `ToolbarContext` — collects `ToolbarItem`s declared by the active screen
 *     so the stack can render them into the matching nav-bar / bottom-bar slot.
 *
 * Pure context plumbing (no DOM); "use client" because it carries mutable
 * routing state read by interactive children.
 */
import * as React from "react";

/* ===========================================================================
 * 1. Path / push-pop (useNavigation) — §1.4
 * ======================================================================== */

/** One frame on the navigation stack: a pushed value tagged by destination type.
 *  `tag` matches a registered `<NavigationDestination for={tag}>`; an inline
 *  destination-based link carries its own React node in `view`. */
export interface NavPathEntry {
  /** The destination-type tag (value-based links) — matched against the registry. */
  tag?: string;
  /** The pushed `Hashable` value (value-based links). */
  value?: unknown;
  /** An eager destination view (destination-based links). */
  view?: React.ReactNode;
  /** Title to show in the bar for this entry (resolved by the destination/screen). */
  title?: string;
}

export interface NavigationContextValue {
  /** The live stack (root is implicit at depth 0; entries are pushed screens). */
  path: NavPathEntry[];
  /** Push a value-based entry (matched by a registered destination) or a raw entry. */
  push: (entry: unknown, tag?: string) => void;
  /** Push an eager destination view (destination-based `NavigationLink`). */
  pushView: (view: React.ReactNode, title?: string) => void;
  /** Pop one level (animated). No-op at the root. */
  pop: () => void;
  /** Pop to the root (clear the whole path). */
  popToRoot: () => void;
  /** True when the path is non-empty (i.e. a back button should show). */
  canPop: boolean;
  /** Register a destination builder for a type tag (`navigationDestination(for:)`). */
  registerDestination: (tag: string, build: (value: unknown) => React.ReactNode) => void;
  /** Resolve a path entry to its rendered screen (registry lookup or inline view). */
  resolve: (entry: NavPathEntry) => React.ReactNode;
}

export const NavigationContext =
  React.createContext<NavigationContextValue | null>(null);

/** `useNavigation()` — push/pop the enclosing `NavigationStack`. Returns a
 *  no-op-safe shim when used outside a stack (matches SwiftUI's "link does
 *  nothing without a stack" behavior rather than throwing). */
export function useNavigation(): NavigationContextValue {
  const ctx = React.useContext(NavigationContext);
  if (ctx) return ctx;
  return NOOP_NAVIGATION;
}

const NOOP_NAVIGATION: NavigationContextValue = {
  path: [],
  push: () => {},
  pushView: () => {},
  pop: () => {},
  popToRoot: () => {},
  canPop: false,
  registerDestination: () => {},
  resolve: () => null,
};

/* ===========================================================================
 * 2. Nav-bar config (useNavigationBar) — §6.3 / §8
 * ======================================================================== */

export type TitleDisplayMode = "automatic" | "inline" | "large";

/** A `toolbarColorScheme(_:for:)` value. */
export type BarColorScheme = "light" | "dark";

/** A `toolbarBackground(_:for:)` value: force-visible frosted, hidden, or solid. */
export interface BarBackground {
  /** "visible" → force the frosted `.bar` even at top; "hidden" → no background. */
  visibility?: "automatic" | "visible" | "hidden";
  /** A solid CSS color/gradient (e.g. `Color.blue`) — kills the blur. */
  style?: string;
}

/** `toolbarTitleDisplayMode(_:)` — like `displayMode` but only the title's chrome. */
export type ToolbarTitleDisplayMode = "automatic" | "inline" | "inlineLarge" | "large";

/** `toolbarRole(_:)` — `.browser` widens the title area & left-aligns it (web/files apps). */
export type ToolbarRoleName = "automatic" | "navigationStack" | "browser" | "editor";

/** The mutable bar state a screen contributes to the enclosing stack. */
export interface NavBarConfig {
  title?: string;
  /** `navigationSubtitle(_:)` — a secondary line under the (inline/large) title. */
  subtitle?: string;
  /** Editable-title binding (`navigationTitle(Binding<String>)`). */
  editableTitle?: { value: string; onChange: (v: string) => void };
  displayMode?: TitleDisplayMode;
  /** `navigationBarBackButtonHidden(_:)`. */
  backButtonHidden?: boolean;
  /** `navigationBarHidden(_:)`. */
  barHidden?: boolean;
  toolbarBackground?: BarBackground;
  toolbarColorScheme?: BarColorScheme;
  /** `toolbarForegroundStyle(_:for:)` — tint of the bar's content (buttons/title). */
  toolbarForegroundStyle?: string;
  /** `toolbarTitleDisplayMode(_:)`. */
  toolbarTitleDisplayMode?: ToolbarTitleDisplayMode;
  /** `toolbarRole(_:)`. */
  toolbarRole?: ToolbarRoleName;
}

export interface NavigationBarContextValue {
  /** Merge a partial config into the active screen's bar (called from effects). */
  setBar: (config: NavBarConfig) => void;
}

export const NavigationBarContext =
  React.createContext<NavigationBarContextValue | null>(null);

/** `useNavigationBar()` — a child screen sets `{ title, displayMode, … }` on the
 *  enclosing stack's bar. Pass a stable config; it is applied in an effect. */
export function useNavigationBar(config?: NavBarConfig): NavigationBarContextValue {
  const ctx = React.useContext(NavigationBarContext);
  const setBar = ctx?.setBar;
  // Serialize the config so the effect only re-runs on a real change.
  const key = config ? serializeBar(config) : "";
  React.useEffect(() => {
    if (config && setBar) setBar(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setBar]);
  return ctx ?? NOOP_BAR;
}

const NOOP_BAR: NavigationBarContextValue = { setBar: () => {} };

function serializeBar(c: NavBarConfig): string {
  return [
    c.title ?? "",
    c.subtitle ?? "",
    c.displayMode ?? "",
    c.backButtonHidden ? "1" : "",
    c.barHidden ? "1" : "",
    c.editableTitle ? `e:${c.editableTitle.value}` : "",
    c.toolbarBackground
      ? `bg:${c.toolbarBackground.visibility ?? ""}:${c.toolbarBackground.style ?? ""}`
      : "",
    c.toolbarColorScheme ?? "",
    c.toolbarForegroundStyle ?? "",
    c.toolbarTitleDisplayMode ?? "",
    c.toolbarRole ?? "",
  ].join("|");
}

/* ===========================================================================
 * 3. Toolbar items (useToolbar) — §7.4
 * ======================================================================== */

export type ToolbarPlacement =
  | "automatic"
  | "topBarLeading"
  | "topBarTrailing"
  | "navigationBarLeading"
  | "navigationBarTrailing"
  | "principal"
  | "navigation"
  | "primaryAction"
  | "bottomBar"
  | "confirmationAction"
  | "cancellationAction"
  | "destructiveAction"
  | "keyboard"
  | "title"
  | "largeTitle"
  | "subtitle";

/** One placed toolbar item. */
export interface ToolbarEntry {
  placement?: ToolbarPlacement;
  content: React.ReactNode;
}

export interface ToolbarContextValue {
  /** Replace the active screen's toolbar items. */
  setToolbar: (items: ToolbarEntry[]) => void;
}

export const ToolbarContext =
  React.createContext<ToolbarContextValue | null>(null);

/** `useToolbar(items)` — a screen contributes its `ToolbarItem`s to the stack. */
export function useToolbar(items?: ToolbarEntry[]): ToolbarContextValue {
  const ctx = React.useContext(ToolbarContext);
  const setToolbar = ctx?.setToolbar;
  const key = items ? items.map((i) => i.placement ?? "automatic").join(",") + ":" + items.length : "";
  React.useEffect(() => {
    if (setToolbar) setToolbar(items ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setToolbar]);
  return ctx ?? NOOP_TOOLBAR;
}

const NOOP_TOOLBAR: ToolbarContextValue = { setToolbar: () => {} };

/** Normalize the deprecated placement aliases to the canonical iOS slots. */
export function canonicalPlacement(p: ToolbarPlacement | undefined): "leading" | "trailing" | "principal" | "bottomBar" {
  switch (p) {
    case "topBarLeading":
    case "navigationBarLeading":
    case "navigation":
    case "cancellationAction":
      return "leading";
    case "principal":
    case "title":
    case "largeTitle":
    case "subtitle":
      return "principal";
    case "bottomBar":
    case "keyboard":
      return "bottomBar";
    case "topBarTrailing":
    case "navigationBarTrailing":
    case "primaryAction":
    case "confirmationAction":
    case "destructiveAction":
    case "automatic":
    default:
      return "trailing";
  }
}
