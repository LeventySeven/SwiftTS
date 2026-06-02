"use client";
/**
 * `HelpLink` — `SwiftUI.HelpLink` (SwiftUI :17907, macOS 14+ only).
 *
 * RE'd from `teardowns/SWIFTUI_C2_action-controls.md` §5.3.
 *
 *   HelpLink(action:)              // :17909
 *   HelpLink(destination: URL)     // :17910
 *
 * The standard macOS "?" help button — a 22pt bordered circle. `action` runs
 * custom help; `href` opens a URL (the web stand-in for `destination:`/`anchor:`).
 */
import * as React from "react";
import { useIsDisabled } from "../controls/controlMachinery";
import styles from "./HelpLink.module.css";

export interface HelpLinkProps {
  /** Custom help action (`action:`). */
  action?: () => void;
  /** Open a help URL (`destination:`). action XOR href. */
  href?: string;
  disabled?: boolean;
}

export const HelpLink = React.forwardRef<HTMLButtonElement, HelpLinkProps>(
  function HelpLink({ action, href, disabled }, ref) {
    const isDisabled = useIsDisabled(disabled);
    const handleClick = () => {
      if (action) action();
      else if (href && typeof window !== "undefined") {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    };
    return (
      <button
        ref={ref}
        type="button"
        className={styles.helpLink}
        aria-label="Help"
        disabled={isDisabled}
        onClick={handleClick}
      />
    );
  },
);

HelpLink.displayName = "HelpLink";
