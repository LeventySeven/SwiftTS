"use client";
/**
 * `Section` (list section) — SwiftUI Cluster C6 §3 (grouping inside a List/Form).
 *
 *   Section { rows } header: { … } footer: { … }
 *   Section("HEADER") { rows }
 *
 * Renders the iOS Settings section: an UPPERCASE footnote/secondaryLabel header,
 * a rounded `secondarySystemGroupedBackground` card holding the rows (interior-
 * only separators), and an optional footnote footer. The card inset (20pt) +
 * radius (10pt) come from the enclosing `List`'s `data-style` via List.css.
 *
 * NOTE: this is the *list* Section (paints card chrome). It is distinct from the
 * layout-cluster `Section` (generic header/footer grouping). Use this one inside
 * `<List>` / `<Form>`.
 *
 * Collapsible (iOS 17 `Section(_:isExpanded:)`) is supported via `isExpanded`
 * (controlled) — the header gains a chevron and the card height-animates.
 */
import * as React from "react";
import { useListContext } from "../List/ListContext";
import "../List/List.global.css";

export interface SectionProps {
  /** Header (SwiftUI `header:`). A string renders as the uppercase grouped title. */
  header?: React.ReactNode;
  /** Footer (SwiftUI `footer:`). A string renders as the footnote footer. */
  footer?: React.ReactNode;
  /** Collapsible state (iOS 17 `Section(_:isExpanded:)`). Controlled when provided. */
  isExpanded?: boolean;
  /** Called when the header chevron toggles (controlled collapsible). */
  onExpandedChange?: (next: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function Section({
  header,
  footer,
  isExpanded,
  onExpandedChange,
  className,
  style,
  children,
}: SectionProps): React.ReactElement {
  const collapsible = isExpanded !== undefined;
  const expanded = isExpanded !== false;
  useListContext(); // ensure rows resolve the enclosing list style

  const headerNode = header != null ? (
    collapsible ? (
      <button
        type="button"
        className="sui-list__header"
        style={{
          all: "unset",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          width: "100%",
        }}
        aria-expanded={expanded}
        onClick={() => onExpandedChange?.(!expanded)}
      >
        <span>{header}</span>
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderTop: "2px solid var(--sui-color-tertiary-label)",
            borderRight: "2px solid var(--sui-color-tertiary-label)",
            transform: expanded ? "rotate(135deg)" : "rotate(45deg)",
            transition:
              "transform 0.3s var(--sui-collection-spring, cubic-bezier(0.22,1,0.36,1))",
          }}
        />
      </button>
    ) : (
      <div className="sui-list__header" role="presentation">
        {header}
      </div>
    )
  ) : null;

  return (
    <section
      className={["sui-list__section", className].filter(Boolean).join(" ")}
      style={style}
    >
      {headerNode}
      <div
        className="sui-list__card"
        style={
          collapsible
            ? {
                display: "grid",
                gridTemplateRows: expanded ? "1fr" : "0fr",
                transition:
                  "grid-template-rows 0.3s var(--sui-collection-spring, cubic-bezier(0.22,1,0.36,1))",
              }
            : undefined
        }
      >
        {collapsible ? (
          <div style={{ minHeight: 0, overflow: "hidden" }}>{children}</div>
        ) : (
          children
        )}
      </div>
      {footer != null ? <div className="sui-list__footer">{footer}</div> : null}
    </section>
  );
}

Section.displayName = "Section";
