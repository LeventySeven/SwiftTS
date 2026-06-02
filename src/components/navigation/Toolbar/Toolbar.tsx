"use client";
/**
 * Toolbar helpers — `Toolbar`, `ToolbarItem`, `ToolbarItemGroup` and the nav
 * chrome modifiers (`navigationTitle`, `navigationBarTitleDisplayMode`,
 * `navigationBarBackButtonHidden`, `toolbarBackground`, `toolbarColorScheme`).
 *
 * RE'd from `teardowns/SWIFTUI_C7_navigation.md` §6/§7/§8/§11. In SwiftUI these
 * are view modifiers; on the web they are declarative helper components that a
 * screen drops in to contribute its bar config / toolbar items to the enclosing
 * `NavigationStack` via `useNavigationBar()` / `useToolbar()`.
 *
 * Placement constants mirror `ToolbarItemPlacement` (§7.2): the four classic iOS
 * slots — `topBarLeading`/`navigationBarLeading` (leading), `topBarTrailing`/
 * `navigationBarTrailing`/`primaryAction`/`confirmationAction` (trailing),
 * `principal` (center, replaces title), `bottomBar` — plus the semantic aliases,
 * all normalized by `canonicalPlacement` in NavigationContext.
 *
 * Each item renders through `.sui-toolbar-btn` (44pt hit target, accent tint,
 * 0.3 pressed) when given a `title`/`systemImage`; arbitrary `content`/children
 * pass through untouched.
 */
import * as React from "react";
import { Image } from "../../Image";
import {
  useToolbar,
  useNavigationBar,
  type ToolbarEntry,
  type ToolbarPlacement,
  type TitleDisplayMode,
  type BarBackground,
  type BarColorScheme,
  type ToolbarTitleDisplayMode,
  type ToolbarRoleName,
} from "../NavigationContext";
import { useLiquidGlassMode } from "../liquidGlassNav";

export type {
  ToolbarPlacement,
  TitleDisplayMode,
  ToolbarTitleDisplayMode,
  ToolbarRoleName,
} from "../NavigationContext";

/* ===========================================================================
 * ToolbarItem — one placed bar control (§7)
 * ======================================================================== */

export interface ToolbarItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title" | "content"> {
  /** Where the item renders. Default `.automatic` (→ trailing). */
  placement?: ToolbarPlacement;
  /** A text title → an accent-tinted bar button (semibold for confirmationAction). */
  title?: string;
  /** An SF Symbol → an icon bar button. */
  systemImage?: string;
  /** Arbitrary content (a custom view: a SegmentedControl in `.principal`, etc.). */
  content?: React.ReactNode;
  /** Children = the item's view (alternative to `content`). */
  children?: React.ReactNode;
  /**
   * iOS-26 Liquid Glass item background. When true the built bar button renders
   * inside a Liquid-Glass capsule (a `glassEffect`-style chip). Defaults to the
   * app design mode at the enclosing `<Toolbar>`; set `false` to force a plain
   * (non-glass) tappable label even in iOS-26.
   */
  glass?: boolean;
}

/**
 * `<ToolbarItem placement title onClick>` — declared inside a screen; collected
 * by the nearest `<Toolbar>` (or used directly with `useToolbar`). When rendered
 * standalone it self-registers a single item; the common path is to nest several
 * `ToolbarItem`s inside one `<Toolbar>`.
 */
export function ToolbarItem(props: ToolbarItemProps): React.ReactElement | null {
  // As a leaf it self-registers; <Toolbar> reads its props directly instead.
  const glassDefault = useLiquidGlassMode();
  const entry = React.useMemo(
    () => toolbarItemToEntry(props, glassDefault),
    [props, glassDefault],
  );
  useToolbar([entry]);
  return null;
}
ToolbarItem.displayName = "ToolbarItem";
(ToolbarItem as unknown as { __suiToolbarItem: boolean }).__suiToolbarItem = true;

/**
 * Render a `ToolbarItem`'s view: explicit content/children, else a built button.
 * `glassDefault` is the enclosing `<Toolbar>`'s resolved design mode; an item's
 * own `glass` prop overrides it. When glass is on, the built button wears a
 * Liquid-Glass capsule chip (`data-glass="true"` → the `.sui-toolbar-btn` glass
 * rule in navigation.global.css supplies the backdrop blur + specular rim).
 */
export function renderToolbarItem(
  props: ToolbarItemProps,
  glassDefault = false,
): React.ReactNode {
  const { placement, title, systemImage, content, children, glass, ...rest } = props;
  if (content !== undefined) return content;
  if (children !== undefined && (title === undefined && systemImage === undefined))
    return children;
  const role = roleFor(placement);
  const isGlass = glass ?? glassDefault;
  return (
    <button
      type="button"
      className="sui-toolbar-btn"
      data-role={role}
      data-glass={isGlass ? "true" : undefined}
      {...rest}
    >
      {systemImage ? <Image systemName={systemImage} aria-hidden /> : null}
      {title ? <span>{title}</span> : null}
      {children}
    </button>
  );
}

function toolbarItemToEntry(props: ToolbarItemProps, glassDefault = false): ToolbarEntry {
  return { placement: props.placement, content: renderToolbarItem(props, glassDefault) };
}

function roleFor(p: ToolbarPlacement | undefined): string | undefined {
  if (p === "confirmationAction" || p === "cancellationAction" || p === "destructiveAction")
    return p;
  return undefined;
}

/* ===========================================================================
 * ToolbarItemGroup — several items under one placement (§7.1)
 * ======================================================================== */

export interface ToolbarItemGroupProps {
  placement?: ToolbarPlacement;
  children: React.ReactNode;
}

export function ToolbarItemGroup({ placement, children }: ToolbarItemGroupProps): React.ReactElement | null {
  const glassDefault = useLiquidGlassMode();
  const items: ToolbarEntry[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const p = { ...(child.props as ToolbarItemProps) };
      if (p.placement === undefined) p.placement = placement;
      items.push(toolbarItemToEntry(p, glassDefault));
    }
  });
  useToolbar(items);
  return null;
}
ToolbarItemGroup.displayName = "ToolbarItemGroup";

/* ===========================================================================
 * Toolbar — collects child ToolbarItems and contributes them to the stack (§7)
 * ======================================================================== */

export interface ToolbarProps {
  /** A list of `<ToolbarItem>`/`<ToolbarItemGroup>` children. */
  children: React.ReactNode;
  /**
   * iOS-26 Liquid Glass default for the bar's built buttons. Defaults to the app
   * design mode; set `false` to render plain (non-glass) toolbar items even in
   * iOS-26 (per-item `glass` still wins over this).
   */
  glass?: boolean;
}

/**
 * `<Toolbar>` — the `.toolbar { … }` modifier. Reads its `ToolbarItem`/
 * `ToolbarItemGroup` children's props (without rendering them itself) and
 * registers the flattened item list with the enclosing `NavigationStack`. In
 * iOS-26 design mode the built buttons default to Liquid-Glass chips.
 */
export function Toolbar({ children, glass }: ToolbarProps): React.ReactElement | null {
  const glassMode = useLiquidGlassMode();
  const glassDefault = glass ?? glassMode;
  const items = React.useMemo(() => {
    const out: ToolbarEntry[] = [];
    const walk = (nodes: React.ReactNode, inheritedPlacement?: ToolbarPlacement) => {
      React.Children.forEach(nodes, (child) => {
        if (!React.isValidElement(child)) return;
        const type = child.type as unknown as {
          displayName?: string;
          __suiToolbarItem?: boolean;
        };
        if (type?.displayName === "ToolbarItemGroup") {
          const gp = child.props as ToolbarItemGroupProps;
          walk(gp.children, gp.placement);
          return;
        }
        const p = { ...(child.props as ToolbarItemProps) };
        if (p.placement === undefined && inheritedPlacement)
          p.placement = inheritedPlacement;
        out.push(toolbarItemToEntry(p, glassDefault));
      });
    };
    walk(children);
    return out;
  }, [children, glassDefault]);

  useToolbar(items);
  return null;
}
Toolbar.displayName = "Toolbar";

/* ===========================================================================
 * Nav-bar chrome modifiers (§6 / §8 / §11)
 * ======================================================================== */

export interface NavigationBarConfigProps {
  /** `navigationTitle(_:)` — static title, or `{value,onChange}` for the editable form. */
  navigationTitle?: string | { value: string; onChange: (v: string) => void };
  /** `navigationSubtitle(_:)` — a secondary line under the title. */
  navigationSubtitle?: string;
  /** `navigationBarTitleDisplayMode(_:)`. */
  navigationBarTitleDisplayMode?: TitleDisplayMode;
  /** `navigationBarBackButtonHidden(_:)`. */
  navigationBarBackButtonHidden?: boolean;
  /** `navigationBarHidden(_:)` — hide the whole bar. */
  navigationBarHidden?: boolean;
  /**
   * `navigationDocument(_:)` — associates a file/URL with the screen for the
   * proxy-icon / share affordance. There is no web analogue for the macOS proxy
   * icon, so this is accepted and intentionally inert (no-op) for API parity.
   */
  navigationDocument?: string | { url: string };
  /** `toolbarBackground(_:for:)` — force-visible/hidden or a solid style. */
  toolbarBackground?: BarBackground;
  /** `toolbarBackgroundVisibility(_:for:)` — visibility-only form of `toolbarBackground`. */
  toolbarBackgroundVisibility?: "automatic" | "visible" | "hidden";
  /** `toolbarColorScheme(_:for:)` — force light/dark bar content. */
  toolbarColorScheme?: BarColorScheme;
  /** `toolbarForegroundStyle(_:for:)` — tint of bar content (CSS color/token). */
  toolbarForegroundStyle?: string;
  /** `toolbarTitleDisplayMode(_:)`. */
  toolbarTitleDisplayMode?: ToolbarTitleDisplayMode;
  /** `toolbarRole(_:)`. */
  toolbarRole?: ToolbarRoleName;
}

/**
 * `<NavigationBarConfig …>` — applies the title/display-mode/back-button/
 * background/color-scheme modifiers to the enclosing stack's bar. Drop it at the
 * top of a screen's view tree (it renders nothing). This is the single
 * declarative surface for all of §6/§8/§11.
 */
/** Merge a `toolbarBackground` object with the visibility-only convenience form. */
function resolveToolbarBackground(
  bg: BarBackground | undefined,
  visibility: "automatic" | "visible" | "hidden" | undefined,
): BarBackground | undefined {
  if (!bg && !visibility) return undefined;
  return { ...(bg ?? {}), ...(visibility ? { visibility } : {}) };
}

/** Build the `NavBarConfig` from the declarative props (shared by component + hook). */
function buildBarConfig(props: NavigationBarConfigProps) {
  // navigationDocument has no web rendering — reference it so it's a real accepted prop.
  void props.navigationDocument;
  return {
    title: typeof props.navigationTitle === "string" ? props.navigationTitle : undefined,
    subtitle: props.navigationSubtitle,
    editableTitle:
      props.navigationTitle && typeof props.navigationTitle === "object"
        ? props.navigationTitle
        : undefined,
    displayMode: props.navigationBarTitleDisplayMode,
    backButtonHidden: props.navigationBarBackButtonHidden,
    barHidden: props.navigationBarHidden,
    toolbarBackground: resolveToolbarBackground(
      props.toolbarBackground,
      props.toolbarBackgroundVisibility,
    ),
    toolbarColorScheme: props.toolbarColorScheme,
    toolbarForegroundStyle: props.toolbarForegroundStyle,
    toolbarTitleDisplayMode: props.toolbarTitleDisplayMode,
    toolbarRole: props.toolbarRole,
  };
}

export function NavigationBarConfig(
  props: NavigationBarConfigProps,
): React.ReactElement | null {
  const {
    navigationTitle,
    navigationSubtitle,
    navigationBarTitleDisplayMode,
    navigationBarBackButtonHidden,
    navigationBarHidden,
    navigationDocument,
    toolbarBackground,
    toolbarBackgroundVisibility,
    toolbarColorScheme,
    toolbarForegroundStyle,
    toolbarTitleDisplayMode,
    toolbarRole,
  } = props;
  const config = React.useMemo(
    () => buildBarConfig(props),
    [
      navigationTitle,
      navigationSubtitle,
      navigationBarTitleDisplayMode,
      navigationBarBackButtonHidden,
      navigationBarHidden,
      navigationDocument,
      toolbarBackground,
      toolbarBackgroundVisibility,
      toolbarColorScheme,
      toolbarForegroundStyle,
      toolbarTitleDisplayMode,
      toolbarRole,
    ],
  );
  useNavigationBar(config);
  return null;
}
NavigationBarConfig.displayName = "NavigationBarConfig";

/** Hook form: `useNavigationBarModifiers({ navigationTitle, … })` for prop-style use. */
export function useNavigationBarModifiers(props: NavigationBarConfigProps): void {
  useNavigationBar(buildBarConfig(props));
}

/** A flexible spacer for `.bottomBar` layouts (`Spacer()` between bar items). */
export function ToolbarSpacer(): React.ReactElement {
  return <span className="sui-spacer" aria-hidden />;
}
ToolbarSpacer.displayName = "ToolbarSpacer";
