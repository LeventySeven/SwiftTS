"use client";
/**
 * `<NotesList>` — column 2 of the macOS Apple Notes app.
 *
 * The notes list for the selected folder: a search field on top, then one row
 * per note = title (semibold) + a meta line (date + 1-line snippet preview). The
 * selected row gets the characteristic yellow-tinted rounded background. Pinned
 * notes float to the top with a pin glyph.
 *
 * Controlled: parent owns `selectedNoteId`, `onSelectNote`, and the search query.
 */
import * as React from "react";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import type { Note } from "./data";
import styles from "./notes.module.css";

export interface NotesListProps {
  notes: Note[];
  selectedNoteId?: string;
  onSelectNote?: (noteId: string) => void;
  query?: string;
  onQueryChange?: (q: string) => void;
}

function NoteRow({
  note,
  selected,
  beforeSelected,
  onSelect,
}: {
  note: Note;
  selected: boolean;
  beforeSelected: boolean;
  onSelect?: () => void;
}): React.ReactElement {
  const hasSnippet = note.snippet.trim().length > 0;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      className={[
        styles.noteRow,
        selected ? styles.noteRowSelected : "",
        beforeSelected ? styles.noteRowBeforeSelected : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
    >
      <div className={styles.noteTitle}>
        {note.pinned ? (
          <span className={styles.pinBadge}>
            <SymbolGlyph name="pin.fill" size={11} weight="semibold" />
          </span>
        ) : null}
        {note.title || "New Note"}
      </div>
      <div className={styles.noteMeta}>
        <span className={styles.noteDate}>{note.date}</span>
        <span
          className={`${styles.noteSnippet} ${hasSnippet ? "" : styles.noteSnippetEmpty}`}
        >
          {hasSnippet ? note.snippet : "No additional text"}
        </span>
      </div>
    </div>
  );
}

export function NotesList({
  notes,
  selectedNoteId,
  onSelectNote,
  query = "",
  onQueryChange,
}: NotesListProps): React.ReactElement {
  // Pinned first, then by original order (stable). Filter by query if present.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? notes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.snippet.toLowerCase().includes(q),
        )
      : notes;
    return [...matched].sort(
      (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)),
    );
  }, [notes, query]);

  const selectedIndex = filtered.findIndex((n) => n.id === selectedNoteId);

  return (
    <section className={styles.list} aria-label="Notes">
      <div className={styles.searchWrap}>
        <div className={styles.search}>
          <SymbolGlyph name="magnifyingglass" size={13} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search"
            value={query}
            onChange={(e) => onQueryChange?.(e.target.value)}
            aria-label="Search notes"
          />
        </div>
      </div>

      <div className={styles.listScroll}>
        {filtered.map((note, i) => (
          <NoteRow
            key={note.id}
            note={note}
            selected={note.id === selectedNoteId}
            beforeSelected={selectedIndex >= 0 && i === selectedIndex - 1}
            onSelect={() => onSelectNote?.(note.id)}
          />
        ))}
      </div>
    </section>
  );
}

NotesList.displayName = "NotesList";
