/**
 * `Group` — SwiftUI's transparent grouping.
 *
 * RE'd from `teardowns/SWIFTUI_C5_layout-stacks.md` §11.
 *
 *   Group { A; B; C }
 *
 * Group is PURELY structural: it introduces no layout container. `Group { … }`
 * does not wrap children in a box — its children are laid out by whatever parent
 * contains the Group. Its web equivalent is a React Fragment (`<>…</>`): zero
 * DOM, just passes children through.
 *
 * To replicate "a modifier applies to each child" (`Group{…}.padding()` pads each
 * of A/B/C individually) we clone children and merge `className`/`style` onto
 * each — still adding NO wrapper element. Do NOT render a wrapping `<div>` — that
 * would create a layout box SwiftUI's Group never creates.
 *
 * No client directive — pure composition.
 */
import * as React from "react";

export interface GroupProps {
  children?: React.ReactNode;
  /** Optional class merged onto EACH child (transparent — no wrapper). */
  className?: string;
  /** Optional style merged onto EACH child (transparent — no wrapper). */
  style?: React.CSSProperties;
}

type WithStyleProps = {
  className?: string;
  style?: React.CSSProperties;
};

export function Group({ children, className, style }: GroupProps): React.ReactElement {
  // Transparent fast-path: no per-child modifier → pure Fragment, zero work.
  if (!className && !style) return <>{children}</>;
  return (
    <>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        const el = child as React.ReactElement<WithStyleProps>;
        return React.cloneElement(el, {
          className: [el.props.className, className].filter(Boolean).join(" ") || undefined,
          style: { ...el.props.style, ...style },
        });
      })}
    </>
  );
}

Group.displayName = "Group";
