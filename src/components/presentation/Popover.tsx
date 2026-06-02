"use client";
/**
 * `Popover` — SwiftUI's anchored floating panel with arrow/caret (C8 §3).
 *
 * Mirrors `.popover(isPresented:attachmentAnchor:arrowEdge:content:)` / `.popover(item:...)`.
 * A floating rounded vibrant-material panel attached to an anchor view, with a
 * triangular caret on `arrowEdge`. Light-dismiss (click outside / Esc). On macOS
 * there is NO scrim — clicks outside just dismiss.
 *
 * Positioning is a lightweight built-in engine (no Floating-UI dep): it reads the
 * anchor rect, places the panel on `arrowEdge` (auto-picking the edge with the most
 * room when `arrowEdge == null`), clamps to the viewport, and follows the anchor on
 * scroll/resize. On compact width it auto-adapts to a `<Sheet>` unless forced popover.
 */
import * as React from "react";
import {
  PresentationPortal,
  PRESENTATION_Z,
  usePresentation,
  useFocusTrap,
  DismissProvider,
} from "./PresentationRoot";
import { Sheet, type PresentationAdaptation } from "./Sheet";
import { springCss } from "../../system/animation";
import type { Edge } from "../../system/types";
import styles from "./Popover.module.css";

/* `PopoverAttachmentAnchor` — .rect(.bounds) | .point(UnitPoint). */
export type AttachmentAnchor =
  | "bounds"
  | { point: [number, number] } // normalized 0…1 within the anchor rect
  | UnitPointName;

export type UnitPointName =
  | "center"
  | "top"
  | "bottom"
  | "leading"
  | "trailing"
  | "topLeading"
  | "topTrailing"
  | "bottomLeading"
  | "bottomTrailing";

const UNIT_POINTS: Record<UnitPointName, [number, number]> = {
  center: [0.5, 0.5],
  top: [0.5, 0],
  bottom: [0.5, 1],
  leading: [0, 0.5],
  trailing: [1, 0.5],
  topLeading: [0, 0],
  topTrailing: [1, 0],
  bottomLeading: [0, 1],
  bottomTrailing: [1, 1],
};

export interface PopoverProps {
  isPresented: boolean;
  onIsPresentedChange?: (next: boolean) => void;
  onDismiss?: () => void;
  /** The source view the popover attaches to. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Where the arrow attaches; default `.rect(.bounds)`. */
  attachmentAnchor?: AttachmentAnchor;
  /** Which edge the arrow points FROM; `null` = system auto-picks. */
  arrowEdge?: Edge | null;
  /** `presentationCompactAdaptation` — `automatic` ⇒ Sheet on narrow viewports. */
  compactAdaptation?: PresentationAdaptation;
  /** Below this width, auto-adapt to a sheet (DESIGNED, default 500). */
  compactBreakpoint?: number;
  "aria-label"?: string;
  children?: React.ReactNode;
}

const ARROW = 9; // caret height in px
const GAP = 6; // gap between anchor and panel

interface Placement {
  edge: Edge;
  /** panel top-left in viewport coords. */
  x: number;
  y: number;
  /** arrow center offset along the panel's attached edge (px from panel origin). */
  arrowOffset: number;
}

export function Popover(props: PopoverProps): React.JSX.Element {
  const {
    isPresented,
    onIsPresentedChange,
    onDismiss,
    anchorRef,
    attachmentAnchor = "bounds",
    arrowEdge = null,
    compactAdaptation = "automatic",
    compactBreakpoint = 500,
    children,
  } = props;

  const { mounted, dataState, reduceMotion, surfaceProps } = usePresentation({
    isPresented,
    onDismiss,
    animation: "snappy",
  });

  const popoverRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = React.useState<Placement | null>(null);
  const [compact, setCompact] = React.useState(false);

  const dismiss = React.useCallback(
    () => onIsPresentedChange?.(false),
    [onIsPresentedChange],
  );

  // Detect compact width for sheet adaptation.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () =>
      setCompact(
        compactAdaptation !== "popover" &&
          compactAdaptation !== "none" &&
          window.innerWidth < compactBreakpoint,
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [compactAdaptation, compactBreakpoint]);

  // Compute the placement from the anchor rect.
  const reposition = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Attachment point in viewport coords.
    let ax = a.left + a.width / 2;
    let ay = a.top + a.height / 2;
    if (attachmentAnchor !== "bounds") {
      const up =
        typeof attachmentAnchor === "object"
          ? attachmentAnchor.point
          : UNIT_POINTS[attachmentAnchor];
      ax = a.left + up[0] * a.width;
      ay = a.top + up[1] * a.height;
    }

    // Pick the edge: explicit, else the one with the most room.
    const room: Record<Edge, number> = {
      top: a.top,
      bottom: vh - a.bottom,
      leading: a.left,
      trailing: vw - a.right,
    };
    const edge: Edge =
      arrowEdge ??
      (Object.entries(room).sort((x, y) => y[1] - x[1])[0][0] as Edge);

    let x = 0;
    let y = 0;
    let arrowOffset = 0;
    switch (edge) {
      case "top": // panel ABOVE the anchor, arrow points down toward anchor
        x = ax - p.width / 2;
        y = a.top - p.height - GAP;
        arrowOffset = p.width / 2;
        break;
      case "bottom": // panel BELOW, arrow points up
        x = ax - p.width / 2;
        y = a.bottom + GAP;
        arrowOffset = p.width / 2;
        break;
      case "leading": // panel to the LEFT, arrow points right
        x = a.left - p.width - GAP;
        y = ay - p.height / 2;
        arrowOffset = p.height / 2;
        break;
      case "trailing": // panel to the RIGHT, arrow points left
        x = a.right + GAP;
        y = ay - p.height / 2;
        arrowOffset = p.height / 2;
        break;
    }
    // Clamp to viewport with an 8px inset.
    const clampedX = Math.min(Math.max(8, x), vw - p.width - 8);
    const clampedY = Math.min(Math.max(8, y), vh - p.height - 8);
    // Re-anchor the arrow to stay centered on the attachment point after clamping.
    if (edge === "top" || edge === "bottom") {
      arrowOffset = Math.min(Math.max(12, ax - clampedX), p.width - 12);
    } else {
      arrowOffset = Math.min(Math.max(12, ay - clampedY), p.height - 12);
    }
    setPlacement({ edge, x: clampedX, y: clampedY, arrowOffset });
  }, [anchorRef, attachmentAnchor, arrowEdge]);

  // Reposition on mount + scroll + resize.
  React.useLayoutEffect(() => {
    if (!mounted || compact) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [mounted, compact, reposition]);

  // Light-dismiss: click outside the panel + anchor.
  React.useEffect(() => {
    if (!mounted || compact) return;
    const onDown = (e: PointerEvent) => {
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      const t = e.target as Node;
      if (panel?.contains(t) || anchor?.contains(t)) return;
      dismiss();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [mounted, compact, anchorRef, dismiss]);

  useFocusTrap(popoverRef, mounted && isPresented && !compact, {
    onEscape: dismiss,
    autoFocus: true,
  });

  if (!mounted) return <></>;

  // Compact adaptation → render as a medium-detent sheet.
  if (compact) {
    return (
      <Sheet
        isPresented={isPresented}
        onIsPresentedChange={onIsPresentedChange}
        onDismiss={onDismiss}
        detents={["medium"]}
      >
        {children}
      </Sheet>
    );
  }

  const presented = dataState === "presented";
  const edge = placement?.edge ?? "bottom";

  // transform-origin toward the anchor so the scale animates from it.
  const origin: Record<Edge, string> = {
    top: "center bottom",
    bottom: "center top",
    leading: "right center",
    trailing: "left center",
  };

  const popoverStyle: React.CSSProperties = {
    left: placement?.x ?? 0,
    top: placement?.y ?? 0,
    transformOrigin: origin[edge],
    opacity: placement ? (presented ? 1 : 0) : 0,
    transform: presented ? "scale(1)" : "scale(0.95)",
    transition: reduceMotion
      ? "opacity 0.2s linear"
      : `${springCss("snappy", { property: "transform" })}, opacity 0.2s linear`,
    visibility: placement ? "visible" : "hidden",
  };

  // Arrow geometry per edge.
  const arrowStyle: React.CSSProperties = (() => {
    const off = placement?.arrowOffset ?? 0;
    switch (edge) {
      case "bottom": // panel below anchor, caret on top pointing up
        return { top: -ARROW, left: off - 8, transform: "rotate(0deg)" };
      case "top": // panel above, caret on bottom pointing down
        return { bottom: -ARROW, left: off - 8, transform: "rotate(180deg)" };
      case "trailing": // panel right of anchor, caret on left pointing left
        return { left: -ARROW - 3.5, top: off - 8, transform: "rotate(-90deg)" };
      case "leading": // panel left of anchor, caret on right pointing right
        return { right: -ARROW - 3.5, top: off - 8, transform: "rotate(90deg)" };
    }
  })();

  return (
    <PresentationPortal zIndex={PRESENTATION_Z.popover} pointerEvents={false}>
      <DismissProvider dismiss={dismiss}>
        <div
          ref={popoverRef}
          className={styles.popover}
          role="dialog"
          aria-label={props["aria-label"] ?? "Popover"}
          data-state={dataState}
          data-arrow-edge={edge}
          onTransitionEnd={surfaceProps.onTransitionEnd}
          style={popoverStyle}
        >
          <div ref={panelRef} className={styles.panel}>
            <div className={styles.arrow} style={arrowStyle} aria-hidden="true" />
            {children}
          </div>
        </div>
      </DismissProvider>
    </PresentationPortal>
  );
}

/* --- item: overload sugar --------------------------------------------------- */

export interface PopoverItemProps<Item>
  extends Omit<PopoverProps, "isPresented" | "onIsPresentedChange" | "children"> {
  item: Item | null | undefined;
  onItemChange?: (next: Item | null) => void;
  children: (item: Item) => React.ReactNode;
}

function PopoverItem<Item>(props: PopoverItemProps<Item>): React.JSX.Element {
  const { item, onItemChange, children, ...rest } = props;
  const [captured, setCaptured] = React.useState<Item | null>(item ?? null);
  React.useEffect(() => {
    if (item != null) setCaptured(item);
  }, [item]);
  return (
    <Popover
      {...rest}
      isPresented={item != null}
      onIsPresentedChange={(next) => {
        if (!next) onItemChange?.(null);
      }}
    >
      {captured != null ? children(captured) : null}
    </Popover>
  );
}

Popover.Item = PopoverItem;

/* --- usePopover hook -------------------------------------------------------- */

export interface UsePopoverResult {
  isPresented: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  present: () => void;
  dismiss: () => void;
  toggle: () => void;
  bind: {
    isPresented: boolean;
    onIsPresentedChange: (next: boolean) => void;
    anchorRef: React.RefObject<HTMLElement | null>;
  };
}

/**
 * `usePopover()` — owns the open state AND the anchor ref. Attach `anchorRef` to the
 * source view; spread `bind` onto `<Popover>`.
 */
export function usePopover(initial = false): UsePopoverResult {
  const [isPresented, setPresented] = React.useState(initial);
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const present = React.useCallback(() => setPresented(true), []);
  const dismiss = React.useCallback(() => setPresented(false), []);
  const toggle = React.useCallback(() => setPresented((v) => !v), []);
  return {
    isPresented,
    anchorRef,
    present,
    dismiss,
    toggle,
    bind: { isPresented, onIsPresentedChange: setPresented, anchorRef },
  };
}
