/**
 * glyphs.tsx — the two SF-Symbol chevrons C7 needs inline.
 *
 * RE'd from `teardowns/SWIFTUI_C7_navigation.md`: the nav-bar back button uses
 * `chevron.backward` (§1.2) and a list-row `NavigationLink` uses the trailing
 * `chevron.forward` disclosure (§3.2). These are drawn as stroked paths sized to
 * the spec's metrics (12×21 back, 8×13 disclosure) and inherit `currentColor`
 * so the tint/tertiary-label color cascades from CSS.
 *
 * Purely presentational — no client directive.
 */
import * as React from "react";

/** `chevron.backward` — the nav-bar back glyph (12×21pt, tinted). */
export function ChevronBackward(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className="sui-chevron"
      viewBox="0 0 12 21"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M10 1.5 1.5 10.5 10 19.5"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** `chevron.forward` — the list-row disclosure glyph (8×13pt, tertiary gray). */
export function ChevronForward(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className="sui-navlink-chevron"
      viewBox="0 0 8 13"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M1.5 1 6.5 6.5 1.5 12"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
