"use client";
/**
 * `<AppleNotesApp>` — the full macOS 26 (Tahoe) Apple Notes app template.
 *
 * One Liquid-Glass unified toolbar across the top, split into three regions that
 * line up with the columns below it:
 *   1. sidebar — traffic lights, New Folder, sidebar toggle
 *   2. list    — the folder title + note count, and the "•••" more button
 *   3. editor  — compose, the format cluster [Aa · checklist · table], attach,
 *                then the action cluster [share · more] and the search pill
 * Below the toolbar sit the three panes (NotesFolderList · NotesList · NoteEditor).
 *
 * The app forces `platform="macOS"` via a local EnvironmentOverride and sets the
 * Notes-yellow accent so the kit's macOS vibrancy/selection chrome resolves even
 * on an iOS-default page. The window paints no background of its own — the
 * translucent sidebar/list let the wallpaper through (the Tahoe float).
 *
 * State: selected folder, selected note, and the search query are owned here and
 * threaded into the columns + the toolbar search field.
 */
import * as React from "react";
import { EnvironmentOverride } from "../../../system/environment";
import { macAccentStyle } from "../../../system/platform";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import { NotesFolderList } from "./NotesFolderList";
import { NotesList } from "./NotesList";
import { NoteEditor } from "./NoteEditor";
import { DEFAULT_ACCOUNTS, QUICK_NOTES, allFolders, folderCount } from "./data";
import type { NotesAccount, NotesFolder, Note } from "./data";
import styles from "./notes.module.css";

export interface AppleNotesAppProps {
  /** The sidebar account/folder tree. Defaults to the built-in seed dataset. */
  accounts?: NotesAccount[];
  /** Initially-selected folder id. Defaults to the first iCloud folder. */
  initialFolderId?: string;
  /** Initially-selected note id. Defaults to the first note of the initial folder. */
  initialNoteId?: string;
}

/**
 * The traffic-light cluster (close / minimize / zoom). The kit's
 * `.sui-mac-traffic-lights` CSS hues each direct child and reveals its `::after`
 * glyph on hover — so we hand it three bare spans carrying the ×, −, + glyphs.
 */
function TrafficLights(): React.ReactElement {
  return (
    <div className={`sui-mac-traffic-lights ${styles.trafficWrap}`} aria-hidden>
      <span data-glyph="×" />
      <span data-glyph="−" />
      <span data-glyph="+" />
    </div>
  );
}

/** A single toolbar icon button. */
function TbBtn({
  symbol,
  label,
  accent,
  aa,
  size = 17,
}: {
  symbol?: string;
  label: string;
  accent?: boolean;
  aa?: boolean;
  size?: number;
}): React.ReactElement {
  return (
    <button
      type="button"
      className={[
        styles.tbBtn,
        accent ? styles.tbBtnAccent : "",
        aa ? styles.tbBtnAa : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      title={label}
    >
      {aa ? "Aa" : <SymbolGlyph name={symbol ?? "circle"} size={size} weight="regular" />}
    </button>
  );
}

export function AppleNotesApp({
  accounts = DEFAULT_ACCOUNTS,
  initialFolderId,
  initialNoteId,
}: AppleNotesAppProps = {}): React.ReactElement {
  const folders = React.useMemo(() => allFolders(accounts), [accounts]);
  const firstFolder = accounts[0]?.folders[0] ?? QUICK_NOTES;

  const [folderId, setFolderId] = React.useState<string>(
    initialFolderId ?? firstFolder.id,
  );
  const folder: NotesFolder =
    folders.find((f) => f.id === folderId) ?? firstFolder;
  const notes: Note[] = folder.notes;

  const [noteId, setNoteId] = React.useState<string | undefined>(
    initialNoteId ?? notes[0]?.id,
  );
  const [query, setQuery] = React.useState("");

  // When the folder changes, select its first note and clear the search.
  const handleSelectFolder = React.useCallback(
    (id: string) => {
      setFolderId(id);
      const f = folders.find((x) => x.id === id);
      setNoteId(f?.notes[0]?.id);
      setQuery("");
    },
    [folders],
  );

  const activeNote = notes.find((n) => n.id === noteId);
  const count = folderCount(folder);

  return (
    <EnvironmentOverride platform="macOS">
      <div className={styles.app} style={macAccentStyle("var(--notes-folder)")}>
        <div className={styles.window}>
          {/* Unified Liquid-Glass toolbar across all three columns. */}
          <div className={styles.toolbar} role="toolbar" aria-label="Notes toolbar">
            <div className={styles.tbSidebar}>
              <TrafficLights />
              <TbBtn symbol="folder.badge.plus" label="New Folder" size={18} />
              <TbBtn symbol="sidebar.left" label="Hide Sidebar" size={18} />
            </div>

            <div className={styles.tbList}>
              <div className={styles.listTitle}>
                <span className={styles.listTitleName}>{folder.name}</span>
                <span className={styles.listTitleCount}>
                  {count} {count === 1 ? "note" : "notes"}
                </span>
              </div>
              <TbBtn symbol="ellipsis" label="More" size={17} />
            </div>

            <div className={styles.tbEditor}>
              <TbBtn symbol="square.and.pencil" label="New Note" size={18} />
              <div className={styles.cluster}>
                <TbBtn label="Format" aa />
                <span className={styles.clusterSep} aria-hidden />
                <TbBtn symbol="checklist" label="Checklist" size={17} />
                <TbBtn symbol="tablecells" label="Table" size={17} />
              </div>
              <div className={styles.cluster}>
                <TbBtn symbol="paperclip" label="Insert from Devices" size={17} />
              </div>
              <span className={styles.tbSpacer} aria-hidden />
              <div className={styles.cluster}>
                <TbBtn symbol="square.and.arrow.up" label="Share" size={17} />
                <TbBtn symbol="ellipsis" label="More" size={17} />
              </div>
              <div className={styles.tbSearch}>
                <SymbolGlyph name="magnifyingglass" size={13} weight="medium" />
                <input
                  className={styles.tbSearchInput}
                  type="text"
                  placeholder="Search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search notes"
                />
              </div>
            </div>
          </div>

          {/* Three-column body. */}
          <div className={styles.body}>
            <NotesFolderList
              accounts={accounts}
              topItems={[QUICK_NOTES]}
              selectedFolderId={folderId}
              onSelectFolder={handleSelectFolder}
            />
            <NotesList
              notes={notes}
              selectedNoteId={noteId}
              onSelectNote={setNoteId}
              query={query}
            />
            <NoteEditor note={activeNote} />
          </div>
        </div>
      </div>
    </EnvironmentOverride>
  );
}

AppleNotesApp.displayName = "AppleNotesApp";
