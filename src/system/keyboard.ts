"use client";
/* =============================================================================
 * keyboard.ts — SwiftUI's `.keyboardShortcut(_:modifiers:)`, ported to React.
 *
 * SwiftUI authoritative API (arm64e-apple-macos.swiftinterface):
 *   View.keyboardShortcut(_ key: KeyEquivalent, modifiers: EventModifiers = .command) (SwiftUI:20262)
 *   View.keyboardShortcut(_ shortcut: KeyboardShortcut)                               (SwiftUI:20264)
 *   struct KeyboardShortcut { var key: KeyEquivalent; var modifiers: EventModifiers   (SwiftUI:20293)
 *     static let defaultAction; static let cancelAction
 *     init(_ key, modifiers: EventModifiers = .command) }
 *   struct KeyEquivalent { upArrow, downArrow, leftArrow, rightArrow, escape, delete,  (SwiftUI:20318)
 *     deleteForward, home, end, pageUp, pageDown, clear, tab, space, return;
 *     var character: Character; init(_ character) }
 *
 * The web mapping.
 *   - `.keyboardShortcut("s", modifiers: .command)` attaches a window-level
 *     keydown matcher that, when ⌘S is pressed, runs the bound action (SwiftUI
 *     routes the shortcut to the control's primary action; on the web there is no
 *     "primary action" graph, so the hook takes the action directly).
 *   - `KeyEquivalent`'s named keys map to DOM `KeyboardEvent.key` values
 *     (`ArrowUp`, `Escape`, `Enter`, …); a single-character equivalent matches
 *     case-insensitively against `event.key`.
 *   - `EventModifiers = .command` means ⌘ on macOS. To stay cross-platform the
 *     matcher treats ⌘ (metaKey) OR ⌃ (ctrlKey) as "command" UNLESS the caller
 *     pins it (mac users press ⌘; Windows/Linux users press Ctrl) — this is the
 *     web convention SwiftUI itself adopts when Catalyst/iPad apps run.
 *   - `KeyboardShortcutScope` bounds a set of shortcuts to a subtree: while the
 *     focus/pointer is inside the scope (or always, for a global scope) its
 *     shortcuts are active; nested scopes shadow outer ones for the same combo.
 *
 * The `EventModifiers` type + DOM bridge live in events.ts (single source of
 * truth) — imported here. SSR-safe: listeners are created in effects. "use client".
 * ========================================================================== */
import * as React from "react";
import { type EventModifiers, eventModifiersFrom } from "./events";

/* =============================================================================
 * 1. KeyEquivalent — the named keys + character form (SwiftUI:20318)
 * ========================================================================== */

/** SwiftUI's `KeyEquivalent` named keys, mapped to DOM `KeyboardEvent.key`. */
export const KeyEquivalent = {
  upArrow: "ArrowUp",
  downArrow: "ArrowDown",
  leftArrow: "ArrowLeft",
  rightArrow: "ArrowRight",
  escape: "Escape",
  delete: "Backspace",
  deleteForward: "Delete",
  home: "Home",
  end: "End",
  pageUp: "PageUp",
  pageDown: "PageDown",
  clear: "Clear",
  tab: "Tab",
  space: " ",
  return: "Enter",
} as const;

/** A keyboard key: a named `KeyEquivalent` value, or any single character ("s", "/"…). */
export type KeyEquivalentValue = (typeof KeyEquivalent)[keyof typeof KeyEquivalent] | string;

/* =============================================================================
 * 2. Modifiers — the subset that participates in a shortcut
 * ========================================================================== */

/**
 * The modifier requirement for a shortcut. Booleans default to `false` (bit must
 * be UP) except as noted; `command` defaults to `true` to match SwiftUI's
 * `modifiers: .command` default. `command` matches ⌘ OR ⌃ cross-platform unless
 * `strictCommand` pins it to ⌘ only.
 */
export interface ShortcutModifiers {
  command?: boolean;
  shift?: boolean;
  option?: boolean;
  control?: boolean;
  capsLock?: boolean;
  /** When true, `command` requires the ⌘ (metaKey) bit specifically, not ⌃. */
  strictCommand?: boolean;
}

/** `KeyboardShortcut` value (SwiftUI:20293) — key + modifiers. */
export interface KeyboardShortcut {
  key: KeyEquivalentValue;
  modifiers: ShortcutModifiers;
}

/** Build a `KeyboardShortcut` (the `KeyboardShortcut(_:modifiers:)` initializer). */
export function makeKeyboardShortcut(
  key: KeyEquivalentValue,
  modifiers: ShortcutModifiers = { command: true },
): KeyboardShortcut {
  return { key, modifiers };
}

/** `KeyboardShortcut.defaultAction` — ⏎ with no modifiers (the default button). */
export const defaultActionShortcut: KeyboardShortcut = {
  key: KeyEquivalent.return,
  modifiers: { command: false },
};

/** `KeyboardShortcut.cancelAction` — ⎋ with no modifiers (the cancel button). */
export const cancelActionShortcut: KeyboardShortcut = {
  key: KeyEquivalent.escape,
  modifiers: { command: false },
};

/* =============================================================================
 * 3. Matching — does a DOM KeyboardEvent satisfy a shortcut?
 * ========================================================================== */

/** Normalize a key for case-insensitive single-character comparison. */
function normalizeKey(k: string): string {
  return k.length === 1 ? k.toLowerCase() : k;
}

/** True when `e` matches `shortcut`'s key + modifier requirement exactly. */
export function eventMatchesShortcut(
  e: Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "altKey" | "metaKey" | "getModifierState">,
  shortcut: KeyboardShortcut,
): boolean {
  const mods = shortcut.modifiers;
  const live: EventModifiers = eventModifiersFrom(e);

  // key
  if (normalizeKey(e.key) !== normalizeKey(shortcut.key)) return false;

  // command: ⌘ OR ⌃ cross-platform, unless strictCommand pins to ⌘.
  const wantCommand = mods.command ?? false;
  if (wantCommand) {
    const has = mods.strictCommand ? live.command : live.command || live.control;
    if (!has) return false;
  } else {
    // command not wanted → neither ⌘ nor (when not separately requested) ⌃ may be down.
    if (live.command) return false;
    if (!mods.control && live.control) return false;
  }

  // explicit control requirement (independent of command's ⌃-fallback)
  if (mods.control !== undefined) {
    if (mods.control !== live.control) return false;
  }
  // shift / option / capsLock: required bits must match when specified.
  if (mods.shift !== undefined && mods.shift !== live.shift) return false;
  if (mods.shift === undefined && live.shift) return false;
  if (mods.option !== undefined && mods.option !== live.option) return false;
  if (mods.option === undefined && live.option) return false;
  if (mods.capsLock !== undefined && mods.capsLock !== live.capsLock) return false;

  return true;
}

/* =============================================================================
 * 4. Scope registry — nested scopes, inner shadows outer for the same combo
 * ========================================================================== */

interface ScopeEntry {
  id: number;
  depth: number;
  /** When set, only fire while focus is inside this element. */
  containerRef?: React.RefObject<HTMLElement | null>;
  isEnabled: () => boolean;
}

interface ShortcutBinding {
  scope: ScopeEntry;
  shortcut: KeyboardShortcut;
  action: () => void;
  /** Suppress the browser default (e.g. ⌘S "save page") when matched. */
  preventDefault: boolean;
  enabled: () => boolean;
}

/** Module-global registry; one window-level keydown dispatcher serves every binding. */
class ShortcutRegistry {
  private bindings = new Set<ShortcutBinding>();
  private installed = false;
  private nextId = 1;

  newScopeId(): number {
    return this.nextId++;
  }

  add(binding: ShortcutBinding): () => void {
    this.bindings.add(binding);
    this.install();
    return () => {
      this.bindings.delete(binding);
      if (this.bindings.size === 0) this.uninstall();
    };
  }

  private handler = (e: KeyboardEvent) => {
    // Gather candidates that match key+mods AND whose scope is active.
    let best: ShortcutBinding | null = null;
    let bestDepth = -1;
    for (const b of this.bindings) {
      if (!b.enabled()) continue;
      if (!b.scope.isEnabled()) continue;
      if (!scopeContainsFocus(b.scope)) continue;
      if (!eventMatchesShortcut(e, b.shortcut)) continue;
      // Inner scope (greater depth) shadows outer for the same combo.
      if (b.scope.depth > bestDepth) {
        best = b;
        bestDepth = b.scope.depth;
      }
    }
    if (best) {
      if (best.preventDefault) e.preventDefault();
      best.action();
    }
  };

  private install() {
    if (this.installed || typeof window === "undefined") return;
    window.addEventListener("keydown", this.handler);
    this.installed = true;
  }

  private uninstall() {
    if (!this.installed || typeof window === "undefined") return;
    window.removeEventListener("keydown", this.handler);
    this.installed = false;
  }
}

const registry = new ShortcutRegistry();

/** A scope is "focused" if it's global (no container) or the active element is inside it. */
function scopeContainsFocus(scope: ScopeEntry): boolean {
  const container = scope.containerRef?.current;
  if (!container) return true; // global scope — always eligible
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (active && container.contains(active)) return true;
  // Also allow when nothing is focused but the pointer-owning scope is the app root.
  return active === document.body || active === null;
}

/* =============================================================================
 * 5. KeyboardShortcutScope — bound a set of shortcuts to a subtree
 * ========================================================================== */

const ScopeContext = React.createContext<ScopeEntry | null>(null);

export interface KeyboardShortcutScopeProps {
  /** When false, every shortcut registered under this scope is inert. Default true. */
  isEnabled?: boolean;
  /**
   * When provided, shortcuts in this scope only fire while focus is inside this
   * element (the iPad/macOS "first responder" analog). Omit for a global scope.
   */
  containerRef?: React.RefObject<HTMLElement | null>;
  children?: React.ReactNode;
}

/**
 * Bounds the `useKeyboardShortcut` hooks rendered inside it. Nesting deepens the
 * scope depth so an inner scope's shortcut SHADOWS an outer scope's identical
 * combo (matching SwiftUI's focus-scoped shortcut resolution). A scope with a
 * `containerRef` only activates while focus is inside that element.
 */
export function KeyboardShortcutScope({
  isEnabled = true,
  containerRef,
  children,
}: KeyboardShortcutScopeProps): React.ReactElement {
  const parent = React.useContext(ScopeContext);
  const enabledRef = React.useRef(isEnabled);
  enabledRef.current = isEnabled;

  const scope = React.useMemo<ScopeEntry>(
    () => ({
      id: registry.newScopeId(),
      depth: (parent?.depth ?? 0) + 1,
      containerRef,
      // Active only when this scope AND every ancestor scope is enabled.
      isEnabled: () => enabledRef.current && (parent ? parent.isEnabled() : true),
    }),
    [parent, containerRef],
  );

  return React.createElement(ScopeContext.Provider, { value: scope }, children);
}

/** The implicit root scope used by `useKeyboardShortcut` when no `<KeyboardShortcutScope>` wraps it. */
const ROOT_SCOPE: ScopeEntry = {
  id: 0,
  depth: 0,
  isEnabled: () => true,
};

/* =============================================================================
 * 6. useKeyboardShortcut — `.keyboardShortcut(_:modifiers:){action}` (SwiftUI:20262)
 * ========================================================================== */

export interface UseKeyboardShortcutOptions {
  /** The modifier requirement. Defaults to `{ command: true }` (SwiftUI `.command`). */
  modifiers?: ShortcutModifiers;
  /** The bound action — runs when the combo is pressed. */
  action: () => void;
  /** When false, the shortcut is registered but inert. Default true. */
  isEnabled?: boolean;
  /** Suppress the browser default for the combo (e.g. ⌘S). Default true. */
  preventDefault?: boolean;
}

/**
 * `.keyboardShortcut(key, modifiers: …)`. Registers a global keydown matcher; when
 * the combo fires (and this shortcut's scope is active and not shadowed), runs
 * `action`. The default modifier is `.command` (⌘, matching ⌃ cross-platform).
 *
 * @param key      a `KeyEquivalent.*` value or a single character ("s").
 * @param options  `{ modifiers, action, isEnabled, preventDefault }`.
 */
export function useKeyboardShortcut(
  key: KeyEquivalentValue,
  options: UseKeyboardShortcutOptions,
): void {
  const scope = React.useContext(ScopeContext) ?? ROOT_SCOPE;
  const actionRef = React.useRef(options.action);
  actionRef.current = options.action;
  const enabledRef = React.useRef(options.isEnabled ?? true);
  enabledRef.current = options.isEnabled ?? true;

  const modifiers = options.modifiers ?? { command: true };
  const preventDefault = options.preventDefault ?? true;
  // Stable identity for the modifier requirement so the effect doesn't re-register
  // on every render from a fresh-but-equal object literal.
  const modKey = JSON.stringify(modifiers);

  React.useEffect(() => {
    const binding: ShortcutBinding = {
      scope,
      shortcut: { key, modifiers: JSON.parse(modKey) as ShortcutModifiers },
      action: () => actionRef.current(),
      preventDefault,
      enabled: () => enabledRef.current,
    };
    return registry.add(binding);
  }, [scope, key, modKey, preventDefault]);
}

/**
 * The `KeyboardShortcut`-value form: `useKeyboardShortcutValue(shortcut, action)`.
 * Equivalent to `useKeyboardShortcut(shortcut.key, { modifiers: shortcut.modifiers, action })`.
 */
export function useKeyboardShortcutValue(
  shortcut: KeyboardShortcut,
  action: () => void,
  options?: { isEnabled?: boolean; preventDefault?: boolean },
): void {
  useKeyboardShortcut(shortcut.key, {
    modifiers: shortcut.modifiers,
    action,
    isEnabled: options?.isEnabled,
    preventDefault: options?.preventDefault,
  });
}
