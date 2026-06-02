"use client";

/**
 * `<Label>` — SwiftUI's icon + title pair (C1 §3).
 *
 * Spec: teardowns/SWIFTUI_C1_content-primitives.md §3.
 *
 *   Label("Add", systemImage: "plus")  →  [icon][gap][title]
 *
 * Laid out as a horizontal inline-flex, vertically centered. `LabelStyle`
 * controls icon/title visibility:
 *   .automatic / .titleAndIcon → both
 *   .iconOnly                  → title visually-hidden (a11y kept)
 *   .titleOnly                 → icon hidden
 *
 * Inherits `.labelStyle(…)` from the environment via `useResolvedStyle("label")`
 * unless an explicit `labelStyle` prop is given. Renders through `<View>` so all
 * styling modifier props pass through. Server-compatible (no client hooks).
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import { Image } from "../Image";
import { Text } from "../Text";
import { SymbolGlyph } from "../controls/SymbolGlyph";
import { useResolvedStyle, type LabelStyleName } from "../../system/styles";
import labelStyles from "./Label.module.css";

export interface LabelProps extends Omit<ViewProps, "as" | "title"> {
  /** Title content. A string renders through `<Text>`; nodes render as-is. */
  title?: React.ReactNode;
  /** SF Symbol name for the icon (`Label(_, systemImage:)`). */
  systemImage?: string;
  /** Named-asset icon (`Label(_, image:)`). */
  image?: string;
  /** `.labelStyle(_:)` — overrides the inherited environment style. */
  labelStyle?: LabelStyleName;
  /** Icon→title gap in px (`labelIconToTitleSpacing`). Default 6. */
  iconToTitleSpacing?: number;
  /** Reserved icon-column width in px (`labelReservedIconWidth`). */
  reservedIconWidth?: number;
  /**
   * Free-form override: supply custom `{ icon, title }` views (the
   * `Label(title:icon:)` ViewBuilder init). Wins over title/systemImage.
   */
  children?: React.ReactNode;
  icon?: React.ReactNode;
}

export const Label = React.forwardRef<HTMLElement, LabelProps>(function Label(
  {
    title,
    systemImage,
    image,
    labelStyle,
    iconToTitleSpacing,
    reservedIconWidth,
    icon,
    children,
    className,
    style,
    ...rest
  },
  ref,
) {
  // Resolve the active style: explicit prop > inherited environment > .automatic.
  const resolved = useResolvedStyle("label", labelStyle);

  const styleClass =
    resolved === "iconOnly"
      ? labelStyles.iconOnly
      : resolved === "titleOnly"
        ? labelStyles.titleOnly
        : undefined; // automatic / titleAndIcon → both shown

  // Build icon node: explicit `icon` > systemImage (SF Symbol via SymbolGlyph) >
  // named asset image. The SF Symbol routes through the canonical SymbolGlyph
  // renderer so the icon inherits the label's font-size + color (currentColor).
  const iconNode =
    icon ??
    (systemImage != null ? (
      <SymbolGlyph name={systemImage} />
    ) : image != null ? (
      <Image name={image} />
    ) : null);

  // Build title node: explicit `children` > `title` string/node.
  const titleNode =
    children ?? (typeof title === "string" ? <Text>{title}</Text> : title);

  const gapVar: React.CSSProperties | undefined =
    iconToTitleSpacing != null
      ? ({ ["--sui-label-gap" as string]: `${iconToTitleSpacing}px` } as React.CSSProperties)
      : undefined;
  const reservedVar: React.CSSProperties | undefined =
    reservedIconWidth != null
      ? ({ ["--sui-label-reserved-width" as string]: `${reservedIconWidth}px` } as React.CSSProperties)
      : undefined;

  const mergedClassName =
    [
      labelStyles.label,
      styleClass,
      reservedIconWidth != null ? labelStyles.reservedIcon : undefined,
      className,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const mergedStyle = {
    ...gapVar,
    ...reservedVar,
    ...style,
  } as React.CSSProperties;

  return (
    <View
      ref={ref}
      as="span"
      className={mergedClassName}
      style={mergedStyle}
      {...rest}
    >
      {iconNode != null && <span className={labelStyles.icon}>{iconNode}</span>}
      <span className={labelStyles.title}>{titleNode}</span>
    </View>
  );
});

Label.displayName = "Label";
