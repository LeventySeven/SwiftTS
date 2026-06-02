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
import type { Edge, EdgeSet } from "../../system/types";
import {
  ListContext,
  type ListContextValue,
  type ListEditMode,
  type ListRowHoverEffect,
  type ListSelection,
  type ResolvedListStyle,
} from "./ListContext";
import "./List.global.css";

export type ListSectionSpacingName = "default" | "compact";

/** `Visibility` — shared three-state vocabulary (`automatic`/`visible`/`hidden`). */
export type Visibility = "automatic" | "visible" | "hidden";

/**
 * `ListItemTint` — the rich form of `listItemTint(_:)`. SwiftUI ships three
 * cases: `.fixed(Color)` (an exact accent), `.preferred(Color)` (the system may
 * override it for legibility), and `.monochrome` (drop the tint to a neutral
 * gray). The plain `listItemTint(Color?)` overload maps to `.fixed`.
 */
export type ListItemTint =
  | { kind: "fixed"; color: string }
  | { kind: "preferred"; color: string }
  | { kind: "monochrome" };

export const ListItemTint = {
  /** `ListItemTint.fixed(_:)` — paint interactive row content this exact color. */
  fixed: (color: string): ListItemTint => ({ kind: "fixed", color }),
  /** `ListItemTint.preferred(_:)` — a hint the system may override for legibility. */
  preferred: (color: string): ListItemTint => ({ kind: "preferred", color }),
  /** `ListItemTint.monochrome` — neutral gray, no accent. */
  monochrome: { kind: "monochrome" } as ListItemTint,
} as const;

/** Resolve a `ListItemTint | string` (plain color shorthand) to a CSS color, or `undefined`. */
function resolveItemTint(
  tint: ListItemTint | string | undefined,
): string | undefined {
  if (tint == null) return undefined;
  if (typeof tint === "string") return tint; // listItemTint(Color?) shorthand → .fixed
  switch (tint.kind) {
    case "fixed":
    case "preferred":
      return tint.color;
    case "monochrome":
      return "var(--sui-color-secondary-label)";
  }
}

/**
 * `listSectionMargins(_ edges: Edge.Set, _ length: CGFloat?)` — extra horizontal
 * (and/or vertical) inset applied to each section's card on the named edges. We
 * accept the SwiftUI `Edge.Set` vocabulary; on web only the horizontal edges have
 * a visible effect on the grouped card width (vertical edges fold into the
 * section gap, which `sectionSpacing` already owns).
 */
export interface ListSectionMargins {
  /** Which edges the margin applies to (`Edge.Set`). Default `.all`. */
  edges?: EdgeSet;
  /** The inset length (px). `null`/omitted ⇒ the system default margin. */
  length?: number | null;
}

/** Does an `Edge.Set` include a leading/trailing (horizontal) edge? */
function edgeSetHasHorizontal(edges: EdgeSet): boolean {
  if (edges === true || edges === "all" || edges === "horizontal") return true;
  if (edges === "vertical") return false;
  const has = (e: Edge) => e === "leading" || e === "trailing";
  if (Array.isArray(edges)) return edges.some(has);
  return has(edges as Edge);
}

/** `listSectionSeparator(_:edges:)` / `listRowSeparator(_:)` visibility. */
export type SeparatorVisibility = "automatic" | "visible" | "hidden";

/** `AlternatingRowBackgroundBehavior` — `.enabled` paints odd/even rows differently. */
export type AlternatingRowBackgroundBehavior = "enabled" | "disabled";

/** `Prominence` (`headerProminence(_:)`). `.increased` → larger, non-uppercased header. */
export type Prominence = "standard" | "increased";

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
  /** listSectionSeparator(_:edges:) — show/hide the separator above/below each section. */
  sectionSeparator?: SeparatorVisibility;
  /** listSectionSeparatorTint(_:edges:) — color of the inter-section separators. */
  sectionSeparatorTint?: string;
  /** listRowSeparatorTint(_:edges:) set list-wide — overridden per-row by `ListRow.separatorTint`. */
  rowSeparatorTint?: string;
  /**
   * listItemTint(_:) — accent tint applied to interactive row content (toggles,
   * chevrons). Accepts a plain CSS color (the `listItemTint(Color?)` overload,
   * mapped to `.fixed`) or a rich `ListItemTint` (`.fixed`/`.preferred`/
   * `.monochrome`).
   */
  itemTint?: ListItemTint | string;
  /**
   * listSectionMargins(_:_:) — extra inset on each section's card. Pass a number
   * for an all-edges length, or `{ edges, length }` for the SwiftUI two-arg form.
   */
  sectionMargins?: number | ListSectionMargins;
  /**
   * listSectionIndexVisibility(_:) — the trailing A–Z fast-scroll index bar
   * (iOS Contacts). `.visible` shows it, `.hidden` removes it, `.automatic`
   * (default) defers to the platform (hidden on web until opted in).
   */
  sectionIndexVisibility?: Visibility;
  /**
   * listRowHoverEffect(_:) — the pointer-hover treatment for interactive rows
   * (`HoverEffect`). A row's own `hoverEffect` overrides this.
   */
  rowHoverEffect?: ListRowHoverEffect;
  /** listRowHoverEffectDisabled(_:) — suppress the row hover treatment list-wide. */
  rowHoverEffectDisabled?: boolean;
  /** alternatingRowBackgrounds(_:) — zebra-stripe rows (macOS/`.plain` tables). */
  alternatingRowBackgrounds?: boolean | AlternatingRowBackgroundBehavior;
  /** headerProminence(_:) — `.increased` enlarges section headers (no uppercasing). */
  headerProminence?: Prominence;
  /** selectionDisabled(_:) — disable selection for the whole list (rows opt out individually too). */
  selectionDisabled?: boolean;
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
    sectionSeparator,
    sectionSeparatorTint,
    rowSeparatorTint,
    itemTint,
    sectionMargins,
    sectionIndexVisibility,
    rowHoverEffect,
    rowHoverEffectDisabled = false,
    alternatingRowBackgrounds = false,
    headerProminence = "standard",
    selectionDisabled = false,
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

  const resolvedItemTint = resolveItemTint(itemTint);

  // listSectionMargins(_:_:) → a horizontal card inset (px). Only horizontal
  // edges change the grouped-card width; the all/horizontal/leading/trailing
  // edge sets resolve to the leading+trailing inset variable.
  const sectionMarginsCfg: ListSectionMargins | undefined =
    sectionMargins == null
      ? undefined
      : typeof sectionMargins === "number"
        ? { edges: "all", length: sectionMargins }
        : sectionMargins;
  const sectionMarginEdges: EdgeSet = sectionMarginsCfg?.edges ?? "all";
  const sectionMarginHorizontal = edgeSetHasHorizontal(sectionMarginEdges);
  const sectionMarginPx =
    sectionMarginsCfg != null && sectionMarginsCfg.length != null && sectionMarginHorizontal
      ? sectionMarginsCfg.length
      : undefined;

  const alternating =
    alternatingRowBackgrounds === true || alternatingRowBackgrounds === "enabled";

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
    () => ({
      style,
      editMode,
      isForm: asForm,
      selection: selectionDisabled ? undefined : listSelection,
      headerProminence,
      selectionDisabled,
      sectionSeparator,
      rowHoverEffect,
      rowHoverEffectDisabled,
    }),
    [
      style,
      editMode,
      asForm,
      listSelection,
      selectionDisabled,
      headerProminence,
      sectionSeparator,
      rowHoverEffect,
      rowHoverEffectDisabled,
    ],
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
      ...(sectionSeparatorTint != null
        ? { ["--sui-list-section-separator-tint" as string]: sectionSeparatorTint }
        : null),
      ...(rowSeparatorTint != null
        ? { ["--sui-row-separator-tint" as string]: rowSeparatorTint }
        : null),
      ...(resolvedItemTint != null
        ? { ["--sui-list-item-tint" as string]: resolvedItemTint }
        : null),
      ...(sectionMarginPx != null
        ? { ["--sui-list-side-inset" as string]: `${sectionMarginPx}px` }
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
        data-alternating={alternating ? "true" : undefined}
        data-header-prominence={headerProminence !== "standard" ? headerProminence : undefined}
        data-section-separator={
          sectionSeparator && sectionSeparator !== "automatic" ? sectionSeparator : undefined
        }
        data-section-index={
          sectionIndexVisibility && sectionIndexVisibility !== "automatic"
            ? sectionIndexVisibility
            : undefined
        }
        data-row-hover={
          rowHoverEffectDisabled ? "disabled" : rowHoverEffect && rowHoverEffect !== "automatic" ? rowHoverEffect : undefined
        }
        data-selection-disabled={selectionDisabled ? "true" : undefined}
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
