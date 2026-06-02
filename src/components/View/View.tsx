/**
 * `<View>` — the base component every SwiftUI-web widget builds on.
 *
 * SwiftUI's `View` is the universal styling host: any modifier can be applied to
 * any view. The web equivalent is a single element that runs the modifier
 * compiler (`applyModifiers`) and renders the resulting style + className onto a
 * configurable host element (default `div`), spreading every non-modifier prop
 * straight through to the DOM.
 *
 * It is a plain, server-compatible component — no interactivity, no hooks, no
 * "use client". Interactive widgets (Button, Toggle, …) wrap `<View>` and add
 * their own client behavior.
 *
 * ## Layer modifiers (overlay / background-view / mask) — C10 §B.9/§C.2/§C.6
 *
 * `applyModifiers` is a pure style→CSS compiler and cannot render JSX, so the
 * *view-shaped* layer modifiers are rendered HERE:
 *
 *   - `overlayContent` (+ `overlayAlignment`): a view drawn IN FRONT of the
 *     content, absolutely positioned over the content box (does NOT affect
 *     layout — mirrors `.overlay(alignment:)`). Anchored by the 9-point
 *     alignment grid; default `.center`.
 *   - `backgroundContent` (+ `backgroundAlignment`): a view drawn BEHIND the
 *     content, same non-layout-affecting positioned layer. The simple COLOR
 *     `.background(Color.red)` path stays in `applyModifiers` (a plain
 *     `background-color`); this is only for an arbitrary ReactNode background.
 *   - `mask` (ReactNode form): cuts the content out using the mask view's
 *     alpha/luminance. The string/`{image}` forms compile to a pure CSS
 *     `mask-image` in `applyModifiers`; the ReactNode form is rasterized here
 *     via an inline SVG `<mask>` containing a `<foreignObject>` (the only
 *     portable way to use arbitrary DOM as a CSS mask), referenced by
 *     `mask: url(#id)`.
 *
 * Any of these layers forces the host to establish a positioning context
 * (`position: relative`) so the absolute layers anchor to it — unless the
 * compiled style already positioned the host (`absolute`/`fixed`).
 */
import * as React from "react";
import {
  alignToFlex,
  applyModifiers,
  type ViewModifierProps,
} from "../../system/modifiers";
import type { Alignment } from "../../system/types";

export interface ViewProps
  extends ViewModifierProps,
    Omit<React.HTMLAttributes<HTMLElement>, "color"> {
  /** The host element to render (default `'div'`). */
  as?: keyof React.JSX.IntrinsicElements;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Merge any number of style objects into one. Later objects win on key
 * collisions; `undefined` entries are skipped. The caller's explicit `style`
 * should always be passed LAST so it overrides compiled modifier styles.
 */
export function mergeStyles(
  ...styles: Array<React.CSSProperties | undefined>
): React.CSSProperties {
  const out: React.CSSProperties = {};
  for (const s of styles) if (s) Object.assign(out, s);
  return out;
}

/**
 * The shared full-box layer used by overlay/background. Absolutely positioned to
 * fill the content box, a flexbox aligned by the 9-point SwiftUI alignment grid
 * so a *smaller* layer (a badge, an icon) anchors at its corner/edge. It never
 * affects the host's layout (it's out of flow) — exactly like SwiftUI's
 * overlay/background, which are measured by the content, not the other way.
 */
function layerStyle(
  alignment: Alignment,
  zIndex: number,
): React.CSSProperties {
  const [alignItems, justifyContent] = alignToFlex(alignment);
  return {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems,
    justifyContent,
    zIndex,
    // overlay/background fill is purely decorative by default; SwiftUI keeps the
    // content hit-testable through a non-interactive layer. Interactive layer
    // content can re-enable hits with its own `pointer-events: auto`.
    pointerEvents: "none",
  };
}

let maskIdCounter = 0;
/** Stable-per-instance id for the SVG mask `url(#id)` reference (SSR-safe). */
function useMaskId(): string {
  // React.useId is SSR-safe and unique; fall back to a counter on older runtimes.
  const reactId = (React as { useId?: () => string }).useId?.();
  const fallback = React.useRef<string | null>(null);
  if (reactId) return `sui-mask-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (fallback.current === null) fallback.current = `sui-mask-${maskIdCounter++}`;
  return fallback.current;
}

export const View = React.forwardRef<HTMLElement, ViewProps>(function View(
  { as = "div", children, className, style: styleProp, ...props },
  ref,
) {
  const { style, className: modClassName, rest } = applyModifiers(props);

  const m = props as ViewModifierProps;
  const overlayContent = m.overlayContent;
  const backgroundContent = m.backgroundContent;
  const maskProp = m.mask;
  // Only the ReactNode mask form is rendered here; string/{image} masks were
  // already compiled to `mask-image` in `applyModifiers`.
  const nodeMask =
    maskProp != null &&
    typeof maskProp === "object" &&
    "content" in maskProp
      ? maskProp
      : null;

  const hasLayers =
    overlayContent != null || backgroundContent != null || nodeMask != null;

  // Establish a positioning context for the absolute layers unless the host is
  // already positioned (position:absolute/fixed from .position()).
  const positioningStyle: React.CSSProperties | undefined =
    hasLayers && style.position !== "absolute" && style.position !== "fixed"
      ? { position: "relative" }
      : undefined;

  const maskId = useMaskId();

  const Element = as as React.ElementType;
  const mergedClassName =
    [modClassName, className].filter(Boolean).join(" ") || undefined;

  // When the ReactNode mask is present, point the host's CSS mask at the inline
  // SVG `<mask>` we render below. `mask-mode: luminance` matches SwiftUI's
  // gradient behaviour; alpha shapes still read because their alpha == luminance
  // when painted white. The foreignObject holds the live mask DOM.
  const nodeMaskStyle: React.CSSProperties | undefined = nodeMask
    ? ({
        WebkitMaskImage: `url(#${maskId})`,
        maskImage: `url(#${maskId})`,
        // luminance for gradients/grayscale; alpha shapes paint white→fully shown
        maskType: nodeMask.mode ?? "luminance",
      } as React.CSSProperties)
    : undefined;

  return (
    <Element
      ref={ref}
      className={mergedClassName}
      // order: compiled modifier style → positioning → node-mask → caller style.
      // caller's explicit `style` always wins last.
      style={mergeStyles(style, positioningStyle, nodeMaskStyle, styleProp)}
      {...rest}
    >
      {backgroundContent != null ? (
        <div
          aria-hidden
          style={layerStyle(m.backgroundAlignment ?? "center", 0)}
        >
          {backgroundContent}
        </div>
      ) : null}

      {children}

      {overlayContent != null ? (
        <div aria-hidden style={layerStyle(m.overlayAlignment ?? "center", 1)}>
          {overlayContent}
        </div>
      ) : null}

      {nodeMask != null ? (
        <svg
          aria-hidden
          width="0"
          height="0"
          style={{ position: "absolute", width: 0, height: 0 }}
        >
          <defs>
            {/* maskUnits=objectBoundingBox makes 0–1 cover the whole host box.
                A foreignObject lets us put arbitrary live DOM into the mask;
                white/opaque pixels show the content, black/clear hide it. */}
            <mask
              id={maskId}
              maskUnits="objectBoundingBox"
              maskContentUnits="objectBoundingBox"
            >
              <foreignObject x="0" y="0" width="1" height="1">
                {nodeMask.content}
              </foreignObject>
            </mask>
          </defs>
        </svg>
      ) : null}
    </Element>
  );
});

View.displayName = "View";
