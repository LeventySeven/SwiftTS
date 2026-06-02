"use client";
/**
 * `<SearchScreen>` — a Liquid-Glass search experience, composed from the kit.
 *
 * Chrome:  a floating Liquid-Glass header (`<GlassEffect>`) with a large title and
 *          a glass search field (`searchable`-style: leading magnifier, live text,
 *          a clear button that appears once you type).
 * Scopes:  a horizontal row of scope chips (All / People / Files / Music) — the
 *          web analog of `.searchScopes`. The active chip is tint-filled.
 * Results: when there is a query, a grouped `<List>` of matching rows filtered by
 *          the active scope; when the query is empty, a "Recent searches" grouped
 *          card plus trending suggestions — exactly the iOS empty-search state.
 *
 * Composes from the kit: `<GlassEffect>` (glass bar + field), `<List>/<ListRow>/
 * <Section>` (grouped results), `<SymbolGlyph>` (icons), tokens. Client component
 * — owns the query text + selected scope.
 */
import * as React from "react";
import { List } from "../../components/List";
import { ListRow } from "../../components/List/ListRow";
import { Section } from "../../components/layout/Section";
import { GlassEffect } from "../../system/effects";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import { Text } from "../../components/Text";
import styles from "./screens.module.css";

type Scope = "all" | "people" | "files" | "music";

interface Result {
  title: string;
  sub: string;
  symbol: string;
  tint: string;
  scope: Exclude<Scope, "all">;
}

const RESULTS: Result[] = [
  { title: "Johnny Appleseed", sub: "Contact", symbol: "person.crop.circle.fill", tint: "var(--sui-color-system-blue)", scope: "people" },
  { title: "Susan Prescott", sub: "Contact", symbol: "person.crop.circle.fill", tint: "var(--sui-color-system-green)", scope: "people" },
  { title: "Q3 Report.pdf", sub: "Document · 2.4 MB", symbol: "doc.fill", tint: "var(--sui-color-system-red)", scope: "files" },
  { title: "Roadmap.key", sub: "Keynote · 18 MB", symbol: "doc.text", tint: "var(--sui-color-system-orange)", scope: "files" },
  { title: "Midnight City", sub: "M83 · Hurry Up", symbol: "music.note", tint: "var(--sui-color-system-pink)", scope: "music" },
  { title: "Resonance", sub: "Home · Odyssey", symbol: "music.note", tint: "var(--sui-color-system-purple)", scope: "music" },
];

const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "people", label: "People" },
  { id: "files", label: "Files" },
  { id: "music", label: "Music" },
];

const RECENTS = ["Quarterly report", "Susan Prescott", "M83", "design tokens"];
const TRENDING = [
  { label: "Liquid Glass", symbol: "star.fill", tint: "var(--sui-color-system-indigo)" },
  { label: "SwiftUI 26", symbol: "square.grid.2x2", tint: "var(--sui-color-system-orange)" },
  { label: "Dashboards", symbol: "bag.fill", tint: "var(--sui-color-system-blue)" },
];

function ResultIcon({ symbol, tint }: { symbol: string; tint: string }): React.ReactElement {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        inlineSize: 32,
        blockSize: 32,
        borderRadius: 8,
        background: tint,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      <SymbolGlyph name={symbol} size={16} color="#fff" weight="semibold" />
    </span>
  );
}

export interface SearchScreenProps {
  title?: string;
}

export function SearchScreen({ title = "Search" }: SearchScreenProps = {}): React.ReactElement {
  const [query, setQuery] = React.useState("");
  const [scope, setScope] = React.useState<Scope>("all");

  const q = query.trim().toLowerCase();
  const matches = RESULTS.filter((r) => {
    const inScope = scope === "all" || r.scope === scope;
    const inText = q === "" || r.title.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q);
    return inScope && inText;
  });

  return (
    <div className={styles.scene}>
      {/* ── Floating Liquid-Glass search header ── */}
      <GlassEffect glass="regular" shape={{ rounded: 0 }} className={styles.glassBar}>
        <div className={styles.barTopRow}>
          <span className={styles.barTitle}>{title}</span>
          <span className={styles.iconButton} role="button" aria-label="Filter">
            <SymbolGlyph name="slider.horizontal.3" size={18} />
          </span>
        </div>
        <GlassEffect glass="clear" shape={{ rounded: 12 }} className={styles.searchField}>
          <span className={styles.searchIcon}>
            <SymbolGlyph name="magnifyingglass" size={16} />
          </span>
          <input
            className={styles.searchInput}
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
            autoComplete="off"
          />
          {query !== "" ? (
            <span
              className={styles.searchClear}
              role="button"
              aria-label="Clear"
              onClick={() => setQuery("")}
            >
              <SymbolGlyph name="xmark.circle.fill" size={16} />
            </span>
          ) : null}
        </GlassEffect>
      </GlassEffect>

      {/* scope chips */}
      <div className={styles.scopeRow}>
        {SCOPES.map((s) => (
          <button
            key={s.id}
            className={`${styles.scopeChip} ${scope === s.id ? styles.scopeChipActive : ""}`}
            onClick={() => setScope(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Body: results, or recent/trending empty state ── */}
      <div className={styles.body}>
        {q !== "" ? (
          <List listStyle="insetGrouped">
            <Section header={`${matches.length} result${matches.length === 1 ? "" : "s"}`}>
              {matches.length === 0 ? (
                <ListRow
                  leading={<ResultIcon symbol="magnifyingglass" tint="var(--sui-color-system-gray)" />}
                  label="No results"
                  value={`for “${query}”`}
                />
              ) : (
                matches.map((r) => (
                  <ListRow
                    key={r.title}
                    leading={<ResultIcon symbol={r.symbol} tint={r.tint} />}
                    label={r.title}
                    value={r.sub}
                    accessory="chevron"
                    onTap={() => {}}
                  />
                ))
              )}
            </Section>
          </List>
        ) : (
          <List listStyle="insetGrouped">
            <Section header="Recent">
              {RECENTS.map((term) => (
                <ListRow
                  key={term}
                  leading={<ResultIcon symbol="clock.fill" tint="var(--sui-color-system-gray)" />}
                  label={term}
                  accessory="chevron"
                  onTap={() => setQuery(term)}
                />
              ))}
            </Section>

            <Section header="Trending" footer="Tap a suggestion to start a search.">
              {TRENDING.map((t) => (
                <ListRow
                  key={t.label}
                  leading={<ResultIcon symbol={t.symbol} tint={t.tint} />}
                  label={t.label}
                  accessory="chevron"
                  onTap={() => setQuery(t.label)}
                />
              ))}
            </Section>

            <Text
              font="footnote"
              foregroundStyle="secondaryLabel"
              style={{ display: "block", textAlign: "center", padding: "4px 16px 20px" }}
            >
              Search people, files, and music
            </Text>
          </List>
        )}
      </div>
    </div>
  );
}

SearchScreen.displayName = "SearchScreen";
