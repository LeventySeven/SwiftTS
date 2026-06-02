"use client";
/**
 * `ListRow` — one styled row inside a `List`/`Form` (Cluster C6 §3.3-3.5).
 *
 * Owns the row chrome (separator, insets, background, selection highlight, swipe
 * drawer, edit-mode select circle / reorder grip). Slots `<ListRow.Label>`,
 * `<ListRow.Value>`, `<ListRow.Chevron>`, `<ListRow.Icon>` build the canonical
 * Settings row. Row-trait modifiers map to props:
 *   listRowInsets   → insets
 *   listRowBackground → background
 *   listRowSeparator(.hidden) → separator="hidden"
 *   listRowSeparatorTint → separatorTint
 *   swipeActions(edge:allowsFullSwipe:) → swipeActions
 *
 * Swipe behavior (DESIGNED): a horizontal flex track tracks the pointer; on
 * release a full swipe past 50% fires the first action, otherwise it snaps
 * open/closed with `transform 0.35s cubic-bezier(.22,1,.36,1)`.
 */
import * as React from "react";
import { useListContext, type ListRowHoverEffect } from "./ListContext";
import "./List.global.css";

export type RowSeparatorVisibility = "automatic" | "visible" | "hidden";
export type SwipeEdge = "leading" | "trailing";

/** Built-in trailing accessory (NavigationLink chevron, multi-select checkmark, etc.). */
export type RowAccessory =
  | "chevron"
  | "disclosure"
  | "checkmark"
  | "detail"
  | "none";

export interface SwipeAction {
  label: React.ReactNode;
  /** `Button(role:)` — `"destructive"` paints red. */
  role?: "destructive" | "default";
  /** `.tint(_)` — CSS color or token, overrides the gray/red default. */
  tint?: string;
  onTap?: () => void;
}

export interface SwipeActionsConfig {
  trailing?: SwipeAction[];
  leading?: SwipeAction[];
  /** A full swipe past ~50% auto-fires the first action. Default `true`. */
  allowsFullSwipe?: boolean;
}

export interface RowInsets {
  top?: number;
  leading?: number;
  bottom?: number;
  trailing?: number;
}

export interface ListRowProps {
  /** Stable identity (List(selection:) / scrollPosition). */
  id?: string | number;
  /** Tap handler — also drives the pressed highlight + selection in edit mode. */
  onTap?: () => void;

  /* ---- Clean Row API (LabeledContent-style) — used when no children given ---- */
  /** Primary leading label (`label`, body 17pt). String or node. */
  label?: React.ReactNode;
  /** Trailing value text (`secondaryLabel`, body 17pt). The "Craig F." in Name | Craig F. */
  value?: React.ReactNode;
  /** Optional leading icon / content (29×29 rounded glyph when a string/emoji). */
  leading?: React.ReactNode;
  /** Whether to wrap `leading` in the 29×29 rounded icon chip. Default: auto (true for string leading). */
  leadingAsIcon?: boolean;
  /** Arbitrary trailing content placed after the value (e.g. a Toggle). */
  trailing?: React.ReactNode;
  /** Built-in trailing accessory (`"chevron"` for NavigationLink rows, `"checkmark"`, …). */
  accessory?: RowAccessory;

  /** listRowBackground(_:) — any node painted behind the row (Color/View). */
  background?: React.ReactNode;
  /** listRowInsets(_:). */
  insets?: RowInsets;
  /** listRowSeparator(_:). */
  separator?: RowSeparatorVisibility;
  /** listRowSeparatorTint(_:). */
  separatorTint?: string;
  /** listItemTint(_:) — accent tint for this row's interactive content (overrides list-wide `itemTint`). */
  itemTint?: string;
  /**
   * listRowHoverEffect(_:) — the pointer-hover treatment for THIS row
   * (`HoverEffect`: `.automatic`/`.highlight`/`.lift`). Overrides the list-wide
   * `rowHoverEffect`.
   */
  hoverEffect?: ListRowHoverEffect;
  /** listRowHoverEffectDisabled(_:) — suppress the hover treatment for this row. */
  hoverEffectDisabled?: boolean;
  /** swipeActions(...). */
  swipeActions?: SwipeActionsConfig;
  /** badge(_:) — trailing count/text pill (Settings "12" badge, list-row form). */
  badge?: number | string | React.ReactNode;
  /** selectionDisabled(_:) — this row cannot be selected (greyed in edit/selection mode). */
  selectionDisabled?: boolean;
  /** deleteDisabled(_:) — suppress this row's destructive (delete) swipe/edit action. */
  deleteDisabled?: boolean;
  /** moveDisabled(_:) — this row cannot be reordered in edit mode (hides the grip). */
  moveDisabled?: boolean;
  /** Shows the chevron disclosure indicator (NavigationLink-style rows). Alias for `accessory="chevron"`. */
  showsChevron?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Free-form row content (slots: `<ListRow.Label>`, `<ListRow.Value>`, …). Overrides the prop API. */
  children?: React.ReactNode;
}

const SWIPE_BTN_W = 74;
const SNAP = "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)";

function ActionDrawer({
  edge,
  actions,
  onFire,
}: {
  edge: SwipeEdge;
  actions: SwipeAction[];
  onFire: (a: SwipeAction) => void;
}): React.ReactElement {
  return (
    <div className="sui-list__swipe-actions" data-edge={edge}>
      {actions.map((a, i) => (
        <button
          key={i}
          type="button"
          className="sui-list__swipe-btn"
          data-role={a.role === "destructive" ? "destructive" : undefined}
          style={a.tint ? { ["--sui-swipe-tint" as string]: a.tint } : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onFire(a);
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export const ListRow = React.forwardRef<HTMLDivElement, ListRowProps>(
  function ListRow(
    {
      id,
      onTap,
      label,
      value,
      leading,
      leadingAsIcon,
      trailing,
      accessory,
      background,
      insets,
      separator = "automatic",
      separatorTint,
      itemTint,
      hoverEffect,
      hoverEffectDisabled,
      swipeActions,
      showsChevron,
      badge,
      selectionDisabled = false,
      deleteDisabled = false,
      moveDisabled = false,
      className,
      style,
      children,
      ...rest
    },
    ref,
  ) {
    const ctx = useListContext();
    // A row whose selection is disabled (per-row or list-wide) cannot toggle.
    const selectable = !selectionDisabled && !ctx.selectionDisabled;
    const sel = selectable ? ctx.selection : undefined;
    const editing = ctx.editMode === "active" || ctx.editMode === "transient";
    const isSelected =
      id != null && sel?.enabled ? sel.selected.has(id) : false;
    const tappable = !!onTap || (sel?.enabled ?? false);

    // listRowHoverEffect / listRowHoverEffectDisabled — the row's own setting
    // wins over the list-wide one; "disabled" anywhere suppresses the effect.
    const hoverDisabled = hoverEffectDisabled ?? ctx.rowHoverEffectDisabled ?? false;
    const resolvedHover: ListRowHoverEffect | undefined = hoverDisabled
      ? undefined
      : hoverEffect ?? ctx.rowHoverEffect;
    const hoverAttr = hoverDisabled
      ? "disabled"
      : resolvedHover && resolvedHover !== "automatic"
        ? resolvedHover
        : undefined;

    // ---- swipe drawer drag state ----
    // deleteDisabled(_) drops the destructive action from both swipe edges.
    const filterDestructive = (a: SwipeAction) =>
      !(deleteDisabled && a.role === "destructive");
    const trailingActions = (swipeActions?.trailing ?? []).filter(filterDestructive);
    const leadingActions = (swipeActions?.leading ?? []).filter(filterDestructive);
    const allowsFullSwipe = swipeActions?.allowsFullSwipe ?? true;
    const hasSwipe = trailingActions.length > 0 || leadingActions.length > 0;
    const trailingW = trailingActions.length * SWIPE_BTN_W;
    const leadingW = leadingActions.length * SWIPE_BTN_W;

    const [offset, setOffset] = React.useState(0);
    const [animating, setAnimating] = React.useState(false);
    const dragRef = React.useRef<{ startX: number; startOffset: number } | null>(
      null,
    );
    const widthRef = React.useRef(0);
    const trackRef = React.useRef<HTMLDivElement | null>(null);

    const onPointerDown = (e: React.PointerEvent) => {
      if (!hasSwipe) return;
      widthRef.current = trackRef.current?.offsetWidth ?? 0;
      dragRef.current = { startX: e.clientX, startOffset: offset };
      setAnimating(false);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      let next = dragRef.current.startOffset + (e.clientX - dragRef.current.startX);
      // clamp: trailing opens to negative (−trailingW), leading to positive (+leadingW)
      const maxOpen = leadingW;
      const minOpen = -trailingW;
      if (next > maxOpen) next = maxOpen + (next - maxOpen) * 0.35; // rubber-band
      if (next < minOpen) next = minOpen + (next - minOpen) * 0.35;
      setOffset(next);
    };
    const settle = (toEdge: SwipeEdge, actions: SwipeAction[]) => {
      const w = widthRef.current || 1;
      const openW = toEdge === "trailing" ? -trailingW : leadingW;
      const fullSwipeThreshold = w * 0.5;
      setAnimating(true);
      if (allowsFullSwipe && Math.abs(offset) > fullSwipeThreshold && actions[0]) {
        actions[0].onTap?.();
        setOffset(0);
      } else if (Math.abs(offset) > Math.abs(openW) / 2) {
        setOffset(openW);
      } else {
        setOffset(0);
      }
    };
    const onPointerUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      if (offset < 0) settle("trailing", trailingActions);
      else if (offset > 0) settle("leading", leadingActions);
      else setOffset(0);
    };

    const closeAndFire = (a: SwipeAction) => {
      setAnimating(true);
      setOffset(0);
      a.onTap?.();
    };

    const handleClick = () => {
      if (offset !== 0) {
        setAnimating(true);
        setOffset(0);
        return;
      }
      if (sel?.enabled && id != null) sel.toggle(id);
      onTap?.();
    };

    const insetStyle: React.CSSProperties = insets
      ? {
          paddingTop: insets.top,
          paddingRight: insets.trailing,
          paddingBottom: insets.bottom,
          paddingLeft: insets.leading,
        }
      : {};

    // ---- Resolve the trailing accessory (showsChevron is an alias) ----
    const resolvedAccessory: RowAccessory =
      accessory ?? (showsChevron ? "chevron" : "none");

    // ---- Prop-based row content (LabeledContent-style) ----
    // Only used when no explicit children are passed. Lays out on ONE line:
    //   [leading] label …spacer… value [trailing] [accessory]
    const usePropApi = children == null;
    const leadingNode =
      leading != null
        ? (leadingAsIcon ?? typeof leading === "string") ? (
            <span className="sui-list__icon">{leading}</span>
          ) : (
            <span className="sui-list__leading">{leading}</span>
          )
        : null;
    const propContent = usePropApi ? (
      <>
        {leadingNode}
        {label != null ? <span className="sui-list__label">{label}</span> : null}
        {value != null ? <span className="sui-list__value">{value}</span> : null}
        {trailing != null ? (
          <span className="sui-list__trailing">{trailing}</span>
        ) : null}
      </>
    ) : null;

    const accessoryNode =
      resolvedAccessory === "chevron" || resolvedAccessory === "disclosure" ? (
        <span className="sui-list__chevron" aria-hidden="true" />
      ) : resolvedAccessory === "checkmark" ? (
        <span className="sui-list__checkmark" aria-hidden="true" />
      ) : null;

    // badge(_:) — a trailing grey count/text pill, placed before the accessory.
    const badgeNode =
      badge != null ? (
        <span className="sui-list__badge">{badge}</span>
      ) : null;

    const row = (
      <div
        ref={ref}
        className={["sui-list__row", className].filter(Boolean).join(" ")}
        role="listitem"
        tabIndex={tappable ? 0 : undefined}
        data-tappable={tappable ? "true" : undefined}
        data-selected={isSelected ? "true" : undefined}
        data-separator={
          separator === "hidden" ? "hidden" : separator === "visible" ? "visible" : undefined
        }
        data-selection-disabled={selectionDisabled ? "true" : undefined}
        data-row-hover={hoverAttr}
        data-scroll-id={id != null ? String(id) : undefined}
        onClick={tappable || hasSwipe ? handleClick : undefined}
        onKeyDown={
          tappable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClick();
                }
              }
            : undefined
        }
        style={{
          ...(background ? {} : null),
          ...(separatorTint
            ? { ["--sui-row-separator-tint" as string]: separatorTint }
            : null),
          ...(itemTint
            ? { ["--sui-list-item-tint" as string]: itemTint }
            : null),
          ...insetStyle,
          ...style,
        }}
        {...rest}
      >
        {background ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: -1,
            }}
          >
            {background}
          </span>
        ) : null}
        {editing ? <span className="sui-list__select" aria-hidden="true" /> : null}
        {usePropApi ? propContent : children}
        {badgeNode}
        {accessoryNode}
        {editing && !moveDisabled ? (
          <span className="sui-list__grip" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </div>
    );

    if (!hasSwipe) return row;

    return (
      <div className="sui-list__swipe" {...{ id: undefined }}>
        {leadingActions.length > 0 ? (
          <ActionDrawer
            edge="leading"
            actions={leadingActions}
            onFire={closeAndFire}
          />
        ) : null}
        {trailingActions.length > 0 ? (
          <ActionDrawer
            edge="trailing"
            actions={trailingActions}
            onFire={closeAndFire}
          />
        ) : null}
        <div
          ref={trackRef}
          className="sui-list__swipe-track"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTransitionEnd={() => setAnimating(false)}
          style={{
            transform: `translateX(${offset}px)`,
            transition: animating ? SNAP : "none",
            touchAction: "pan-y",
          }}
        >
          {row}
        </div>
      </div>
    );
  },
);

ListRow.displayName = "ListRow";

// ---- Row content slots ----
function Label({
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>): React.ReactElement {
  return (
    <span className="sui-list__label" {...rest}>
      {children}
    </span>
  );
}
Label.displayName = "ListRow.Label";

function Value({
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>): React.ReactElement {
  return (
    <span className="sui-list__value" {...rest}>
      {children}
    </span>
  );
}
Value.displayName = "ListRow.Value";

function Icon({
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>): React.ReactElement {
  return (
    <span className="sui-list__icon" {...rest}>
      {children}
    </span>
  );
}
Icon.displayName = "ListRow.Icon";

/** Leading content that is NOT wrapped in the 29×29 icon chip (e.g. a custom view). */
function Leading({
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>): React.ReactElement {
  return (
    <span className="sui-list__leading" {...rest}>
      {children}
    </span>
  );
}
Leading.displayName = "ListRow.Leading";

/** Trailing content (e.g. a Toggle) placed after the value, before any accessory. */
function Trailing({
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>): React.ReactElement {
  return (
    <span className="sui-list__trailing" {...rest}>
      {children}
    </span>
  );
}
Trailing.displayName = "ListRow.Trailing";

function Chevron(
  props: React.HTMLAttributes<HTMLSpanElement>,
): React.ReactElement {
  return <span className="sui-list__chevron" aria-hidden="true" {...props} />;
}
Chevron.displayName = "ListRow.Chevron";

export const ListRowSlots = { Label, Value, Icon, Leading, Trailing, Chevron };
// Attach as static members for the `<ListRow.Label>` ergonomic.
(ListRow as unknown as Record<string, unknown>).Label = Label;
(ListRow as unknown as Record<string, unknown>).Value = Value;
(ListRow as unknown as Record<string, unknown>).Icon = Icon;
(ListRow as unknown as Record<string, unknown>).Leading = Leading;
(ListRow as unknown as Record<string, unknown>).Trailing = Trailing;
(ListRow as unknown as Record<string, unknown>).Chevron = Chevron;

export interface ListRowComponent
  extends React.ForwardRefExoticComponent<
    ListRowProps & React.RefAttributes<HTMLDivElement>
  > {
  Label: typeof Label;
  Value: typeof Value;
  Icon: typeof Icon;
  Leading: typeof Leading;
  Trailing: typeof Trailing;
  Chevron: typeof Chevron;
}

export const ListRowWithSlots = ListRow as unknown as ListRowComponent;
