"use client";
import * as React from "react";
import {
  Rectangle,
  RoundedRectangle,
  Circle,
  Capsule,
  Ellipse,
  Path,
  Canvas,
  LinearGradient,
  RadialGradient,
  AngularGradient,
} from "@sui";
import type { GraphicsContext2D } from "@/components/shapes/GraphicsContext";
import { GallerySection, Card, Cell, CellGrid } from "./chrome";

/** Fixed-size box so the ResizeObserver-measured shapes have dimensions. */
function Box({
  children,
  w = 88,
  h = 88,
  label,
}: {
  children: React.ReactNode;
  w?: number;
  h?: number;
  label?: string;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ width: w, height: h }}>{children}</div>
      {label ? (
        <span style={{ fontSize: 11, color: "var(--sui-color-secondary-label)" }}>{label}</span>
      ) : null}
    </div>
  );
}

const BLUE = "var(--sui-color-system-blue)";
const PURPLE = "var(--sui-color-system-purple)";

export function SectionShapes(): React.ReactElement {
  // A heart path traced in a 100×90 coordinate box.
  const heart =
    "M50 84 C18 60 4 42 4 26 C4 12 14 4 26 4 C36 4 44 10 50 20 C56 10 64 4 74 4 C86 4 96 12 96 26 C96 42 82 60 50 84 Z";

  const drawStar = React.useCallback((ctx: GraphicsContext2D, size: { width: number; height: number }) => {
    const cx = size.width / 2;
    const cy = size.height / 2;
    const R = Math.min(cx, cy) - 6;
    const r = R * 0.45;
    let d = "";
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const x = cx + rad * Math.cos(a);
      const y = cy + rad * Math.sin(a);
      d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    d += "Z";
    ctx.fill(d, {
      kind: "linearGradient",
      stops: [
        { color: "#ffcc00", location: 0 },
        { color: "#ff9500", location: 1 },
      ],
      start: { x: 0, y: 0 },
      end: { x: 0, y: size.height },
    });
  }, []);

  return (
    <GallerySection
      id="shapes"
      title="Shapes & Gradients"
      subtitle="Rectangle / RoundedRectangle (continuous squircle) / Circle / Capsule + gradients + Path/Canvas"
    >
      <Card title="Shapes">
        <CellGrid min={120}>
          <Box label="Rectangle">
            <Rectangle fill={BLUE} />
          </Box>
          <Box label="RoundedRect .continuous">
            <RoundedRectangle cornerRadius={20} cornerStyle="continuous" fill={PURPLE} />
          </Box>
          <Box label="RoundedRect .circular">
            <RoundedRectangle cornerRadius={20} cornerStyle="circular" fill="var(--sui-color-system-pink)" />
          </Box>
          <Box label="Circle">
            <Circle fill="var(--sui-color-system-green)" />
          </Box>
          <Box label="Ellipse" w={120}>
            <Ellipse fill="var(--sui-color-system-teal)" />
          </Box>
          <Box label="Capsule" w={120} h={48}>
            <Capsule fill="var(--sui-color-system-indigo)" />
          </Box>
          <Box label="stroked">
            <RoundedRectangle
              cornerRadius={20}
              fill="transparent"
              stroke={BLUE}
              strokeStyle={{ lineWidth: 3 }}
            />
          </Box>
        </CellGrid>
      </Card>

      <Card title="Gradients">
        <CellGrid min={120}>
          <Box label="LinearGradient">
            <div style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden" }}>
              <LinearGradient
                colors={["#34c759", "#007aff"]}
                startPoint="topLeading"
                endPoint="bottomTrailing"
              />
            </div>
          </Box>
          <Box label="RadialGradient">
            <div style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden" }}>
              <RadialGradient
                colors={["#ffcc00", "#ff3b30"]}
                center="center"
                startRadius={0}
                endRadius={60}
              />
            </div>
          </Box>
          <Box label="AngularGradient">
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
              <AngularGradient
                colors={["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#007aff", "#af52de", "#ff3b30"]}
                center="center"
              />
            </div>
          </Box>
        </CellGrid>
      </Card>

      <Card title="Path & Canvas">
        <CellGrid min={120}>
          <Box label="Path (heart)" w={100} h={90}>
            <Path d={heart} fill="var(--sui-color-system-red)" />
          </Box>
          <Box label="Canvas (gradient star)">
            <Canvas renderer={drawStar} />
          </Box>
        </CellGrid>
      </Card>
    </GallerySection>
  );
}
