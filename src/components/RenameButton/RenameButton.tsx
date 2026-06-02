"use client";
/**
 * `RenameButton` — `SwiftUI.RenameButton<Label>` (SwiftUI :22978).
 *
 * RE'd from `teardowns/SWIFTUI_C2_action-controls.md` §5.2.
 *
 * Placed in a context menu / toolbar; triggers the nearest `.renameAction(_:)`.
 * Default label = SF `pencil` + "Rename". On the web there's no implicit
 * renameAction registry, so the action is passed explicitly.
 */
import * as React from "react";
import { useIsDisabled } from "../controls/controlMachinery";
import { SymbolGlyph } from "../controls/SymbolGlyph";
import styles from "./RenameButton.module.css";

export interface RenameButtonProps {
  /** Wire to the nearest renameAction closure (often focuses a text field). */
  action: () => void;
  /** Localized title (default "Rename"). */
  title?: string;
  disabled?: boolean;
}

export const RenameButton = React.forwardRef<HTMLButtonElement, RenameButtonProps>(
  function RenameButton({ action, title = "Rename", disabled }, ref) {
    const isDisabled = useIsDisabled(disabled);
    return (
      <button
        ref={ref}
        type="button"
        className={styles.renameButton}
        disabled={isDisabled}
        onClick={action}
      >
        <SymbolGlyph name="pencil" className={styles.icon} />
        {title}
      </button>
    );
  },
);

RenameButton.displayName = "RenameButton";
