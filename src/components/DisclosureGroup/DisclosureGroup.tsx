"use client";
/**
 * `DisclosureGroup` — SwiftUI Cluster C6 §7.
 *
 *   DisclosureGroup("Advanced") { content }
 *   DisclosureGroup(isExpanded: $open) { content } label: { … }
 *
 * A chevron + label header that reveals indented content. The chevron rotates
 * 0°→90° with a spring; the content height-animates via the
 * `grid-template-rows: 0fr → 1fr` trick (no content measurement). `isExpanded`
 * makes it controlled; omit it for internal `useState`.
 */
import * as React from "react";
import "./DisclosureGroup.module.css";

export interface DisclosureGroupProps {
  /** `titleKey` convenience — the header text. Ignored if `label` is set. */
  title?: React.ReactNode;
  /** Custom header label (overrides `title`). */
  label?: React.ReactNode;
  /** Controlled expansion (`isExpanded: Binding<Bool>`). Omit for internal state. */
  isExpanded?: boolean;
  /** Called when the header toggles (controlled). */
  onExpandedChange?: (next: boolean) => void;
  /** Initial expansion for the uncontrolled case. Default `false`. */
  defaultExpanded?: boolean;
  /** Indentation (px) applied to the revealed content. Default 28. */
  indent?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function DisclosureGroup({
  title,
  label,
  isExpanded,
  onExpandedChange,
  defaultExpanded = false,
  indent,
  className,
  style,
  children,
}: DisclosureGroupProps): React.ReactElement {
  const controlled = isExpanded !== undefined;
  const [internal, setInternal] = React.useState(defaultExpanded);
  const expanded = controlled ? !!isExpanded : internal;

  const toggle = React.useCallback(() => {
    if (controlled) onExpandedChange?.(!expanded);
    else setInternal((v) => !v);
  }, [controlled, expanded, onExpandedChange]);

  const rootStyle: React.CSSProperties = {
    ...(indent != null
      ? { ["--sui-disclosure-indent" as string]: `${indent}px` }
      : null),
    ...style,
  };

  return (
    <div
      className={["sui-disclosure", className].filter(Boolean).join(" ")}
      data-expanded={expanded ? "true" : "false"}
      style={rootStyle}
    >
      <button
        type="button"
        className="sui-disclosure__header"
        aria-expanded={expanded}
        onClick={toggle}
      >
        <span className="sui-disclosure__chevron" aria-hidden="true" />
        <span className="sui-disclosure__label">{label ?? title}</span>
      </button>
      <div className="sui-disclosure__content" role="group">
        <div className="sui-disclosure__content-inner">{children}</div>
      </div>
    </div>
  );
}

DisclosureGroup.displayName = "DisclosureGroup";
