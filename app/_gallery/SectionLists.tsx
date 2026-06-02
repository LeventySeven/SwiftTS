"use client";
import * as React from "react";
import { List, ListRowWithSlots as Row, Form, FormRow, Toggle, Stepper, DisclosureGroup, Text } from "@sui";
// The list-card `Section` (paints the grouped card chrome) — distinct from the
// layout-cluster `Section` that the barrel exports as the canonical `Section`.
import { Section as ListSection } from "@/components/Section/Section";
import type { ListStyleName } from "@/system/styles";
import { GallerySection, Card } from "./chrome";

function ListDemo({ style }: { style: ListStyleName }): React.ReactElement {
  const [notifications, setNotifications] = React.useState(true);
  return (
    <List listStyle={style}>
      {/* Account — LabeledContent-style rows: leading label + trailing secondary value */}
      <ListSection header="Account" footer="Manage how you appear to others.">
        <Row label="Name" value="Craig F." accessory="chevron" onTap={() => {}} />
        <Row
          leading="✉️"
          label="Email"
          value="craig@apple.com"
          accessory="chevron"
          onTap={() => {}}
        />
        {/* Toggle row: the switch sits at the trailing edge on the SAME row */}
        <Row
          leading="🔔"
          label="Notifications"
          trailing={
            <Toggle isOn={notifications} onChange={setNotifications} />
          }
        />
      </ListSection>

      {/* Storage — a disclosure row + swipe-to-delete */}
      <ListSection header="Storage" footer="Swipe a row left to reveal Delete.">
        <Row
          label="Storage"
          value="64.0 GB"
          accessory="chevron"
          onTap={() => {}}
        />
        <Row
          label="Photos"
          value="12.4 GB"
          swipeActions={{
            trailing: [{ label: "Delete", role: "destructive" }],
          }}
        />
        <Row label="Documents" value="3.1 GB" />
      </ListSection>
    </List>
  );
}

export function SectionLists(): React.ReactElement {
  const [wifi, setWifi] = React.useState(true);
  const [count, setCount] = React.useState(2);

  return (
    <GallerySection
      id="lists"
      title="Lists & Forms"
      subtitle="List styles, Section, Form rows, DisclosureGroup — swipe a row to reveal Delete"
    >
      <Card title="insetGrouped list (with swipe-to-delete)" bleed>
        <div style={{ padding: "8px 0" }}>
          <ListDemo style="insetGrouped" />
        </div>
      </Card>

      <Card title="grouped list" bleed>
        <div style={{ padding: "8px 0" }}>
          <ListDemo style="grouped" />
        </div>
      </Card>

      <Card title="plain & inset list" bleed>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div style={{ padding: "8px 0" }}>
            <Text font="caption2" foregroundStyle="tertiaryLabel" style={{ paddingLeft: 16 }}>
              .plain
            </Text>
            <ListDemo style="plain" />
          </div>
          <div style={{ padding: "8px 0" }}>
            <Text font="caption2" foregroundStyle="tertiaryLabel" style={{ paddingLeft: 16 }}>
              .inset
            </Text>
            <ListDemo style="inset" />
          </div>
        </div>
      </Card>

      <Card title="Form" bleed>
        <div style={{ padding: "8px 0" }}>
          <Form>
            <ListSection header="General">
              <FormRow label="Wi-Fi">
                <Toggle isOn={wifi} onChange={setWifi} />
              </FormRow>
              <FormRow label="Devices">
                <Stepper value={count} onChange={setCount} bounds={[0, 8]} format={(v) => String(v)} />
              </FormRow>
              <FormRow label="Software Update" onTap={() => {}} showsChevron>
                <Text font="body" foregroundStyle="secondaryLabel">
                  iOS 26.1
                </Text>
              </FormRow>
            </ListSection>
          </Form>
        </div>
      </Card>

      <Card title="DisclosureGroup">
        <DisclosureGroup title="Advanced Options" defaultExpanded>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
            <Text font="subheadline">Developer Mode enabled</Text>
            <Text font="footnote" foregroundStyle="secondaryLabel">
              Reveals extra diagnostic toggles and logging.
            </Text>
          </div>
        </DisclosureGroup>
        <DisclosureGroup title="Privacy">
          <Text font="footnote" foregroundStyle="secondaryLabel" style={{ paddingTop: 8 }}>
            Location, analytics, and tracking permissions.
          </Text>
        </DisclosureGroup>
      </Card>
    </GallerySection>
  );
}
