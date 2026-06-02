/**
 * `<StatTile>` (aka `<MetricCard>`) — a single KPI tile (data-display BLOCK).
 *
 * The dashboard metric card: a leading SF-symbol icon chip, a label, a big
 * monospaced-digit value, an optional up/down delta pill (green/red with a
 * chevron), and an optional inline sparkline along the bottom — the iOS Health /
 * Stocks / Fitness widget look.
 *
 * Composition (kit only): `<Card>` is the surface; `<VStack>`/`<HStack>`/
 * `<Spacer>` lay it out; `<Text>` carries the typography ramp (caption label,
 * largeTitle value with `monospacedDigit`); `<SymbolGlyph>` draws the icon and
 * the delta chevron; `<Sparkline>` draws the trend. The delta tint resolves to
 * the system green/red tokens.
 *
 * Purely presentational — server-compatible (Card/Sparkline/Text/SymbolGlyph are
 * all SSR-safe).
 */
import * as React from "react";
import { VStack } from "../../components/layout/VStack";
import { HStack } from "../../components/layout/HStack";
import { Spacer } from "../../components/layout/Spacer";
import { Text } from "../../components/Text";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import { Card, type CardProps } from "./Card";
import { Sparkline } from "./Sparkline";
import styles from "./StatTile.module.css";

export type DeltaDirection = "up" | "down" | "neutral";

export interface StatTileDelta {
  /** Display text, e.g. "12.4%" or "+1,204". The sign chevron is drawn separately. */
  value: React.ReactNode;
  /** Trend direction → chevron + green/red/gray tint. */
  direction?: DeltaDirection;
  /**
   * When `true`, an "up" delta is RED and "down" is GREEN (cost/latency metrics
   * where down-is-good). Default `false` (up = green, the revenue/growth case).
   */
  invertColor?: boolean;
}

export interface StatTileProps
  extends Omit<CardProps, "header" | "footer" | "children"> {
  /** The metric label (e.g. "Revenue"). Caption, secondary color. */
  label: React.ReactNode;
  /** The metric value (e.g. "$48.2K"). LargeTitle, tabular figures. */
  value: React.ReactNode;
  /** Optional leading SF Symbol name (e.g. "dollarsign.circle.fill"). */
  systemImage?: string;
  /** Tint for the icon chip + sparkline (CSS color or token). Default tint blue. */
  tint?: string;
  /** Optional up/down delta pill. */
  delta?: StatTileDelta;
  /** Optional sparkline trend (oldest → newest). */
  trend?: number[];
  /** A secondary sub-caption under the value (e.g. "vs last week"). */
  caption?: React.ReactNode;
}

/** Resolve the delta tint: green for "good", red for "bad", gray for neutral. */
function deltaColor(d: StatTileDelta): string {
  if (d.direction === "neutral" || d.direction == null) {
    return "var(--sui-color-secondary-label)";
  }
  const good = d.invertColor ? d.direction === "down" : d.direction === "up";
  return good ? "var(--sui-color-system-green)" : "var(--sui-color-system-red)";
}

const DELTA_CHEVRON: Record<DeltaDirection, string | null> = {
  up: "chevron.up",
  down: "chevron.down",
  neutral: null,
};

export const StatTile = React.forwardRef<HTMLElement, StatTileProps>(
  function StatTile(
    {
      label,
      value,
      systemImage,
      tint = "var(--sui-color-system-blue)",
      delta,
      trend,
      caption,
      padding = 16,
      ...cardProps
    },
    ref,
  ) {
    const chevron =
      delta?.direction != null ? DELTA_CHEVRON[delta.direction] : null;
    const dColor = delta ? deltaColor(delta) : undefined;

    return (
      <Card ref={ref} padding={padding} {...cardProps}>
        <VStack alignment="leading" spacing={8} style={{ width: "100%" }}>
          {/* top row: icon chip + label …spacer… delta pill */}
          <HStack alignment="center" spacing={8} style={{ width: "100%" }}>
            {systemImage ? (
              <span
                className={styles.iconChip}
                style={{ ["--sui-tile-tint" as string]: tint } as React.CSSProperties}
              >
                <SymbolGlyph name={systemImage} size={15} weight="semibold" />
              </span>
            ) : null}
            <Text
              font="subheadline"
              foregroundStyle="var(--sui-color-secondary-label)"
              lineLimit={1}
            >
              {label}
            </Text>
            <Spacer />
            {delta ? (
              <span className={styles.deltaPill} style={{ color: dColor }}>
                {chevron ? (
                  <SymbolGlyph name={chevron} size={11} weight="bold" />
                ) : null}
                <Text
                  font={{ size: 13, weight: "semibold" }}
                  foregroundStyle={dColor}
                  monospacedDigit
                >
                  {delta.value}
                </Text>
              </span>
            ) : null}
          </HStack>

          {/* value */}
          <Text
            font="largeTitle"
            fontWeight="bold"
            monospacedDigit
            foregroundStyle="var(--sui-color-label)"
            style={{ lineHeight: 1.05 }}
          >
            {value}
          </Text>

          {caption != null ? (
            <Text font="caption" foregroundStyle="var(--sui-color-tertiary-label)">
              {caption}
            </Text>
          ) : null}

          {/* sparkline */}
          {trend && trend.length > 1 ? (
            <div className={styles.spark} style={{ color: tint }}>
              <Sparkline data={trend} height={36} />
            </div>
          ) : null}
        </VStack>
      </Card>
    );
  },
);

StatTile.displayName = "StatTile";

/** `<MetricCard>` — alias of `<StatTile>` (the SwiftUI-flavored name). */
export const MetricCard = StatTile;
