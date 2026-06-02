"use client";
import * as React from "react";
import {
  NavigationStack,
  NavigationLink,
  NavigationBarConfig,
  Toolbar,
  ToolbarItem,
  TabView,
  Tab,
  Text,
} from "@sui";
import { GallerySection, Card } from "./chrome";

/** A phone-shaped frame so the self-contained nav/tab containers have a height. */
function PhoneFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        width: 300,
        height: 540,
        borderRadius: 36,
        overflow: "hidden",
        border: "8px solid #1c1c1e",
        boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
        background: "var(--sui-color-system-background)",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

interface Contact {
  name: string;
  role: string;
}

const CONTACTS: Contact[] = [
  { name: "Tim Cook", role: "CEO" },
  { name: "Craig Federighi", role: "SVP Software" },
  { name: "Johny Srouji", role: "SVP Hardware" },
  { name: "Susan Prescott", role: "VP Developer" },
  { name: "Greg Joswiak", role: "SVP Marketing" },
];

function DetailScreen({ contact }: { contact: Contact }): React.ReactElement {
  return (
    <div style={{ padding: 16 }}>
      <NavigationBarConfig navigationTitle={contact.name} />
      <Text font="body">{contact.role}</Text>
      <Text font="footnote" foregroundStyle="secondaryLabel" style={{ display: "block", marginTop: 8 }}>
        Swipe from the left edge — or tap Back — to return.
      </Text>
    </div>
  );
}

function NavDemo(): React.ReactElement {
  return (
    <NavigationStack rootTitle="People">
      <NavigationBarConfig navigationTitle="People" />
      <Toolbar>
        <ToolbarItem placement="primaryAction" systemImage="plus" />
      </Toolbar>
      {/* contacts List — each NavigationLink is a List row that pushes a detail */}
      <div className="sui-navlist">
        {CONTACTS.map((c) => (
          <NavigationLink
            key={c.name}
            destination={<DetailScreen contact={c} />}
            title="People"
            detail={c.role}
          >
            {c.name}
          </NavigationLink>
        ))}
      </div>
    </NavigationStack>
  );
}

function TabDemo(): React.ReactElement {
  const [tab, setTab] = React.useState("home");
  return (
    <TabView selection={tab} onSelectionChange={(v) => setTab(v as string)}>
      <Tab value="home" title="Home" systemImage="house">
        <div style={{ padding: 24, paddingTop: 60 }}>
          <Text font="title">Home</Text>
          <Text font="body" foregroundStyle="secondaryLabel" style={{ display: "block", marginTop: 8 }}>
            The first tab’s content. Tap a tab below to switch.
          </Text>
        </div>
      </Tab>
      <Tab value="search" title="Search" systemImage="magnifyingglass" role="search">
        <div style={{ padding: 24, paddingTop: 60 }}>
          <Text font="title">Search</Text>
        </div>
      </Tab>
      <Tab value="alerts" title="Alerts" systemImage="bell" badge={3}>
        <div style={{ padding: 24, paddingTop: 60 }}>
          <Text font="title">Alerts</Text>
          <Text font="body" foregroundStyle="secondaryLabel" style={{ display: "block", marginTop: 8 }}>
            3 unread — note the red badge on the tab.
          </Text>
        </div>
      </Tab>
      <Tab value="profile" title="Profile" systemImage="person">
        <div style={{ padding: 24, paddingTop: 60 }}>
          <Text font="title">Profile</Text>
        </div>
      </Tab>
    </TabView>
  );
}

export function SectionNavigation(): React.ReactElement {
  return (
    <GallerySection
      id="navigation"
      title="Navigation"
      subtitle="NavigationStack with title + toolbar, and a TabView bottom bar"
    >
      <Card title="NavigationStack + TabView">
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <div>
            <Text font="caption2" foregroundStyle="tertiaryLabel" style={{ display: "block", marginBottom: 8 }}>
              NavigationStack — tap a row to push
            </Text>
            <PhoneFrame>
              <NavDemo />
            </PhoneFrame>
          </div>
          <div>
            <Text font="caption2" foregroundStyle="tertiaryLabel" style={{ display: "block", marginBottom: 8 }}>
              TabView — bottom tab bar
            </Text>
            <PhoneFrame>
              <TabDemo />
            </PhoneFrame>
          </div>
        </div>
      </Card>
    </GallerySection>
  );
}
