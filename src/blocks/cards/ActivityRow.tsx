/**
 * `<ActivityRow>` / `<NotificationRow>` — a feed / notification list row (BLOCK).
 *
 * The activity-feed / inbox row: a leading visual (a colored SF-symbol icon
 * chip, OR an avatar image), a title, an optional subtitle/preview line, a
 * trailing timestamp, and an optional trailing accessory (an unread dot, a
 * chevron, a count badge, or arbitrary content). This is the Notification
 * Center / Messages / GitHub-activity row.
 *
 * Composition (kit only): `<HStack>`/`<VStack>`/`<Spacer>` for layout, `<Text>`
 * for the title/subtitle/timestamp ramp, `<SymbolGlyph>` for the icon + chevron,
 * and `<Avatar>` (from ProfileCard) for the avatar variant. Tapping toggles a
 * pressed highlight (when `onTap` is given). Designed to be stacked inside a
 * `<Card padding={0}>` (rows divide themselves with a leading-inset hairline).
 */
import * as React from "react";
import { HStack } from "../../components/layout/HStack";
import { VStack } from "../../components/layout/VStack";
import { Spacer } from "../../components/layout/Spacer";
import { Text } from "../../components/Text";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import { Avatar } from "./ProfileCard";
import styles from "./ActivityRow.module.css";

export interface ActivityRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Leading SF Symbol (rendered white on a colored chip). Ignored if `avatarURL`/`avatar` set. */
  systemImage?: string;
  /** Chip background color for the `systemImage` variant. Default system blue. */
  iconColor?: string;
  /** Avatar image URL (overrides `systemImage` — renders a circular avatar). */
  avatarURL?: string | null;
  /** Avatar initials fallback. */
  initials?: string;
  /** Arbitrary leading content (overrides both icon + avatar). */
  leading?: React.ReactNode;

  /** Title line (body weight). */
  title: React.ReactNode;
  /** Subtitle / preview (secondary, up to 2 lines). */
  subtitle?: React.ReactNode;
  /** Trailing timestamp text (e.g. "2m", "Yesterday"). */
  timestamp?: React.ReactNode;

  /** Show a blue unread dot at the leading edge. */
  unread?: boolean;
  /** Trailing accessory: a chevron, a count badge, or custom content. */
  accessory?: "chevron" | "none";
  /** Count/text badge (a gray pill) placed before the accessory. */
  badge?: number | string;
  /** Arbitrary trailing content (placed before the accessory). */
  trailing?: React.ReactNode;

  /** Tap handler — adds the pressed highlight + keyboard activation. */
  onTap?: () => void;
}

export const ActivityRow = React.forwardRef<HTMLDivElement, ActivityRowProps>(
  function ActivityRow(
    {
      systemImage,
      iconColor = "var(--sui-color-system-blue)",
      avatarURL,
      initials,
      leading,
      title,
      subtitle,
      timestamp,
      unread = false,
      accessory = "none",
      badge,
      trailing,
      onTap,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    const tappable = !!onTap;

    // Resolve the leading visual: explicit > avatar > icon chip.
    const leadingNode =
      leading ??
      (avatarURL != null || initials != null ? (
        <Avatar url={avatarURL} initials={initials} size={40} />
      ) : systemImage ? (
        <span
          className={styles.iconChip}
          style={{ ["--sui-activity-icon" as string]: iconColor } as React.CSSProperties}
          aria-hidden="true"
        >
          <SymbolGlyph name={systemImage} size={20} weight="medium" />
        </span>
      ) : null);

    return (
      <div
        ref={ref}
        className={[styles.row, className].filter(Boolean).join(" ") || undefined}
        role="listitem"
        tabIndex={tappable ? 0 : undefined}
        data-tappable={tappable ? "true" : undefined}
        onClick={onTap}
        onKeyDown={
          tappable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onTap?.();
                }
              }
            : undefined
        }
        style={style}
        {...rest}
      >
        {unread ? <span className={styles.unreadDot} aria-hidden="true" /> : null}

        {leadingNode ? <div className={styles.leading}>{leadingNode}</div> : null}

        <VStack spacing={1} alignment="leading" style={{ flex: "1 1 auto", minWidth: 0 }}>
          <HStack spacing={6} alignment="firstTextBaseline" style={{ width: "100%" }}>
            <Text
              font="subheadline"
              fontWeight={unread ? "semibold" : "regular"}
              foregroundStyle="var(--sui-color-label)"
              lineLimit={1}
              style={{ flex: "0 1 auto", minWidth: 0 }}
            >
              {title}
            </Text>
            <Spacer minLength={6} />
            {timestamp != null ? (
              <Text
                font="caption"
                foregroundStyle="var(--sui-color-tertiary-label)"
                style={{ flex: "0 0 auto" }}
              >
                {timestamp}
              </Text>
            ) : null}
          </HStack>
          {subtitle != null ? (
            <Text
              font="footnote"
              foregroundStyle="var(--sui-color-secondary-label)"
              lineLimit={2}
              style={{ width: "100%" }}
            >
              {subtitle}
            </Text>
          ) : null}
        </VStack>

        {trailing != null ? <div className={styles.trailing}>{trailing}</div> : null}
        {badge != null ? <span className={styles.badge}>{badge}</span> : null}
        {accessory === "chevron" ? (
          <span className={styles.chevron} aria-hidden="true">
            <SymbolGlyph name="chevron.right" size={13} weight="semibold" />
          </span>
        ) : null}
      </div>
    );
  },
);

ActivityRow.displayName = "ActivityRow";

/** `<NotificationRow>` — alias of `<ActivityRow>` (the inbox/notification form). */
export const NotificationRow = ActivityRow;
