/**
 * `Color` (as a View) — `SwiftUICore.Color` (SwiftUICore :13474).
 *
 *   @frozen public struct Color : Hashable, CustomStringConvertible, Sendable {
 *     public static let red / orange / yellow / green / mint / teal / cyan /
 *                       blue / indigo / purple / pink / brown /
 *                       gray / white / black / clear / primary / secondary
 *     public init(_ name: String, bundle: Bundle? = nil)   // asset color
 *     public init(red: Double, green: Double, blue: Double, opacity: Double = 1)
 *   }
 *
 * In SwiftUI `Color` conforms to both `ShapeStyle` *and* `View`. As a View it is
 * GREEDY: `Color.red` placed in a layout expands to fill ALL the space offered to
 * it (it proposes the whole proposed size), exactly like a `Rectangle().fill`.
 * That is the behaviour replicated here.
 *
 * Web mapping: a `<View>` whose `background-color` is `resolveColor(value)`, sized
 * to fill its container by default (`width:100%; height:100%`). Because a greedy
 * fill needs a bounded parent to be visible, this is the same rule as
 * `Spacer`/`frame(maxWidth:.infinity)` — give it a sized ancestor.
 *
 * `Color.<name>` *value* statics are also exported as a plain object so callers
 * can pass `Color.red` where a `ColorToken` is expected (e.g. `.foregroundStyle`).
 * Those resolve to the same `--sui-color-*` vars `resolveColor` uses.
 *
 * Purely presentational; no client directive.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import { resolveColor } from "../../system/modifiers";
import type { ColorToken } from "../../system/types";

export interface ColorProps extends Omit<ViewProps, "color"> {
  /** A `ColorToken` (`"red"`, `"secondaryLabel"`, …) or any raw CSS color. */
  value: ColorToken | string;
  /** Opacity 0–1 applied to the fill (mirrors `Color.opacity(_:)`). Default 1. */
  opacity?: number;
  /**
   * Disable the greedy fill so the Color hugs nothing and instead sizes to the
   * `frame`/explicit style you give it. Default `false` (greedy, like SwiftUI).
   */
  greedy?: boolean;
}

export const Color = React.forwardRef<HTMLElement, ColorProps>(function Color(
  { value, opacity, greedy = true, style, ...rest },
  ref,
) {
  const fillStyle: React.CSSProperties = {
    backgroundColor: resolveColor(value),
    ...(opacity != null ? { opacity } : null),
    ...(greedy ? { width: "100%", height: "100%" } : null),
  };
  return (
    <View ref={ref} style={mergeStyles(fillStyle, style)} {...rest} />
  );
});

Color.displayName = "Color";

/**
 * The `Color.<name>` statics as a values object — each entry is a `ColorToken`
 * string that `resolveColor` maps to its `--sui-color-*` var. Use where a token
 * is expected: `<Text foregroundStyle={ColorStatics.red} />`.
 *
 * Exported separately (not on the component function) so the component type stays
 * a clean `forwardRef`; re-exported as `ColorValue` for the SwiftUI-shaped name.
 */
export const ColorStatics = {
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  mint: "mint",
  teal: "teal",
  cyan: "cyan",
  blue: "blue",
  indigo: "indigo",
  purple: "purple",
  pink: "pink",
  brown: "brown",
  gray: "gray",
  white: "white",
  black: "black",
  clear: "clear",
  primary: "primary",
  secondary: "secondary",
  accentColor: "accentColor",
} as const satisfies Record<string, ColorToken>;

export type ColorStaticName = keyof typeof ColorStatics;
