/**
 * `<Link>` — SwiftUI's tappable hyperlink (C1 §4).
 *
 * Spec: teardowns/SWIFTUI_C1_content-primitives.md §4.
 *
 *   Link("Apple", destination: URL(string: "https://apple.com")!)
 *
 * Renders a real `<a href>` (SEO + middle-click), tint-colored and NOT underlined
 * (SwiftUI links are not underlined like web `<a>`). The pressed state flashes to
 * ~0.3 opacity. For custom schemes, an `onActivate` hook can intercept the click
 * and dispatch the app's `openURL` equivalent (the SwiftUI environment action).
 *
 * Uses `onClick` interception → "use client".
 */
"use client";

import * as React from "react";
import { applyModifiers, type ViewModifierProps } from "../../system/modifiers";
import { mergeStyles, type ViewProps } from "../View";
import styles from "./Link.module.css";

export interface LinkProps extends Omit<ViewProps, "as"> {
  /** Destination URL (SwiftUI `destination: URL`). */
  destination: string;
  /** Convenience title (renders as the label when no children given). */
  title?: string;
  /** Label content (Text by default). */
  children?: React.ReactNode;
  /** Disabled — greys out and blocks activation. */
  disabled?: boolean;
  /**
   * Intercept activation (custom schemes / in-app routing). Receiving a non-http
   * scheme, the app dispatches its `openURL` equivalent. Call `preventDefault()`
   * to stop the browser navigation.
   */
  onActivate?: (destination: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Anchor target (default `_self`; http(s) links commonly `_blank`). */
  target?: React.HTMLAttributeAnchorTarget;
  /** rel attribute (defaults to a safe rel for `_blank`). */
  rel?: string;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    destination,
    title,
    children,
    disabled,
    onActivate,
    target,
    rel,
    className,
    style: styleProp,
    ...rest
  },
  ref,
) {
  const { style: modStyle, className: modClassName, rest: domRest } = applyModifiers(
    rest as ViewModifierProps & Record<string, unknown>,
  );

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      onActivate?.(destination, e);
    },
    [disabled, onActivate, destination],
  );

  const mergedClassName =
    [styles.link, modClassName, className].filter(Boolean).join(" ") || undefined;

  const safeRel =
    rel ?? (target === "_blank" ? "noopener noreferrer" : undefined);

  return (
    <a
      ref={ref}
      className={mergedClassName}
      href={disabled ? undefined : destination}
      target={target}
      rel={safeRel}
      aria-disabled={disabled ? "true" : undefined}
      onClick={handleClick}
      style={mergeStyles(modStyle, styleProp)}
      {...(domRest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
    >
      {children ?? title}
    </a>
  );
});

Link.displayName = "Link";
