"use client";
/**
 * MacToolbar — the unified-toolbar item set: icon/label buttons, segmented
 * controls, hairline dividers and a recessed search field.
 *
 * These are the controls that sit in the WindowChrome titlebar row (the toolbar
 * fused into the titlebar — the modern macOS window). Each control is quiet:
 * a flat icon/glyph that gains a soft rounded hover/active wash, sized to the
 * macOS regular control height (~24px). The strip itself (drag region, the
 * no-drag opt-out on controls) is the WindowChrome's `.sui-mac-toolbar` row;
 * these are the items dropped into it.
 *
 * Exposed pieces:
 *   - <MacToolbar items={…} /> — data-driven row of mixed entries
 *   - <ToolbarIconButton systemImage="…" /> — single quiet icon button
 *   - <ToolbarSegmented options={…} selection={…} onSelect={…} /> — mode toggle
 *   - <ToolbarSearchField value={…} onChange={…} /> — the search bezel
 *   - <ToolbarDivider /> / <ToolbarSpacer /> — separators
 *
 * Stateful (callbacks, search input, focus) → `"use client"`. SSR-safe.
 */
import * as React from "react";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./macos.module.css";

/* ───────────────────────── icon / label button ───────────────── */

export interface ToolbarIconButtonProps {
  /** SF Symbol name for the glyph. */
  systemImage?: string;
  /** Optional text label (shown after the glyph, or alone if no glyph). */
  label?: string;
  /** Accessible name when icon-only (falls back to `label`). */
  title?: string;
  /** Glyph box in px (defaults to ~16, the macOS toolbar glyph size). */
  iconSize?: number;
  /** Pressed/selected styling (toggled toolbar button). */
  active?: boolean;
  /** Prominent (accent-filled) styling — e.g. a primary "Done". */
  prominent?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ToolbarIconButton({
  systemImage,
  label,
  title,
  iconSize = 16,
  active,
  prominent,
  disabled,
  onClick,
  className,
}: ToolbarIconButtonProps): React.ReactElement {
  const labelOnly = !systemImage && !!label;
  return (
    <button
      type="button"
      className={[styles.toolbarButton, className].filter(Boolean).join(" ")}
      data-active={active ? "true" : undefined}
      data-prominent={prominent ? "true" : undefined}
      data-label-only={labelOnly ? "true" : undefined}
      aria-pressed={active ? true : undefined}
      aria-label={title ?? (systemImage && !label ? label ?? systemImage : undefined)}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      {systemImage ? (
        <SymbolGlyph name={systemImage} size={iconSize} weight="regular" />
      ) : null}
      {label ? <span className={styles.toolbarButtonLabel}>{label}</span> : null}
    </button>
  );
}
ToolbarIconButton.displayName = "ToolbarIconButton";

/* ───────────────────────── segmented control ───────────────── */

export interface ToolbarSegmentOption {
  id: string;
  /** SF Symbol for an icon segment. */
  systemImage?: string;
  /** Text label (icon-only when omitted). */
  label?: string;
  title?: string;
}

export interface ToolbarSegmentedProps {
  options: ToolbarSegmentOption[];
  selection?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

export function ToolbarSegmented({
  options,
  selection,
  onSelect,
  className,
}: ToolbarSegmentedProps): React.ReactElement {
  return (
    <div
      className={[styles.segmented, className].filter(Boolean).join(" ")}
      role="radiogroup"
    >
      {options.map((opt) => {
        const selected = opt.id === selection;
        return (
          <button
            key={opt.id}
            type="button"
            className={styles.segment}
            data-selected={selected ? "true" : undefined}
            role="radio"
            aria-checked={selected}
            aria-label={opt.title ?? opt.label ?? opt.systemImage}
            title={opt.title ?? opt.label}
            onClick={() => onSelect?.(opt.id)}
          >
            {opt.systemImage ? (
              <SymbolGlyph name={opt.systemImage} size={14} weight="medium" />
            ) : null}
            {opt.label ? <span>{opt.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
ToolbarSegmented.displayName = "ToolbarSegmented";

/* ───────────────────────── search field ───────────────── */

export interface ToolbarSearchFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** Field width in px (defaults to the recessed-capsule min width). */
  width?: number;
  className?: string;
}

export function ToolbarSearchField({
  value,
  onChange,
  onSubmit,
  placeholder = "Search",
  width,
  className,
}: ToolbarSearchFieldProps): React.ReactElement {
  const [focused, setFocused] = React.useState(false);
  const [inner, setInner] = React.useState("");
  const controlled = value !== undefined;
  const text = controlled ? value : inner;

  const set = (v: string) => {
    if (!controlled) setInner(v);
    onChange?.(v);
  };

  return (
    <div
      className={[styles.search, className].filter(Boolean).join(" ")}
      data-focused={focused ? "true" : undefined}
      style={width != null ? { minWidth: width, width } : undefined}
    >
      <span className={styles.searchIcon} aria-hidden="true">
        <SymbolGlyph name="magnifyingglass" size={13} weight="regular" />
      </span>
      <input
        type="search"
        className={styles.searchInput}
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.(text ?? "");
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {text ? (
        <button
          type="button"
          className={styles.searchClear}
          aria-label="Clear search"
          onClick={() => {
            set("");
          }}
        >
          <SymbolGlyph name="xmark" size={9} weight="bold" />
        </button>
      ) : null}
    </div>
  );
}
ToolbarSearchField.displayName = "ToolbarSearchField";

/* ───────────────────────── separators ───────────────── */

export function ToolbarDivider(): React.ReactElement {
  return <span className={styles.toolbarDivider} aria-hidden="true" />;
}
ToolbarDivider.displayName = "ToolbarDivider";

/** A flexible spacer that pushes trailing items to the right edge. */
export function ToolbarSpacer(): React.ReactElement {
  return <span className={styles.toolbarSpacer} aria-hidden="true" />;
}
ToolbarSpacer.displayName = "ToolbarSpacer";

/* ───────────────────────── data-driven row ───────────────── */

/** A single entry in a data-driven MacToolbar row (a discriminated union). */
export type MacToolbarEntry =
  | ({ kind?: "button"; id?: string } & ToolbarIconButtonProps)
  | { kind: "segmented"; id?: string; segmented: ToolbarSegmentedProps }
  | { kind: "search"; id?: string; search: ToolbarSearchFieldProps }
  | { kind: "divider"; id?: string }
  | { kind: "spacer"; id?: string }
  | { kind: "custom"; id?: string; node: React.ReactNode };

export interface MacToolbarProps {
  /** Data-driven entries. Omit + use `children` to compose by hand. */
  items?: MacToolbarEntry[];
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** A bare toolbar item ROW (use inside WindowChrome's leading/trailing slots, or
 * standalone). For the full unified titlebar strip use WindowChrome / MacWindow. */
export function MacToolbar({
  items,
  children,
  className,
  style,
}: MacToolbarProps): React.ReactElement {
  return (
    <div
      className={[styles.toolbarRow, className].filter(Boolean).join(" ")}
      style={style}
      role="toolbar"
    >
      {items
        ? items.map((entry, i) => {
            const key = entry.id ?? `tb-${i}`;
            switch (entry.kind) {
              case "divider":
                return <ToolbarDivider key={key} />;
              case "spacer":
                return <ToolbarSpacer key={key} />;
              case "segmented":
                return <ToolbarSegmented key={key} {...entry.segmented} />;
              case "search":
                return <ToolbarSearchField key={key} {...entry.search} />;
              case "custom":
                return <React.Fragment key={key}>{entry.node}</React.Fragment>;
              default: {
                const { kind: _kind, id: _id, ...btn } = entry as {
                  kind?: "button";
                  id?: string;
                } & ToolbarIconButtonProps;
                return <ToolbarIconButton key={key} {...btn} />;
              }
            }
          })
        : children}
    </div>
  );
}
MacToolbar.displayName = "MacToolbar";
