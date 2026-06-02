"use client";
/**
 * `ContextMenu` — SwiftUI's long-press menu + preview (C8 §6).
 *
 * Mirrors `.contextMenu(menuItems:)`, `.contextMenu(menuItems:preview:)`, and the
 * selection variant `.contextMenu(forSelectionType:menu:primaryAction:)`.
 *
 * Trigger: long-press ≈0.5s (touch, via `useLongPressGesture`) or right-/Ctrl-click
 * (desktop, `contextmenu` event). On open: the backdrop blurs+dims, the source lifts
 * (or a `preview` card floats in its place), and a rounded vibrant-material menu
 * scales+fades from its anchor edge. `primaryAction` fires on a PLAIN tap (no menu).
 * Dismiss: tap outside, Esc, or selecting a row.
 */
import * as React from "react";
import {
  PresentationPortal,
  PRESENTATION_Z,
  usePresentation,
  useFocusTrap,
} from "./PresentationRoot";
import { useLongPressGesture } from "../../system/gestures";
import { springCss } from "../../system/animation";
import { glass, glassClass } from "../../system/effects";
import {
  useLiquidGlass,
  glassRowClass,
  glassPreviewClass,
  glassScrimClass,
  concentricVars,
  chromeClasses,
} from "./glassChrome";
import styles from "./ContextMenu.module.css";

/* ===========================================================================
 * 1. Menu rows — <Menu.Button> / <Menu.Divider>.
 * ======================================================================== */

export type MenuItemRole = "default" | "destructive";

export interface MenuButtonProps {
  role?: MenuItemRole;
  onAction?: () => void;
  /** Trailing SF-symbol-class icon (optional). */
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/** `<Menu.Button>` marker; the menu reads its props to build a row. */
export function MenuButton(_props: MenuButtonProps): React.JSX.Element | null {
  return null;
}
MenuButton.displayName = "Menu.Button";

export function MenuDivider(): React.JSX.Element | null {
  return null;
}
MenuDivider.displayName = "Menu.Divider";

interface ParsedRow {
  kind: "button" | "divider";
  role?: MenuItemRole;
  onAction?: () => void;
  icon?: React.ReactNode;
  label?: React.ReactNode;
}

function parseMenu(children: React.ReactNode): ParsedRow[] {
  const out: ParsedRow[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const t = child.type as { displayName?: string };
    if (t?.displayName === "Menu.Divider") {
      out.push({ kind: "divider" });
    } else if (t?.displayName === "Menu.Button") {
      const p = child.props as MenuButtonProps;
      out.push({
        kind: "button",
        role: p.role ?? "default",
        onAction: p.onAction,
        icon: p.icon,
        label: p.children,
      });
    }
  });
  return out;
}

/* ===========================================================================
 * 2. <ContextMenu> wrapper.
 * ======================================================================== */

export interface ContextMenuProps {
  /** The menu rows (`<Menu.Button>` / `<Menu.Divider>`). */
  menu: React.ReactNode;
  /** Optional floating preview card (iOS) shown above the menu on long-press. */
  preview?: React.ReactNode;
  /** Selection-variant: fires on a PLAIN tap (no menu). */
  onPrimaryAction?: () => void;
  /** Long-press duration in seconds (default 0.5). */
  longPressDuration?: number;
  /**
   * Liquid-Glass override. Unset ⇒ follow `useEnvironment().liquidGlass` (default
   * glass). `false` ⇒ classic frosted Material menu + plain preview card.
   */
  glass?: boolean;
  /** The anchor view (the wrapper's children). */
  children: React.ReactNode;
}

interface OpenState {
  open: boolean;
  /** anchor rect at open time (viewport coords). */
  rect: DOMRect | null;
}

const MENU_W = 250;
const MENU_GAP = 12;

export function ContextMenu(props: ContextMenuProps): React.JSX.Element {
  const {
    menu,
    preview,
    onPrimaryAction,
    longPressDuration = 0.5,
    glass: glassProp,
    children,
  } = props;

  const glassy = useLiquidGlass(glassProp);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<OpenState>({ open: false, rect: null });

  const open = React.useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect() ?? null;
    setState({ open: true, rect });
  }, []);
  const close = React.useCallback(() => setState((s) => ({ ...s, open: false })), []);

  // Long-press (touch) → open menu; a plain tap → primaryAction.
  const longPress = useLongPressGesture(
    { minimumDuration: longPressDuration },
    {
      onEnded: () => open(),
    },
  );

  // Desktop: right-/Ctrl-click opens at the anchor.
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    open();
  };

  // Plain click → primaryAction (only when not opening the menu).
  const onClick = () => {
    if (!state.open && onPrimaryAction) onPrimaryAction();
  };

  return (
    <>
      <div
        ref={anchorRef}
        {...longPress.handlers}
        onContextMenu={onContextMenu}
        onClick={onClick}
        // inline-block so the wrapper has a real box (getBoundingClientRect) to
        // anchor the preview/menu — `display:contents` would yield a zero rect.
        style={{ ...longPress.style, display: "inline-block" }}
      >
        {children}
      </div>
      <ContextMenuOverlay
        open={state.open}
        rect={state.rect}
        menu={menu}
        preview={preview}
        glassy={glassy}
        onClose={close}
      />
    </>
  );
}

ContextMenu.Button = MenuButton;
ContextMenu.Divider = MenuDivider;

/* ===========================================================================
 * 3. The portal overlay (backdrop + preview + menu).
 * ======================================================================== */

interface OverlayProps {
  open: boolean;
  rect: DOMRect | null;
  menu: React.ReactNode;
  preview?: React.ReactNode;
  glassy: boolean;
  onClose: () => void;
}

function ContextMenuOverlay({
  open,
  rect,
  menu,
  preview,
  glassy,
  onClose,
}: OverlayProps): React.JSX.Element {
  const { mounted, dataState, reduceMotion, surfaceProps } = usePresentation({
    isPresented: open,
    animation: "snappy",
  });

  const menuRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const rows = React.useMemo(() => parseMenu(menu), [menu]);

  useFocusTrap(containerRef, mounted && open, { onEscape: onClose, autoFocus: true });

  if (!mounted || !rect) return <></>;

  const presented = dataState === "presented";

  // Position the preview at the anchor; the menu below it (or above if no room).
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const previewH = preview ? rect.height : rect.height;
  const menuTop = rect.bottom + MENU_GAP;
  const placeBelow = menuTop + 44 * Math.max(1, rows.length) < vh;

  const previewStyle: React.CSSProperties = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    transition: reduceMotion
      ? "opacity 0.2s linear"
      : `${springCss("snappy", { property: "transform" })}, opacity 0.2s linear`,
  };

  const menuX = Math.min(Math.max(8, rect.left), vw - MENU_W - 8);
  const menuStyle: React.CSSProperties = {
    left: menuX,
    minWidth: MENU_W,
    [placeBelow ? "top" : "bottom"]: placeBelow
      ? rect.bottom + MENU_GAP
      : vh - rect.top + MENU_GAP,
    transformOrigin: placeBelow ? "top center" : "bottom center",
    transition: reduceMotion
      ? "opacity 0.2s linear"
      : `${springCss("snappy", { property: "transform" })}, opacity 0.15s linear`,
  };

  const runRow = (row: ParsedRow) => {
    row.onAction?.();
    onClose();
  };

  return (
    <PresentationPortal zIndex={PRESENTATION_Z.contextMenu}>
      <div
        ref={containerRef}
        className={styles.host}
        data-state={dataState}
        role="presentation"
        onClick={(e) => {
          // Click on the backdrop dismisses.
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className={chromeClasses(styles.backdrop, glassScrimClass(glassy))}
          onClick={onClose}
        />
        {preview != null && (
          <div
            className={chromeClasses(styles.preview, glassPreviewClass(glassy))}
            data-glass={glassy ? "true" : undefined}
            style={glassy ? { ...previewStyle, ...concentricVars(14) } : previewStyle}
            onTransitionEnd={surfaceProps.onTransitionEnd}
          >
            {preview}
          </div>
        )}
        <div
          ref={menuRef}
          className={chromeClasses(
            styles.menu,
            glassy && styles.menuGlass,
            glassy && `${glassClass(glass.regular)} sui-glass-chrome`,
          )}
          role="menu"
          data-state={dataState}
          data-glass={glassy ? "true" : undefined}
          style={glassy ? { ...menuStyle, ...concentricVars(13) } : menuStyle}
          // When no preview, the menu drives the exit transitionend.
          onTransitionEnd={preview == null ? surfaceProps.onTransitionEnd : undefined}
        >
          {rows.map((row, i) =>
            row.kind === "divider" ? (
              <div key={i} className={styles.divider} role="separator" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={chromeClasses(styles.row, glassRowClass(glassy))}
                data-role={row.role}
                onClick={() => runRow(row)}
              >
                <span>{row.label}</span>
                {row.icon != null && <span aria-hidden="true">{row.icon}</span>}
              </button>
            ),
          )}
        </div>
        {/* keep `presented` referenced for lint while the CSS keys off data-state */}
        <span hidden>{presented ? "" : ""}</span>
      </div>
    </PresentationPortal>
  );
}

/* ===========================================================================
 * 4. useContextMenu hook — imperative open at a point (right-click anywhere).
 * ======================================================================== */

export interface UseContextMenuResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * `useContextMenu()` — owns the open state + anchor ref for callers that drive the
 * menu themselves (e.g. table rows). For the common case, prefer the declarative
 * `<ContextMenu>` wrapper.
 */
export function useContextMenu(): UseContextMenuResult {
  const [isOpen, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  return {
    isOpen,
    open: React.useCallback(() => setOpen(true), []),
    close: React.useCallback(() => setOpen(false), []),
    anchorRef,
  };
}
