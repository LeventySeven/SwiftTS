"use client";
/**
 * `FormRow` — one label/control row inside a `Form` (Cluster C6 §4.2).
 *
 *   FormRow(label: "Wi-Fi") { Toggle(isOn:) }
 *
 * Leading label (`label`, body 17pt) + trailing control (the children), separated
 * by the row separator that the enclosing Form/List paints. In a `.columns` form
 * (macOS) the label sits in the right-aligned label column and the control in the
 * left-aligned control column — detected via the `isForm`/columns context.
 */
import * as React from "react";
import { useListContext } from "../List/ListContext";
import "../List/List.global.css";

export interface FormRowProps {
  /** Leading label text/content (SwiftUI control label). */
  label?: React.ReactNode;
  /** Optional tap handler (e.g. Picker rows that navigate). */
  onTap?: () => void;
  /** Show a trailing disclosure chevron (navigates to a sub-list). */
  showsChevron?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** The trailing control (Toggle/Picker value/Stepper/…). */
  children?: React.ReactNode;
}

export function FormRow({
  label,
  onTap,
  showsChevron,
  className,
  style,
  children,
}: FormRowProps): React.ReactElement {
  const ctx = useListContext();
  const tappable = !!onTap;

  // .columns form renders label + control as two grid cells (no row chrome).
  if (!ctx.isForm) {
    return (
      <>
        <span className="sui-form__label">{label}</span>
        <span className="sui-form__control">{children}</span>
      </>
    );
  }

  return (
    <div
      className={["sui-list__row", className].filter(Boolean).join(" ")}
      role="listitem"
      tabIndex={tappable ? 0 : undefined}
      data-tappable={tappable ? "true" : undefined}
      onClick={onTap}
      onKeyDown={
        tappable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTap?.();
              }
            }
          : undefined
      }
      style={style}
    >
      <span className="sui-list__label">{label}</span>
      <span className="sui-form__control">{children}</span>
      {showsChevron ? (
        <span className="sui-list__chevron" aria-hidden="true" />
      ) : null}
    </div>
  );
}

FormRow.displayName = "FormRow";
