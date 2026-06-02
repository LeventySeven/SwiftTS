"use client";
/**
 * Geometry & hover-effect — SwiftUI's `.onGeometryChange(for:of:action:)` and
 * `.hoverEffect(_:)`, ported to React.
 *
 * SwiftUI authoritative API (arm64e-apple-macos.swiftinterface):
 *   View.onGeometryChange<T>(for:, of transform: (GeometryProxy) -> T,
 *                            action: (newValue: T) -> Void)                 (SwiftUI:6070)
 *   View.onGeometryChange<T>(for:, of:, action: (old, new) -> Void)        (SwiftUI:6081)
 *   View.hoverEffect(_ effect: HoverEffect = .automatic, isEnabled: = true) (SwiftUI:9241)
 *   View.hoverEffectDisabled(_ disabled: Bool = true)                      (SwiftUI:9245)
 *   struct HoverEffect { automatic, highlight, lift }                      (SwiftUI:9260)
 *
 * The web mapping.
 *   - `.onGeometryChange` watches a view's GeometryProxy (size/frame) and fires a
 *     callback when a derived value changes. The browser equivalent is
 *     `ResizeObserver` (size) + the element's bounding rect (frame). We compute the
 *     derived `T` via the same `transform` closure and only fire on `!Object.is`
 *     change (matching SwiftUI's `Equatable` gate), with the iOS-17 two-param
 *     `(old, new)` form available.
 *   - `.hoverEffect(.lift|.highlight)` is the iPadOS pointer effect: `lift` grows +
 *     shadows the view under the pointer; `highlight` adds a tinted background.
 *     We reproduce both with pointer enter/leave + a transform/background, returning
 *     spreadable props. `hoverEffectDisabled` suppresses it.
 *
 * SSR-safe: ResizeObserver is created in an effect (client only); hover props carry
 * no DOM access at module scope. "use client".
 */
import * as React from "react";

/* =============================================================================
 * Size / Frame — the GeometryProxy channels we expose
 * ========================================================================== */

export interface GeometrySize {
  width: number;
  height: number;
}

export interface GeometryFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/* =============================================================================
 * useOnGeometryChange — `.onGeometryChange(for:of:action:)` (SwiftUI:6070)
 * ========================================================================== */

export interface OnGeometryChangeOptions {
  /**
   * Watch the full frame (position + size) instead of size only. When `true`,
   * a scroll/layout shift that moves the element also fires the callback (a
   * `requestAnimationFrame` poll is added because `ResizeObserver` only reports
   * size, not position). Default `false` (size-only, the common case).
   */
  observeFrame?: boolean;
}

/**
 * `.onGeometryChange(for: Size.self, of: { $0.size }, action:)`. Attaches a
 * `ResizeObserver` to `ref` and fires `action(newValue)` when the element's size
 * changes. The full `ResizeObserverEntry`-derived size is passed as the
 * `GeometryProxy`-equivalent.
 *
 * @param ref     a ref to the observed element.
 * @param action  fired with the new size whenever it changes.
 */
export function useOnGeometryChange(
  ref: React.RefObject<HTMLElement | null>,
  action: (size: GeometrySize) => void,
): void {
  const actionRef = React.useRef(action);
  actionRef.current = action;

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let last: GeometrySize | null = null;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.borderBoxSize?.[0];
      const size: GeometrySize = box
        ? { width: box.inlineSize, height: box.blockSize }
        : { width: entry.contentRect.width, height: entry.contentRect.height };
      if (last && Object.is(last.width, size.width) && Object.is(last.height, size.height)) return;
      last = size;
      actionRef.current(size);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}

/**
 * The general `.onGeometryChange(for:of:action:)` form: you supply a `transform`
 * that derives a value `T` from the element's `GeometryFrame` (the GeometryProxy
 * analog), and `action` fires with `(oldValue, newValue)` whenever the *derived*
 * value changes (gated by `Object.is`, matching SwiftUI's `Equatable`).
 *
 * @param ref        a ref to the observed element.
 * @param transform  derive the watched value from the element frame.
 * @param action     fired with `(old, new)` on change.
 * @param options    `{ observeFrame }` to also watch position (rAF poll).
 */
export function useOnGeometryChangeValue<T>(
  ref: React.RefObject<HTMLElement | null>,
  transform: (frame: GeometryFrame) => T,
  action: (oldValue: T, newValue: T) => void,
  options: OnGeometryChangeOptions = {},
): void {
  const transformRef = React.useRef(transform);
  transformRef.current = transform;
  const actionRef = React.useRef(action);
  actionRef.current = action;
  const observeFrame = options.observeFrame ?? false;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let last: { v: T } | null = null;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const frame: GeometryFrame = {
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height,
        top: r.top,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
      };
      const next = transformRef.current(frame);
      if (last && Object.is(last.v, next)) return;
      const prev = last ? last.v : next;
      last = { v: next };
      actionRef.current(prev, next);
    };

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }

    let rafId = 0;
    const poll = () => {
      measure();
      rafId = requestAnimationFrame(poll);
    };
    if (observeFrame) rafId = requestAnimationFrame(poll);

    // initial measure
    measure();

    return () => {
      ro?.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [ref, observeFrame]);
}

/* =============================================================================
 * useHoverEffect — `.hoverEffect(_:)` (SwiftUI:9241)
 * ========================================================================== */

/** `SwiftUI.HoverEffect` (SwiftUI:9260). */
export type HoverEffectStyle = "automatic" | "highlight" | "lift";

export interface UseHoverEffectOptions {
  /** ⇄ the `HoverEffect` (default `.automatic`, resolved to `.lift`). */
  effect?: HoverEffectStyle;
  /** ⇄ `isEnabled:` (default `true`). */
  isEnabled?: boolean;
  /** ⇄ `.hoverEffectDisabled(_:)` — overrides `isEnabled` when true. */
  disabled?: boolean;
}

export interface HoverEffectProps {
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  style: React.CSSProperties;
  "data-hover-effect": HoverEffectStyle | undefined;
  "data-hovered": "" | undefined;
}

/** The visual style each effect applies while hovered. */
function effectStyle(effect: HoverEffectStyle, hovered: boolean): React.CSSProperties {
  if (!hovered) {
    return {
      transition: "transform 0.18s ease-out, box-shadow 0.18s ease-out, background-color 0.18s ease-out",
    };
  }
  // `.automatic` resolves to `.lift` on pointer platforms.
  const resolved = effect === "automatic" ? "lift" : effect;
  if (resolved === "lift") {
    return {
      transform: "scale(1.04)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
      transition: "transform 0.18s ease-out, box-shadow 0.18s ease-out",
    };
  }
  // highlight — tinted background under the pointer.
  return {
    backgroundColor: "var(--sui-color-system-fill, color-mix(in srgb, var(--sui-color-label) 10%, transparent))",
    borderRadius: "8px",
    transition: "background-color 0.18s ease-out",
  };
}

/**
 * `.hoverEffect(.lift | .highlight | .automatic)`. Returns props that apply the
 * iPadOS pointer effect while the pointer is over the element. `lift` scales +
 * shadows the view; `highlight` tints its background. Touch is ignored
 * (`pointerType === "touch"`), matching SwiftUI's pointer-only semantics.
 * `disabled` (`.hoverEffectDisabled`) turns it off.
 */
export function useHoverEffect(options: UseHoverEffectOptions = {}): HoverEffectProps {
  const { effect = "automatic", isEnabled = true, disabled = false } = options;
  const active = isEnabled && !disabled;
  const [hovered, setHovered] = React.useState(false);

  const onPointerEnter = React.useCallback(
    (e: React.PointerEvent) => {
      if (!active || e.pointerType === "touch") return;
      setHovered(true);
    },
    [active],
  );
  const onPointerLeave = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") return;
      setHovered(false);
    },
    [],
  );
  const onPointerCancel = React.useCallback(() => setHovered(false), []);

  return {
    onPointerEnter,
    onPointerLeave,
    onPointerCancel,
    style: active ? effectStyle(effect, hovered) : {},
    "data-hover-effect": active ? effect : undefined,
    "data-hovered": active && hovered ? "" : undefined,
  };
}

/**
 * `.hoverEffectDisabled(_:)` — the suppression form. Equivalent to
 * `useHoverEffect({ disabled: true })`; provided for call-site parity. Returns an
 * empty effect (props that apply no visual change).
 */
export function useHoverEffectDisabled(disabled: boolean = true): HoverEffectProps {
  return useHoverEffect({ disabled });
}
