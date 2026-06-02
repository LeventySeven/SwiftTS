/**
 * `<Text>` — SwiftUI's most-used primitive (C1 §1).
 *
 * Spec: teardowns/SWIFTUI_C1_content-primitives.md §1.
 *
 * In SwiftUI, `Text` is a `@frozen struct` value carrying `storage` + an ordered
 * `[Modifier]` array; styling calls (`.font`, `.bold`, `.foregroundStyle`, …)
 * append a `Modifier` case and the renderer folds them into glyph attributes.
 * The web replica is therefore a **leaf inline element** (`<span>`) that folds
 * the equivalent props into inline CSS — last-wins matches the Swift array order.
 *
 *   - `init(verbatim:)`  → `verbatim` prop (no markdown).
 *   - `Text(_:)` literal  → markdown-parsed by default in SwiftUI; we expose that
 *     via the `markdown` prop (inline-only grammar, matching SwiftUI — no block md).
 *   - Concatenation (`Text("a").bold() + Text("b")`) → nest `<Text>` inside
 *     `<Text>`; each run keeps its own inline style and they flow on one line
 *     because every `<Text>` is `display:inline`.
 *
 * Purely presentational — no hooks, no event state — so this file stays
 * server-compatible (no "use client").
 */
import * as React from "react";
import { mergeStyles, type ViewProps } from "../View";
import {
  applyModifiers,
  resolveColor,
  resolveTextStyle,
  type ViewModifierProps,
} from "../../system/modifiers";
import type {
  ColorToken,
  FontDesign,
  FontTextStyle,
  FontWeight,
} from "../../system/types";
import styles from "./Text.module.css";

export type TextTruncationMode = "head" | "tail" | "middle";
export type TextLinePattern = "solid" | "dot" | "dash" | "dashDot" | "dashDotDot";

/** `{ size, weight?, design? }` → a SwiftUI system font (`.system(size:weight:design:)`). */
export interface FontSpec {
  size: number;
  weight?: FontWeight;
  design?: FontDesign;
}

export interface TextProps
  extends Omit<
    ViewProps,
    | "as"
    | "children"
    | "font"
    | "fontWeight"
    | "fontDesign"
    | "bold"
    | "italic"
    | "underline"
    | "strikethrough"
    | "kerning"
    | "tracking"
    | "baselineOffset"
    | "lineLimit"
    | "multilineTextAlignment"
    | "truncationMode"
    | "monospaced"
    | "monospacedDigit"
    | "foregroundStyle"
    | "foregroundColor"
  > {
  /** Verbatim / StringProtocol content, or nested `<Text>` runs (concatenation). */
  children?: React.ReactNode;
  /** `init(verbatim:)` — render the string as-is, skipping markdown. */
  verbatim?: string;
  /** Inline-Markdown source (`**b** *i* `code` ~~s~~ [t](url)`). SwiftUI literal path. */
  markdown?: string;

  /** `.font(_:)` — a `Font.TextStyle` token or a `{size,weight,design}` system font. */
  font?: FontTextStyle | FontSpec;
  /** `.fontWeight(_:)`. */
  fontWeight?: FontWeight;
  /** `.fontDesign(_:)`. */
  design?: FontDesign;
  /** `.foregroundStyle(_:)` (iOS17+) — preferred. */
  foregroundStyle?: ColorToken | string;
  /** `.foregroundColor(_:)` (deprecated alias). */
  foregroundColor?: ColorToken | string;

  /** `.bold()` / `.bold(false)`. */
  bold?: boolean;
  /** `.italic()` / `.italic(false)`. */
  italic?: boolean;
  /** `.underline(_:color:pattern:)`. */
  underline?: boolean | { color?: ColorToken | string; pattern?: TextLinePattern };
  /** `.strikethrough(_:color:pattern:)`. */
  strikethrough?:
    | boolean
    | { color?: ColorToken | string; pattern?: TextLinePattern };

  /** `.kerning(_:)` — between-glyph spacing (does not add a trailing edge). */
  kerning?: number;
  /** `.tracking(_:)` — uniform spacing incl. after the last glyph. */
  tracking?: number;
  /** `.baselineOffset(_:)` — positive moves up. */
  baselineOffset?: number;
  /** `.monospaced()` / `.fontDesign(.monospaced)`. */
  monospaced?: boolean;
  /** `.monospacedDigit()` — tabular figures. */
  monospacedDigit?: boolean;

  /** `.lineLimit(_:)`. */
  lineLimit?: number;
  /** `.truncationMode(_:)` (default `.tail`). */
  truncationMode?: TextTruncationMode;
  /** `.multilineTextAlignment(_:)`. */
  multilineTextAlignment?: "leading" | "center" | "trailing";
}

/** Map of `Font.TextStyle` → the CSS-module class that swaps its 4-var bundle. */
const TEXT_STYLE_CLASS: Record<FontTextStyle, string> = {
  largeTitle: styles.largeTitle,
  title: styles.title,
  title2: styles.title2,
  title3: styles.title3,
  headline: styles.headline,
  subheadline: styles.subheadline,
  body: styles.body,
  callout: styles.callout,
  footnote: styles.footnote,
  caption: styles.caption,
  caption2: styles.caption2,
};

const LINE_PATTERN_TO_CSS: Record<TextLinePattern, string> = {
  solid: "solid",
  dot: "dotted",
  dash: "dashed",
  dashDot: "dashed",
  dashDotDot: "dashed",
};

/* ──────────────────────────────────────────────────────────────────────────
 * Inline-markdown tokenizer (DESIGNED, §1.7).
 *
 * SwiftUI's literal `Text` parses INLINE markdown only — `**bold**`, `*italic*`,
 * `` `code` ``, `~~strike~~`, `[label](url)`. No block markdown (no headings,
 * lists, blockquotes). We deliberately ship a tiny recursive tokenizer rather
 * than a full markdown library to keep parity exact.
 * ──────────────────────────────────────────────────────────────────────────*/

interface MdRule {
  re: RegExp;
  wrap: (inner: React.ReactNode, m: RegExpExecArray, key: string) => React.ReactNode;
}

const MD_RULES: MdRule[] = [
  // bold (**…** or __…__) — must precede italic so `**` isn't eaten as two `*`.
  {
    re: /\*\*([^]+?)\*\*|__([^]+?)__/,
    wrap: (inner, _m, key) => (
      <strong key={key} style={{ fontWeight: 700 }}>
        {inner}
      </strong>
    ),
  },
  // italic (*…* or _…_)
  {
    re: /\*([^]+?)\*|_([^]+?)_/,
    wrap: (inner, _m, key) => (
      <em key={key} style={{ fontStyle: "italic" }}>
        {inner}
      </em>
    ),
  },
  // strikethrough (~~…~~)
  {
    re: /~~([^]+?)~~/,
    wrap: (inner, _m, key) => (
      <span key={key} style={{ textDecorationLine: "line-through" }}>
        {inner}
      </span>
    ),
  },
  // inline code (`…`)
  {
    re: /`([^`]+?)`/,
    wrap: (inner, _m, key) => (
      <code
        key={key}
        style={{ fontFamily: "var(--sui-font-monospaced)" }}
      >
        {inner}
      </code>
    ),
  },
  // link ([label](url))
  {
    re: /\[([^\]]+?)\]\(([^)]+?)\)/,
    wrap: (inner, m, key) => (
      <a
        key={key}
        href={m[2]}
        style={{ color: "var(--sui-color-link)", textDecoration: "none" }}
      >
        {inner}
      </a>
    ),
  },
];

/** Recursively tokenize one inline-md string into React nodes. */
function parseInlineMarkdown(input: string, keyPrefix = "md"): React.ReactNode {
  // Find the earliest match across all rules; recurse into its inner content
  // and onto the remaining tail. No match → return the raw string.
  let earliest: { rule: MdRule; m: RegExpExecArray } | null = null;
  for (const rule of MD_RULES) {
    const m = rule.re.exec(input);
    if (m && (earliest === null || m.index < earliest.m.index)) {
      earliest = { rule, m };
    }
  }
  if (!earliest) return input;

  const { rule, m } = earliest;
  const before = input.slice(0, m.index);
  const after = input.slice(m.index + m[0].length);
  // capture group is whichever alt matched (rules use up to two alternations)
  const captured = m[1] ?? m[2] ?? "";
  const innerNodes =
    rule.re.source.includes("\\]\\(")
      ? captured // link label: leave as literal text (no nested md in label for parity)
      : parseInlineMarkdown(captured, `${keyPrefix}-i`);

  const nodes: React.ReactNode[] = [];
  if (before) nodes.push(before);
  nodes.push(rule.wrap(innerNodes, m, `${keyPrefix}-${m.index}`));
  const tail = after ? parseInlineMarkdown(after, `${keyPrefix}-t`) : null;
  if (tail) nodes.push(tail);
  return nodes;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────────*/

export const Text = React.forwardRef<HTMLElement, TextProps>(function Text(
  {
    children,
    verbatim,
    markdown,
    font,
    fontWeight,
    design,
    foregroundStyle,
    foregroundColor,
    bold,
    italic,
    underline,
    strikethrough,
    kerning,
    tracking,
    baselineOffset,
    monospaced,
    monospacedDigit,
    lineLimit,
    truncationMode,
    multilineTextAlignment,
    className,
    style: styleProp,
    ...rest
  },
  ref,
) {
  // Resolve the typography class: a Font.TextStyle token gets a CSS-module class,
  // a system-font {size,…} folds straight to inline style.
  let textStyleClass: string | undefined;
  const inline: React.CSSProperties = {};

  if (typeof font === "string") {
    textStyleClass = TEXT_STYLE_CLASS[font];
  } else if (font) {
    inline.fontSize = `${font.size}px`;
    if (font.weight) {
      inline.fontWeight = `var(--sui-weight-${font.weight})` as unknown as React.CSSProperties["fontWeight"];
    }
    if (font.design) inline.fontFamily = `var(--sui-font-${font.design})`;
  }

  // weight / design / color
  if (fontWeight) {
    inline.fontWeight = `var(--sui-weight-${fontWeight})` as unknown as React.CSSProperties["fontWeight"];
  }
  if (design) inline.fontFamily = `var(--sui-font-${design})`;
  const color = foregroundStyle ?? foregroundColor;
  if (color != null) inline.color = resolveColor(color);

  // bold/italic — applied AFTER fontWeight so bold wins (matches SwiftUI overload order)
  if (bold === true) inline.fontWeight = 700;
  else if (bold === false) inline.fontWeight = 400;
  if (italic === true) inline.fontStyle = "italic";
  else if (italic === false) inline.fontStyle = "normal";

  // underline + strikethrough → combined text-decoration-line list
  const lines: string[] = [];
  const u = underline === true || (typeof underline === "object" && underline != null);
  const st =
    strikethrough === true ||
    (typeof strikethrough === "object" && strikethrough != null);
  if (u) lines.push("underline");
  if (st) lines.push("line-through");
  if (lines.length) {
    inline.textDecorationLine = lines.join(" ");
    const styled =
      typeof underline === "object" && underline != null
        ? underline
        : typeof strikethrough === "object" && strikethrough != null
          ? strikethrough
          : undefined;
    if (styled?.pattern) {
      inline.textDecorationStyle = LINE_PATTERN_TO_CSS[
        styled.pattern
      ] as React.CSSProperties["textDecorationStyle"];
    }
    if (styled?.color != null) inline.textDecorationColor = resolveColor(styled.color);
  }

  // spacing / baseline
  if (kerning != null) inline.letterSpacing = `${kerning}px`;
  if (tracking != null) inline.letterSpacing = `${tracking}px`; // tracking overrides token default
  if (baselineOffset != null) inline.verticalAlign = `${baselineOffset}px`;
  if (monospaced) inline.fontFamily = "var(--sui-font-monospaced)";
  if (monospacedDigit) {
    inline.fontVariantNumeric = "tabular-nums";
    inline.fontFeatureSettings = '"tnum"';
  }

  // lineLimit / truncation
  if (lineLimit != null) {
    if (lineLimit === 1) {
      inline.whiteSpace = "nowrap";
      inline.overflow = "hidden";
      inline.textOverflow = "ellipsis";
      inline.display = "inline-block";
      inline.maxWidth = "100%";
    } else {
      inline.display = "-webkit-box";
      (inline as Record<string, unknown>)["WebkitLineClamp"] = String(lineLimit);
      (inline as Record<string, unknown>)["WebkitBoxOrient"] = "vertical";
      inline.overflow = "hidden";
    }
  }
  if (truncationMode === "tail") inline.textOverflow = "ellipsis";
  if (multilineTextAlignment) {
    inline.textAlign = { leading: "start", center: "center", trailing: "end" }[
      multilineTextAlignment
    ] as React.CSSProperties["textAlign"];
  }

  // Run any remaining styling modifier props (foreground/background/frame/etc.)
  // through the shared compiler so <Text> still honors the full ViewModifier bag.
  const { style: modStyle, className: modClassName, rest: domRest } = applyModifiers(
    rest as ViewModifierProps & Record<string, unknown>,
  );

  // Resolve the rendered content: markdown > verbatim > children.
  let content: React.ReactNode;
  if (markdown != null) content = parseInlineMarkdown(markdown);
  else if (verbatim != null) content = verbatim;
  else content = children;

  const mergedClassName =
    [styles.text, textStyleClass, modClassName, className]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      className={mergedClassName}
      style={mergeStyles(modStyle, inline, styleProp)}
      {...domRest}
    >
      {content}
    </span>
  );
});

Text.displayName = "Text";
