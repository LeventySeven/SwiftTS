"use client";
/**
 * SectionBlocks — the "Kit Blocks" gallery section.
 *
 * Two bands:
 *   1. Screen Templates — the five composed full-screen blocks
 *      (SettingsScreen / DashboardScreen / ProfileScreen / SearchScreen /
 *      MediaPlayerScreen) each dropped inside a glassy iOS phone frame.
 *   2. Standalone Blocks — the drop-in chrome + data-display surfaces
 *      (GlassNavBar, GlassSidebar, GlassTabBar, StatTile, MetricGrid,
 *      SettingsGroup, ProfileCard, Banner) shown as cards.
 *
 * Everything is imported from the BLOCKS barrel (`@/blocks` → `src/blocks`).
 */
import * as React from "react";
import {
  // screens
  SettingsScreen,
  DashboardScreen,
  ProfileScreen,
  SearchScreen,
  MediaPlayerScreen,
  // chrome / shells
  GlassNavBar,
  GlassSidebar,
  GlassTabBar,
  // data-display cards
  StatTile,
  MetricGrid,
  SettingsGroup,
  ProfileCard,
  Banner,
} from "@/blocks";
import { GallerySection, SectionHeader, Card } from "./chrome";

/* ────────────────────────────────────────────────────────────────────────── *
 *  Phone frame — a glossy device bezel the screen templates live inside.
 * ────────────────────────────────────────────────────────────────────────── */
function PhoneFrame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
      <div
        style={{
          position: "relative",
          width: 268,
          height: 560,
          borderRadius: 44,
          padding: 11,
          background:
            "linear-gradient(160deg, #3a3a3c 0%, #1c1c1e 42%, #0a0a0b 100%)",
          boxShadow:
            "0 1px 0 1px rgba(255,255,255,0.08) inset, 0 18px 50px rgba(0,0,0,0.42), 0 4px 12px rgba(0,0,0,0.28)",
          flex: "0 0 auto",
        }}
      >
        {/* screen well */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 34,
            overflow: "hidden",
            background: "var(--sui-color-system-grouped-background)",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.6)",
          }}
        >
          {children}
          {/* dynamic-island pill */}
          <div
            style={{
              position: "absolute",
              top: 9,
              left: "50%",
              transform: "translateX(-50%)",
              width: 86,
              height: 24,
              borderRadius: 14,
              background: "#000",
              zIndex: 50,
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
      <figcaption
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--sui-color-secondary-label)",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {label}
      </figcaption>
    </figure>
  );
}

/** A horizontally-scrolling rail of phone frames. */
function PhoneRail({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        gap: 26,
        overflowX: "auto",
        padding: "8px 4px 14px",
        scrollSnapType: "x mandatory",
      }}
    >
      {React.Children.map(children, (c) => (
        <div style={{ scrollSnapAlign: "center", flex: "0 0 auto" }}>{c}</div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

export function SectionBlocks(): React.ReactElement {
  const [tab, setTab] = React.useState("home");

  return (
    <GallerySection
      id="blocks"
      title="Kit Blocks"
      subtitle="Drop-in screen templates + composed glass surfaces, built only from the kit"
    >
      {/* ============================ SCREEN TEMPLATES ============================ */}
      <Card title="Screen templates" bleed>
        <div style={{ padding: "12px 18px 0" }}>
          <SectionHeader
            title="Full screens"
            subtitle="SettingsScreen · DashboardScreen · ProfileScreen · SearchScreen · MediaPlayerScreen — each composed entirely from @sui, framed in a device bezel."
          />
        </div>
        <div style={{ padding: "0 14px 6px" }}>
          <PhoneRail>
            <PhoneFrame label="<SettingsScreen/>">
              <SettingsScreen
                account={{ name: "Casey Fields", subtitle: "Apple ID, iCloud, Media & Purchases", initials: "CF" }}
              />
            </PhoneFrame>
            <PhoneFrame label="<DashboardScreen/>">
              <DashboardScreen title="Overview" />
            </PhoneFrame>
            <PhoneFrame label="<ProfileScreen/>">
              <ProfileScreen
                name="Casey Fields"
                handle="@casey"
                bio="Design engineer. Building delightful iOS-grade web surfaces."
                initials="CF"
              />
            </PhoneFrame>
            <PhoneFrame label="<SearchScreen/>">
              <SearchScreen title="Search" />
            </PhoneFrame>
            <PhoneFrame label="<MediaPlayerScreen/>">
              <MediaPlayerScreen
                title="Midnight City"
                artist="M83"
                album="Hurry Up, We're Dreaming"
                durationSec={244}
              />
            </PhoneFrame>
          </PhoneRail>
        </div>
      </Card>

      {/* ============================ STANDALONE BLOCKS ============================ */}

      {/* — Glass chrome — */}
      <Card title="Glass chrome" bleed>
        <div style={{ padding: "12px 18px 0" }}>
          <SectionHeader
            title="Bars & sidebars"
            subtitle="GlassNavBar · GlassTabBar · GlassSidebar — Liquid-Glass chrome blocks."
          />
        </div>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            padding: 22,
            backgroundImage:
              "radial-gradient(120% 120% at 12% 8%, #0a84ff 0, transparent 46%)," +
              "radial-gradient(120% 120% at 90% 12%, #ff2d55 0, transparent 44%)," +
              "radial-gradient(120% 120% at 60% 92%, #34c759 0, transparent 42%)," +
              "linear-gradient(135deg, #5856d6, #af52de)",
          }}
        >
          <GlassNavBar
            variant="large"
            title="Library"
            subtitle="128 items"
            leadingItems={[{ systemImage: "chevron.left", label: "Back" }]}
            trailingItems={[
              { systemImage: "line.3.horizontal.decrease", accessibilityLabel: "Filter" },
              { systemImage: "plus", prominent: true, accessibilityLabel: "Add" },
            ]}
          />

          <GlassTabBar
            items={[
              { id: "home", label: "Home", systemImage: "house", selectedSystemImage: "house.fill" },
              { id: "search", label: "Search", systemImage: "magnifyingglass" },
              { id: "library", label: "Library", systemImage: "square.stack", selectedSystemImage: "square.stack.fill", badge: 3 },
              { id: "profile", label: "Profile", systemImage: "person.crop.circle", selectedSystemImage: "person.crop.circle.fill" },
            ]}
            selection={tab}
            onSelect={setTab}
            floating={false}
          />

          <div style={{ maxWidth: 320 }}>
            <GlassSidebar
              headerInfo={{ title: "Acme Inc.", subtitle: "Production workspace", systemImage: "shippingbox.fill" }}
              sections={[
                {
                  title: "Workspace",
                  items: [
                    { id: "dash", label: "Dashboard", systemImage: "square.grid.2x2.fill" },
                    { id: "inbox", label: "Inbox", systemImage: "tray.fill", badge: 12 },
                    { id: "tasks", label: "Tasks", systemImage: "checklist", chevron: true },
                  ],
                },
                {
                  title: "Account",
                  items: [
                    { id: "billing", label: "Billing", systemImage: "creditcard.fill" },
                    { id: "settings", label: "Settings", systemImage: "gearshape.fill" },
                  ],
                },
              ]}
              selection="dash"
            />
          </div>
        </div>
      </Card>

      {/* — Data tiles — */}
      <Card title="Metric tiles & grid" bleed>
        <div style={{ padding: "12px 18px 0" }}>
          <SectionHeader
            title="StatTile · MetricGrid"
            subtitle="KPI tiles with delta pills + sparklines, and the responsive grid that lays them out."
          />
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
            <div style={{ minWidth: 200, flex: "1 1 200px" }}>
              <StatTile
                label="Revenue"
                value="$48.2K"
                systemImage="dollarsign.circle.fill"
                tint="#34c759"
                delta={{ value: "12.4%", direction: "up" }}
                trend={[12, 14, 13, 18, 17, 22, 26]}
                caption="vs last week"
              />
            </div>
            <div style={{ minWidth: 200, flex: "1 1 200px" }}>
              <StatTile
                label="p95 latency"
                value="184 ms"
                systemImage="bolt.fill"
                tint="#ff9500"
                delta={{ value: "8.1%", direction: "down", invertColor: true }}
                trend={[260, 240, 232, 210, 198, 190, 184]}
                caption="lower is better"
              />
            </div>
          </div>

          <MetricGrid
            columns={4}
            metrics={[
              { label: "Users", value: "12,847", systemImage: "person.2.fill", tint: "#0a84ff", delta: { value: "3.2%", direction: "up" } },
              { label: "Sessions", value: "48.1K", systemImage: "chart.line.uptrend.xyaxis", tint: "#5856d6", delta: { value: "1.1%", direction: "up" } },
              { label: "Bounce", value: "21.4%", systemImage: "arrow.uturn.left", tint: "#ff2d55", delta: { value: "0.6%", direction: "down", invertColor: true } },
              { label: "Errors", value: "0.04%", systemImage: "exclamationmark.triangle.fill", tint: "#ff9500", delta: { value: "0.0%", direction: "neutral" } },
            ]}
          />
        </div>
      </Card>

      {/* — Settings + Profile + Banner — */}
      <Card title="Settings · Profile · Banner" bleed>
        <div style={{ padding: "12px 18px 0" }}>
          <SectionHeader
            title="SettingsGroup · ProfileCard · Banner"
            subtitle="Inset-grouped settings, a profile header card, and tinted/glass callouts."
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
            padding: 18,
            alignItems: "start",
          }}
        >
          <SettingsGroup
            header="Connectivity"
            footer="Join networks automatically when available."
            contentBackgroundHidden
            rows={[
              { systemImage: "wifi", iconColor: "#0a84ff", label: "Wi-Fi", trailing: { kind: "value", value: "Acme-5G" } },
              { systemImage: "antenna.radiowaves.left.and.right", iconColor: "#34c759", label: "Cellular", trailing: { kind: "chevron" } },
              { systemImage: "bell.fill", iconColor: "#ff3b30", label: "Notifications", trailing: { kind: "toggle", isOn: true, onChange: () => {} } },
            ]}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <ProfileCard
              name="Casey Fields"
              subtitle="casey@acme.co"
              detail="Design Engineer · San Francisco"
              initials="CF"
              actions={[
                { title: "Message", systemImage: "message.fill", buttonStyle: "borderedProminent" },
                { title: "Share", systemImage: "square.and.arrow.up" },
              ]}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Banner
                role="success"
                title="Backup complete"
                message="All 248 items are up to date."
              />
              <Banner
                role="warning"
                variant="glass"
                title="Storage almost full"
                message="You're using 92% of your plan."
                actionTitle="Upgrade"
                onAction={() => {}}
              />
            </div>
          </div>
        </div>
      </Card>
    </GallerySection>
  );
}
