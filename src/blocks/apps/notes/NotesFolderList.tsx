"use client";
/**
 * `<NotesFolderList>` — column 1 of the macOS Apple Notes app.
 *
 * The source-list sidebar: account group headers ("iCloud" / "On My Mac"),
 * folder rows (yellow folder SF-symbol + name + count), and the "New Folder"
 * footer pinned to the bottom. The selected folder gets a yellow-tinted pill.
 *
 * Controlled: the parent owns `selectedFolderId` and `onSelectFolder`. Stateless
 * otherwise, but carries "use client" because it wires onClick handlers.
 */
import * as React from "react";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import { macVibrancyClass } from "../../../system/platform";
import type { NotesAccount, NotesFolder } from "./data";
import { folderCount } from "./data";
import styles from "./notes.module.css";

export interface NotesFolderListProps {
  accounts: NotesAccount[];
  selectedFolderId: string;
  onSelectFolder?: (folderId: string) => void;
  onNewFolder?: () => void;
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
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
    >
      <span className={styles.folderGlyph}>
        <SymbolGlyph name={folder.symbol ?? "folder"} size={15} weight="medium" />
      </span>
      <span className={styles.folderName}>{folder.name}</span>
      <span className={styles.folderCount}>{folderCount(folder)}</span>
    </div>
  );
}

export function NotesFolderList({
  accounts,
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
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onNewFolder?.();
          }
        }}
      >
        <SymbolGlyph name="plus.circle" size={14} weight="medium" />
        <span>New Folder</span>
      </div>
    </nav>
  );
}

NotesFolderList.displayName = "NotesFolderList";
