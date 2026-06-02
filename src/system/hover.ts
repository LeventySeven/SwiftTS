"use client";
/* =============================================================================
 * hover.ts — SwiftUI's iPadOS pointer hover-effect group + default-effect APIs,
 * ported to React. The single-element `useHoverEffect` already lives in
 * geometry.ts (it returns spreadable pointer props); THIS module adds the pieces
 * geometry.ts doesn't cover:
 *
 *   - a CSS-class-driven `useHoverEffectKind(kind)` (positional-kind ergonomics,
 *     `.hoverEffect(.lift)` reads as `useHoverEffectKind("lift")`) that returns a
 *     className + the [data-sui-hovered] flag, so the effect can be shared by a
 *     GROUP via CSS rather than re-running per element.
 *   - `HoverEffectGroup` + `useHoverEffectGroup` — the SwiftUI grouping where
 *     hovering ONE member activates the effect on EVERY following member
 *     (SwiftUI: `.hoverEffect(_:in:)` + `HoverEffectGroup.Behavior`).
 *   - `defaultHoverEffect` / `DefaultHoverEffectProvider` / `useDefaultHoverEffect`
 *     — the `.defaultHoverEffect(_:)` environment default that members inherit
 *     when they don't name a kind.
 *
 * SwiftUI authoritative API (arm64e-apple-macos.swiftinterface):
 *   View.hoverEffect(_ effect: HoverEffect = .automatic, isEnabled: = true)        (SwiftUI:9241)
 *   View.hoverEffect(_ effect: some CustomHoverEffect, in group: HoverEffectGroup?) (SwiftUI:9224)
 *   View.defaultHoverEffect(_ effect: HoverEffect?)                                 (SwiftUI:9243)
 *   struct HoverEffect { automatic, highlight, lift }                              (SwiftUI:9260)
 *   struct HoverEffectGroup { Behavior { activatesGroup, followsGroup,             (SwiftUI:20478)
 *     ignoresGroup, preservesGroup }; init(_ namespace, behavior:) }
 *
 * The single-element hook and the `HoverEffectStyle` union are RE-EXPORTED from
 * geometry.ts so callers can `import { useHoverEffect, HoverEffectStyle } from
 * "system/hover"` next to the group APIs (the index barrel exports geometry's
 * copies — these re-exports are local convenience, no duplicate top-level export).
 *
 * SSR-safe: hover state lives in React state, set from pointer handlers (client
 * only); the className strings carry no DOM access. "use client".
 * ========================================================================== */
import * as React from "react";
import type { HoverEffectStyle } from "./geometry";

// Side-effect import: registers the .sui-hover-effect* classes that
// useHoverEffectKind / the group machinery hand out (mirrors geometry's inline
// styles, but as shareable CSS for grouping).
import "./hover.global.css";

/* NOTE: the single-element `useHoverEffect` / `useHoverEffectDisabled` and the
 * `HoverEffectStyle` / `HoverEffectProps` / `UseHoverEffectOptions` types are the
 * canonical exports of geometry.ts (already in the barrel). We import them here
 * for internal use and to derive aliases, but DO NOT re-export them — re-exporting
 * the same identifiers from a second `export *` module would create a barrel
 * ambiguity. Import them from "@sui" (geometry's copy) alongside these group APIs. */

/* =============================================================================
 * 1. HoverEffect kind — the named effects (mirrors geometry's HoverEffectStyle)
 * ========================================================================== */

/** `SwiftUI.HoverEffect` named effects (SwiftUI:9260). Alias of geometry's `HoverEffectStyle`. */
export type HoverEffectKind = HoverEffectStyle;

/** The CSS class for a given hover-effect kind (from hover.global.css). */
export function hoverEffectClass(kind: HoverEffectKind): string {
  return `sui-hover-effect sui-hover-effect-${kind}`;
}

/* =============================================================================
 * 2. defaultHoverEffect — `.defaultHoverEffect(_:)` (SwiftUI:9243)
 *
 * An environment default: members that don't name a kind inherit it. A `null`
 * default means "no effect" (the explicit `.defaultHoverEffect(nil)` clear).
 * ========================================================================== */

const DefaultHoverEffectContext = React.createContext<HoverEffectKind | null>("automatic");

/** `.defaultHoverEffect(_:)` value form — the default kind constant. */
export const defaultHoverEffect: HoverEffectKind = "automatic";

export interface DefaultHoverEffectProviderProps {
  /** The inherited effect kind, or `null` to clear it (`.defaultHoverEffect(nil)`). */
  effect: HoverEffectKind | null;
  children?: React.ReactNode;
}

/**
 * `.defaultHoverEffect(_:)`. Sets the hover-effect kind that descendant hover
 * hooks inherit when they don't specify one. Pass `null` to clear it.
 */
export function DefaultHoverEffectProvider({
  effect,
  children,
}: DefaultHoverEffectProviderProps): React.ReactElement {
  return React.createElement(DefaultHoverEffectContext.Provider, { value: effect }, children);
}

/** Read the inherited default hover-effect kind (`null` when cleared). */
export function useDefaultHoverEffect(): HoverEffectKind | null {
  return React.useContext(DefaultHoverEffectContext);
}

/* =============================================================================
 * 3. HoverEffectGroup — shared hover state across members (SwiftUI:20478)
 * ========================================================================== */

/** `HoverEffectGroup.Behavior` (SwiftUI:20480) — how a member relates to its group. */
export type HoverEffectGroupBehavior =
  | "activatesGroup" // hovering this member activates the whole group
  | "followsGroup" // this member lights up when the group is active
  | "ignoresGroup" // this member is unaffected by the group
  | "preservesGroup";

/** The live state a `HoverEffectGroup` shares with its members. */
interface HoverGroupState {
  /** True while ANY `activatesGroup` member is hovered. */
  active: boolean;
  /** A member reports its hover on/off; the group recomputes `active`. */
  setMemberHovered(id: number, hovered: boolean): void;
  /** Register a member, returns its id + a deregister. */
  join(): { id: number; leave(): void };
}

const HoverGroupContext = React.createContext<HoverGroupState | null>(null);

export interface HoverEffectGroupProps {
  /**
   * The DOM element to mark as the group container (so the CSS `.sui-hover-effect-group`
   * rules can scope to it). When omitted, a `<div style={{ display: "contents" }}>`
   * wrapper is used so layout is untouched.
   */
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  children?: React.ReactNode;
}

/**
 * `HoverEffectGroup`. Wraps a set of members; hovering any `activatesGroup` member
 * activates the group, lighting up every `followsGroup` member. Mirrors SwiftUI's
 * `.hoverEffect(_:in:)` grouping (e.g. a toolbar where hovering one item subtly
 * cues the row). Renders a container marked `.sui-hover-effect-group` and toggles
 * `[data-sui-group-active]` on it so the CSS in hover.global.css drives followers.
 */
export function HoverEffectGroup({
  as = "div",
  className,
  children,
}: HoverEffectGroupProps): React.ReactElement {
  const [active, setActive] = React.useState(false);
  const hoveredRef = React.useRef(new Set<number>());
  const idRef = React.useRef(0);

  const state = React.useMemo<HoverGroupState>(
    () => ({
      active: false, // overwritten below via getter pattern; see recompute
      setMemberHovered(id: number, hovered: boolean) {
        const set = hoveredRef.current;
        if (hovered) set.add(id);
        else set.delete(id);
        setActive(set.size > 0);
      },
      join() {
        const id = ++idRef.current;
        return {
          id,
          leave() {
            hoveredRef.current.delete(id);
            setActive(hoveredRef.current.size > 0);
          },
        };
      },
    }),
    [],
  );

  const cls = className
    ? `sui-hover-effect-group ${className}`
    : "sui-hover-effect-group";

  return React.createElement(
    HoverGroupContext.Provider,
    { value: state },
    React.createElement(
      as as string,
      {
        className: cls,
        "data-sui-group-active": active ? "" : undefined,
      },
      children,
    ),
  );
}

/* =============================================================================
 * 4. useHoverEffectKind — `.hoverEffect(kind)` / `.hoverEffect(kind, in: group)`
 * ========================================================================== */

export interface UseHoverEffectKindOptions {
  /** ⇄ `isEnabled:` (default true). */
  isEnabled?: boolean;
  /** ⇄ `.hoverEffectDisabled(_:)` — overrides isEnabled when true. */
  disabled?: boolean;
  /** This member's relationship to its enclosing `HoverEffectGroup` (default `activatesGroup`). */
  groupBehavior?: HoverEffectGroupBehavior;
}

/** Props `useHoverEffectKind` returns — spread onto the effect element. */
export interface HoverEffectKindProps {
  className: string;
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  "data-sui-hovered": "" | undefined;
  "data-sui-group-follow": "" | undefined;
}

/**
 * `.hoverEffect(kind)` with positional-kind ergonomics, CSS-class driven so it can
 * participate in a `HoverEffectGroup`. Returns a className (from hover.global.css)
 * plus pointer handlers that toggle `[data-sui-hovered]` (pointer-gated — touch is
 * ignored, matching SwiftUI). When inside a `<HoverEffectGroup>`, an
 * `activatesGroup` member's hover activates the group and `followsGroup` members
 * light up via `[data-sui-group-follow]`.
 *
 * `kind` defaults to the inherited `.defaultHoverEffect`; if that's cleared
 * (`null`) and no kind is passed, the effect is inert.
 *
 * @param kind     "automatic" | "highlight" | "lift" (default: inherited).
 * @param options  `{ isEnabled, disabled, groupBehavior }`.
 */
export function useHoverEffectKind(
  kind?: HoverEffectKind,
  options: UseHoverEffectKindOptions = {},
): HoverEffectKindProps {
  const inherited = useDefaultHoverEffect();
  const resolvedKind = kind ?? inherited;
  const { isEnabled = true, disabled = false, groupBehavior = "activatesGroup" } = options;
  const active = isEnabled && !disabled && resolvedKind !== null;

  const group = React.useContext(HoverGroupContext);
  const [hovered, setHovered] = React.useState(false);
  const memberRef = React.useRef<{ id: number; leave(): void } | null>(null);

  // Join/leave the enclosing group for membership lifetime.
  React.useEffect(() => {
    if (!group || !active || groupBehavior === "ignoresGroup") return;
    const member = group.join();
    memberRef.current = member;
    return () => {
      member.leave();
      memberRef.current = null;
    };
  }, [group, active, groupBehavior]);

  const reportHover = React.useCallback(
    (h: boolean) => {
      setHovered(h);
      // Only `activatesGroup` (or preserves) members drive the group's active flag.
      if (group && memberRef.current && (groupBehavior === "activatesGroup" || groupBehavior === "preservesGroup")) {
        group.setMemberHovered(memberRef.current.id, h);
      }
    },
    [group, groupBehavior],
  );

  const onPointerEnter = React.useCallback(
    (e: React.PointerEvent) => {
      if (!active || e.pointerType === "touch") return;
      reportHover(true);
    },
    [active, reportHover],
  );
  const onPointerLeave = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") return;
      reportHover(false);
    },
    [reportHover],
  );
  const onPointerCancel = React.useCallback(() => reportHover(false), [reportHover]);

  const className = active && resolvedKind ? hoverEffectClass(resolvedKind) : "";
  // `followsGroup` members light up off the group flag, not their own hover.
  const follows = groupBehavior === "followsGroup";

  return {
    className,
    onPointerEnter,
    onPointerLeave,
    onPointerCancel,
    "data-sui-hovered": active && hovered && !follows ? "" : undefined,
    "data-sui-group-follow": active && follows ? "" : undefined,
  };
}

/**
 * The group-bound form of the single-element hook. Equivalent to
 * `useHoverEffectKind(kind, { groupBehavior })`, named to read like SwiftUI's
 * `.hoverEffect(_:in:)`.
 */
export function useHoverEffectInGroup(
  kind: HoverEffectKind | undefined,
  groupBehavior: HoverEffectGroupBehavior = "followsGroup",
  options: Omit<UseHoverEffectKindOptions, "groupBehavior"> = {},
): HoverEffectKindProps {
  return useHoverEffectKind(kind, { ...options, groupBehavior });
}
