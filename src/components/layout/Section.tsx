"use client";
/**
 * `Section` — header / content / footer grouping (in List/Form/Picker/Grids).
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §12.
 *
 *   Section(content:) / Section(content:footer:) / Section(content:header:)
 *   Section(_ title, content:)
 *   Section(_ title, isExpanded: Binding<Bool>, content:)   // collapsible (iOS 17+)
 *
 * `Parent` = header, `Content` = body, `Footer` = footer; any of header/footer
 * may be empty. With `isExpanded` (controlled), the section is collapsible: the
 * header shows a disclosure chevron (rotates 0°→90° when expanded, ~0.25s ease)
 * and tapping it calls `onExpandedChange`. In grouped style the header text is
 * uppercased + secondary-label colored; collapsed content is height-animated via
 * `grid-template-rows: 0fr → 1fr`.
 *
 * Client component — the chevron handles a click event.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";

export interface SectionProps extends Omit<ViewProps, "as" | "title"> {
  /** Header (SwiftUI `Parent`). A string renders as the grouped-style title. */
  header?: React.ReactNode;
  /** Footer (SwiftUI `Footer`). */
  footer?: React.ReactNode;
  /** Controlled collapsible state (iOS 17+). When provided, the section is collapsible. */
  isExpanded?: boolean;
  /** Called when the disclosure chevron is tapped. */
  onExpandedChange?: (value: boolean) => void;
  /** Visual style: grouped (uppercased header) vs plain (sentence case). Default `grouped`. */
  sectionStyle?: "grouped" | "plain";
  children?: React.ReactNode;
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: "var(--sui-text-footnote-size)",
  lineHeight: "var(--sui-text-footnote-lineHeight)",
  letterSpacing: "var(--sui-text-footnote-tracking)",
  color: "var(--sui-color-secondary-label)",
  padding: "8px 16px 4px",
};

const footerStyle: React.CSSProperties = {
  fontSize: "var(--sui-text-footnote-size)",
  lineHeight: "var(--sui-text-footnote-lineHeight)",
  letterSpacing: "var(--sui-text-footnote-tracking)",
  color: "var(--sui-color-secondary-label)",
  padding: "4px 16px 8px",
};

const chevronStyle = (expanded: boolean): React.CSSProperties => ({
  width: "13px",
  height: "13px",
  flexShrink: 0,
  transition: "transform 0.25s ease",
  transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
});

export const Section = React.forwardRef<HTMLElement, SectionProps>(function Section(
  {
    header,
    footer,
    isExpanded,
    onExpandedChange,
    sectionStyle = "grouped",
    style,
    children,
    ...rest
  },
  ref,
) {
  const collapsible = isExpanded !== undefined;
  const expanded = isExpanded !== false;

  const toggle = React.useCallback(() => {
    if (collapsible) onExpandedChange?.(!expanded);
  }, [collapsible, expanded, onExpandedChange]);

  const headerTextStyle: React.CSSProperties =
    sectionStyle === "grouped" ? { textTransform: "uppercase" } : {};

  // Collapsible content uses a height-animatable grid-rows wrapper.
  const contentWrap: React.CSSProperties = collapsible
    ? {
        display: "grid",
        gridTemplateRows: expanded ? "1fr" : "0fr",
        transition: "grid-template-rows 0.25s ease",
      }
    : {};
  const contentInner: React.CSSProperties = collapsible ? { overflow: "hidden" } : {};

  return (
    <View
      ref={ref}
      as="section"
      data-collapsible={collapsible || undefined}
      data-expanded={collapsible ? String(expanded) : undefined}
      data-section-style={sectionStyle}
      style={mergeStyles({ display: "block" }, style)}
      {...rest}
    >
      {header !== undefined && (
        <header
          style={mergeStyles(
            headerStyle,
            headerTextStyle,
            collapsible ? { cursor: "pointer" } : undefined,
          )}
          onClick={collapsible ? toggle : undefined}
          role={collapsible ? "button" : undefined}
          tabIndex={collapsible ? 0 : undefined}
          onKeyDown={
            collapsible
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                  }
                }
              : undefined
          }
        >
          <span>{header}</span>
          {collapsible && (
            <svg
              viewBox="0 0 13 13"
              style={chevronStyle(expanded)}
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4,2 9,6.5 4,11" />
            </svg>
          )}
        </header>
      )}
      <div style={contentWrap}>
        <div style={contentInner}>{children}</div>
      </div>
      {footer !== undefined && <footer style={footerStyle}>{footer}</footer>}
    </View>
  );
});

Section.displayName = "Section";
