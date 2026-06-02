/**
 * `<Card>` — the base rounded data-display container (data-display BLOCK).
 *
 * The everyday iOS "inset card": a rounded rectangle with a fill background, a
 * continuous corner radius, comfortable padding, and optional header / footer
 * regions separated by hairline dividers. It is the surface every other block
 * here (StatTile, ProfileCard, Banner, …) sits on, and the drop-in for the
 * `secondarySystemGroupedBackground` card that wraps grouped content.
 *
 * Surfaces (`variant`):
 *   • "plain"    — opaque `secondarySystemGroupedBackground` fill (default; the
 *                  standard Settings/grouped card).
 *   • "material" — a frosted Material backdrop (translucent over a wallpaper /
 *                  scroller). The live blur is clipped to the card radius.
 *   • "glass"    — the iOS-26 Liquid-Glass surface: blur + specular rim + sheen,
 *                  clipped to the card radius, with optional tint.
 *
 * Composes ONLY from the kit: `<View>` is always the ref-bearing host (so every
 * modifier prop still works), and the material/glass surfaces are applied as the
 * kit's stable class strings via `materialClass()` / `glassEffectProps()` from
 * `../../system/effects` (those component wrappers are plain FCs without refs, so
 * we use their class helpers to stay ref-clean). `<Divider>` draws the header /
 * footer rules. Server-compatible — no client hooks.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../../components/View";
import { Divider } from "../../components/Divider";
import {
  materialClass,
  glassEffectProps,
  type MaterialLevel,
  type Glass,
  type GlassVariant,
} from "../../system/effects";
import styles from "./Card.module.css";

export type CardVariant = "plain" | "material" | "glass";

export interface CardProps extends Omit<ViewProps, "as" | "title" | "content"> {
  /** Surface treatment. Default `"plain"` (opaque grouped-background fill). */
  variant?: CardVariant;
  /** Material thickness when `variant="material"`. Default `"regular"`. */
  materialLevel?: MaterialLevel;
  /** Glass config when `variant="glass"` — a `Glass` value or bare variant name. */
  glass?: Glass | GlassVariant;
  /** Corner radius (px). Default `12` (the iOS continuous card radius). */
  cornerRadius?: number;
  /**
   * Interior padding (px). Default `16`. Pass `0` for an edge-to-edge body
   * (e.g. a card that hosts its own `<List>`).
   */
  padding?: number;
  /** Optional header region (rendered above a hairline divider). */
  header?: React.ReactNode;
  /** Optional footer region (rendered below a hairline divider). */
  footer?: React.ReactNode;
  /** Drop the default soft drop shadow (plain cards get a subtle lift by default). */
  noShadow?: boolean;
  /** The card body. */
  children?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLElement, CardProps>(function Card(
  {
    variant = "plain",
    materialLevel = "regular",
    glass = "regular",
    cornerRadius = 12,
    padding = 16,
    header,
    footer,
    noShadow = false,
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  // The interior layout: optional header → divider → body → divider → footer.
  // Padding is applied per-region so the dividers can stretch full-bleed.
  const pad = `${padding}px`;
  const body = (
    <>
      {header != null ? (
        <>
          <div className={styles.region} style={{ padding: pad }}>
            {header}
          </div>
          <Divider />
        </>
      ) : null}
      <div className={styles.region} style={{ padding: pad }}>
        {children}
      </div>
      {footer != null ? (
        <>
          <Divider />
          <div className={styles.region} style={{ padding: pad }}>
            {footer}
          </div>
        </>
      ) : null}
    </>
  );

  const radius = `${cornerRadius}px`;
  const shadow: React.CSSProperties | undefined = noShadow
    ? undefined
    : { boxShadow: "var(--sui-shadow-card, 0 1px 3px rgba(0,0,0,0.08))" };

  // Resolve the surface (className + base style) per variant. All three render
  // through the same ref-bearing <View> host below.
  let surfaceClass: string | undefined;
  let surfaceStyle: React.CSSProperties;

  if (variant === "material") {
    surfaceClass = `${materialClass(materialLevel)} sui-material-no-rim`;
    surfaceStyle = { borderRadius: radius, overflow: "hidden" };
  } else if (variant === "glass") {
    const g = glassEffectProps(glass, { rounded: cornerRadius });
    surfaceClass = g.className;
    surfaceStyle = { ...g.style, overflow: "hidden" };
  } else {
    surfaceClass = undefined;
    surfaceStyle = {
      background: "var(--sui-color-secondary-system-grouped-background)",
      borderRadius: radius,
      overflow: "hidden",
    };
  }

  const rootClass =
    [styles.card, surfaceClass, className].filter(Boolean).join(" ") || undefined;

  return (
    <View
      ref={ref}
      as="div"
      className={rootClass}
      data-variant={variant}
      style={mergeStyles(surfaceStyle, shadow, style)}
      {...rest}
    >
      {body}
    </View>
  );
});

Card.displayName = "Card";
