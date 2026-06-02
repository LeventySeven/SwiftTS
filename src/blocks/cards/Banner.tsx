/**
 * `<Banner>` / `<Callout>` — a tinted info banner with icon + text + action.
 *
 * The inline notice strip: a rounded tinted (or glass) surface with a leading
 * SF-symbol status icon, a title + optional message, and an optional trailing
 * action button and/or dismiss control. Used for "Update available", "iCloud is
 * full", success/warning/error toasts, and onboarding callouts.
 *
 * `role` picks the semantic tint + default icon (info=blue, success=green,
 * warning=orange/yellow, error=red), matching iOS status colors. `variant`
 * chooses the surface: `"tinted"` (a soft 12%-tint fill — the default callout)
 * or `"glass"` (the Liquid-Glass surface with the tint applied as a wash).
 *
 * Composition (kit only): `<HStack>`/`<VStack>`/`<Spacer>` for layout, `<Text>`
 * for the title/message ramp, `<SymbolGlyph>` for the status + dismiss icons,
 * `<Button>` for the action, and the `glassEffectProps()` helper for the glass
 * surface. `<Banner>` and `<Callout>` are the same component (aliases).
 */
import * as React from "react";
import { HStack } from "../../components/layout/HStack";
import { VStack } from "../../components/layout/VStack";
import { Spacer } from "../../components/layout/Spacer";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button/Button";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import { glassEffectProps, makeGlass } from "../../system/effects";
import styles from "./Banner.module.css";

export type BannerRole = "info" | "success" | "warning" | "error" | "neutral";
export type BannerVariant = "tinted" | "glass";

interface RoleSpec {
  tint: string;
  icon: string;
}

const ROLE_SPEC: Record<BannerRole, RoleSpec> = {
  info: { tint: "var(--sui-color-system-blue)", icon: "info.circle.fill" },
  success: { tint: "var(--sui-color-system-green)", icon: "checkmark.circle.fill" },
  warning: { tint: "var(--sui-color-system-orange)", icon: "exclamationmark.triangle.fill" },
  error: { tint: "var(--sui-color-system-red)", icon: "xmark.octagon.fill" },
  neutral: { tint: "var(--sui-color-system-gray)", icon: "bell.fill" },
};

export interface BannerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Semantic role → tint + default icon. Default `"info"`. */
  role?: BannerRole;
  /** Surface treatment. Default `"tinted"`. */
  variant?: BannerVariant;
  /** Banner title (headline-ish). */
  title: React.ReactNode;
  /** Optional secondary message line. */
  message?: React.ReactNode;
  /** Override the leading SF Symbol (defaults from `role`). Pass `null` to hide. */
  systemImage?: string | null;
  /** Override the tint color (CSS color/token). Defaults from `role`. */
  tint?: string;
  /** Trailing action button label. */
  actionTitle?: string;
  /** Trailing action handler. */
  onAction?: () => void;
  /** Show a trailing dismiss (x) button. */
  onDismiss?: () => void;
}

export const Banner = React.forwardRef<HTMLDivElement, BannerProps>(function Banner(
  {
    role = "info",
    variant = "tinted",
    title,
    message,
    systemImage,
    tint,
    actionTitle,
    onAction,
    onDismiss,
    className,
    style,
    ...rest
  },
  ref,
) {
  const spec = ROLE_SPEC[role];
  const color = tint ?? spec.tint;
  const icon = systemImage === null ? null : systemImage ?? spec.icon;

  // surface: tinted fill vs liquid-glass (tint applied as the glass wash).
  let surfaceClass: string | undefined;
  let surfaceStyle: React.CSSProperties;
  if (variant === "glass") {
    const g = glassEffectProps(
      makeGlass({ variant: "regular", tint: color }),
      { rounded: 14 },
    );
    surfaceClass = g.className;
    surfaceStyle = { ...g.style };
  } else {
    surfaceClass = undefined;
    surfaceStyle = {
      // soft tint fill + hairline tinted border (the iOS callout look)
      background: "color-mix(in srgb, var(--sui-banner-tint) 12%, var(--sui-color-secondary-system-grouped-background))",
      borderRadius: 14,
      boxShadow: "inset 0 0 0 0.5px color-mix(in srgb, var(--sui-banner-tint) 30%, transparent)",
    };
  }

  return (
    <div
      ref={ref}
      className={[styles.banner, surfaceClass, className].filter(Boolean).join(" ") || undefined}
      role="status"
      data-variant={variant}
      data-role={role}
      style={{ ["--sui-banner-tint" as string]: color, ...surfaceStyle, ...style } as React.CSSProperties}
      {...rest}
    >
      <HStack spacing={12} alignment="top" style={{ width: "100%" }}>
        {icon ? (
          <span className={styles.icon} style={{ color }} aria-hidden="true">
            <SymbolGlyph name={icon} size={22} />
          </span>
        ) : null}

        <VStack spacing={2} alignment="leading" style={{ flex: "1 1 auto", minWidth: 0 }}>
          <Text font="subheadline" fontWeight="semibold" foregroundStyle="var(--sui-color-label)">
            {title}
          </Text>
          {message != null ? (
            <Text font="footnote" foregroundStyle="var(--sui-color-secondary-label)">
              {message}
            </Text>
          ) : null}
        </VStack>

        {actionTitle || onDismiss ? <Spacer minLength={4} /> : null}

        {actionTitle ? (
          <Button
            buttonStyle="bordered"
            controlSize="small"
            tint={color}
            action={onAction}
          >
            {actionTitle}
          </Button>
        ) : null}

        {onDismiss ? (
          <button
            type="button"
            className={styles.dismiss}
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <SymbolGlyph name="xmark" size={13} weight="bold" />
          </button>
        ) : null}
      </HStack>
    </div>
  );
});

Banner.displayName = "Banner";

/** `<Callout>` — alias of `<Banner>` (the same tinted-notice block). */
export const Callout = Banner;
