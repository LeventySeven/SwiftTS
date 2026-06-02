"use client";
import * as React from "react";
import {
  VStack,
  HStack,
  ZStack,
  Spacer,
  Divider,
  Grid,
  GridRow,
  LazyVGrid,
  GridItem,
  Text,
} from "@sui";
import { GallerySection, Card, Cell } from "./chrome";

function Swatch({
  color,
  label,
  w = 56,
  h = 56,
}: {
  color: string;
  label?: string;
  w?: number;
  h?: number;
}): React.ReactElement {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}
    </div>
  );
}

const PALETTE = [
  "var(--sui-color-system-red)",
  "var(--sui-color-system-orange)",
  "var(--sui-color-system-yellow)",
  "var(--sui-color-system-green)",
  "var(--sui-color-system-teal)",
  "var(--sui-color-system-blue)",
  "var(--sui-color-system-indigo)",
  "var(--sui-color-system-purple)",
  "var(--sui-color-system-pink)",
];

export function SectionLayout(): React.ReactElement {
  return (
    <GallerySection
      id="layout"
      title="Layout"
      subtitle="VStack / HStack / ZStack, Grid, LazyVGrid, Spacer, Divider"
    >
      <Card title="Stacks (alignment + spacing)">
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
          <Cell label="VStack (leading, 8)">
            <VStack alignment="leading" spacing={8}>
              <Swatch color={PALETTE[5]} label="1" w={120} h={32} />
              <Swatch color={PALETTE[3]} label="2" w={80} h={32} />
              <Swatch color={PALETTE[1]} label="3" w={150} h={32} />
            </VStack>
          </Cell>
          <Cell label="HStack (center, 12)">
            <HStack alignment="center" spacing={12}>
              <Swatch color={PALETTE[0]} label="A" w={40} h={60} />
              <Swatch color={PALETTE[5]} label="B" w={40} h={40} />
              <Swatch color={PALETTE[7]} label="C" w={40} h={80} />
            </HStack>
          </Cell>
          <Cell label="ZStack (bottomTrailing)">
            <ZStack alignment="bottomTrailing">
              <Swatch color={PALETTE[6]} w={110} h={90} />
              <Swatch color={PALETTE[2]} w={56} h={56} />
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  margin: 6,
                  background: "var(--sui-color-system-red)",
                  border: "2px solid #fff",
                }}
              />
            </ZStack>
          </Cell>
        </div>
      </Card>

      <Card title="Spacer & Divider">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <HStack alignment="center" spacing={0}>
            <Text font="subheadline">Leading</Text>
            <Spacer />
            <Text font="subheadline" foregroundStyle="secondaryLabel">
              Trailing
            </Text>
          </HStack>
          <Divider />
          <HStack alignment="center" spacing={12}>
            <Text font="footnote">Item one</Text>
            <Divider axis="vertical" style={{ height: 16 }} />
            <Text font="footnote">Item two</Text>
            <Divider axis="vertical" style={{ height: 16 }} />
            <Text font="footnote">Item three</Text>
          </HStack>
        </div>
      </Card>

      <Card title="Grid (fixed 3-column)">
        <Grid columns={3} alignment="center">
          <GridRow>
            <Swatch color={PALETTE[0]} label="1,1" />
            <Swatch color={PALETTE[1]} label="1,2" />
            <Swatch color={PALETTE[2]} label="1,3" />
          </GridRow>
          <GridRow>
            <Swatch color={PALETTE[3]} label="2,1" />
            <Swatch color={PALETTE[4]} label="2,2" />
            <Swatch color={PALETTE[5]} label="2,3" />
          </GridRow>
        </Grid>
      </Card>

      <Card title="LazyVGrid (adaptive)">
        <LazyVGrid columns={[GridItem.adaptive(64)]} spacing={12}>
          {PALETTE.map((c, i) => (
            <Swatch key={i} color={c} label={String(i + 1)} w={64} h={64} />
          ))}
        </LazyVGrid>
      </Card>
    </GallerySection>
  );
}
