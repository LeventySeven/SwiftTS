"use client";
/**
 * `<ProfileScreen>` — a profile / account screen with a glass tab bar.
 *
 * Structure:  a `<TabView>` (the iOS-26 floating Liquid-Glass tab bar by default)
 *             whose first tab hosts the profile:
 *               • ProfileHeader — circular avatar, name, @handle, bio,
 *               • a stat row (Posts / Followers / Following) with hairline dividers,
 *               • a primary "Follow" + secondary "Message" action row,
 *               • grouped `<List>` sections (About / Activity) of value + chevron
 *                 rows, exactly the Settings-grouped look.
 *             The other tabs are stubs so the glass tab bar morphs between them.
 *
 * Composes from the kit: `<TabView>/<Tab>` (glass bar + morphing highlight),
 * `<List>/<ListRow>/<Section>` (grouped cards), `<SymbolGlyph>` (icons), tokens.
 * Client component — owns the selected-tab state.
 */
import * as React from "react";
import { TabView } from "../../components/navigation/TabView";
import { Tab } from "../../components/navigation/Tab";
import { List } from "../../components/List";
import { ListRow } from "../../components/List/ListRow";
import { Section } from "../../components/layout/Section";
import { Text } from "../../components/Text";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./screens.module.css";

interface Stat {
  value: string;
  label: string;
}

function RowIcon({ symbol, tint }: { symbol: string; tint: string }): React.ReactElement {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        inlineSize: 29,
        blockSize: 29,
        borderRadius: 7,
        background: tint,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      <SymbolGlyph name={symbol} size={16} color="#fff" weight="semibold" />
    </span>
  );
}

export interface ProfileScreenProps {
  name?: string;
  handle?: string;
  bio?: string;
  initials?: string;
  avatarUrl?: string;
  stats?: [Stat, Stat, Stat];
}

const DEFAULT_STATS: [Stat, Stat, Stat] = [
  { value: "248", label: "Posts" },
  { value: "12.4K", label: "Followers" },
  { value: "318", label: "Following" },
];

function ProfileBody({
  name,
  handle,
  bio,
  initials,
  avatarUrl,
  stats,
}: Required<Omit<ProfileScreenProps, "avatarUrl">> & { avatarUrl?: string }): React.ReactElement {
  const [following, setFollowing] = React.useState(false);

  return (
    <div className={styles.scene} style={{ background: "var(--sui-color-system-grouped-background)" }}>
      <div className={styles.body}>
        {/* ── Profile header ── */}
        <div className={styles.profileHero}>
          <span
            className={styles.avatar}
            style={
              avatarUrl
                ? { backgroundImage: `url(${avatarUrl})` }
                : { background: "linear-gradient(135deg, var(--sui-color-system-teal), var(--sui-color-system-blue))" }
            }
          >
            {avatarUrl ? "" : initials}
          </span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span className={styles.profileName}>{name}</span>
            <span className={styles.profileHandle}>{handle}</span>
          </div>
          <p className={styles.profileBio}>{bio}</p>

          {/* stat row */}
          <div className={styles.statRow}>
            {stats.map((s) => (
              <div className={styles.statCell} key={s.label}>
                <span className={styles.statCellValue}>{s.value}</span>
                <span className={styles.statCellLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* primary / secondary actions */}
        <div className={styles.actionRow}>
          <button
            className={following ? styles.secondaryBtn : styles.primaryBtn}
            onClick={() => setFollowing((f) => !f)}
          >
            {following ? "Following" : "Follow"}
          </button>
          <button className={styles.secondaryBtn}>Message</button>
        </div>

        {/* ── Grouped sections ── */}
        <List listStyle="insetGrouped">
          <Section header="About">
            <ListRow
              leading={<RowIcon symbol="location.fill" tint="var(--sui-color-system-red)" />}
              label="Location"
              value="Cupertino, CA"
            />
            <ListRow
              leading={<RowIcon symbol="envelope.fill" tint="var(--sui-color-system-blue)" />}
              label="Email"
              value="craig@apple.com"
            />
            <ListRow
              leading={<RowIcon symbol="calendar.badge.plus" tint="var(--sui-color-system-orange)" />}
              label="Joined"
              value="Jun 2011"
            />
          </Section>

          <Section header="Activity">
            <ListRow
              leading={<RowIcon symbol="heart.fill" tint="var(--sui-color-system-pink)" />}
              label="Likes"
              value="48.1K"
              accessory="chevron"
              onTap={() => {}}
            />
            <ListRow
              leading={<RowIcon symbol="bookmark.fill" tint="var(--sui-color-system-yellow)" />}
              label="Saved"
              value="312"
              accessory="chevron"
              onTap={() => {}}
            />
            <ListRow
              leading={<RowIcon symbol="star.fill" tint="var(--sui-color-system-indigo)" />}
              label="Highlights"
              accessory="chevron"
              onTap={() => {}}
            />
          </Section>

          <Section header="Settings" footer="Composed from SwiftTS — TabView glass bar + grouped List.">
            <ListRow
              leading={<RowIcon symbol="bell.fill" tint="var(--sui-color-system-red)" />}
              label="Notifications"
              accessory="chevron"
              onTap={() => {}}
            />
            <ListRow
              leading={<RowIcon symbol="lock.fill" tint="var(--sui-color-system-gray)" />}
              label="Privacy"
              accessory="chevron"
              onTap={() => {}}
            />
          </Section>
        </List>
      </div>
    </div>
  );
}

export function ProfileScreen({
  name = "Craig Federighi",
  handle = "@craig",
  bio = "Software engineering. Hair force one. Building the things you tap every day.",
  initials = "CF",
  avatarUrl,
  stats = DEFAULT_STATS,
}: ProfileScreenProps = {}): React.ReactElement {
  const [tab, setTab] = React.useState("profile");

  return (
    <div className={styles.scene}>
      <TabView selection={tab} onSelectionChange={(value) => setTab(value as string)}>
        <Tab value="home" title="Home" systemImage="house.fill">
          <div style={{ padding: 24, paddingTop: 64 }}>
            <Text font="largeTitle" style={{ fontWeight: 700 }}>
              Home
            </Text>
            <Text
              font="body"
              foregroundStyle="secondaryLabel"
              style={{ display: "block", marginTop: 8 }}
            >
              Your feed. Tap Profile in the glass tab bar below.
            </Text>
          </div>
        </Tab>

        <Tab value="search" title="Search" systemImage="magnifyingglass" role="search">
          <div style={{ padding: 24, paddingTop: 64 }}>
            <Text font="largeTitle" style={{ fontWeight: 700 }}>
              Search
            </Text>
          </div>
        </Tab>

        <Tab value="profile" title="Profile" systemImage="person.crop.circle.fill">
          <ProfileBody
            name={name}
            handle={handle}
            bio={bio}
            initials={initials}
            avatarUrl={avatarUrl}
            stats={stats}
          />
        </Tab>

        <Tab value="settings" title="Settings" systemImage="gearshape.fill">
          <div style={{ padding: 24, paddingTop: 64 }}>
            <Text font="largeTitle" style={{ fontWeight: 700 }}>
              Settings
            </Text>
          </div>
        </Tab>
      </TabView>
    </div>
  );
}

ProfileScreen.displayName = "ProfileScreen";
