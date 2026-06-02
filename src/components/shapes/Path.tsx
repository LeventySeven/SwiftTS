"use client";
/**
 * `Path` — a `Shape` whose `path(in:)` returns a fixed `d` string.
 *
 * RE'd from `teardowns/SWIFTUI_C9_shapes-drawing.md` §2.
 *
 *   Path { p in p.move(to:…); p.addLine(to:…) }   // SUICore:10010
 *   Path(_ string:)                                // SUICore:10011 — parse a `d`-ish string
 *
 * `Path.path(in:)` returns self (`SUICore:10050`) — i.e. it ignores the offered
 * rect and draws the fixed geometry. Web: accept either a `PathBuilder`, a
 * builder closure, or a raw SVG `d` string, then render through `<Shape>`.
 *
 * Re-exports `PathBuilder` so callers can `new PathBuilder()...build()` (§2.4).
 */
import * as React from "react";
import { Shape, type ShapeStyleProps } from "./Shape";
import { PathBuilder } from "./geometry";

export { PathBuilder } from "./geometry";

export interface PathProps extends ShapeStyleProps {
  /** A raw SVG `d` string, a built `PathBuilder`, or a builder closure. */
  d?: string;
  path?: PathBuilder;
  builder?: (p: PathBuilder) => void;
}

export function Path({ d, path, builder, ...rest }: PathProps) {
  const dStr = React.useMemo(() => {
    if (d != null) return d;
    if (path) return path.build();
    if (builder) {
      const b = new PathBuilder();
      builder(b);
      return b.build();
    }
    return "";
  }, [d, path, builder]);
  // path(in:) returns self → ignore the rect.
  return <Shape pathIn={() => dStr} {...rest} />;
}

Path.displayName = "Path";
