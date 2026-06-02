"use client";
/**
 * `ScrollView` — SwiftUI Cluster C6 §1.
 *
 *   ScrollView(_ axes: Axis.Set = .vertical, content:)
 *   .scrollIndicators(_:axes:) / .scrollClipDisabled / .scrollDisabled
 *   .scrollBounceBehavior / .scrollTargetBehavior(.paging | .viewAligned)
 *   .scrollPosition(id:) / .contentMargins / .scrollDismissesKeyboard / .refreshable
 *
 * Layer-1 in the C6 mental model: pure clipping + offset + indicators + snap.
 * No row chrome — that belongs to `List`/`Table` (layer 2). Web = an
 * `overflow:auto` element + a CSS scroll-snap layer.
 *
 * `targetBehavior="viewAligned"` requires the snap children to carry
 * `className="sui-snap-target"` — use `<ScrollTargetLayout>` to inject it onto
 * each direct child (the web analogue of `.scrollTargetLayout()`).
 *
 * Client component — it owns scroll/refresh/position effects + handlers.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import { ScrollViewProxyContext, type ScrollViewProxy } from "./ScrollViewReader";
import "./ScrollView.global.css";

export type ScrollAxes = "vertical" | "horizontal" | "both";
export type ScrollIndicatorsVisibility = "automatic" | "visible" | "hidden";
export type ScrollBounceBehaviorName = "automatic" | "always" | "basedOnSize";

/**
 * `scrollInputBehavior(_:for:)` — whether a given scroll input drives the
 * scroller. `.automatic` defers to the platform, `.enabled` forces it on,
 * `.disabled` ignores that input. The macOS-relevant input kinds (`scrollWheel`
 * / `look` / `hand-gesture`) collapse on web to a single "can the wheel/pointer
 * scroll this view" switch — `.disabled` sets `overscroll-behavior: contain` +
 * suppresses wheel/touch scrolling without freezing programmatic scrolls.
 */
export type ScrollInputBehaviorName = "automatic" | "enabled" | "disabled";

/**
 * `ScrollTransitionConfiguration` — how a `scrollTransition` interpolates as an
 * item crosses the scroll edges. `.interactive` tracks the scroll 1:1,
 * `.animated` eases toward the identity phase, `.identity` disables it.
 */
export type ScrollTransitionConfigurationName = "interactive" | "animated" | "identity";

/**
 * `ScrollTransitionPhase` — the three phases SwiftUI hands the transition closure
 * (`topLeading` = entering from the leading edge, `identity` = fully in view,
 * `bottomTrailing` = leaving past the trailing edge). On web we map an item's
 * intersection ratio to a `0…1` `value` and a phase so a built-in or custom
 * effect can interpolate.
 */
export type ScrollTransitionPhase = "topLeading" | "identity" | "bottomTrailing";

/** A built-in `scrollTransition` effect applied to each transitioning child. */
export type ScrollTransitionEffectName = "fade" | "scale" | "fadeScale" | "blur";
export type ScrollTargetBehaviorName = "paging" | "viewAligned" | "none";
export type ViewAlignedLimitBehavior =
  | "automatic"
  | "always"
  | "alwaysByOne"
  | "alwaysByFew"
  | "never";
export type ScrollDismissesKeyboardMode =
  | "automatic"
  | "immediately"
  | "interactively"
  | "never";

/** `scrollContentBackground(_:)` — `.hidden` drops the scroller's own background. */
export type ScrollContentBackgroundVisibility = "automatic" | "visible" | "hidden";

/** `defaultScrollAnchor(_:)` — where the content settles when first shown / on growth. */
export type ScrollAnchorUnitPoint =
  | "top"
  | "center"
  | "bottom"
  | "leading"
  | "trailing"
  | "topLeading"
  | "topTrailing"
  | "bottomLeading"
  | "bottomTrailing";

export interface ScrollContentMargins {
  top?: number;
  leading?: number;
  bottom?: number;
  trailing?: number;
}

/** A controlled `scrollPosition(id:)` binding: `[id, setId]`. */
export type ScrollPositionBinding = [
  string | null | undefined,
  (id: string | null) => void,
];

export interface ScrollViewProps extends Omit<ViewProps, "as" | "onScroll"> {
  /** `Axis.Set`. Default `"vertical"`. */
  axes?: ScrollAxes;
  /** `scrollIndicators(_:)`. Default `"automatic"`. */
  indicators?: ScrollIndicatorsVisibility;
  /** `scrollClipDisabled(_:)` — let content bleed past the frame. */
  clipDisabled?: boolean;
  /** `scrollDisabled(_:)`. */
  disabled?: boolean;
  /** `scrollBounceBehavior(_:)`. */
  bounce?: ScrollBounceBehaviorName;
  /** `scrollTargetBehavior(_:)`. */
  targetBehavior?: ScrollTargetBehaviorName;
  /** `ViewAlignedScrollTargetBehavior.LimitBehavior`. */
  viewAlignedLimit?: ViewAlignedLimitBehavior;
  /** `contentMargins(_:)` / `_contentInsets`. */
  contentMargins?: ScrollContentMargins;
  /** `scrollDismissesKeyboard(_:)`. */
  dismissesKeyboard?: ScrollDismissesKeyboardMode;
  /** `scrollContentBackground(_:)` — `.hidden` makes the scroller transparent. */
  contentBackground?: ScrollContentBackgroundVisibility;
  /**
   * `scrollIndicatorsFlash(onAppear:)` / `scrollIndicatorsFlash(trigger:)` — briefly
   * flash the scroll indicators on mount (`true`) and whenever `trigger` changes.
   */
  indicatorsFlashOnAppear?: boolean;
  indicatorsFlashTrigger?: unknown;
  /**
   * `defaultScrollAnchor(_:)` — the resting anchor for the content. The common case
   * is `"bottom"` (chat logs that pin to the newest message). Applied once on mount
   * and re-applied when the content grows past the viewport.
   */
  defaultScrollAnchor?: ScrollAnchorUnitPoint;
  /** Reported scroll offset on every scroll event. */
  onScroll?: (offset: { x: number; y: number }) => void;
  /** Controlled `scrollPosition(id:)` — `[id, setId]`. */
  scrollPosition?: ScrollPositionBinding;
  /** Anchor for `scrollPosition(id:)` / proxy scrolls: maps to scrollIntoView block. */
  anchor?: "top" | "center" | "bottom";
  /** `refreshable(action:)` — pull-to-refresh async action. */
  refreshable?: () => Promise<void> | void;
  /**
   * `scrollInputBehavior(_:for:)` — whether wheel/pointer input drives this
   * scroller. `.disabled` ignores user scroll input (programmatic scrolls still
   * work); `.enabled`/`.automatic` keep the normal behavior.
   */
  scrollInputBehavior?: ScrollInputBehaviorName;
  /**
   * `scrollTransition(_:axis:transition:)` applied as a convenience to every
   * DIRECT child of the scroller: each child fades/scales as it nears the
   * leading/trailing edge, driven by an `IntersectionObserver` keyed to the
   * scroll viewport. Pass an effect name for the built-ins, or wrap individual
   * items in `<ScrollTransition>` for per-item control. Omitted ⇒ no transition.
   */
  scrollTransition?: ScrollTransitionEffectName;
  /** The `ScrollTransitionConfiguration` for the convenience `scrollTransition`. */
  scrollTransitionConfiguration?: ScrollTransitionConfigurationName;
  children?: React.ReactNode;
}

const PULL_THRESHOLD = 80; // pt — past this a release triggers refresh

function anchorToBlock(
  anchor: "top" | "center" | "bottom" | undefined,
): ScrollLogicalPosition {
  return anchor === "top"
    ? "start"
    : anchor === "bottom"
      ? "end"
      : anchor === "center"
        ? "center"
        : "nearest";
}

export const ScrollView = React.forwardRef<HTMLDivElement, ScrollViewProps>(
  function ScrollView(
    {
      axes = "vertical",
      indicators = "automatic",
      clipDisabled = false,
      disabled = false,
      bounce,
      targetBehavior = "none",
      viewAlignedLimit = "automatic",
      contentMargins,
      dismissesKeyboard,
      contentBackground,
      indicatorsFlashOnAppear = false,
      indicatorsFlashTrigger,
      defaultScrollAnchor,
      onScroll,
      scrollPosition,
      anchor,
      refreshable,
      scrollInputBehavior,
      scrollTransition,
      scrollTransitionConfiguration = "interactive",
      style,
      children,
      ...rest
    },
    forwardedRef,
  ) {
    const innerRef = React.useRef<HTMLDivElement | null>(null);
    const [flashing, setFlashing] = React.useState(false);
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const [refreshing, setRefreshing] = React.useState(false);
    const [pull, setPull] = React.useState(0);

    // ScrollViewReader proxy — scrollTo(id, anchor?) finds a [data-scroll-id] child.
    const proxy = React.useMemo<ScrollViewProxy>(
      () => ({
        scrollTo(id, scrollAnchor) {
          const container = innerRef.current;
          if (!container) return;
          const target = container.querySelector<HTMLElement>(
            `[data-scroll-id="${CSS.escape(String(id))}"]`,
          );
          if (!target) return;
          const block = anchorToBlock(scrollAnchor ?? anchor);
          target.scrollIntoView({ behavior: "smooth", block, inline: block });
        },
      }),
      [anchor],
    );

    // Controlled scrollPosition(id:) — scroll to the bound id on change.
    const positionId = scrollPosition?.[0];
    const setPositionId = scrollPosition?.[1];
    React.useEffect(() => {
      if (positionId == null) return;
      const container = innerRef.current;
      if (!container) return;
      const target = container.querySelector<HTMLElement>(
        `[data-scroll-id="${CSS.escape(String(positionId))}"]`,
      );
      target?.scrollIntoView({ block: anchorToBlock(anchor), inline: anchorToBlock(anchor) });
    }, [positionId, anchor]);

    // defaultScrollAnchor(_:) — settle the content at the anchor on mount. For a
    // `bottom`/`trailing` anchor (chat logs) we jump to the end of the scroll axis.
    React.useEffect(() => {
      if (!defaultScrollAnchor) return;
      const el = innerRef.current;
      if (!el) return;
      const vertical = axes !== "horizontal";
      const a = defaultScrollAnchor;
      const isEnd = a === "bottom" || a === "trailing" || a === "bottomLeading" || a === "bottomTrailing";
      const isStart = a === "top" || a === "leading" || a === "topLeading" || a === "topTrailing";
      const isCenter = a === "center";
      if (isEnd) {
        if (vertical) el.scrollTop = el.scrollHeight;
        else el.scrollLeft = el.scrollWidth;
      } else if (isCenter) {
        if (vertical) el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
        else el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      } else if (isStart) {
        if (vertical) el.scrollTop = 0;
        else el.scrollLeft = 0;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultScrollAnchor, axes]);

    // scrollIndicatorsFlash(onAppear:) / (trigger:) — flash the indicators briefly.
    const firstFlash = React.useRef(true);
    React.useEffect(() => {
      const onMount = firstFlash.current;
      firstFlash.current = false;
      // skip the mount run unless onAppear is requested; always run on trigger change.
      if (onMount && !indicatorsFlashOnAppear) return;
      setFlashing(true);
      const t = window.setTimeout(() => setFlashing(false), 700);
      return () => window.clearTimeout(t);
    }, [indicatorsFlashOnAppear, indicatorsFlashTrigger]);

    const handleScroll = React.useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        onScroll?.({ x: el.scrollLeft, y: el.scrollTop });
        // Report topmost visible [data-scroll-id] back through the binding.
        if (setPositionId) {
          const children = el.querySelectorAll<HTMLElement>("[data-scroll-id]");
          const top = el.getBoundingClientRect().top;
          for (const child of Array.from(children)) {
            if (child.getBoundingClientRect().bottom > top) {
              const id = child.getAttribute("data-scroll-id");
              if (id != null && id !== positionId) setPositionId(id);
              break;
            }
          }
        }
      },
      [onScroll, setPositionId, positionId],
    );

    // refreshable — overscroll-at-top pull-to-refresh.
    const pullStartY = React.useRef<number | null>(null);
    const onTouchStart = React.useCallback((e: React.TouchEvent) => {
      if (!innerRef.current || innerRef.current.scrollTop > 0) return;
      pullStartY.current = e.touches[0]?.clientY ?? null;
    }, []);
    const onTouchMove = React.useCallback(
      (e: React.TouchEvent) => {
        if (pullStartY.current == null || refreshing) return;
        const dy = (e.touches[0]?.clientY ?? 0) - pullStartY.current;
        if (dy > 0 && (innerRef.current?.scrollTop ?? 0) <= 0) {
          setPull(Math.min(1, dy / PULL_THRESHOLD));
        }
      },
      [refreshing],
    );
    const onTouchEnd = React.useCallback(async () => {
      if (pullStartY.current == null) return;
      const triggered = pull >= 1 && !!refreshable;
      pullStartY.current = null;
      setPull(0);
      if (triggered) {
        setRefreshing(true);
        try {
          await refreshable!();
        } finally {
          setRefreshing(false);
        }
      }
    }, [pull, refreshable]);

    // scrollInputBehavior(.disabled) — swallow user wheel/touch input while
    // leaving programmatic scrolls (proxy.scrollTo, scrollPosition, anchor) free.
    // Native listeners (passive:false) so preventDefault actually blocks scroll.
    const inputDisabled = scrollInputBehavior === "disabled";
    React.useEffect(() => {
      const el = innerRef.current;
      if (!el || !inputDisabled) return;
      const block = (e: Event) => e.preventDefault();
      el.addEventListener("wheel", block, { passive: false });
      el.addEventListener("touchmove", block, { passive: false });
      return () => {
        el.removeEventListener("wheel", block);
        el.removeEventListener("touchmove", block);
      };
    }, [inputDisabled]);

    // scrollTransition(...) convenience — fade/scale each direct child as it
    // nears the leading/trailing scroll edge. An IntersectionObserver keyed to
    // the scroll viewport reports each tagged child's visibility ratio; we write
    // it as `--sui-st` (0…1) + a phase data-attr that the CSS maps to the named
    // effect. Items fully in view sit at the identity phase (--sui-st: 1).
    React.useEffect(() => {
      if (!scrollTransition || scrollTransitionConfiguration === "identity") return;
      const root = innerRef.current;
      if (!root || typeof IntersectionObserver === "undefined") return;
      const horizontal = axes === "horizontal";
      const targets = Array.from(
        root.querySelectorAll<HTMLElement>("[data-scroll-transition]"),
      );
      if (targets.length === 0) return;
      const apply = (el: HTMLElement, ratio: number, leading: boolean) => {
        el.style.setProperty("--sui-st", String(ratio));
        el.dataset.stPhase =
          ratio >= 0.999 ? "identity" : leading ? "topLeading" : "bottomTrailing";
      };
      const io = new IntersectionObserver(
        (entries) => {
          const start = root.getBoundingClientRect();
          for (const entry of entries) {
            const el = entry.target as HTMLElement;
            const box = entry.boundingClientRect;
            // Which edge is the item closer to? (leading = top/left of viewport)
            const leading = horizontal
              ? box.left < start.left
              : box.top < start.top;
            apply(el, entry.intersectionRatio, leading);
          }
        },
        {
          root,
          threshold: [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
        },
      );
      targets.forEach((t) => io.observe(t));
      return () => io.disconnect();
    }, [scrollTransition, scrollTransitionConfiguration, axes, children]);

    const snapAxis = axes === "horizontal" ? "x" : "y";
    const cm = contentMargins;
    const contentMarginValue = cm
      ? `${cm.top ?? 0}px ${cm.trailing ?? 0}px ${cm.bottom ?? 0}px ${cm.leading ?? 0}px`
      : undefined;

    const containerStyle: React.CSSProperties = mergeStyles(
      {
        ["--snap-axis" as string]: snapAxis,
        ...(contentMarginValue
          ? { ["--sui-content-margin" as string]: contentMarginValue }
          : null),
        ...(refreshable ? { ["--pull-progress" as string]: String(pull) } : null),
      },
      style,
    );

    return (
      <ScrollViewProxyContext.Provider value={proxy}>
        <View
          ref={setRefs as React.Ref<HTMLElement>}
          as="div"
          className="sui-scrollview"
          data-axes={axes}
          data-indicators={
            indicators === "hidden" ? "hidden" : indicators
          }
          data-clip={clipDisabled ? "disabled" : undefined}
          data-disabled={disabled ? "true" : undefined}
          data-bounce={bounce}
          data-snap={targetBehavior === "none" ? undefined : targetBehavior}
          data-limit={
            targetBehavior === "viewAligned" ? viewAlignedLimit : undefined
          }
          data-dismiss-keyboard={dismissesKeyboard}
          data-content-bg={
            contentBackground && contentBackground !== "automatic" ? contentBackground : undefined
          }
          data-flash={flashing ? "true" : undefined}
          data-refreshing={refreshing ? "true" : undefined}
          data-input={inputDisabled ? "disabled" : undefined}
          data-scroll-transition={scrollTransition ?? undefined}
          style={containerStyle}
          onScroll={handleScroll}
          onTouchStart={refreshable ? onTouchStart : undefined}
          onTouchMove={refreshable ? onTouchMove : undefined}
          onTouchEnd={refreshable ? onTouchEnd : undefined}
          {...rest}
        >
          {refreshable ? (
            <span className="sui-refresh__spinner" aria-hidden="true" />
          ) : null}
          <div className="sui-scrollview__content">
            {scrollTransition ? tagScrollTransitionChildren(children) : children}
          </div>
        </View>
      </ScrollViewProxyContext.Provider>
    );
  },
);

ScrollView.displayName = "ScrollView";

/**
 * `ScrollTargetLayout` — web analogue of `.scrollTargetLayout()`. Injects
 * `className="sui-snap-target"` onto each direct child so `.viewAligned` snapping
 * can target them. Use inside a `ScrollView targetBehavior="viewAligned"`.
 */
export function ScrollTargetLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        const el = child as React.ReactElement<{ className?: string }>;
        const existing = el.props.className;
        return React.cloneElement(el, {
          className: existing ? `${existing} sui-snap-target` : "sui-snap-target",
        });
      })}
    </>
  );
}
ScrollTargetLayout.displayName = "ScrollTargetLayout";

/**
 * Clone each direct child of a `scrollTransition`-enabled scroller, tagging it
 * `data-scroll-transition` (the IntersectionObserver target hook) and seeding
 * `--sui-st: 1` so an item starts at the identity phase before the observer runs.
 */
function tagScrollTransitionChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    const el = child as React.ReactElement<{ style?: React.CSSProperties }>;
    return React.cloneElement(el, {
      ["data-scroll-transition" as string]: "",
      style: { ["--sui-st" as string]: 1, ...(el.props.style ?? {}) },
    } as Record<string, unknown>);
  });
}

export interface ScrollTransitionProps {
  /** The built-in effect to interpolate as this item crosses the edges. */
  effect?: ScrollTransitionEffectName;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * `ScrollTransition` — per-item form of `.scrollTransition`. Wrap a single item
 * inside a `ScrollView` to give it its own edge fade/scale, independent of the
 * scroller-level `scrollTransition` convenience prop. It renders a tagged
 * `data-scroll-transition` box that the enclosing `ScrollView`'s observer drives
 * (`--sui-st` 0…1 + `data-st-phase`).
 */
export function ScrollTransition({
  effect = "fadeScale",
  className,
  style,
  children,
}: ScrollTransitionProps): React.ReactElement {
  return (
    <div
      data-scroll-transition=""
      data-st-effect={effect}
      className={["sui-scroll-transition", className].filter(Boolean).join(" ")}
      style={{ ["--sui-st" as string]: 1, ...style }}
    >
      {children}
    </div>
  );
}
ScrollTransition.displayName = "ScrollTransition";
