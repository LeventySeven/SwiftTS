"use client";
/**
 * Matched geometry — SwiftUI's `.matchedGeometryEffect(id:in:)` and
 * `.matchedTransitionSource(id:in:)`, ported to a FLIP shared-element transition.
 *
 * SwiftUI authoritative API (arm64e-apple-macos.swiftinterface):
 *   @propertyWrapper struct Namespace { struct ID: Hashable }              (SwiftUI:1955)
 *   View.matchedGeometryEffect<ID>(id:, in namespace:, properties: = .frame,
 *                                  anchor: = .center, isSource: = true)     (SwiftUI:2974)
 *   struct MatchedGeometryProperties { position, size, frame }             (SwiftUI:2955)
 *   View.matchedTransitionSource(id:, in namespace:)                       (SwiftUI:14537)
 *
 * How SwiftUI does it. Two views in the SAME namespace with the SAME `id` are
 * declared geometrically identical: when one disappears and the other appears
 * (across a state change inside `withAnimation`), SwiftUI interpolates the
 * frame/position/size of the *destination* from the *source*'s last frame. The
 * `isSource: true` view defines the reference geometry; `isSource: false` adopts it.
 *
 * The web equivalent is the FLIP technique (First-Last-Invert-Play):
 *   1. FIRST  — record the source element's bounding box before the swap.
 *   2. LAST   — after the destination mounts, read its bounding box.
 *   3. INVERT — apply a transform (translate + scale) that maps Last→First, so the
 *               destination visually starts exactly where the source was.
 *   4. PLAY   — animate the transform to identity (transition the transform), so it
 *               glides from the source's frame into its own.
 *
 *   - `MatchedGeometryNamespace` (React context) is the `@Namespace`: it stores the
 *     last-known rect per `id` (written by `isSource` elements).
 *   - `useMatchedGeometry(id, namespace, { isSource, properties, anchor })` returns
 *     props (ref + style) that record geometry (source) or run the FLIP (non-source).
 *   - `matchedTransitionSource(id, namespace)` is the source-only convenience.
 *
 * SSR-safe: rect reads + transforms happen in layout effects (client only). The
 * module renders nothing on the server. "use client".
 */
import * as React from "react";
import { springCss, type AnimationToken, type SpringPresetName } from "./animation";

/**
 * Narrow a broad `AnimationToken` to the preset name `springCss` accepts. The FLIP
 * only needs the curve+duration of a spring preset; object-form tokens (custom
 * spring/timingCurve/wrapped) fall back to `"smooth"`, the iOS default for shared-
 * element transitions.
 */
function resolvePreset(tok?: AnimationToken): SpringPresetName | "default" | "smooth" {
  const PRESETS: ReadonlyArray<string> = [
    "default",
    "smooth",
    "snappy",
    "bouncy",
    "spring",
    "interactiveSpring",
  ];
  if (typeof tok === "string" && PRESETS.includes(tok)) {
    return tok as SpringPresetName | "default" | "smooth";
  }
  return "smooth";
}

/* =============================================================================
 * MatchedGeometryProperties — `struct MatchedGeometryProperties` (SwiftUI:2955)
 * ========================================================================== */

/** `SwiftUI.MatchedGeometryProperties` — which geometry channels to match. */
export type MatchedGeometryProperty = "position" | "size" | "frame";

/** `UnitPoint` anchor (the reference point the geometry is matched against). */
export interface MatchAnchor {
  x: number;
  y: number;
}

const ANCHOR_CENTER: MatchAnchor = { x: 0.5, y: 0.5 };

/* =============================================================================
 * Namespace — `@Namespace` (SwiftUI:1955)
 * ========================================================================== */

interface StoredRect {
  rect: DOMRect;
  /** monotonic version so the consumer only flips against the latest source. */
  version: number;
}

export interface MatchedGeometryNamespaceValue {
  /** Internal id used to scope ids to this namespace instance. */
  readonly id: string;
  /** Record the last-known rect of a source element for `key`. */
  record: (key: string, rect: DOMRect) => void;
  /** Read the last-known source rect for `key` (or `undefined`). */
  read: (key: string) => StoredRect | undefined;
}

const MatchedGeometryContext = React.createContext<MatchedGeometryNamespaceValue | null>(null);

let NAMESPACE_SEQ = 0;

/**
 * `@Namespace`. Create one with `useNamespace()` and pass it to
 * `<MatchedGeometryNamespace value={ns}>`, OR just wrap a subtree in
 * `<MatchedGeometryNamespace>` (it creates its own). Every `matchedGeometryEffect`
 * with the same `id` inside the same namespace shares geometry.
 */
export function MatchedGeometryNamespace({
  value,
  children,
}: {
  value?: MatchedGeometryNamespaceValue;
  children: React.ReactNode;
}): React.ReactElement {
  const own = useNamespace();
  const ns = value ?? own;
  return React.createElement(MatchedGeometryContext.Provider, { value: ns }, children);
}

/** Allocate a `@Namespace` value (stable across renders). */
export function useNamespace(): MatchedGeometryNamespaceValue {
  const store = React.useRef(new Map<string, StoredRect>());
  const idRef = React.useRef<string>("");
  if (!idRef.current) idRef.current = `mgns-${++NAMESPACE_SEQ}`;
  const versionRef = React.useRef(0);

  return React.useMemo<MatchedGeometryNamespaceValue>(
    () => ({
      id: idRef.current,
      record: (key, rect) => {
        store.current.set(key, { rect, version: ++versionRef.current });
      },
      read: (key) => store.current.get(key),
    }),
    [],
  );
}

/** Read the enclosing namespace (or throw if none). */
export function useMatchedGeometryNamespace(): MatchedGeometryNamespaceValue {
  const ns = React.useContext(MatchedGeometryContext);
  if (ns == null) {
    throw new Error(
      "useMatchedGeometry requires a <MatchedGeometryNamespace> ancestor (the @Namespace).",
    );
  }
  return ns;
}

/* =============================================================================
 * useMatchedGeometry — `.matchedGeometryEffect(id:in:)` (SwiftUI:2974)
 * ========================================================================== */

export interface UseMatchedGeometryOptions {
  /** ⇄ `isSource:` (default `true`). The source defines the reference frame. */
  isSource?: boolean;
  /** ⇄ `properties:` (default `.frame` → position + size). */
  properties?: MatchedGeometryProperty;
  /** ⇄ `anchor:` (default `.center`). */
  anchor?: MatchAnchor;
  /**
   * The animation that PLAYs the FLIP (the transform→identity transition). Use the
   * same `AnimationToken` you'd pass to `withAnimation`. Default: a smooth spring.
   */
  animation?: AnimationToken;
  /** Skip the effect (e.g. reduce-motion). When true, no transform is applied. */
  disabled?: boolean;
}

export interface MatchedGeometryProps<E extends HTMLElement = HTMLElement> {
  ref: React.RefCallback<E>;
  style: React.CSSProperties;
  "data-matched-id": string;
  "data-matched-source": "" | undefined;
}

/**
 * `.matchedGeometryEffect(id:in:)`. Returns props to spread on the element.
 *
 *   - When `isSource` is true: records the element's bounding box into the
 *     namespace on every layout (so a later non-source can flip against it).
 *   - When `isSource` is false: on mount, reads the recorded source rect and runs
 *     the FLIP — it starts the element transformed to the source's frame, then
 *     animates the transform to identity using `animation`.
 *
 * `properties` selects which channels are matched: `.position` animates only the
 * translate, `.size` only the scale, `.frame` both.
 */
export function useMatchedGeometry<E extends HTMLElement = HTMLElement>(
  id: string | number,
  namespace?: MatchedGeometryNamespaceValue,
  options: UseMatchedGeometryOptions = {},
): MatchedGeometryProps<E> {
  const ctxNs = React.useContext(MatchedGeometryContext);
  const ns = namespace ?? ctxNs;
  if (ns == null) {
    throw new Error(
      "useMatchedGeometry needs a namespace — pass one or wrap in <MatchedGeometryNamespace>.",
    );
  }

  const {
    isSource = true,
    properties = "frame",
    anchor = ANCHOR_CENTER,
    animation,
    disabled = false,
  } = options;

  const key = `${ns.id}:${String(id)}`;
  const elRef = React.useRef<E | null>(null);
  const [transform, setTransform] = React.useState<string | undefined>(undefined);
  const [transition, setTransition] = React.useState<string | undefined>(undefined);

  const setRef = React.useCallback<React.RefCallback<E>>((el) => {
    elRef.current = el;
  }, []);

  // SOURCE: record geometry after layout so non-sources can read it.
  useIsomorphicLayoutEffect(() => {
    if (!isSource || disabled) return;
    const el = elRef.current;
    if (!el) return;
    ns.record(key, el.getBoundingClientRect());
  });

  // NON-SOURCE: run the FLIP on mount.
  useIsomorphicLayoutEffect(() => {
    if (isSource || disabled) return;
    const el = elRef.current;
    if (!el) return;
    const stored = ns.read(key);
    if (!stored) return; // nothing to match — appear normally

    // LAST: where the destination actually is now.
    const last = el.getBoundingClientRect();
    const first = stored.rect;
    if (last.width === 0 || last.height === 0) return;

    // INVERT: transform that maps Last→First (so it starts at the source frame).
    const ax = anchor.x;
    const ay = anchor.y;
    const firstAnchorX = first.left + first.width * ax;
    const firstAnchorY = first.top + first.height * ay;
    const lastAnchorX = last.left + last.width * ax;
    const lastAnchorY = last.top + last.height * ay;

    const dx = firstAnchorX - lastAnchorX;
    const dy = firstAnchorY - lastAnchorY;
    const sx = first.width / last.width;
    const sy = first.height / last.height;

    const parts: string[] = [];
    if (properties === "position" || properties === "frame") {
      parts.push(`translate(${dx}px, ${dy}px)`);
    }
    if (properties === "size" || properties === "frame") {
      parts.push(`scale(${sx}, ${sy})`);
    }
    const invert = parts.join(" ") || "translate(0,0)";

    // FIRST paint: snap to inverted with NO transition.
    setTransition("none");
    setTransform(invert);
    el.style.transformOrigin = `${ax * 100}% ${ay * 100}%`;

    // PLAY: next frame, transition transform back to identity.
    const raf = requestAnimationFrame(() => {
      setTransition(springCss(resolvePreset(animation), { property: "transform" }));
      setTransform("none");
    });
    return () => cancelAnimationFrame(raf);
    // run once per mount/id change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const style: React.CSSProperties = {
    transform,
    transition,
    // keep transformOrigin in sync for the size match
    transformOrigin: `${anchor.x * 100}% ${anchor.y * 100}%`,
    willChange: transform && transform !== "none" ? "transform" : undefined,
  };

  return {
    ref: setRef,
    style,
    "data-matched-id": String(id),
    "data-matched-source": isSource ? "" : undefined,
  };
}

/* =============================================================================
 * matchedTransitionSource — `.matchedTransitionSource(id:in:)` (SwiftUI:14537)
 * ========================================================================== */

/**
 * `.matchedTransitionSource(id:in:)`. The source-only convenience: marks an
 * element as the geometric origin for a zoom/navigation transition with the same
 * `id`. Equivalent to `useMatchedGeometry(id, ns, { isSource: true })`.
 */
export function useMatchedTransitionSource<E extends HTMLElement = HTMLElement>(
  id: string | number,
  namespace?: MatchedGeometryNamespaceValue,
): MatchedGeometryProps<E> {
  return useMatchedGeometry<E>(id, namespace, { isSource: true });
}

/** Alias matching the SwiftUI modifier name. */
export const matchedTransitionSource = useMatchedTransitionSource;

/* =============================================================================
 * Layout-effect shim (SSR-safe useLayoutEffect)
 * ========================================================================== */

/** `useLayoutEffect` that falls back to `useEffect` on the server (no warning). */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export { MatchedGeometryContext };
