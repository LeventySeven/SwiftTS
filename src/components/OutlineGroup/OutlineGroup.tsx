"use client";
/**
 * `OutlineGroup` — SwiftUI Cluster C6 §8. The recursive engine behind
 * hierarchical `List`s (the Finder/Files tree).
 *
 *   OutlineGroup(data, children: \.children) { node in content(node) }
 *
 * Walks `children` (a key of T to an optional child array — `undefined`/`null` =
 * leaf, an array = expandable branch) and emits, per node, either a plain
 * indented leaf row or a `DisclosureGroup` whose content is the recursively-
 * generated subgroup. Each level indents by `indentPerLevel` (≈28pt).
 */
import * as React from "react";
import { DisclosureGroup } from "../DisclosureGroup/DisclosureGroup";

export interface OutlineGroupProps<T> {
  /** Root collection (or a single root element wrapped in an array). */
  data: readonly T[];
  /** Key of T pointing to the optional child collection. */
  children: keyof T;
  /** Per-node row content builder. */
  content: (node: T) => React.ReactNode;
  /** Stable id extractor (defaults to `node.id` then the index). */
  id?: (node: T) => React.Key;
  /** Indentation per depth level (px). Default 28. */
  indentPerLevel?: number;
  /** Current depth (internal — starts at 0). */
  level?: number;
}

function childrenOf<T>(node: T, key: keyof T): readonly T[] | null | undefined {
  return node[key] as unknown as readonly T[] | null | undefined;
}

export function OutlineGroup<T>({
  data,
  children,
  content,
  id,
  indentPerLevel = 28,
  level = 0,
}: OutlineGroupProps<T>): React.ReactElement {
  return (
    <>
      {data.map((node, index) => {
        const key =
          id?.(node) ??
          ((node as Record<string, unknown>).id as React.Key | undefined) ??
          index;
        const kids = childrenOf(node, children);
        const pad = level * indentPerLevel;

        if (kids == null) {
          // leaf — no chevron, just an indented row.
          return (
            <div
              key={key}
              className="sui-outline__leaf"
              style={{ paddingLeft: pad }}
            >
              {content(node)}
            </div>
          );
        }

        return (
          <DisclosureGroup
            key={key}
            label={<span style={{ paddingLeft: pad }}>{content(node)}</span>}
            indent={0}
          >
            <OutlineGroup
              data={kids}
              children={children}
              content={content}
              id={id}
              indentPerLevel={indentPerLevel}
              level={level + 1}
            />
          </DisclosureGroup>
        );
      })}
    </>
  );
}

OutlineGroup.displayName = "OutlineGroup";
