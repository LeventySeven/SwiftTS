"use client";
/**
 * `<NotesFolderList>` — column 1 of the macOS Apple Notes app.
 *
 * The source-list sidebar: a pinned "Quick Notes" item up top (the `topItems`),
 * then the account groups ("iCloud" / "On My Mac") with their folder rows (yellow
 * folder SF-symbol + name + count), and the "New Folder" footer pinned to the
 * bottom. The selected folder gets the macOS unemphasized gray selection pill.
 *
 * Controlled: the parent owns `selectedFolderId` and `onSelectFolder`.
 */
import * as React from "react";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import { macVibrancyClass } from "../../../system/platform";
import type { NotesAccount, NotesFolder } from "./data";
import { folderCount } from "./data";
import styles from "./notes.module.css";

export interface NotesFolderListProps {
  accounts: NotesAccount[];
  /** Pinned items rendered above the account groups (e.g. Quick Notes). */
  topItems?: NotesFolder[];
  selectedFolderId: string;
  onSelectFolder?: (folderId: string) => void;
  onNewFolder?: () => void;
}

function key(e: React.KeyboardEvent, fn?: () => void): void {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn?.();
  }
}

function FolderRow({
  folder,
  selected,
  onSelect,
}: {
  folder: NotesFolder;
  selected: boolean;
  onSelect?: () => void;
}): React.ReactElement {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      data-selected={selected || undefined}
      className={`${styles.folderRow} ${selected ? styles.folderRowSelected : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => key(e, onSelect)}
    >
      <span className={styles.folderGlyph}>
        <SymbolGlyph name={folder.symbol ?? "folder"} size={16} weight="medium" />
      </span>
      <span className={styles.folderName}>{folder.name}</span>
      <span className={styles.folderCount}>{folderCount(folder)}</span>
    </div>
  );
}

export function NotesFolderList({
  accounts,
  topItems = [],
  selectedFolderId,
  onSelectFolder,
  onNewFolder,
}: NotesFolderListProps): React.ReactElement {
  return (
    <nav
      className={`${styles.sidebar} ${macVibrancyClass("sidebar")}`}
      aria-label="Folders"
    >
      <div className={styles.sidebarScroll}>
        {topItems.map((item) => {
          const selected = item.id === selectedFolderId;
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-current={selected ? "true" : undefined}
              data-selected={selected || undefined}
              className={`${styles.quickRow} ${selected ? styles.folderRowSelected : ""}`}
              onClick={() => onSelectFolder?.(item.id)}
              onKeyDown={(e) => key(e, () => onSelectFolder?.(item.id))}
            >
              <span className={styles.quickGlyph}>
                <SymbolGlyph name={item.symbol ?? "note.text"} size={16} weight="medium" />
              </span>
              <span className={styles.folderName}>{item.name}</span>
              <span className={styles.folderCount}>{folderCount(item)}</span>
            </div>
          );
        })}

        {accounts.map((account) => (
          <div key={account.id}>
            <div className={styles.groupHeader}>{account.name}</div>
            {account.folders.map((folder) => (
              <FolderRow
                key={`${account.id}-${folder.id}`}
                folder={folder}
                selected={folder.id === selectedFolderId}
                onSelect={() => onSelectFolder?.(folder.id)}
              />
            ))}
          </div>
        ))}
      </div>

      <div
        className={styles.sidebarFooter}
        role="button"
        tabIndex={0}
        onClick={onNewFolder}
        onKeyDown={(e) => key(e, onNewFolder)}
      >
        <span className={styles.sidebarFooterGlyph}>
          <SymbolGlyph name="folder.badge.plus" size={15} weight="medium" />
        </span>
        <span>New Folder</span>
      </div>
    </nav>
  );
}

NotesFolderList.displayName = "NotesFolderList";
