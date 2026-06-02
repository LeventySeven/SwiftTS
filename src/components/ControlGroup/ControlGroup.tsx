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
import { glass, glassClass } from "../../system/effects";
import {
  useLiquidGlass,
  glassRowClass,
  chromeClasses,
} from "../presentation/glassChrome";
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
  /**
   * Liquid-Glass cluster override. Unset ⇒ follow `useEnvironment().liquidGlass`
   * (default glass). `false` ⇒ classic bordered segmented cluster.
   */
  glass?: boolean;
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
      glass: glassProp,
      children,
      style: styleProp,
      className,
      ...modifierProps
    },
    ref,
  ) {
    const size = useControlSize(controlSize);
    // Liquid-Glass cluster only for the bordered/segmented styles (.palette is a
    // bare swatch row, .menu collapses to a Menu which is glass on its own).
    const glassy =
      useLiquidGlass(glassProp) &&
      (controlGroupStyle === "automatic" || controlGroupStyle === "navigation");
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

    // In glass mode each member control gets a glass-row highlight on hover so the
    // segmented cluster behaves like one continuous glass bar of lensing cells.
    const groupChildren = glassy
      ? React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;
          const childEl = child as React.ReactElement<{ className?: string }>;
          return React.cloneElement(childEl, {
            className: chromeClasses(childEl.props.className, glassRowClass(true)),
          });
        })
      : children;

    const cluster = (
      <div
        ref={labelNode ? undefined : ref}
        role="group"
        aria-label={label}
        className={chromeClasses(
          styles.group,
          glassy && styles.groupGlass,
          glassy && `${glassClass(glass.regular)} sui-glass-chrome`,
          !labelNode && (modClass || undefined),
          !labelNode && className,
        )}
        data-style={controlGroupStyle}
        data-glass={glassy ? "true" : undefined}
        data-control-size={size}
        style={labelNode ? undefined : mergeStyles(modStyle, styleProp)}
        {...(labelNode ? {} : rest)}
      >
        {groupChildren}
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
