/**
 * `<ProfileHeader>` / `<ProfileCard>` — avatar + identity + actions (BLOCK).
 *
 * The account-screen header: a circular avatar (loaded via `<AsyncImage>`, or an
 * initials/SF-symbol fallback), a name (title weight), a subtitle (secondary
 * label, e.g. an email or @handle), and a row of action buttons. Two surfaces:
 *
 *   • `<ProfileHeader>` — bare (no card), the big centered header that sits at
 *     the top of a grouped settings screen on the page background.
 *   • `<ProfileCard>`   — the same identity laid out left-aligned INSIDE a
 *     `<Card>` surface (the contact-card / member-tile form).
 *
 * Composition (kit only): `<AsyncImage>` for the avatar (with a placeholder),
 * `<VStack>`/`<HStack>`/`<Spacer>` for layout, `<Text>` for the ramp,
 * `<Button>` for the actions, `<SymbolGlyph>` for the fallback glyph, and
 * `<Card>` for the carded form.
 */
import * as React from "react";
import { VStack } from "../../components/layout/VStack";
import { HStack } from "../../components/layout/HStack";
import { Text } from "../../components/Text";
import { AsyncImage } from "../../components/AsyncImage/AsyncImage";
import { Button } from "../../components/Button/Button";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import { Card, type CardProps } from "./Card";
import type { ButtonStyleName } from "../../system/styles";
import styles from "./ProfileCard.module.css";

export interface ProfileAction {
  /** Button label (omit to render an icon-only circular button). */
  title?: string;
  /** Leading SF Symbol name. */
  systemImage?: string;
  /** `Button(role:)` — `"destructive"` paints red. */
  role?: "destructive" | "cancel" | "confirm" | "close";
  /** `.buttonStyle(_:)`. Default `"bordered"`. */
  buttonStyle?: ButtonStyleName;
  /** Tint override. */
  tint?: string;
  onTap?: () => void;
}

/** The shared avatar element (AsyncImage circle with an initials/glyph fallback). */
export interface AvatarProps {
  /** Image URL. Omitted/failed → initials or the person glyph. */
  url?: string | null;
  /** Fallback initials (e.g. "CF"). Used when no image loads. */
  initials?: string;
  /** Fallback SF Symbol if no initials (default "person.fill"). */
  systemImage?: string;
  /** Diameter in px. Default `64`. */
  size?: number;
  /** Background color of the fallback bubble (CSS color/token). */
  fallbackColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Avatar({
  url,
  initials,
  systemImage = "person.fill",
  size = 64,
  fallbackColor = "var(--sui-color-system-gray3)",
  className,
  style,
}: AvatarProps): React.ReactElement {
  const dim = { width: size, height: size } as const;
  const fallback = (
    <div
      className={styles.avatarFallback}
      style={{ ...dim, background: fallbackColor }}
      aria-hidden="true"
    >
      {initials ? (
        <span
          className={styles.initials}
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {initials}
        </span>
      ) : (
        <SymbolGlyph name={systemImage} size={Math.round(size * 0.5)} color="#fff" />
      )}
    </div>
  );

  return (
    <div
      className={[styles.avatar, className].filter(Boolean).join(" ") || undefined}
      style={{ ...dim, ...style }}
    >
      {url ? (
        <AsyncImage
          url={url}
          style={{ width: "100%", height: "100%" }}
          content={(img) => (
            <img className={styles.avatarImg} src={img} alt="" />
          )}
          placeholder={() => fallback}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
Avatar.displayName = "Avatar";

interface ProfileCommonProps {
  /** Avatar image URL. */
  avatarURL?: string | null;
  /** Initials fallback (e.g. "CF"). */
  initials?: string;
  /** Display name (title). */
  name: React.ReactNode;
  /** Subtitle (secondary label — email, @handle, role). */
  subtitle?: React.ReactNode;
  /** A second sub-line (tertiary). */
  detail?: React.ReactNode;
  /** Avatar diameter (px). */
  avatarSize?: number;
  /** Avatar fallback bubble color. */
  avatarColor?: string;
  /** Action buttons. */
  actions?: ProfileAction[];
}

function renderActions(actions: ProfileAction[] | undefined): React.ReactNode {
  if (!actions || actions.length === 0) return null;
  return (
    <HStack spacing={8} style={{ flexWrap: "wrap" }}>
      {actions.map((a, i) => (
        <Button
          key={i}
          title={a.title}
          systemImage={a.systemImage}
          role={a.role}
          buttonStyle={a.buttonStyle ?? "bordered"}
          tint={a.tint}
          action={a.onTap}
        />
      ))}
    </HStack>
  );
}

export interface ProfileHeaderProps
  extends ProfileCommonProps,
    Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {}

/** `<ProfileHeader>` — the big centered account header (no card surface). */
export const ProfileHeader = React.forwardRef<HTMLDivElement, ProfileHeaderProps>(
  function ProfileHeader(
    {
      avatarURL,
      initials,
      name,
      subtitle,
      detail,
      avatarSize = 80,
      avatarColor,
      actions,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={[styles.header, className].filter(Boolean).join(" ") || undefined}
        style={style}
        {...rest}
      >
        <VStack spacing={10} alignment="center">
          <Avatar
            url={avatarURL}
            initials={initials}
            size={avatarSize}
            fallbackColor={avatarColor}
          />
          <VStack spacing={2} alignment="center">
            <Text font="title2" fontWeight="bold" foregroundStyle="var(--sui-color-label)">
              {name}
            </Text>
            {subtitle != null ? (
              <Text font="subheadline" foregroundStyle="var(--sui-color-secondary-label)">
                {subtitle}
              </Text>
            ) : null}
            {detail != null ? (
              <Text font="footnote" foregroundStyle="var(--sui-color-tertiary-label)">
                {detail}
              </Text>
            ) : null}
          </VStack>
          {actions && actions.length > 0 ? (
            <div className={styles.actions}>{renderActions(actions)}</div>
          ) : null}
        </VStack>
      </div>
    );
  },
);
ProfileHeader.displayName = "ProfileHeader";

export interface ProfileCardProps
  extends ProfileCommonProps,
    Omit<CardProps, "title" | "children" | "header" | "footer"> {}

/** `<ProfileCard>` — left-aligned identity inside a `<Card>` surface. */
export const ProfileCard = React.forwardRef<HTMLElement, ProfileCardProps>(
  function ProfileCard(
    {
      avatarURL,
      initials,
      name,
      subtitle,
      detail,
      avatarSize = 56,
      avatarColor,
      actions,
      ...cardProps
    },
    ref,
  ) {
    return (
      <Card ref={ref} {...cardProps}>
        <VStack spacing={12} alignment="leading" style={{ width: "100%" }}>
          <HStack spacing={12} alignment="center" style={{ width: "100%" }}>
            <Avatar
              url={avatarURL}
              initials={initials}
              size={avatarSize}
              fallbackColor={avatarColor}
            />
            <VStack spacing={1} alignment="leading">
              <Text font="headline" foregroundStyle="var(--sui-color-label)">
                {name}
              </Text>
              {subtitle != null ? (
                <Text
                  font="subheadline"
                  foregroundStyle="var(--sui-color-secondary-label)"
                >
                  {subtitle}
                </Text>
              ) : null}
              {detail != null ? (
                <Text font="footnote" foregroundStyle="var(--sui-color-tertiary-label)">
                  {detail}
                </Text>
              ) : null}
            </VStack>
          </HStack>
          {renderActions(actions)}
        </VStack>
      </Card>
    );
  },
);
ProfileCard.displayName = "ProfileCard";
