"use client";
/**
 * GlassToolbar — a Liquid-Glass toolbar row of icon buttons.
 *
 * A floating glass capsule (or rounded rect) holding a row — or column — of
 * icon/label buttons, the web analog of a `.toolbar { … }` glass cluster on
 * iOS-26. Built over the kit's glass surface (`glassClass` from
 * ../../system/effects) so it shares rim/sheen/glow with the rest of the kit,
 * with optional `divider`s between button groups and selectable / destructive
 * roles.
 *
 * Data-driven (`items`) OR composed by hand (children). Each item is an icon
 * button by default; pass `label` for icon+text or text-only.
 *
 * Stateful only via click callbacks → `"use client"`. SSR-safe.
 */
import * as React from "react";
import { glassClass } from "../../system/effects";
import type { Glass, GlassVariant } from "../../system/effects";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./shells.module.css";

/** A toolbar entry: an icon button, or a divider between groups. */
export type ToolbarEntry =
  | {
      kind?: "button";
      /** Stable id (key + selection). */
      id?: string;
      /** SF Symbol name. */
      systemImage?: string;
      /** Optional text label (icon+text, or text-only when no icon). */
      label?: string;
      /** Click handler. */
      onClick?: () => void;
      /** Render with the selected tint pill. */
      selected?: boolean;
      /** Destructive (red) role. */
      role?: "default" | "destructive";
      /** Disable. */
      disabled?: boolean;
      /** Accessible label for icon-only buttons. */
      accessibilityLabel?: string;
    }
  | { kind: "divider"; id?: string };

export type GlassToolbarShape = "capsule" | "rounded";
export type GlassToolbarOrientation = "horizontal" | "vertical";

export interface GlassToolbarProps {
  /** Data-driven entries. Omit + use `children` to compose by hand. */
  items?: ToolbarEntry[];
  /** Hand-composed content (use `ToolbarButton` / `ToolbarDivider`). */
  children?: React.ReactNode;

  /** `capsule` (default) | `rounded`. */
  shape?: GlassToolbarShape;
  /** Row (default) or column. */
  orientation?: GlassToolbarOrientation;
  /** Gap between buttons (px). Default 4. */
  gap?: number;

  /** Render the glass surface (iOS-26). Default `true`. */
  glass?: boolean | Glass | GlassVariant;

  className?: string;
  style?: React.CSSProperties;
}

/** A single glass toolbar button (icon and/or label). */
export interface ToolbarButtonProps {
  systemImage?: string;
  label?: string;
  onClick?: () => void;
  selected?: boolean;
  role?: "default" | "destructive";
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function ToolbarButton({
  systemImage,
  label,
  onClick,
  selected,
  role = "default",
  disabled,
  accessibilityLabel,
}: ToolbarButtonProps): React.ReactElement {
  const iconOnly = systemImage != null && !label;
  return (
    <button
      type="button"
      className={styles.toolbarButton}
      data-selected={selected ? "true" : undefined}
      data-role={role === "destructive" ? "destructive" : undefined}
      disabled={disabled}
      onClick={onClick}
      aria-label={accessibilityLabel ?? (iconOnly ? systemImage : undefined)}
      aria-pressed={selected}
    >
      {systemImage ? (
        <SymbolGlyph name={systemImage} size={20} weight="medium" />
      ) : null}
      {label ? <span>{label}</span> : null}
    </button>
  );
}

export function ToolbarDivider(): React.ReactElement {
  return <span className={styles.toolbarDivider} aria-hidden />;
}

export const GlassToolbar = React.forwardRef<HTMLDivElement, GlassToolbarProps>(
  function GlassToolbar(
    {
      items,
      children,
      shape = "capsule",
      orientation = "horizontal",
      gap = 4,
      glass = true,
      className,
      style,
    },
    ref,
  ) {
    const isGlass = glass !== false;
    // .sui-glass-bar = the floating chrome-bar glass (22px radius); NOT glassClass()
    // whose Capsule default (9999px) would round a wide toolbar into a pill.
    const glassSurface = isGlass ? "sui-glass-bar" : "sui-material sui-material-bar";

    const cls = [styles.toolbar, glassSurface, className].filter(Boolean).join(" ");

    const mergedStyle: React.CSSProperties = {
      ["--toolbar-gap" as string]: `${gap}px`,
      ...style,
    };

    return (
      <div
        ref={ref}
        className={cls}
        style={mergedStyle}
        data-shape={shape}
        data-orientation={orientation}
        role="toolbar"
      >
        {items
          ? items.map((entry, i) =>
              entry.kind === "divider" ? (
                <ToolbarDivider key={entry.id ?? `div-${i}`} />
              ) : (
                <ToolbarButton
                  key={entry.id ?? i}
                  systemImage={entry.systemImage}
                  label={entry.label}
                  onClick={entry.onClick}
                  selected={entry.selected}
                  role={entry.role}
                  disabled={entry.disabled}
                  accessibilityLabel={entry.accessibilityLabel}
                />
              ),
            )
          : children}
      </div>
    );
  },
);

GlassToolbar.displayName = "GlassToolbar";
