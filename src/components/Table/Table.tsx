"use client";
/**
 * `Table` / `TableColumn` / `TableRow` — SwiftUI Cluster C6 §9.
 *
 *   Table(rows, selection: $sel, sortOrder: $sort) {
 *     TableColumn("Name", value: \.name)
 *     TableColumn("Size") { r in Text(fmt(r.size)) }
 *   }
 *   .tableStyle(.inset | .bordered) / .tableColumnHeaders(.hidden)
 *
 * A multi-column data grid: a sortable header row + a body of rows. Clicking a
 * header toggles that column's comparator in `sortOrder` (asc→desc) and re-sorts
 * the data. `.inset` gives zebra rows; `.bordered` draws grid lines; selection
 * highlights the full row with the tint (accent) color.
 *
 * Columns are declared with `<TableColumn>` children (which render nothing — the
 * Table reads their props), exactly like SwiftUI's column builder.
 */
import * as React from "react";
import {
  useResolvedStyle,
  type TableStyleName,
} from "../../system/styles";
import "./Table.module.css";

export type SortDirection = "asc" | "desc";

export interface TableSort {
  /** The column key currently sorted by. */
  key: string;
  direction: SortDirection;
}

export interface TableColumnWidth {
  min?: number;
  ideal?: number;
  max?: number;
}

export interface TableColumnProps<T = unknown> {
  /** Stable column key — also the sort key when `value` is a key of T. */
  id?: string;
  /** Column header title. */
  title: React.ReactNode;
  /** A key of T → renders `String(row[value])` and makes the column sortable. */
  value?: keyof T & string;
  /** Provide a custom comparator (for non-string columns). */
  sortUsing?: (a: T, b: T) => number;
  /** Per-column width control → CSS min/width/max. */
  width?: number | TableColumnWidth;
  /** Custom cell renderer (overrides `value`). */
  children?: (row: T) => React.ReactNode;
}

/** Declarative column — renders nothing; the Table reads its props. */
export function TableColumn<T>(_props: TableColumnProps<T>): null {
  return null;
}
TableColumn.displayName = "TableColumn";

export interface TableRowProps<T = unknown> {
  value: T;
}
/** Declarative single-row wrapper (rarely needed — pass `data` to Table instead). */
export function TableRow<T>(_props: TableRowProps<T>): null {
  return null;
}
TableRow.displayName = "TableRow";

export type TableSelectionBinding =
  | [ReadonlySet<string | number>, (next: Set<string | number>) => void]
  | [string | number | null, (next: string | number | null) => void];

export interface TableProps<T> {
  /** The row data. */
  data: readonly T[];
  /** id extractor (defaults to `row.id`). */
  rowId?: (row: T) => string | number;
  /** `<TableColumn>` declarations. */
  children: React.ReactNode;
  /** Table(selection:) — single (id|null) or multi (Set). */
  selection?: TableSelectionBinding;
  /** Table(sortOrder:) — `[sort, setSort]`. */
  sortOrder?: [TableSort | null, (next: TableSort | null) => void];
  /** tableStyle(_:). */
  tableStyle?: TableStyleName;
  /** tableColumnHeaders(_:). Default `true`. */
  showColumnHeaders?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function defaultCompare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function Table<T>({
  data,
  rowId,
  children,
  selection,
  sortOrder,
  tableStyle,
  showColumnHeaders = true,
  className,
  style,
}: TableProps<T>): React.ReactElement {
  const resolvedStyle = useResolvedStyle("table", tableStyle);

  // Collect column declarations from children.
  const columns = React.useMemo(() => {
    const out: Array<TableColumnProps<T> & { key: string }> = [];
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const props = child.props as TableColumnProps<T>;
      const key = props.id ?? (props.value as string) ?? String(out.length);
      out.push({ ...props, key });
    });
    return out;
  }, [children]);

  const getId = React.useCallback(
    (row: T): string | number =>
      rowId
        ? rowId(row)
        : ((row as Record<string, unknown>).id as string | number),
    [rowId],
  );

  // ---- sorting ----
  const sort = sortOrder?.[0] ?? null;
  const setSort = sortOrder?.[1];
  const sortedData = React.useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data;
    const cmp =
      col.sortUsing ??
      ((a: T, b: T) =>
        col.value
          ? defaultCompare(
              (a as Record<string, unknown>)[col.value],
              (b as Record<string, unknown>)[col.value],
            )
          : 0);
    const arr = [...data].sort(cmp);
    if (sort.direction === "desc") arr.reverse();
    return arr;
  }, [data, sort, columns]);

  const onHeaderClick = (col: (typeof columns)[number]) => {
    if (!setSort) return;
    const sortable = !!col.value || !!col.sortUsing;
    if (!sortable) return;
    const dir: SortDirection =
      sort?.key === col.key && sort.direction === "asc" ? "desc" : "asc";
    setSort({ key: col.key, direction: dir });
  };

  // ---- selection ----
  const selSet: ReadonlySet<string | number> = React.useMemo(() => {
    if (!selection) return new Set();
    const first = selection[0];
    if (first instanceof Set) return first;
    return new Set(first != null ? [first as string | number] : []);
  }, [selection]);
  const toggleSel = (id: string | number) => {
    if (!selection) return;
    const [first, setter] = selection;
    if (first instanceof Set) {
      const next = new Set(first);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      (setter as (n: Set<string | number>) => void)(next);
    } else {
      (setter as (n: string | number | null) => void)(
        (first as string | number | null) === id ? null : id,
      );
    }
  };
  const selectable = !!selection;

  const colWidth = (w: TableColumnProps<T>["width"]): React.CSSProperties => {
    if (w == null) return {};
    if (typeof w === "number") return { width: w };
    return { minWidth: w.min, width: w.ideal, maxWidth: w.max };
  };

  return (
    <table
      className={["sui-table", className].filter(Boolean).join(" ")}
      data-style={resolvedStyle}
      data-headers={showColumnHeaders ? undefined : "hidden"}
      style={style}
    >
      <thead>
        <tr>
          {columns.map((col) => {
            const active = sort?.key === col.key;
            const sortable = !!col.value || !!col.sortUsing;
            return (
              <th
                key={col.key}
                aria-sort={
                  active
                    ? sort!.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
                style={colWidth(col.width)}
              >
                {sortable ? (
                  <button
                    type="button"
                    className="sui-table__sort"
                    onClick={() => onHeaderClick(col)}
                  >
                    {col.title}
                    <span
                      className="sui-table__caret"
                      data-dir={active ? sort!.direction : undefined}
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  col.title
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row) => {
          const id = getId(row);
          const selected = selSet.has(id);
          return (
            <tr
              key={id}
              className="sui-table__row"
              data-selected={selected ? "true" : undefined}
              data-tappable={selectable ? "true" : undefined}
              onClick={selectable ? () => toggleSel(id) : undefined}
            >
              {columns.map((col) => (
                <td key={col.key}>
                  {col.children
                    ? col.children(row)
                    : col.value
                      ? String((row as Record<string, unknown>)[col.value])
                      : null}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

Table.displayName = "Table";
