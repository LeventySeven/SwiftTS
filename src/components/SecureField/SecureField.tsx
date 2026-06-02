"use client";
/**
 * `<SecureField>` — SwiftUI C3 value-input.
 * Mirrors `SwiftUI.SecureField` (SwiftUI:16397): a masked, single-line TextField
 * for password entry. Spec: teardowns/SWIFTUI_C3_value-input.md §2.
 *
 *   SecureField("Password", text: $pw)  ⇄  <SecureField title="Password" value={pw} onChange={setPw} />
 *
 * It is a strict subset of TextField's string-binding API — no `axis`, no
 * `value:format:`, no `selection:` — and reuses every `.textfield*` class from
 * the TextField CSS module unchanged (§2.4). The browser's native
 * `type="password"` masking matches SwiftUI's `•` glyph on every platform.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import type { ViewModifierProps } from "../../system/modifiers";
import {
  resolveTextFieldStyle,
  type TextFieldStyle,
} from "../TextField/TextField";
// SecureField reuses TextField's chrome verbatim (§2.4).
import styles from "../TextField/TextField.module.css";

export interface SecureFieldProps extends ViewModifierProps {
  /** ⇄ `text: Binding<String>` */
  value: string;
  onChange: (s: string) => void;
  /** ⇄ `titleKey` — a11y label + placeholder fallback */
  title?: string;
  /** ⇄ `prompt: Text?` → placeholder */
  prompt?: string;
  /** ⇄ `.textFieldStyle()` (default `automatic`) */
  fieldStyle?: TextFieldStyle;
  /** ⇄ `.onSubmit` (replaces deprecated `onCommit`) */
  onSubmit?: () => void;
  /** fires on focus/blur */
  onFocusChange?: (focused: boolean) => void;
  /** ⇄ `.textContentType(_:)` → autocomplete current/new-password */
  textContentType?: "password" | "newPassword" | (string & {});
  /** ⇄ `.disabled(_:)` */
  disabled?: boolean;
  /** DESIGNED — SwiftUI has none; toggles `type` password↔text (reveal) */
  reveal?: boolean;
  /** controlled focus mirror of `@FocusState` (visual only) */
  focused?: boolean;
}

function resolveAutocomplete(
  contentType: SecureFieldProps["textContentType"],
): string {
  if (contentType === "newPassword") return "new-password";
  if (contentType === "password" || contentType == null)
    return "current-password";
  return contentType;
}

export const SecureField = React.forwardRef<HTMLDivElement, SecureFieldProps>(
  function SecureField(props, ref) {
    const {
      value,
      onChange,
      title,
      prompt,
      fieldStyle,
      onSubmit,
      onFocusChange,
      textContentType,
      disabled,
      reveal,
      focused: focusedProp,
      ...modifierProps
    } = props;

    const [focusedState, setFocusedState] = React.useState(false);
    const focused = focusedProp ?? focusedState;
    const styleName = resolveTextFieldStyle(fieldStyle);

    const placeholder = prompt ?? title;
    const ariaLabel = title;
    const viewProps = modifierProps as ViewProps;

    return (
      <View
        ref={ref as never}
        as="div"
        className={[styles.textfield, styles[styleName]].join(" ")}
        data-focused={focused}
        data-disabled={!!disabled}
        {...viewProps}
      >
        <input
          className={styles.input}
          type={reveal ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          autoComplete={resolveAutocomplete(textContentType)}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (focusedProp == null) setFocusedState(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            if (focusedProp == null) setFocusedState(false);
            onFocusChange?.(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit?.();
          }}
        />
      </View>
    );
  },
);

SecureField.displayName = "SecureField";
