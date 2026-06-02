"use client";
/**
 * `Inspector` — SwiftUI's `.inspector(isPresented:) { … }` trailing side panel.
 *
 * Mirrors the SwiftUI modifier (SwiftUICore.View, `inspector(isPresented:content:)`,
 * iOS 17 / macOS 14):
 *
 *   content
 *     .inspector(isPresented: $shown) { InspectorBody() }
 *     .inspectorColumnWidth(min: 200, ideal: 280, max: 420)
 *
 * On web there is no modifier-on-a-view, so the same composition is expressed as
 * a wrapper component: the primary content sits in the main region and the
 * inspector lives in a collapsible trailing column. It is the macOS/iPadOS
 * "right utility panel" (Xcode/Keynote inspector): a frosted/grouped vertical
 * panel pinned to the trailing edge with a 0.5px leading separator that slides
 * in/out by collapsing its grid track.
 *
 * `isPresented` is a controlled `[shown, setShown]` binding (the web analogue of
 * `Binding<Bool>`). `columnWidth` maps the `inspectorColumnWidth(_:)` /
 * `(min:ideal:max:)` overloads to a CSS track. Under compact width the panel
 * overlays the content as a right drawer with a dimming scrim instead of
 * stealing layout width (iPadOS behavior).
 *
 * Client component — it owns the presented state + the toggle handler.
 */
import * as React from "react";
import { materialClass, glass } from "../../system/effects";
import { useLiquidGlass, glassSurfaceClass } from "../presentation/glassChrome";
import "./Inspector.global.css";

/**
 * `inspectorColumnWidth(_:)` value: a fixed px width, or the `(min:ideal:max:)`
 * overload. `ideal` is required in the three-arg form; `min`/`max` are optional.
 */
export type InspectorColumnWidth =
  | number
  | { min?: number; ideal: number; max?: number };

/** A controlled `inspector(isPresented:)` binding: `[shown, setShown]`. */
export type InspectorPresentedBinding = [boolean, (next: boolean) => void];

export interface InspectorProps {
  /**
   * `isPresented:` — controlled visibility. Pass `[shown, setShown]` (the
   * `Binding<Bool>` analogue). When the panel is dismissed (e.g. its close
   * button, or the compact-mode scrim) `setShown(false)` is called.
   */
  isPresented: InspectorPresentedBinding;
  /** The inspector panel content (SwiftUI's `@ViewBuilder content`). */
  inspector: React.ReactNode;
  /**
   * `inspectorColumnWidth(_:)` / `(min:ideal:max:)` — the panel's width. A number
   * is a fixed column; the `{min,ideal,max}` form is a resizable clamp() track.
   * Default `{ min: 200, ideal: 270, max: 400 }` (the macOS inspector defaults).
   */
  columnWidth?: InspectorColumnWidth;
  /** The primary content the inspector sits beside (children). */
  children: React.ReactNode;
  /**
   * iOS-26 Liquid Glass panel. Unset ⇒ follow `useEnvironment().designMode`
   * (glass in iOS-26). `false` ⇒ the classic frosted/grouped opaque panel.
   */
  glass?: boolean;
  /** Show the panel's trailing-edge close (✕) affordance. Default `true`. */
  showsCloseButton?: boolean;
  /** Accessible label for the panel region. Default `"Inspector"`. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_WIDTH: { min: number; ideal: number; max: number } = {
  min: 200,
  ideal: 270,
  max: 400,
};

/** Resolve an `InspectorColumnWidth` to a CSS grid-track string. */
function widthTrack(w: InspectorColumnWidth | undefined): string {
  if (w == null) {
    const { min, ideal, max } = DEFAULT_WIDTH;
    return `clamp(${min}px, ${ideal}px, ${max}px)`;
  }
  if (typeof w === "number") return `${w}px`;
  const min = w.min != null ? `${w.min}px` : `${DEFAULT_WIDTH.min}px`;
  const max = w.max != null ? `${w.max}px` : `${DEFAULT_WIDTH.max}px`;
  return `clamp(${min}, ${w.ideal}px, ${max})`;
}

export const Inspector = React.forwardRef<HTMLDivElement, InspectorProps>(
  function Inspector(
    {
      isPresented,
      inspector,
      columnWidth,
      children,
      glass: glassProp,
      showsCloseButton = true,
      label = "Inspector",
      className,
      style,
    },
    ref,
  ) {
    const [shown, setShown] = isPresented;
    const glassy = useLiquidGlass(glassProp);

    const track = widthTrack(columnWidth);
    const rootStyle: React.CSSProperties = {
      // The trailing column collapses to 0 when dismissed (animated by CSS).
      ["--sui-inspector-w" as string]: track,
      ...style,
    };

    const panelClass = [
      "sui-inspector-panel",
      glassy ? glassSurfaceClass(glass.regular) : materialClass("regular"),
    ].join(" ");

    return (
      <div
        ref={ref}
        className={["sui-inspector", className].filter(Boolean).join(" ")}
        data-presented={shown ? "true" : "false"}
        data-glass={glassy ? "true" : undefined}
        style={rootStyle}
      >
        <div className="sui-inspector-main">{children}</div>

        {/* compact-mode dimming scrim — taps dismiss the overlaying drawer */}
        <button
          type="button"
          className="sui-inspector-scrim"
          aria-hidden={!shown}
          tabIndex={-1}
          onClick={() => setShown(false)}
        />

        <aside
          className={panelClass}
          role="complementary"
          aria-label={label}
          aria-hidden={!shown}
          // when collapsed the panel must not be focusable/tabbable (React 19 inert)
          inert={!shown}
        >
          <div className="sui-inspector-panel-inner">
            {showsCloseButton ? (
              <div className="sui-inspector-toolbar">
                <button
                  type="button"
                  className="sui-inspector-close"
                  aria-label="Hide inspector"
                  onClick={() => setShown(false)}
                >
                  <span aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <div className="sui-inspector-content">{inspector}</div>
          </div>
        </aside>
      </div>
    );
  },
);

Inspector.displayName = "Inspector";

/**
 * `InspectorToggleButton` — a convenience control that flips an
 * `inspector(isPresented:)` binding. SwiftUI usually drives this via a toolbar
 * `Button`; this is the standalone web helper so a host can drop a "show
 * inspector" affordance without rewiring the binding.
 */
export interface InspectorToggleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isPresented: InspectorPresentedBinding;
  children?: React.ReactNode;
}

export function InspectorToggleButton({
  isPresented,
  children,
  className,
  ...rest
}: InspectorToggleButtonProps): React.ReactElement {
  const [shown, setShown] = isPresented;
  return (
    <button
      type="button"
      className={["sui-inspector-toggle", className].filter(Boolean).join(" ")}
      aria-pressed={shown}
      onClick={() => setShown(!shown)}
      {...rest}
    >
      {children ?? <span className="sui-inspector-toggle-glyph" aria-hidden="true" />}
    </button>
  );
}
InspectorToggleButton.displayName = "InspectorToggleButton";
