# SwiftUI → Web: Reverse-Engineer Every UI Component & Replicate in TypeScript/Next.js

**Date:** 2026-06-02
**Status:** Design approved-pending-review
**Goal:** Reverse-engineer the *complete* SwiftUI component & UI system surface from Apple's authoritative API declarations, document it as RE teardowns, and replicate it as a runnable cross-platform **TypeScript/React (Next.js)** component library that matches SwiftUI's appearance and behavior.

---

## 1. The reality of "exact code" (what is and isn't extractable)

SwiftUI is closed-source — there is no Apple Git repo. But Apple ships the **complete, authoritative public API as plain-text `.swiftinterface` files** inside the SDK, present on this machine right now:

| Module | Path (CLT macOS SDK) | Lines | Holds |
|---|---|---|---|
| **SwiftUICore** | `.../SwiftUICore.framework/.../arm64e-apple-macos.swiftinterface` | 21,762 | `View`, `Color`, `Font`, layout engine, shapes, gradients, materials, `EnvironmentValues`, `ViewModifier`, animation primitives |
| **SwiftUI** | `.../SwiftUI.framework/.../arm64e-apple-macos.swiftinterface` | 25,517 | Button, Toggle, Slider, Picker, TextField, List, Form, NavigationStack, TabView, sheets, every concrete style |
| **Charts** | `.../Charts.framework/.../arm64e-apple-macos.swiftinterface` | 3,114 | Swift Charts (BarMark, LineMark, …) |

**Totals:** ~50,400 lines · **677 public structs · 1,322 public funcs · 1,881 extensions.** Module version **SwiftUI 7.4.27**, swift-compiler 6.3, target macOS 26.4.

These are **Tier-1A source** in repo terms — *the actual declarations Apple compiled*, including:
- every component type and its generic constraints,
- every modifier signature,
- **every default-argument value** (e.g. default `spacing`, default `Material`, default `Animation`),
- every enum case (`ButtonRole`, `ButtonBorderShape`, …),
- every `*Style` protocol and concrete style.

**Two further evidence sources to fill gaps:**
- The live `SwiftUI` dylib (in the dyld shared cache) — disassemblable (`otool`, `dyld_info`, `nm` present) for **private constants baked into the binary** (default paddings, color components, spring coefficients) where the swiftinterface only shows `= .default`.
- **Published design specs** for the visual layer the binary computes at runtime: Apple HIG metrics, Dynamic Type size tables, documented spring presets (`.smooth`/`.snappy`/`.bouncy` response & damping), community-RE'd material/blur recipes, SF Symbols.

**The honest limit (stated up front):** the `.swiftinterface` gives the exact *API + constants*. It does **not** contain pixel rendering — that happens in Metal/CoreAnimation at runtime. Visual fidelity is reconstructed from design constants, not from reading rendering code. There is **no iOS simulator** on this machine (Command Line Tools only), so live pixel-diff calibration requires a Mac with Xcode (deferred — see §6).

Every claim in every teardown is labeled **KNOWN** (from swiftinterface/dylib), **INFERRED** (from probing/specs/community RE), or **DESIGNED** (our engineering for a proprietary gap).

---

## 2. Locked decisions

| Decision | Choice | Implication |
|---|---|---|
| **TS/web API shape** | **React props (idiomatic)** — `<VStack spacing={8}>`, `<Button role="destructive" onPress={save}>` | W3 emits standard React+TS components, SSR-friendly, best Next.js ecosystem fit. SwiftUI modifier chains map to props/`style` objects, not a builder DSL. |
| **Coverage scope** | **Everything, full fan-out** | W2/W3 cover the entire inventory (all ~16 clusters) in parallel, not a core slice. Highest fidelity-of-coverage; highest token spend. |
| **Calibration** | **Spec-based now, pixel-diff later** | W0–W3 calibrate against extracted constants + HIG tables. W4 ships spec-parity; a pixel-diff harness bolts on later when an Xcode/simulator screenshot rig exists. |

---

## 3. Output layout (where artifacts land in the repo)

```
swiftui/
  INVENTORY.json              # W0 — the work-list: every symbol, module, line-range, category, cluster, priority
  CLUSTERS.md                 # W0 — human-readable cluster map
  tokens/                     # W1 — RE specs for the cross-cutting design system
    colors.md  typography.md  spacing.md  animation.md  shapes-effects.md  materials.md
teardowns/
  SWIFTUI_00_OVERVIEW.md      # architecture: View protocol, layout algorithm, modifier model, env/state
  SWIFTUI_<cluster>.md        # W2 — one teardown per cluster (C1..C16), KNOWN/INFERRED/DESIGNED labeled
products/
  swiftui-web/                # W3 — the runnable library (the deliverable)
    package.json  tsconfig.json  next.config.*  tailwind.config.*  (or vanilla-extract/CSS-vars)
    src/
      tokens/                 # generated from W1 → CSS variables + TS token objects
      components/             # one dir per component, replicating look + behavior
      layout/  styles/  hooks/
      index.ts
    app/ (or stories/)        # demo/Storybook page exercising every component
    README.md                 # how to use; KNOWN vs DESIGNED notes
ROADMAP.md                    # W4 — dated batch row-per-file table (single source of truth for progress)
```

`products/swiftui-web/` is a real project (`npm run dev` renders), not a single markdown file — consistent with "products/ holds runnable code."

---

## 4. The pipeline — five workflows, run one after another

Each Wn is **one `Workflow` invocation**. Between each, the orchestrator (me) reads the artifacts, runs the CLAUDE.md verify-gate (`wc -l` + density spot-read), and decides the next launch — **you stay in the loop at every seam.** Hard dependencies: W0 produces the work-list every later fan-out iterates over; W1 produces the tokens every W3 component imports. "Full fan-out now" sets the *breadth* of W2/W3 (entire inventory), not the *order* — you still can't fan out over a list that doesn't exist or import tokens that aren't built.

```
W0 INVENTORY ──▶ W1 TOKENS ──▶ W2 TEARDOWNS ──▶ W3 REPLICATION ──▶ W4 VERIFY+BUILD
  (inline scout    (fan-out ×6    (fan-out ×16     (fan-out ×16,        (fan-out + critic,
   + tiny wf)       domains)       clusters, loop)   worktree-isolated)   build, demo)
                                        ▲______________________│   feedback loop on gaps
```

### W0 — Inventory & Map  *(inline scout + small categorization workflow)*
**Input:** the 3 `.swiftinterface` files.
**Method:** a deterministic parser (Python/grep) extracts every top-level `public struct/enum/class/protocol` with its line-range and module; flags Views (`: …View`), styles (`: …Style`), `ViewModifier`s, and extension methods (the modifier surface); then a small workflow categorizes each into one of 16 clusters + a priority tier and resolves ambiguous ones.
**Output:** `swiftui/INVENTORY.json` (the work-list) + `swiftui/CLUSTERS.md`.
**Why first:** nothing downstream can fan out without the enumerated list of what to fan out over.

**The 16 clusters** (each = one teardown file + one replication batch):

| # | Cluster | Representative symbols |
|---|---|---|
| C1 | Content primitives | Text, Label, Image, AsyncImage, Link, Divider, Spacer, ProgressView, Gauge |
| C2 | Action controls | Button, Toggle, Menu, ShareLink, PasteButton, RenameButton, EditButton |
| C3 | Value input | TextField, SecureField, TextEditor, Slider, Stepper, ColorPicker |
| C4 | Selection | Picker, DatePicker, MultiDatePicker |
| C5 | Layout stacks | VStack, HStack, ZStack, Lazy*Stack, Grid, GridRow, Lazy*Grid, ViewThatFits, Group, Section |
| C6 | Scroll & collections | ScrollView, List, Form, Table, OutlineGroup, DisclosureGroup |
| C7 | Navigation | NavigationStack, NavigationSplitView, NavigationLink, TabView, Tab |
| C8 | Presentation / modal | sheet, fullScreenCover, popover, alert, confirmationDialog, toolbar, contextMenu |
| C9 | Shapes & drawing | Rectangle, RoundedRectangle, Circle, Capsule, Path, Canvas, Gradient, Shape protocol |
| C10 | Styling modifiers | foregroundStyle, background, font, padding, frame, clipShape, shadow, overlay, border |
| C11 | Animation & transitions | withAnimation, .animation, transition, matchedGeometryEffect, PhaseAnimator, KeyframeAnimator |
| C12 | Materials & visual effects | materials, blur, opacity, blendMode, visualEffect, hueRotation, saturation |
| C13 | Gestures | TapGesture, DragGesture, LongPressGesture, MagnifyGesture, RotateGesture, combinators |
| C14 | Charts | BarMark, LineMark, PointMark, AreaMark, RuleMark, plot modifiers |
| C15 | Styles registry | ButtonStyle, ToggleStyle, PickerStyle, ListStyle, LabelStyle + all concrete styles |
| C16 | Environment & state | EnvironmentValues, @Environment, PreferenceKey, @State/@Binding/@Observable semantics |

### W1 — Token foundation  *(fan-out ×6 token domains)*
**Input:** swiftinterface defaults + dylib constants + published specs.
**Fan-out (one agent per domain):** (1) **color** — semantic + system colors, light/dark pairs, tint; (2) **typography** — Dynamic Type tables, text styles, SF Pro metrics, weights; (3) **spacing & metrics** — control heights, default paddings, corner radii, default stack spacing; (4) **animation** — spring presets (response/damping), default durations, easing, transition recipes; (5) **shapes & effects** — shadows, borders, blur radii; (6) **materials** — `.ultraThin…thick` tint + blur recipes, vibrancy.
**Output:** `swiftui/tokens/*.md` (RE specs) + a generated `src/tokens/` (CSS variables + TS objects).
**Why second:** every component sits on this substrate; building it first prevents per-component token drift.

### W2 — Per-cluster RE teardowns  *(fan-out ×16, internal verify↔expand loop)*
**Input:** `INVENTORY.json` (cluster assignments) + W1 tokens.
**Fan-out (one agent per cluster C1–C16):** each writes `teardowns/SWIFTUI_<cluster>.md` covering, per component: exact API (swiftinterface `file:line` cite + verbatim signature + default args), every applicable modifier, visual anatomy, behavior/state machine, tokens consumed — each claim labeled KNOWN/INFERRED/DESIGNED.
**Quality gate (orchestrator runs between W2 and W3):** `wc -l` every file; standalone teardown < 800 lines or a cluster that skips requested mechanisms triggers a Phase-3 coverage-expansion relaunch (per CLAUDE.md's verify↔expand loop). Loop until every cluster clears the bar.
**Output:** `teardowns/SWIFTUI_00_OVERVIEW.md` + 16 cluster teardowns.

### W3 — TypeScript/Next.js replication  *(fan-out ×16, worktree-isolated)*
**Input:** W2 teardowns + W1 `src/tokens/`.
**Fan-out (one agent per cluster, `isolation: 'worktree'` so parallel writes don't collide):** each writes idiomatic **React+TS** components under `products/swiftui-web/src/components/` that replicate appearance + behavior, importing the token system; props mirror the SwiftUI API (`spacing`, `role`, `font`, `padding`, …). Styling via Tailwind or vanilla-extract/CSS-vars (decided in W3 scaffolding, defaulting to CSS variables generated from tokens for SSR-safety).
**Output:** populated `products/swiftui-web/src/`.

### W4 — Integration, verification & build  *(fan-out + completeness critic)*
**Input:** the assembled library.
**Steps:** wire `index.ts` + a demo/Storybook page exercising every component; `npm install && npm run build` must pass; per-component **parity-check** agents compare TS output against the teardown spec (props cover the SwiftUI API? tokens correct? behavior matches?) and flag gaps → fed back into a W3 re-run; a **completeness critic** asks "what symbols from `INVENTORY.json` are still unimplemented?" and lists them; spec-based visual parity now, pixel-diff hook stubbed for later.
**Output:** working `products/swiftui-web/` + a dated `ROADMAP.md` batch table (one row per file: file, cluster, core finding, verdict).

---

## 5. Why this sequence (design-for-isolation rationale)

- **Tokens before components** — components are consumers of a well-defined token interface; changing a token's internals (e.g. a spring coefficient) must not require touching every component. One clear purpose per unit.
- **Teardown before replication, as separate runs** — keeps a human-in-the-loop quality gate between *RE evidence* and *code generation*; we don't generate TS from a thin/wrong teardown. (Per CLAUDE.md: "if you can't write the server code from the teardown, the RE needs to go deeper.")
- **One cluster = one teardown = one replication batch** — each cluster is independently understandable, testable, and replaceable; a senior engineer can answer "what does it do, how do you use it, what does it depend on" per cluster.
- **W4 feedback loop, not one-shot** — completeness is a loop-until-dry property (what's missing from INVENTORY), not a single pass.

---

## 6. Calibration & success criteria

**Spec-based calibration (now):** each component's metrics/colors/typography/animation are checked against the extracted constants and HIG/Dynamic-Type tables recorded in W1. A component "passes" when its rendered box model, type ramp, color tokens, and animation params match the recorded spec values.

**Pixel-diff calibration (deferred):** if/when a Mac+Xcode screenshot harness exists, W4 gains a pass that screenshots real SwiftUI renders (simulator) and our web output (Playwright — available here) and pixel-diffs per component. Hook left stubbed in W4.

**"Done" means:**
- `swiftui/INVENTORY.json` enumerates every public component/modifier/style across the 3 modules.
- Every cluster has a teardown that clears the depth bar (≥800 lines or full mechanism coverage), every claim KNOWN/INFERRED/DESIGNED.
- `products/swiftui-web/` builds and `npm run dev` renders a demo of every implemented component.
- The completeness critic reports < some agreed residual of unimplemented symbols (niche/deprecated allowed to defer, logged).
- `ROADMAP.md` updated.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Token foundation wrong → mass W3 rework** | W1 runs and is spot-verified *before* W3; tokens are CSS variables, so a fix is one file, not N components. |
| **Teardowns thin/narrow** (the common failure mode) | CLAUDE.md verify↔expand loop between W2 and W3; `wc -l` + density spot-read gate; expansion relaunch, not acceptance. |
| **Runtime-only visuals not in any readable source** | Labeled INFERRED/DESIGNED; sourced from HIG/Dynamic-Type/community recipes; pixel-diff deferred to close the gap later. |
| **Worktree write collisions in W3** | `isolation: 'worktree'` per replication agent; merge in W4. |
| **Scale/token cost** ("everything now") | Cluster batching caps concurrency; W0/W1 are cheap; the expensive W2/W3 are the deliverable, and the user opted into full breadth explicitly. |
| **SF Symbols (huge separate asset)** | Map to an SVG/icon set in W3; not blocking the component work. |

---

## 8. Execution note

W0 is done inline (deterministic parse + tiny categorization workflow) to produce the work-list; W1–W4 are sequential `Workflow` invocations with orchestrator verify-gates between them. The orchestrator launches them one at a time, reads each result, and only then fires the next — never a single mega-workflow, so quality gates and your review fit between phases.
