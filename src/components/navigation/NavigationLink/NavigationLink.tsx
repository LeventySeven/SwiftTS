"use client";
/**
 * `NavigationLink` — pushes a destination onto the enclosing `NavigationStack`.
 *
 * RE'd from `teardowns/SWIFTUI_C7_navigation.md` §3. Two flavors, both mirrored:
 *   - value-based (modern): `<NavigationLink value={item}>` appends `item` to
 *     the stack path; the screen is resolved by a registered
 *     `<NavigationDestination for={tag}>`. `value == null` ⇒ disabled (§3.1).
 *   - destination-based (eager): `<NavigationLink destination={<Detail/>}>`
 *     pushes the view directly.
 *
 * Rendered as a List row by default (its most common context): a leading
 * `label` (label color), a flexible spacer, an optional trailing `detail`
 * (secondary-label), then a SMALL trailing `chevron.forward` disclosure
 * (~13px, tertiary-label) — 44pt min height, 16pt insets, pressed fill, with a
 * label-inset hairline separator between stacked rows (§3.2/§3.4). Stack several
 * inside a `.sui-navlist` grouped/inset card. `inline` renders the plain
 * accent-tinted form (no row chrome, no chevron) for use outside a List.
 */
import * as React from "react";
import { ChevronForward } from "../glyphs";
import { useNavigation } from "../NavigationContext";
import "../navigation.global.css";

export interface NavigationLinkProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  /** Value-based push — matched by `<NavigationDestination for={tag}>`. `null` ⇒ disabled. */
  value?: unknown;
  /** The destination-type tag this value routes to (defaults to `destinationTag`/typeof). */
  tag?: string;
  /** Destination-based push — an eager view pushed as-is. */
  destination?: React.ReactNode;
  /** A title carried into the pushed screen's bar (the previous-title back label). */
  title?: string;
  /** The link label (SwiftUI's `@ViewBuilder label`). */
  children: React.ReactNode;
  /** Optional trailing value text (secondary-label), e.g. the "Craig F." in a Name | Craig F. row. */
  detail?: React.ReactNode;
  /** Render the plain accent-tinted inline form instead of the list-row form. */
  inline?: boolean;
  /** Force-disable (mirrors `.disabled(true)` scope). */
  disabled?: boolean;
}

export const NavigationLink = React.forwardRef<HTMLButtonElement, NavigationLinkProps>(
  function NavigationLink(
    { value, tag, destination, title, children, detail, inline, disabled, className, onClick, ...rest },
    ref,
  ) {
    const nav = useNavigation();

    // value: nil ⇒ disabled (and no destination either ⇒ disabled).
    const isDisabled =
      disabled || (value == null && destination === undefined);

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || isDisabled) return;
        if (destination !== undefined) {
          nav.pushView(destination, title);
        } else if (value != null) {
          const resolvedTag = tag ?? defaultTag(value);
          nav.push(value, resolvedTag);
        }
      },
      [onClick, isDisabled, destination, value, tag, title, nav],
    );

    if (inline) {
      return (
        <button
          ref={ref}
          type="button"
          className={["sui-navlink", "sui-navlink-inline", className].filter(Boolean).join(" ")}
          data-disabled={String(!!isDisabled)}
          disabled={isDisabled}
          onClick={handleClick}
          {...rest}
        >
          {children}
        </button>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        className={["sui-navlink", "sui-row", className].filter(Boolean).join(" ")}
        data-disabled={String(!!isDisabled)}
        disabled={isDisabled}
        onClick={handleClick}
        {...rest}
      >
        <span className="sui-navlink-label">{children}</span>
        <span className="sui-navlink-spacer" aria-hidden="true" />
        {detail != null ? (
          <span className="sui-navlink-detail">{detail}</span>
        ) : null}
        <ChevronForward />
      </button>
    );
  },
);

NavigationLink.displayName = "NavigationLink";

/** Derive a destination tag from a value when none is given: prefer an explicit
 *  `__type`/`type` field, else the constructor name, else "default". */
function defaultTag(value: unknown): string {
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.__type === "string") return o.__type;
    if (typeof o.type === "string") return o.type;
    const ctor = (value as object).constructor;
    if (ctor && ctor.name && ctor.name !== "Object") return ctor.name;
  }
  return "default";
}
