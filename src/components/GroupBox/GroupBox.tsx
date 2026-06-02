/**
 * `<GroupBox>` — SwiftUI's titled rounded container (C15 §11.2).
 *
 * Spec: teardowns/SWIFTUI_C15_styles-registry.md §11.2
 *   (`GroupBoxStyleConfiguration { label, content }`, `SUI:21009`).
 *
 *   GroupBox("Title") { content }
 *   GroupBox(label: { … }) { content }
 *   GroupBox { content }                       // unlabeled
 *
 * Visual (`DefaultGroupBoxStyle` / `.automatic`): a titled rounded panel — a
 * secondary fill background card, ~8px corners, ~12px padding, with an optional
 * bold (headline-weight) title row on top, separated from the content by a small
 * gap. Slots map 1:1 to the SwiftUI config: `label` (header) + `content` (body).
 *
 * Server-compatible — no client hooks. Renders through `<View>` so all styling
 * modifier props (frame, padding overrides, background, …) pass through.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import { Text } from "../Text";
import styles from "./GroupBox.module.css";

export interface GroupBoxProps extends Omit<ViewProps, "title"> {
  /**
   * `titleKey` convenience — the header text. A string renders as a
   * headline-weight title; nodes render as-is. Ignored if `label` is set.
   */
  title?: React.ReactNode;
  /** Custom header label (the `label:` ViewBuilder). Overrides `title`. */
  label?: React.ReactNode;
  /** The container body (the `content:` ViewBuilder). */
  children?: React.ReactNode;
}

export const GroupBox = React.forwardRef<HTMLElement, GroupBoxProps>(
  function GroupBox(
    { title, label, children, className, ...rest },
    ref,
  ) {
    const headerNode =
      label ??
      (title != null ? (
        typeof title === "string" ? (
          <Text font="headline">{title}</Text>
        ) : (
          title
        )
      ) : null);

    const mergedClassName =
      [styles.groupBox, className].filter(Boolean).join(" ") || undefined;

    return (
      <View ref={ref} className={mergedClassName} {...rest}>
        {headerNode != null && (
          <div className={styles.label}>{headerNode}</div>
        )}
        <div className={styles.content}>{children}</div>
      </View>
    );
  },
);

GroupBox.displayName = "GroupBox";
