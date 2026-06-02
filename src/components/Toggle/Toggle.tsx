"use client";
/**
 * `Toggle` — `SwiftUI.Toggle<Label>` (SwiftUI :4916).
 *
 * RE'd from `teardowns/SWIFTUI_C2_action-controls.md` §2.
 *
 *   Toggle(isOn:) { label }                          // :4917
 *   Toggle(_:isOn:)          where Label == Text      // :4937 / :4942
 *   Toggle(_:systemImage:isOn:)                       // :4954
 *
 * `isOn` is SwiftUI's `Binding<Bool>` — modelled as `isOn` + `onChange`. `isMixed`
 * is the iOS16+ tri-state (the `sources:` form when bound bools disagree).
 *
 * Styles (`.toggleStyle(_:)`):
 *   • "switch"  (default on web) — the 51×31 green sliding switch. Rendered as a
 *     `<button role="switch" aria-checked>` so it announces on/off. The knob slides
 *     via the baked anim.snappy spring; the track cross-fades gray↔green.
 *   • "button"  — a `<Button>` that stays filled (borderedProminent) when on.
 *   • "checkbox" (macOS) — a 14×14 tint-filled squircle with a checkmark when on.
 *
 * The on-track color is `--toggle-on`, defaulting to system green; `tint` overrides
 * it (matches the deprecated `SwitchToggleStyle(tint:)` → `.tint(_:)` migration).
 */
import * as React from "react";
import { mergeStyles, type ViewProps } from "../View";
import { applyModifiers } from "../../system/modifiers";
import type { ToggleStyleName } from "../../system/styles";
import { useResolvedStyle } from "../../system/styles";
import type { ControlSize } from "../../system/types";
import { useControlSize, useIsDisabled } from "../controls/controlMachinery";
import { SymbolGlyph } from "../controls/SymbolGlyph";
import { Button } from "../Button/Button";
import styles from "./Toggle.module.css";
import "../controls/controlSize.global.css";

export interface ToggleProps extends Omit<ViewProps, "as" | "title" | "onChange"> {
  /** Two-way `Binding<Bool>` — read side. */
  isOn: boolean;
  /** Two-way `Binding<Bool>` — write side. */
  onChange: (isOn: boolean) => void;
  /** Text label convenience. */
  label?: string;
  /** Leading SF Symbol for the label. */
  systemImage?: string;
  /** iOS16+ tri-state (the `sources:` form). */
  isMixed?: boolean;
  /** `.toggleStyle(_:)`. Default resolves to "automatic" → switch on web. */
  toggleStyle?: ToggleStyleName;
  /** `.tint(_:)` — on-track color (default system green). */
  tint?: string;
  /** `.disabled(_:)`. */
  disabled?: boolean;
  /** `.controlSize(_:)`. */
  controlSize?: ControlSize;
  /** ViewBuilder label (overrides `label`/`systemImage`). */
  children?: React.ReactNode;
}

/** "automatic" resolves to the platform default — switch on the web. */
function resolveToggleVariant(name: ToggleStyleName): "switch" | "button" | "checkbox" {
  if (name === "automatic" || name === "switch") return "switch";
  return name;
}

/** aria-checked value covering the tri-state. */
function ariaChecked(isOn: boolean, isMixed?: boolean): "true" | "false" | "mixed" {
  if (isMixed) return "mixed";
  return isOn ? "true" : "false";
}

export const Toggle = React.forwardRef<HTMLDivElement, ToggleProps>(
  function Toggle(
    {
      isOn,
      onChange,
      label,
      systemImage,
      isMixed,
      toggleStyle,
      tint,
      disabled,
      controlSize,
      children,
      style: styleProp,
      className,
      ...modifierProps
    },
    ref,
  ) {
    const variant = resolveToggleVariant(useResolvedStyle("toggle", toggleStyle));
    const size = useControlSize(controlSize);
    const isDisabled = useIsDisabled(disabled);

    const {
      style: modStyle,
      className: modClass,
      rest,
    } = applyModifiers(modifierProps);

    const onTrackStyle = tint
      ? ({ ["--toggle-on" as never]: tint } as React.CSSProperties)
      : undefined;

    const labelContent =
      children ??
      (label != null || systemImage != null ? (
        <span className={styles.label}>
          {systemImage ? (
            <SymbolGlyph name={systemImage} className={styles.labelIcon} />
          ) : null}
          {label}
        </span>
      ) : null);

    const flip = () => {
      if (isDisabled) return;
      onChange(!isOn);
    };

    // --- "button" style: reuse <Button>, filled (prominent) when on ---
    if (variant === "button") {
      return (
        <Button
          buttonStyle={isOn ? "borderedProminent" : "bordered"}
          controlSize={controlSize}
          tint={tint}
          disabled={isDisabled}
          systemImage={systemImage}
          action={flip}
          aria-pressed={isOn}
        >
          {children ?? label}
        </Button>
      );
    }

    const rootClassName = [styles.toggle, modClass || undefined, className]
      .filter(Boolean)
      .join(" ");

    // --- "checkbox" style (macOS) ---
    if (variant === "checkbox") {
      return (
        <div
          ref={ref}
          className={rootClassName}
          data-style="checkbox"
          data-control-size={size}
          aria-disabled={isDisabled || undefined}
          style={mergeStyles(modStyle, onTrackStyle, styleProp)}
          {...rest}
        >
          {labelContent}
          <button
            type="button"
            role="checkbox"
            className={styles.checkbox}
            aria-checked={ariaChecked(isOn, isMixed)}
            disabled={isDisabled}
            onClick={flip}
          >
            <SymbolGlyph name="checkmark" className={styles.check} />
          </button>
        </div>
      );
    }

    // --- "switch" style (default) ---
    return (
      <div
        ref={ref}
        className={rootClassName}
        data-style="switch"
        data-control-size={size}
        aria-disabled={isDisabled || undefined}
        style={mergeStyles(modStyle, onTrackStyle, styleProp)}
        {...rest}
      >
        {labelContent}
        <button
          type="button"
          role="switch"
          className={styles.switch}
          aria-checked={ariaChecked(isOn, isMixed)}
          disabled={isDisabled}
          onClick={flip}
        />
      </div>
    );
  },
);

Toggle.displayName = "Toggle";
