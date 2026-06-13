"use client";
/**
 * `<NotesList>` — column 2 of the macOS Apple Notes app.
 *
 * The notes for the selected folder, grouped under the date-section headers
 * macOS Notes uses ("Pinned", "Today", "Previous 7 Days", a month, a year…).
 * Each row = title (semibold) + a meta line (date + 1-line snippet). The selected
 * row gets the signature solid-gold fill. The search field lives in the window
 * toolbar (not here), so this column is just the grouped, scrollable list.
 *
 * Controlled: parent owns `selectedNoteId` / `onSelectNote`; `query` filters.
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
}

/** The order date-group section headers appear in macOS Notes. */
const GROUP_ORDER = [
  "Pinned",
  "Today",
  "Yesterday",
  "Previous 7 Days",
  "Previous 30 Days",
  "June",
  "May",
  "April",
  "March",
  "February",
  "January",
  "December",
  "November",
  "October",
  "September",
  "August",
  "July",
  "2025",
  "2024",
];

function groupIndex(label: string): number {
  const i = GROUP_ORDER.indexOf(label);
  return i === -1 ? GROUP_ORDER.length : i;
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
}: NotesListProps): React.ReactElement {
  // Filter by query, then bucket into date-group sections in canonical order.
  const groups = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? notes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.snippet.toLowerCase().includes(q),
        )
      : notes;

    const byLabel = new Map<string, Note[]>();
    for (const n of matched) {
      const label = n.pinned ? "Pinned" : n.group ?? "Notes";
      const bucket = byLabel.get(label);
      if (bucket) bucket.push(n);
      else byLabel.set(label, [n]);
    }
    return [...byLabel.entries()].sort(
      (a, b) => groupIndex(a[0]) - groupIndex(b[0]),
    );
  }, [notes, query]);

  // Flat order so we can hide the hairline on the row just before the selected.
  const flat = groups.flatMap(([, ns]) => ns);
  const selectedIndex = flat.findIndex((n) => n.id === selectedNoteId);

  return (
    <section className={styles.list} aria-label="Notes">
      <div className={styles.listScroll}>
        {groups.map(([label, ns]) => (
          <React.Fragment key={label}>
            <div className={styles.dateGroup}>{label}</div>
            {ns.map((note) => {
              const flatIndex = flat.indexOf(note);
              return (
                <NoteRow
                  key={note.id}
                  note={note}
                  selected={note.id === selectedNoteId}
                  beforeSelected={
                    selectedIndex >= 0 && flatIndex === selectedIndex - 1
                  }
                  onSelect={() => onSelectNote?.(note.id)}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

NotesList.displayName = "NotesList";
