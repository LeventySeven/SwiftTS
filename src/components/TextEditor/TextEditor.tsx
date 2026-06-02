"use client";
/**
 * `<TextEditor>` — SwiftUI C3 value-input.
 * Mirrors `SwiftUI.TextEditor` (SwiftUI:3057): a scrolling, always-multiline
 * editable region. Spec: teardowns/SWIFTUI_C3_value-input.md §3.
 *
 *   TextEditor(text: $notes)  ⇄  <TextEditor value={notes} onChange={setNotes} />
 *
 * Always multiline (Return inserts a newline, never submits — no onSubmit
 * concept). SwiftUI has no native placeholder; the `placeholder` prop renders a
 * DESIGNED empty-state overlay. `rich` swaps the `<textarea>` for a
 * `contenteditable` div (the AttributedString variant, SwiftUI:3066).
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import type { ViewModifierProps } from "../../system/modifiers";
import styles from "./TextEditor.module.css";

/** ⇄ `.textEditorStyle()` (SwiftUI:3051). */
export type TextEditorStyle = "automatic" | "plain" | "roundedBorder";

export interface TextEditorProps extends ViewModifierProps {
  /** ⇄ `text: Binding<String>` */
  value: string;
  onChange: (s: string) => void;
  /** ⇄ `.textEditorStyle()` (default `automatic`) */
  editorStyle?: TextEditorStyle;
  /** DESIGNED — SwiftUI lacks a native placeholder */
  placeholder?: string;
  /** ⇄ `.lineSpacing()` (px added between lines) */
  lineSpacing?: number;
  /** ⇄ `.scrollContentBackground(.hidden)` */
  scrollBackgroundHidden?: boolean;
  /** ⇄ `AttributedString` variant → `contenteditable` */
  rich?: boolean;
  /** ⇄ `.disabled(_:)` */
  disabled?: boolean;
  /** fires on focus/blur */
  onFocusChange?: (f: boolean) => void;
  /** controlled focus mirror (visual only) */
  focused?: boolean;
}

function resolveEditorStyle(
  style: TextEditorStyle | undefined,
): "plain" | "roundedBorder" {
  return style === "roundedBorder" ? "roundedBorder" : "plain";
}

export const TextEditor = React.forwardRef<HTMLDivElement, TextEditorProps>(
  function TextEditor(props, ref) {
    const {
      value,
      onChange,
      editorStyle,
      placeholder,
      lineSpacing,
      scrollBackgroundHidden,
      rich,
      disabled,
      onFocusChange,
      focused: focusedProp,
      ...modifierProps
    } = props;

    const [focusedState, setFocusedState] = React.useState(false);
    const focused = focusedProp ?? focusedState;
    const styleName = resolveEditorStyle(editorStyle);
    const isEmpty = value.length === 0;
    const richRef = React.useRef<HTMLDivElement | null>(null);

    // keep the contenteditable DOM in sync when value changes externally
    React.useEffect(() => {
      if (rich && richRef.current && richRef.current.innerText !== value) {
        richRef.current.innerText = value;
      }
    }, [rich, value]);

    const lineSpacingStyle: React.CSSProperties | undefined =
      lineSpacing != null
        ? {
            lineHeight: `calc(var(--sui-text-body-lineHeight) + ${lineSpacing}px)`,
          }
        : undefined;

    const onFocus = () => {
      if (focusedProp == null) setFocusedState(true);
      onFocusChange?.(true);
    };
    const onBlur = () => {
      if (focusedProp == null) setFocusedState(false);
      onFocusChange?.(false);
    };

    const bgClass = scrollBackgroundHidden ? styles.bgHidden : styles.bg;
    const viewProps = modifierProps as ViewProps;

    return (
      <View
        ref={ref as never}
        as="div"
        className={[styles.texteditor, styles[styleName]].join(" ")}
        data-focused={focused}
        data-empty={isEmpty}
        data-disabled={!!disabled}
        {...viewProps}
      >
        {rich ? (
          <div
            ref={richRef}
            className={[styles.rich, bgClass].join(" ")}
            contentEditable={!disabled}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={placeholder}
            style={lineSpacingStyle}
            onInput={(e) => onChange((e.target as HTMLDivElement).innerText)}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        ) : (
          <textarea
            className={[styles.area, bgClass].join(" ")}
            rows={6}
            aria-label={placeholder ?? "Editor"}
            value={value}
            disabled={disabled}
            style={lineSpacingStyle}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        )}
        {placeholder ? (
          <span className={styles.placeholder} aria-hidden="true">
            {placeholder}
          </span>
        ) : null}
      </View>
    );
  },
);

TextEditor.displayName = "TextEditor";
