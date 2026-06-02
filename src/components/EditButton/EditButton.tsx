"use client";
/**
 * `EditButton` — `SwiftUI.EditButton` (SwiftUI :20528, iOS only).
 *
 * RE'd from `teardowns/SWIFTUI_C2_action-controls.md` §5.1.
 *
 * Toggles `EditMode` in the environment. When inactive it shows "Edit"; when
 * active it shows "Done" (semibold). Modelled here with an explicit `editMode`
 * binding (`editMode` + `onChange`) since the web has no implicit EditMode env.
 *
 * A `.plain`/`.borderless` tint text button — no icon.
 */
import * as React from "react";
import { useIsDisabled } from "../controls/controlMachinery";
import styles from "./EditButton.module.css";

export interface EditButtonProps {
  /** Current edit mode. */
  editMode: "inactive" | "active";
  /** Flip handler — receives the next mode. */
  onChange: (mode: "inactive" | "active") => void;
  /** Localized labels (default Edit / Done). */
  editLabel?: string;
  doneLabel?: string;
  disabled?: boolean;
}

export const EditButton = React.forwardRef<HTMLButtonElement, EditButtonProps>(
  function EditButton(
    { editMode, onChange, editLabel = "Edit", doneLabel = "Done", disabled },
    ref,
  ) {
    const isDisabled = useIsDisabled(disabled);
    const editing = editMode === "active";
    return (
      <button
        ref={ref}
        type="button"
        className={styles.editButton}
        data-editing={editing}
        disabled={isDisabled}
        onClick={() => onChange(editing ? "inactive" : "active")}
      >
        {editing ? doneLabel : editLabel}
      </button>
    );
  },
);

EditButton.displayName = "EditButton";
