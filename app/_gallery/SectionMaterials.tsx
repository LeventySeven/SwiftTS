"use client";
import * as React from "react";
import { MaterialView, Vibrant, Text } from "@sui";
import type { MaterialLevel } from "@/system/effects";
import { GallerySection, Card } from "./chrome";

const LEVELS: { level: MaterialLevel; label: string }[] = [
  { level: "ultraThin", label: ".ultraThinMaterial" },
  { level: "thin", label: ".thinMaterial" },
  { level: "regular", label: ".regularMaterial" },
  { level: "thick", label: ".thickMaterial" },
  { level: "ultraThick", label: ".ultraThickMaterial" },
];

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
    </GallerySection>
  );
}
