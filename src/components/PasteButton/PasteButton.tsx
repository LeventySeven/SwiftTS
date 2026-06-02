"use client";
/**
 * `PasteButton` — `SwiftUI.PasteButton` (SwiftUI :21561, iOS16/macOS11+).
 *
 * RE'd from `teardowns/SWIFTUI_C2_action-controls.md` §5.5.
 *
 *   PasteButton(supportedContentTypes:, payloadAction:)   // :21563
 *   PasteButton(payloadType:, onPaste:)                   // :21571
 *
 * A privacy-preserving paste affordance: tapping reads the pasteboard ONCE (no
 * silent clipboard access) and delivers matching items to `onPaste`. Web mapping:
 * the click calls `navigator.clipboard.read()` (user-gesture-gated — mirrors the
 * one-shot privacy model), filters by `supportedContentTypes` (MIME), fires.
 *
 * `.borderedProminent`-style filled button — SF `doc.on.clipboard` + "Paste".
 */
import * as React from "react";
import type { ControlSize } from "../../system/types";
import { useControlSize, useIsDisabled } from "../controls/controlMachinery";
import { SymbolGlyph } from "../controls/SymbolGlyph";
import styles from "./PasteButton.module.css";
import "../controls/controlSize.global.css";

export interface PasteButtonProps {
  /** MIME/UTType filter (e.g. ["text/plain", "image/png"]). */
  supportedContentTypes?: string[];
  /** Receives the read clipboard items. */
  onPaste: (items: ClipboardItems | string) => void;
  /** Force-disabled (otherwise enabled; the read fails gracefully if empty). */
  disabled?: boolean;
  /** Localized title (default "Paste"). */
  title?: string;
  controlSize?: ControlSize;
}

export const PasteButton = React.forwardRef<HTMLButtonElement, PasteButtonProps>(
  function PasteButton(
    { supportedContentTypes, onPaste, disabled, title = "Paste", controlSize },
    ref,
  ) {
    const size = useControlSize(controlSize);
    const isDisabled = useIsDisabled(disabled);

    const handleClick = async () => {
      if (typeof navigator === "undefined" || !navigator.clipboard) return;
      try {
        // Prefer the rich read() (filters by type); fall back to text.
        if (navigator.clipboard.read) {
          const items = await navigator.clipboard.read();
          const filtered =
            supportedContentTypes && supportedContentTypes.length
              ? items.filter((it) =>
                  it.types.some((t) => supportedContentTypes.includes(t)),
                )
              : items;
          if (filtered.length) onPaste(filtered);
          return;
        }
        const text = await navigator.clipboard.readText();
        if (text) onPaste(text);
      } catch {
        // permission denied / empty clipboard — no-op (privacy model)
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        className={styles.pasteButton}
        data-control-size={size}
        disabled={isDisabled}
        onClick={handleClick}
      >
        <SymbolGlyph name="doc.on.clipboard" className={styles.icon} />
        {title}
      </button>
    );
  },
);

PasteButton.displayName = "PasteButton";
