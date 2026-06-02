# SwiftTS

**Apple SwiftUI, replicated 1:1 as a TypeScript/React (Next.js) UI kit** — so the SwiftUI look *and* behavior run on every platform the web reaches, not just iOS/macOS.

Reverse-engineered from Apple's **authoritative `.swiftinterface` declarations** (the exact public API Apple ships in the SDK: SwiftUICore 21,762 lines + SwiftUI 25,517 + Charts 3,114 — 677 structs, 1,322 funcs, 1,881 extensions, *with default values*), plus the HIG / Dynamic-Type / spring specs for the runtime visual layer the interface can't show. Every value is sourced — see [`research/`](./research) for the full RE evidence: per-cluster teardowns, the design-token derivations, the component inventory, and the design spec.

## Install

```bash
npm install swiftts react react-dom
```

`swiftts` is a standard ESM + TypeScript package (React 18 / 19 are peer deps). It works in **Next.js** (App Router & Pages), Vite, Remix, CRA — any React + bundler setup. Types and the `"use client"` boundaries ship with it; the only required step is importing the stylesheet once.

### Next.js (App Router)

Import the stylesheet once in your root layout, then use components anywhere:

```tsx
// app/layout.tsx
import "swiftts/styles.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

That's it — no `transpilePackages` needed. Components that need interactivity already carry their own `"use client"` directive, so you can use them inside Server Components; the package ships a single CSS file and per-component CSS that Next bundles automatically. (`swiftts/styles.css` loads the design tokens + a scoped base; the design tokens alone are also exported as `swiftts/tokens.css`.)

## Usage

Wrap your app (or any subtree) in `SwiftUIProvider` (the web port of `@Environment` — color scheme, tint, control size, Dynamic Type, layout direction), then use the components with props that mirror the SwiftUI API:

```tsx
import { SwiftUIProvider, VStack, HStack, Text, Button, Toggle, List, Section } from "swiftts";

export default function App() {
  const [on, setOn] = useState(true);
  return (
    <SwiftUIProvider colorScheme="system" tint="#007aff">
      <VStack spacing={12} alignment="leading">
        <Text font="largeTitle" fontWeight="bold">Hello</Text>
        <Button role="destructive" onPress={save}>Delete</Button>
        <Toggle isOn={on} onChange={setOn} label="Wi-Fi" />
      </VStack>
    </SwiftUIProvider>
  );
}
```

SwiftUI modifiers map to idiomatic React props compiled by `applyModifiers` (87 modifiers): `.padding()` → `padding`, `.frame(maxWidth:.infinity)` → `frame={{maxWidth:"infinity"}}`, `.foregroundStyle(.secondary)` → `foregroundStyle="secondary"`, `.cornerRadius(10)` → `cornerRadius={10}`, etc. Everything sits on the `<View>` base.

## Architecture

```
src/
  tokens/        # the design system: variables.css (251 CSS custom properties,
                 #   light/dark/elevated) + tokens.ts (typed) — colors, typography,
                 #   spacing, animation (springs as exact linear() easings), materials
  system/        # modifiers.ts (applyModifiers engine) · environment.tsx (SwiftUIProvider +
                 #   designMode: 'liquidGlass'|'classic') · animation.ts · gestures.ts · search.ts
                 #   drag-drop.ts · focus.ts · matched-geometry.ts · styles.ts · effects.ts
                 #   (Materials + the full iOS-26 Liquid Glass system) · lifecycle.ts
  components/    # all 64 SwiftUI components: View, Text, Image, Label, Button, Toggle, Slider,
                 #   Picker, DatePicker, TextField, List, Form, Section, ScrollView, Table,
                 #   navigation/ (NavigationStack/SplitView/TabView — Liquid Glass chrome),
                 #   presentation/ (Sheet/Alert/Popover/ContextMenu/Menu — glass surfaces),
                 #   shapes/ (+ ConcentricRectangle), charts/, layout/, controls/ (~310 SF-Symbol
                 #   icons → inline SVG), AnyView/EmptyView/Color/TimelineView/PhaseAnimator/…
  blocks/        # composed kit blocks: shells/ (AppShell, GlassNavBar, GlassSidebar, GlassTabBar),
                 #   cards/ (Card, StatTile, MetricGrid, SettingsGroup, ProfileCard, Banner),
                 #   screens/ (Settings/Dashboard/Profile/Search/MediaPlayer templates)
app/             # the demo gallery (one section per cluster + Liquid Glass + Kit Blocks)
research/        # the reverse-engineering evidence this kit was built from:
                 #   teardowns/ (16 per-cluster RE files, 15,922 lines) · tokens/ (6 design-token
                 #   specs) · INVENTORY.json · CLUSTERS.md · COMPLETENESS.md · DESIGN.md · tools/
```

**Layout** follows SwiftUI's proposed-size model mapped onto flexbox/grid (`parent proposes, child disposes` → `max-content`/`flex`). **Animation** ships SwiftUI's springs (`.smooth/.snappy/.bouncy`) as precomputed CSS `linear()` easing tables. **Styling** is pure CSS variables — zero runtime, SSR-safe, portable to any React setup (Next.js, Vite, CRA).

## How it was built

A 6-stage reverse-engineering → replication pipeline (documented in [`research/DESIGN.md`](./research/DESIGN.md)):

1. **Inventory** — parse the three `.swiftinterface` files → 1,270 types / 169 View components / 502 modifiers / 16 clusters.
2. **Tokens** — extract the design system (colors, Dynamic-Type ramp, springs, shadows, materials, squircle) → 251 CSS vars + typed `tokens.ts`.
3. **Teardowns** — one RE doc per cluster (verbatim API + `file:line` + anatomy + behavior + web mapping), 15,922 lines total.
4. **Replication** — the `applyModifiers` engine + `<View>` base, then every component on top.
5. **Integrate** — barrel, demo gallery, and an exhaustive **coverage ledger** ([`research/COMPLETENESS.md`](./research/COMPLETENESS.md), regenerable via `research/tools/coverage_ledger.py`): **100% of user-facing components** (67 implemented, 0 web-applicable gaps) and 286 modifiers covered. The remaining inventory entries are internal/private types, the `*Style` system, AppKit-interop, app-scene, or platform-specific modifiers with no web analog (windows, visionOS/immersive, Apple Pencil, speech, Touch Bar, Metal shaders) — each individually justified in the ledger.
6. **Fidelity loop** — screenshot the gallery, diff against SwiftUI/HIG, fix, repeat.

## Fidelity & honest gaps

Verified 1:1 (light + dark) across: typography ramp, all button styles, Toggle/Slider/Stepper/Progress, **List/Form** (iOS Settings anatomy: inset-grouped cards, inset hairline separators, leading-label/trailing-value rows), segmented/wheel/inline Pickers, **NavigationStack + bottom TabView**, Sheets with detents, Shapes/gradients, Materials (frosted-glass thicknesses), Charts.

**DESIGNED approximations** (proprietary or runtime-only, can't be shipped verbatim):
- **SF Symbols** — proprietary; **~310 common names** mapped to open inline-SVG equivalents (`src/components/controls/sf-symbols-map.ts` + `controls/symbols/*`). Visually close, not identical.
- **Materials / Liquid Glass** — `backdrop-filter: blur() saturate()` + tint recipes approximating `UIBlurEffect`.
- **Continuous corners (squircle)** — approximated via `clip-path`; CSS `border-radius` is circular.

## ⚠️ CSS authoring rule (Turbopack)

Files imported for global side effects (`*.global.css`) **must use bare selectors** (`.sui-foo { … }`). Do **not** wrap them in a top-level `:global { … }` block (Turbopack silently drops it) and do **not** use the per-selector `:global(.foo)` form (passed through literally → invalid in the browser → rule dropped). The `:global(...)` form is only valid inside a true CSS-module (`*.module.css`).

## Develop SwiftTS itself

This repo is both the **library** (`src/`) and a **demo gallery** (`app/`).

```bash
npm install
npm run dev          # http://localhost:3000 — the live component gallery
npm run build        # build the publishable library → dist/ (tsup ESM + tsc .d.ts + CSS)
npm run typecheck    # tsc --noEmit
npm run demo:build   # build the gallery as a static Next.js site
```

The library build (`npm run build`, also run automatically on `prepare`) transpiles each source file with `tsup` (`bundle: false`, so every `"use client"` directive and CSS import is preserved), emits `.d.ts` with `tsc -p tsconfig.build.json`, and copies the stylesheets — producing a tree-shakeable, RSC-correct `dist/`. Only `dist/`, `README`, and `LICENSE` are published (`react`/`react-dom` are peers).

## License

MIT. SwiftUI, SF Symbols, and the Apple design language are trademarks of Apple Inc.; this is an independent, clean-room-style reimplementation for non-Apple platforms and ships no Apple assets.
