"use client";
/**
 * `<SettingsGroup>` — an iOS inset-grouped settings card (data-display BLOCK).
 *
 * The canonical Settings.app section: a rounded `secondarySystemGroupedBackground`
 * card with an optional UPPERCASE footnote header / footnote footer, holding rows
 * that each have a leading COLORED ICON TILE (the 29×29 rounded-square glyph
 * chip), a label, and a trailing accessory — a value, a `<Toggle>`, or a
 * disclosure chevron.
 *
 * Composition (kit only): `<List listStyle="insetGrouped">` + `<Section>` paint
 * the card chrome and section header/footer; each `<ListRow>` uses the clean prop
 * API (`leading`/`label`/`value`/`trailing`/`accessory`). The colored icon tile
 * is rendered as `leading` content (so it bypasses the row's auto string-chip and
 * gets our tinted squircle). `<Toggle>` rows are wired through `onToggle`.
 *
 * "use client" — List/Section/ListRow/Toggle are interactive (selection, toggles).
 */
import * as React from "react";
import { List } from "../../components/List/List";
import { Section } from "../../components/Section";
import { ListRow } from "../../components/List/ListRow";
import { Toggle } from "../../components/Toggle/Toggle";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./SettingsGroup.module.css";

/** The trailing accessory of a settings row, discriminated by `kind`. */
export type SettingsRowTrailing =
  | { kind: "value"; value: React.ReactNode }
  | { kind: "toggle"; isOn: boolean; onChange: (isOn: boolean) => void; tint?: string }
  | { kind: "chevron"; value?: React.ReactNode }
  | { kind: "custom"; node: React.ReactNode };

export interface SettingsRow {
  /** Stable id (for keys / selection). */
  id?: string | number;
  /** SF Symbol drawn white on the colored tile (e.g. "wifi", "bell.fill"). */
  systemImage?: string;
  /** Tile background color (CSS color or token). Default system blue. */
  iconColor?: string;
  /** The row's primary label (body 17pt). */
  label: React.ReactNode;
  /** Trailing accessory. */
  trailing?: SettingsRowTrailing;
  /** Tap handler (e.g. push a detail screen). Adds the pressed highlight. */
  onTap?: () => void;
}

export interface SettingsGroupProps {
  /** UPPERCASE section header (footnote). String or node. */
  header?: React.ReactNode;
  /** Footnote footer (explanatory text below the card). */
  footer?: React.ReactNode;
  /** The rows. */
  rows: SettingsRow[];
  /** Drop the gray page background behind the card (e.g. inside another surface). */
  contentBackgroundHidden?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** The 29×29 rounded-square colored icon chip (Settings leading glyph). */
function IconTile({
  systemImage,
  color,
}: {
  systemImage: string;
  color: string;
}): React.ReactElement {
  return (
    <span
      className={styles.iconTile}
      style={{ ["--sui-settings-icon" as string]: color } as React.CSSProperties}
      aria-hidden="true"
    >
      <SymbolGlyph name={systemImage} size={17} weight="medium" />
    </span>
  );
}

function renderRow(row: SettingsRow, index: number): React.ReactElement {
  const t = row.trailing;
  const leading = row.systemImage ? (
    <IconTile
      systemImage={row.systemImage}
      color={row.iconColor ?? "var(--sui-color-system-blue)"}
    />
  ) : undefined;

  // Resolve the trailing slot: value text, toggle, chevron(+value), or custom.
  let value: React.ReactNode;
  let trailing: React.ReactNode;
  let accessory: "chevron" | "none" = "none";

  if (t?.kind === "value") {
    value = t.value;
  } else if (t?.kind === "toggle") {
    trailing = (
      <Toggle
        isOn={t.isOn}
        onChange={t.onChange}
        tint={t.tint}
        aria-label={typeof row.label === "string" ? row.label : undefined}
      />
    );
  } else if (t?.kind === "chevron") {
    value = t.value;
    accessory = "chevron";
  } else if (t?.kind === "custom") {
    trailing = t.node;
  }

  // chevron rows are tappable by default (NavigationLink feel).
  const onTap = row.onTap ?? (t?.kind === "chevron" ? () => {} : undefined);

  return (
    <ListRow
      key={row.id ?? index}
      id={row.id}
      leading={leading}
      leadingAsIcon={false}
      label={row.label}
      value={value}
      trailing={trailing}
      accessory={accessory}
      onTap={onTap}
    />
  );
}

export const SettingsGroup = React.forwardRef<HTMLDivElement, SettingsGroupProps>(
  function SettingsGroup(
    { header, footer, rows, contentBackgroundHidden, className, style },
    ref,
  ) {
    return (
      <div ref={ref} className={className} style={style}>
        <List
          listStyle="insetGrouped"
          contentBackgroundHidden={contentBackgroundHidden}
        >
          <Section header={header} footer={footer}>
            {rows.map((row, i) => renderRow(row, i))}
          </Section>
        </List>
      </div>
    );
  },
);

SettingsGroup.displayName = "SettingsGroup";
