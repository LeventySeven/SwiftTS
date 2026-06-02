"use client";
/**
 * `<SettingsScreen>` — a 1:1 iOS Settings clone, composed entirely from the kit.
 *
 * Chrome:  `<NavigationStack rootTitle="Settings">` gives the large-title nav bar
 *          that scrubs to inline on scroll, plus the floating Liquid-Glass bar in
 *          iOS-26 design mode. `<NavigationBarConfig navigationTitle="Settings">`
 *          names the screen.
 * Body:    one `<List listStyle="insetGrouped">` — the Settings engine itself.
 *          Inset-grouped cards on the systemGroupedBackground page, 16pt-leading
 *          interior separators, 35pt section gaps — exactly the Settings look.
 * Rows:    `<ListRow>` in its clean prop API:
 *            • the account profile row (large avatar + name + subtitle + chevron),
 *            • toggle rows (Wi-Fi / Bluetooth / Notifications) via `trailing=<Toggle>`,
 *            • a slider row (brightness) via free-form children,
 *            • value rows + disclosure (chevron) rows that "push".
 *
 * Pure composition: no bespoke row markup beyond the slider cell — `ListRow`'s
 * prop API draws the icon chip, label, value, trailing control, and chevron.
 *
 * Client component: it owns the toggle/slider state.
 */
import * as React from "react";
import { NavigationStack } from "../../components/navigation/NavigationStack";
import { NavigationBarConfig } from "../../components/navigation/Toolbar";
import { List } from "../../components/List";
import { ListRow } from "../../components/List/ListRow";
import { Section } from "../../components/layout/Section";
import { Toggle } from "../../components/Toggle";
import { Slider } from "../../components/Slider";
import { Text } from "../../components/Text";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./screens.module.css";

/** A tinted 29×29 rounded SF-symbol chip — the canonical Settings row icon. */
function SettingIcon({
  symbol,
  tint,
}: {
  symbol: string;
  tint: string;
}): React.ReactElement {
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
      <SymbolGlyph name={symbol} size={17} color="#fff" weight="semibold" />
    </span>
  );
}

export interface SettingsScreenProps {
  /** Account row — the big profile header at the top. */
  account?: { name: string; subtitle?: string; initials?: string };
}

export function SettingsScreen({
  account = { name: "Craig Federighi", subtitle: "Apple ID, iCloud & Purchases", initials: "CF" },
}: SettingsScreenProps = {}): React.ReactElement {
  const [wifi, setWifi] = React.useState(true);
  const [bluetooth, setBluetooth] = React.useState(true);
  const [notifications, setNotifications] = React.useState(false);
  const [airplane, setAirplane] = React.useState(false);
  const [brightness, setBrightness] = React.useState(0.72);
  const [volume, setVolume] = React.useState(0.55);

  return (
    <div className={styles.scene}>
      <NavigationStack rootTitle="Settings">
        <NavigationBarConfig navigationTitle="Settings" />

        <List listStyle="insetGrouped">
          {/* ── Account header card ── */}
          <Section>
            <ListRow
              accessory="chevron"
              onTap={() => {}}
              leading={
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    inlineSize: 56,
                    blockSize: 56,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, var(--sui-color-system-blue), var(--sui-color-system-indigo))",
                    color: "#fff",
                    fontSize: 24,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {account.initials ?? account.name.slice(0, 1)}
                </span>
              }
              leadingAsIcon={false}
              label={
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    minInlineSize: 0,
                  }}
                >
                  <Text font="title3" foregroundStyle="label" style={{ fontWeight: 600 }}>
                    {account.name}
                  </Text>
                  {account.subtitle ? (
                    <Text
                      font="footnote"
                      foregroundStyle="secondaryLabel"
                      style={{ display: "block", lineHeight: 1.25 }}
                    >
                      {account.subtitle}
                    </Text>
                  ) : null}
                </span>
              }
            />
          </Section>

          {/* ── Connectivity toggles ── */}
          <Section footer="Notifications are paused while Focus is on.">
            <ListRow
              leading={<SettingIcon symbol="airplane" tint="var(--sui-color-system-orange)" />}
              label="Airplane Mode"
              trailing={<Toggle isOn={airplane} onChange={setAirplane} labelsHidden />}
            />
            <ListRow
              leading={<SettingIcon symbol="wifi" tint="var(--sui-color-system-blue)" />}
              label="Wi-Fi"
              value={wifi ? "Home-5G" : "Off"}
              trailing={<Toggle isOn={wifi} onChange={setWifi} labelsHidden />}
            />
            <ListRow
              leading={
                <SettingIcon symbol="dot.radiowaves.left.and.right" tint="var(--sui-color-system-blue)" />
              }
              label="Bluetooth"
              value={bluetooth ? "On" : "Off"}
              trailing={<Toggle isOn={bluetooth} onChange={setBluetooth} labelsHidden />}
            />
            <ListRow
              leading={<SettingIcon symbol="bell.badge.fill" tint="var(--sui-color-system-red)" />}
              label="Notifications"
              trailing={<Toggle isOn={notifications} onChange={setNotifications} labelsHidden />}
            />
          </Section>

          {/* ── Sliders (brightness + volume) ── */}
          <Section header="Display & Sound">
            <ListRow>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  inlineSize: "100%",
                }}
              >
                <SettingIcon symbol="sun.max.fill" tint="var(--sui-color-system-yellow)" />
                <span style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  <Text font="body" foregroundStyle="label">
                    Brightness
                  </Text>
                  <Slider value={brightness} onChange={setBrightness} bounds={[0, 1]} />
                </span>
              </span>
            </ListRow>
            <ListRow>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  inlineSize: "100%",
                }}
              >
                <SettingIcon symbol="speaker.wave.2.fill" tint="var(--sui-color-system-pink)" />
                <span style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  <Text font="body" foregroundStyle="label">
                    Volume
                  </Text>
                  <Slider value={volume} onChange={setVolume} bounds={[0, 1]} />
                </span>
              </span>
            </ListRow>
          </Section>

          {/* ── Disclosure / value rows that push ── */}
          <Section>
            <ListRow
              leading={<SettingIcon symbol="gearshape.fill" tint="var(--sui-color-system-gray)" />}
              label="General"
              accessory="chevron"
              onTap={() => {}}
            />
            <ListRow
              leading={<SettingIcon symbol="lock.fill" tint="var(--sui-color-system-blue)" />}
              label="Privacy & Security"
              accessory="chevron"
              onTap={() => {}}
            />
            <ListRow
              leading={<SettingIcon symbol="person.crop.circle.fill" tint="var(--sui-color-system-green)" />}
              label="Screen Time"
              value="2h 14m"
              accessory="chevron"
              onTap={() => {}}
            />
            <ListRow
              leading={<SettingIcon symbol="battery.100" tint="var(--sui-color-system-green)" />}
              label="Battery"
              value="86%"
              accessory="chevron"
              onTap={() => {}}
            />
          </Section>

          {/* ── App settings ── */}
          <Section header="Apps" footer="SwiftTS Settings — composed from kit primitives.">
            <ListRow
              leading={<SettingIcon symbol="message.fill" tint="var(--sui-color-system-green)" />}
              label="Messages"
              badge={12}
              accessory="chevron"
              onTap={() => {}}
            />
            <ListRow
              leading={<SettingIcon symbol="map.fill" tint="var(--sui-color-system-blue)" />}
              label="Maps"
              accessory="chevron"
              onTap={() => {}}
            />
            <ListRow
              leading={<SettingIcon symbol="photo.fill" tint="var(--sui-color-system-teal)" />}
              label="Photos"
              accessory="chevron"
              onTap={() => {}}
            />
          </Section>
        </List>
      </NavigationStack>
    </div>
  );
}

SettingsScreen.displayName = "SettingsScreen";
