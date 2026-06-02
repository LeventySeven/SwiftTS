"use client";
/**
 * SectionAppleApps — the "macOS & Apple Apps" gallery section.
 *
 * Three macOS-platform surfaces, each in its own sized desktop frame and wrapped
 * in a <SwiftUIProvider platform="macOS" designMode="liquidGlass"> so the macOS
 * vibrancy / traffic-light / unified-toolbar tokens resolve even though the page
 * itself is an iOS subtree:
 *
 *   1. <WindowChrome/>   — the bare macOS window frame (traffic lights + unified
 *      toolbar + centered title), hosting a <MacSplitView>/<MacSidebar> body so
 *      the chrome is shown doing real work.
 *   2. <AppleMusicApp/>  — the full Apple Music desktop template.
 *   3. <AppleNotesApp/>  — the full Apple Notes three-column template.
 *
 * Everything is imported from the BLOCKS barrel (`@/blocks` → `src/blocks`).
 */
import * as React from "react";
import {
  WindowChrome,
  MacSplitView,
  MacSidebar,
  ToolbarIconButton,
  ToolbarSearchField,
  AppleMusicApp,
  AppleNotesApp,
} from "@/blocks";
import { SwiftUIProvider } from "@/system/environment";
import { GallerySection, SectionHeader, Card } from "./chrome";

/* ────────────────────────────────────────────────────────────────────────── *
 *  DesktopFrame — a sized, scroll-clipped well a macOS surface lives inside,
 *  always rendered under a macOS-platform Liquid-Glass provider so the surface's
 *  vibrancy/selection/toolbar classes resolve on this otherwise-iOS page.
 * ────────────────────────────────────────────────────────────────────────── */
function DesktopFrame({
  label,
  width,
  height,
  children,
}: {
  label: string;
  width: number;
  height: number;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      <SwiftUIProvider
        platform="macOS"
        designMode="liquidGlass"
        applyToDocument={false}
      >
        <div
          style={{
            // a soft "desktop wallpaper" the window casts its shadow onto
            width: "100%",
            maxWidth: width + 56,
            padding: 28,
            borderRadius: 18,
            overflow: "auto",
            background:
              "radial-gradient(130% 130% at 14% 6%, #4a6cf7 0, transparent 52%)," +
              "radial-gradient(120% 120% at 92% 10%, #c64bd6 0, transparent 50%)," +
              "linear-gradient(150deg, #2b2f6b 0%, #1a1140 60%, #0c0a1f 100%)",
          }}
        >
          <div style={{ width, maxWidth: "100%", height, margin: "0 auto" }}>
            {children}
          </div>
        </div>
      </SwiftUIProvider>
      <figcaption
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--sui-color-secondary-label)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {label}
      </figcaption>
    </figure>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

export function SectionAppleApps(): React.ReactElement {
  const [tab, setTab] = React.useState("recents");
  const [search, setSearch] = React.useState("");

  return (
    <GallerySection
      id="apple-apps"
      title="macOS & Apple Apps"
      subtitle="macOS window chrome + the Apple Music and Apple Notes desktop templates, built only from the kit"
    >
      {/* ============================ WINDOW CHROME ============================ */}
      <Card title="macOS window chrome" bleed>
        <div style={{ padding: "12px 18px 0" }}>
          <SectionHeader
            title="<WindowChrome/>"
            subtitle="The desktop window frame — traffic lights, a unified toolbar (icon buttons + search field), a centered title — wrapping a MacSplitView source-list body."
          />
        </div>
        <div style={{ padding: "0 18px 18px" }}>
          <DesktopFrame label="<WindowChrome/> + <MacSplitView/>" width={760} height={460}>
            <WindowChrome
              title="Finder"
              subtitle="Documents"
              embedded
              toolbarLeading={
                <>
                  <ToolbarIconButton systemImage="chevron.left" label="Back" />
                  <ToolbarIconButton systemImage="chevron.right" label="Forward" disabled />
                </>
              }
              toolbarTrailing={
                <>
                  <ToolbarIconButton systemImage="square.grid.2x2" label="Icon view" />
                  <ToolbarIconButton systemImage="list.bullet" label="List view" active />
                  <ToolbarSearchField
                    value={search}
                    onChange={setSearch}
                    placeholder="Search"
                    width={170}
                  />
                </>
              }
            >
              <MacSplitView
                defaultSidebarWidth={210}
                sidebar={
                  <MacSidebar
                    selection={tab}
                    onSelect={setTab}
                    sections={[
                      {
                        title: "Favorites",
                        items: [
                          { id: "recents", label: "Recents", systemImage: "clock" },
                          { id: "airdrop", label: "AirDrop", systemImage: "dot.radiowaves.left.and.right" },
                          { id: "apps", label: "Applications", systemImage: "square.grid.3x3.fill" },
                          { id: "desktop", label: "Desktop", systemImage: "menubar.dock.rectangle" },
                          { id: "docs", label: "Documents", systemImage: "doc", count: 128 },
                        ],
                      },
                      {
                        title: "iCloud",
                        collapsible: true,
                        items: [
                          { id: "drive", label: "iCloud Drive", systemImage: "icloud" },
                          { id: "shared", label: "Shared", systemImage: "person.2" },
                        ],
                      },
                      {
                        title: "Tags",
                        collapsible: true,
                        items: [
                          { id: "red", label: "Red", systemImage: "circle.fill" },
                          { id: "blue", label: "Blue", systemImage: "circle.fill" },
                        ],
                      },
                    ]}
                  />
                }
              >
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    textAlign: "center",
                    color: "var(--sui-color-secondary-label)",
                    background: "var(--sui-color-system-background)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--sui-color-label)" }}>
                      Content area
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      Selected: <code>{tab}</code> · drag the divider to resize the source list.
                    </div>
                  </div>
                </div>
              </MacSplitView>
            </WindowChrome>
          </DesktopFrame>
        </div>
      </Card>

      {/* ============================ APPLE MUSIC ============================ */}
      <Card title="Apple Music" bleed>
        <div style={{ padding: "12px 18px 0" }}>
          <SectionHeader
            title="<AppleMusicApp/>"
            subtitle="The full Apple Music desktop window — vibrant nav sidebar, album shelves, and the pinned now-playing transport bar."
          />
        </div>
        <div style={{ padding: "0 18px 18px" }}>
          <DesktopFrame label="<AppleMusicApp/>" width={1000} height={640}>
            <AppleMusicApp />
          </DesktopFrame>
        </div>
      </Card>

      {/* ============================ APPLE NOTES ============================ */}
      <Card title="Apple Notes" bleed>
        <div style={{ padding: "12px 18px 0" }}>
          <SectionHeader
            title="<AppleNotesApp/>"
            subtitle="The full Apple Notes three-column template — FOLDERS · NOTES · EDITOR — with the Notes-yellow accent threaded throughout."
          />
        </div>
        <div style={{ padding: "0 18px 18px" }}>
          <DesktopFrame label="<AppleNotesApp/>" width={1000} height={640}>
            <AppleNotesApp />
          </DesktopFrame>
        </div>
      </Card>
    </GallerySection>
  );
}
