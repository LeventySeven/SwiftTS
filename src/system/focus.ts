"use client";
/**
 * Focus — SwiftUI's `@FocusState` / `.focused(_:)` / `.focusable(_:)` /
 * `.focusEffectDisabled(_:)`, ported to React.
 *
 * SwiftUI authoritative API (arm64e-apple-macos.swiftinterface):
 *   @propertyWrapper struct FocusState<Value>                              (SwiftUI)
 *   View.focused(_ condition: FocusState<Bool>.Binding)                    (SwiftUI:8529)
 *   View.focused(_ binding: FocusState<V>.Binding, equals: V)             (the value form)
 *   View.focusable(_ isFocusable: Bool = true)                            (SwiftUI:21772)
 *   View.focusable(_:onFocusChange:)                                      (SwiftUI:21826)
 *   View.focusEffectDisabled(_ disabled: Bool = true)                    (SwiftUI:21778)
 *
 * The web mapping. SwiftUI's `@FocusState` is a binding that BOTH reflects which
 * field is focused AND lets you push focus programmatically (set the binding →
 * the field focuses). The browser equivalent is `element.focus()` + the
 * `focus`/`blur` events + `tabIndex`. The "focus ring" is `:focus-visible` /
 * `outline`, suppressed by `.focusEffectDisabled`.
 *
 *   - `useFocusState<V>(initial?)` → the `@FocusState` analog: `{ value, setValue,
 *     bind(ref) }`. `bind` returns props that wire an element to the state.
 *   - `useFocusable({ isFocused, onFocusChange })` → props that make any element
 *     focusable (tabIndex), report focus changes, and (optionally) push focus.
 *   - `focused(binding)` → the `.focused(_:)` helper: props that bind an element's
 *     focus to a boolean (or value) `@FocusState`.
 *   - `focusEffectDisabled(disabled?)` → props that suppress the focus ring
 *     (`data-focus-effect-disabled` + inline `outline: none`).
 *
 * SSR-safe: prop objects only; DOM access happens in effects/handlers. "use client".
 */
import * as React from "react";

/* =============================================================================
 * Bindings — the `value + onChange` contract used across the kit
 * ========================================================================== */

/** A `Binding<T>` in this kit's `value + onChange` shape. */
export interface FocusBinding<T> {
  /** Current focus value (`@FocusState`'s wrapped value). */
  value: T;
  /** Push a new focus value (setting it focuses the matching field). */
  onChange: (value: T) => void;
}

/* =============================================================================
 * useFocusState — `@FocusState` (SwiftUI propertyWrapper)
 * ========================================================================== */

export interface FocusStateResult<V> {
  /** ⇄ the wrapped `@FocusState` value (which field is focused, or `false`). */
  value: V;
  /** Set the focus value programmatically (focuses the bound field). */
  setValue: (v: V) => void;
  /**
   * `.focused(binding, equals: thisValue)` for the value form: returns props
   * that focus the element when `value === thisValue` and report focus back.
   * Pass the element's identity value; for a `Bool` focus state pass `true`.
   */
  bind: (
    thisValue: V,
    ref?: React.RefObject<HTMLElement | null>,
  ) => FocusedProps;
}

/**
 * `@FocusState`. Holds which field is focused and lets you drive focus
 * programmatically. For a single field use `useFocusState<boolean>(false)`; for a
 * group, use a value type (e.g. an enum/string) and `bind(thatValue)` per field.
 *
 * Setting `value` (via `setValue`) focuses the element whose `bind` value matches
 * — exactly like assigning to a SwiftUI `@FocusState` property.
 */
export function useFocusState<V = boolean>(initial: V): FocusStateResult<V> {
  const [value, setValueState] = React.useState<V>(initial);
  // map of bound-value → element, so setValue can focus the right node
  const nodesRef = React.useRef(new Map<V, HTMLElement>());
  const valueRef = React.useRef(value);
  valueRef.current = value;

  const setValue = React.useCallback((v: V) => {
    setValueState(v);
    // focus the matching element if registered; blur all when v is the "none" value
    const el = nodesRef.current.get(v);
    if (el) {
      // defer to after the state flush so the element exists/updated
      queueMicrotask(() => el.focus());
    }
  }, []);

  const bind = React.useCallback(
    (thisValue: V, externalRef?: React.RefObject<HTMLElement | null>): FocusedProps => {
      const attach = (el: HTMLElement | null) => {
        if (el) nodesRef.current.set(thisValue, el);
        else nodesRef.current.delete(thisValue);
        if (externalRef) externalRef.current = el;
      };
      return {
        ref: attach as React.RefCallback<HTMLElement>,
        tabIndex: 0,
        onFocus: () => setValueState(thisValue),
        onBlur: () => {
          // only clear if THIS field was the focused one
          setValueState((cur) => (Object.is(cur, thisValue) ? (falseLike<V>() ) : cur));
        },
        "data-focused": Object.is(valueRef.current, thisValue) ? "" : undefined,
      };
    },
    [],
  );

  return { value, setValue, bind };
}

/** The "no focus" value: `false` for Bool focus, `undefined`/null otherwise. */
function falseLike<V>(): V {
  return false as unknown as V;
}

/* =============================================================================
 * FocusedProps — the prop bag a focusable element receives
 * ========================================================================== */

export interface FocusedProps {
  ref?: React.RefCallback<HTMLElement>;
  tabIndex?: number;
  onFocus?: (e?: React.FocusEvent) => void;
  onBlur?: (e?: React.FocusEvent) => void;
  "data-focused"?: "" | undefined;
  "data-focus-effect-disabled"?: "" | undefined;
  style?: React.CSSProperties;
}

/* =============================================================================
 * useFocusable — `.focusable(_:onFocusChange:)` (SwiftUI:21826)
 * ========================================================================== */

export interface UseFocusableOptions {
  /**
   * ⇄ a `@FocusState` binding value (controlled). When `true`, the element is
   * focused (and re-focused if it loses focus while this stays `true`).
   */
  isFocused?: boolean;
  /** ⇄ `onFocusChange: (isFocused: Bool) -> Void` (SwiftUI:21826). */
  onFocusChange?: (isFocused: boolean) => void;
  /** ⇄ `isFocusable:` — when `false`, removes the element from the tab order. */
  isFocusable?: boolean;
  /** Suppress the focus ring (`.focusEffectDisabled`). */
  focusEffectDisabled?: boolean;
}

export interface UseFocusableResult {
  /** Spread on the focusable element. */
  focusableProps: FocusedProps;
  /** Whether the element is currently focused (uncontrolled mirror). */
  isFocused: boolean;
  /** Programmatically focus the element. */
  focus: () => void;
  /** Programmatically blur the element. */
  blur: () => void;
}

/**
 * `.focusable(isFocusable:onFocusChange:)`. Makes any element keyboard-focusable
 * (sets `tabIndex`), reports focus changes via `onFocusChange`, and — when
 * `isFocused` is provided as a controlled binding — pushes focus to match it.
 * `focusEffectDisabled` removes the focus ring.
 */
export function useFocusable(options: UseFocusableOptions = {}): UseFocusableResult {
  const { isFocused, onFocusChange, isFocusable = true, focusEffectDisabled } = options;
  const ref = React.useRef<HTMLElement | null>(null);
  const [focusedUncontrolled, setFocusedUncontrolled] = React.useState(false);
  const onChangeRef = React.useRef(onFocusChange);
  onChangeRef.current = onFocusChange;

  // controlled push: when isFocused flips true, focus the element; false → blur.
  React.useEffect(() => {
    if (isFocused === undefined) return;
    const el = ref.current;
    if (!el) return;
    if (isFocused && document.activeElement !== el) el.focus();
    else if (!isFocused && document.activeElement === el) el.blur();
  }, [isFocused]);

  const focus = React.useCallback(() => ref.current?.focus(), []);
  const blur = React.useCallback(() => ref.current?.blur(), []);

  const focusableProps: FocusedProps = {
    ref: (el: HTMLElement | null) => {
      ref.current = el;
    },
    tabIndex: isFocusable ? 0 : -1,
    onFocus: () => {
      setFocusedUncontrolled(true);
      onChangeRef.current?.(true);
    },
    onBlur: () => {
      setFocusedUncontrolled(false);
      onChangeRef.current?.(false);
    },
    "data-focused": (isFocused ?? focusedUncontrolled) ? "" : undefined,
    "data-focus-effect-disabled": focusEffectDisabled ? "" : undefined,
    ...(focusEffectDisabled ? { style: { outline: "none" } } : {}),
  };

  return {
    focusableProps,
    isFocused: isFocused ?? focusedUncontrolled,
    focus,
    blur,
  };
}

/* =============================================================================
 * focused(binding) — `.focused(_:)` (SwiftUI:8529)
 * ========================================================================== */

/**
 * `.focused(_ condition: FocusState<Bool>.Binding)`. Binds an element's focus to a
 * boolean `@FocusState` binding: focusing the element sets the binding `true`,
 * blurring sets it `false`, and setting the binding `true` focuses the element.
 *
 * Returns props to spread on the element. NOTE: this is a plain helper meant to be
 * called in render with a stable ref; the ref is how the binding pushes focus.
 *
 * @param binding   the `{ value, onChange }` Bool focus binding.
 * @param ref       a ref to the element (so the binding can call `.focus()`).
 */
export function focused(
  binding: FocusBinding<boolean>,
  ref: React.RefObject<HTMLElement | null>,
): FocusedProps {
  return {
    ref: (el: HTMLElement | null) => {
      ref.current = el;
    },
    tabIndex: 0,
    onFocus: () => {
      if (!binding.value) binding.onChange(true);
    },
    onBlur: () => {
      if (binding.value) binding.onChange(false);
    },
    "data-focused": binding.value ? "" : undefined,
  };
}

/**
 * The effect that pushes focus when a `.focused` boolean binding flips `true`.
 * Call this hook alongside `focused(binding, ref)` so the binding can DRIVE focus
 * (not just reflect it). Mirrors SwiftUI assigning `true` to a `@FocusState`.
 */
export function useFocusedBinding(
  binding: FocusBinding<boolean>,
  ref: React.RefObject<HTMLElement | null>,
): void {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (binding.value && document.activeElement !== el) el.focus();
    else if (!binding.value && document.activeElement === el) el.blur();
  }, [binding.value, ref]);
}

/* =============================================================================
 * focused(binding, equals:) — the value form
 * ========================================================================== */

/**
 * `.focused(_ binding: FocusState<V>.Binding, equals value: V)`. Binds an element
 * to a *value* `@FocusState`: the element is focused iff `binding.value === equals`.
 * Focusing the element sets the binding to `equals`; blurring resets it to `none`.
 *
 * @param binding   the value focus binding (`{ value, onChange }`).
 * @param equals    this element's identity value.
 * @param none      the "nothing focused" sentinel (default `undefined`).
 */
export function focusedEquals<V>(
  binding: FocusBinding<V | undefined>,
  equals: V,
  ref: React.RefObject<HTMLElement | null>,
  none: V | undefined = undefined,
): FocusedProps {
  return {
    ref: (el: HTMLElement | null) => {
      ref.current = el;
    },
    tabIndex: 0,
    onFocus: () => {
      if (!Object.is(binding.value, equals)) binding.onChange(equals);
    },
    onBlur: () => {
      if (Object.is(binding.value, equals)) binding.onChange(none);
    },
    "data-focused": Object.is(binding.value, equals) ? "" : undefined,
  };
}

/* =============================================================================
 * focusEffectDisabled — `.focusEffectDisabled(_:)` (SwiftUI:21778)
 * ========================================================================== */

/**
 * `.focusEffectDisabled(_ disabled: Bool = true)`. Returns props that suppress the
 * focus ring on the element (sets `outline: none` + a `data-` flag descendants'
 * CSS can read to remove `:focus-visible` styling).
 */
export function focusEffectDisabled(disabled: boolean = true): FocusedProps {
  if (!disabled) return {};
  return {
    "data-focus-effect-disabled": "",
    style: { outline: "none" },
  };
}

/* =============================================================================
 * Merge helper — combine multiple FocusedProps bags onto one element
 * ========================================================================== */

/**
 * Merge several `FocusedProps` bags (e.g. `focusable` + `focusEffectDisabled`)
 * into one, chaining `onFocus`/`onBlur`/`ref` and unioning `data-`/`style`.
 */
export function mergeFocusProps(...bags: Array<FocusedProps | undefined>): FocusedProps {
  const out: FocusedProps = {};
  const refs: Array<React.RefCallback<HTMLElement>> = [];
  const focusFns: Array<(e?: React.FocusEvent) => void> = [];
  const blurFns: Array<(e?: React.FocusEvent) => void> = [];
  let style: React.CSSProperties = {};

  for (const b of bags) {
    if (!b) continue;
    if (b.ref) refs.push(b.ref);
    if (b.onFocus) focusFns.push(b.onFocus);
    if (b.onBlur) blurFns.push(b.onBlur);
    if (b.tabIndex !== undefined) out.tabIndex = b.tabIndex;
    if (b["data-focused"] !== undefined) out["data-focused"] = b["data-focused"];
    if (b["data-focus-effect-disabled"] !== undefined)
      out["data-focus-effect-disabled"] = b["data-focus-effect-disabled"];
    if (b.style) style = { ...style, ...b.style };
  }

  if (refs.length)
    out.ref = (el: HTMLElement | null) => refs.forEach((r) => r(el as HTMLElement));
  if (focusFns.length) out.onFocus = (e) => focusFns.forEach((f) => f(e));
  if (blurFns.length) out.onBlur = (e) => blurFns.forEach((f) => f(e));
  if (Object.keys(style).length) out.style = style;
  return out;
}
