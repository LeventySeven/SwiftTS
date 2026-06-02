"use client";
/**
 * C2 universal control machinery — §0 of `teardowns/SWIFTUI_C2_action-controls.md`.
 *
 * Every action control (Button, Toggle, Menu, ControlGroup, the *Button helpers)
 * shares two pieces of state that SwiftUI resolves from the environment:
 *
 *   1. `ControlSize` (`SwiftUICore.ControlSize`, KNOWN enum) — mini < small <
 *      regular < large < extraLarge. We emit `data-control-size` on the root and
 *      key every metric off CSS custom props so one attribute resizes the control.
 *   2. `isEnabled` (`EnvironmentValues.isEnabled`, KNOWN) — propagates down the
 *      subtree; a disabled container disables every control inside it.
 *
 * This module exposes a small context (`ControlEnv`) plus the
 * `<ControlSizeProvider>` / `useControlSize()` and the disabled-cascade helpers.
 * It sits on top of the global `useEnvironment()` (which already carries
 * controlSize / tint / isEnabled) and lets a C2-local subtree override them the
 * way SwiftUI's `.controlSize(_:)` / `.disabled(_:)` modifiers do.
 */
import * as React from "react";
import { createContext, useContext, useMemo } from "react";
import type { ControlSize } from "../../system/types";
import { useEnvironment } from "../../system/environment";

/* ---------------------------------------------------------------------------
 * ControlSize
 * ------------------------------------------------------------------------- */

/** Comparable order (`mini < small < regular < large < extraLarge`, SUI :6151). */
export const CONTROL_SIZE_ORDER: readonly ControlSize[] = [
  "mini",
  "small",
  "regular",
  "large",
  "extraLarge",
];

const ControlSizeContext = createContext<ControlSize | undefined>(undefined);
ControlSizeContext.displayName = "ControlSize";

/**
 * `.controlSize(_:)` — push a control size into the C2-local cascade. Descendant
 * controls read it via `useControlSize()` unless they set their own.
 */
export function ControlSizeProvider({
  size,
  children,
}: {
  size: ControlSize;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <ControlSizeContext.Provider value={size}>
      {children}
    </ControlSizeContext.Provider>
  );
}

/**
 * Resolve the active control size: explicit prop > nearest ControlSizeProvider >
 * global environment controlSize > "regular".
 */
export function useControlSize(explicit?: ControlSize): ControlSize {
  const inherited = useContext(ControlSizeContext);
  const env = useEnvironment();
  return explicit ?? inherited ?? env.controlSize ?? "regular";
}

/* ---------------------------------------------------------------------------
 * isEnabled cascade
 * ------------------------------------------------------------------------- */

const DisabledContext = createContext<boolean>(false);
DisabledContext.displayName = "ControlDisabled";

/**
 * `.disabled(_:)` — a disabled ancestor disables the whole subtree. Pushing
 * `true` here is sticky: once disabled, a descendant cannot re-enable itself.
 */
export function DisabledProvider({
  disabled,
  children,
}: {
  disabled: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  const inherited = useContext(DisabledContext);
  const value = inherited || disabled;
  return (
    <DisabledContext.Provider value={value}>{children}</DisabledContext.Provider>
  );
}

/** True when this control is disabled (own prop OR an ancestor `.disabled(true)`). */
export function useIsDisabled(ownDisabled?: boolean): boolean {
  const inherited = useContext(DisabledContext);
  const env = useEnvironment();
  return Boolean(ownDisabled) || inherited || env.isEnabled === false;
}

/* ---------------------------------------------------------------------------
 * tint resolution
 * ------------------------------------------------------------------------- */

/**
 * Resolve the active tint: explicit `.tint(_:)` > global environment tint >
 * the `--sui-color-tint` token. Returned as a style object that sets the
 * `--sui-color-tint` custom prop locally so every tint-keyed rule under the
 * control re-colors (mirrors SwiftUI's `.tint(_:)` cascade).
 */
export function tintStyle(explicit?: string): React.CSSProperties | undefined {
  if (!explicit) return undefined;
  return { ["--sui-color-tint" as never]: explicit } as React.CSSProperties;
}
