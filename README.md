# SwiftTS

**Apple SwiftUI, replicated 1:1 as a TypeScript/React (Next.js) UI kit** — so the SwiftUI look *and* behavior run on every platform the web reaches, not just iOS/macOS.

Reverse-engineered from Apple's **authoritative `.swiftinterface` declarations** (the exact public API Apple ships in the SDK: SwiftUICore 21,762 lines + SwiftUI 25,517 + Charts 3,114 — 677 structs, 1,322 funcs, 1,881 extensions, *with default values*), plus the HIG / Dynamic-Type / spring specs for the runtime visual layer the interface can't show. Every value is sourced — see [`research/`](./research) for the full RE evidence: per-cluster teardowns, the design-token derivations, the component inventory, and the design spec.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000 — the component gallery
npm run build    # production build (also typechecks)
```

## Usage

Wrap your app in `SwiftUIProvider` (the web port of `@Environment` — color scheme, tint, control size, Dynamic Type, layout direction), then use the components with props that mirror the SwiftUI API:

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
  system/        # modifiers.ts (applyModifiers engine) · environment.tsx (SwiftUIProvider)
                 #   animation.ts · gestures.ts · styles.ts (*Style system) · effects.ts (materials)
                 #   types.ts (shared SwiftUI vocabulary) · lifecycle.ts (onAppear/onChange/task)
  components/    # ~50 component families (104 files): View, Text, Image, Label, Button,
                 #   Toggle, Slider, Stepper, Picker, DatePicker, TextField, List, Form,
                 #   Section, ScrollView, navigation/ (NavigationStack/SplitView/TabView),
                 #   presentation/ (Sheet/Alert/Popover/ContextMenu), shapes/, charts/,
                 #   layout/ (VStack/HStack/ZStack/Grid/…), AsyncImage, GroupBox, …
app/             # the demo gallery (one section per cluster, light/dark/tint toggle)
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
5. **Integrate** — barrel, demo gallery, completeness audit (90% user-facing components / 77% modifiers).
6. **Fidelity loop** — screenshot the gallery, diff against SwiftUI/HIG, fix, repeat.

## Fidelity & honest gaps

Verified 1:1 (light + dark) across: typography ramp, all button styles, Toggle/Slider/Stepper/Progress, **List/Form** (iOS Settings anatomy: inset-grouped cards, inset hairline separators, leading-label/trailing-value rows), segmented/wheel/inline Pickers, **NavigationStack + bottom TabView**, Sheets with detents, Shapes/gradients, Materials (frosted-glass thicknesses), Charts.

**DESIGNED approximations** (proprietary or runtime-only, can't be shipped verbatim):
- **SF Symbols** — proprietary; ~130 common names mapped to open inline-SVG equivalents (`src/components/controls/sf-symbols-map.ts`). Visually close, not identical.
- **Materials / Liquid Glass** — `backdrop-filter: blur() saturate()` + tint recipes approximating `UIBlurEffect`.
- **Continuous corners (squircle)** — approximated via `clip-path`; CSS `border-radius` is circular.

## ⚠️ CSS authoring rule (Turbopack)

Files imported for global side effects (`*.global.css`) **must use bare selectors** (`.sui-foo { … }`). Do **not** wrap them in a top-level `:global { … }` block (Turbopack silently drops it) and do **not** use the per-selector `:global(.foo)` form (passed through literally → invalid in the browser → rule dropped). The `:global(...)` form is only valid inside a true CSS-module (`*.module.css`).

## License

MIT. SwiftUI, SF Symbols, and the Apple design language are trademarks of Apple Inc.; this is an independent, clean-room-style reimplementation for non-Apple platforms and ships no Apple assets.
