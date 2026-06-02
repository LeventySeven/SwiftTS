"use client";
/**
 * Shared mark-modifier props + resolution (§9 — `ChartContent` extensions).
 *
 * Every mark accepts the chainable styling modifiers as props:
 * `foregroundStyle`, `foregroundStyleBy`, `opacity`, `lineStyle`,
 * `cornerRadius`, `offset`, `zIndex`, `annotation`, `accessibilityLabel`.
 * This module resolves those into concrete SVG attributes against the render
 * context so each mark file stays focused on its geometry.
 */
import { resolveColor } from "../../system/modifiers";
import { type ChartRender, styleIndex } from "./context";
import {
  type AnnotationSpec,
  type PlottableValue,
  type StrokeStyle,
  isPlottable,
  plottableKey,
} from "./types";

/** Modifiers every mark shares (chained methods → props). §9 */
export interface MarkModifierProps {
  /** `.foregroundStyle(_:)` — fixed color/gradient. */
  foregroundStyle?: string;
  /** `.foregroundStyle(by:)` — grammar color encoding → legend + palette. */
  foregroundStyleBy?: PlottableValue;
  /** `.opacity(_:)`. */
  opacity?: number;
  /** `.lineStyle(_:)`. */
  lineStyle?: StrokeStyle;
  /** `.cornerRadius(_:)`. */
  cornerRadius?: number;
  /** `.offset(x:y:)` — pixel translate of the rendered mark. */
  offset?: { x?: number; y?: number };
  /** `.zIndex(_:)` — SVG paint order (DOM reorder; informational here). */
  zIndex?: number;
  /** `.annotation(...)`. */
  annotation?: AnnotationSpec;
  /** mark accessibility (§17.6). */
  accessibilityLabel?: string;
  accessibilityHidden?: boolean;
  accessibilityIdentifier?: string;
}

/** Resolve the fill/stroke color for a mark given its style-by key. */
export function resolveMarkColor(
  render: ChartRender,
  props: MarkModifierProps,
  styleKey?: string,
): string {
  if (props.foregroundStyle != null) return resolveColor(props.foregroundStyle);
  if (styleKey != null && render.styleDomain.length) {
    return render.styleScale(styleKey, styleIndex(render, styleKey));
  }
  // no encoding → first palette slot
  return render.styleScale("__default__", 0);
}

/** The style-by category key for a mark (or undefined). */
export function styleKeyOf(props: MarkModifierProps): string | undefined {
  return props.foregroundStyleBy != null ? plottableKey(props.foregroundStyleBy.value) : undefined;
}

/** Dim-others emphasis opacity when a selection exists (§13). */
export function emphasisOpacity(
  render: ChartRender,
  selfKey: string | undefined,
  base = 1,
): number {
  if (render.selectedKey == null) return base;
  return selfMatches(render.selectedKey, selfKey) ? base : 0.3;
}

function selfMatches(selected: string, self?: string): boolean {
  return self == null ? true : self === selected;
}

/** SVG transform string for `.offset(x:y:)`. */
export function offsetTransform(props: MarkModifierProps): string | undefined {
  if (!props.offset) return undefined;
  return `translate(${props.offset.x ?? 0}, ${props.offset.y ?? 0})`;
}

/** StrokeStyle → SVG stroke attributes. */
export interface StrokeAttrs {
  strokeWidth?: number;
  strokeDasharray?: string;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
}
export function strokeAttrs(s: StrokeStyle | undefined, defaultWidth: number): StrokeAttrs {
  return {
    strokeWidth: s?.lineWidth ?? defaultWidth,
    strokeDasharray: s?.dash && s.dash.length ? s.dash.join(",") : undefined,
    strokeLinecap: s?.lineCap ?? "round",
    strokeLinejoin: s?.lineJoin ?? "round",
  };
}

/** Plottable-or-number → numeric plot coordinate via a scale; number passes through. */
export function coord(
  scale: ChartRender["xScale"],
  value: PlottableValue | number | undefined,
  fallback: number,
): number {
  if (value == null) return fallback;
  if (typeof value === "number") return value;
  if (isPlottable(value)) return scale.scale(value.value);
  return fallback;
}
