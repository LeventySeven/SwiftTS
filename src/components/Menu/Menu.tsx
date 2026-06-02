"use client";
/**
 * `Menu` — `SwiftUI.Menu<Label, Content>` (SwiftUI :6960).
 *
 * RE'd from `teardowns/SWIFTUI_C2_action-controls.md` §3.
 *
 *   Menu { content } label: { label }                // :6975
 *   Menu(_:) { content }            where Label==Text // :6976 / :6982
 *   Menu(_:systemImage:) { content }                  // :7003
 *   Menu(content:label:primaryAction:)                // :6986  (split-button)
 *
 * Trigger = `<button aria-haspopup="menu" aria-expanded>` (label + pull-down
 * chevron). Popup = `<ul role="menu">` with `<button role="menuitem">` rows on a
 * regularMaterial frosted panel. Behavior: tap trigger opens (scale+fade);
 * tap a row fires its action and dismisses (unless `dismissOnSelect={false}` ⇒
 * `menuActionDismissBehavior(.disabled)`); outside-click / Esc dismiss; ↑/↓ move
 * the active row, Return activates, Esc closes; focus is trapped while open.
 *
 * The `primaryAction` form is the split-button pattern: a plain tap fires
 * `primaryAction`; the menu opens only via the chevron affordance (or long-press).
 */
import * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { materialClass } from "../../system/effects";
import type { ButtonRole } from "../Button/Button";
import { SymbolGlyph } from "../controls/SymbolGlyph";
import { useIsDisabled } from "../controls/controlMachinery";
import styles from "./Menu.module.css";

/* ---------------------------------------------------------------------------
 * Menu context — lets MenuItem rows fire + dismiss without prop-drilling.
 * ------------------------------------------------------------------------- */
interface MenuCtx {
  /** Called by a row after its action fires; dismisses unless dismiss is off. */
  close: () => void;
  dismissOnSelect: boolean;
}
const MenuContext = createContext<MenuCtx | null>(null);

export interface MenuProps {
  /** Text label convenience. */
  label?: string;
  /** Leading SF Symbol for the trigger label. */
  systemImage?: string;
  /** ViewBuilder content — the menu items (<MenuItem> / <MenuDivider>). */
  children: React.ReactNode;
  /** Custom trigger label (overrides `label`/`systemImage`). */
  triggerLabel?: React.ReactNode;
  /** Split-button form — a plain tap fires this; menu opens via the chevron. */
  primaryAction?: () => void;
  /** `.menuStyle(_:)` — affects trigger chrome only (rows are identical). */
  menuStyle?: "automatic" | "button" | "borderedButton" | "borderlessButton";
  /** `menuActionDismissBehavior` — default true (chosen item dismisses). */
  dismissOnSelect?: boolean;
  /** Anchor side for the popup. */
  align?: "leading" | "trailing";
  /** `.disabled(_:)`. */
  disabled?: boolean;
}

export const Menu = React.forwardRef<HTMLDivElement, MenuProps>(function Menu(
  {
    label,
    systemImage,
    children,
    triggerLabel,
    primaryAction,
    dismissOnSelect = true,
    align = "leading",
    disabled,
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLUListElement>(null);
  const isDisabled = useIsDisabled(disabled);
  const menuId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // Outside-click + Escape dismissal while open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close]);

  // Focus the popup when it opens so arrow keys land on it.
  useEffect(() => {
    if (open) popupRef.current?.focus();
  }, [open]);

  const itemCount = React.Children.toArray(children).filter((c) =>
    React.isValidElement(c) && (c.type as { __isMenuItem?: boolean }).__isMenuItem,
  ).length;

  const onTriggerClick = () => {
    if (isDisabled) return;
    if (primaryAction) {
      primaryAction();
      return;
    }
    setOpen((o) => !o);
  };

  const onChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDisabled) return;
    setOpen((o) => !o);
  };

  const onPopupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(itemCount, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + itemCount) % Math.max(itemCount, 1));
    }
  };

  const triggerContent =
    triggerLabel ??
    (label != null || systemImage != null ? (
      <>
        {systemImage ? (
          <SymbolGlyph name={systemImage} className={styles.triggerIcon} />
        ) : null}
        {label}
      </>
    ) : null);

  // Tag each menu item with its index so keyboard highlight can target it.
  let itemIndex = -1;
  const wrappedChildren = React.Children.map(children, (child) => {
    if (
      React.isValidElement(child) &&
      (child.type as { __isMenuItem?: boolean }).__isMenuItem
    ) {
      itemIndex += 1;
      const idx = itemIndex;
      return React.cloneElement(child as React.ReactElement<MenuItemProps>, {
        _active: idx === activeIndex,
      });
    }
    return child;
  });

  return (
    <div className={styles.anchor} ref={mergeRefs(ref, anchorRef)}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={isDisabled}
        onClick={onTriggerClick}
      >
        {triggerContent}
        <span
          className={styles.chevron}
          onClick={primaryAction ? onChevronClick : undefined}
          aria-hidden="true"
        >
          <SymbolGlyph name="chevron.up.chevron.down" />
        </span>
      </button>

      {open ? (
        <MenuContext.Provider value={{ close, dismissOnSelect }}>
          <ul
            ref={popupRef}
            id={menuId}
            role="menu"
            tabIndex={-1}
            data-align={align}
            className={`${styles.popup} ${materialClass("regular")}`}
            onKeyDown={onPopupKeyDown}
          >
            {wrappedChildren}
          </ul>
        </MenuContext.Provider>
      ) : null}
    </div>
  );
});

Menu.displayName = "Menu";

/* ---------------------------------------------------------------------------
 * MenuItem
 * ------------------------------------------------------------------------- */
export interface MenuItemProps {
  /** Row title. */
  title?: string;
  /** Trailing SF Symbol icon. */
  systemImage?: string;
  /** `.destructive` renders the row red. */
  role?: ButtonRole;
  /** The item's action. */
  action: () => void;
  /** Disabled row. */
  disabled?: boolean;
  children?: React.ReactNode;
  /** Internal: set by <Menu> for keyboard highlight. */
  _active?: boolean;
}

export const MenuItem: React.FC<MenuItemProps> & { __isMenuItem?: boolean } =
  function MenuItem({ title, systemImage, role, action, disabled, children, _active }) {
    const ctx = useContext(MenuContext);
    const onClick = () => {
      action();
      if (ctx?.dismissOnSelect) ctx.close();
    };
    return (
      <li role="none">
        <button
          type="button"
          role="menuitem"
          className={styles.item}
          data-role={role}
          data-active={_active || undefined}
          disabled={disabled}
          onClick={onClick}
        >
          <span className={styles.itemTitle}>{children ?? title}</span>
          {systemImage ? (
            <SymbolGlyph name={systemImage} className={styles.itemIcon} />
          ) : null}
        </button>
      </li>
    );
  };
MenuItem.__isMenuItem = true;

/* ---------------------------------------------------------------------------
 * MenuDivider — a hairline between item groups.
 * ------------------------------------------------------------------------- */
export const MenuDivider: React.FC = function MenuDivider() {
  return <li role="separator" className={styles.divider} />;
};

/* ---------------------------------------------------------------------------
 * mergeRefs — combine the forwarded ref with the internal anchor ref.
 * ------------------------------------------------------------------------- */
function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node: T | null) => {
    for (const r of refs) {
      if (typeof r === "function") r(node);
      else if (r && typeof r === "object")
        (r as React.MutableRefObject<T | null>).current = node;
    }
  };
}
