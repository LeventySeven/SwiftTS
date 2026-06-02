"use client";
/**
 * Gallery chrome — iOS-flavored layout primitives the showcase reuses.
 * These are NOT part of the @sui kit; they are the page scaffold (grouped
 * background, section headers, rounded cards) that frames the real components.
 */
import * as React from "react";

/** Uppercased footnote / secondaryLabel section header, iOS-Settings style. */
export function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}): React.ReactElement {
  return (
    <header style={{ padding: "0 4px 8px", marginTop: 8 }}>
      <div
        style={{
          fontSize: "var(--sui-text-footnote-size, 13px)",
          lineHeight: "var(--sui-text-footnote-lineHeight, 18px)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "var(--sui-color-secondary-label)",
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            fontSize: "var(--sui-text-footnote-size, 13px)",
            lineHeight: "var(--sui-text-footnote-lineHeight, 18px)",
            color: "var(--sui-color-tertiary-label)",
            marginTop: 2,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </header>
  );
}

/** A top-level gallery section: a titled header + a stack of cards. */
export function GallerySection({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section id={id} style={{ marginBottom: 36, scrollMarginTop: 88 }}>
      <SectionHeader title={title} subtitle={subtitle} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </div>
    </section>
  );
}

/** A rounded, elevated card on the grouped background. */
export function Card({
  title,
  children,
  bleed = false,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  /** Drop the inner padding (for full-bleed content like lists/nav). */
  bleed?: boolean;
  style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <div
      style={{
        background: "var(--sui-color-secondary-system-grouped-background)",
        borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)",
        overflow: "hidden",
        ...style,
      }}
    >
      {title ? (
        <div
          style={{
            padding: "14px 18px 0",
            fontSize: "var(--sui-text-subheadline-size, 15px)",
            fontWeight: 600,
            color: "var(--sui-color-label)",
          }}
        >
          {title}
        </div>
      ) : null}
      <div style={{ padding: bleed ? 0 : 18 }}>{children}</div>
    </div>
  );
}

/** A captioned demo cell — a label above an inline example. */
export function Cell({
  label,
  children,
  align = "flex-start",
  style,
}: {
  label?: string;
  children: React.ReactNode;
  align?: React.CSSProperties["alignItems"];
  style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, ...style }}>
      {label ? (
        <div
          style={{
            fontSize: "var(--sui-text-caption-size, 12px)",
            color: "var(--sui-color-secondary-label)",
            fontVariant: "small-caps",
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: align, gap: 12, flexWrap: "wrap" }}>
        {children}
      </div>
    </div>
  );
}

/** A simple responsive grid of cells. */
export function CellGrid({
  children,
  min = 160,
  gap = 20,
}: {
  children: React.ReactNode;
  min?: number;
  gap?: number;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        gap,
        alignItems: "start",
      }}
    >
      {children}
    </div>
  );
}

/** A thin separator inside a card. */
export function HairlineRule(): React.ReactElement {
  return (
    <div
      style={{
        height: 0.5,
        background: "var(--sui-color-separator)",
        margin: "16px -18px",
      }}
    />
  );
}
