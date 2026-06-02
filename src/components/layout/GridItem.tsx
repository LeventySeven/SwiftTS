/**
 * `GridItem` — column/row template descriptor for the lazy grids.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §7.
 *
 *   enum GridItem.Size {
 *     case fixed(CGFloat)
 *     case flexible(minimum: CGFloat = 10, maximum: CGFloat = .infinity)
 *     case adaptive(minimum: CGFloat, maximum: CGFloat = .infinity)
 *   }
 *   GridItem(_ size = .flexible(), spacing: CGFloat? = nil, alignment: Alignment? = nil)
 *
 * GridItem exists only to build the `grid-template-columns`/`grid-template-rows`
 * track string for `LazyVGrid`/`LazyHGrid` (§8). The mapping (KNOWN constants):
 *   .fixed(w)              → `{w}px`
 *   .flexible(min, max)    → `minmax({min}px, {max==∞ ? 1fr : max}px)`  (default min = 10)
 *   .adaptive(min, max)    → `repeat(auto-fill, minmax({min}px, {max==∞?'1fr':max}px))`
 *
 * No DOM — this is a pure descriptor module. No client directive.
 */
import type { Alignment } from "../../system/types";

export type GridItemSize =
  | { kind: "fixed"; value: number }
  | { kind: "flexible"; minimum?: number; maximum?: number } // defaults 10 / Infinity
  | { kind: "adaptive"; minimum: number; maximum?: number };

export interface GridItemSpec {
  size: GridItemSize;
  /** Gap after this track (column-to-column / row-to-row). `nil` ⇒ ~8. */
  spacing?: number | null;
  /** 2-D alignment of items within this track's cells. */
  alignment?: Alignment | null;
}

/** SwiftUI `.flexible` default minimum (KNOWN literal in `GridItem.Size`). */
export const GRID_FLEXIBLE_DEFAULT_MIN = 10;

const maxToken = (max: number | undefined): string =>
  max == null || max === Infinity ? "1fr" : `${max}px`;

/** GridItem.Size → one (or, for `.adaptive`, a repeat-pack) CSS track expression. */
export function gridItemToTrack(item: GridItemSpec): string {
  const { size } = item;
  switch (size.kind) {
    case "fixed":
      return `${size.value}px`;
    case "flexible":
      return `minmax(${size.minimum ?? GRID_FLEXIBLE_DEFAULT_MIN}px, ${maxToken(size.maximum)})`;
    case "adaptive":
      return `repeat(auto-fill, minmax(${size.minimum}px, ${maxToken(size.maximum)}))`;
  }
}

/** A `[GridItem]` array → the full `grid-template-columns`/`rows` string. */
export function gridItemsToTemplate(items: GridItemSpec[]): string {
  return items.map(gridItemToTrack).join(" ");
}

/**
 * Constructors mirroring SwiftUI's `GridItem.fixed/.flexible/.adaptive`.
 * Usage: `GridItem.flexible()`, `GridItem.adaptive(80)`, `GridItem.fixed(44)`.
 */
export const GridItem = {
  fixed: (value: number, spacing?: number | null, alignment?: Alignment | null): GridItemSpec => ({
    size: { kind: "fixed", value },
    spacing,
    alignment,
  }),
  flexible: (
    minimum: number = GRID_FLEXIBLE_DEFAULT_MIN,
    maximum: number = Infinity,
    spacing?: number | null,
    alignment?: Alignment | null,
  ): GridItemSpec => ({
    size: { kind: "flexible", minimum, maximum },
    spacing,
    alignment,
  }),
  adaptive: (
    minimum: number,
    maximum: number = Infinity,
    spacing?: number | null,
    alignment?: Alignment | null,
  ): GridItemSpec => ({
    size: { kind: "adaptive", minimum, maximum },
    spacing,
    alignment,
  }),
} as const;
