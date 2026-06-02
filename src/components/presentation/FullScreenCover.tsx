"use client";
/**
 * `FullScreenCover` — SwiftUI's opaque full-screen modal (C8 §2).
 *
 * Mirrors `.fullScreenCover(isPresented:onDismiss:content:)` / `.fullScreenCover(item:...)`.
 * Difference from `sheet`: covers the ENTIRE screen, opaque, NO scrim, NO detents,
 * NOT swipe-to-dismiss (you must render an explicit dismiss control). The content
 * slides up from `translateY(100%)` → `0` on the `.smooth` spring (settling 0.735s),
 * full opacity throughout. macOS-unavailable in SwiftUI → mapped to a full-window modal.
 *
 * Children dismiss via the `useDismiss()` context (mirrors `@Environment(\.dismiss)`).
 */
import * as React from "react";
import {
  PresentationPortal,
  PRESENTATION_Z,
  usePresentation,
  useFocusTrap,
  DismissProvider,
} from "./PresentationRoot";
import { springCss } from "../../system/animation";
import { glass } from "../../system/effects";
import {
  useLiquidGlass,
  glassSurfaceClass,
  concentricVars,
  chromeClasses,
} from "./glassChrome";

export interface FullScreenCoverProps {
  /** `Binding<Bool>`. */
  isPresented: boolean;
  onIsPresentedChange?: (next: boolean) => void;
  /** Fires AFTER the dismiss animation completes. */
  onDismiss?: () => void;
  /**
   * Opaque background; default = system background. In Liquid-Glass mode an
   * explicit `background` opts the cover OUT of glass (the caller owns the fill).
   */
  background?: string;
  /**
   * Liquid-Glass surface override. Unset ⇒ follow `useEnvironment().liquidGlass`
   * (default glass). `false` ⇒ classic opaque cover. A custom `background` always
   * wins (opts out of glass).
   */
  glass?: boolean;
  "aria-label"?: string;
  children?: React.ReactNode;
}

export function FullScreenCover(props: FullScreenCoverProps): React.JSX.Element {
  const {
    isPresented,
    onIsPresentedChange,
    onDismiss,
    background,
    glass: glassProp,
    children,
  } = props;

  // Liquid-Glass mode. An explicit `background` opts out (caller owns the fill);
  // glass paints the cover only when no background was supplied.
  const liquidGlass = useLiquidGlass(glassProp);
  const glassy = liquidGlass && background == null;
  const resolvedBackground =
    background ?? (glassy ? "transparent" : "var(--sui-color-system-background, #fff)");

  const { mounted, dataState, reduceMotion, surfaceProps } = usePresentation({
    isPresented,
    onDismiss,
    animation: "smooth",
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const dismiss = React.useCallback(
    () => onIsPresentedChange?.(false),
    [onIsPresentedChange],
  );

  useFocusTrap(containerRef, mounted && isPresented, { autoFocus: true });

  if (!mounted) return <></>;

  const presented = dataState === "presented";
  const coverStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: resolvedBackground,
    transform: presented ? "translateY(0)" : "translateY(100%)",
    transition: reduceMotion
      ? "opacity 0.2s linear"
      : springCss("smooth", { property: "transform" }),
    willChange: "transform",
    pointerEvents: "auto",
    // glass cover floats with concentric top corners over the page behind it.
    ...(glassy
      ? {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          ...concentricVars(16),
        }
      : {}),
    ...(reduceMotion ? { opacity: presented ? 1 : 0, transform: "none" } : {}),
  };

  return (
    <PresentationPortal zIndex={PRESENTATION_Z.fullScreenCover}>
      <DismissProvider dismiss={dismiss}>
        <div
          ref={containerRef}
          role="dialog"
          aria-modal={true}
          aria-label={props["aria-label"] ?? "Full screen cover"}
          data-state={dataState}
          className={chromeClasses(glassy && glassSurfaceClass(glass.regular))}
          onTransitionEnd={surfaceProps.onTransitionEnd}
          style={coverStyle}
        >
          {children}
        </div>
      </DismissProvider>
    </PresentationPortal>
  );
}

/* --- item: overload sugar --------------------------------------------------- */

export interface FullScreenCoverItemProps<Item>
  extends Omit<FullScreenCoverProps, "isPresented" | "onIsPresentedChange" | "children"> {
  item: Item | null | undefined;
  onItemChange?: (next: Item | null) => void;
  children: (item: Item) => React.ReactNode;
}

function FullScreenCoverItem<Item>(
  props: FullScreenCoverItemProps<Item>,
): React.JSX.Element {
  const { item, onItemChange, children, ...rest } = props;
  const [captured, setCaptured] = React.useState<Item | null>(item ?? null);
  React.useEffect(() => {
    if (item != null) setCaptured(item);
  }, [item]);

  return (
    <FullScreenCover
      {...rest}
      isPresented={item != null}
      onIsPresentedChange={(next) => {
        if (!next) onItemChange?.(null);
      }}
    >
      {captured != null ? children(captured) : null}
    </FullScreenCover>
  );
}

FullScreenCover.Item = FullScreenCoverItem;

/* --- useFullScreenCover hook ------------------------------------------------ */

export interface UseFullScreenCoverResult {
  isPresented: boolean;
  present: () => void;
  dismiss: () => void;
  bind: { isPresented: boolean; onIsPresentedChange: (next: boolean) => void };
}

export function useFullScreenCover(initial = false): UseFullScreenCoverResult {
  const [isPresented, setPresented] = React.useState(initial);
  return {
    isPresented,
    present: React.useCallback(() => setPresented(true), []),
    dismiss: React.useCallback(() => setPresented(false), []),
    bind: { isPresented, onIsPresentedChange: setPresented },
  };
}
