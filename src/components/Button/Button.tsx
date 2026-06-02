"use client";
/**
 * `Button` — `SwiftUI.Button<Label>` (SwiftUI :21934).
 *
 * RE'd from `teardowns/SWIFTUI_C2_action-controls.md` §1.
 *
 *   Button(action:) { label }                       // :21935
 *   Button(_:action:)            where Label == Text // :21947 / :21953
 *   Button(_:systemImage:action:)                    // :21957 / :21968
 *   Button(role:action:) { label }                   // :21990
 *
 * Web mapping: always a native `<button type="button">` (gives focus, Space/Return
 * activation, the `disabled` attribute, and ARIA for free). The label is either
 * `children` (ViewBuilder) or the `{ title, systemImage }` convenience.
 *
 * The fired-on-touch-up-inside semantics are exactly the browser's native click
 * (a click only fires when pointer-up lands inside the element), so we map
 * `action` → `onClick`. Press feedback (`isPressed`) is `:active` in CSS.
 *
 * Style resolution mirrors SwiftUI's `.buttonStyle(_:)` cascade: an explicit
 * `buttonStyle` prop wins, else the nearest `ButtonStyleProvider`, else
 * "automatic" — resolved via `useResolvedStyle("button")`. ControlSize, the
 * disabled cascade, and `.tint(_:)` come from the C2 control machinery.
 */
import * as React from "react";
import { mergeStyles, type ViewProps } from "../View";
import { applyModifiers } from "../../system/modifiers";
import type { ButtonStyleName } from "../../system/styles";
import { useResolvedStyle } from "../../system/styles";
import type { ControlSize } from "../../system/types";
import { glassClass } from "../../system/effects";
import {
  useControlSize,
  useIsDisabled,
  tintStyle,
} from "../controls/controlMachinery";
import { SymbolGlyph } from "../controls/SymbolGlyph";
import styles from "./Button.module.css";
import "../controls/controlSize.global.css";

/** `SwiftUI.ButtonRole` (SwiftUI :9336) — the full four-case set (iOS26). */
export type ButtonRole = "destructive" | "cancel" | "confirm" | "close";

/** iOS26 auto-label text for the role-only `Button(role:action:)` init (:22032). */
const ROLE_DEFAULT_LABEL: Record<ButtonRole, string> = {
  destructive: "Delete",
  cancel: "Cancel",
  confirm: "OK",
  close: "Close",
};

export interface ButtonProps
  extends Omit<ViewProps, "as" | "role" | "title"> {
  /** `.init(_ title:)` convenience — or use `children`. */
  title?: string;
  /** SF Symbol name for the leading icon (`.init(_:systemImage:)`). */
  systemImage?: string;
  /** `.destructive` / `.cancel` / `.confirm` / `.close`. */
  role?: ButtonRole;
  /** `.init(action:)` — fires on touch-up-inside (native click). */
  action?: () => void;
  /** `.buttonStyle(_:)`. Default resolves to "automatic". */
  buttonStyle?: ButtonStyleName;
  /** `.buttonBorderShape(_:)`. */
  borderShape?: "automatic" | "capsule" | "roundedRectangle" | "circle";
  /** `.controlSize(_:)`. */
  controlSize?: ControlSize;
  /** `.tint(_:)` — overrides `--sui-color-tint` locally. */
  tint?: string;
  /** `.disabled(_:)`. */
  disabled?: boolean;
  /** ViewBuilder label. */
  children?: React.ReactNode;
}

/** Map "automatic" / "glassProminent" to their rendered data-style bucket. */
function resolveDataStyle(name: ButtonStyleName): string {
  // "automatic" bare button renders as a tint-text borderless affordance.
  if (name === "automatic") return "automatic";
  return name;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      title,
      systemImage,
      role,
      action,
      buttonStyle,
      borderShape,
      controlSize,
      tint,
      disabled,
      children,
      style: styleProp,
      className,
      onClick,
      ...modifierProps
    },
    ref,
  ) {
    const resolvedStyle = useResolvedStyle("button", buttonStyle);
    const dataStyle = resolveDataStyle(resolvedStyle);
    const size = useControlSize(controlSize);
    const isDisabled = useIsDisabled(disabled);

    const isGlass =
      resolvedStyle === "glass" || resolvedStyle === "glassProminent";

    // Run the SwiftUI modifier compiler on the pass-through props so a caller can
    // still decorate the button (padding/frame/foregroundColor/…). We render a
    // native <button> directly (not <View>) because <button>-only attributes
    // (`type`, `disabled`) aren't on ViewProps' HTMLAttributes base.
    const {
      style: modStyle,
      className: modClass,
      rest,
    } = applyModifiers(modifierProps);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (!e.defaultPrevented) action?.();
    };

    const label =
      children ??
      (title != null ? title : role != null ? ROLE_DEFAULT_LABEL[role] : null);

    // .glass / .glassProminent render as real Liquid Glass: the `glassClass`
    // backdrop (blur + specular rim + sheen + glow) plus the Button.module.css
    // `data-style` rules for the label color / prominent tint wash. The
    // `.button` rule overrides border-radius back to the squircle control radius
    // (the glass default capsule is opt-in via `.buttonBorderShape(.capsule)`).
    const mergedClassName = [
      styles.button,
      isGlass ? glassClass("regular") : undefined,
      modClass || undefined,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type="button"
        className={mergedClassName}
        data-style={dataStyle}
        data-role={role}
        data-shape={borderShape}
        data-control-size={size}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        onClick={handleClick}
        style={mergeStyles(modStyle, tintStyle(tint), styleProp)}
        {...rest}
      >
        {systemImage ? (
          <SymbolGlyph name={systemImage} className={styles.icon} />
        ) : null}
        {label}
      </button>
    );
  },
);

Button.displayName = "Button";
