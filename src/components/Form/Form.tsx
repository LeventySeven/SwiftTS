"use client";
/**
 * `Form` — SwiftUI Cluster C6 §4. A grouped collection of control rows.
 *
 *   Form { Section { Toggle(…); Picker(…) } }
 *   .formStyle(.automatic | .grouped | .columns)
 *
 * Visually a `Form` IS `List` + `.insetGrouped` in a NavigationStack (rounded
 * cards, 20pt inset, systemGroupedBackground), with rows laid out as leading
 * label + trailing control. So we build it on top of `List` (asForm flag) rather
 * than reimplementing the chrome. macOS `.columns` switches to a 2-column
 * right-aligned-label / left-aligned-control grid.
 *
 * Style resolution uses `useResolvedStyle('form', style)` so an inherited
 * `.formStyle(...)` is honored when no explicit style is set.
 */
import * as React from "react";
import { List } from "../List/List";
import { useResolvedStyle, type FormStyleName } from "../../system/styles";
import "../List/List.global.css";

export interface FormProps {
  /** formStyle(_:). `"automatic"`/`"grouped"` → insetGrouped list; `"columns"` → macOS grid. */
  formStyle?: FormStyleName;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function Form({
  formStyle,
  className,
  style,
  children,
}: FormProps): React.ReactElement {
  const resolved = useResolvedStyle("form", formStyle);

  if (resolved === "columns") {
    return (
      <div
        className={["sui-form-columns", className].filter(Boolean).join(" ")}
        style={style}
      >
        {children}
      </div>
    );
  }

  // automatic / grouped → insetGrouped List with form-row layout.
  return (
    <List
      listStyle="insetGrouped"
      asForm
      className={className}
      cssStyle={style}
    >
      {children}
    </List>
  );
}

Form.displayName = "Form";
