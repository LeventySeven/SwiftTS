"use client";
/**
 * `List` — the iOS Settings engine (Cluster C6 §3). The single most important
 * component in this cluster.
 *
 *   List { … } / List(selection:) { … } / List(data, selection:, rowContent:)
 *   .listStyle(.plain | .grouped | .insetGrouped | .inset | .sidebar)
 *   .listRowSpacing / .listSectionSpacing / .scrollContentBackground(.hidden)
 *
 * Layer-2 in the C6 mental model: owns row chrome (card background, separators,
 * section grouping, selection, swipe, edit). It is a styled `role=list` wrapper —
 * NOT a raw scroller. `.insetGrouped` (20pt card inset, 10pt radius,
 * secondarySystemGroupedBackground card on systemGroupedBackground page, 35pt
 * section gaps, 16pt-leading interior-only separators) IS the Settings look.
 *
 * Style resolution uses `useResolvedStyle('list', style)` so an ancestor
 * `.listStyle(...)` (ListStyleProvider) is inherited when no explicit style is set.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import {
  useResolvedStyle,
  makeStyleProvider,
  type ListStyleName,
} from "../../system/styles";
import {
  ListContext,
  type ListContextValue,
  type ListEditMode,
  type ListSelection,
  type ResolvedListStyle,
} from "./ListContext";
import "./List.global.css";

export type ListSectionSpacingName = "default" | "compact";

/** `List(selection:)` binding: `[Set, setSet]` (multi) or `[value|null, set]` (single). */
export type ListSelectionBinding =
  | [
      ReadonlySet<string | number>,
      (next: Set<string | number>) => void,
      "multiple"?,
    ]
  | [string | number | null, (next: string | number | null) => void, "single"];

export interface ListProps extends Omit<ViewProps, "as"> {
  /** listStyle(_:). `"automatic"` → insetGrouped (the iOS-in-NavigationStack default). */
  style?: never; // disambiguation: `style` prop on View is CSS; list style is `listStyle`.
  /** listStyle(_:). */
  listStyle?: ListStyleName;
  /** List(selection:). */
  selection?: ListSelectionBinding;
  /** EnvironmentValues.editMode. */
  editMode?: ListEditMode;
  /** listRowSpacing(_:) — extra gap between rows (px). */
  rowSpacing?: number;
  /** listSectionSpacing(_:) — gap between sections (px or named). */
  sectionSpacing?: number | ListSectionSpacingName;
  /** scrollContentBackground(.hidden) — drop the gray page background. */
  contentBackgroundHidden?: boolean;
  /** Mark this List as a Form (label/control row layout). Internal — set by `<Form>`. */
  asForm?: boolean;
  cssStyle?: React.CSSProperties;
  children?: React.ReactNode;
}

const SECTION_SPACING_PX: Record<ListSectionSpacingName, number> = {
  default: 35,
  compact: 12,
};

function resolveAutomatic(name: ListStyleName): ResolvedListStyle {
  // iOS-in-NavigationStack default is insetGrouped — our fidelity bar.
  return name === "automatic" ? "insetGrouped" : name;
}

export const List = React.forwardRef<HTMLElement, ListProps>(function List(
  {
    listStyle,
    selection,
    editMode = "inactive",
    rowSpacing,
    sectionSpacing,
    contentBackgroundHidden = false,
    asForm = false,
    cssStyle,
    children,
    ...rest
  },
  ref,
) {
  const resolvedName = useResolvedStyle("list", listStyle);
  const style = resolveAutomatic(resolvedName);

  // ---- selection binding → ListSelection ----
  const listSelection = React.useMemo<ListSelection | undefined>(() => {
    if (!selection) return undefined;
    const [first, setter, mode] = selection;
    if (mode === "single" || (!(first instanceof Set) && mode !== "multiple")) {
      const current = first as string | number | null;
      const set = new Set<string | number>(current != null ? [current] : []);
      return {
        selected: set,
        enabled: true,
        toggle: (id) =>
          (setter as (n: string | number | null) => void)(
            current === id ? null : id,
          ),
      };
    }
    const set = first as ReadonlySet<string | number>;
    return {
      selected: set,
      enabled: true,
      toggle: (id) => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        (setter as (n: Set<string | number>) => void)(next);
      },
    };
  }, [selection]);

  const ctxValue = React.useMemo<ListContextValue>(
    () => ({ style, editMode, isForm: asForm, selection: listSelection }),
    [style, editMode, asForm, listSelection],
  );

  const sectionSpacingPx =
    typeof sectionSpacing === "number"
      ? sectionSpacing
      : sectionSpacing
        ? SECTION_SPACING_PX[sectionSpacing]
        : undefined;

  const rootStyle: React.CSSProperties = mergeStyles(
    {
      ...(rowSpacing != null
        ? { ["--sui-list-row-spacing" as string]: `${rowSpacing}px` }
        : null),
      ...(sectionSpacingPx != null
        ? { ["--sui-list-section-spacing" as string]: `${sectionSpacingPx}px` }
        : null),
    },
    cssStyle,
  );

  return (
    <ListContext.Provider value={ctxValue}>
      <View
        ref={ref}
        as="div"
        className="sui-list"
        role="list"
        data-style={style}
        data-edit={editMode !== "inactive" ? editMode : undefined}
        data-form={asForm ? "true" : undefined}
        data-content-bg={contentBackgroundHidden ? "hidden" : undefined}
        data-row-spacing={rowSpacing != null ? "true" : undefined}
        style={rootStyle}
        {...rest}
      >
        {children}
      </View>
    </ListContext.Provider>
  );
});

List.displayName = "List";

/** `.listStyle(...)` set on a container — descendants inherit the style. */
export const ListStyleProvider = makeStyleProvider("list");
