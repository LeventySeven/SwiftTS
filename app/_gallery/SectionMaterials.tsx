"use client";
import * as React from "react";
import {
  MaterialView,
  Vibrant,
  Text,
  Button,
  GlassEffect,
  GlassEffectContainer,
  glass,
} from "@sui";
import type { MaterialLevel } from "@/system/effects";
import { GallerySection, Card } from "./chrome";

const LEVELS: { level: MaterialLevel; label: string }[] = [
  { level: "ultraThin", label: ".ultraThinMaterial" },
  { level: "thin", label: ".thinMaterial" },
  { level: "regular", label: ".regularMaterial" },
  { level: "thick", label: ".thickMaterial" },
  { level: "ultraThick", label: ".ultraThickMaterial" },
];

/* A vivid, photo-like backdrop so the live refraction is unmistakable: a warm
   sunset stack of overlapping color blooms behind the glass. */
const PHOTO_BACKDROP =
  "radial-gradient(120% 120% at 12% 10%, #ff5e3a 0, transparent 45%)," +
  "radial-gradient(120% 120% at 88% 8%, #ff2d55 0, transparent 42%)," +
  "radial-gradient(120% 120% at 50% 50%, #ffcc00 0, transparent 38%)," +
  "radial-gradient(120% 120% at 10% 92%, #5856d6 0, transparent 46%)," +
  "radial-gradient(120% 120% at 92% 88%, #0a84ff 0, transparent 48%)," +
  "radial-gradient(120% 120% at 65% 78%, #34c759 0, transparent 40%)," +
  "linear-gradient(135deg, #af52de, #007aff)";

/** A single floating glass card with a caption + SF-style title. */
function GlassCard({
  config,
  title,
  caption,
}: {
  config: Parameters<typeof GlassEffect>[0]["glass"];
  title: string;
  caption: string;
}): React.ReactElement {
  return (
    <GlassEffect
      glass={config}
      shape={{ rounded: 22 }}
      style={{
        padding: "20px 22px",
        minHeight: 116,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 4,
        color: "#fff",
      }}
    >
      <Text font="headline">{title}</Text>
      <Text font="caption" monospaced>
        {caption}
      </Text>
    </GlassEffect>
  );
}

export function SectionMaterials(): React.ReactElement {
  return (
    <GallerySection
      id="materials"
      title="Materials"
      subtitle="Frosted-glass Material cards over a colorful backdrop"
    >
      <Card title="Material thicknesses" bleed>
        <div
          style={{
            position: "relative",
            minHeight: 280,
            padding: 24,
            // colorful, busy backdrop so the blur is visible
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #ff3b30 0, transparent 38%)," +
              "radial-gradient(circle at 80% 25%, #007aff 0, transparent 40%)," +
              "radial-gradient(circle at 30% 85%, #34c759 0, transparent 42%)," +
              "radial-gradient(circle at 75% 80%, #af52de 0, transparent 40%)," +
              "linear-gradient(135deg, #ffcc00, #ff2d55)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 16,
            }}
          >
            {LEVELS.map(({ level, label }) => (
              <MaterialView
                key={level}
                level={level}
                rim
                in={{ borderRadius: 18 }}
                style={{ padding: 18, minHeight: 96 }}
              >
                <Vibrant level="primary">
                  <Text font="headline">{level}</Text>
                </Vibrant>
                <br />
                <Vibrant level="secondary">
                  <Text font="caption" monospaced>
                    {label}
                  </Text>
                </Vibrant>
              </MaterialView>
            ))}
          </div>
        </div>
      </Card>

      {/* ===================== Liquid Glass (iOS 26) ===================== */}
      <Card title="Liquid Glass (iOS 26)  ·  .glassEffect(_:in:)" bleed>
        <div
          style={{
            position: "relative",
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 24,
            backgroundImage: PHOTO_BACKDROP,
            backgroundColor: "#1a0e2e",
          }}
        >
          {/* Row 1 — the four glass variants floating over the photo. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 18,
            }}
          >
            <GlassCard
              config={glass.regular}
              title="Regular"
              caption=".regular"
            />
            <GlassCard
              config={glass.clear}
              title="Clear"
              caption=".clear"
            />
            <GlassCard
              config={glass.regular.tint("#0a84ff")}
              title="Tinted"
              caption='.tint(.blue)'
            />
            <GlassCard
              config={glass.regular.tint("#ff375f").interactive()}
              title="Interactive"
              caption=".interactive()"
            />
          </div>

          {/* Row 2 — Liquid Glass button styles. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Button buttonStyle="glass">Glass</Button>
            <Button buttonStyle="glass" systemImage="square.and.arrow.up">
              Share
            </Button>
            <Button buttonStyle="glassProminent">Continue</Button>
            <Button buttonStyle="glassProminent" tint="#34c759">
              Confirm
            </Button>
            <Button buttonStyle="glass" borderShape="capsule">
              Capsule
            </Button>
          </div>

          {/* Row 3 — GlassEffectContainer: two capsules that visually merge. */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <GlassEffectContainer spacing={-14}>
              <GlassEffect
                glass={glass.regular.interactive()}
                shape="capsule"
                style={{
                  padding: "16px 30px",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                <Text font="body">Merge</Text>
              </GlassEffect>
              <GlassEffect
                glass={glass.regular.tint("#ffcc00").interactive()}
                shape="capsule"
                style={{
                  padding: "16px 30px",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                <Text font="body">Effect</Text>
              </GlassEffect>
            </GlassEffectContainer>
          </div>
        </div>
      </Card>
    </GallerySection>
  );
}
