/**
 * Apple Notes app template — `src/blocks/apps/notes`.
 *
 * A faithful macOS Apple Notes clone composed from the SwiftTS kit: a three-column
 * layout (FOLDERS sidebar · NOTES list · EDITOR paper) in a macOS window chrome,
 * the Notes-yellow accent throughout, and ~all icons via SymbolGlyph.
 *
 * Export the full app (`AppleNotesApp`) plus the three columns as standalone
 * pieces, and the data model + seed dataset.
 */

export { AppleNotesApp } from "./AppleNotesApp";
export type { AppleNotesAppProps } from "./AppleNotesApp";

export { NotesFolderList } from "./NotesFolderList";
export type { NotesFolderListProps } from "./NotesFolderList";

export { NotesList } from "./NotesList";
export type { NotesListProps } from "./NotesList";

export { NoteEditor } from "./NoteEditor";
export type { NoteEditorProps } from "./NoteEditor";

export { DEFAULT_ACCOUNTS, folderCount } from "./data";
export type {
  NotesAccount,
  NotesFolder,
  Note,
  NoteBlock,
  ChecklistItem,
} from "./data";
