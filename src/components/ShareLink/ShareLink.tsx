"use client";
/**
 * `ShareLink` — `SwiftUI.ShareLink<…>` (SwiftUI :17935).
 *
 * RE'd from `teardowns/SWIFTUI_C2_action-controls.md` §5.4.
 *
 *   ShareLink(items:subject:message:preview:label:)      // :17936
 *   ShareLink(item: URL, subject:, message:)             // :18052
 *   ShareLink(_:items:…)                                 // :17985
 *
 * Presents the system share sheet for `items`. Web equivalent: the click calls
 * `navigator.share({ title, text, url })` (Web Share API) when available, else
 * falls back to copying the first item to the clipboard.
 *
 * Default label = SF `square.and.arrow.up` + "Share"; a custom `children` label
 * replaces it.
 */
import * as React from "react";
import { useIsDisabled } from "../controls/controlMachinery";
import { SymbolGlyph } from "../controls/SymbolGlyph";
import styles from "./ShareLink.module.css";

type ShareItem = string | URL;

export interface ShareLinkProps {
  /** The data to share (`Data`). */
  items?: ShareItem[];
  /** Single-item convenience (`item:`). */
  item?: ShareItem;
  /** Prefill mail subject / message. */
  subject?: string;
  message?: string;
  /** Overrides the default "Share" title. */
  title?: string;
  /** Default leading SF Symbol. */
  systemImage?: string;
  /** Custom label (overrides title + glyph). */
  children?: React.ReactNode;
  /** Called after a successful share (web hook). */
  onShare?: () => void;
  disabled?: boolean;
}

function toStrings(items: ShareItem[]): string[] {
  return items.map((i) => (i instanceof URL ? i.href : i));
}

export const ShareLink = React.forwardRef<HTMLButtonElement, ShareLinkProps>(
  function ShareLink(
    {
      items,
      item,
      subject,
      message,
      title = "Share",
      systemImage = "square.and.arrow.up",
      children,
      onShare,
      disabled,
    },
    ref,
  ) {
    const isDisabled = useIsDisabled(disabled);

    const collected = toStrings([
      ...(items ?? []),
      ...(item != null ? [item] : []),
    ]);

    const handleClick = async () => {
      const first = collected[0];
      const isUrl = first ? /^https?:\/\//.test(first) : false;
      const payload: ShareData = {
        title: subject,
        text: message ?? (isUrl ? undefined : collected.join("\n")),
        url: isUrl ? first : undefined,
      };
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share(payload);
          onShare?.();
          return;
        }
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard && first) {
          await navigator.clipboard.writeText(collected.join("\n"));
          onShare?.();
        }
      } catch {
        /* no-op */
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        className={styles.shareLink}
        disabled={isDisabled}
        onClick={handleClick}
      >
        {children ?? (
          <>
            <SymbolGlyph name={systemImage} className={styles.icon} />
            {title}
          </>
        )}
      </button>
    );
  },
);

ShareLink.displayName = "ShareLink";
