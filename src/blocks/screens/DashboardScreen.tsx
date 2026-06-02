"use client";
/**
 * `<DashboardScreen>` — a real analytics dashboard, composed from the kit.
 *
 * Chrome:  a floating Liquid-Glass top bar (`<GlassEffect>` surface, capsule-less
 *          rounded sheet) carrying a large title, a glass search field, and a
 *          glass avatar/action — the bar blurs the content that scrolls under it.
 * Body:    a vertical scroller with:
 *            • a `MetricGrid` of four StatTiles (revenue / users / orders / churn)
 *              each a tinted SF-symbol chip + value + up/down delta,
 *            • a revenue `<Chart>` with `<BarMark>` (the kit's Swift-Charts grammar),
 *            • a weekly `<Chart>` with two `<LineMark>` series,
 *            • a "Recent activity" grouped card of rows.
 *
 * Uses ONLY kit pieces: `<Chart>/<BarMark>/<LineMark>/v>` for the analytics,
 * `<GlassEffect>` for the glass surfaces, `<SymbolGlyph>` for every icon, tokens
 * for color. Client component — it owns the search text + range segmented state.
 */
import * as React from "react";
import { Chart, BarMark, LineMark, v } from "../../components/charts";
import { GlassEffect } from "../../system/effects";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import { Text } from "../../components/Text";
import styles from "./screens.module.css";

interface Metric {
  label: string;
  value: string;
  delta: number; // percent, signed
  symbol: string;
  tint: string;
}

const METRICS: Metric[] = [
  { label: "Revenue", value: "$48.2K", delta: 12.4, symbol: "dollarsign.circle.fill", tint: "var(--sui-color-system-green)" },
  { label: "Users", value: "9,341", delta: 8.1, symbol: "person.2.fill", tint: "var(--sui-color-system-blue)" },
  { label: "Orders", value: "1,204", delta: -3.2, symbol: "cart.fill", tint: "var(--sui-color-system-orange)" },
  { label: "Churn", value: "2.1%", delta: -0.6, symbol: "arrow.down.right", tint: "var(--sui-color-system-pink)" },
];

const REVENUE = [
  { month: "Jan", revenue: 320 },
  { month: "Feb", revenue: 410 },
  { month: "Mar", revenue: 390 },
  { month: "Apr", revenue: 520 },
  { month: "May", revenue: 480 },
  { month: "Jun", revenue: 610 },
];

const TRAFFIC = [
  { day: "Mon", organic: 12, paid: 7 },
  { day: "Tue", organic: 18, paid: 10 },
  { day: "Wed", organic: 15, paid: 14 },
  { day: "Thu", organic: 22, paid: 12 },
  { day: "Fri", organic: 28, paid: 18 },
  { day: "Sat", organic: 25, paid: 21 },
  { day: "Sun", organic: 33, paid: 24 },
];

interface Activity {
  title: string;
  sub: string;
  meta: string;
  symbol: string;
  tint: string;
}

const ACTIVITY: Activity[] = [
  { title: "New subscription", sub: "Pro · annual", meta: "$240", symbol: "star.fill", tint: "var(--sui-color-system-yellow)" },
  { title: "Refund issued", sub: "Order #4821", meta: "−$48", symbol: "arrow.uturn.left", tint: "var(--sui-color-system-red)" },
  { title: "Invoice paid", sub: "Acme Inc.", meta: "$1,200", symbol: "checkmark.circle.fill", tint: "var(--sui-color-system-green)" },
  { title: "New signup", sub: "j.appleseed@icloud.com", meta: "2m ago", symbol: "person.crop.circle.fill", tint: "var(--sui-color-system-blue)" },
];

function StatTile({ m }: { m: Metric }): React.ReactElement {
  const up = m.delta >= 0;
  return (
    <div className={styles.statTile}>
      <div className={styles.statHead}>
        <span className={styles.statIcon} style={{ background: m.tint }}>
          <SymbolGlyph name={m.symbol} size={13} color="#fff" weight="semibold" />
        </span>
        <span className={styles.statLabel}>{m.label}</span>
      </div>
      <span className={styles.statValue}>{m.value}</span>
      <span className={`${styles.statDelta} ${up ? styles.deltaUp : styles.deltaDown}`}>
        <SymbolGlyph name={up ? "arrow.up.right" : "arrow.down.right"} size={11} weight="bold" />
        {Math.abs(m.delta)}%
      </span>
    </div>
  );
}

export interface DashboardScreenProps {
  title?: string;
}

export function DashboardScreen({ title = "Overview" }: DashboardScreenProps = {}): React.ReactElement {
  const [query, setQuery] = React.useState("");

  return (
    <div className={styles.scene}>
      {/* ── Floating Liquid-Glass top bar ── */}
      <GlassEffect glass="regular" shape={{ rounded: 0 }} className={styles.glassBar}>
        <div className={styles.barTopRow}>
          <span className={styles.barTitle}>{title}</span>
          <div className={styles.barTrailing}>
            <span className={styles.iconButton} role="button" aria-label="Notifications">
              <SymbolGlyph name="bell.fill" size={18} />
            </span>
            <span
              className={styles.iconButton}
              role="button"
              aria-label="Account"
              style={{
                background: "linear-gradient(135deg, var(--sui-color-system-purple), var(--sui-color-system-pink))",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              CF
            </span>
          </div>
        </div>
        <GlassEffect glass="clear" shape={{ rounded: 12 }} className={styles.searchField}>
          <span className={styles.searchIcon}>
            <SymbolGlyph name="magnifyingglass" size={16} />
          </span>
          <input
            className={styles.searchInput}
            placeholder="Search metrics"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search metrics"
          />
        </GlassEffect>
      </GlassEffect>

      {/* ── Scrolling content ── */}
      <div className={styles.body}>
        <div className={styles.content}>
          {/* metric grid */}
          <div className={styles.metricGrid}>
            {METRICS.map((m) => (
              <StatTile key={m.label} m={m} />
            ))}
          </div>

          {/* revenue bar chart */}
          <div>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle}>Revenue</span>
              <span className={styles.sectionAction}>Last 6 months</span>
            </div>
            <div className={styles.groupedCard} style={{ padding: 14 }}>
              <div style={{ height: 200 }}>
                <Chart data={REVENUE} yAxisLabel="$K" style={{ height: "100%" }}>
                  {(row) => {
                    const r = row as (typeof REVENUE)[number];
                    return (
                      <BarMark
                        x={v("Month", r.month)}
                        y={v("Revenue", r.revenue)}
                        foregroundStyle="var(--sui-color-system-green)"
                        cornerRadius={5}
                      />
                    );
                  }}
                </Chart>
              </div>
            </div>
          </div>

          {/* traffic line chart (two series) */}
          <div>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle}>Traffic</span>
              <span className={styles.sectionAction}>This week</span>
            </div>
            <div className={styles.groupedCard} style={{ padding: 14 }}>
              <div style={{ height: 200 }}>
                <Chart data={TRAFFIC} yAxisLabel="Visits (K)" style={{ height: "100%" }}>
                  {(row) => {
                    const r = row as (typeof TRAFFIC)[number];
                    return (
                      <>
                        <LineMark
                          x={v("Day", r.day)}
                          y={v("Visits", r.organic)}
                          series={v("Source", "Organic")}
                          foregroundStyleBy={v("Source", "Organic")}
                          interpolationMethod="monotone"
                        />
                        <LineMark
                          x={v("Day", r.day)}
                          y={v("Visits", r.paid)}
                          series={v("Source", "Paid")}
                          foregroundStyleBy={v("Source", "Paid")}
                          interpolationMethod="monotone"
                        />
                      </>
                    );
                  }}
                </Chart>
              </div>
            </div>
          </div>

          {/* recent activity */}
          <div>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle}>Recent activity</span>
              <span className={styles.sectionAction}>See all</span>
            </div>
            <div className={styles.groupedCard}>
              {ACTIVITY.map((a) => (
                <div className={styles.activityRow} key={a.title}>
                  <span className={styles.activityIcon} style={{ background: a.tint }}>
                    <SymbolGlyph name={a.symbol} size={16} color="#fff" weight="semibold" />
                  </span>
                  <div className={styles.activityBody}>
                    <span className={styles.activityTitle}>{a.title}</span>
                    <span className={styles.activitySub}>{a.sub}</span>
                  </div>
                  <span className={styles.activityMeta}>{a.meta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

DashboardScreen.displayName = "DashboardScreen";
