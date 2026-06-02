"use client";
/**
 * `HSplitView` — SwiftUI's horizontal resizable split container (macOS-only).
 *
 * RE'd from the macOS SDK `.swiftinterface`:
 *
 *   @available(macOS 10.15, *) @available(iOS/tvOS/watchOS/visionOS, unavailable)
 *   public struct HSplitView<Content> : View where Content : View {
 *     public init(@ViewBuilder content: () -> Content)
 *   }
 *
 * The struct surface is intentionally tiny — `HSplitView { a; b; c }` takes ONLY
 * a `@ViewBuilder` of panes. There is NO spacing, alignment, or divider param:
 * AppKit's `NSSplitView` injects a draggable divider BETWEEN each adjacent pair
 * of subviews and lays them out as columns. The only knobs come from the panes
 * themselves via `.frame(minWidth:idealWidth:maxWidth:)` and the (separate)
 * `.layoutPriority`, which the divider drag respects as min/max clamps.
 *
 * Web mapping:
 *   - The container is a row flexbox (`display:flex; flex-direction:row`).
 *   - Each child pane is wrapped in a flex item whose `flex-basis` is the pane's
 *     live width in px (state), so dragging a divider re-distributes width
 *     between the two ADJACENT panes only — exactly NSSplitView's behavior
 *     (a divider resizes its left/right neighbors, not the whole stack).
 *   - Between every adjacent pair we render a `<div role="separator">` drag
 *     handle. The pointer-drag is driven by `useDragGesture` from
 *     `system/gestures.ts` (global coordinate space so we get raw clientX), with
 *     `minimumDistance: 0` so the resize begins immediately on press (a divider
 *     is a knob, not a swipe — same pattern the kit's Slider uses).
 *   - Live sizes persist in component state; the first non-controlled layout
 *     measures the rendered panes once and seeds equal/auto basis.
 *
 * Min/max clamps: each pane may pass `minWidth` / `maxWidth` (px) which the drag
 * honors so a pane can't be dragged past its content's minimum — mirroring
 * `.frame(minWidth:maxWidth:)` feeding NSSplitView's `minimumThickness`.
 *
 * Renders through `<View>` so every styling modifier prop is supported.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import { useDragGesture } from "../../system/gestures";
import styles from "./SplitView.module.css";

/** Per-pane resize constraints, read off each child's props if present. */
interface PaneConstraint {
  /** floor in px (mirrors `.frame(minWidth:)`). Default 40. */
  min: number;
  /** ceiling in px (mirrors `.frame(maxWidth:)`). Default Infinity. */
  max: number;
  /** seed basis in px (mirrors `.frame(idealWidth:)` / `width:`). */
  ideal?: number;
}

export interface SplitPaneProps {
  /** Minimum pane size in px along the split axis (drag floor). */
  minWidth?: number;
  /** Maximum pane size in px along the split axis (drag ceiling). */
  maxWidth?: number;
  /** Ideal/initial pane size in px along the split axis (seed). */
  idealWidth?: number;
  /** Vertical variant aliases (used by VSplitView). */
  minHeight?: number;
  maxHeight?: number;
  idealHeight?: number;
}

export interface HSplitViewProps extends Omit<ViewProps, "as"> {
  /** The panes (SwiftUI's `@ViewBuilder content`). 2+ children → dividers. */
  children?: React.ReactNode;
  /**
   * Divider thickness in px. AppKit's thin divider is ~1px with a wider hit
   * target; we render a 1px line inside a 10px draggable gutter by default.
   */
  dividerThickness?: number;
}

/** Pull `{min,max,ideal}` off a pane element's props (width or height axis). */
function readConstraint(
  el: React.ReactNode,
  axis: "width" | "height",
): PaneConstraint {
  const def: PaneConstraint = { min: 40, max: Infinity };
  if (!React.isValidElement(el)) return def;
  const p = el.props as SplitPaneProps & { frame?: Record<string, unknown> };
  const minK = axis === "width" ? "minWidth" : "minHeight";
  const maxK = axis === "width" ? "maxWidth" : "maxHeight";
  const idK = axis === "width" ? "idealWidth" : "idealHeight";
  // Also accept the values coming through a `frame={{ ... }}` modifier prop.
  const frame = p.frame ?? {};
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const min = num(p[minK]) ?? num(frame[minK]) ?? 40;
  const max = num(p[maxK]) ?? num(frame[maxK]) ?? Infinity;
  const ideal = num(p[idK]) ?? num(frame[idK]) ?? num(frame.width);
  return { min, max, ideal };
}

/**
 * One draggable divider between pane `index` and `index+1`. Owns its own
 * pointer-drag via `useDragGesture` (global space, minimumDistance 0 so the
 * resize starts on press). On each change it asks the parent to transfer the
 * horizontal delta between the two adjacent panes (clamped to their min/max).
 */
function HDivider({
  index,
  thickness,
  onResize,
  vertical,
}: {
  index: number;
  thickness: number;
  onResize: (index: number, deltaPx: number) => void;
  vertical: boolean;
}): React.JSX.Element {
  // Track the last raw client coordinate so we feed an incremental delta.
  const lastRef = React.useRef<number | null>(null);
  const drag = useDragGesture(
    { minimumDistance: 0, coordinateSpace: "global" },
    {
      onChanged: (v) => {
        const cur = vertical
          ? v.startLocation.y + v.translation.height
          : v.startLocation.x + v.translation.width;
        const last = lastRef.current;
        if (last !== null) onResize(index, cur - last);
        lastRef.current = cur;
      },
      onEnded: () => {
        lastRef.current = null;
      },
    },
  );

  return (
    <div
      {...drag.handlers}
      ref={drag.ref as React.RefObject<HTMLDivElement>}
      role="separator"
      aria-orientation={vertical ? "horizontal" : "vertical"}
      tabIndex={0}
      className={`${styles.gutter} ${vertical ? styles.gutterV : styles.gutterH}`}
      style={{
        flex: `0 0 ${thickness}px`,
        // a divider is a knob — start resizing on press, never scroll the page.
        touchAction: "none",
        cursor: vertical ? "row-resize" : "col-resize",
      }}
    >
      <span aria-hidden className={styles.gutterLine} />
    </div>
  );
}

/**
 * Shared engine for H/V split. `vertical=false` ⇒ HSplitView (columns + vertical
 * dividers); `vertical=true` ⇒ VSplitView (rows + horizontal dividers). Both
 * collapse to: a flexbox along the main axis, panes sized by live `flex-basis`
 * (px) in state, dividers transferring drag delta between adjacent panes.
 */
export function SplitViewImpl({
  children,
  vertical,
  dividerThickness = 10,
  style,
  className,
  ...rest
}: HSplitViewProps & { vertical: boolean }): React.JSX.Element {
  const panes = React.useMemo(
    () => React.Children.toArray(children).filter(React.isValidElement),
    [children],
  );
  const axis = vertical ? "height" : "width";
  const constraints = React.useMemo(
    () => panes.map((p) => readConstraint(p, axis)),
    [panes, axis],
  );

  // Live pane sizes (px) along the split axis. `null` ⇒ not yet measured (let
  // CSS distribute via flex-grow); after the first drag every pane is pinned.
  const [sizes, setSizes] = React.useState<(number | null)[]>(() =>
    panes.map((_, i) => constraints[i]?.ideal ?? null),
  );
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Keep the sizes array length in sync if the pane count changes.
  React.useEffect(() => {
    setSizes((prev) => {
      if (prev.length === panes.length) return prev;
      return panes.map((_, i) => prev[i] ?? constraints[i]?.ideal ?? null);
    });
  }, [panes.length, constraints, panes]);

  const clamp = React.useCallback(
    (i: number, px: number) => {
      const c = constraints[i] ?? { min: 40, max: Infinity };
      return Math.max(c.min, Math.min(c.max, px));
    },
    [constraints],
  );

  /**
   * Transfer `deltaPx` from pane `i+1` to pane `i` (dragging the divider right/
   * down grows `i`, shrinks `i+1`). We first materialize any `null` (CSS-auto)
   * sizes into measured px from the live DOM so the first drag is stable, then
   * clamp both neighbors to their min/max and only commit if BOTH stay legal.
   */
  const onResize = React.useCallback(
    (i: number, deltaPx: number) => {
      setSizes((prev) => {
        const next = prev.slice();
        const host = containerRef.current;
        // Materialize current rendered px for every pane the first time.
        if (host) {
          const items = host.querySelectorAll<HTMLElement>(
            `.${styles.pane}`,
          );
          for (let k = 0; k < next.length; k++) {
            if (next[k] == null && items[k]) {
              const r = items[k].getBoundingClientRect();
              next[k] = vertical ? r.height : r.width;
            }
          }
        }
        const a = next[i];
        const b = next[i + 1];
        if (a == null || b == null) return next;
        const newA = clamp(i, a + deltaPx);
        const newB = clamp(i + 1, b - (newA - a)); // conserve the pair's total
        // Re-derive A from the clamped B so the pair sum is exactly preserved.
        const finalA = a + (b - newB);
        next[i] = clamp(i, finalA);
        next[i + 1] = newB;
        return next;
      });
    },
    [clamp, vertical],
  );

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: vertical ? "column" : "row",
    alignItems: "stretch",
    width: "100%",
    height: vertical ? "100%" : undefined,
    minHeight: vertical ? 0 : undefined,
    overflow: "hidden",
  };

  return (
    <View
      ref={(el) => {
        containerRef.current = el as HTMLDivElement | null;
      }}
      className={[styles.container, className].filter(Boolean).join(" ") || undefined}
      style={mergeStyles(containerStyle, style)}
      data-axis={vertical ? "vertical" : "horizontal"}
      {...rest}
    >
      {panes.map((pane, i) => {
        const size = sizes[i];
        const paneStyle: React.CSSProperties =
          size != null
            ? { flex: `0 0 ${size}px`, minWidth: 0, minHeight: 0, overflow: "auto" }
            : { flex: "1 1 0", minWidth: 0, minHeight: 0, overflow: "auto" };
        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              <HDivider
                index={i - 1}
                thickness={dividerThickness}
                onResize={onResize}
                vertical={vertical}
              />
            ) : null}
            <div className={styles.pane} style={paneStyle}>
              {pane}
            </div>
          </React.Fragment>
        );
      })}
    </View>
  );
}

/**
 * `HSplitView { … }` — horizontal split: panes laid out in COLUMNS, separated by
 * draggable VERTICAL dividers that resize the two adjacent columns.
 *
 *   <HSplitView>
 *     <Sidebar minWidth={180} maxWidth={400} idealWidth={240} />
 *     <Detail />
 *   </HSplitView>
 */
export const HSplitView = React.forwardRef<HTMLElement, HSplitViewProps>(
  function HSplitView(props, _ref) {
    return <SplitViewImpl {...props} vertical={false} />;
  },
);

HSplitView.displayName = "HSplitView";
