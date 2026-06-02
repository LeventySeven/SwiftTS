"use client";
/* =============================================================================
 * events.ts — SwiftUI's environment / publisher / scroll event modifiers,
 * ported to React hooks.
 *
 * SwiftUI authoritative API (arm64e-apple-macos.swiftinterface):
 *   View.onOpenURL(perform action: @escaping (URL) -> ())                  (SwiftUI:2609)
 *   View.onReceive<P>(_ publisher: P, perform action: (P.Output) -> Void)  (SwiftUI:2825)
 *        where P : Combine.Publisher, P.Failure == Never
 *   View.onScrollGeometryChange<T>(for:, of transform: (ScrollGeometry)->T,
 *        action: (oldValue: T, newValue: T) -> Void) where T: Equatable    (SwiftUI:13390)
 *   View.onScrollPhaseChange(_ action: (oldPhase: ScrollPhase,
 *        newPhase: ScrollPhase) -> Void)                                    (SwiftUI:13384)
 *   View.onScrollVisibilityChange(threshold: Double = 0.5,
 *        _ action: (Bool) -> Void)                                         (SwiftUI:4889)
 *   View.onModifierKeysChanged(mask: EventModifiers = .all, initial: = true,
 *        _ action: (old: EventModifiers, new: EventModifiers) -> Void)      (SwiftUI:8608)
 *
 * Supporting value types (SwiftUICore):
 *   enum ScrollPhase { idle, tracking, interacting, decelerating, animating } (SwiftUICore:625)
 *     var isScrolling: Bool
 *   struct ScrollGeometry { contentOffset:CGPoint, contentSize:CGSize,
 *     contentInsets:EdgeInsets, containerSize:CGSize, visibleRect, bounds }   (SwiftUICore:237)
 *   struct EventModifiers : OptionSet { capsLock, shift, control, option,
 *     command, numericPad, function, all }                                   (SwiftUICore:213)
 *
 * The web mapping.
 *   - onOpenURL → there is no system URL-open on the web, so we expose a typed
 *     "URL channel": a global EventTarget that the app dispatches deep-link /
 *     navigation URLs onto (also wired to `hashchange`/`popstate` so in-app
 *     navigation surfaces as an onOpenURL the way a Universal Link would on iOS).
 *   - onReceive → Combine publishers become any of: an EventTarget (+ event name),
 *     a minimal Observable (`subscribe(fn) -> unsubscribe`), or an RxJS-style
 *     `{ subscribe }`. One generic hook subscribes on appear and tears down on
 *     disappear, exactly like `.onReceive` lives for the view's lifetime.
 *   - onScrollGeometryChange / onScrollPhaseChange / onScrollVisibilityChange →
 *     a `scroll` listener on the nearest scroll container derives a ScrollGeometry
 *     and a ScrollPhase (with an idle-timeout to detect the end of momentum), and
 *     an IntersectionObserver drives the visibility callback. All three gate on
 *     `Object.is` change (SwiftUI's `Equatable`).
 *   - onModifierKeysChanged → global keydown/keyup/blur listeners track the live
 *     EventModifiers set and fire `(old, new)` on any change in the masked bits.
 *
 * SSR-safe: every listener/observer is created inside an effect (client only);
 * nothing touches `window`/`document` at module scope. "use client".
 * ========================================================================== */
import * as React from "react";

/* =============================================================================
 * 1. EventModifiers — the OptionSet, as a flag bag + DOM bridge
 * ========================================================================== */

/** `SwiftUICore.EventModifiers` (SwiftUICore:213) as individual booleans. */
export interface EventModifiers {
  capsLock: boolean;
  shift: boolean;
  control: boolean;
  option: boolean;
  command: boolean;
  numericPad: boolean;
  function: boolean;
}

/** The empty modifier set. */
export const EVENT_MODIFIERS_NONE: EventModifiers = {
  capsLock: false,
  shift: false,
  control: false,
  option: false,
  command: false,
  numericPad: false,
  function: false,
};

/** Which `EventModifiers` keys the `.all` mask covers (everything but capsLock/numericPad are the "interesting" four; `.all` is every bit). */
export type EventModifierKey = keyof EventModifiers;

/** `.all` — every modifier bit is in the mask (SwiftUI default for the change mask). */
export const EVENT_MODIFIERS_ALL: readonly EventModifierKey[] = [
  "capsLock",
  "shift",
  "control",
  "option",
  "command",
  "numericPad",
  "function",
];

/** Read the live `EventModifiers` set off any DOM keyboard/mouse/pointer event. */
export function eventModifiersFrom(
  e: Pick<KeyboardEvent, "shiftKey" | "ctrlKey" | "altKey" | "metaKey" | "getModifierState">,
): EventModifiers {
  const get = (name: string): boolean =>
    typeof e.getModifierState === "function" ? e.getModifierState(name) : false;
  return {
    capsLock: get("CapsLock"),
    shift: e.shiftKey,
    control: e.ctrlKey,
    option: e.altKey,
    command: e.metaKey,
    numericPad: get("NumLock"),
    function: get("Fn") || get("FnLock"),
  };
}

/** True when two modifier sets differ on any bit named in `mask`. */
function modifiersDiffer(
  a: EventModifiers,
  b: EventModifiers,
  mask: readonly EventModifierKey[],
): boolean {
  for (const k of mask) {
    if (a[k] !== b[k]) return true;
  }
  return false;
}

/* =============================================================================
 * 2. onOpenURL — `.onOpenURL(perform:)` (SwiftUI:2609)
 *
 * The web has no OS "open this app with a URL" callback, so we model the iOS deep
 * link / Universal Link channel as a global EventTarget. The app dispatches a URL
 * onto it (e.g. from a custom-scheme handler, a service-worker message, or a
 * router) via `dispatchOpenURL(url)`, and any mounted `useOnOpenURL` fires. We
 * also auto-bridge same-document navigation (`hashchange` + `popstate`) so that
 * an in-app route change surfaces as an onOpenURL, the way tapping a Universal
 * Link does on iOS.
 * ========================================================================== */

/** The detail carried on a `sui:openurl` CustomEvent. */
export interface OpenURLDetail {
  url: URL;
}

const OPEN_URL_EVENT = "sui:openurl";

/** Lazily-created module-global channel; one per document. */
function openURLChannel(): EventTarget | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __suiOpenURLChannel?: EventTarget };
  if (!w.__suiOpenURLChannel) w.__suiOpenURLChannel = new EventTarget();
  return w.__suiOpenURLChannel ?? null;
}

/** Coerce a string/URL into a `URL` against the current document origin. */
function toURL(url: string | URL): URL | null {
  try {
    if (url instanceof URL) return url;
    const base =
      typeof window !== "undefined" ? window.location.href : "http://localhost/";
    return new URL(url, base);
  } catch {
    return null;
  }
}

/**
 * Imperatively deliver a URL to every mounted `useOnOpenURL` (the `.onOpenURL`
 * analog's producer side). Call this from your custom-scheme handler, push
 * notification click, service-worker `message`, or router. No-op on the server.
 */
export function dispatchOpenURL(url: string | URL): void {
  const channel = openURLChannel();
  const parsed = toURL(url);
  if (!channel || !parsed) return;
  channel.dispatchEvent(
    new CustomEvent<OpenURLDetail>(OPEN_URL_EVENT, { detail: { url: parsed } }),
  );
}

export interface UseOnOpenURLOptions {
  /**
   * Also fire `action` for same-document navigation: `hashchange` + `popstate`
   * (the current `window.location.href` is passed as the URL). Default `true` —
   * mirrors how a Universal Link / in-app route change reaches `.onOpenURL`.
   */
  bridgeNavigation?: boolean;
}

/**
 * `.onOpenURL(perform:)`. Runs `action(url)` whenever a URL is delivered to the
 * channel (via `dispatchOpenURL`) or — when `bridgeNavigation` (default) — when
 * the document navigates in-place (`hashchange`/`popstate`). Lives for the view's
 * lifetime: subscribes on appear, unsubscribes on disappear. The latest `action`
 * is held in a ref so it can close over fresh state without re-subscribing.
 */
export function useOnOpenURL(
  action: (url: URL) => void,
  options: UseOnOpenURLOptions = {},
): void {
  const actionRef = React.useRef(action);
  actionRef.current = action;
  const bridge = options.bridgeNavigation ?? true;

  React.useEffect(() => {
    const channel = openURLChannel();
    if (!channel) return;
    const onChannel = (e: Event) => {
      const detail = (e as CustomEvent<OpenURLDetail>).detail;
      if (detail?.url) actionRef.current(detail.url);
    };
    channel.addEventListener(OPEN_URL_EVENT, onChannel);

    let onNav: (() => void) | undefined;
    if (bridge && typeof window !== "undefined") {
      onNav = () => {
        const u = toURL(window.location.href);
        if (u) actionRef.current(u);
      };
      window.addEventListener("hashchange", onNav);
      window.addEventListener("popstate", onNav);
    }

    return () => {
      channel.removeEventListener(OPEN_URL_EVENT, onChannel);
      if (onNav && typeof window !== "undefined") {
        window.removeEventListener("hashchange", onNav);
        window.removeEventListener("popstate", onNav);
      }
    };
  }, [bridge]);
}

/* =============================================================================
 * 3. onReceive — `.onReceive(_:perform:)` (SwiftUI:2825)
 *
 * Combine's `Publisher` has no single web type, so we accept the three shapes a
 * web "publisher" actually takes and normalize them to one subscribe primitive:
 *   - DOM EventTarget   → `useOnReceive(target, handler, { eventName })`
 *   - Observable        → `{ subscribe(next) -> teardown }`        (minimal)
 *   - RxJS-style        → `{ subscribe({ next }) -> { unsubscribe } }`
 * The subscription lives for the view's lifetime (appear → disappear).
 * ========================================================================== */

/** A minimal Combine-`Publisher` analog: subscribe a `next` callback, get a teardown. */
export interface SwiftObservable<T> {
  subscribe(next: (value: T) => void): (() => void) | { unsubscribe(): void };
}

/** An RxJS-style observable: `subscribe({ next }) -> Subscription`. */
export interface RxLikeObservable<T> {
  subscribe(observer: { next?: (value: T) => void }): { unsubscribe(): void };
}

/** Anything `useOnReceive` accepts as the publisher. */
export type ReceivePublisher<T> =
  | EventTarget
  | SwiftObservable<T>
  | RxLikeObservable<T>;

export interface UseOnReceiveOptions {
  /** Required when the publisher is a DOM `EventTarget`: which event to listen for. */
  eventName?: string;
  /** `addEventListener` options for the EventTarget case. */
  listenerOptions?: AddEventListenerOptions;
}

function isEventTarget(p: unknown): p is EventTarget {
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as EventTarget).addEventListener === "function" &&
    typeof (p as EventTarget).removeEventListener === "function"
  );
}

function isSubscribable(p: unknown): p is { subscribe: Function } {
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as { subscribe?: unknown }).subscribe === "function"
  );
}

/**
 * `.onReceive(publisher, perform: action)`. Subscribes to `publisher` on appear
 * and delivers each emitted value to `action`; unsubscribes on disappear (or when
 * the publisher identity changes). Works with a DOM `EventTarget` (pass
 * `{ eventName }` — the raw `Event` is delivered), a minimal `{ subscribe }`
 * observable, or an RxJS-style observable. The latest `action` is ref-held so it
 * never forces a re-subscribe.
 *
 * @param publisher  EventTarget | SwiftObservable<T> | RxLikeObservable<T>.
 * @param action     fired with each emitted value (the `Event` for EventTargets).
 * @param options    `{ eventName, listenerOptions }` — eventName required for EventTargets.
 */
export function useOnReceive<T>(
  publisher: ReceivePublisher<T> | null | undefined,
  action: (value: T) => void,
  options: UseOnReceiveOptions = {},
): void {
  const actionRef = React.useRef(action);
  actionRef.current = action;
  const { eventName, listenerOptions } = options;

  React.useEffect(() => {
    if (!publisher) return;

    // DOM EventTarget branch.
    if (isEventTarget(publisher) && eventName) {
      const handler = (e: Event) => actionRef.current(e as unknown as T);
      publisher.addEventListener(eventName, handler, listenerOptions);
      return () => publisher.removeEventListener(eventName, handler, listenerOptions);
    }

    // Observable branch (both minimal and RxJS-style).
    if (isSubscribable(publisher)) {
      // RxJS observers want an object (`{ next }`); minimal observables want a
      // function. Pass an argument that is BOTH — a callable carrying a `.next` —
      // so whichever convention the publisher uses, our `action` is reached.
      const observer = Object.assign((value: T) => actionRef.current(value), {
        next: (value: T) => actionRef.current(value),
      });
      // The two accepted shapes have incompatible `subscribe` signatures, so the
      // call site is typed `any` (heterogeneous publisher); the runtime handles both.
      const subscribe = (publisher as { subscribe: (arg: unknown) => unknown }).subscribe;
      const sub: unknown = subscribe.call(publisher, observer);
      return () => {
        if (typeof sub === "function") {
          (sub as () => void)();
        } else if (
          sub &&
          typeof (sub as { unsubscribe?: unknown }).unsubscribe === "function"
        ) {
          (sub as { unsubscribe(): void }).unsubscribe();
        }
      };
    }

    return;
    // re-subscribe only when the publisher identity / event name changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publisher, eventName]);
}

/* =============================================================================
 * 4. ScrollGeometry / ScrollPhase — the value types the scroll hooks emit
 * ========================================================================== */

/** `SwiftUICore.ScrollGeometry` (SwiftUICore:237), derived from a scroll container. */
export interface ScrollGeometry {
  /** `contentOffset` — the scroll position (scrollLeft/scrollTop). */
  contentOffset: { x: number; y: number };
  /** `contentSize` — the full scrollable extent (scrollWidth/scrollHeight). */
  contentSize: { width: number; height: number };
  /** `containerSize` — the visible viewport (clientWidth/clientHeight). */
  containerSize: { width: number; height: number };
  /** `contentInsets` — scroll padding (read from computed style). */
  contentInsets: { top: number; left: number; bottom: number; right: number };
  /** `visibleRect` — the content rect currently visible (= offset → offset+container). */
  visibleRect: { x: number; y: number; width: number; height: number };
  /** `bounds` — `(0, 0, containerSize)`. */
  bounds: { x: number; y: number; width: number; height: number };
}

/** `SwiftUICore.ScrollPhase` (SwiftUICore:625). */
export type ScrollPhase =
  | "idle"
  | "tracking"
  | "interacting"
  | "decelerating"
  | "animating";

/** `ScrollPhase.isScrolling` — true for every phase except `idle`. */
export function scrollPhaseIsScrolling(phase: ScrollPhase): boolean {
  return phase !== "idle";
}

/** Read a `ScrollGeometry` off a scroll-container element. */
function readScrollGeometry(el: HTMLElement): ScrollGeometry {
  const cs = typeof getComputedStyle !== "undefined" ? getComputedStyle(el) : null;
  const px = (v: string | undefined) => (v ? parseFloat(v) || 0 : 0);
  const offset = { x: el.scrollLeft, y: el.scrollTop };
  const container = { width: el.clientWidth, height: el.clientHeight };
  return {
    contentOffset: offset,
    contentSize: { width: el.scrollWidth, height: el.scrollHeight },
    containerSize: container,
    contentInsets: {
      top: px(cs?.scrollPaddingTop ?? cs?.paddingTop),
      left: px(cs?.scrollPaddingLeft ?? cs?.paddingLeft),
      bottom: px(cs?.scrollPaddingBottom ?? cs?.paddingBottom),
      right: px(cs?.scrollPaddingRight ?? cs?.paddingRight),
    },
    visibleRect: { x: offset.x, y: offset.y, width: container.width, height: container.height },
    bounds: { x: 0, y: 0, width: container.width, height: container.height },
  };
}

/** Resolve the element to attach scroll listeners to (the ref, or the window scroller). */
function resolveScroller(
  ref: React.RefObject<HTMLElement | null> | null | undefined,
): HTMLElement | null {
  if (ref?.current) return ref.current;
  if (typeof document !== "undefined") return document.scrollingElement as HTMLElement | null;
  return null;
}

/** The scroll-event source for a scroller (window when it's the page scroller). */
function scrollEventSource(el: HTMLElement): EventTarget {
  if (typeof document !== "undefined" && el === document.scrollingElement) return window;
  return el;
}

/** Default ms of scroll silence after which the phase returns to `idle`. */
const SCROLL_IDLE_MS = 120;

/* =============================================================================
 * 5. onScrollGeometryChange — `.onScrollGeometryChange(for:of:action:)` (SwiftUI:13390)
 * ========================================================================== */

/**
 * `.onScrollGeometryChange(for:of:action:)`. Watches the scroll container at
 * `ref` (or the page scroller when `ref` is null), derives a value `T` from its
 * `ScrollGeometry` via `transform`, and fires `action(oldValue, newValue)`
 * whenever that derived value changes (gated by `Object.is`, the JS analog of
 * SwiftUI's `Equatable`). Also re-measures on container resize.
 *
 * @param ref        the scroll container, or `null` for the page scroller.
 * @param transform  derive the watched value from the ScrollGeometry.
 * @param action     fired with `(old, new)` on change.
 */
export function useOnScrollGeometryChange<T>(
  ref: React.RefObject<HTMLElement | null> | null,
  transform: (geometry: ScrollGeometry) => T,
  action: (oldValue: T, newValue: T) => void,
): void {
  const transformRef = React.useRef(transform);
  transformRef.current = transform;
  const actionRef = React.useRef(action);
  actionRef.current = action;

  React.useEffect(() => {
    const el = resolveScroller(ref);
    if (!el) return;
    const source = scrollEventSource(el);

    let last: { v: T } | null = null;
    const measure = () => {
      const next = transformRef.current(readScrollGeometry(el));
      if (last && Object.is(last.v, next)) return;
      const prev = last ? last.v : next;
      last = { v: next };
      actionRef.current(prev, next);
    };

    source.addEventListener("scroll", measure, { passive: true });
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }
    measure(); // seed `last` without firing a spurious (x,x) on first paint? — fire once to match initial.

    return () => {
      source.removeEventListener("scroll", measure);
      ro?.disconnect();
    };
  }, [ref]);
}

/* =============================================================================
 * 6. onScrollPhaseChange — `.onScrollPhaseChange(_:)` (SwiftUI:13384)
 * ========================================================================== */

/**
 * `.onScrollPhaseChange(_:)`. Tracks the scroll container's `ScrollPhase` and
 * fires `action(oldPhase, newPhase)` on every transition. The browser exposes no
 * native phase, so we synthesize it: the first `scroll` after silence enters
 * `interacting` (a user-driven scroll); continued scrolls stay `interacting`;
 * after `idleMs` of silence the phase returns to `idle`. (`tracking` /
 * `decelerating` / `animating` are reported when the caller drives them via the
 * imperative `setPhase` form is out of scope here — the synthesized model covers
 * the common idle↔interacting transitions used for sticky headers etc.)
 *
 * @param ref     the scroll container, or `null` for the page scroller.
 * @param action  fired with `(oldPhase, newPhase)` on every phase change.
 * @param idleMs  ms of scroll silence before returning to `idle` (default 120).
 */
export function useOnScrollPhaseChange(
  ref: React.RefObject<HTMLElement | null> | null,
  action: (oldPhase: ScrollPhase, newPhase: ScrollPhase) => void,
  idleMs: number = SCROLL_IDLE_MS,
): void {
  const actionRef = React.useRef(action);
  actionRef.current = action;

  React.useEffect(() => {
    const el = resolveScroller(ref);
    if (!el) return;
    const source = scrollEventSource(el);

    let phase: ScrollPhase = "idle";
    let timer: ReturnType<typeof setTimeout> | undefined;

    const setPhase = (next: ScrollPhase) => {
      if (phase === next) return;
      const prev = phase;
      phase = next;
      actionRef.current(prev, next);
    };

    const onScroll = () => {
      if (phase === "idle") setPhase("interacting");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setPhase("idle"), idleMs);
    };

    source.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      source.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [ref, idleMs]);
}

/* =============================================================================
 * 7. onScrollVisibilityChange — `.onScrollVisibilityChange(threshold:_:)` (SwiftUI:4889)
 * ========================================================================== */

/**
 * `.onScrollVisibilityChange(threshold:_:)`. Uses an `IntersectionObserver` to
 * fire `action(isVisible)` when the element at `ref` crosses `threshold` of its
 * area inside the scroll viewport. `threshold` defaults to `0.5` (SwiftUI's
 * default — visible once ≥ half on screen). Fires only on a CHANGE of the boolean.
 *
 * @param ref        the observed element (NOT the scroll container — the content).
 * @param action     fired with the new visibility boolean.
 * @param threshold  fraction of the element that must be visible (default 0.5).
 */
export function useOnScrollVisibilityChange(
  ref: React.RefObject<HTMLElement | null>,
  action: (isVisible: boolean) => void,
  threshold: number = 0.5,
): void {
  const actionRef = React.useRef(action);
  actionRef.current = action;

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let last: boolean | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const visible = entry.isIntersecting && entry.intersectionRatio >= threshold;
        if (last === visible) return;
        last = visible;
        actionRef.current(visible);
      },
      { threshold: clampThreshold(threshold) },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
}

/** IntersectionObserver thresholds must be in [0,1]; clamp and add 0 so a fully-off element also reports. */
function clampThreshold(t: number): number[] {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped <= 0 ? [0] : [0, clamped];
}

/* =============================================================================
 * 8. onModifierKeysChanged — `.onModifierKeysChanged(mask:initial:_:)` (SwiftUI:8608)
 * ========================================================================== */

export interface UseOnModifierKeysChangedOptions {
  /**
   * `mask:` — which modifier bits to watch. Default `EVENT_MODIFIERS_ALL`. A
   * change is only reported when a bit IN the mask flips.
   */
  mask?: readonly EventModifierKey[];
  /**
   * `initial:` (default `true`) — when true, fire once on appear with
   * `(none, currentModifiers)` so the callback sees the starting state, matching
   * SwiftUI's `initial: true` default.
   */
  initial?: boolean;
}

/**
 * `.onModifierKeysChanged(mask:initial:_:)`. Tracks the live `EventModifiers` set
 * via global `keydown`/`keyup` (and resets on `blur`, since key-up can be missed
 * when focus leaves), firing `action(old, new)` whenever a masked bit changes.
 * The signature SwiftUI ships is the two-param `(old, new)`; the single-arg form
 * `(keys) => …` is also accepted (we detect arity).
 *
 * @param action   `(old, new) => void` — or `(new) => void` (arity-detected).
 * @param options  `{ mask, initial }`.
 */
export function useOnModifierKeysChanged(
  action:
    | ((oldKeys: EventModifiers, newKeys: EventModifiers) => void)
    | ((keys: EventModifiers) => void),
  options: UseOnModifierKeysChangedOptions = {},
): void {
  const actionRef = React.useRef(action);
  actionRef.current = action;
  const mask = options.mask ?? EVENT_MODIFIERS_ALL;
  const initial = options.initial ?? true;
  // Snapshot the mask as a stable string key so the effect doesn't re-run on a
  // fresh-but-equal array literal each render.
  const maskKey = mask.join(",");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const maskArr = maskKey.split(",").filter(Boolean) as EventModifierKey[];
    let current: EventModifiers = { ...EVENT_MODIFIERS_NONE };

    const fire = (old: EventModifiers, next: EventModifiers) => {
      const fn = actionRef.current;
      // SwiftUI form is (old, new); a 1-arg callback only wants the new value.
      if (fn.length >= 2) (fn as (o: EventModifiers, n: EventModifiers) => void)(old, next);
      else (fn as (n: EventModifiers) => void)(next);
    };

    const update = (e: KeyboardEvent) => {
      const next = eventModifiersFrom(e);
      if (modifiersDiffer(current, next, maskArr)) {
        const old = current;
        current = next;
        fire(old, next);
      } else {
        current = next;
      }
    };

    const reset = () => {
      if (modifiersDiffer(current, EVENT_MODIFIERS_NONE, maskArr)) {
        const old = current;
        current = { ...EVENT_MODIFIERS_NONE };
        fire(old, current);
      } else {
        current = { ...EVENT_MODIFIERS_NONE };
      }
    };

    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("blur", reset);

    if (initial) fire({ ...EVENT_MODIFIERS_NONE }, current);

    return () => {
      window.removeEventListener("keydown", update);
      window.removeEventListener("keyup", update);
      window.removeEventListener("blur", reset);
    };
  }, [maskKey, initial]);
}
