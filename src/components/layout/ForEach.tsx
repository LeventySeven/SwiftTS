/**
 * `ForEach` — SwiftUI's data-driven view generator.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` (the `_VariadicView`/children
 * model). SwiftUI:
 *
 *   ForEach(data, id: \.self) { item in … }
 *   ForEach(data) { item in … }            // when Element : Identifiable
 *
 * Maps over `data`, calling `children(item, index)` for each element and emitting
 * a stable React `key`. The key is derived from `id`:
 *   - `id` as a key-of-T string  → `item[id]`
 *   - `id` as a function         → `id(item)`
 *   - omitted                    → the array index (SwiftUI's `id: \.self` floor)
 *
 * Purely structural — renders no DOM of its own (returns a Fragment of the mapped
 * nodes). No client directive.
 */
import * as React from "react";

export type ForEachID<T> = keyof T | ((item: T) => React.Key);

export interface ForEachProps<T> {
  /** The collection to iterate. */
  data: readonly T[];
  /**
   * Identity for stable keys: a key of `T`, an id-extractor function, or omitted
   * (falls back to the array index — SwiftUI's `id: \.self` for value types).
   */
  id?: ForEachID<T>;
  /** The per-element view builder: `(item, index) => ReactNode`. */
  children: (item: T, index: number) => React.ReactNode;
}

function resolveKey<T>(item: T, index: number, id: ForEachID<T> | undefined): React.Key {
  if (id == null) return index;
  if (typeof id === "function") return id(item);
  const value = (item as Record<string, unknown>)[id as string];
  // numbers/strings are valid keys; everything else falls back to the index.
  if (typeof value === "string" || typeof value === "number") return value;
  return index;
}

export function ForEach<T>({ data, id, children }: ForEachProps<T>): React.ReactElement {
  return (
    <>
      {data.map((item, index) => (
        <React.Fragment key={resolveKey(item, index, id)}>
          {children(item, index)}
        </React.Fragment>
      ))}
    </>
  );
}

ForEach.displayName = "ForEach";
