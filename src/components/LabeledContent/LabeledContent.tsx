/**
 * `<LabeledContent>` — SwiftUI's canonical form-row primitive (C15 §11.3).
 *
 * Spec: teardowns/SWIFTUI_C15_styles-registry.md §11.3
 *   (`LabeledContentStyleConfiguration { label, content }`, `SUI:22746`).
 *
 *   LabeledContent("Version", value: "1.0")
 *   LabeledContent("Name") { Text("…") }
 *   LabeledContent { content } label: { … }
 *
 * Visual (`AutomaticLabeledContentStyle`): an HStack row — `label` leading (in
 * the primary label color), `content` trailing (in the secondary label color),
 * pushed apart (space-between). This is the Settings "Version  1.0" row. List
 * rows reuse this layout, so the component is a plain row that any container can
 * drop in.
 *
 * Server-compatible — no client hooks. Renders through `<View>` so styling
 * modifier props pass through to the row container.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import { Text } from "../Text";
import styles from "./LabeledContent.module.css";

export interface LabeledContentProps
  extends Omit<ViewProps, "title" | "label" | "content"> {
  /**
   * `titleKey`/label — the leading text. A string renders through `<Text>`;
   * nodes render as-is. Ignored if `labelContent` is provided.
   */
  label?: React.ReactNode;
  /** Custom leading label ViewBuilder. Overrides `label`. */
  labelContent?: React.ReactNode;
  /**
   * `value:` convenience — the trailing value as a string (secondary color).
   * Ignored if `children`/`content` is provided.
   */
  value?: React.ReactNode;
  /** Custom trailing content ViewBuilder. Overrides `value`. */
  content?: React.ReactNode;
  /** Trailing content (alias for `content`; the `content:` ViewBuilder body). */
  children?: React.ReactNode;
}

export const LabeledContent = React.forwardRef<HTMLElement, LabeledContentProps>(
  function LabeledContent(
    { label, labelContent, value, content, children, className, ...rest },
    ref,
  ) {
    const leadingNode =
      labelContent ??
      (typeof label === "string" ? <Text>{label}</Text> : label);

    const trailingRaw = content ?? children ?? value;
    const trailingNode =
      typeof trailingRaw === "string" ? <Text>{trailingRaw}</Text> : trailingRaw;

    const mergedClassName =
      [styles.labeledContent, className].filter(Boolean).join(" ") || undefined;

    return (
      <View ref={ref} className={mergedClassName} {...rest}>
        <span className={styles.label}>{leadingNode}</span>
        <span className={styles.content}>{trailingNode}</span>
      </View>
    );
  },
);

LabeledContent.displayName = "LabeledContent";
