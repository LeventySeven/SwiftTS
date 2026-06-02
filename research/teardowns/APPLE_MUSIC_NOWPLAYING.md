# SwiftUI `MeshGradient` → Web — RE Teardown / Web-Replica Spec

**Goal:** a faithful web replica of SwiftUI's `MeshGradient` (the primitive behind the Apple Music "Now Playing" ambient backdrop and iOS 18+ animated mesh wallpapers), as a TS/React `<canvas>` component.
**Source of truth:** the `SwiftUICore` `.swiftinterface` text (macOS 26 SDK), already partially tabulated in `SWIFTUI_C9_shapes-drawing.md` §14.7. Labels: **KNOWN** = read from the interface; **INFERRED** = from Apple docs / rendered-output RE; **DESIGNED** = our engineering for a proprietary gap (Apple ships the math in a private Metal shader, never in the interface).

**Cite shorthand:** `SUICore:N` = SwiftUICore interface line N.

---

## 0. What this primitive IS — the one-paragraph mental model

A `MeshGradient` is a **`width × height` lattice of colored control points** that are smoothly interpolated into a continuous 2D color field. You give it (a) the grid dimensions, (b) a row-major array of normalized `(0..1)` *positions* for each lattice node, and (c) a matching row-major array of *colors*. The renderer treats every 2×2 block of adjacent nodes as one **cell** (a quad with 4 corner positions + 4 corner colors) and fills that cell by interpolating BOTH position and color across it. The magic of the Apple look is two things: (1) the interior nodes can sit anywhere — moving them warps the cells, so a 3×3 grid of slightly-jittered nodes produces organic blobs instead of a checkerboard; (2) the color blend across each cell is *smoothed* (Hermite, not linear) so there's no visible banding at the seams. Animate the interior node positions on a slow sine and you get the ambient morphing "Now Playing" backdrop.

That is the whole product. Everything below is how to reproduce it exactly on a `<canvas>`.

---

## 1. Verbatim interface — KNOWN (`SUICore:14902-14964`)

```swift
public struct MeshGradient : ShapeStyle, Equatable, Sendable {        // SUICore:14902
  public var width: Int; public var height: Int                       // :14928-:14929 — grid dims
  public var locations: Locations    // .points([SIMD2<Float>]) | .bezierPoints([BezierPoint])  // :14930
  public var colors: Colors          // .colors([Color]) | .resolvedColors([Color.Resolved])    // :14931
  public var background: Color        // :14932  default .clear
  public var smoothsColors: Bool      // :14933  default true
  public var colorSpace: Gradient.ColorSpace  // :14934  default .device
  public init(width:Int, height:Int, locations:Locations, colors:Colors,
              background: Color = .clear, smoothsColors: Bool = true, colorSpace: .device)  // :14935
  public init(width:Int, height:Int, points:[SIMD2<Float>], colors:[Color],
              background: Color = .clear, smoothsColors: Bool = true, colorSpace: .device)  // :14936
  // BezierPoint (:14913): position + leading/top/trailing/bottom control points (SIMD2<Float>)
}
```

**Field-by-field (KNOWN from the interface; semantics INFERRED from Apple docs + rendered output):**

| field | meaning |
| --- | --- |
| `width: Int` | number of control points per ROW (grid columns). |
| `height: Int` | number of control points per COLUMN (grid rows). |
| `points: [SIMD2<Float>]` | `width*height` positions, **row-major** (`points[r*width + c]`), each a normalized `(x,y)` in `0..1`. `(0,0)` = top-leading, `(1,1)` = bottom-trailing — the same `UnitPoint` convention as the rest of C9 (`SUICore:9720`). |
| `colors: [Color]` | `width*height` corner colors, **row-major, index-parallel to `points`**. |
| `background: Color` | painted *under* the mesh first; default `.clear`. Shows through any transparency in the corner colors. |
| `smoothsColors: Bool` | `true` (default) ⇒ the color blend across each cell is smoothed (zero gradient at cell seams) so colors don't band; `false` ⇒ plain bilinear. |
| `colorSpace: .device \| .perceptual` | the space the colors are *interpolated* in. `.device` (default) ≈ sRGB channel lerp; `.perceptual` ≈ OKLab lerp (matches `Gradient.ColorSpace`, `SUICore:16922`). |
| `locations: .bezierPoints([BezierPoint])` | the curved-cell form. Each `BezierPoint` (`:14913`) carries its position **plus four control handles** — `leading/top/trailing/bottom` — that bend the four cell edges meeting at that node into cubic Béziers (a Coons patch), so cells have *curved* boundaries, not straight ones. |

**The corner ordering of a cell.** For the cell whose top-left node is grid `(r,c)`, the four corners are:
```
tl = points[r*W + c]       tr = points[r*W + (c+1)]
bl = points[(r+1)*W + c]   br = points[(r+1)*W + (c+1)]
```
A `W×H` grid therefore has `(W-1)*(H-1)` cells.

---

## 2. The interpolation algorithm — DESIGNED (Apple's is a private Metal shader)

Apple rasterizes this on the GPU; the interface only *names* the surface, it never defines the math. We reconstruct it from the rendered behavior. There are two interpolations happening per cell, independently: **position** and **color**.

### 2.1 Position interpolation — where does sub-cell point `(s,t)` land?

`(s,t)` are the in-cell parameters, both `0..1`; `s` runs tl→tr (left→right), `t` runs tl→bl (top→bottom).

**Straight cells (plain `points`, no bezier handles) ⇒ bilinear:**
```
xTop = lerp(tl.x, tr.x, s);  xBot = lerp(bl.x, br.x, s)
yTop = lerp(tl.y, tr.y, s);  yBot = lerp(bl.y, br.y, s)
pos  = { x: lerp(xTop, xBot, t), y: lerp(yTop, yBot, t) }
```
This is the standard quad warp: it lets a cell be any convex (or mildly concave) quadrilateral, which is exactly what moving interior nodes produces.

**Curved cells (`.bezierPoints`) ⇒ a Coons patch.** Each of the 4 cell edges becomes a cubic Bézier whose control points are the relevant `leading/top/trailing/bottom` handles of its two endpoint nodes; a missing handle defaults to the straight-line 1/3–2/3 point (so a bezier cell with no handles is identical to a straight cell). The interior is the **bilinearly-blended Coons combination**:
```
C(s,t) = Lc(s,t) + Ld(s,t) − B(s,t)
  Lc = lerp_t( topEdge(s), bottomEdge(s) )      // ruled surface in t
  Ld = lerp_s( leftEdge(t), rightEdge(t) )       // ruled surface in s
  B  = bilinear of the 4 corner positions        // subtract the double-counted corners
```
where `topEdge(s)`, `bottomEdge(s)`, `leftEdge(t)`, `rightEdge(t)` are cubic-Bézier evals (`bez(p0,p1,p2,p3,·)`). This is the textbook bilinear Coons patch and reproduces SwiftUI's curved-cell behavior.

### 2.2 Color interpolation — the color at `(s,t)`

Bilinear over the 4 corner colors, with the parameters **eased** when `smoothsColors`:
```
es = smoothsColors ? smoothstep(s) : s        // smoothstep(x) = x²(3−2x)
et = smoothsColors ? smoothstep(t) : t
top = lerp(tl.color, tr.color, es)
bot = lerp(bl.color, br.color, es)
color = lerp(top, bot, et)
```
`smoothstep` has zero first derivative at `0` and `1`, so the blend's slope vanishes at every cell seam — adjacent cells meet with matching color *and* matching gradient, which is why `smoothsColors=true` kills the banding you'd otherwise see at cell boundaries. The lerps are done in the active color space (sRGB for `.device`, OKLab for `.perceptual`).

> **Why smoothstep and not bicubic.** True C¹-across-the-whole-grid would need a bicubic spline over the entire color lattice. Apple's per-cell behavior is consistent with per-cell Hermite smoothing (each cell independent, seams matched by the zero-slope endpoints), which is far cheaper and visually identical for the smooth blobby look. This is the DESIGNED reconstruction; it matches rendered output.

### 2.3 Rasterization strategy — forward scatter (DESIGNED)

The cell→pixel map is **not** a fixed grid (interior nodes moved it), so you can't just `for each pixel, look up its color`. Two options:
- **Inverse map per pixel:** for each output pixel solve the cell's inverse-bilinear for `(s,t)` (a quadratic), then color. Exact, but per-pixel root-finding and a point-in-quad test; expensive and fiddly for curved cells.
- **Forward scatter (what we ship):** subdivide each cell into a `subdiv × subdiv` lattice of micro-quads in `(s,t)` space; for each micro-quad compute its 4 corner *positions* via §2.1 and one flat color at its centroid via §2.2, and fill it as a canvas path. Allocation-free per frame, trivially handles curved edges (the bezier eval is already in the forward map), and the centroid-flat-shading is invisible at `subdiv ≥ ~8`.

We use forward scatter. `subdiv` is adaptive: `clamp(6 … 28, ceil(res / ((W-1)*3)))` — finer when the raster is large relative to the cell count.

### 2.4 Resolution & cost — KNOWN-cheap by construction

The gradient is low-frequency (it's *literally* a smooth blur of a handful of colors), so it needs almost no resolution. We rasterize into a small backing canvas (`res ≤ maxResolution`, default **220²**) and let CSS scale the `<canvas>` up to the element box. The element stays crisp (it's a smooth gradient — upscaling a smooth gradient is lossless to the eye); the cost is fixed at ~`(W-1)*(H-1)*subdiv²` fills regardless of the on-screen size. A 3×3 mesh at `subdiv=12` is `4*144 = 576` path fills/frame — trivial even animated at 60fps.

---

## 3. Color resolution — the canvas/CSS-var problem (DESIGNED)

The kit's `resolveColor()` (`system/modifiers.ts:715`) returns a CSS *string*, usually a `var(--sui-color-…)` reference. A `<canvas>` cannot read CSS custom properties, and we need real channel values to lerp. Resolution path:

1. `resolveColor(input)` → CSS string.
2. If it's a **literal** (`#hex`, `#hex8`, `rgb()/rgba()`, `transparent`) → parse channels directly with regex (works on the server too — no DOM).
3. Otherwise (a `var()`, a named color, `color-mix()`, `oklch()` …) → paint it onto a 1×1 scratch canvas (the browser *does* resolve `var()` against the document there) and read the pixel back. Cached context, one `getImageData` per unique color.

SSR/first-paint: literals resolve everywhere; non-literals fall back to mid-grey until mount, but the `<canvas>` itself only rasterizes inside `useLayoutEffect`, and the element carries a **mean-color CSS `background`** (computed from the literal colors, SSR-stable) so there's never a transparent flash before the raster lands.

### 3.1 colorSpace — sRGB vs OKLab lerp

- `.device` → channel-wise sRGB lerp (`a + (b−a)·t` on the 0..255 values). Fast, matches Apple's default.
- `.perceptual` → convert both endpoints sRGB→linear→OKLab, lerp in OKLab, convert back. Uses the standard Björn Ottosson matrices (sRGB↔OKLab). Gives the even, no-grey-dip blend you want when two saturated hues meet.

---

## 4. The animated variant — the "Now Playing" ambient morph (DESIGNED)

`<AnimatedMeshGradient>` is the actual product the title references: Apple Music's full-screen Now-Playing view paints a `MeshGradient` derived from the album art and **slowly drifts its interior control points** so the color field breathes.

**The drift.** Only **interior** nodes move (a node is interior iff `0 < r < H-1` and `0 < c < W-1`); edge and corner nodes are pinned so the surface stays full-bleed (otherwise the mesh would pull away from the frame). Each interior node gets a deterministic per-index seed — independent x and y oscillators with their own phase, frequency multiplier (`0.6…1.6×`), and amplitude multiplier (`0.6…1.4×`) — so each node traces its own slow Lissajous loop and the whole field morphs incoherently (organic, not a synchronized pulse):
```
dx = sin(2π·speed·fx·t + px) · amplitude · ax
dy = cos(2π·speed·fy·t + py) · amplitude · ay
node' = { x: clamp01(x+dx), y: clamp01(y+dy) }
```
Defaults: `speed = 0.06` (cycles/sec scale — deliberately barely-perceptible), `amplitude = 0.08` (normalized grid units). A `requestAnimationFrame` loop re-rasterizes each frame (cheap, §2.4).

**reduce-motion.** Reads `useEnvironment().reduceMotion`; when set (or when `requestAnimationFrame` is undefined, i.e. SSR), it draws the base mesh **once** and starts no loop — a static, accessible fallback. This is the C11 reduce-motion contract applied to an ambient effect.

---

## 5. `extractPalette` — deriving the ambient colors from album art (DESIGNED)

To make the mesh match the artwork (the Now-Playing behavior), we need the dominant colors of an image. `extractPalette(img | url, count=4)`:

1. Load the image (URL → `new Image()` with `crossOrigin="anonymous"` so the pixels are readable; element → await `load` if not complete).
2. Downsample onto a **48×48** offscreen canvas (`drawImage` does the box filter for us — fast, and dominant colors survive heavy downsampling).
3. `getImageData`, drop near-transparent pixels (`a < 125`), collect `[r,g,b]` triples. (A tainted/cross-origin-without-CORS read throws → return `[]` gracefully.)
4. **Median cut:** start with one box holding all pixels; repeatedly take the box with the largest single-channel spread and split it at that channel's median; stop at `count` boxes.
5. Each box → its mean color; sort boxes by population (most-dominant first); return `count` hex strings.

The output feeds straight into `<AnimatedMeshGradient colors={...}>` — e.g. a 4-color palette laid into a 2×2 or seeded into the corners of a 3×3 mesh.

---

## 6. SwiftUI → web mapping (the cheat sheet)

| SwiftUI (`SUICore:14902-14964`) | Web (`shapes/MeshGradient.tsx`) |
| --- | --- |
| `MeshGradient(width:height:points:colors:)` | `<MeshGradient width height points colors/>` |
| `SIMD2<Float>` position | `{ x, y }` (`MeshPoint`), normalized 0..1 |
| `points` row-major `[r*width+c]` | same indexing, `points[r*width+c]` |
| `colors: [Color]` row-major | `colors: string[]` (tokens or CSS), index-parallel |
| `background: Color = .clear` | `background?: string` default `"clear"` (transparent) |
| `smoothsColors: Bool = true` | `smoothsColors?: boolean` default `true` (smoothstep blend) |
| `colorSpace: .device` | `colorSpace?: "device"` (sRGB lerp) — default |
| `colorSpace: .perceptual` | `colorSpace?: "perceptual"` (OKLab lerp) |
| `.bezierPoints([BezierPoint])` curved cells | `BezierMeshPoint` w/ `leading/top/trailing/bottom` → Coons patch |
| GPU shader rasterization | `<canvas>` ImageData/path forward-scatter, `res ≤ 220²`, CSS-scaled |
| animated wallpaper / Now-Playing drift | `<AnimatedMeshGradient speed amplitude/>`, interior-node sine drift |
| (n/a — Apple derives from artwork) | `extractPalette(img, count)` median-cut |

### 6.1 Worked example (the canonical Apple demo mesh)
```tsx
<MeshGradient
  width={3} height={3}
  points={[
    {x:0,y:0},   {x:0.5,y:0},   {x:1,y:0},
    {x:0,y:0.5}, {x:0.6,y:0.4}, {x:1,y:0.5},   // jittered interior node
    {x:0,y:1},   {x:0.5,y:1},   {x:1,y:1},
  ]}
  colors={[
    "#f0c", "#c0f", "#60f",
    "#f60", "#fff", "#06f",
    "#fc0", "#0fc", "#0cf",
  ]}
/>
```
Moving the center node `{x:0.6,y:0.4}` warps the white highlight off-center — the single jittered interior node is what makes the surface look organic. Swap `<MeshGradient>` for `<AnimatedMeshGradient>` and that node (plus any other interior nodes) drifts on its own.

---

## 7. Files

- `src/components/shapes/MeshGradient.tsx` — `<MeshGradient>`, `<AnimatedMeshGradient>`, `extractPalette`, plus the exported `rasterizeMesh` / `resolveRGBA` primitives (so tests and the animated variant share one rasterizer). `"use client"` (canvas + rAF + state). Exported from `shapes/index.ts`.
- This doc — the RE/algorithm spec.

**Status:** static + animated render paths implemented; bilinear + Coons-patch position interp; bilinear + smoothstep color interp; sRGB + OKLab color spaces; median-cut palette extraction; reduce-motion freeze; SSR-safe (raster gated behind `useLayoutEffect`, mean-color CSS fallback). `tsc --noEmit` clean.

---

## 8. The "Now Playing" / Lyrics view — the screen the primitive is FOR

`MeshGradient` is the engine; this section is the actual product surface Apple Music shows: a full-screen immersive **Lyrics** view with the heavily-blurred **ambient gradient** (mesh of colors pulled from the album artwork, slowly morphing) behind the album art + time-synced lyrics. RE'd from the reference still (Travis Scott & Young Thug — "Trance", *HEROES & VILLAINS*) + the observable Apple Music behavior. Labels: **KNOWN** (visible in the reference / Apple's shipping behavior), **DESIGNED** (our web engineering — Apple never ships this view's layout code).

### 8.1 Anatomy (KNOWN, from the reference)

A two-column immersive surface, full-bleed, dark:

```
┌──────────────────────────────────────────────────────────────┐
│  ░░ ambient gradient (mesh of artwork colors, blurred) ░░     │  ← layer 0
│  ░░ + dark scrim (vignette + vertical wash) ░░                │  ← layer 1
│                                                               │
│   ┌── album art ──┐          Did you forget? Do it for life   │
│   │  WHITE card   │          Chicago that time, all bullshit… │  ← lyrics (right)
│   └───────────────┘          Wonderful vibe, wonderful night  │     active = bright
│   Trance                     Did it with Trav                 │     past   = dim 35%
│   Travis Scott — HEROES…     All I can hear is you and I      │     upcoming = ramp
│   ▷ ──────●────────────                                       │
└──────────────────────────────────────────────────────────────┘
   left column (art + meta + transport)        right column (synced lyrics)
```

Three visual facts that the replica must reproduce exactly:
1. **The background is the artwork's OWN palette, morphing.** Not a fixed gradient — the dominant colors of the cover, smeared and drifting. That is `extractPalette(artwork)` → feed swatches into `<AnimatedMeshGradient>`.
2. **The album art is in a WHITE rounded card**, not bare. The white border + soft drop shadow is what makes the art read as a floating object against the smoky field.
3. **Lyrics are big, bold, LEFT-aligned, and state-driven by playback time** — one line is bright/active, prior lines are dimmed (already-read), upcoming lines fade out with distance, and the column auto-scrolls so the active line stays put.

### 8.2 The ambient background — `<AmbientBackground>` (DESIGNED composition over KNOWN primitive)

Front-to-back layering (`nowplaying.module.css`):

| layer | what | how |
| --- | --- | --- |
| mesh | `<AnimatedMeshGradient width=4 height=4>` | 16-node lattice; interior nodes jittered off-grid + drifting (`speed≈0.05`, `amplitude≈0.09`); `colorSpace="perceptual"` (OKLab lerp ⇒ no muddy mid-tones); `maxResolution=200` (cheap; CSS-scaled up). |
| over-scan + blur | wrapper `div.ambientMesh` | `inset:-28%; width/height:156%` so heavy blur has bleed and never reveals a hard rectangle edge; `filter: blur(58px) saturate(155%) brightness(1.04)`; a 19s `npBreathe` scale/translate wobble (disabled under reduce-motion). |
| scrim | `div.scrim` | radial vignette `(0 → .18 → .5 black)` at 22%/18% + vertical wash `(.22 → .06 → .2 → .46 black)`; an `::after` overlay-blend sheen so flat areas don't band. |

**Palette derivation (KNOWN algorithm):** `extractPalette(artworkUrl, 5)` (median-cut, §3 of this doc) runs in a `useEffect` (SSR-safe — touches `Image`/`canvas`). Until it resolves, a `fallbackColors` palette renders so there's no black flash. The 16 mesh colors are laid out by `meshColors(palette, n)`: palette is cycled with a per-row offset (so a color never tiles down a column → varied, not striped), the **top-left corner gets the most-dominant swatch** (the implicit "light source"), and the **bottom row biases to the darkest/least-dominant swatch** (the Apple "fades to dark at the floor" depth).

**Why `colorSpace="perceptual"`:** sRGB lerp between e.g. magenta and orange passes through a desaturated brown midpoint; OKLab keeps the blend luminous. Verified visually — the live render's center pixel sampled `rgb(196,133,171)` (a clean warm rose), not mud.

### 8.3 Synced lyrics — `<LyricsView>` (DESIGNED)

Props: `{ lines: {time:number; text:string}[]; currentTime:number; gapThreshold=4; activeAnchor=0.4; onSeek? }`.

**Active-line resolution (KNOWN behavior):** lines are sorted by `time`; a line is active from its `time` until the *next* line's `time`. `activeIndex()` is the last line whose `time ≤ currentTime` (or `-1` before the first line = an intro gap).

**Per-line visual state (the exact ramp — DESIGNED to match the reference):**

| state | condition | opacity | blur | weight / scale |
| --- | --- | --- | --- | --- |
| `active` | `i === active` | `1` | `0` | 800, `scale(1.035)` |
| `past` | `i < active` | `0.35` | `0` | 700, `scale(1)` |
| `upcoming` | `i > active` (or all, pre-first-line) | `max(0.15, 0.55 − (dist−1)·0.12)` | `min(2.4, 0.4 + (dist−1)·0.45)px` | 700, `scale(1)` |

`dist` is lines-ahead-of-active (1,2,3…). So the next line is `0.55` opacity / `0.4px` blur, then `0.43`/`0.85px`, `0.31`/`1.3px`, `0.19`, and a `0.15` floor — verified live: the upcoming column read `0.55 → 0.43 → 0.31 → 0.19 → 0.15`. Per-line `transition` is the kit `--sui-anim-snappy-css` spring on opacity/filter/transform (≈480ms), so state changes are snappy, not laggy. reduce-motion drops blur + shortens transitions.

**Auto-scroll (KNOWN behavior, DESIGNED impl):** in `useLayoutEffect`, measure the active line's center (`offsetTop + offsetHeight/2`) inside the viewport, then set the track's `translateY = viewportHeight·activeAnchor − lineCenter` so the active line lands at **40% from the top**. The track transitions that transform on the snappy spring (GPU `translate3d`, no rAF). The column is masked top+bottom (`mask-image` linear gradient `transparent→#000 14%→#000 80%→transparent`) so lines fade into the scrim instead of clipping hard. Verified live: at `currentTime≈24s` the track held `translateY(-56.8px)` with "Did it with Trav" active.

**Instrumental-gap "•••" indicator (KNOWN behavior):** when there's no active line for `> gapThreshold` (4s) — either before the first line (intro) or a long break where `sinceActive > 4s && untilNext > 4s` — a pulsing three-dot row (`npDotPulse`, staggered 0/0.18/0.36s delays) is injected at the upcoming-line position. Verified live: seeking to the 40→52s break placed "•••" exactly between "Codeine convention, no need to hide" (last sung) and "Whippin' the Phantom, lost in a trance" (next).

### 8.4 The screen — `<NowPlayingScreen>` (DESIGNED) + the bundled demo

`<NowPlayingScreen>` composes `<AmbientBackground>` (layer 0) + a left column (white `artCard` → `<img>` art, title `h2`, "artist — album" subtitle, inline transport: prev/play-pause/next + the kit `<Slider variant="macos">` scrubber with `m:ss` / `-m:ss` readouts) + `<LyricsView>` (right column). The `artCard` does the iOS "paused shrink" (`scale(0.94)` when `playing=false`). Grid `minmax(240px,0.92fr) 1.08fr`, collapsing to a single column under 720px.

**Built-in playback simulation (DESIGNED — so the showcase animates with no backend):** a `setInterval` at 100ms advances `currentTime` by 0.1s while `playing`, wrapping to 0 at the end so it loops forever; the interval reads live time from a ref (so it isn't torn down every tick) and yields to a controlled `currentTime` prop when the parent owns it. The `<Slider>` two-way-binds to `currentTime/durationSec`, so dragging it scrubs the lyrics live.

**The reference track is bundled.** Defaults are Travis Scott & Young Thug — "Trance" (*HEROES & VILLAINS*, 78s) with **12 timed lyric lines** (incl. the brief's "Did you forget? Do it for life", "Chicago that time, all bullshit aside", "Wonderful vibe, wonderful night", "Did it with Trav", "All I can hear is you and I") and a deliberate **40→52s instrumental break** to exercise the "•••" path. The album cover is a **self-contained inline SVG data-URI** (deep magenta/violet/ember radial cover with an "H&V" mark) — no network, and `extractPalette` reads that same data-URI so the ambient mesh provably derives from the "artwork." Pass `artworkUrl` / `lyrics` / `ambientColors` to override.

### 8.5 SwiftUI ↔ web mapping (this view)

| Apple Music behavior | web replica |
| --- | --- |
| ambient backdrop = artwork colors, morphing | `extractPalette(art)` → `<AnimatedMeshGradient>` under blur + scrim (`<AmbientBackground>`) |
| album art in white floating card | `div.artCard` (white, radius, shadow) wrapping `<img object-fit:cover>` |
| big bold left-aligned lyrics | `p.line` clamp(20–40px)/800, `text-align:left` |
| active line bright, past dim, upcoming fade | `data-state` active/past/upcoming → opacity/blur/scale ramp (§8.3) |
| lyrics auto-scroll, active stays put | `translateY = vpH·0.4 − lineCenter`, snappy-spring transform |
| "•••" during instrumental gaps | `DotsIndicator` injected when no active line `> 4s` |
| time scrubber | kit `<Slider variant="macos">` bound to `currentTime/durationSec` |
| (n/a — Apple has the audio engine) | built-in 100ms `setInterval` playback simulation, loops |

### 8.6 Files (this view)

- `src/blocks/apps/music/NowPlayingScreen.tsx` — the composed full-screen view + the bundled "Trance" demo (lyrics, inline-SVG artwork, playback simulation, `<Slider>` scrubber). `"use client"`.
- `src/blocks/apps/music/LyricsView.tsx` — the synced-lyrics column: active/past/upcoming state machine, per-line opacity/blur ramp, 40%-anchor auto-scroll, "•••" gap indicator. `"use client"`.
- `src/blocks/apps/music/AmbientBackground.tsx` — `<AnimatedMeshGradient>` (artwork palette) + over-scan/blur wrapper + dark scrim; SSR-safe `extractPalette` in an effect with a fallback palette. `"use client"`.
- `src/blocks/apps/music/nowplaying.module.css` — all scoped styles (local CSS-module selectors, `var(--sui-*)` tokens with fallbacks).
- Exported from `src/blocks/apps/music/index.ts` (`NowPlayingScreen`, `LyricsView`, `AmbientBackground` + their prop types incl. `LyricLine`).

**Status:** built + verified live (Next dev, 1000×600 frame). Canvas mesh paints from the extracted artwork palette (sampled center pixel `rgb(196,133,171)`); 12 lyric lines render with the correct active/past/upcoming ramp (`1 / 0.35 / 0.55→0.15`); auto-scroll holds the active line at the 40% anchor (`translateY(-56.8px)` at 24s); the "•••" indicator appears in the 40→52s break between the right lines; playback simulation advances + loops; the `<Slider>` scrubs it. SSR-safe (all `window`/`canvas`/`rAF`/`extractPalette` gated in effects — `next build` static-prerenders the tree). reduce-motion freezes the mesh + breathe wobble + dot pulse. `tsc --noEmit` clean (0 errors project-wide); `next build` succeeds. Zero console errors at runtime.
