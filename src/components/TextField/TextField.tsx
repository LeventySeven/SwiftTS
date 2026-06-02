"use client";
/**
 * `<TextField>` — SwiftUI C3 value-input.
 * Mirrors `SwiftUI.TextField` (SwiftUI:5193): single-line, or `axis="vertical"`
 * auto-growing multiline. Spec: teardowns/SWIFTUI_C3_value-input.md §1.
 *
 *   TextField("Name", text: $name)  ⇄  <TextField title="Name" value={name} onChange={setName} />
 *   TextField(value: $amount, format: .number)  ⇄  <TextField value={amount} onChange={setAmount} format={…} />
 *
 * The binding contract (§0.1) is value + onChange. The label/prompt triad (§0.2):
 * prompt ?? title → placeholder; title → aria-label always.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import type { ViewModifierProps } from "../../system/modifiers";
import styles from "./TextField.module.css";

/** ⇄ `.textFieldStyle()` (SwiftUI:10427). `automatic` == `plain` on iOS. */
export type TextFieldStyle = "automatic" | "plain" | "roundedBorder" | "squareBorder";

/** ⇄ `Axis` (SUICore:2440). `vertical` grows the field downward as lines wrap. */
export type TextFieldAxis = "horizontal" | "vertical";

/** ⇄ `SubmitLabel` (SwiftUI:8708) → `enterkeyhint`. */
export type SubmitLabel =
  | "done"
  | "go"
  | "send"
  | "join"
  | "route"
  | "search"
  | "return"
  | "next"
  | "continue";

/** ⇄ keyboardType(_:) → `inputmode`. */
export type KeyboardType =
  | "default"
  | "numberPad"
  | "decimalPad"
  | "emailAddress"
  | "phonePad"
  | "url";

/**
 * DESIGNED parse pipeline mirroring `TextField(value:format:)` (SwiftUI:116).
 * render() fills the input from the typed value; parse() runs on commit/blur —
 * `null` rejects and reverts, otherwise the typed value is written back.
 */
export interface FieldFormat<T = unknown> {
  parse: (s: string) => T | null;
  render: (v: T) => string;
}

export type LineLimit =
  | number
  | { min?: number; max: number; reservesSpace?: boolean };

// `lineLimit` is redefined here (object form) so it's omitted from the modifier
// base, whose `lineLimit` is `number | null`.
export interface TextFieldProps extends Omit<ViewModifierProps, "lineLimit"> {
  /** ⇄ `text: Binding<String>` */
  value: string;
  /** the binding setter */
  onChange: (s: string) => void;
  /** ⇄ `_ titleKey` — a11y label + iOS placeholder fallback */
  title?: string;
  /** ⇄ `prompt: Text?` → placeholder */
  prompt?: string;
  /** ⇄ `axis:` (`vertical` → auto-grow `<textarea>`) */
  axis?: TextFieldAxis;
  /** ⇄ `.lineLimit(_:reservesSpace:)` — caps/floors the multiline height */
  lineLimit?: LineLimit;
  /** ⇄ `.textFieldStyle()` (default `automatic`) */
  fieldStyle?: TextFieldStyle;
  /** ⇄ `.submitLabel()` → `enterkeyhint` */
  submitLabel?: SubmitLabel;
  /** ⇄ `.onSubmit` (Return) */
  onSubmit?: () => void;
  /** fires on focus/blur (replaces deprecated `onEditingChanged`) */
  onFocusChange?: (focused: boolean) => void;
  /** ⇄ `.disabled(_:)` */
  disabled?: boolean;
  /** ⇄ `value:format:` — DESIGNED parse-on-commit pipeline */
  format?: FieldFormat;
  /** ⇄ `.keyboardType(_:)` → `inputmode` */
  keyboardType?: KeyboardType;
  /** ⇄ `.textContentType(_:)` → `autocomplete` */
  textContentType?: string;
  /** ⇄ `.textInputAutocapitalization(_:)` */
  autocapitalization?: "never" | "words" | "sentences" | "characters";
  /** ⇄ `.autocorrectionDisabled(_:)` */
  autocorrectionDisabled?: boolean;
  /** DESIGNED error state → red border */
  invalid?: boolean;
  /** show the iOS while-editing clear (ⓧ) button */
  clearButton?: boolean;
  /** controlled focus mirror of `@FocusState` (visual only) */
  focused?: boolean;
}

const SUBMIT_TO_ENTERKEYHINT: Record<SubmitLabel, string> = {
  done: "done",
  go: "go",
  send: "send",
  join: "enter",
  route: "enter",
  search: "search",
  return: "enter",
  next: "next",
  continue: "enter",
};

const KEYBOARD_TO_INPUTMODE: Record<KeyboardType, string> = {
  default: "text",
  numberPad: "numeric",
  decimalPad: "decimal",
  emailAddress: "email",
  phonePad: "tel",
  url: "url",
};

const AUTOCAP_TO_ATTR: Record<
  NonNullable<TextFieldProps["autocapitalization"]>,
  string
> = {
  never: "none",
  words: "words",
  sentences: "sentences",
  characters: "characters",
};

/** Resolve `automatic` → the concrete iOS chrome (`plain`). */
export function resolveTextFieldStyle(
  style: TextFieldStyle | undefined,
): "plain" | "roundedBorder" | "squareBorder" {
  if (style === "roundedBorder") return "roundedBorder";
  if (style === "squareBorder") return "squareBorder";
  return "plain"; // automatic == plain on iOS, and the default
}

function maxRowsOf(limit: LineLimit | undefined): number | undefined {
  if (limit == null) return undefined;
  return typeof limit === "number" ? limit : limit.max;
}
function minRowsOf(limit: LineLimit | undefined): number | undefined {
  if (limit == null) return undefined;
  // bare-number lineLimit is a max cap only; it reserves no floor space.
  if (typeof limit === "number") return undefined;
  return limit.reservesSpace ? limit.max : limit.min;
}

export const TextField = React.forwardRef<HTMLDivElement, TextFieldProps>(
  function TextField(props, ref) {
    const {
      value,
      onChange,
      title,
      prompt,
      axis,
      lineLimit,
      fieldStyle,
      submitLabel,
      onSubmit,
      onFocusChange,
      disabled,
      format,
      keyboardType,
      textContentType,
      autocapitalization,
      autocorrectionDisabled,
      invalid,
      clearButton,
      focused: focusedProp,
      ...modifierProps
    } = props;

    const [focusedState, setFocusedState] = React.useState(false);
    const focused = focusedProp ?? focusedState;
    const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(
      null,
    );
    // when a format is supplied, the input holds a display string locally and
    // commits the parsed value on blur/Return (parse-on-commit, §1.4).
    const [draft, setDraft] = React.useState<string | null>(null);

    const isMultiline = axis === "vertical";
    const styleName = resolveTextFieldStyle(fieldStyle);
    const placeholder = prompt ?? title;
    const ariaLabel = title;

    const displayValue = format ? (draft ?? value) : value;

    const autoGrow = React.useCallback(() => {
      const el = inputRef.current;
      if (!el || !isMultiline) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [isMultiline]);

    React.useEffect(() => {
      autoGrow();
    }, [autoGrow, displayValue]);

    const commit = React.useCallback(() => {
      if (!format) return;
      const next = format.parse(draft ?? value);
      if (next == null) {
        // reject → revert to the last good rendered value
        setDraft(format.render(value as never));
      } else {
        onChange(format.render(next as never));
        setDraft(null);
      }
    }, [format, draft, value, onChange]);

    const handleChange = (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const next = e.target.value;
      if (format) {
        setDraft(next);
      } else {
        onChange(next);
      }
    };

    const handleFocus = () => {
      if (focusedProp == null) setFocusedState(true);
      if (format && draft == null) setDraft(value);
      onFocusChange?.(true);
    };
    const handleBlur = () => {
      if (focusedProp == null) setFocusedState(false);
      commit();
      onFocusChange?.(false);
    };
    const handleKeyDown = (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      // single-line, or multiline with lineLimit 1 → Return submits
      const returnSubmits = !isMultiline || maxRowsOf(lineLimit) === 1;
      if (e.key === "Enter" && returnSubmits) {
        if (isMultiline) e.preventDefault();
        commit();
        onSubmit?.();
      }
    };

    const maxRows = maxRowsOf(lineLimit);
    const minRows = minRowsOf(lineLimit);
    const showClear =
      clearButton && focused && displayValue.length > 0 && !disabled;

    const commonProps = {
      ref: inputRef as never,
      className: styles.input,
      value: displayValue,
      placeholder,
      "aria-label": ariaLabel,
      disabled,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      enterKeyHint: submitLabel
        ? (SUBMIT_TO_ENTERKEYHINT[submitLabel] as React.HTMLAttributes<HTMLElement>["enterKeyHint"])
        : undefined,
      inputMode: keyboardType
        ? (KEYBOARD_TO_INPUTMODE[keyboardType] as React.HTMLAttributes<HTMLElement>["inputMode"])
        : undefined,
      autoComplete: textContentType,
      autoCapitalize: autocapitalization
        ? AUTOCAP_TO_ATTR[autocapitalization]
        : undefined,
      autoCorrect: autocorrectionDisabled ? "off" : undefined,
      spellCheck: autocorrectionDisabled ? false : undefined,
    };

    const viewProps = modifierProps as ViewProps;

    return (
      <View
        ref={ref as never}
        as="div"
        className={[styles.textfield, styles[styleName]].join(" ")}
        data-focused={focused}
        data-disabled={!!disabled}
        data-invalid={!!invalid}
        {...viewProps}
      >
        {isMultiline ? (
          <textarea
            {...commonProps}
            rows={minRows ?? 1}
            style={
              maxRows != null
                ? {
                    maxHeight: `calc(${maxRows} * var(--sui-text-body-lineHeight))`,
                    overflowY: "auto",
                  }
                : undefined
            }
            onInput={autoGrow}
          />
        ) : (
          <input {...commonProps} type="text" />
        )}
        {showClear ? (
          <button
            type="button"
            className={styles.clear}
            aria-label="Clear"
            // mousedown (not click) so the input keeps focus
            onMouseDown={(e) => {
              e.preventDefault();
              if (format) setDraft("");
              else onChange("");
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        ) : null}
      </View>
    );
  },
);

TextField.displayName = "TextField";
