"use client";
/**
 * Internal List context — published by `<List>`, read by `<Section>`/`<ListRow>`.
 * Carries the resolved list style, edit mode, and selection binding so rows can
 * render the right chrome (card background, separators, select circle) and report
 * taps back to the selection set. SwiftUI does this via `_ViewTraitKey`s on the
 * row that the List reads; the web analogue is this context + row data-attrs.
 */
import * as React from "react";
import type { ListStyleName } from "../../system/styles";

export type ResolvedListStyle = Exclude<ListStyleName, "automatic">;
export type ListEditMode = "inactive" | "active" | "transient";

export interface ListSelection {
  /** The set of currently-selected ids (single-select = 0/1 element). */
  selected: ReadonlySet<string | number>;
  /** Toggle membership of `id`. */
  toggle: (id: string | number) => void;
  /** True when a selection binding is present. */
  enabled: boolean;
}

export interface ListContextValue {
  style: ResolvedListStyle;
  editMode: ListEditMode;
  isForm: boolean;
  selection?: ListSelection;
  /** headerProminence(_:) — `.increased` enlarges section headers. */
  headerProminence?: "standard" | "increased";
  /** selectionDisabled(_:) set list-wide. */
  selectionDisabled?: boolean;
  /** listSectionSeparator(_:) visibility for the whole list. */
  sectionSeparator?: "automatic" | "visible" | "hidden";
}

export const ListContext = React.createContext<ListContextValue | null>(null);
ListContext.displayName = "ListContext";

export function useListContext(): ListContextValue {
  return (
    React.useContext(ListContext) ?? {
      style: "insetGrouped",
      editMode: "inactive",
      isForm: false,
    }
  );
}
