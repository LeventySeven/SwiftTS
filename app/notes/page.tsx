"use client";
/**
 * /notes — standalone dev harness for the macOS 26 Apple Notes template.
 *
 * Renders <AppleNotesApp/> full-bleed on a Tahoe-style wallpaper so the Liquid
 * Glass translucency (sidebar/toolbar shining the wallpaper through) actually
 * reads. Toggle ?scheme=dark for the dark appearance. Not part of the gallery —
 * a focused canvas for building the 1:1 replica.
 */
import * as React from "react";
import { AppleNotesApp } from "@/blocks";
import { SwiftUIProvider } from "@/system/environment";

export default function NotesStandalonePage(): React.ReactElement {
  const [scheme, setScheme] = React.useState<"light" | "dark">("dark");

  return (
    <SwiftUIProvider platform="macOS" designMode="liquidGlass" colorScheme={scheme}>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          // A calm macOS-style wallpaper so the glass chrome refracts something
          // without going neon (closer to a real desktop than a test gradient).
          background:
            "radial-gradient(130% 120% at 18% 12%, #3b4a86 0, transparent 55%)," +
            "radial-gradient(120% 120% at 86% 18%, #8a5a9c 0, transparent 52%)," +
            "radial-gradient(150% 150% at 72% 96%, #c2683f 0, transparent 60%)," +
            "linear-gradient(155deg, #2a2f5e 0%, #3d2b54 50%, #5a3a52 100%)",
        }}
      >
        <button
          type="button"
          onClick={() => setScheme((s) => (s === "light" ? "dark" : "light"))}
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 50,
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            font: "600 12px ui-monospace, Menlo, monospace",
            cursor: "pointer",
          }}
        >
          {scheme === "light" ? "◐ Dark" : "◑ Light"}
        </button>
        <div
          style={{
            width: "min(1380px, 95vw)",
            height: "min(880px, 90vh)",
          }}
        >
          <AppleNotesApp />
        </div>
      </div>
    </SwiftUIProvider>
  );
}
