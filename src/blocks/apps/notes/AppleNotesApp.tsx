"use client";
/**
 * `<AppleNotesApp>` — the full macOS Apple Notes app template.
 *
 * Wraps the three columns (NotesFolderList · NotesList · NoteEditor) in a macOS
 * window: a unified titlebar carrying the traffic-light cluster + per-column
 * toolbar affordances (sidebar toggle, new-note, view-mode, share), then the
 * three-pane body below. The app forces `platform="macOS"` via a local
 * EnvironmentOverride and sets the Notes-yellow accent so the kit's macOS
 * vibrancy/selection chrome renders correctly even on an iOS-default page.
 *
 * State: selected folder, selected note, and the search query are owned here and
 * threaded into the columns. Pass `accounts` to swap the content; defaults to the
 * built-in seed tree so it renders like real Notes out of the box.
 */
import * as React from "react";
import { EnvironmentOverride } from "../../../system/environment";
import { macAccentStyle } from "../../../system/platform";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import { NotesFolderList } from "./NotesFolderList";
import { NotesList } from "./NotesList";
import { NoteEditor } from "./NoteEditor";
import { DEFAULT_ACCOUNTS } from "./data";
import type { NotesAccount, NotesFolder, Note } from "./data";
import styles from "./notes.module.css";

export interface AppleNotesAppProps {
  /** The sidebar account/folder tree. Defaults to the built-in seed dataset. */
  accounts?: NotesAccount[];
  /** Initially-selected folder id. Defaults to the first folder of the first account. */
  initialFolderId?: string;
  /** Initially-selected note id. Defaults to the first note of the initial folder. */
  initialNoteId?: string;
}

/** Flatten to the folder matching an id (searching every account). */
function findFolder(accounts: NotesAccount[], id: string): NotesFolder | undefined {
  for (const acc of accounts) {
    const f = acc.folders.find((x) => x.id === id);
    if (f) return f;
  }
  return undefined;
}

/**
 * The traffic-light cluster (close / minimize / zoom). The kit's
 * `.sui-mac-traffic-lights` CSS hues each direct child and reveals its `::after`
 * glyph on hover — so we hand it three bare spans carrying the ×, −, + glyphs.
 */
function TrafficLights(): React.ReactElement {
  return (
    <div className="sui-mac-traffic-lights" aria-hidden>
      <span data-glyph="×" />
      <span data-glyph="−" />
      <span data-glyph="+" />
    </div>
  );
}

/** A round titlebar toolbar button. */
function ChromeBtn({
  symbol,
  label,
  accent,
  size = 16,
}: {
  symbol: string;
  label: string;
  accent?: boolean;
  size?: number;
}): React.ReactElement {
  return (
    <button
      type="button"
      className={`${styles.chromeBtn} ${accent ? styles.chromeBtnAccent : ""}`}
      aria-label={label}
      title={label}
    >
      <SymbolGlyph name={symbol} size={size} weight="regular" />
    </button>
  );
}

export function AppleNotesApp({
  accounts = DEFAULT_ACCOUNTS,
  initialFolderId,
  initialNoteId,
}: AppleNotesAppProps = {}): React.ReactElement {
  const firstFolder = accounts[0]?.folders[0];
  const [folderId, setFolderId] = React.useState<string>(
    initialFolderId ?? firstFolder?.id ?? "",
  );
  const folder = findFolder(accounts, folderId) ?? firstFolder;
  const notes: Note[] = folder?.notes ?? [];

  const [noteId, setNoteId] = React.useState<string | undefined>(
    initialNoteId ?? notes[0]?.id,
  );
  const [query, setQuery] = React.useState("");

  // When the folder changes, select its first note and clear the search.
  const handleSelectFolder = React.useCallback(
    (id: string) => {
      setFolderId(id);
      const f = findFolder(accounts, id);
      setNoteId(f?.notes[0]?.id);
      setQuery("");
    },
    [accounts],
  );

  const activeNote = notes.find((n) => n.id === noteId);

  return (
    <EnvironmentOverride platform="macOS">
      <div className={styles.app} style={macAccentStyle("var(--notes-yellow)")}>
        <div className={`${styles.window} sui-mac-vibrancy sui-mac-vibrancy-windowBackground`}>
          {/* Unified titlebar across all three columns. */}
          <div className={styles.titleBar}>
            <div className={styles.titleBarSidebar}>
              <TrafficLights />
              <ChromeBtn symbol="sidebar.left" label="Hide Sidebar" />
            </div>
            <div className={styles.titleBarMain}>
              <ChromeBtn symbol="square.and.pencil" label="New Note" accent size={17} />
              <ChromeBtn symbol="trash" label="Delete" />
              <span style={{ flex: "1 1 auto" }} />
              <ChromeBtn symbol="rectangle.grid.1x2" label="View as Gallery" />
              <ChromeBtn symbol="square.and.arrow.up" label="Share" />
            </div>
          </div>

          {/* Three-column body. */}
          <div className={styles.body}>
            <NotesFolderList
              accounts={accounts}
              selectedFolderId={folderId}
              onSelectFolder={handleSelectFolder}
            />
            <NotesList
              notes={notes}
              selectedNoteId={noteId}
              onSelectNote={setNoteId}
              query={query}
              onQueryChange={setQuery}
            />
            <NoteEditor note={activeNote} />
          </div>
        </div>
      </div>
    </EnvironmentOverride>
  );
}

AppleNotesApp.displayName = "AppleNotesApp";
