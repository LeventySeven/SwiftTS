/**
 * data.ts — the Apple Notes app's data model + a realistic seed dataset.
 *
 * Plain types and a default folder/note tree so `<AppleNotesApp>` renders
 * exactly like real Notes out of the box. Callers can pass their own `accounts`
 * to the app to swap the content.
 *
 * Notes carry a `group` label ("Pinned", "Today", "Previous 7 Days", a month, a
 * year…) so the list column can render the date-grouped section headers macOS
 * Notes uses. `date` is the short stamp shown in the row; `fullDate` is the long
 * one centered atop the editor.
 */
import type * as React from "react";

/** A checklist line inside a note body block. */
export interface ChecklistItem {
  text: string;
  done?: boolean;
}

/**
 * A body block in the editor. Apple Notes interleaves paragraphs, headings,
 * checklists, bulleted lists, and tables — we model each as a discriminated block.
 */
export type NoteBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "checklist"; items: ChecklistItem[] }
  | { kind: "bullets"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] };

/** A single note. `snippet` is the secondary one-line preview in the list. */
export interface Note {
  id: string;
  title: string;
  /** One-line preview shown after the date under the title in the list column. */
  snippet: string;
  /** Short stamp shown in the list row (e.g. "Yesterday", "9:41 AM", "5/28/26"). */
  date: string;
  /** Long date shown centered atop the editor paper. */
  fullDate?: string;
  /** Date-group section the note sorts under in the list ("Today", "May", …). */
  group?: string;
  pinned?: boolean;
  body: NoteBlock[];
}

/** A folder in the source-list sidebar. */
export interface NotesFolder {
  id: string;
  name: string;
  symbol?: string;
  notes: Note[];
}

/** A named account group in the sidebar ("iCloud", "On My Mac"). */
export interface NotesAccount {
  id: string;
  name: string;
  folders: NotesFolder[];
}

/* -------------------------------------------------------------------------- */
/* Seed dataset                                                               */
/* -------------------------------------------------------------------------- */

const designReview: Note = {
  id: "n-design",
  title: "Design Review — Liquid Glass",
  snippet: "Specular rim should brighten on hover, lensing at the edges…",
  date: "9:41 AM",
  fullDate: "Today at 9:41 AM",
  group: "Pinned",
  pinned: true,
  body: [
    {
      kind: "paragraph",
      text:
        "Notes from the macOS 26 design review. The big shift is the move to Liquid Glass across all system chrome — sidebars and toolbars float over the window and refract what's behind them.",
    },
    { kind: "heading", text: "Action Items" },
    {
      kind: "checklist",
      items: [
        { text: "Audit every toolbar for the new floating treatment", done: true },
        { text: "Brighten the specular rim on hover", done: true },
        { text: "Add edge lensing to the tab bar", done: false },
        { text: "Verify legibility over busy photo backdrops", done: false },
      ],
    },
    { kind: "heading", text: "Materials" },
    {
      kind: "bullets",
      items: [
        "Regular — the default frosted slab",
        "Thick — heavier blur for dense chrome",
        "Clear — minimal tint, maximum refraction",
      ],
    },
    {
      kind: "paragraph",
      text:
        "Tint the glass with the app accent at 8% so the surface picks up brand color without losing the wash beneath it.",
    },
  ],
};

const standup: Note = {
  id: "n-standup",
  title: "Standup Notes",
  snippet: "Shipping the Notes replica today, music pill calibration next…",
  date: "8:30 AM",
  fullDate: "Today at 8:30 AM",
  group: "Today",
  body: [
    { kind: "heading", text: "Today" },
    {
      kind: "bullets",
      items: [
        "Land the 1:1 Notes template",
        "Calibrate the now-playing pill against the source",
        "Sweep the toolbar glyph coverage",
      ],
    },
    { kind: "paragraph", text: "Blocked on nothing. Demo at 4." },
  ],
};

const groceries: Note = {
  id: "n-groceries",
  title: "Grocery List",
  snippet: "Oat milk, sourdough, espresso beans, olive oil…",
  date: "Yesterday",
  fullDate: "Yesterday at 6:12 PM",
  group: "Yesterday",
  body: [
    { kind: "heading", text: "Weekend Shop" },
    {
      kind: "checklist",
      items: [
        { text: "Oat milk", done: true },
        { text: "Sourdough loaf", done: true },
        { text: "Espresso beans (decaf)", done: false },
        { text: "Olive oil", done: false },
        { text: "Lemons", done: false },
        { text: "Parmesan", done: false },
      ],
    },
    { kind: "paragraph", text: "Stop by the farmers market for tomatoes if it's open." },
  ],
};

const meeting: Note = {
  id: "n-meeting",
  title: "Q3 Planning",
  snippet: "Ship the replication kit, calibrate against the originals…",
  date: "Monday",
  fullDate: "June 8, 2026 at 2:30 PM",
  group: "Previous 7 Days",
  body: [
    { kind: "heading", text: "Goals" },
    {
      kind: "bullets",
      items: [
        "Ship the replication kit to internal beta",
        "Calibrate every replica against the source API",
        "Close the quality gap below 5%",
      ],
    },
    { kind: "paragraph", text: "Owner sync every Tuesday. Demo day is the last Friday of the quarter." },
  ],
};

const trip: Note = {
  id: "n-trip",
  title: "Kyoto Itinerary",
  snippet: "Day 1: Fushimi Inari at sunrise, then Nishiki Market…",
  date: "5/28/26",
  fullDate: "May 28, 2026 at 11:03 AM",
  group: "Previous 30 Days",
  body: [
    { kind: "paragraph", text: "Five days in Kyoto. Trying to keep mornings for temples, afternoons loose." },
    { kind: "heading", text: "Schedule" },
    {
      kind: "table",
      headers: ["Day", "Morning", "Evening"],
      rows: [
        ["1", "Fushimi Inari", "Nishiki Market"],
        ["2", "Arashiyama bamboo", "Pontocho dinner"],
        ["3", "Kinkaku-ji", "Gion walk"],
      ],
    },
    {
      kind: "bullets",
      items: ["Buy ICOCA card at the station", "Reserve ryokan for night 3", "Pack a light rain jacket"],
    },
  ],
};

const recipe: Note = {
  id: "n-recipe",
  title: "Focaccia",
  snippet: "500g flour, 400g water, 10g salt, 7g yeast…",
  date: "5/19/26",
  fullDate: "May 19, 2026 at 8:45 AM",
  group: "Previous 30 Days",
  body: [
    { kind: "heading", text: "Ingredients" },
    {
      kind: "bullets",
      items: ["500g bread flour", "400g water (80%)", "10g salt", "7g instant yeast", "Good olive oil + flaky salt"],
    },
    { kind: "heading", text: "Method" },
    {
      kind: "checklist",
      items: [
        { text: "Mix, rest 4h with three folds", done: false },
        { text: "Dimple into oiled pan, prove 1h", done: false },
        { text: "Bake 220°C / 20 min", done: false },
      ],
    },
  ],
};

const reading: Note = {
  id: "n-reading",
  title: "Reading List",
  snippet: "Designing Data-Intensive Applications, The Pragmatic…",
  date: "5/11/26",
  fullDate: "May 11, 2026 at 9:20 PM",
  group: "May",
  body: [
    {
      kind: "checklist",
      items: [
        { text: "Designing Data-Intensive Applications", done: true },
        { text: "The Pragmatic Programmer", done: false },
        { text: "Crafting Interpreters", done: false },
      ],
    },
  ],
};

const ideas: Note = {
  id: "n-ideas",
  title: "App Ideas",
  snippet: "A native-feeling Notes clone, a glass widget gallery…",
  date: "4/30/26",
  fullDate: "April 30, 2026 at 10:02 PM",
  group: "April",
  body: [
    {
      kind: "bullets",
      items: ["A native-feeling Notes clone", "A Liquid Glass widget gallery", "An SF-Symbol icon picker"],
    },
  ],
};

const quickNote: Note = {
  id: "n-quick",
  title: "Quick Note",
  snippet: "Calibrate the selection gold against the dark window…",
  date: "Today",
  fullDate: "Today at 9:58 AM",
  group: "Today",
  body: [
    { kind: "paragraph", text: "Calibrate the selection gold against the dark window. White label on the fill." },
  ],
};

/**
 * "Quick Notes" — the pinned source-list item that sits above the account
 * groups in the sidebar (its own little inbox).
 */
export const QUICK_NOTES: NotesFolder = {
  id: "quick",
  name: "Quick Notes",
  symbol: "note.text",
  notes: [quickNote],
};

/** Default account/folder tree — mirrors a fresh Notes install. */
export const DEFAULT_ACCOUNTS: NotesAccount[] = [
  {
    id: "icloud",
    name: "iCloud",
    folders: [
      { id: "all", name: "All iCloud", symbol: "tray.full", notes: [designReview, standup, groceries, meeting, trip, recipe, reading] },
      { id: "notes", name: "Notes", symbol: "folder", notes: [designReview, standup, groceries, meeting, trip, recipe, reading] },
      { id: "work", name: "Work", symbol: "folder", notes: [meeting, designReview, standup] },
      { id: "travel", name: "Travel", symbol: "folder", notes: [trip] },
      { id: "deleted", name: "Recently Deleted", symbol: "trash", notes: [] },
    ],
  },
  {
    id: "onmymac",
    name: "On My Mac",
    folders: [
      { id: "local", name: "Notes", symbol: "folder", notes: [recipe, reading, ideas] },
      { id: "personal", name: "Personal", symbol: "folder", notes: [recipe, ideas] },
    ],
  },
];

/** Every folder in the tree (Quick Notes + accounts) — for id lookup. */
export function allFolders(accounts: NotesAccount[]): NotesFolder[] {
  return [QUICK_NOTES, ...accounts.flatMap((a) => a.folders)];
}

/** Convenience: total note count for a folder (for the trailing count chip). */
export function folderCount(folder: NotesFolder): number {
  return folder.notes.length;
}

export type { React };
