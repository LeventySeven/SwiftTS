"use client";
/**
 * `ControlGroup` — `SwiftUI.ControlGroup<Content>` (SwiftUI :14966).
 *
 * RE'd from `teardowns/SWIFTUI_C2_action-controls.md` §4.
 *
 *   ControlGroup { content }                              // :14967
 *   ControlGroup { content } label: { label }             // :15000
 *   ControlGroup(_:) { content }   where labeled          // :15006 / :15025
 *
 * Lays its child controls into a single segmented/bordered cluster — adjacent
 * members share a background with hairline dividers and rounded outer corners only.
 *
 * `.controlGroupStyle(_:)`:
 *   • "automatic" / "navigation" — the segmented bordered cluster.
 *   • "palette" — a row of icon swatches; the selected cell shows a tint ring
 *     (mark a child with `aria-selected="true"`).
 *   • "menu" / "compactMenu" — collapse the group into one <Menu> trigger whose
 *     content is the members.
 */
import * as React from "react";
import { mergeStyles, type ViewProps } from "../View";
import { applyModifiers } from "../../system/modifiers";
import type { ControlSize } from "../../system/types";
import { useControlSize } from "../controls/controlMachinery";
import { SymbolGlyph } from "../controls/SymbolGlyph";
import { Menu } from "../Menu/Menu";
import styles from "./ControlGroup.module.css";
import "../controls/controlSize.global.css";

export type ControlGroupStyleName =
  | "automatic"
  | "navigation"
  | "palette"
  | "menu"
  | "compactMenu";

export interface ControlGroupProps extends Omit<ViewProps, "as" | "title"> {
  /** Optional group label (iOS16+). */
  label?: string;
  /** Leading SF Symbol for the label. */
  systemImage?: string;
  /** `.controlGroupStyle(_:)`. */
  controlGroupStyle?: ControlGroupStyleName;
  /** `.controlSize(_:)`. */
  controlSize?: ControlSize;
  /** The member controls. */
  children: React.ReactNode;
}

export const ControlGroup = React.forwardRef<HTMLDivElement, ControlGroupProps>(
  function ControlGroup(
    {
      label,
      systemImage,
      controlGroupStyle = "automatic",
      controlSize,
      children,
      style: styleProp,
      className,
      ...modifierProps
    },
    ref,
  ) {
    const size = useControlSize(controlSize);
    const {
      style: modStyle,
      className: modClass,
      rest,
    } = applyModifiers(modifierProps);

    // .menu / .compactMenu collapse the whole group into one Menu trigger.
    if (controlGroupStyle === "menu" || controlGroupStyle === "compactMenu") {
      return (
        <Menu label={label} systemImage={systemImage}>
          {children}
        </Menu>
      );
    }

    const labelNode =
      label != null || systemImage != null ? (
        <span className={styles.label}>
          {systemImage ? <SymbolGlyph name={systemImage} /> : null}
          {label}
        </span>
      ) : null;

    const cluster = (
      <div
        ref={labelNode ? undefined : ref}
        role="group"
        aria-label={label}
        className={[styles.group, !labelNode && (modClass || undefined), !labelNode && className]
          .filter(Boolean)
          .join(" ")}
        data-style={controlGroupStyle}
        data-control-size={size}
        style={labelNode ? undefined : mergeStyles(modStyle, styleProp)}
        {...(labelNode ? {} : rest)}
      >
        {children}
      </div>
    );

    if (!labelNode) return cluster;

    return (
      <div
        ref={ref}
        className={[styles.labelRow, modClass || undefined, className]
          .filter(Boolean)
          .join(" ")}
        data-control-size={size}
        style={mergeStyles(modStyle, styleProp)}
        {...rest}
      >
        {labelNode}
        {cluster}
      </div>
    );
  },
);

ControlGroup.displayName = "ControlGroup";
