"use client";
/**
 * SwiftUI-for-Web — the visual gallery. A single client page that wraps the whole
 * showcase in a <SwiftUIProvider> with a live color-scheme toggle + tint picker,
 * then renders one section per SwiftUI component cluster against an iOS
 * system-grouped background.
 */
import * as React from "react";
import { SwiftUIProvider } from "@/system/environment";
import type { ColorSchemePreference } from "@/system/types";

import { SectionTypography } from "./_gallery/SectionTypography";
import { SectionButtons } from "./_gallery/SectionButtons";
import { SectionControls } from "./_gallery/SectionControls";
import { SectionSelection } from "./_gallery/SectionSelection";
import { SectionTextInput } from "./_gallery/SectionTextInput";
import { SectionLayout } from "./_gallery/SectionLayout";
import { SectionLists } from "./_gallery/SectionLists";
import { SectionNavigation } from "./_gallery/SectionNavigation";
import { SectionPresentation } from "./_gallery/SectionPresentation";
import { SectionShapes } from "./_gallery/SectionShapes";
import { SectionMaterials } from "./_gallery/SectionMaterials";
import { SectionBlocks } from "./_gallery/SectionBlocks";
import { SectionCharts } from "./_gallery/SectionCharts";
import { SectionExtras } from "./_gallery/SectionExtras";

const SCHEMES: ColorSchemePreference[] = ["light", "dark", "system"];

const TINTS: { name: string; value: string }[] = [
  { name: "Blue", value: "#007aff" },
  { name: "Green", value: "#34c759" },
  { name: "Indigo", value: "#5856d6" },
  { name: "Orange", value: "#ff9500" },
  { name: "Pink", value: "#ff2d55" },
  { name: "Purple", value: "#af52de" },
  { name: "Red", value: "#ff3b30" },
  { name: "Teal", value: "#30b0c7" },
];

const NAV = [
  ["typography", "Type"],
  ["buttons", "Buttons"],
  ["controls", "Controls"],
  ["selection", "Selection"],
  ["textinput", "Text"],
  ["layout", "Layout"],
  ["lists", "Lists"],
  ["navigation", "Nav"],
  ["presentation", "Modals"],
  ["shapes", "Shapes"],
  ["materials", "Materials"],
  ["blocks", "Blocks"],
  ["charts", "Charts"],
  ["extras", "More"],
];

export default function Home(): React.ReactElement {
  const [scheme, setScheme] = React.useState<ColorSchemePreference>("light");
  const [tint, setTint] = React.useState<string>(TINTS[0].value);

  return (
    <SwiftUIProvider colorScheme={scheme} tint={tint}>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--sui-color-system-grouped-background)",
          color: "var(--sui-color-label)",
          fontFamily: "var(--sui-font-stack)",
        }}
      >
        {/* ---- sticky top bar ---- */}
        <header
          className="sui-material sui-material-bar sui-material-no-rim"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            borderBottom: "0.5px solid var(--sui-color-separator)",
            padding: "10px 20px",
          }}
        >
          <div
            style={{
              maxWidth: 980,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <strong
              style={{
                fontSize: "var(--sui-text-headline-size, 17px)",
                fontWeight: 700,
                marginRight: "auto",
              }}
            >
              SwiftUI for Web
            </strong>

            {/* scheme segmented control */}
            <div
              role="radiogroup"
              aria-label="Color scheme"
              style={{
                display: "inline-flex",
                background: "var(--sui-color-tertiary-system-fill)",
                borderRadius: 9,
                padding: 2,
              }}
            >
              {SCHEMES.map((s) => {
                const active = scheme === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setScheme(s)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      textTransform: "capitalize",
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      padding: "4px 12px",
                      borderRadius: 7,
                      color: "var(--sui-color-label)",
                      background: active
                        ? "var(--sui-color-secondary-system-grouped-background)"
                        : "transparent",
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            {/* tint swatches */}
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--sui-color-secondary-label)" }}>Tint</span>
              {TINTS.map((t) => {
                const active = tint === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-label={`Tint ${t.name}`}
                    aria-pressed={active}
                    onClick={() => setTint(t.value)}
                    title={t.name}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: t.value,
                      boxShadow: active
                        ? "0 0 0 2px var(--sui-color-system-background), 0 0 0 4px " + t.value
                        : "inset 0 0 0 1px rgba(0,0,0,0.1)",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* section jump nav */}
          <nav
            style={{
              maxWidth: 980,
              margin: "8px auto 0",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                style={{
                  fontSize: 12,
                  textDecoration: "none",
                  color: "var(--sui-color-tint)",
                  padding: "2px 8px",
                  borderRadius: 7,
                  background: "var(--sui-color-quaternary-system-fill)",
                }}
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        {/* ---- gallery body ---- */}
        <main
          style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: "28px 20px 96px",
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "var(--sui-text-largeTitle-size, 34px)",
                lineHeight: "var(--sui-text-largeTitle-lineHeight, 41px)",
                fontWeight: 700,
                letterSpacing: "0.37px",
              }}
            >
              Component Gallery
            </h1>
            <p style={{ margin: "6px 0 0", color: "var(--sui-color-secondary-label)" }}>
              Apple SwiftUI replicated 1:1 in TypeScript/React. Toggle the scheme and
              tint above; every control below is live.
            </p>
          </div>

          <SectionTypography />
          <SectionButtons />
          <SectionControls />
          <SectionSelection />
          <SectionTextInput />
          <SectionLayout />
          <SectionLists />
          <SectionNavigation />
          <SectionPresentation />
          <SectionShapes />
          <SectionMaterials />
          <SectionBlocks />
          <SectionCharts />
          <SectionExtras />
        </main>
      </div>
    </SwiftUIProvider>
  );
}
