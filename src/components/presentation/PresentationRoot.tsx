"use client";
/**
 * Shared web infrastructure for the C8 presentation/modal cluster (§9 of the spec).
 *
 * Every SwiftUI presentation (`sheet`, `fullScreenCover`, `popover`, `alert`,
 * `confirmationDialog`, `contextMenu`) is a *modifier* that attaches an overlay to
 * an anchor view and toggles it via a `Binding<Bool>`/`Binding<Item?>`. The web
 * analog is a **portal + overlay**: each presentation renders into a single
 * top-level `<div id="sui-presentation-root">`, z-stacked, NOT inline.
 *
 * This module owns the four shared concerns:
 *   1. `<PresentationRoot/>` / `usePresentationPortal()` — the singleton portal host.
 *   2. `usePresentation()` — the mount→enter→exit→unmount lifecycle (keep-mounted-
 *      through-exit), firing `onDismiss` on the exit `transitionend`.
 *   3. `useDismiss()` context — mirrors `@Environment(\.dismiss)`.
 *   4. `<Scrim/>` — the dimming layer (mirrors `presentationBackgroundInteraction`).
 *   5. focus trap + Esc wiring helpers for `aria-modal` dialogs.
 *
 * All animations come from the spring tokens via `animation.ts` (`useAnimation`);
 * all transitions honor `@media (prefers-reduced-motion: reduce)`.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { useAnimation, type AnimationToken } from "../../system/animation";

/* ===========================================================================
 * 0. z-index stack (§9.1) — KNOWN ordering from the spec.
 * ======================================================================== */

/** The z-index every presentation surface sits at (sheet < popover < alert < ctxmenu). */
export const PRESENTATION_Z = {
  sheet: 1000,
  fullScreenCover: 1000,
  popover: 1100,
  alert: 1200,
  confirmationDialog: 1200,
  contextMenu: 1300,
} as const;

export const PRESENTATION_ROOT_ID = "sui-presentation-root";

/* ===========================================================================
 * 1. The portal host (§9.1)
 * ======================================================================== */

/**
 * Lazily create (or reuse) the singleton `<div id="sui-presentation-root">` at the
 * end of `document.body`. SSR-safe: returns `null` until mounted on the client, so
 * presentations never try to portal during the server render.
 */
export function usePresentationPortal(): HTMLElement | null {
  const [host, setHost] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    let el = document.getElementById(PRESENTATION_ROOT_ID);
    let created = false;
    if (!el) {
      el = document.createElement("div");
      el.id = PRESENTATION_ROOT_ID;
      // The host itself never intercepts pointer events; each surface opts in.
      el.style.position = "fixed";
      el.style.inset = "0";
      el.style.zIndex = String(PRESENTATION_Z.sheet);
      el.style.pointerEvents = "none";
      document.body.appendChild(el);
      created = true;
    }
    setHost(el);
    return () => {
      // Only remove a host WE created and that is now empty.
      if (created && el && el.childElementCount === 0 && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  return host;
}

/**
 * `<PresentationRoot/>` — optional explicit mount point. Most apps don't need it
 * (the portal auto-creates), but rendering it once at app root pins a stable
 * position in the DOM. It renders nothing itself; it just ensures the host exists.
 */
export function PresentationRoot(): React.JSX.Element | null {
  usePresentationPortal();
  return null;
}

/* ===========================================================================
 * 2. usePresentation — the present/dismiss lifecycle (§9.2)
 * ======================================================================== */

export type PresentationPhase = "exited" | "entering" | "entered" | "exiting";

export interface UsePresentationOptions {
  /** The controlling `Binding<Bool>` value. */
  isPresented: boolean;
  /** Fires AFTER the exit animation completes (SwiftUI `onDismiss`). */
  onDismiss?: () => void;
  /** Driving animation; default `.smooth` spring (sheets/covers/dialogs slide). */
  animation?: AnimationToken;
}

export interface UsePresentationResult {
  /** True while the surface should remain in the DOM (covers the exit tail). */
  mounted: boolean;
  /** Current lifecycle phase. */
  phase: PresentationPhase;
  /**
   * The value for `data-state`: `"presented"` once entered, `"dismissed"` while
   * exiting/exited. CSS keys its enter/exit transforms off this attribute.
   */
  dataState: "presented" | "dismissed";
  /** True the environment requested reduced motion (collapse to a quick fade). */
  reduceMotion: boolean;
  /**
   * Spread onto the ANIMATED node. Wires a `transitionend` listener that advances
   * `entering→entered` / `exiting→exited`, so dismissal waits for the real
   * animation (not a fragile timer) before unmounting + firing `onDismiss`.
   */
  surfaceProps: {
    "data-state": "presented" | "dismissed";
    onTransitionEnd: (e: React.TransitionEvent) => void;
  };
}

/**
 * Drive a presentation through mount → enter → (open) → exit → unmount.
 *
 * The keep-mounted-through-exit pattern: when `isPresented` flips false we do NOT
 * unmount immediately — we set `data-state="dismissed"` (which plays the exit CSS
 * transition) and only unmount once the transition's `transitionend` fires, calling
 * `onDismiss` at that moment. A safety timer (settling duration + slack) guarantees
 * unmount even if `transitionend` never fires (display:none, reduce-motion, etc).
 */
export function usePresentation({
  isPresented,
  onDismiss,
  animation = "smooth",
}: UsePresentationOptions): UsePresentationResult {
  const { reduceMotion } = useAnimation();
  const [mounted, setMounted] = React.useState(isPresented);
  const [phase, setPhase] = React.useState<PresentationPhase>(
    isPresented ? "entered" : "exited",
  );
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // The settling time of the driving spring (≈0.735s for .smooth) in ms, used as
  // the safety fallback when transitionend cannot fire.
  const settleMs = reduceMotion
    ? 200
    : settlingMsFor(animation);

  React.useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isPresented) {
      setMounted(true);
      setPhase("entering");
      // Next frame: flip to "entered" so the browser observes the enter transition.
      const raf =
        typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number;
      const id = raf(() => setPhase("entered"));
      return () => {
        if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
      };
    }

    // Dismissing.
    setPhase((prev) => (prev === "exited" ? "exited" : "exiting"));
    // Safety unmount in case transitionend never lands.
    timerRef.current = setTimeout(() => {
      setMounted(false);
      setPhase("exited");
      onDismissRef.current?.();
    }, settleMs + 60);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresented, settleMs]);

  const dataState: "presented" | "dismissed" =
    phase === "entered" || phase === "entering" ? "presented" : "dismissed";
  // Until the enter frame flips us to "entered", render the "dismissed" (off-screen)
  // start state so the transition has somewhere to animate FROM.
  const renderState: "presented" | "dismissed" =
    phase === "entered" ? "presented" : phase === "entering" ? "dismissed" : "dismissed";

  const onTransitionEnd = React.useCallback(
    (e: React.TransitionEvent) => {
      // Only react to the animated node's own transform/opacity, not bubbled ones.
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== "transform" && e.propertyName !== "opacity") return;
      // Resolve the exit: unmount + onDismiss exactly when the exit transition ends.
      setPhase((prev) => {
        if (prev === "exiting") {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          setMounted(false);
          onDismissRef.current?.();
          return "exited";
        }
        if (prev === "entering") return "entered";
        return prev;
      });
    },
    [],
  );

  return {
    mounted: isPresented || mounted,
    phase,
    dataState: renderState,
    reduceMotion,
    surfaceProps: { "data-state": dataState, onTransitionEnd },
  };
}

/** Map an AnimationToken name to its settling ms (the safety-timer fallback). */
function settlingMsFor(anim: AnimationToken): number {
  if (typeof anim === "string") {
    switch (anim) {
      case "snappy":
        return 697;
      case "bouncy":
        return 819;
      case "spring":
        return 689;
      case "interactiveSpring":
        return 210;
      case "smooth":
      case "default":
      default:
        return 735;
    }
  }
  return 735;
}

/* ===========================================================================
 * 3. useDismiss — mirrors @Environment(\.dismiss) (§9.3)
 * ======================================================================== */

const DismissContext = React.createContext<() => void>(() => {});

/** Provider that publishes a `dismiss()` to the presented subtree. */
export function DismissProvider({
  dismiss,
  children,
}: {
  dismiss: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <DismissContext.Provider value={dismiss}>{children}</DismissContext.Provider>
  );
}

/**
 * `useDismiss()` — any child inside a presentation calls it to close the
 * presentation (sets the controlling binding false). Mirrors SwiftUI's
 * `@Environment(\.dismiss) var dismiss`.
 */
export function useDismiss(): () => void {
  return React.useContext(DismissContext);
}

/* ===========================================================================
 * 4. <Scrim/> — the dimming layer (§9.4)
 * ======================================================================== */

export interface ScrimProps {
  /** Target opacity at rest (default 0.4 for sheets, 0.3 for alerts). */
  opacity?: number;
  /** Whether the scrim has entered (drives the cross-fade). */
  presented: boolean;
  /**
   * `presentationBackgroundInteraction`: when interactive, the scrim is transparent
   * and lets pointer events pass to the background (no block). Default false.
   */
  interactive?: boolean;
  /** Tap handler (scrim-tap dismiss); no-op when `interactive`. */
  onTap?: () => void;
  /** The CSS transition string for the cross-fade. */
  transition?: string;
  /** z-index (defaults to inheriting the parent host stacking). */
  style?: React.CSSProperties;
  className?: string;
}

/**
 * The dimming layer behind a modal. Cross-fades `0 → opacity` keyed on `presented`.
 * When `interactive` it becomes a transparent passthrough (mirrors
 * `presentationBackgroundInteraction(.enabled)`).
 */
export const Scrim = React.forwardRef<HTMLDivElement, ScrimProps>(function Scrim(
  { opacity = 0.4, presented, interactive = false, onTap, transition, style, className },
  ref,
) {
  return (
    <div
      ref={ref}
      className={className}
      data-state={presented ? "presented" : "dismissed"}
      data-interactive={interactive ? "true" : "false"}
      onClick={interactive ? undefined : onTap}
      style={{
        position: "absolute",
        inset: 0,
        background: interactive ? "transparent" : "rgba(0,0,0,1)",
        opacity: interactive ? 0 : presented ? opacity : 0,
        pointerEvents: interactive ? "none" : "auto",
        transition: transition ?? "opacity 0.735s var(--sui-anim-smooth-css)",
        ...style,
      }}
    />
  );
});

/* ===========================================================================
 * 5. Focus trap + Esc wiring (§9.5)
 * ======================================================================== */

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab focus inside `containerRef` while `active`, restore focus to the
 * previously-focused element on deactivate, and (optionally) wire Esc → `onEscape`.
 * Mirrors the a11y contract every SwiftUI `aria-modal` presentation needs.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  options?: { onEscape?: () => void; autoFocus?: boolean },
): void {
  const escRef = React.useRef(options?.onEscape);
  escRef.current = options?.onEscape;
  const autoFocus = options?.autoFocus ?? true;

  React.useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container || typeof document === "undefined") return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog (first focusable, else the container itself).
    if (autoFocus) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? container).focus({ preventScroll: true });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (escRef.current) {
          e.preventDefault();
          escRef.current();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Restore focus to the trigger on close.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, autoFocus]);
}

/* ===========================================================================
 * 6. Portal wrapper — render `children` into the singleton host.
 * ======================================================================== */

/**
 * Render `children` into the presentation portal host. Returns `null` on the
 * server / before the host exists (SSR-safe). The wrapper div re-enables pointer
 * events (the host disables them so non-presented regions stay click-through).
 */
export function PresentationPortal({
  children,
  zIndex = PRESENTATION_Z.sheet,
  pointerEvents = true,
}: {
  children: React.ReactNode;
  zIndex?: number;
  pointerEvents?: boolean;
}): React.JSX.Element | null {
  const host = usePresentationPortal();
  if (!host) return null;
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        pointerEvents: pointerEvents ? "auto" : "none",
      }}
    >
      {children}
    </div>,
    host,
  );
}

/* ===========================================================================
 * 7. useControllableBoolean — bridge a Binding<Bool> (value+onChange).
 * ======================================================================== */

/**
 * Normalize a SwiftUI `Binding<Bool>` to a `[value, setFalse]` pair. The component
 * is controlled (the parent owns `isPresented`); `setFalse` calls `onChange(false)`.
 */
export function useBindingDismiss(
  onChange?: (next: boolean) => void,
): () => void {
  const ref = React.useRef(onChange);
  ref.current = onChange;
  return React.useCallback(() => ref.current?.(false), []);
}
