"use client";
/**
 * MacSplitView — the macOS sidebar | content (| inspector) split.
 *
 * A horizontal split with a leading SIDEBAR pane, a flexible CONTENT pane, and an
 * optional trailing INSPECTOR pane. Between adjacent panes sits a DRAGGABLE
 * HAIRLINE DIVIDER (a 1px line in a ~7px col-resize grab zone). Dragging a
 * divider resizes ONLY the fixed-width pane on its sidebar/inspector side — the
 * content pane absorbs the slack (mirrors NSSplitView, where a divider resizes
 * its neighbor and the priority pane flexes).
 *
 * macOS proportions by default: sidebar ~220px (min 150 / max 400), inspector
 * ~260px (min 180 / max 460). Both panes are width-controllable + clampable.
 * Sizes live in component state (uncontrolled) unless you pass the controlled
 * `sidebarWidth` / `inspectorWidth` + their `on…Change` callbacks.
 *
 * The pointer-drag is self-contained (Pointer Events + setPointerCapture): on
 * pointerdown we capture, record the start X + start width, and on pointermove
 * apply `clamp(startWidth ± dx)` (the leading divider grows the sidebar as it
 * moves right; the trailing divider grows the inspector as it moves left).
 *
 * Stateful (drag state, pane sizes) → `"use client"`. SSR-safe (all window reads
 * are inside pointer handlers / refs, never at module/render top level).
 */
import * as React from "react";
import styles from "./macos.module.css";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export interface MacSplitViewProps {
  /** Leading sidebar pane. */
  sidebar?: React.ReactNode;
  /** Center content pane (flexes to fill). */
  children?: React.ReactNode;
  /** Trailing inspector pane (optional 3rd column). */
  inspector?: React.ReactNode;

  /** Sidebar width in px — controlled when paired with `onSidebarWidthChange`. */
  sidebarWidth?: number;
  onSidebarWidthChange?: (width: number) => void;
  /** Uncontrolled initial sidebar width (default 220). */
  defaultSidebarWidth?: number;
  /** Sidebar drag clamps (default min 150 / max 400). */
  minSidebarWidth?: number;
  maxSidebarWidth?: number;

  /** Inspector width in px — controlled when paired with `onInspectorWidthChange`. */
  inspectorWidth?: number;
  onInspectorWidthChange?: (width: number) => void;
  /** Uncontrolled initial inspector width (default 260). */
  defaultInspectorWidth?: number;
  /** Inspector drag clamps (default min 180 / max 460). */
  minInspectorWidth?: number;
  maxInspectorWidth?: number;

  /** Disable the divider drag (fixed proportions). */
  resizable?: boolean;

  className?: string;
  style?: React.CSSProperties;
}

/** A draggable hairline divider. `edge` decides drag direction sign:
 *  - "leading" (sidebar↔content): drag right → wider sidebar (dx adds).
 *  - "trailing" (content↔inspector): drag left → wider inspector (dx subtracts). */
function Divider({
  edge,
  width,
  setWidth,
  min,
  max,
  disabled,
  label,
}: {
  edge: "leading" | "trailing";
  width: number;
  setWidth: (w: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  label: string;
}): React.ReactElement {
  const [dragging, setDragging] = React.useState(false);
  const start = React.useRef({ x: 0, w: width });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: width };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - start.current.x;
    const delta = edge === "leading" ? dx : -dx;
    setWidth(clamp(start.current.w + delta, min, max));
  };
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
    setDragging(false);
  };

  // Keyboard resize (arrow keys nudge by 8px) for accessibility.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = e.shiftKey ? 24 : 8;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setWidth(clamp(width + (edge === "leading" ? -step : step), min, max));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setWidth(clamp(width + (edge === "leading" ? step : -step), min, max));
    }
  };

  return (
    <div
      className={styles.divider}
      data-dragging={dragging ? "true" : undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={disabled ? undefined : 0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
    />
  );
}

export const MacSplitView = React.forwardRef<HTMLDivElement, MacSplitViewProps>(
  function MacSplitView(
    {
      sidebar,
      children,
      inspector,
      sidebarWidth,
      onSidebarWidthChange,
      defaultSidebarWidth = 220,
      minSidebarWidth = 150,
      maxSidebarWidth = 400,
      inspectorWidth,
      onInspectorWidthChange,
      defaultInspectorWidth = 260,
      minInspectorWidth = 180,
      maxInspectorWidth = 460,
      resizable = true,
      className,
      style,
    },
    ref,
  ) {
    const [sbInner, setSbInner] = React.useState(defaultSidebarWidth);
    const [insInner, setInsInner] = React.useState(defaultInspectorWidth);

    const sbControlled = sidebarWidth !== undefined;
    const insControlled = inspectorWidth !== undefined;
    const sb = sbControlled ? sidebarWidth : sbInner;
    const ins = insControlled ? inspectorWidth : insInner;

    const setSb = (w: number) => {
      if (!sbControlled) setSbInner(w);
      onSidebarWidthChange?.(w);
    };
    const setIns = (w: number) => {
      if (!insControlled) setInsInner(w);
      onInspectorWidthChange?.(w);
    };

    const hasSidebar = sidebar != null;
    const hasInspector = inspector != null;

    return (
      <div
        ref={ref}
        className={[styles.split, className].filter(Boolean).join(" ")}
        style={style}
      >
        {hasSidebar ? (
          <>
            <div
              className={[styles.splitPane, styles.splitSidebarPane].join(" ")}
              style={{ width: sb, flexBasis: sb }}
            >
              {sidebar}
            </div>
            <Divider
              edge="leading"
              width={sb}
              setWidth={setSb}
              min={minSidebarWidth}
              max={maxSidebarWidth}
              disabled={!resizable}
              label="Resize sidebar"
            />
          </>
        ) : null}

        <div className={[styles.splitPane, styles.splitContent].join(" ")}>
          {children}
        </div>

        {hasInspector ? (
          <>
            <Divider
              edge="trailing"
              width={ins}
              setWidth={setIns}
              min={minInspectorWidth}
              max={maxInspectorWidth}
              disabled={!resizable}
              label="Resize inspector"
            />
            <div
              className={[styles.splitPane, styles.splitInspectorPane].join(" ")}
              style={{ width: ins, flexBasis: ins }}
            >
              {inspector}
            </div>
          </>
        ) : null}
      </div>
    );
  },
);

MacSplitView.displayName = "MacSplitView";
