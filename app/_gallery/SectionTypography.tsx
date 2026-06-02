"use client";
import * as React from "react";
import { Text } from "@sui";
import type { FontTextStyle, FontWeight } from "@/system/types";
import { GallerySection, Card, Cell } from "./chrome";

const STYLES: { style: FontTextStyle; label: string }[] = [
  { style: "largeTitle", label: "Large Title" },
  { style: "title", label: "Title" },
  { style: "title2", label: "Title 2" },
  { style: "title3", label: "Title 3" },
  { style: "headline", label: "Headline" },
  { style: "subheadline", label: "Subheadline" },
  { style: "body", label: "Body" },
  { style: "callout", label: "Callout" },
  { style: "footnote", label: "Footnote" },
  { style: "caption", label: "Caption" },
  { style: "caption2", label: "Caption 2" },
];

const WEIGHTS: FontWeight[] = [
  "ultraLight",
  "thin",
  "light",
  "regular",
  "medium",
  "semibold",
  "bold",
  "heavy",
  "black",
];

const FG: { color: string; label: string }[] = [
  { color: "label", label: "label" },
  { color: "secondaryLabel", label: "secondary" },
  { color: "tertiaryLabel", label: "tertiary" },
  { color: "tint", label: "tint" },
  { color: "red", label: "red" },
  { color: "green", label: "green" },
  { color: "orange", label: "orange" },
  { color: "purple", label: "purple" },
];

export function SectionTypography(): React.ReactElement {
  return (
    <GallerySection
      id="typography"
      title="Typography"
      subtitle="Text at every Font.TextStyle, weight, and foreground color"
    >
      <Card title="Text styles — largeTitle → caption2">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {STYLES.map(({ style, label }) => (
            <div
              key={style}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                borderBottom: "0.5px solid var(--sui-color-separator)",
                paddingBottom: 8,
              }}
            >
              <Text
                font="caption2"
                foregroundStyle="tertiaryLabel"
                monospaced
                style={{ width: 84, flexShrink: 0 }}
              >
                {style}
              </Text>
              <Text font={style}>{label}</Text>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Font weights (.fontWeight)">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {WEIGHTS.map((w) => (
            <div key={w} style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <Text
                font="caption2"
                foregroundStyle="tertiaryLabel"
                monospaced
                style={{ width: 84, flexShrink: 0 }}
              >
                {w}
              </Text>
              <Text font="title3" fontWeight={w}>
                The quick brown fox
              </Text>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Foreground colors (.foregroundStyle)">
        <Cell>
          {FG.map(({ color, label }) => (
            <Text key={label} font="headline" foregroundStyle={color}>
              {label}
            </Text>
          ))}
        </Cell>
      </Card>

      <Card title="Emphasis & decoration">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          <Text font="body" bold>
            Bold
          </Text>
          <Text font="body" italic>
            Italic
          </Text>
          <Text font="body" underline>
            Underline
          </Text>
          <Text font="body" strikethrough>
            Strikethrough
          </Text>
          <Text font="body" monospaced>
            Monospaced 0123
          </Text>
          <Text font="body" design="rounded">
            Rounded design
          </Text>
          <Text font="body" design="serif">
            Serif design
          </Text>
          <Text font="body" tracking={3}>
            T R A C K I N G
          </Text>
          <Text
            font="body"
            markdown="Inline **markdown** with `code`, *italics*, and a [link](#typography)."
          />
        </div>
      </Card>
    </GallerySection>
  );
}
