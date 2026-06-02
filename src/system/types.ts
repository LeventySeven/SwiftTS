/**
 * Shared SwiftUI vocabulary — the common type language every component speaks.
 * Mirrors SwiftUI enums so the React props read 1:1 with the Swift API.
 */

// --- Layout ---------------------------------------------------------------
export type Edge = "top" | "leading" | "bottom" | "trailing";
/** SwiftUI Edge.Set — `true`/"all" = every edge; an array selects edges. */
export type EdgeSet = "all" | "horizontal" | "vertical" | Edge | Edge[] | true;

export type HorizontalAlignment = "leading" | "center" | "trailing";
export type VerticalAlignment =
  | "top"
  | "center"
  | "bottom"
  | "firstTextBaseline"
  | "lastTextBaseline";
export type Alignment =
  | "topLeading" | "top" | "topTrailing"
  | "leading" | "center" | "trailing"
  | "bottomLeading" | "bottom" | "bottomTrailing";

export type Axis = "horizontal" | "vertical";

/** SwiftUI ContentMode for .aspectRatio / resizable images. */
export type ContentMode = "fit" | "fill";

// --- Controls -------------------------------------------------------------
export type ControlSize = "mini" | "small" | "regular" | "large" | "extraLarge";
export type ColorScheme = "light" | "dark";
export type ColorSchemePreference = ColorScheme | "system";
export type LayoutDirection = "leftToRight" | "rightToLeft";

/** Button semantic roles → drive default coloring. */
export type Role = "destructive" | "cancel" | undefined;

// --- Typography (matches src/tokens) -------------------------------------
export type FontTextStyle =
  | "largeTitle" | "title" | "title2" | "title3"
  | "headline" | "subheadline" | "body" | "callout"
  | "footnote" | "caption" | "caption2";
export type FontWeight =
  | "ultraLight" | "thin" | "light" | "regular"
  | "medium" | "semibold" | "bold" | "heavy" | "black";
export type FontDesign = "default" | "serif" | "rounded" | "monospaced";

// --- Color tokens (semantic + system palette) -----------------------------
export type SemanticColor =
  | "primary" | "secondary" | "tertiary" | "quaternary"
  | "label" | "secondaryLabel" | "tertiaryLabel" | "quaternaryLabel"
  | "separator" | "opaqueSeparator" | "link" | "placeholderText"
  | "systemBackground" | "secondarySystemBackground" | "tertiarySystemBackground"
  | "systemGroupedBackground" | "secondarySystemGroupedBackground" | "tertiarySystemGroupedBackground"
  | "fill" | "secondaryFill" | "tertiaryFill" | "quaternaryFill"
  | "tint" | "accentColor";
export type SystemColor =
  | "red" | "orange" | "yellow" | "green" | "mint" | "teal" | "cyan"
  | "blue" | "indigo" | "purple" | "pink" | "brown"
  | "gray" | "gray2" | "gray3" | "gray4" | "gray5" | "gray6"
  | "white" | "black" | "clear";
export type ColorToken = SemanticColor | SystemColor | (string & {});

/** Material levels (frosted glass). */
export type Material =
  | "ultraThin" | "thin" | "regular" | "thick" | "bar";
