"use client";
/**
 * `Sheet` — SwiftUI's slide-up bottom sheet (C8 §1, the HIGH-VALUE deliverable).
 *
 * Mirrors `.sheet(isPresented:onDismiss:content:)` and `.sheet(item:...)`, plus the
 * whole presentation-modifier system (`presentationDetents`, `presentationDragIndicator`,
 * `presentationCornerRadius`, `presentationBackground`, `presentationBackgroundInteraction`,
 * `presentationContentInteraction`, `presentationCompactAdaptation`).
 *
 * Architecture: portal + overlay (see PresentationRoot). A scrim dims the presenter;
 * a rounded-top card slides up from `translateY(100%)` to its detent on the `.smooth`
 * spring (settling 0.735s). With ≥2 detents the sheet is resizable (drag the grabber);
 * drag-to-dismiss via `useDragGesture`. The presenter behind scales to 0.92 (stacked
 * card). All animation via animation.ts springs; material/elevated bg via tokens.
 */
import * as React from "react";
import {
  PresentationPortal,
  PRESENTATION_Z,
  usePresentation,
  Scrim,
  useFocusTrap,
  DismissProvider,
} from "./PresentationRoot";
import { springCss } from "../../system/animation";
import { glass } from "../../system/effects";
import {
  useLiquidGlass,
  glassSurfaceClass,
  glassScrimClass,
  glassGrabberClass,
  concentricVars,
  chromeClasses,
} from "./glassChrome";
import styles from "./Sheet.module.css";

/* ===========================================================================
 * 1. PresentationDetent (§1.2) — KNOWN value type.
 * ======================================================================== */

/** A normalized detent value. Mirrors `PresentationDetent`'s five constructors. */
export type Detent =
  | "medium"
  | "large"
  | { kind: "fraction"; value: number }
  | { kind: "height"; value: number }
  | { kind: "custom"; id: string; height: (ctx: DetentContext) => number | null };

/** `PresentationDetent.Context` — env handed to a custom detent. */
export interface DetentContext {
  /** Full available height in px (`maxDetentValue`). */
  maxDetentValue: number;
}

/** Sugar constructors mirroring `PresentationDetent.fraction/.height/.custom`. */
export const Detents = {
  medium: "medium" as Detent,
  large: "large" as Detent,
  fraction: (value: number): Detent => ({ kind: "fraction", value }),
  height: (value: number): Detent => ({ kind: "height", value }),
  custom: (
    id: string,
    height: (ctx: DetentContext) => number | null,
  ): Detent => ({ kind: "custom", id, height }),
};

/**
 * Detent → pixel height resolver (§1.7 DESIGNED). `.medium` = 50%, `.large` = full,
 * `.fraction(f)` = f·max clamped 0…1, `.height(h)` = min(h, max), `.custom` calls
 * `height(ctx)` (nil → 0 = drop). Returns px.
 */
export function resolveDetent(d: Detent, maxH: number): number {
  if (d === "medium") return maxH * 0.5;
  if (d === "large") return maxH;
  switch (d.kind) {
    case "fraction":
      return Math.min(1, Math.max(0, d.value)) * maxH;
    case "height":
      return Math.min(d.value, maxH);
    case "custom":
      return d.height({ maxDetentValue: maxH }) ?? 0;
  }
}

/** Stable key for a detent (used for Set semantics + selection identity). */
export function detentKey(d: Detent): string {
  if (d === "medium") return "medium";
  if (d === "large") return "large";
  if (d.kind === "fraction") return `fraction:${d.value}`;
  if (d.kind === "height") return `height:${d.value}`;
  return `custom:${d.id}`;
}

/* ===========================================================================
 * 2. Companion enums (§1.4) — string-union mirrors.
 * ======================================================================== */

export type DragIndicatorVisibility = "automatic" | "visible" | "hidden";

/** `PresentationBackgroundInteraction`. */
export type BackgroundInteraction =
  | "automatic"
  | "enabled"
  | "disabled"
  | { upThrough: Detent };

/** `PresentationContentInteraction`. */
export type ContentInteraction = "automatic" | "resizes" | "scrolls";

/** `PresentationAdaptation`. */
export type PresentationAdaptation =
  | "automatic"
  | "none"
  | "popover"
  | "sheet"
  | "fullScreenCover";

/**
 * `presentationSizing(_:)` — the sheet's preferred sizing strategy.
 *   - `automatic` → detent-driven height, full width (the iOS default).
 *   - `fitted`    → the card hugs its content in BOTH axes (centered floating card).
 *   - `form`      → a comfortable form width (~min(90vw, 420px)) hugging content height.
 *   - `page`      → fills the available space (full-bleed page sheet).
 *   - `{ width?, height? }` → an explicit fixed size (`PresentationSizing.fixed`).
 */
export type PresentationSizing =
  | "automatic"
  | "fitted"
  | "form"
  | "page"
  | { width?: number; height?: number };

/* ===========================================================================
 * 3. <Sheet> props (§1.7 DESIGNED prop API).
 * ======================================================================== */

export interface SheetProps {
  /** `Binding<Bool>` — sheet shows while true. */
  isPresented: boolean;
  /** Setter; the sheet calls `onIsPresentedChange(false)` on dismiss. */
  onIsPresentedChange?: (next: boolean) => void;
  /** Fires AFTER the dismiss animation completes (SwiftUI `onDismiss`). */
  onDismiss?: () => void;
  /** `Set<PresentationDetent>`; >1 ⇒ resizable + auto grabber. Default `['large']`. */
  detents?: Detent[];
  /** `presentationDetents(_:selection:)` — two-way current detent. */
  selectedDetent?: Detent;
  onSelectedDetentChange?: (d: Detent) => void;
  /** `presentationDragIndicator`. */
  dragIndicator?: DragIndicatorVisibility;
  /** `presentationCornerRadius` (null ⇒ system default 10). */
  cornerRadius?: number | null;
  /** `presentationBackground` — replaces the default elevated material backing. */
  background?: React.ReactNode;
  /** `presentationBackgroundInteraction`. */
  backgroundInteraction?: BackgroundInteraction;
  /** `presentationContentInteraction`. */
  contentInteraction?: ContentInteraction;
  /** `presentationCompactAdaptation`. */
  compactAdaptation?: PresentationAdaptation;
  /** `presentationSizing(_:)` — `fitted`/`form`/`page`/fixed override the detent height. */
  sizing?: PresentationSizing;
  /** Block swipe/scrim dismissal (`interactiveDismissDisabled`). */
  interactiveDismissDisabled?: boolean;
  /**
   * Liquid-Glass surface override. Unset ⇒ follow `useEnvironment().liquidGlass`
   * (default glass in iOS-26 mode). `false` ⇒ classic frosted Material card.
   * Ignored when a custom `background` is supplied (the caller owns the backing).
   */
  glass?: boolean;
  /** Accessible label id; defaults are derived. */
  "aria-label"?: string;
  children?: React.ReactNode;
}

/* ===========================================================================
 * 4. Drag state machine — drag-to-resize + drag-to-dismiss.
 * ======================================================================== */

interface DragState {
  dragging: boolean;
  /** Pixel offset added to the resting translateY during a drag (>=0 = down). */
  offset: number;
}

/**
 * The `<Sheet>` component. Controlled via `isPresented`.
 */
export function Sheet(props: SheetProps): React.JSX.Element {
  const {
    isPresented,
    onIsPresentedChange,
    onDismiss,
    detents = ["large"],
    selectedDetent,
    onSelectedDetentChange,
    dragIndicator = "automatic",
    cornerRadius = null,
    background,
    backgroundInteraction = "automatic",
    sizing = "automatic",
    interactiveDismissDisabled = false,
    glass: glassProp,
    children,
  } = props;

  // Liquid-Glass mode (default glass in iOS-26). A custom `background` opts the
  // surface out (the caller draws its own backing), so glass only paints the
  // card when no explicit background is provided.
  const liquidGlass = useLiquidGlass(glassProp);
  const glassy = liquidGlass && background == null;

  const { mounted, dataState, reduceMotion, surfaceProps } = usePresentation({
    isPresented,
    onDismiss,
    animation: "smooth",
  });

  const cardRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [viewportH, setViewportH] = React.useState(0);
  const [drag, setDrag] = React.useState<DragState>({ dragging: false, offset: 0 });

  // Sorted, de-duplicated detents (Set semantics: ordered by resolved height asc).
  const sortedDetents = React.useMemo(() => {
    const max = viewportH || 1000;
    const seen = new Set<string>();
    return detents
      .filter((d) => {
        const k = detentKey(d);
        if (seen.has(k)) return false;
        seen.add(k);
        return resolveDetent(d, max) > 0; // drop custom detents that return nil
      })
      .sort((a, b) => resolveDetent(a, max) - resolveDetent(b, max));
  }, [detents, viewportH]);

  const isResizable = sortedDetents.length > 1;

  // The currently active detent (controlled by selectedDetent, else internal).
  const [internalDetent, setInternalDetent] = React.useState<Detent>(
    selectedDetent ?? sortedDetents[sortedDetents.length - 1] ?? "large",
  );
  const activeDetent = selectedDetent ?? internalDetent;

  const setActiveDetent = React.useCallback(
    (d: Detent) => {
      setInternalDetent(d);
      onSelectedDetentChange?.(d);
    },
    [onSelectedDetentChange],
  );

  // Track viewport height (the detent `maxDetentValue`).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Keep the active detent valid as the detent set / viewport changes.
  React.useEffect(() => {
    if (sortedDetents.length === 0) return;
    const stillValid = sortedDetents.some(
      (d) => detentKey(d) === detentKey(activeDetent),
    );
    if (!stillValid) {
      setInternalDetent(sortedDetents[sortedDetents.length - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedDetents]);

  const maxH = viewportH || 1000;
  const detentHeightPx = resolveDetent(activeDetent, maxH);
  const smallestPx = sortedDetents.length
    ? resolveDetent(sortedDetents[0], maxH)
    : detentHeightPx;

  const dismiss = React.useCallback(() => {
    onIsPresentedChange?.(false);
  }, [onIsPresentedChange]);

  // ---- Drag-to-resize + drag-to-dismiss (DESIGNED, §1.6) -------------------
  const dragRef = React.useRef<{
    startY: number;
    startHeight: number;
    lastY: number;
    lastT: number;
    vy: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (interactiveDismissDisabled && !isResizable) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      startHeight: detentHeightPx,
      lastY: e.clientY,
      lastT: e.timeStamp,
      vy: 0,
    };
    setDrag({ dragging: true, offset: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dt = (e.timeStamp - d.lastT) / 1000 || 1e-3;
    d.vy = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    let dy = e.clientY - d.startY; // down-positive
    // Rubber-band when dragging UP past the largest detent.
    const largestPx = resolveDetent(
      sortedDetents[sortedDetents.length - 1] ?? activeDetent,
      maxH,
    );
    if (dy < 0 && d.startHeight >= largestPx) {
      dy *= 0.3; // resist past max
    }
    setDrag({ dragging: true, offset: dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) {
      setDrag({ dragging: false, offset: 0 });
      return;
    }
    const dy = drag.offset;
    // Project the landing height by velocity (pos + v·0.1), in HEIGHT space
    // (dragging down ⇒ smaller height).
    const projectedHeight = d.startHeight - dy - d.vy * 0.1;

    // Dismiss when projected below the smallest detent minus a threshold, OR a
    // strong downward fling.
    const dismissThreshold = smallestPx * 0.7;
    if (
      !interactiveDismissDisabled &&
      (projectedHeight < dismissThreshold || (dy > 0 && d.vy > 1200))
    ) {
      setDrag({ dragging: false, offset: 0 });
      dismiss();
      return;
    }

    // Otherwise snap to the nearest detent by projected height.
    if (isResizable) {
      let nearest = sortedDetents[0];
      let best = Infinity;
      for (const det of sortedDetents) {
        const h = resolveDetent(det, maxH);
        const dist = Math.abs(h - projectedHeight);
        if (dist < best) {
          best = dist;
          nearest = det;
        }
      }
      setActiveDetent(nearest);
    }
    setDrag({ dragging: false, offset: 0 });
  };

  // Grabber visibility: automatic = show iff >1 detent.
  const showGrabber =
    dragIndicator === "visible" ||
    (dragIndicator === "automatic" && isResizable);

  // Scrim opacity fades proportionally as the sheet rises for small custom detents.
  const interactive = backgroundInteraction === "enabled";

  // presentationSizing(_:) — a non-automatic strategy overrides the detent height.
  // `fitted`/`form` hug content (height:auto, capped); `page` fills; fixed pins both.
  const sizingMode = typeof sizing === "object" ? "fixed" : sizing;
  const sizingStyle: React.CSSProperties = {};
  if (typeof sizing === "object") {
    if (sizing.width != null) sizingStyle.width = `${sizing.width}px`;
    if (sizing.height != null) sizingStyle.height = `${sizing.height}px`;
  } else if (sizing === "fitted" || sizing === "form") {
    sizingStyle.height = "auto";
    sizingStyle.maxHeight = "calc(100% - 24px)";
    if (sizing === "form") sizingStyle.width = "min(92vw, 420px)";
    else sizingStyle.width = "max-content";
    sizingStyle.maxWidth = "calc(100% - 24px)";
  } else if (sizing === "page") {
    sizingStyle.height = "100%";
  }

  // Resolve the card transform: resting (translateY 0) + drag offset, OR resolve
  // height directly while dragging so the sheet tracks the finger 1:1.
  // The resolved top-corner radius (system default 10pt; glass lifts to a softer
  // 16pt so the concentric rim reads). Used both for the CSS var and to publish
  // the concentric parent radius for nested glass children.
  const resolvedRadius = cornerRadius ?? (glassy ? 16 : 10);
  const cardStyle: React.CSSProperties = {
    ["--sheet-detent-h" as string]: `${detentHeightPx}px`,
    ["--sheet-radius" as string]: `${resolvedRadius}px`,
    ...(glassy ? concentricVars(resolvedRadius) : {}),
    // a non-automatic sizing strategy wins over the detent height var.
    ...(sizingMode !== "automatic" ? sizingStyle : {}),
  };
  if (drag.dragging) {
    // Track the finger: positive offset moves the card down.
    cardStyle.transform = `translateY(${Math.max(0, drag.offset)}px)`;
    if (drag.offset < 0) {
      // Dragged up past detent: grow the height instead (rubber-banded already).
      cardStyle.height = `${detentHeightPx - drag.offset}px`;
      cardStyle.transform = "translateY(0)";
    }
  } else if (!reduceMotion) {
    cardStyle.transition = `${springCss("smooth", { property: "transform" })}, ${springCss("smooth", { property: "height" })}`;
  }

  const scrimTransition = reduceMotion
    ? "opacity 0.2s linear"
    : springCss("smooth", { property: "opacity" });

  // Focus trap while presented.
  useFocusTrap(containerRef, mounted && isPresented, {
    onEscape: interactiveDismissDisabled ? undefined : dismiss,
    autoFocus: true,
  });

  // Stacked-card scaling on the presenter behind the sheet (§1.5).
  useStackedCardScale(mounted && dataState === "presented");

  if (!mounted) return <></>;

  return (
    <PresentationPortal zIndex={PRESENTATION_Z.sheet} pointerEvents={!interactive}>
      <DismissProvider dismiss={dismiss}>
        <div
          ref={containerRef}
          className={styles.host}
          role="dialog"
          aria-modal={interactive ? undefined : true}
          aria-label={props["aria-label"] ?? "Sheet"}
        >
          <Scrim
            opacity={glassy ? 1 : 0.4}
            presented={dataState === "presented"}
            interactive={interactive}
            onTap={interactiveDismissDisabled ? undefined : dismiss}
            transition={scrimTransition}
            className={chromeClasses(styles.scrim, glassScrimClass(glassy))}
          />
          <div
            ref={cardRef}
            className={chromeClasses(
              styles.card,
              glassy && styles.cardGlass,
              glassy && glassSurfaceClass(glass.regular),
            )}
            data-state={dataState}
            data-glass={glassy ? "true" : undefined}
            data-dragging={drag.dragging ? "true" : "false"}
            data-sizing={sizingMode !== "automatic" ? sizingMode : undefined}
            onTransitionEnd={surfaceProps.onTransitionEnd}
            style={cardStyle}
          >
            {showGrabber && (
              <div
                className={chromeClasses(styles.grabber, glassGrabberClass(glassy))}
                aria-hidden="true"
                onPointerDown={isResizable || !interactiveDismissDisabled ? onPointerDown : undefined}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{ cursor: "grab", touchAction: "none" }}
              />
            )}
            {background != null && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: -1,
                  borderTopLeftRadius: "inherit",
                  borderTopRightRadius: "inherit",
                  overflow: "hidden",
                }}
              >
                {background}
              </div>
            )}
            <div className={styles.content}>{children}</div>
          </div>
        </div>
      </DismissProvider>
    </PresentationPortal>
  );
}

/* ===========================================================================
 * 5. Stacked-card scaling on the presenter (§1.5).
 * ======================================================================== */

/**
 * Scale the page root behind the sheet to ≈0.92 with rounded corners — the iPhone
 * "card peeking behind" look. Applies/removes a `data-behind-sheet` attribute and
 * inline transform on `<body>`'s first app child (or `#__next`/body). DESIGNED.
 */
function useStackedCardScale(active: boolean): void {
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const presenter =
      (document.getElementById("__next") as HTMLElement | null) ??
      (document.body.firstElementChild as HTMLElement | null) ??
      document.body;
    if (!presenter || presenter.id === "sui-presentation-root") return;
    if (!active) return;

    const prev = {
      transform: presenter.style.transform,
      borderRadius: presenter.style.borderRadius,
      overflow: presenter.style.overflow,
      transition: presenter.style.transition,
      filter: presenter.style.filter,
      transformOrigin: presenter.style.transformOrigin,
    };
    presenter.style.transition =
      "transform 0.735s var(--sui-anim-smooth-css), border-radius 0.735s var(--sui-anim-smooth-css), filter 0.735s var(--sui-anim-smooth-css)";
    presenter.style.transformOrigin = "center top";
    presenter.style.transform = "scale(0.92) translateY(0)";
    presenter.style.borderRadius = "10px";
    presenter.style.overflow = "hidden";
    presenter.style.filter = "brightness(0.92)";

    return () => {
      presenter.style.transform = prev.transform;
      presenter.style.borderRadius = prev.borderRadius;
      presenter.style.overflow = prev.overflow;
      presenter.style.filter = prev.filter;
      presenter.style.transformOrigin = prev.transformOrigin;
      // keep the transition for the un-scale animation, then restore
      window.setTimeout(() => {
        presenter.style.transition = prev.transition;
      }, 750);
    };
  }, [active]);
}

/* ===========================================================================
 * 6. <Sheet.Item> — the item:-overload sugar.
 * ======================================================================== */

export interface SheetItemProps<Item> extends Omit<SheetProps, "isPresented" | "onIsPresentedChange" | "children"> {
  /** `Binding<Item?>` — sheet shows while non-nil; content receives the item. */
  item: Item | null | undefined;
  onItemChange?: (next: Item | null) => void;
  children: (item: Item) => React.ReactNode;
}

/**
 * `Sheet.Item` — mirrors `.sheet(item:onDismiss:content:)`. Captures the item at
 * present time so the content keeps rendering it through the exit animation even
 * after the binding goes nil.
 */
function SheetItem<Item>(props: SheetItemProps<Item>): React.JSX.Element {
  const { item, onItemChange, children, ...rest } = props;
  const [captured, setCaptured] = React.useState<Item | null>(item ?? null);

  React.useEffect(() => {
    if (item != null) setCaptured(item);
  }, [item]);

  return (
    <Sheet
      {...rest}
      isPresented={item != null}
      onIsPresentedChange={(next) => {
        if (!next) onItemChange?.(null);
      }}
    >
      {captured != null ? children(captured) : null}
    </Sheet>
  );
}

Sheet.Item = SheetItem;

/* ===========================================================================
 * 7. useSheet — imperative hook sugar (§ task requirement).
 * ======================================================================== */

export interface UseSheetResult {
  isPresented: boolean;
  present: () => void;
  dismiss: () => void;
  /** Bind onto `<Sheet {...sheet.bind}>`. */
  bind: {
    isPresented: boolean;
    onIsPresentedChange: (next: boolean) => void;
  };
}

/**
 * `useSheet()` — owns the open/closed state so callers don't have to. Returns
 * `present()`/`dismiss()` plus a `bind` object to spread onto `<Sheet>`.
 *
 *   const sheet = useSheet();
 *   <button onClick={sheet.present}>Open</button>
 *   <Sheet {...sheet.bind} detents={['medium','large']}>…</Sheet>
 */
export function useSheet(initial = false): UseSheetResult {
  const [isPresented, setPresented] = React.useState(initial);
  const present = React.useCallback(() => setPresented(true), []);
  const dismiss = React.useCallback(() => setPresented(false), []);
  return {
    isPresented,
    present,
    dismiss,
    bind: { isPresented, onIsPresentedChange: setPresented },
  };
}
