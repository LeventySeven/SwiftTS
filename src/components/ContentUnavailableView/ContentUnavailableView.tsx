/**
 * `<ContentUnavailableView>` — SwiftUI's centered empty-state placeholder
 * (C10 `SwiftUI 17171–17178`).
 *
 * Spec: teardowns/SWIFTUI_C10_styling-modifiers.md:1163 — "empty-state
 * placeholder (icon+title+desc) → centered flex div, SF icon + headline +
 * secondary text".
 *
 *   ContentUnavailableView("No Mail", systemImage: "tray.fill",
 *                          description: Text("New mail will appear here."))
 *   ContentUnavailableView { Label("No Mail", systemImage: "tray") }
 *       description: { Text("…") } actions: { Button("Refresh") {} }
 *   ContentUnavailableView.search                  // built-in search variant
 *   ContentUnavailableView.search(text: "query")   // "No Results for 'query'"
 *
 * Anatomy (top→bottom, centered):
 *   1. large SF symbol / icon slot, secondary color (~52pt)
 *   2. title — `.title2` semibold, primary label color
 *   3. description — `.body`, secondary label color
 *   4. optional actions row (buttons)
 *
 * Server-compatible — no client hooks. Renders through `<View>` so styling
 * modifier props (frame, padding, background, …) pass through to the container.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import { Image } from "../Image";
import { Text } from "../Text";
import styles from "./ContentUnavailableView.module.css";

export interface ContentUnavailableViewProps
  extends Omit<ViewProps, "title"> {
  /** `titleKey` — the headline. String renders as `.title2` semibold; nodes as-is. */
  title?: React.ReactNode;
  /** `systemImage:` — SF Symbol name for the large secondary icon. */
  systemImage?: string;
  /** Named-asset icon (`image:`). Ignored if `systemImage` is set. */
  image?: string;
  /** Free-form icon node (overrides systemImage/image). */
  icon?: React.ReactNode;
  /** `description:` — secondary body text. String or node. */
  description?: React.ReactNode;
  /** `actions:` — trailing buttons row. */
  actions?: React.ReactNode;
  /**
   * Free-form label slot (the `label:` ViewBuilder init). When provided it
   * replaces the icon+title pair entirely.
   */
  children?: React.ReactNode;
}

interface ContentUnavailableViewComponent
  extends React.ForwardRefExoticComponent<
    ContentUnavailableViewProps & React.RefAttributes<HTMLElement>
  > {
  /**
   * `ContentUnavailableView.search` — the built-in search empty state.
   * Pass `text` for the "No Results for '…'" form.
   */
  search: (props?: { text?: string }) => React.ReactElement;
}

const ContentUnavailableViewBase = React.forwardRef<
  HTMLElement,
  ContentUnavailableViewProps
>(function ContentUnavailableView(
  {
    title,
    systemImage,
    image,
    icon,
    description,
    actions,
    children,
    className,
    ...rest
  },
  ref,
) {
  const iconNode =
    icon ??
    (systemImage != null ? (
      <Image systemName={systemImage} />
    ) : image != null ? (
      <Image name={image} />
    ) : null);

  const titleNode =
    typeof title === "string" ? (
      <Text font="title2" fontWeight="semibold">
        {title}
      </Text>
    ) : (
      title
    );

  const descriptionNode =
    typeof description === "string" ? <Text>{description}</Text> : description;

  const mergedClassName =
    [styles.contentUnavailable, className].filter(Boolean).join(" ") ||
    undefined;

  return (
    <View ref={ref} className={mergedClassName} {...rest}>
      {children != null ? (
        <div className={styles.label}>{children}</div>
      ) : (
        <div className={styles.label}>
          {iconNode != null && (
            <div className={styles.icon} aria-hidden="true">
              {iconNode}
            </div>
          )}
          {titleNode != null && (
            <div className={styles.title}>{titleNode}</div>
          )}
        </div>
      )}
      {descriptionNode != null && (
        <div className={styles.description}>{descriptionNode}</div>
      )}
      {actions != null && <div className={styles.actions}>{actions}</div>}
    </View>
  );
}) as ContentUnavailableViewComponent;

/** `ContentUnavailableView.search` — built-in search variant. */
ContentUnavailableViewBase.search = function search({
  text,
}: { text?: string } = {}): React.ReactElement {
  return (
    <ContentUnavailableViewBase
      title={
        text != null && text !== "" ? `No Results for "${text}"` : "No Results"
      }
      systemImage="magnifyingglass"
      description="Check the spelling or try a new search."
    />
  );
};

ContentUnavailableViewBase.displayName = "ContentUnavailableView";

export const ContentUnavailableView = ContentUnavailableViewBase;
