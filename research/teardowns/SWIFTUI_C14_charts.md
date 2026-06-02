# SwiftUI Cluster C14 — Swift Charts → Web (SVG) Replica Spec

**Goal:** a TypeScript/React (Next.js) declarative chart kit that mirrors Swift
Charts' grammar-of-graphics API (`Chart { … marks … }`) and renders pixel-faithful
output via an **SVG layer** (scales → SVG coordinates). This file is the spec a later
agent uses to *write* the components, so every mark's API, default metric, state,
and HTML/CSS/prop mapping is spelled out.

**Authoritative source (Tier-1A):** read verbatim from
`…/Charts.framework/…/arm64e-apple-macos.swiftinterface` (the `Charts` module) and
`…/SwiftUICore.framework/…` (the `Axis` enum). Every signature below is quoted with
its `Charts.swiftinterface:line`. Visual defaults that the interface cannot show
(palette, bar corner radius, point size, axis typography, animation curves) are
labelled **INFERRED** (Apple HIG / WWDC "Hello Swift Charts" WWDC22-10136,
"Swift Charts: Raise the bar" WWDC22-10137, "Create a chart with Swift Charts"
docs) or **DESIGNED** (our engineering choice for the web replica).

**Architecture decision (DESIGNED, foundational).** Swift Charts is a
*grammar of graphics*: you declare **marks** (`BarMark`, `LineMark`, …) bound to data
via `PlottableValue`s (`x: .value("Month", row.month)`), and the framework derives
**scales** (domain → pixel range) and **axes** automatically. The web replica keeps
exactly this shape:

```
<Chart data={rows}>                       // = Chart(data) { … } container; owns the SVG <svg>, plot rect, scales
  <BarMark x={v("Month", r.month)}        // = mark structs; emit <rect>/<path>/<circle> into the plot group
           y={v("Sales", r.sales)} />
</Chart>
```

The container computes scales from the union of all marks' plottable values, lays out
a **plot rectangle** inset by the axis gutters, then each mark renders SVG primitives
positioned by `scaleX`/`scaleY`. This mirrors Charts' own two-phase
`_layoutChartContent` → `_renderChartContent` protocol requirement seen on every mark
(`Charts.swiftinterface` — e.g. BarMark `1915–1916`, LineMark `1968–1969`).

**Coverage map.** Deep-covered (full API + anatomy + behavior + HTML/CSS/props):
`Chart`, `BarMark`, `LineMark`, `AreaMark`, `PointMark`, `RuleMark`, `RectangleMark`,
`SectorMark`, `PlottableValue`/`Plottable`, `MarkDimension`, `MarkStackingMethod`,
`InterpolationMethod`, the mark-styling modifiers (`foregroundStyle(by:)`,
`symbol(by:)`, `position(by:)`, `lineStyle`, `symbolSize`, `annotation`,
`cornerRadius`, `interpolationMethod`), the axis system (`chartXAxis`/`chartYAxis` +
`AxisMarks`/`AxisGridLine`/`AxisTick`/`AxisValueLabel`), scales
(`chartXScale`/`chartYScale`, `chartForegroundStyleScale`, `chartSymbolScale`),
`ChartProxy`/`chartOverlay`/`chartBackground`, selection
(`chartXSelection`/`chartAngleSelection`), and `chartLegend`. Tabulated long tail:
the `*Plot` vectorized variants, `Function*PlotContent`, `Vectorized*PlotContent`,
3D (`Chart3D`/`SurfacePlot`/poses), type-erasers and the `_…Inputs/_…Outputs`
plumbing structs (private layout machinery — not user API). See the final two tables.

---

## 0. Container — `Chart` (`Charts.swiftinterface:1092`)

### 0.1 Exact API (KNOWN)

```swift
@MainActor public struct Chart<Content> : View where Content : ChartContent {       // 1092
  public init(@ChartContentBuilder content: () -> Content)                          // 1093
  public init<Data, C>(_ data: Data,                                                // 1094
        @ChartContentBuilder content: @escaping (Data.Element) -> C)
        where Content == ForEach<Data, Data.Element.ID, C>,
              Data : RandomAccessCollection, C : ChartContent, Data.Element : Identifiable
  public init<Data, ID, C>(_ data: Data, id: KeyPath<Data.Element, ID>,             // 1095
        @ChartContentBuilder content: @escaping (Data.Element) -> C)
        where Content == ForEach<Data, ID, C>, Data : RandomAccessCollection, ID : Hashable
}
```

Three constructors: a **static** content builder (`Chart { BarMark(...) }`) and two
**data-driven** forms that internally wrap your closure in a SwiftUI `ForEach`
(`Chart(data) { row in BarMark(...) }`). The `ForEach` is what lets one mark
declaration fan out into N rendered marks. `ChartContentBuilder` (`1475`) is a result
builder exactly like `ViewBuilder` — `buildBlock`, `buildOptional`, `buildEither`,
`buildArray` — so the body can mix marks, conditionals, and loops.

### 0.2 Visual anatomy (INFERRED — HIG / WWDC22)

A `Chart` renders, from outside in:
1. **Chart frame** — the whole view; default has *no* background/border. Caller sizes
   it (`.frame(height: 300)`). Has zero intrinsic size other than a system minimum.
2. **Axis gutters** — leading gutter for the Y axis (tick labels + optional axis label),
   bottom gutter for the X axis. Width/height auto-sized to the longest label.
3. **Plot area (plot rect)** — the inner rectangle where marks draw. Default chart
   **insets the plot** so marks don't touch the axis labels; bar/point domains get a
   small padding so the first/last category isn't clipped.
4. **Gridlines** — light horizontal (for a vertical-value chart) lines at each Y tick,
   drawn *behind* marks. Default color ≈ `Color(.systemGray)` at low alpha → our token
   `var(--sui-color-separator)` / `system.gray4`. INFERRED.
5. **Marks** — the data geometry.
6. **Legend** — auto-generated below the plot when any mark uses `foregroundStyle(by:)`
   / `symbol(by:)` (i.e. a categorical style scale exists). See §11.

Default axis label typography is the **caption** style — `text.caption1`
(`--sui-text-caption1`: 12px/400) drawn in `secondaryLabel`
(`var(--sui-color-secondary-label)`). INFERRED from HIG screenshots.

### 0.3 Behavior

- **Scale inference:** the container scans every mark's `PlottableValue`s, unions them
  per channel (x, y, foregroundStyle, symbol, …) and builds a default scale: numeric →
  linear, `Date` → date, `String`/categorical → band. Override per axis with
  `chartXScale`/`chartYScale` (§9).
- **Animation:** changing the bound data animates marks to new positions when the
  mutation is inside `withAnimation` — bars grow from baseline, lines morph, points
  translate, sectors sweep. Default curve is the SwiftUI **default spring** (the same
  `.smooth`/interactive spring used app-wide). INFERRED.
- **Layout:** `_makeView`/`_makeViewList`/`_viewListCount` (`1096–1098`) are the private
  SwiftUI view-graph hooks — irrelevant to the web replica.

### 0.4 Web replication — `<Chart>` container

**HTML structure** (the container owns one `<svg>`; marks are children that read scale
context):

```html
<div class="sui-chart" style="height:300px">
  <svg class="sui-chart-svg" viewBox="0 0 W H" preserveAspectRatio="none">
    <g class="sui-chart-gridlines">…</g>     <!-- behind marks -->
    <g class="sui-chart-plot" transform="translate(gutterL, padTop)">
      …marks…                                 <!-- clipped to plot rect -->
    </g>
    <g class="sui-chart-xaxis">…</g>
    <g class="sui-chart-yaxis">…</g>
  </svg>
  <div class="sui-chart-legend">…</div>       <!-- HTML, not SVG, for crisp text -->
</div>
```

**Scale construction (DESIGNED — the core engine).** A `Chart` builds scales from the
declared marks. Provide them through React context so every mark can position itself:

```ts
type Scale<T> = {
  kind: 'linear' | 'band' | 'time' | 'log' | 'sqrt';
  domain: [number, number] | T[];          // numeric pair OR category list (band)
  range: [number, number];                  // pixel range, e.g. [0, plotWidth]
  scale: (v: T) => number;                  // value → pixel
  invert?: (px: number) => T;               // pixel → value (for selection/proxy)
  bandwidth?: () => number;                 // band step width (bars/categories)
};
// linear: scale = px0 + (v - d0)/(d1 - d0) * (px1 - px0)
// band:   step = (px1-px0)/domain.length; scale(cat) = px0 + idx*step + step/2 (centered)
//         bandwidth = step * (1 - paddingInner)   // paddingInner default ~0.2 (DESIGNED, matches Charts bar gaps)
```

The container measures the SVG box (`ResizeObserver`), reserves gutters from the axis
config (default leading ≈ 40px, bottom ≈ 28px — DESIGNED to fit a 12px caption tick
label), then exposes `{ xScale, yScale, plot: {x,y,w,h}, styleScale, symbolScale }` via
`ChartContext`.

```tsx
<Chart data={rows}>
  <BarMark x={v('Month', r.month)} y={v('Sales', r.sales)} />
</Chart>
// data-driven form maps to: rows.map(r => <BarMark key={r.id} ... />) internally,
// exactly like Chart(data){ row in … } wrapping a ForEach.
```

**React prop API:**

```tsx
interface ChartProps {
  data?: readonly any[];                      // data-driven form; omit for static children
  id?: (row:any)=>string|number;              // = id: keyPath
  children: ReactNode | ((row:any)=>ReactNode); // ChartContentBuilder closure
  // scale + axis overrides resolved from <Chart.XScale/> etc. or props:
  xScale?: ScaleSpec; yScale?: ScaleSpec;
  foregroundStyleScale?: StyleScaleSpec;      // chartForegroundStyleScale
  symbolScale?: SymbolScaleSpec;
  legend?: 'automatic'|'visible'|'hidden'|LegendSpec;
  plotPadding?: { leading?:number; bottom?:number; top?:number; trailing?:number };
}
```

**CSS:**

```css
.sui-chart { position: relative; width: 100%; }
.sui-chart-svg { display:block; width:100%; height:100%; overflow: visible; }
.sui-chart-gridlines line { stroke: var(--sui-color-separator); stroke-width: 1; }
.sui-chart-plot { /* clipped via clipPath to plot rect */ }
.sui-chart-xaxis text, .sui-chart-yaxis text {
  font: 400 12px/16px var(--sui-font-system);   /* text.caption1 */
  fill: var(--sui-color-secondary-label);
}
```

> **Note on `viewBox`/`preserveAspectRatio`:** for crisp 1px gridlines and round
> corners, render in **device pixels** (compute scales against measured `clientWidth`),
> not a normalized viewBox — `preserveAspectRatio="none"` would smear strokes. DESIGNED.

---

## 1. Data-binding primitives

### 1.1 `Plottable` & `PlottableValue` (`Charts.swiftinterface:2374`, `2558`)

```swift
public protocol Plottable {                                          // 2374
  associatedtype PrimitivePlottable : PrimitivePlottableProtocol
  var primitivePlottable: Self.PrimitivePlottable { get }
  init?(primitivePlottable: Self.PrimitivePlottable)
}
public struct PlottableValue<Value> where Value : Plottable {}        // 2558
extension PlottableValue {                                            // 2560
  public static func value(_ labelKey: LocalizedStringKey, _ value: Value) -> PlottableValue<Value>
  public static func value<S>(_ label: S, _ value: Value) -> PlottableValue<Value> where S : StringProtocol
  public static func value(_ label: Text, _ value: Value) -> PlottableValue<Value>
  // Range form (for binned/aggregated data):
  public static func value(_ labelKey: LocalizedStringKey, _ range: Range<Value>) -> PlottableValue<Value> where Value : Comparable
  // Date form with calendar component bucketing:
  public static func value(_ labelKey: LocalizedStringKey, _ date: Date,
        unit: Calendar.Component, calendar: Calendar? = nil) -> PlottableValue<Value> where Value == Date
}
```

**KNOWN.** A `PlottableValue` pairs a **label** (the channel's display name, used for the
axis title and legend) with a **value**. `Plottable` is the conformance that says "this
type can map to a primitive axis coordinate." Built-in conformances (read from the
interface, `2392`+): all signed/unsigned ints, `Float`/`Double`/`CGFloat`, `Date`,
`String`, `Decimal`, plus `Bool` — each lowering to a `PrimitivePlottable`
(`Int/Double/String/Date`). `_PrimitivePlottableKind` (`2391`) is the discriminator the
scale builder switches on (number → linear, string → band, date → date).

**Web mapping (DESIGNED):**

```ts
function v<T>(label: string, value: T): PlottableValue<T> {
  return { label, value, kind: plottableKind(value) }; // 'number' | 'string' | 'time'
}
function plottableKind(x:unknown){ return x instanceof Date ? 'time'
  : typeof x === 'number' ? 'number' : 'string'; }
```

The `label` drives the default axis title and the legend key. The `kind` drives default
scale selection. The `Range`/`Date-unit` forms map to a `{ lo, hi }` interval or a
bucketed timestamp respectively (used by `BarMark` histograms / time-grouped bars).

### 1.2 `MarkDimension` (`Charts.swiftinterface:2068`) — bar/rect/sector sizing

```swift
@frozen public struct MarkDimension : ExpressibleByFloatLiteral, ExpressibleByIntegerLiteral { // 2068
  internal enum Storage { case automatic, fixed(CGFloat), ratio(CGFloat), inset(CGFloat) }     // 2073
  public static var automatic: MarkDimension                 // 2082
  public static func ratio(_ value: CGFloat) -> MarkDimension // 2087  (fraction of the band step)
  public static func inset(_ value: CGFloat) -> MarkDimension // 2090  (band step minus 2*value)
  public static func fixed(_ value: CGFloat) -> MarkDimension // 2093  (absolute points)
  // integer/float literal => .fixed(CGFloat(value))          // 2096–2102
}
```

**KNOWN, this is load-bearing for bar geometry.** A bar's `width` (vertical bar) or
`height` (horizontal bar) is a `MarkDimension`:
- `.automatic` → framework picks a width from the band step (leaves a default gap).
- `.ratio(r)` → `width = bandStep * r` (e.g. `.ratio(0.6)` ⇒ 60% of the slot).
- `.inset(i)` → `width = bandStep - 2*i` (fixed pixel gap on each side).
- `.fixed(px)` / integer literal `width: 20` → absolute `20pt` wide.

**Web mapping (DESIGNED):**

```ts
type MarkDimension = {automatic:true} | {fixed:number} | {ratio:number} | {inset:number};
function resolveDim(d:MarkDimension, bandStep:number, paddingInner=0.2):number {
  if ('fixed' in d) return d.fixed;
  if ('ratio' in d) return bandStep * d.ratio;
  if ('inset' in d) return bandStep - 2*d.inset;
  return bandStep * (1 - paddingInner);            // .automatic default gap
}
```

### 1.3 `MarkStackingMethod` (`Charts.swiftinterface:2025`) — stacking semantics

```swift
@frozen public struct MarkStackingMethod : Equatable {              // 2025
  internal enum Storage { case standard, normalized, center, unstacked } // 2029
  public static var standard: MarkStackingMethod    // 2049  (cumulative from baseline 0)
  public static var normalized: MarkStackingMethod  // 2052  (each stack scaled to 100%)
  public static var center: MarkStackingMethod      // 2055  (streamgraph: centered on 0)
  public static var unstacked: MarkStackingMethod   // 2058  (marks overlap, no stack)
}
```

**KNOWN.** Default for `BarMark`/`AreaMark` is `.standard`. This drives the stacking
algorithm:

**Web mapping (DESIGNED) — stack layout pass run before rendering bars/areas:**

```ts
// group rows by x (same category), order by series, accumulate y0/y1:
function stack(rows, method){
  for (const grp of groupByX(rows)) {
    let acc = 0; const total = sum(grp.map(r=>r.y));
    for (const r of grp.sort(bySeries)) {
      if (method==='unstacked'){ r.y0=0; r.y1=r.y; continue; }
      r.y0 = acc; r.y1 = acc + r.y; acc = r.y1;
    }
    if (method==='normalized') grp.forEach(r=>{ r.y0/=total; r.y1/=total; });
    if (method==='center'){ const c=acc/2; grp.forEach(r=>{ r.y0-=c; r.y1-=c; }); }
  }
}
```

### 1.4 `InterpolationMethod` (`Charts.swiftinterface:2131`) — line/area curve

```swift
@frozen public struct InterpolationMethod {                          // 2131
  internal enum Storage { case linear, cardinal(tension:), catmullRom(alpha:), step(transition:), monotone } // 2135
  public static var linear: InterpolationMethod                      // 2145
  public static var cardinal: InterpolationMethod                    // 2148  = cardinal(tension: 0)
  public static func cardinal(tension: CGFloat) -> InterpolationMethod// 2151
  public static var catmullRom: InterpolationMethod                  // 2152  = catmullRom(alpha: 0.5)
  public static func catmullRom(alpha: CGFloat) -> InterpolationMethod// 2155
  public static var monotone: InterpolationMethod                    // 2156
  public static var stepStart: InterpolationMethod                   // 2159  = step(transition: 0)
  public static var stepCenter: InterpolationMethod                  // 2162  = step(transition: 0.5)
  public static var stepEnd: InterpolationMethod                     // 2165  = step(transition: 1)
}
```

**KNOWN — exact default constants captured:** `cardinal` tension defaults to **0**,
`catmullRom` alpha defaults to **0.5**, step transitions are **0 / 0.5 / 1**. Default
interpolation for `LineMark`/`AreaMark` is **`.linear`** (INFERRED — straight segments).

**Web mapping (DESIGNED) — pick the SVG path generator per method.** These map 1:1 onto
D3-shape curve factories (or hand-rolled equivalents):

| Swift | SVG curve | constant |
|---|---|---|
| `.linear` | polyline `L` segments | — |
| `.cardinal(tension)` | Cardinal spline | tension 0 default |
| `.catmullRom(alpha)` | Catmull-Rom | α 0.5 default |
| `.monotone` | monotone-X cubic (no overshoot) | — |
| `.stepStart/Center/End` | step path, knee at 0 / 0.5 / 1 of segment | — |

```ts
type Interp = 'linear'|'monotone'|'stepStart'|'stepCenter'|'stepEnd'
           | {cardinal:number} | {catmullRom:number};
// default {} => 'linear'
```

---

## 2. `BarMark` (`Charts.swiftinterface:1907`)

### 2.1 Exact API (KNOWN)

```swift
@MainActor public struct BarMark {                                                          // 1907
  // vertical/horizontal value bar:
  init<X,Y>(x: PlottableValue<X>, y: PlottableValue<Y>,
            width: MarkDimension = .automatic, height: MarkDimension = .automatic,
            stacking: MarkStackingMethod = .standard)                                        // 1908
  // single-axis value with a numeric extent (yStart/yEnd are CGFloat in *plot* space):
  init<X>(x: PlottableValue<X>, yStart: CGFloat? = nil, yEnd: CGFloat? = nil,
          width: MarkDimension = .automatic, stacking: MarkStackingMethod = .standard)       // 1909
  init<Y>(xStart: CGFloat? = nil, xEnd: CGFloat? = nil, y: PlottableValue<Y>,
          height: MarkDimension = .automatic, stacking: MarkStackingMethod = .standard)      // 1910
  // ranged bars (Gantt / interval):
  init<X,Y>(xStart: PlottableValue<X>, xEnd: PlottableValue<X>, y: PlottableValue<Y>,
            height: MarkDimension = .automatic)                                              // 1911
  init<X>(xStart: PlottableValue<X>, xEnd: PlottableValue<X>, yStart: CGFloat? = nil, yEnd: CGFloat? = nil) // 1912
  init<X,Y>(x: PlottableValue<X>, yStart: PlottableValue<Y>, yEnd: PlottableValue<Y>, width: MarkDimension = .automatic) // 1913
  init<Y>(xStart: CGFloat? = nil, xEnd: CGFloat? = nil, yStart: PlottableValue<Y>, yEnd: PlottableValue<Y>) // 1914
}
```

Seven initializers. The two common ones: `BarMark(x: .value("Month", m), y: .value("Sales", s))`
(vertical bars over a categorical X) and the swapped `xStart/xEnd…, y:` form (horizontal
bars). The `*Start/*End` forms produce **ranged** bars (e.g. Gantt) where one channel
spans an interval. `width`/`height` are `MarkDimension` (§1.2); `stacking` is
`MarkStackingMethod` (§1.3).

### 2.2 Visual anatomy (INFERRED)

- **Element:** one rounded rectangle per data row.
- **Width (vertical bar):** `MarkDimension.automatic` ⇒ band step minus a default inner
  gap (≈20% paddingInner). For categorical X, bars are **centered** in their band slot.
- **Corner radius:** modern Swift Charts (iOS 17+) rounds bar tops by default; the value
  is small (≈ 4–6pt on the leading/outer edge) — applied via `.cornerRadius` (§7). Treat
  default as `0` unless `.cornerRadius` is set; HIG screenshots show rounded tops →
  **DESIGNED default `cornerRadius: 4`** for the replica to look Apple-ish.
- **Fill:** first series → the chart's first palette color. Default categorical palette
  (INFERRED, the standard Swift Charts cycle): blue, green, orange, purple, red, teal,
  yellow, … i.e. the system accent ramp. Replica palette:
  `[#0A84FF, #30D158, #FF9F0A, #BF5AF2, #FF453A, #64D2FF, #FFD60A, #FF375F]`
  (system colors). When `foregroundStyle(by:)` is set, fill comes from the
  `chartForegroundStyleScale` (§9).
- **States:** charts marks are non-interactive by default (no hover/press). On selection
  (`chartXSelection`) the *selected* bar is emphasized and others dimmed — see §10.

### 2.3 Web replication

**HTML** — vertical bar (baseline at `yScale(0)`):

```html
<rect class="sui-barmark"
      x={xScale(cat) - barW/2} y={Math.min(yScale(y0), yScale(y1))}
      width={barW} height={Math.abs(yScale(y1) - yScale(y0))}
      rx="4" ry="4" fill={styleFor(row)} />
```

- `barW = resolveDim(width, bandStep)` (§1.2).
- `y0/y1` come from the stacking pass (§1.3); for a plain bar `y0 = 0`, `y1 = value`.
- Horizontal bar swaps axes: `y = yScale(cat) - barH/2`, `x = min(xScale(x0),xScale(x1))`,
  `width = |xScale(x1)-xScale(x0)|`, `height = barH`.

**React props:**

```tsx
interface BarMarkProps {
  x?: PlottableValue; y?: PlottableValue;
  xStart?: PlottableValue|number; xEnd?: PlottableValue|number;   // ranged / horizontal
  yStart?: PlottableValue|number; yEnd?: PlottableValue|number;
  width?: MarkDimension; height?: MarkDimension;                  // default {automatic:true}
  stacking?: 'standard'|'normalized'|'center'|'unstacked';        // default 'standard'
  // inherited mark modifiers (chained or as props): foregroundStyle, foregroundStyleBy,
  // cornerRadius, opacity, annotation, position(by) … see §6/§7
}
```

**CSS:**

```css
.sui-barmark { transition: y .35s cubic-bezier(.2,.0,.2,1), height .35s cubic-bezier(.2,.0,.2,1); }
/* bars grow from baseline on mount → animate height/ y from baseline */
```

Animation: on mount/data-change, animate `height` 0→target and `y` baseline→target so
bars **grow up from the axis** (matches Charts' default). DESIGNED spring ≈
`cubic-bezier(.2,0,.2,1)` 0.35s, or a real spring (stiffness 170, damping 26) to match
SwiftUI's interactive spring.

---

## 3. `LineMark` (`Charts.swiftinterface:1965`)

### 3.1 Exact API (KNOWN)

```swift
@MainActor public struct LineMark {                                              // 1965
  init<X,Y>(x: PlottableValue<X>, y: PlottableValue<Y>)                          // 1966
  init<X,Y,S>(x: PlottableValue<X>, y: PlottableValue<Y>, series: PlottableValue<S>) // 1967
}
```

Two initializers. The **`series:`** form is the multi-line key: every distinct `series`
value becomes its own connected polyline (so one declaration draws several lines, colored
by the series via `foregroundStyle(by:)`). Without `series`, all points connect in data
order.

### 3.2 Visual anatomy (INFERRED)

- **Element:** one `<path>` stroke per series, connecting points sorted by X.
- **Default stroke width:** ≈ **2pt**. INFERRED (HIG line charts). Line cap/join round.
- **Interpolation:** default `.linear`; override via `.interpolationMethod(_:)` (§1.4/§7).
- **Color:** first palette color, or by `foregroundStyle(by:)`.
- **No points by default** — a `LineMark` is just the line. To add dots, overlay a
  `PointMark` or use `.symbol(...)`.
- **States:** static; on `chartXSelection` a `RuleMark`+annotation lollipop is commonly
  added by the caller (not automatic).

### 3.3 Web replication

```html
<path class="sui-linemark" fill="none"
      stroke={styleFor(series)} stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"
      d={linePath(points, interp)} />
```

```ts
// points already mapped to pixel space, sorted by x:
function linePath(pts:{x:number;y:number}[], interp:Interp):string {
  if (interp==='linear'||!interp) return 'M' + pts.map(p=>`${p.x},${p.y}`).join('L');
  if (interp==='monotone')  return monotonePath(pts);
  if (interp==='stepEnd')   return stepPath(pts, 1);
  if (interp==='stepCenter')return stepPath(pts, 0.5);
  if (interp==='stepStart') return stepPath(pts, 0);
  if ('catmullRom' in interp) return catmullRomPath(pts, interp.catmullRom);  // α def 0.5
  if ('cardinal' in interp)   return cardinalPath(pts, interp.cardinal);       // tension def 0
  return 'M'+pts.map(p=>`${p.x},${p.y}`).join('L');
}
```

```tsx
interface LineMarkProps {
  x: PlottableValue; y: PlottableValue;
  series?: PlottableValue;                  // multi-line key
  interpolationMethod?: Interp;             // default 'linear'
  lineStyle?: StrokeStyle;                  // StrokeStyle: {lineWidth, dash:[], cap, join}
  foregroundStyle?: string; foregroundStyleBy?: PlottableValue;
}
```

**CSS / line-draw animation (DESIGNED):**

```css
.sui-linemark { stroke-dasharray: var(--len); stroke-dashoffset: var(--len);
  animation: sui-line-draw .6s ease forwards; }
@keyframes sui-line-draw { to { stroke-dashoffset: 0; } }
```

`StrokeStyle` maps to `stroke-width` + `stroke-dasharray` (the `dash:[CGFloat]` array) +
`stroke-linecap`/`stroke-linejoin`.

---

## 4. `AreaMark` (`Charts.swiftinterface:1839`)

### 4.1 Exact API (KNOWN)

```swift
@MainActor public struct AreaMark {                                              // 1839
  init<X,Y>(x: PlottableValue<X>, y: PlottableValue<Y>, stacking: MarkStackingMethod = .standard) // 1840
  init<X,Y>(xStart: PlottableValue<X>, xEnd: PlottableValue<X>, y: PlottableValue<Y>) // 1841
  init<X,Y>(x: PlottableValue<X>, yStart: PlottableValue<Y>, yEnd: PlottableValue<Y>) // 1842  (band area)
  // + 3 series: variants for stacked/banded multi-series (1843–1845)
}
```

Key forms: the basic `x:y:` area (filled from baseline up to the line, stacked by
default), the **`yStart:yEnd:`** *band* area (a ribbon between two Y values — e.g. a
confidence interval), and the `series:` stacked-area form.

### 4.2 Visual anatomy (INFERRED)

- **Element:** a filled `<path>` — the line's path plus a closing segment back along the
  baseline (or the `yStart` edge for a band).
- **Fill:** palette color at **reduced opacity** (areas read lighter than bars/lines).
  Default fill opacity ≈ **0.7** for a solid area; when used with a line, often a gradient
  to transparent. DESIGNED default: solid fill at the series color, the framework's
  stacked areas are fully opaque and layered. Use opacity 1.0 for stacked, ~0.7 for a
  single overlay area.
- **Interpolation:** same `InterpolationMethod` system as `LineMark` — the *top edge* uses
  the chosen curve.

### 4.3 Web replication

```html
<path class="sui-areamark" stroke="none"
      fill={styleFor(series)} fill-opacity={stacked ? 1 : 0.7}
      d={areaPath(topPts, baselinePts, interp)} />
```

```ts
// areaPath = top edge (interp) forward + bottom edge (baseline or yStart) reversed, closed:
function areaPath(top, bottom, interp){
  return linePath(top, interp) + 'L' + reverse(bottom).map(p=>`${p.x},${p.y}`).join('L') + 'Z';
}
```

```tsx
interface AreaMarkProps {
  x?: PlottableValue; y?: PlottableValue;
  yStart?: PlottableValue; yEnd?: PlottableValue;   // band area (ribbon)
  xStart?: PlottableValue; xEnd?: PlottableValue;
  series?: PlottableValue;
  stacking?: StackingMethod;                          // default 'standard'
  interpolationMethod?: Interp;
  foregroundStyle?: string|GradientSpec; foregroundStyleBy?: PlottableValue;
}
```

For the signature Apple "fading area under a line" look, set
`foregroundStyle` to a vertical `linearGradient` from the series color (top) to
transparent (bottom) — DESIGNED.

---

## 5. `PointMark` (`Charts.swiftinterface:2176`)

### 5.1 Exact API (KNOWN)

```swift
@MainActor public struct PointMark {                              // 2176
  init<X,Y>(x: PlottableValue<X>, y: PlottableValue<Y>)           // 2177
  init<X>(x: PlottableValue<X>, y: CGFloat? = nil)                // 2178  (fixed-y dot strip)
  init<Y>(x: CGFloat? = nil, y: PlottableValue<Y>)                // 2179
}
```

### 5.2 Visual anatomy (INFERRED)

- **Element:** one symbol per row — default symbol is a **filled circle**.
- **Default symbol area:** ≈ **`symbolSize` 80** (square points) → radius ≈ √(80/π) ≈
  **5pt** diameter ~ a small dot. DESIGNED default `r = 4` (area ≈ 50) to match HIG
  scatter density; override via `.symbolSize(_:)` (§6).
- **Symbol shape:** override via `.symbol(_:)` with `BasicChartSymbolShape`:
  `.circle .square .triangle .diamond .pentagon .plus .cross .asterisk`
  (`Charts.swiftinterface:1804–1825`). `symbol(by:)` maps a category → distinct shapes.
- **Fill:** palette color or `foregroundStyle(by:)`.

### 5.3 Web replication

```html
<!-- circle -->
<circle class="sui-pointmark" cx={xScale(x)} cy={yScale(y)} r={Math.sqrt(area/Math.PI)}
        fill={styleFor(row)} />
<!-- non-circle symbol => <path> from the symbol shape generator -->
<path class="sui-pointmark" transform={`translate(${cx},${cy})`} d={symbolPath(shape, area)} fill={...}/>
```

```ts
// BasicChartSymbolShape → SVG path centered at origin, scaled to the given area (pt²):
const SYMBOLS = {
  circle:  (s)=>`M ${-s},0 a ${s},${s} 0 1,0 ${2*s},0 a ${s},${s} 0 1,0 ${-2*s},0`,
  square:  (s)=>`M ${-s},${-s} h ${2*s} v ${2*s} h ${-2*s} Z`,
  triangle:(s)=>`M 0,${-s} L ${s},${s} L ${-s},${s} Z`,
  diamond: (s)=>`M 0,${-s} L ${s},0 L 0,${s} L ${-s},0 Z`,
  plus:    (s)=>`M ${-s/3},${-s} h ${2*s/3} v ${2*s/3} h ${2*s/3} v ${2*s/3} h ${-2*s/3} v ${2*s/3} h ${-2*s/3} v ${-2*s/3} h ${-2*s/3} v ${-2*s/3} h ${2*s/3} Z`,
  // pentagon/cross/asterisk similar; s = sqrt(area)/2
};
```

```tsx
interface PointMarkProps {
  x?: PlottableValue; y?: PlottableValue|number;
  symbol?: BasicSymbol | ReactNode;       // .symbol(_:) shape OR custom view
  symbolBy?: PlottableValue;              // .symbol(by:) — category → shape from symbolScale
  symbolSize?: number | {width:number;height:number};  // area in pt² (default ~80)
  symbolSizeBy?: PlottableValue;
  foregroundStyle?: string; foregroundStyleBy?: PlottableValue;
}
type BasicSymbol = 'circle'|'square'|'triangle'|'diamond'|'pentagon'|'plus'|'cross'|'asterisk';
```

---

## 6. `RuleMark` (`Charts.swiftinterface:2282`) — reference lines

### 6.1 Exact API (KNOWN)

```swift
@MainActor public struct RuleMark {                                          // 2282
  init<Y>(xStart: CGFloat? = nil, xEnd: CGFloat? = nil, y: PlottableValue<Y>) // 2283  (horizontal rule at y)
  init<X,Y>(xStart: PlottableValue<X>, xEnd: PlottableValue<X>, y: PlottableValue<Y>) // 2284
  init<X>(xStart: PlottableValue<X>, xEnd: PlottableValue<X>, y: CGFloat? = nil) // 2285
  init<X>(x: PlottableValue<X>, yStart: CGFloat? = nil, yEnd: CGFloat? = nil)  // 2286  (vertical rule at x)
  init<X,Y>(x: PlottableValue<X>, yStart: PlottableValue<Y>, yEnd: PlottableValue<Y>) // 2287
  init<Y>(x: CGFloat? = nil, yStart: PlottableValue<Y>, yEnd: PlottableValue<Y>) // 2288
}
```

A `RuleMark` is a **full-span or partial-span straight line**: give `y:` (with optional
`xStart/xEnd`) for a **horizontal** reference line (threshold/average), or `x:` (with
optional `yStart/yEnd`) for a **vertical** one. Nil start/end ⇒ spans the whole plot.

### 6.2 Visual anatomy + states (INFERRED)

- **Element:** one thin `<line>`. Default stroke ≈ **1pt**, color = palette/`foregroundStyle`,
  often combined with `.lineStyle(StrokeStyle(dash:[5,5]))` for dashed thresholds and
  `.foregroundStyle(.gray)`. Used heavily for selection lollipops.

### 6.3 Web replication

```html
<line class="sui-rulemark"
      x1={xStart??plot.x0} x2={xEnd??plot.x1} y1={yScale(y)} y2={yScale(y)}
      stroke={style} stroke-width={lineWidth} stroke-dasharray={dash}/>
```

```tsx
interface RuleMarkProps {
  x?: PlottableValue; y?: PlottableValue;
  xStart?: PlottableValue|number; xEnd?: PlottableValue|number;
  yStart?: PlottableValue|number; yEnd?: PlottableValue|number;
  foregroundStyle?: string; lineStyle?: StrokeStyle;
}
```

---

## 7. `RectangleMark` (`Charts.swiftinterface:2221`) — heatmap / banded cells

### 7.1 Exact API (KNOWN)

```swift
@MainActor public struct RectangleMark {                                                       // 2221
  init<X,Y>(x: PlottableValue<X>, y: PlottableValue<Y>, width: MarkDimension = .automatic, height: MarkDimension = .automatic) // 2222
  init<X>(x: PlottableValue<X>, yStart: CGFloat? = nil, yEnd: CGFloat? = nil, width: MarkDimension = .automatic)                // 2223
  init<Y>(xStart: CGFloat? = nil, xEnd: CGFloat? = nil, y: PlottableValue<Y>, height: MarkDimension = .automatic)               // 2224
  init<X,Y>(xStart: PlottableValue<X>, xEnd: PlottableValue<X>, y: PlottableValue<Y>, height: MarkDimension = .automatic)       // 2225
  init<X>(xStart: PlottableValue<X>, xEnd: PlottableValue<X>, yStart: CGFloat? = nil, yEnd: CGFloat? = nil)                      // 2226
  init<X,Y>(x: PlottableValue<X>, yStart: PlottableValue<Y>, yEnd: PlottableValue<Y>, width: MarkDimension = .automatic)        // 2227
  init<Y>(xStart: CGFloat? = nil, xEnd: CGFloat? = nil, yStart: PlottableValue<Y>, yEnd: PlottableValue<Y>)                     // 2228
  init<X,Y>(xStart: PlottableValue<X>, xEnd: PlottableValue<X>, yStart: PlottableValue<Y>, yEnd: PlottableValue<Y>)             // 2229
  init(xStart: CGFloat? = nil, xEnd: CGFloat? = nil, yStart: CGFloat? = nil, yEnd: CGFloat? = nil)                              // 2230
}
```

Nine initializers — the most exhaustive interval grammar. `RectangleMark` is a bar
without baseline semantics: a rectangle spanning `[xStart,xEnd] × [yStart,yEnd]`. The
`x:y:` form (both categorical) is the **heatmap cell** (one rect per (x,y) category,
colored by `foregroundStyle(by:)` over a continuous value). Distinguished from `BarMark`
in that it never auto-stacks and never anchors to a zero baseline.

### 7.2 Web replication

```html
<rect class="sui-rectmark"
      x={min(xScale(x0),xScale(x1))} y={min(yScale(y0),yScale(y1))}
      width={|xScale(x1)-xScale(x0)| || resolveDim(width,bandStepX)}
      height={|yScale(y1)-yScale(y0)| || resolveDim(height,bandStepY)}
      fill={styleFor(row)} />
```

```tsx
interface RectangleMarkProps {
  x?: PlottableValue; y?: PlottableValue;
  xStart?: …; xEnd?: …; yStart?: …; yEnd?: …;
  width?: MarkDimension; height?: MarkDimension;
  foregroundStyle?: string; foregroundStyleBy?: PlottableValue;  // heatmap coloring
}
```

For a heatmap, drive `foregroundStyleBy` through a **continuous** `chartForegroundStyleScale`
(`range:` = a `Gradient`) — §9.

---

## 8. `SectorMark` (`Charts.swiftinterface:2337`) — pie / donut

### 8.1 Exact API (KNOWN)

```swift
@MainActor public struct SectorMark {                                                       // 2337
  init(angle: PlottableValue<some Plottable>,
       innerRadius: MarkDimension = .automatic, outerRadius: MarkDimension = .automatic,
       angularInset: CGFloat? = nil)                                                         // 2338
}
```

One initializer (iOS 17+). `angle:` is the value that determines each slice's **angular
sweep** (the framework normalizes the sum to 2π). `innerRadius` > 0 ⇒ **donut**;
`innerRadius: .ratio(0.6)` is the classic donut. `angularInset` is the gap (in points)
between slices. Colored by `foregroundStyle(by:)` (the category that distinguishes
slices).

### 8.2 Visual anatomy (INFERRED)

- **Element:** one annular sector (`<path>` arc) per row.
- **Outer radius:** `.automatic` ⇒ fits the plot (min(w,h)/2 minus a small margin).
- **Inner radius:** `.automatic` ⇒ **0** (solid pie). `.ratio(r)` ⇒ `r * outerR`.
- **Angular inset:** default small gap (≈1pt). Slices ordered by data; sum normalized.

### 8.3 Web replication

```html
<path class="sui-sectormark" fill={styleFor(row)}
      d={annularSectorPath(cx, cy, innerR, outerR, a0, a1, inset)} />
```

```ts
// startAngle/endAngle accumulated from normalized values; angles clockwise from 12 o'clock:
function annularSectorPath(cx,cy,ri,ro,a0,a1,inset=0){
  const pad = inset/ro;                       // angular gap in radians
  a0+=pad; a1-=pad;
  const p = (r,a)=>[cx + r*Math.sin(a), cy - r*Math.cos(a)];
  const large = (a1-a0) > Math.PI ? 1 : 0;
  const [ox0,oy0]=p(ro,a0), [ox1,oy1]=p(ro,a1), [ix1,iy1]=p(ri,a1), [ix0,iy0]=p(ri,a0);
  return ri>0
   ? `M${ox0},${oy0} A${ro},${ro} 0 ${large} 1 ${ox1},${oy1} L${ix1},${iy1} A${ri},${ri} 0 ${large} 0 ${ix0},${iy0} Z`
   : `M${cx},${cy} L${ox0},${oy0} A${ro},${ro} 0 ${large} 1 ${ox1},${oy1} Z`;
}
```

```tsx
interface SectorMarkProps {
  angle: PlottableValue;                       // slice magnitude
  innerRadius?: MarkDimension;                 // .ratio(0.6) => donut; default 0 (pie)
  outerRadius?: MarkDimension;                 // default automatic = fit
  angularInset?: number;                       // gap between slices (pt)
  foregroundStyle?: string; foregroundStyleBy?: PlottableValue;  // slice category
}
```

Selection: `chartAngleSelection(value:)` (§10) hit-tests pointer angle → selected slice.
Animate slice sweep by transitioning `a1` from `a0` on mount (DESIGNED).

---

## 9. Mark-styling modifiers (`ChartContent` extensions)

All marks conform to `ChartContent`, so these modifiers chain on any mark. Verbatim from
`Charts.swiftinterface` (extension blocks around `1350–1470`). In the web replica they are
either chained methods on a mark element or props.

### 9.1 Color / style mapping (`1350`, `1394`)

```swift
extension ChartContent {
  func foregroundStyle<S>(_ style: S) -> some ChartContent where S : ShapeStyle           // 1351
  func foregroundStyle<D>(by value: PlottableValue<D>) -> some ChartContent where D : Plottable // 1353
  func lineStyle(_ style: StrokeStyle) -> some ChartContent                                // 1390
  func lineStyle<D>(by value: PlottableValue<D>) -> some ChartContent where D : Plottable  // 1392
  func opacity(_ value: Double) -> some ChartContent                                       // 1369
}
```

- `foregroundStyle(_:)` — a fixed `ShapeStyle` (color/gradient). → `fill`/`stroke`.
- **`foregroundStyle(by:)`** — the *grammar* color encoding: the plottable category drives
  fill via the `chartForegroundStyleScale`. This is what auto-builds the legend. →
  `fill={styleScale(category)}`.
- `lineStyle(_:)` → `StrokeStyle{lineWidth,dash,lineCap,lineJoin}` → `stroke-width` +
  `stroke-dasharray` + caps.
- `opacity(_:)` → `opacity` / `fill-opacity`.

### 9.2 Position / dodging (`1364`) — grouped bars

```swift
func position<P>(by value: PlottableValue<P>, axis: Axis? = nil,
                 span: MarkDimension = .automatic) -> some ChartContent where P : Plottable // 1365
```

`position(by:)` splits each band slot into sub-slots keyed by the value → **grouped
(dodged) bars** (clustered bar chart). `axis` chooses which axis to subdivide; `span` is
how much of the slot the group occupies.

**Web (DESIGNED) — sub-band layout:** within each X band, partition `bandStep` into
`nGroups` equal sub-slots; offset each mark by its group index:
`x = bandX(cat) + groupIdx*subStep + subStep/2 - barW/2`, `barW = resolveDim(span, subStep)`.

### 9.3 Symbol (`1408`, `1422`)

```swift
func symbol<S>(_ symbol: S) -> some ChartContent where S : ChartSymbolShape   // 1409
func symbol<D>(by value: PlottableValue<D>) -> some ChartContent              // 1411
func symbol<V>(@ViewBuilder symbol: () -> V) -> some ChartContent             // 1413  (custom view)
func symbolSize(_ area: CGFloat) -> some ChartContent                         // 1423  (pt²)
func symbolSize(_ size: CGSize) -> some ChartContent                          // 1425
func symbolSize<D>(by value: PlottableValue<D>) -> some ChartContent          // 1427  (bubble chart)
```

`symbol(by:)` → category → distinct shape from the `chartSymbolScale`. `symbolSize(by:)`
→ continuous bubble sizing (area encodes magnitude). See §5.3 symbol path generator.

### 9.4 Geometry tweaks (`1453`, `1458`, `1463`)

```swift
func cornerRadius(_ radius: CGFloat, style: RoundedCornerStyle = .continuous) -> some ChartContent // 1454
func interpolationMethod(_ method: InterpolationMethod) -> some ChartContent                         // 1459
func offset(x: CGFloat = 0, y: CGFloat = 0) -> some ChartContent                                     // 1440
func zIndex(_ value: Double) -> some ChartContent                                                    // 1470
func clipShape(_ shape: some Shape, style: FillStyle = FillStyle()) -> some ChartContent             // 1389
func cornerRadius … ; func shadow(color:radius:x:y:) … (1467)                                        // shadow default Color(.sRGBLinear,white:0,opacity:0.33)
```

- `cornerRadius` → `rx`/`ry` on bar/rect (note default style `.continuous` ⇒ a squircle;
  approximate with `rx` or an SVG superellipse path for fidelity).
- `interpolationMethod` → sets the curve for the parent line/area (§1.4).
- `offset` → translate the rendered mark by pixels.
- `zIndex` → SVG paint order (reorder DOM, since SVG has no z-index).
- `shadow` default color is **`white:0, opacity:0.33`** (KNOWN, `1467`) → `filter: drop-shadow(x y r rgba(0,0,0,.33))`.

### 9.5 `annotation` (`1324`, `1338`) — labels/badges attached to a mark

```swift
func annotation<C>(position: AnnotationPosition = .automatic, alignment: Alignment = .center,
                   spacing: CGFloat? = nil, @ViewBuilder content: () -> C) -> some ChartContent // 1325
func annotation<C>(position:…, overflowResolution: AnnotationOverflowResolution, …)             // 1339
```

`AnnotationPosition` (`1289`): `.automatic .overlay .top .bottom .leading .trailing
.topLeading .topTrailing .bottomLeading .bottomTrailing`.
`AnnotationOverflowResolution` (`1311`): per-axis `Strategy` `.fit .padScale .disabled
.automatic` keeps the annotation inside the plot/chart `Boundary` `.plot .chart .automatic`.

**Web (DESIGNED):** render the annotation as an absolutely-positioned HTML overlay (or
`<text>`/`<g>` in SVG) anchored at the mark's pixel position, offset by the position enum,
then clamp into the boundary if `overflowResolution != .disabled`.

```tsx
// modifiers expressed as props OR a fluent builder:
<BarMark x={..} y={..}
  foregroundStyleBy={v('Region', r.region)}
  cornerRadius={6}
  annotation={{ position:'top', content:<Text>{r.sales}</Text> }} />
```

```ts
type AnnotationPosition = 'automatic'|'overlay'|'top'|'bottom'|'leading'|'trailing'
  |'topLeading'|'topTrailing'|'bottomLeading'|'bottomTrailing';
```

---

## 10. Axis system — `chartXAxis` / `chartYAxis` + Axis marks

### 10.1 The view modifiers (`Charts.swiftinterface:846–891`)

```swift
extension View {
  func chartXAxis(_ visibility: Visibility) -> some View                                  // 846
  func chartYAxis(_ visibility: Visibility) -> some View                                  // 848
  func chartXAxis<Content>(@AxisContentBuilder content: () -> Content) -> some View        // 853
  func chartYAxis<Content>(@AxisContentBuilder content: () -> Content) -> some View        // 855
  func chartXAxisLabel(_ labelKey: LocalizedStringKey, position: AnnotationPosition = .automatic, …) // 871
  func chartYAxisLabel(…)                                                                  // 883
}
```

`chartXAxis(.hidden)` removes the axis. `chartXAxis { AxisMarks { … } }` customizes ticks,
gridlines, and labels. `chartXAxisLabel("…")` adds the overall axis title.

### 10.2 `AxisMarks` (`781`) + the axis-mark structs

```swift
public struct AxisMarks<Content> : AxisContent where Content : AxisMark {                  // 781
  init(preset: AxisMarkPreset = .automatic, position: AxisMarkPosition = .automatic,
       values: AxisMarkValues = .automatic, @AxisMarkBuilder content: @escaping (AxisValue) -> Content) // 782
  init<Value>(preset:…, position:…, values: [Value], content:…) where Value : Plottable    // 783
  init<Format>(format: Format, preset:…, position:…, values:…, stroke: StrokeStyle? = nil) where Content == Never // 785
  // …8 inits total (782–789), incl. the bare AxisMarks() that draws default gridline+tick+label
}
```

Supporting value-types (all `Charts.swiftinterface`):
- **`AxisMarkPreset`** (`795`): `.automatic .extended .aligned .inset` — how ticks fill the
  axis extent.
- **`AxisMarkPosition`** (`811`): `.automatic .leading .trailing .top .bottom` — which edge.
- **`AxisMarkValues`** (`832`): `.automatic`, `.automatic(desiredCount:roundLowerBound:roundUpperBound:)`,
  `.stride(by: Calendar.Component, count:…)`, `.stride(by: stepSize)` — **the tick
  generator**. This is the key algorithm: `desiredCount` controls how many ticks; numeric
  `.stride(by: 10)` forces ticks every 10.
- **`AxisValue`** (`934`): `as(type)`, `.index`, `.count` — the per-tick context passed to
  the content closure.

The content closure emits any combination of three `AxisMark`s:

```swift
public struct AxisGridLine : AxisMark {                                        // 620
  init(centered: Bool? = nil, stroke: StrokeStyle? = nil)                       // 621
}
public struct AxisTick : AxisMark {                                            // 909
  init(centered: Bool? = nil, length: AxisTick.Length = .automatic, stroke: StrokeStyle? = nil) // 910
  init(centered: Bool? = nil, length: CGFloat, stroke: StrokeStyle? = nil)      // 911
  struct Length { static var automatic, label, longestLabel; func label(extendPastBy:)…; func longestLabel(extendPastBy:) } // 912
}
public struct AxisValueLabel<Content> : AxisMark where Content : View {         // 944
  init(centered: Bool? = nil, anchor: UnitPoint? = nil, multiLabelAlignment: Alignment? = nil,
       collisionResolution: AxisValueLabelCollisionResolution = .automatic, offsetsMarks: Bool? = nil,
       orientation: AxisValueLabelOrientation = .automatic,
       horizontalSpacing: CGFloat? = nil, verticalSpacing: CGFloat? = nil)      // 945
  init(_ titleKey: LocalizedStringKey, …) where Content == Text                  // 947
  init<Format>(format: Format, …) where Content == Never                         // 952
}
```

- **`AxisValueLabelOrientation`** (`969`): `.automatic .horizontal .vertical .verticalReversed` —
  rotate long labels.
- **`AxisValueLabelCollisionResolution`** (`987`): `.automatic .greedy .greedy(priority:minimumSpacing:)
  .truncate .disabled` — what to do when labels overlap.
- **`AxisTick.Length`** (`912`): `.automatic .label .longestLabel` + `extendPastBy`.

### 10.3 Visual anatomy + defaults (INFERRED)

A default axis (`AxisMarks()`) draws, per tick value: a **gridline** (full-span thin line
across the plot, `var(--sui-color-separator)`, 1px), a **tick** (short stub at the axis
edge, ≈3–4pt), and a **value label** (`text.caption1` 12px, `secondaryLabel`). X-axis
default position `.bottom`; Y-axis `.leading`. Default tick count is auto (the framework's
"nice numbers" algorithm picks ~4–6 round ticks).

### 10.4 Web replication

```html
<g class="sui-chart-yaxis">
  <!-- per tick: -->
  <line class="sui-gridline" x1={plot.x0} x2={plot.x1} y1={yScale(t)} y2={yScale(t)} />
  <line class="sui-tick" x1={plot.x0-4} x2={plot.x0} y1={yScale(t)} y2={yScale(t)} />
  <text class="sui-axislabel" x={plot.x0-6} y={yScale(t)} text-anchor="end" dominant-baseline="middle">{fmt(t)}</text>
</g>
```

Tick generation (DESIGNED — "nice numbers"):

```ts
function niceTicks(d0:number, d1:number, desired=5):number[] {
  const span = niceNum(d1-d0, false), step = niceNum(span/(desired-1), true);
  const lo = Math.floor(d0/step)*step, hi = Math.ceil(d1/step)*step;
  const out=[]; for (let v=lo; v<=hi+1e-9; v+=step) out.push(v); return out;
}
// stride(by:N) overrides: ticks at multiples of N. For Date: stride by calendar component.
// band (categorical) axis: one tick per category, label centered in band.
```

```tsx
// React axis config mirrors AxisMarks:
<Chart.XAxis position="bottom" values={{ stride: 10 }}            /* AxisMarkValues.stride(by:10) */
             gridline={{ stroke:{dash:[2,2]} }}                   /* AxisGridLine */
             tick={{ length:'automatic' }}                        /* AxisTick */
             label={{ orientation:'vertical', collision:'truncate', format:fmtFn }} /* AxisValueLabel */ />
<Chart.YAxis visibility="visible" />
<Chart.XAxisLabel position="bottom">Month</Chart.XAxisLabel>
```

```ts
type AxisMarkPosition='automatic'|'leading'|'trailing'|'top'|'bottom';
type AxisMarkValues={automatic:true}|{desiredCount?:number}|{stride:number}|{strideBy:CalendarComponent,count?:number}|number[];
type LabelOrientation='automatic'|'horizontal'|'vertical'|'verticalReversed';
type Collision='automatic'|'greedy'|'truncate'|'disabled';
```

**CSS:**

```css
.sui-gridline  { stroke: var(--sui-color-separator); stroke-width: 1; }
.sui-tick      { stroke: var(--sui-color-separator); stroke-width: 1; }
.sui-axislabel { font: 400 12px/16px var(--sui-font-system); fill: var(--sui-color-secondary-label); }
```

---

## 11. Scales — `chartXScale` / `chartYScale` / `chartForegroundStyleScale` / `chartSymbolScale`

### 11.1 Position scales (`Charts.swiftinterface:2756–2770`)

```swift
extension View {
  func chartXScale<Domain, Range>(domain: Domain, range: Range, type: ScaleType? = nil) -> some View  // 2756
  func chartXScale<Domain>(domain: Domain, type: ScaleType? = nil) -> some View                        // 2758
  func chartXScale<Range>(range: Range, type: ScaleType? = nil) -> some View                           // 2760
  func chartXScale(type: ScaleType? = nil) -> some View                                                // 2762
  func chartYScale(…)  // 2764–2770  (same 4 overloads)
}
```

`ScaleType` (`2639`): `.linear .log .date .category .squareRoot .symmetricLog`. `domain:`
is usually a `ClosedRange` (numeric) e.g. `chartYScale(domain: 0...100)` or an array of
categories. `range:` (a `PositionScaleRange`) lets you flip/clip the pixel range
(`.plotDimension(startPadding:endPadding:)`).

### 11.2 Style/symbol scales (`2787–2817`)

```swift
func chartForegroundStyleScale<Domain, Range>(domain: Domain, range: Range, type: ScaleType? = nil) -> some View // 2787
func chartForegroundStyleScale<DataValue, S>(_ mapping: KeyValuePairs<DataValue, S>) -> some View                // 2795
func chartForegroundStyleScale<Domain, S>(domain: Domain, mapping: @escaping (Domain.Element) -> S) -> some View // 2797
func chartSymbolScale<Domain, Range>(domain: Domain, range: Range) -> some View                                  // 2801
func chartSymbolScale<DataValue, S>(_ mapping: KeyValuePairs<DataValue, S>) -> some View                         // 2811
```

These bind the category domain (from `foregroundStyle(by:)` / `symbol(by:)`) to a concrete
visual range — the **color palette** or **symbol set**, or a continuous **`Gradient`** for
heatmaps. `KeyValuePairs` form is the explicit map:
`chartForegroundStyleScale(["A": .red, "B": .blue])`.

### 11.3 Web replication (DESIGNED)

```ts
function makeStyleScale(spec){
  if (spec.mapping) return (k)=>spec.mapping[k];                 // KeyValuePairs / dict
  if (spec.range && spec.domain) {                              // domain[] -> range[]
    const m = new Map(spec.domain.map((d,i)=>[d, spec.range[i % spec.range.length]]));
    return (k)=> m.get(k) ?? DEFAULT_PALETTE[0];
  }
  return (k,i)=> DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];   // automatic: cycle palette
}
// continuous (heatmap): range is a Gradient -> interpolate stops by normalized value.
```

```tsx
<Chart data={rows}
  xScale={{ domain:[0,12], type:'linear' }}
  yScale={{ domain:[0,100] }}
  foregroundStyleScale={{ mapping:{ Asia:'#0A84FF', Europe:'#30D158' } }}
  symbolScale={{ mapping:{ Asia:'circle', Europe:'square' } }} >
```

```ts
type ScaleType='linear'|'log'|'date'|'category'|'squareRoot'|'symmetricLog';
```

---

## 12. `ChartProxy` + `chartOverlay` / `chartBackground` (interaction surface)

### 12.1 API (`Charts.swiftinterface:1661`, `1726`)

```swift
public struct ChartProxy {                                                              // 1661
  func position<P>(forX value: P) -> CGFloat? where P : Plottable                        // value -> pixel x
  func position<P>(forY value: P) -> CGFloat?
  func position<X,Y>(for point: (x: X, y: Y)) -> CGPoint?
  func positionRange<P>(forX value: P) -> ClosedRange<CGFloat>?                           // band slot extent
  func value<P>(atX position: CGFloat, as: P.Type = P.self) -> P?                          // pixel -> value (invert)
  func value<P>(atY position: CGFloat, as: P.Type = P.self) -> P?
  func value<X,Y>(at position: CGPoint, as: (X,Y).Type) -> (X,Y)?
  var plotSize: CGSize { get }   // (plotAreaSize deprecated -> plotSize)
  var plotAreaFrame: Anchor<CGRect> { get }  // (deprecated -> plotFrame)
}
extension View {
  func chartOverlay<V>(alignment: Alignment = .center, content: @escaping (ChartProxy) -> V) -> some View  // 1726
  func chartBackground<V>(alignment: Alignment = .center, content: @escaping (ChartProxy) -> V) -> some View // 1728
}
```

`ChartProxy` is the **scale bridge** handed to overlay/background closures: it exposes
`position(forX:)`/`value(atX:)` so you can convert between data and pixels for custom hit
testing, crosshairs, drag handlers, and tooltips. `chartOverlay` draws *above* marks
(gestures/tooltips); `chartBackground` draws *below* (custom fills/watermarks).

### 12.2 Web replication (DESIGNED)

The `Chart` already computes scales; expose them as the `ChartProxy` equivalent and pass
to overlay/background render-props:

```tsx
interface ChartProxy {
  positionForX(v:any): number|null;  positionForY(v:any): number|null;
  positionFor(p:{x:any;y:any}): {x:number;y:number}|null;
  valueAtX(px:number): any|null;     valueAtY(px:number): any|null;   // scale.invert
  plotSize: {width:number;height:number};
  plotFrame: {x:number;y:number;width:number;height:number};
}
<Chart …>
  …marks…
  <ChartOverlay>{(proxy)=> (
    <rect /* gesture surface over the plot */ onPointerMove={e=>{
      const x = proxy.valueAtX(e.nativeEvent.offsetX - proxy.plotFrame.x);
      setSelected(x);
    }}/>
  )}</ChartOverlay>
</Chart>
```

Overlay content renders into the SVG `<g class="sui-chart-overlay">` placed *after* marks;
background into one placed *before* gridlines.

---

## 13. Selection — `chartXSelection` / `chartYSelection` / `chartAngleSelection`

### 13.1 API (`Charts.swiftinterface:2848–2856`)

```swift
func chartXSelection<P>(value: Binding<P?>) -> some View where P : Plottable                       // 2848
func chartXSelection<P>(range: Binding<ClosedRange<P>?>) -> some View where P : Comparable          // 2850
func chartYSelection<P>(value: Binding<P?>) -> some View                                            // 2852
func chartAngleSelection<P>(value: Binding<P?>) -> some View                                        // 2856  (pie/donut)
```

iOS 17+. Binds a `@State var selected: P?` to **tap/drag selection** — the framework
hit-tests the pointer to the nearest domain value and writes it back. `range:` form is a
brushing/range selection. `chartAngleSelection` hit-tests the pointer angle for sectors.

### 13.2 Behavior + web replication (DESIGNED)

- **`value`**: on pointer move/tap, invert pointer-x → nearest category/value → fire
  `onSelectionChange`. The selected mark is emphasized (full opacity) and others dimmed
  (the caller usually adds a `RuleMark` lollipop at the selection).
- **`range`**: pointer drag defines `[lo,hi]`; render a translucent band over the plot.
- **`angle`**: `atan2(dy,dx)` from plot center → which slice's `[a0,a1]` contains it.

```tsx
<Chart … xSelection={{ value: selected, onChange: setSelected }}>
// internally: an invisible full-plot <rect> captures pointer; computes
// nearest = xScale.invert(px) snapped to the nearest domain value.
```

For dim-others emphasis: when a selection exists, set non-selected marks to
`opacity: 0.3` (DESIGNED, matches HIG selection emphasis).

---

## 14. `chartLegend` (`Charts.swiftinterface:1831`)

### 14.1 API (KNOWN)

```swift
func chartLegend<Content>(position: AnnotationPosition = .automatic, alignment: Alignment? = nil,
                          spacing: CGFloat? = nil, @ViewBuilder content: () -> Content) -> some View // 1831
func chartLegend(position: AnnotationPosition = .automatic, alignment: Alignment? = nil, spacing: CGFloat? = nil) -> some View // 1833
func chartLegend(_ visibility: Visibility) -> some View                                              // 1835
```

`chartLegend(.hidden)` removes it; `chartLegend(position: .top)` repositions; the builder
form supplies a fully custom legend view.

### 14.2 Anatomy + web (INFERRED/DESIGNED)

A legend auto-appears when a `foregroundStyle(by:)` or `symbol(by:)` style scale exists.
One **swatch + label** per domain category: swatch = colored dot/line/symbol matching the
mark type (filled circle for bar/point/area, short line for line marks). Label =
`text.caption1` `secondaryLabel`. Default position below the plot, centered.

```html
<div class="sui-chart-legend">
  <span class="sui-legend-item">
    <span class="sui-legend-swatch" style="background:var(--c)"></span>
    <span class="sui-legend-label">Asia</span>
  </span>
  …
</div>
```

```css
.sui-chart-legend { display:flex; gap:16px; justify-content:center; margin-top:8px; }
.sui-legend-item  { display:inline-flex; align-items:center; gap:6px;
  font:400 12px/16px var(--sui-font-system); color:var(--sui-color-secondary-label); }
.sui-legend-swatch{ width:8px; height:8px; border-radius:50%; }  /* circle for bar/point/area */
/* line-mark swatch: a 12x2 rounded bar instead of a dot */
```

```tsx
type LegendSpec = { position?:AnnotationPosition; visible?:boolean; items?:{key:string;color:string;shape:string}[] };
// <Chart legend="hidden">  |  <Chart legend={{ position:'top' }}>
```

---

## 15. `Axis` enum (SwiftUICore, `SwiftUICore.swiftinterface:2440`)

```swift
@frozen public enum Axis : Int8, CaseIterable {                  // 2440
  case horizontal                                                // rawValue 0
  case vertical                                                  // rawValue 1
  @frozen public struct Set : OptionSet {                        // 2454
    public static let horizontal: Axis.Set                        // chartScrollableAxes(.horizontal)
    public static let vertical: Axis.Set
  }
}
```

Used by `position(by: axis:)`, `chartScrollableAxes(_:)`. Web: a string union
`type Axis = 'horizontal'|'vertical'` and a set `Axis[]`.

---

## 16. Scrolling (`Charts.swiftinterface:1109–1141`, `1176`)

`chartScrollableAxes(_:)`, `chartXVisibleDomain(length:)`, `chartScrollPosition(x:)`,
`chartScrollTargetBehavior(_:)`, `ValueAlignedChartScrollTargetBehavior` — make a wide
chart horizontally scrollable with a fixed visible window and snap-to-value paging.

**Web (DESIGNED):** wrap the `<svg>` in an `overflow-x:auto` scroller; set the SVG width to
`totalDomainWidth` and the viewport to the container; `chartXVisibleDomain(length:)` →
`svgWidth = containerWidth * (fullDomain/visibleDomain)`. `scroll-snap-type: x mandatory`
+ per-category snap points replicate `ValueAlignedChartScrollTargetBehavior`.

```tsx
<Chart scrollableAxes={['horizontal']} xVisibleDomain={7} scrollPosition={{x:date, onChange:setX}}
       scrollTargetBehavior="valueAligned">
```

---

## 17. Tabulated long tail

### 17.1 `*Plot` vectorized mark variants (iOS 18+) — `_data_-first, KeyPath-bound marks`

These are the **bulk-data** equivalents of the marks above: instead of `Chart(data){ row in
BarMark(...) }` (one mark per element through `ForEach`), you write `BarPlot(data, x: \.month,
y: \.sales)` — the whole series is one vectorized content node bound by `PlottableProjection`
/ `KeyPath`. Same visual output, faster for large N. The web replica's data-driven
`<Chart data>` form already vectorizes (maps rows once), so these map to the **same**
mark components — no separate API needed; expose `xKey`/`yKey` keypath-style props as an
optimization.

| Type | Line | Mirrors | Web equivalent |
|---|---|---|---|
| `BarPlot<Content>` | 1921 | BarMark, KeyPath-bound, whole series | `<BarMark>` over `data` (xKey/yKey) |
| `LinePlot<Content>` | 1974 | LineMark vectorized | `<LineMark>` over `data` |
| `AreaPlot<Content>` | 1852 | AreaMark vectorized | `<AreaMark>` over `data` |
| `PointPlot<Content>` | 2190 | PointMark vectorized | `<PointMark>` over `data` |
| `RectanglePlot<Content>` | 2237 | RectangleMark vectorized | `<RectangleMark>` over `data` |
| `RulePlot<Content>` | 2295 | RuleMark vectorized | `<RuleMark>` over `data` |
| `SectorPlot<Content>` | 2345 | SectorMark vectorized | `<SectorMark>` over `data` |
| `Plot<Content>` | 1750 | groups ChartContent into one node | a fragment wrapper `<Plot>` |
| `VectorizedBarPlotContent<Data>` | 1956 | internal body of BarPlot | (impl detail) |
| `VectorizedLinePlotContent<Data>` | 2016 | internal body of LinePlot | (impl detail) |
| `VectorizedAreaPlotContent<Data>` | 1898 | internal body of AreaPlot | (impl detail) |
| `VectorizedPointPlotContent<Data>` | 2213 | internal body of PointPlot | (impl detail) |
| `VectorizedRectanglePlotContent<Data>` | 2274 | internal body of RectanglePlot | (impl detail) |
| `VectorizedRulePlotContent<Data>` | 2329 | internal body of RulePlot | (impl detail) |
| `VectorizedSectorPlotContent<Data>` | 2365 | internal body of SectorPlot | (impl detail) |
| `VectorizedChartContent` (protocol) | 1221 | adds `DataElement` assoc-type to ChartContent | the keypath-modifier overloads |
| `PlottableProjection<DataElement,DataValue>` | 2588 | a KeyPath→Plottable binding | `(row)=>v(label, row[key])` |
| `MarkDimensions<DataElement>` | 2105 | per-element MarkDimension via KeyPath | `MarkDimension | (row)=>MarkDimension` |

### 17.2 Function plots (`LinePlot`/`AreaPlot` math-function forms)

| Type / init | Line | Purpose | Web equivalent |
|---|---|---|---|
| `LinePlot(x:y:domain:function:)` | 1986 | plot `y = f(x)` over a domain | sample `f` across domain → `<LineMark>` points |
| `LinePlot(...t:...function:)` (parametric) | 1991 | parametric `(x(t),y(t))` | sample `t` → point list |
| `AreaPlot(x:yStart:yEnd:domain:function:)` | 1880 | area between two functions | sample → band `<AreaMark>` |
| `FunctionLinePlotContent` | 2009 | internal body of function LinePlot | (impl) |
| `FunctionAreaPlotContent` | 1891 | internal body of function AreaPlot | (impl) |

DESIGNED: `<FunctionLineMark fn={x=>Math.sin(x)} domain={[0,6.28]} samples={200} />` → sample
`samples` points, build a `<path>` exactly like §3.

### 17.3 3D charts (iOS 26 / visionOS — out of scope for a 2D web kit)

| Type | Line | Purpose | Web equivalent |
|---|---|---|---|
| `Chart3D<Content>` | 358 | 3D chart container (RealityKit-backed) | **not replicated** (needs WebGL/Three.js; out of scope) |
| `Chart3DContent` (protocol) | 378 | 3D content node | — |
| `Chart3DContentBuilder` | 393 | result builder for 3D | — |
| `SurfacePlot` | 154 | `z = f(x,y)` surface | WebGL surface (future) |
| `Chart3DPose` | 252 | camera pose `.default/.front/.back/.top/.bottom/.left/.right` (azimuth,inclination) | Three.js camera preset |
| `Chart3DCameraProjection` | 212 | perspective/orthographic | camera type |
| `Chart3DSymbolShape` (protocol) | 425 | 3D point symbol | — |
| `_Chart3DContentModifier` (protocol) | 172 | private 3D modifier | — |

**Decision:** the web kit targets 2D SVG. 3D is documented here for completeness but
**not** in the deliverable component set; stub `<Chart3D>` to throw "not supported on web."

### 17.4 Type-erasers, builders, protocols, private plumbing (not user-facing impl)

| Type | Line | Role | Web note |
|---|---|---|---|
| `ChartContent` (protocol) | 1190 | base protocol all marks conform to | base `MarkElement` type |
| `AnyChartContent` | 1629 | type-eraser for ChartContent | `ReactNode` (already erased) |
| `ChartContentBuilder` | 1475 | result builder (`Chart { … }`) | JSX children |
| `AxisContent` (protocol) | 510 | base for axis content | axis config object |
| `AnyAxisContent` | 524 | eraser for AxisContent | — |
| `AxisContentBuilder` | 549 | result builder for `chartXAxis { }` | axis children |
| `AxisMark` (protocol) | 628 | base for gridline/tick/label | axis-mark config |
| `AnyAxisMark` | 657 | eraser for AxisMark | — |
| `AxisMarkBuilder` | 696 | result builder for axis marks | — |
| `ChartAxisContent` (View) | 495 | the rendered axis view (chartXAxisStyle) | `<g class=sui-chart-xaxis>` |
| `ChartPlotContent` (View) | 1648 | the rendered plot area (chartPlotStyle) | `<g class=sui-chart-plot>` |
| `ChartScrollTargetBehavior` (protocol) | 1139 | scroll snapping | scroll-snap config |
| `ChartScrollTargetBehaviorContext` | 1130 | proxy for scroll behavior | — |
| `ValueAlignedChartScrollTargetBehavior` | 1176 | snap to value | `scroll-snap-align` per category |
| `Plottable` / `PrimitivePlottableProtocol` / `_PrimitivePlottableKind` | 2374/2380/2391 | value→coordinate conformance | `plottableKind()` (§1.1) |
| `ChartBinRange` | 1006 | a histogram bin's range (RangeExpression) | `{lo,hi}` interval |
| `PlotDimensionScaleRange` | 2741 | a `PositionScaleRange` describing the plot's pixel extent with start/end padding for a scale | the `range:[number,number]` + `startPadding`/`endPadding` on a `Scale` (§0.4) |

**Private view-graph plumbing structs (the framework's internal two-phase
layout/render machinery — NOT user API; the web replica's `render()` replaces all of
them, so each maps to "none"):** `_AxisContentInputs` (514), `_AxisContentOutputs` (517),
`_AxisMarkCollectInputs` (635), `_AxisMarkCollectOutputs` (638), `_AxisMarkLayoutInputs`
(641), `_AxisMarkRenderInputs` (644), `_AxisMarkRenderOutputs` (647),
`_Chart3DContentInputs` (452), `_Chart3DContentOutputs` (457), `_ChartContentInputs`
(2970), `_ChartContentOutputs` (2976), `_ChartContentCollectInputs` (2973),
`_ChartContentCollectOutputs` (2979), `_ChartContentLayoutInputs` (1207),
`_ChartContentRenderInputs` (1210), `_ChartContentRenderOutputs` (1213),
`_ChartContentModifier` (protocol, 2894), `_Chart3DContentModifier` (protocol, 172). These
are the typed payloads passed through Charts' `_layoutChartContent` / `_renderChartContent`
/ `_collectChartContent` / `_makeAxisContent` static requirements seen on every mark and
axis-mark; they carry the resolved scales, plot rect, and graph state between phases. The
web replica fuses both phases into a single React render that reads `ChartContext`.

### 17.5 Non-Charts protocols in the cluster (cross-module)

| Type | Module | Line | Role | Web note |
|---|---|---|---|---|
| `AXChartDescriptorRepresentable` (protocol) | SwiftUICore | 5867 | accessibility — exposes chart data to VoiceOver via `AXChartDescriptor` | ARIA: `role="img"` + `aria-label` summary, or an offscreen `<table>` of the data (DESIGNED) |
| `_LimitedAvailabilitySceneMarker` (protocol) | SwiftUI | 16818 | private availability marker (Scene) | none |
| `_LimitedAvailabilityWidgetMarker` (protocol) | SwiftUI | 21152 | private availability marker (Widget) | none |

### 17.6 Mark accessibility modifiers (`ChartContent`, `1225–1283`)

`accessibilityLabel(_:)`, `accessibilityValue(_:)`, `accessibilityHidden(_:)`,
`accessibilityIdentifier(_:)` (+ KeyPath-bound vectorized variants). → per-mark
`aria-label` / `aria-hidden` / `data-testid` on the emitted SVG element. The chart-level
`AXChartDescriptorRepresentable` provides the overall accessible structure (above).

---

## 18. Assembly & calibration notes

**Render order in the SVG (back→front), DESIGNED:** `chartBackground` → gridlines →
axis ticks/labels → marks (in declaration order, then `zIndex`) → `chartOverlay`. Legend
is sibling HTML below.

**Default constants captured (KNOWN from interface unless noted):**
- `MarkStackingMethod` default `.standard`; `MarkDimension` default `.automatic`.
- `InterpolationMethod`: `cardinal` tension **0**, `catmullRom` α **0.5**, step transitions
  **0/0.5/1**; mark default interpolation `.linear` (INFERRED).
- `shadow` default color `rgba(0,0,0,0.33)` (KNOWN, sRGBLinear white:0 opacity:0.33).
- Bar paddingInner ≈ **0.2** (DESIGNED, matches Charts gaps); default bar cornerRadius
  **4** (DESIGNED); line stroke **2pt**, point area **~80pt²**, rule **1pt** (INFERRED).
- Default palette (INFERRED, system color cycle):
  `#0A84FF #30D158 #FF9F0A #BF5AF2 #FF453A #64D2FF #FFD60A #FF375F`.
- Axis labels `text.caption1` 12px `secondaryLabel`; gridlines/ticks `separator` 1px.

**Calibration plan:** render the same dataset in real Swift Charts (screenshot via a SwiftUI
preview) and in the web replica; diff (a) plot-rect insets, (b) bar widths/gaps for a
known band count, (c) tick values & label positions from the "nice numbers" generator,
(d) line interpolation paths for each `InterpolationMethod`, (e) palette hex per series,
(f) legend layout. Iterate `paddingInner`, gutter sizes, tick `desiredCount`, and the
cornerRadius default until pixel-diff < 2px on axes and < 1px on mark geometry.

**Visual priority (per brief):** charts are lower visual-priority than the UIKit-look
clusters, but the **mark API is covered in full** (every initializer + every styling
modifier) so the next agent can write `<BarMark>/<LineMark>/<AreaMark>/<PointMark>/
<RuleMark>/<RectangleMark>/<SectorMark>` and the `<Chart>` scale engine directly from
this spec. Axis/scale modifiers tabulated with their exact enum cases and line cites.

**web_ready=true** — every deep-covered component (`Chart`, the 7 marks, the styling
modifiers, axes, scales, proxy/overlay, selection, legend) has its HTML structure + CSS +
React prop API. 3D is explicitly out of scope; vectorized `*Plot` variants collapse onto
the same mark components via the data-driven `<Chart data>` form.
