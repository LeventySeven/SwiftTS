/**
 * Data-display BLOCKS — `src/blocks/cards`.
 *
 * Polished, drop-in iOS-26 (Liquid Glass) data-display surfaces composed from the
 * SwiftTS kit: a base Card, KPI tiles + a responsive metric grid, an inset
 * settings group, profile header/card, a tinted/glass banner, and feed/
 * notification rows. All token-driven, all SSR-safe (stateful blocks carry
 * "use client").
 */

// Base container + sparkline primitive
export { Card } from "./Card";
export type { CardProps, CardVariant } from "./Card";
export { Sparkline } from "./Sparkline";
export type { SparklineProps } from "./Sparkline";

// Metric tiles + grid
export { StatTile, MetricCard } from "./StatTile";
export type {
  StatTileProps,
  StatTileDelta,
  DeltaDirection,
} from "./StatTile";
export { MetricGrid } from "./MetricGrid";
export type { MetricGridProps } from "./MetricGrid";

// Settings
export { SettingsGroup } from "./SettingsGroup";
export type {
  SettingsGroupProps,
  SettingsRow,
  SettingsRowTrailing,
} from "./SettingsGroup";

// Profile
export { ProfileHeader, ProfileCard, Avatar } from "./ProfileCard";
export type {
  ProfileHeaderProps,
  ProfileCardProps,
  ProfileAction,
  AvatarProps,
} from "./ProfileCard";

// Banner / Callout
export { Banner, Callout } from "./Banner";
export type { BannerProps, BannerRole, BannerVariant } from "./Banner";

// Activity / Notification rows
export { ActivityRow, NotificationRow } from "./ActivityRow";
export type { ActivityRowProps } from "./ActivityRow";
