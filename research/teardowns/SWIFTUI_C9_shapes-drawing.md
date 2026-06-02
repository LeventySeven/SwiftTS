# SwiftUI Cluster C9 — Shapes & Drawing — RE Teardown / Web-Replica Spec

**Goal:** pixel-1:1 web replica of SwiftUI's shape & drawing primitives as a TS/React (Next.js) UI kit.
**Source of truth:** the `.swiftinterface` text for SwiftUICore / SwiftUI / Charts (macOS 26 SDK). Every signature below is quoted verbatim with a `file:line` cite. Labels: **KNOWN** = read from the interface; **INFERRED** = from Apple docs / HIG / RE of rendered output; **DESIGNED** = our engineering for a proprietary gap (e.g. the continuous-corner squircle, which the interface only names, never defines).

**Cite shorthand:** `SUICore:N` = SwiftUICore interface line N; `SUI:N` = SwiftUI interface line N; `Charts:N` = Charts interface line N.

**The central insight for the Apple look:** every rounded-rect initializer in this cluster defaults `style: .continuous` (`SUICore:10005`, `:10006`, `:10199`, `:10203`, `:10228`, `:10248`, `:10287`). "Continuous" = a superellipse/squircle corner, NOT CSS's pure quarter-circle `border-radius`. Getting this right is the single highest-leverage fidelity decision in the whole kit. The squircle section (§4) is therefore load-bearing; treat it as the default corner renderer, not an afterthought.

**The render contract (KNOWN, `SUICore:9592-9600`):** a `Shape` is fundamentally a function `path(in: CGRect) -> Path`. Everything else (Rectangle, Circle, RoundedRectangle, the transformed wrappers, even Charts symbols) is just a different body for that one function, then drawn through `_ShapeView<Content, Style>` (`SUICore:17630`) which pairs the path with a `ShapeStyle` + `FillStyle`. Web mapping is therefore uniform: **every shape compiles to an SVG `<path d=…>` (or a `clip-path`), and the style compiles to `fill` / `stroke` / a CSS gradient.** Build one `<Shape>` renderer that takes a `pathIn(rect)` callback and a style, and every concrete shape is a thin wrapper that supplies the callback.

---

## 0. Coverage map (what is deep-covered vs. tabulated)

**Deep-covered (full API + anatomy + behavior + HTML/CSS/prop-API):**
`Shape` protocol · `Path` · `Rectangle` · `RoundedRectangle` (+ `.continuous` squircle math) · `UnevenRoundedRectangle` · `RectangleCornerRadii` · `ConcentricRectangle` · `ContainerRelativeShape` · `Circle` · `Ellipse` · `Capsule` · `AnyShape` · `InsettableShape` + `strokeBorder` · transformed shapes (`OffsetShape`/`ScaledShape`/`RotatedShape`/`TransformedShape`) · `_StrokedShape`/`stroke` · `_TrimmedShape`/`trim` · `StrokeStyle` · `FillStyle` · `fill` · `Canvas` · `GraphicsContext` · `Gradient` (+`Stop`,`ColorSpace`) · `LinearGradient` · `RadialGradient` · `AngularGradient` · `EllipticalGradient` · `AnyGradient` · `MeshGradient` · `ButtonBorderShape` · the `ShapeView` family (`_ShapeView`/`FillShapeView`/`StrokeShapeView`/`StrokeBorderShapeView`).

**Tabulated (named ShapeStyle tokens, internal wrappers, Charts symbols, boolean-op shapes) — §15.** These are either (a) semantic color tokens already specified in the W1 colors token file, (b) private `_`-prefixed implementation wrappers a web kit re-expresses as a prop, or (c) Charts-only. Each gets a one-line purpose + web-equivalent so nothing is silently dropped.

---

## 1. `Shape` protocol — the path(in:) primitive — KNOWN

### 1.1 Exact API (`SUICore:9592-9600`)

```swift
public protocol Shape : Swift.Sendable, SwiftUICore.Animatable, SwiftUICore.View, SwiftUICore._RemoveGlobalActorIsolation {
  nonisolated func path(in rect: CoreFoundation.CGRect) -> SwiftUICore.Path          // SUICore:9593  — the ONE required method
  static var role: SwiftUICore.ShapeRole { get }                                      // SUICore:9595  — fill | stroke | separator
  var layoutDirectionBehavior: SwiftUICore.LayoutDirectionBehavior { get }            // SUICore:9597  — mirror in RTL?
  func sizeThatFits(_ proposal: SwiftUICore.ProposedViewSize) -> CoreFoundation.CGSize // SUICore:9599
}
```

Defaults supplied by extensions:
- `role` defaults to `.fill` (`SUICore:9629-9634`).
- `sizeThatFits` default returns the proposal replaced with a sensible size (`SUICore:9606-9608`) — a shape with no intrinsic size fills whatever it's offered (`Circle` overrides to stay square, `SUICore:10360`).
- `layoutDirectionBehavior` default (`SUICore:9640-9643`) — most shapes are symmetric so it's `.fixed`; asymmetric ones (`Rectangle`, `RoundedRectangle`, `Capsule`, `Ellipse`, `Circle`) override to `.mirrors` so leading/trailing flips under RTL.

```swift
public enum ShapeRole : Swift.Sendable {  // SUICore:9614-9623
  case fill
  case stroke
  case separator
}
```

**Hidden logic behind the protocol:** a `Shape` IS a `View` (it conforms to `View`). When you put a bare `Circle()` in a view tree, SwiftUI wraps it as `_ShapeView<Circle, ForegroundStyle>` (see every shape's `typealias Body`, e.g. `SUICore:10352`) and fills it with the inherited foreground style. So an unstyled shape paints itself in `Color.primary`/the foreground style, full-bleed, at the offered size. The `path(in:)` is always evaluated in the shape's **own** coordinate space with origin `(0,0)` and the offered size.

### 1.2 Visual anatomy
A shape has no chrome of its own — it's a single filled (or stroked) region. Default paint = the environment's foreground style (`color.label` / `Color.primary` ≈ `var(--sui-color-label)`). No border, no shadow, no padding unless composed.

### 1.3 Web replication mapping

The universal shape renderer. Every concrete shape supplies a `pathIn(w, h)` that returns an SVG path `d` string (our `Path` builder, §2). The renderer wraps it in a responsive `<svg>` that fills its box:

```tsx
// Shape.tsx — the one renderer all concrete shapes reuse
type ShapeRole = 'fill' | 'stroke' | 'separator';
interface ShapeProps {
  pathIn: (w: number, h: number) => string;   // d-string in the shape's own px coords
  role?: ShapeRole;
  fill?: string;     // any CSS paint: a color var, or a url(#gradId), default var(--sui-color-label)
  stroke?: string;
  strokeStyle?: StrokeStyleProps;              // §9
  fillRule?: 'nonzero' | 'evenodd';
  className?: string;
}
```

```tsx
export function Shape({ pathIn, fill = 'var(--sui-color-label)', stroke, strokeStyle, fillRule = 'nonzero', className }: ShapeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current!; const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const d = size.w && size.h ? pathIn(size.w, size.h) : '';
  return (
    <div ref={ref} className={className} style={{ display: 'block', width: '100%', height: '100%' }}>
      <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}
           style={{ display: 'block', overflow: 'visible' }}>
        <path d={d} fill={stroke ? 'none' : fill} fillRule={fillRule}
              stroke={stroke} {...strokeAttrs(strokeStyle)} />
      </svg>
    </div>
  );
}
```

**Why a measured SVG and not pure CSS:** SwiftUI shapes are resolution-independent and evaluated against the live offered size; only an SVG path recomputed on resize reproduces that. For the *simple* cases (Rectangle/RoundedRectangle/Circle/Capsule as a plain fill) you can shortcut to a `<div>` with `border-radius`/`clip-path` (faster, no JS) — see each shape's section for the CSS shortcut AND the exact SVG path. Use the SVG path whenever you need `.continuous` corners, `trim`, `stroke` dashing, or boolean ops.

---

## 2. `Path` — the vector geometry builder — KNOWN

`Path` is the imperative drawing buffer every `Shape.path(in:)` returns. It is the direct analog of an SVG path `d` string (and is in fact backed by a `CGPath`, `SUICore:10015`).

### 2.1 Exact API — initializers (`SUICore:9978-10011`)

```swift
@frozen public struct Path : Equatable, LosslessStringConvertible, @unchecked Sendable {  // SUICore:9978
  public init()                                                                              // :10001 empty
  public init(_ path: CGPath)                                                                // :10002
  public init(_ path: CGMutablePath)                                                          // :10003
  public init(_ rect: CGRect)                                                                 // :10004 rectangle
  public init(roundedRect rect: CGRect, cornerSize: CGSize, style: RoundedCornerStyle = .continuous)   // :10005
  public init(roundedRect rect: CGRect, cornerRadius: CGFloat, style: RoundedCornerStyle = .continuous) // :10006
  public init(roundedRect rect: CGRect, cornerRadii: RectangleCornerRadii, style: RoundedCornerStyle = .continuous) // :10008
  public init(ellipseIn rect: CGRect)                                                         // :10009
  public init(_ callback: (inout Path) -> ())                                                 // :10010 builder closure
  public init?(_ string: String)                                                             // :10011 parse an SVG-ish string
}
```

### 2.2 Drawing commands (`SUICore:10090-10126`) — these map 1:1 to SVG path commands

| Swift method | `SUICore` line | SVG `d` command |
|---|---|---|
| `move(to: p)` | :10091 | `M px py` |
| `addLine(to: p)` | :10092 | `L px py` |
| `addQuadCurve(to: p, control: c)` | :10093 | `Q cx cy px py` |
| `addCurve(to: p, control1: c1, control2: c2)` | :10094 | `C c1x c1y c2x c2y px py` |
| `closeSubpath()` | :10095 | `Z` |
| `addRect(_ rect, transform:)` | :10096 | `M…L…L…L…Z` |
| `addRoundedRect(in:cornerSize:style:transform:)` | :10097 | rounded-rect path (squircle if `.continuous`, §4) |
| `addRoundedRect(in:cornerRadii:style:transform:)` | :10099 | per-corner rounded rect |
| `addEllipse(in: rect, transform:)` | :10100 | two `A` arcs |
| `addRects(_ [rect])` / `addLines(_ [pt])` | :10101/:10102 | repeated subpaths / polyline |
| `addRelativeArc(center:radius:startAngle:delta:transform:)` | :10103 | `A` |
| `addArc(center:radius:startAngle:endAngle:clockwise:transform:)` | :10104 | `A` (with sweep computed from start/end) |
| `addArc(tangent1End:tangent2End:radius:transform:)` | :10105 | arc-to-tangent (CG semantics) |
| `addPath(_ path, transform:)` | :10106 | append sub-path |

Element readback (`SUICore:10025-10033`):
```swift
@frozen public enum Element : Equatable {       // SUICore:10025
  case move(to: CGPoint)                         // :10026
  case line(to: CGPoint)                         // :10027
  case quadCurve(to: CGPoint, control: CGPoint)  // :10028
  case curve(to: CGPoint, control1: CGPoint, control2: CGPoint) // :10029
  case closeSubpath                              // :10030
}
public func forEach(_ body: (Element) -> Void)   // :10033 — iterate elements
```

Queries / derived paths:
- `var isEmpty`, `var boundingRect`, `var currentPoint` (`:10018`,`:10021`,`:10107`).
- `func contains(_ p:, eoFill:Bool=false) -> Bool` (`:10024`) — hit testing (SVG: `isPointInFill`).
- `func strokedPath(_ style: StrokeStyle) -> Path` (`:10034`) — outline a stroke into a fillable path.
- `func trimmedPath(from:to:) -> Path` (`:10035`) — sub-segment by arc-length fraction (drives `trim`, §8).
- Boolean ops (iOS 17+, `:10110-10123`): `normalized(eoFill:)`, `intersection`, `union`, `subtracting`, `symmetricDifference`, `lineIntersection`, `lineSubtraction`. All take `eoFill: Bool`.
- `applying(_ CGAffineTransform)` (`:10124`), `offsetBy(dx:dy:)` (`:10125`).

Backing storage (KNOWN, `SUICore:9987-9996`) is an enum optimized per-case — `.empty`, `.rect`, `.ellipse`, `.roundedRect`, `.path(box)` — so common shapes don't allocate a full element list. Web replica doesn't need this; just build the `d` string.

### 2.3 Visual anatomy / behavior
`Path` itself draws nothing until placed in a `_ShapeView` (its `Body`, `SUICore:10054`). Coordinate system: **y-down**, origin top-left of the offered rect — identical to SVG. `Path` is `Animatable` with `EmptyAnimatableData` (`:10052`) — i.e. a raw `Path` does NOT interpolate; you animate the *parameters* of a parametric shape, not the path itself.

### 2.4 Web replication mapping

A fluent builder that emits an SVG `d` string. Mirror the Swift method names exactly so shape code ports verbatim.

```ts
export class PathBuilder {
  private d = '';
  private cur: [number, number] | null = null;
  moveTo(x: number, y: number)  { this.d += `M${x} ${y}`; this.cur = [x, y]; return this; }
  addLine(x: number, y: number) { this.d += `L${x} ${y}`; this.cur = [x, y]; return this; }
  addQuadCurve(x: number, y: number, cx: number, cy: number) { this.d += `Q${cx} ${cy} ${x} ${y}`; this.cur=[x,y]; return this; }
  addCurve(x: number, y: number, c1x: number, c1y: number, c2x: number, c2y: number) {
    this.d += `C${c1x} ${c1y} ${c2x} ${c2y} ${x} ${y}`; this.cur=[x,y]; return this; }
  closeSubpath() { this.d += 'Z'; return this; }
  // addArc(center,radius,start,end,clockwise) -> emit SVG 'A' (compute large-arc + sweep from angles)
  addArc(cx: number, cy: number, r: number, start: number, end: number, clockwise: boolean) {
    const sx = cx + r*Math.cos(start), sy = cy + r*Math.sin(start);
    const ex = cx + r*Math.cos(end),   ey = cy + r*Math.sin(end);
    if (!this.cur) this.moveTo(sx, sy); else this.addLine(sx, sy);
    let delta = end - start; const sweep = clockwise ? 0 : 1;       // CG clockwise=true draws CW; SVG sweep=0 is CCW in y-down? see note
    const large = Math.abs(delta) > Math.PI ? 1 : 0;
    this.d += `A${r} ${r} 0 ${large} ${sweep} ${ex} ${ey}`; this.cur=[ex,ey]; return this;
  }
  build() { return this.d; }
}
```
> NOTE on arc sweep: SwiftUI `addArc(clockwise:)` is in a y-down space; CoreGraphics' "clockwise" is visually clockwise. SVG `sweep-flag=1` draws in the direction of increasing angle (visually clockwise in a y-down viewBox). Calibrate sweep against a reference render — `clockwise == true` → `sweep=1`.

React `Path` view (a `Shape` whose `pathIn` ignores the rect and returns a fixed `d`, matching `Path.path(in:)` returning self, `SUICore:10050`):
```tsx
<Shape pathIn={() => myPathBuilder.build()} fill="var(--sui-color-label)" />
```
Parse-from-string init (`init?(_ string:)`) → accept a raw `d` string directly. `trimmedPath` → §8 uses SVG `getTotalLength()`/`getPointAtLength()` to re-emit a sub-path, OR the `stroke-dasharray` trick for stroked trims.

---

## 3. `Rectangle` — KNOWN

### 3.1 Exact API (`SUICore:10170-10181`)
```swift
@frozen public struct Rectangle : Shape {       // SUICore:10170
  public init() {}                                // :10176
  func path(in rect: CGRect) -> Path              // :10171
  var layoutDirectionBehavior: LayoutDirectionBehavior // :10173 — mirrors in RTL
  typealias AnimatableData = EmptyAnimatableData  // :10178 — not animatable
}
extension Shape where Self == Rectangle {         // SUICore:10160
  public static var rect: Rectangle { .init() }   // :10161 — `.rect` sugar
}
```
`path(in:)` = the four corners of `rect`: `M0,0 L w,0 L w,h L 0,h Z`.

### 3.2 Anatomy / states
One filled axis-aligned box. No corner rounding. Fills offered size. Default paint = foreground style. Stateless.

### 3.3 Web mapping
```tsx
// CSS shortcut (no SVG needed):
<div className="sui-rect" />   // .sui-rect { width:100%; height:100%; background: var(--sui-color-label); }
// SVG-exact (when used as clip or stroked):
const rectPath = (w,h) => `M0 0L${w} 0L${w} ${h}L0 ${h}Z`;
<Rectangle fill="var(--sui-color-label)" />   // <Shape pathIn={rectPath} .../>
```

---

## 4. `RoundedRectangle` + the `.continuous` squircle — KNOWN structure, DESIGNED renderer

This is the single most important section for the Apple look.

### 4.1 Exact API (`SUICore:10196-10220`)
```swift
@frozen public struct RoundedRectangle : Shape {                 // SUICore:10196
  public var cornerSize: CGSize                                   // :10197
  public var style: RoundedCornerStyle                           // :10198
  public init(cornerSize: CGSize, style: RoundedCornerStyle = .continuous)   // :10199
  public init(cornerRadius: CGFloat, style: RoundedCornerStyle = .continuous) // :10203 (sets cornerSize = w×h square)
  func path(in rect: CGRect) -> Path                              // :10207
  var animatableData: CGSize.AnimatableData                       // :10212 — animates cornerSize (pair of CGFloat)
}
extension Shape where Self == RoundedRectangle {                  // SUICore:10187
  public static func rect(cornerSize: CGSize, style: RoundedCornerStyle = .continuous) -> Self  // :10188
  public static func rect(cornerRadius: CGFloat, style: RoundedCornerStyle = .continuous) -> Self // :10189
}
```

```swift
public enum RoundedCornerStyle : Sendable {   // SUICore:19017
  case circular     // :19018 — plain quarter-circle arc (== CSS border-radius)
  case continuous   // :19019 — superellipse / squircle (THE DEFAULT)
}
```

**KNOWN:** every initializer defaults `.continuous`. So `RoundedRectangle(cornerRadius: 12)` is a **squircle**, not a CSS rounded rect. `animatableData` is `CGSize.AnimatableData` (`:10212`) = an `AnimatablePair<CGFloat,CGFloat>` → SwiftUI smoothly interpolates the corner radius (web: transition `border-radius` / re-emit the squircle path under a `requestAnimationFrame` tween).

### 4.2 The two corner styles — visual difference (INFERRED from rendered output + Apple HIG)

- `.circular`: corner is a pure 90° arc of radius `r`. Curvature is discontinuous at the tangent points (the second derivative jumps) — the eye reads a faint "pinch". This is exactly what CSS `border-radius: r` produces.
- `.continuous` (squircle): the curve **ramps in** before the corner. The transition from the straight edge into the arc is smoothed so curvature is continuous (G2). Visually the rounding "starts" further from the corner (~1.5–1.8× the nominal radius along each edge) and the apex is slightly tighter. This is the iOS app-icon / control geometry. Apple's icon grid uses corner radius ≈ **22.37%** of width with corner smoothing ≈ **60%** (the Figma "Smooth corners" default; INFERRED — Apple never publishes the exact spline).

### 4.3 The squircle construction — DESIGNED (interface only names it)

The interface gives NO geometry — `.continuous` is opaque. We replicate it with the **figma-squircle algorithm** (same one Figma uses), which builds each corner from: a **Bézier ramp → circular arc → Bézier ramp**, parameterized by `cornerRadius` and `cornerSmoothing ∈ [0,1]` (use `0.6` to match Apple).

Per-corner construction (DESIGNED, matching figma-squircle / `@phamfoo`):
```
Given radius R, smoothing S (0.6), and edge length L:
  p   = (1 + S) * R                 // how far from the corner the rounding starts along each edge
  arc angle θ = (90° * (1 - S))     // the residual true-circular arc in the middle
  // control-point offsets a,b,c,d derived from S (figma-squircle constants):
  a = R * (1 + S) * 0.8 ... (see lib)  // ramp length
  // The corner is: lineTo(corner - p along edge) → cubic Bézier (ramp in) → arc(θ) → cubic Bézier (ramp out)
  // clamp p ≤ L/2 so opposite corners don't overlap (when 2R ≥ min(w,h), degrade to circular)
```
Practical: **do not hand-roll the spline.** Vendor `figma-squircle` (`getSvgPath({ width, height, cornerRadius, cornerSmoothing })`) — it returns the exact `d` string. That `d` is our `pathIn(w,h)` for `.continuous`. For `.circular`, emit the plain rounded-rect path (or just use CSS `border-radius`).

Plain `.circular` rounded-rect path (KNOWN geometry):
```
M r,0  L w-r,0  Q w,0 w,r  L w,h-r  Q w,h w-r,h  L r,h  Q 0,h 0,h-r  L 0,r  Q 0,0 r,0  Z   (clamp r ≤ min(w,h)/2)
```

### 4.4 Web mapping — React prop API
```tsx
interface RoundedRectangleProps {
  cornerRadius?: number;          // px; or cornerSize {w,h} for asymmetric
  cornerSize?: { width: number; height: number };
  style?: 'continuous' | 'circular';   // DEFAULT 'continuous'
  fill?: string; stroke?: string; strokeStyle?: StrokeStyleProps;
}
export function RoundedRectangle({ cornerRadius, cornerSize, style = 'continuous', ...rest }: RoundedRectangleProps) {
  const rx = cornerSize?.width ?? cornerRadius ?? 0;
  const ry = cornerSize?.height ?? cornerRadius ?? rx;
  const pathIn = (w: number, h: number) =>
    style === 'continuous'
      ? getSvgPath({ width: w, height: h, cornerRadius: Math.min(rx, ry), cornerSmoothing: 0.6 })  // figma-squircle
      : circularRoundRectPath(w, h, rx, ry);
  return <Shape pathIn={pathIn} {...rest} />;
}
```
**CSS shortcut when style==='circular' and used as a plain fill:** `border-radius: {rx}px / {ry}px`. There is NO native CSS for `.continuous` short of the experimental `corner-shape: superellipse(...)` (Chrome 139+, modern-css.com) — until that ships everywhere, use the figma-squircle `clip-path`/SVG. Token cross-ref (W1 `shapes-effects.md` §3.1): record `shape.corner.style=continuous` as metadata; default CSS compile target is `border-radius`, with the squircle mask reserved for hero shapes where fidelity matters.

---

## 5. `UnevenRoundedRectangle` + `RectangleCornerRadii` — KNOWN

### 5.1 Exact API (`SUICore:10241-10266`)
```swift
@frozen public struct UnevenRoundedRectangle : Shape {            // SUICore:10241
  public var cornerRadii: RectangleCornerRadii                     // :10242
  public var style: RoundedCornerStyle                            // :10243
  public init(cornerRadii: RectangleCornerRadii, style: RoundedCornerStyle = .continuous)  // :10244
  public init(topLeadingRadius: CGFloat = 0, bottomLeadingRadius: CGFloat = 0,
              bottomTrailingRadius: CGFloat = 0, topTrailingRadius: CGFloat = 0,
              style: RoundedCornerStyle = .continuous)             // :10248
  var animatableData: RectangleCornerRadii.AnimatableData         // :10258 — animates all 4 radii
}
```
```swift
@frozen public struct RectangleCornerRadii : Equatable, Animatable {   // SUICore:19044
  public var topLeading, bottomLeading, bottomTrailing, topTrailing: CGFloat  // :19053-:19065 (computed over topLeft/topRight/bottomRight/bottomLeft storage)
  public init(topLeading: CGFloat = 0, bottomLeading: CGFloat = 0,
              bottomTrailing: CGFloat = 0, topTrailing: CGFloat = 0)  // :19071
}
```
**Hidden mapping (KNOWN, `:19053-19068`):** the public leading/trailing names are aliases over physical `topLeft/topRight/bottomRight/bottomLeft`. `topLeading→topLeft`, `topTrailing→topRight`, `bottomLeading→bottomLeft`, `bottomTrailing→bottomRight`. Under RTL the leading/trailing swap (web: mirror for `dir="rtl"`).

### 5.2 Web mapping
```tsx
interface UnevenRoundedRectangleProps {
  topLeadingRadius?: number; bottomLeadingRadius?: number;
  bottomTrailingRadius?: number; topTrailingRadius?: number;
  style?: 'continuous' | 'circular';
  fill?: string; stroke?: string;
}
```
CSS `.circular` shortcut: `border-radius: {topLeading} {topTrailing} {bottomTrailing} {bottomLeading}` (CSS order is TL TR BR BL clockwise from top-left). For `.continuous`, figma-squircle's `getSvgPath` accepts per-corner radii: `{ topLeftCornerRadius, topRightCornerRadius, bottomRightCornerRadius, bottomLeftCornerRadius, cornerSmoothing: 0.6 }`. Map leading→left, trailing→right (and swap for RTL).

---

## 6. `ConcentricRectangle` — KNOWN (iOS/macOS 26)

### 6.1 Exact API (`SUICore:13235-13264`)
```swift
public struct ConcentricRectangle : Shape, Animatable {           // SUICore:13235
  public init()                                                    // :13236  (all corners .concentric)
  public init(corners: Edge.Corner.Style, isUniform: Bool = false) // :13237
  public init(topLeadingCorner: Edge.Corner.Style = .concentric, topTrailingCorner: …,
              bottomLeadingCorner: …, bottomTrailingCorner: … = .concentric)  // :13238
  // + 6 more per-edge convenience inits (:13239-:13244)
}
extension Shape where Self == ConcentricRectangle {               // SUICore:13266
  public static func rect(corners: Edge.Corner.Style, isUniform: Bool = false) -> Self  // :13267
  // + 7 more .rect(...) factories (:13268-:13315)
}
```
```swift
public struct Edge.Corner.Style : Sendable, Hashable, Animatable {   // SUICore:19197
  public static func fixed(_ radius: CGFloat) -> Edge.Corner.Style    // :19198
  public static var concentric: Edge.Corner.Style                    // :19199 — match the container
  public static func concentric(minimum: Edge.Corner.Style? = nil) -> Edge.Corner.Style  // :19202
}
// ExpressibleByFloatLiteral (:19227) — a bare `12` literal means .fixed(12)
```

**Hidden logic:** `ConcentricRectangle` is the iOS-26 successor to `ContainerRelativeShape` generalized per-corner. Each corner's radius is resolved from the **nearest container's** corner geometry (set via `containerShape(_:)`, `SUICore:13382`) so an inner element's rounding stays *concentric* (constant gap) with the container's rounding. `.concentric(minimum:)` floors the resolved radius. `isUniform` makes one value apply to a symmetric set.

### 6.2 Web mapping (DESIGNED)
CSS can't natively resolve "nearest container radius", so expose a CSS custom property contract: the container sets `--sui-container-radius` and `--sui-container-inset`; a concentric corner computes `calc(var(--sui-container-radius) - var(--inset))` (clamped to a `minimum`). `.fixed(r)` → literal `r`. Continuous smoothing applies as in §4.
```tsx
interface ConcentricRectangleProps {
  corners?: { topLeading?: CornerStyle; topTrailing?: CornerStyle; bottomLeading?: CornerStyle; bottomTrailing?: CornerStyle };
  isUniform?: boolean;
}
type CornerStyle = number /*fixed px*/ | 'concentric' | { concentric: { minimum?: number } };
// radius per corner = style==='concentric' ? `calc(var(--sui-container-radius) - var(--inset))` : `${style}px`
```

---

## 7. `ContainerRelativeShape` — KNOWN

### 7.1 Exact API (`SUICore:13971-13978`)
```swift
@frozen public struct ContainerRelativeShape : Shape {            // SUICore:13971
  public init() {}                                                 // :13973
}
extension Shape where Self == ContainerRelativeShape {            // SUICore:13984
  public static var containerRelative: ContainerRelativeShape { .init() }  // :13985
}
extension ContainerRelativeShape : InsettableShape { … }           // SUICore:13994 (inset by amount)
```
**Hidden logic:** `path(in:)` returns whatever shape the enclosing container declared via `.containerShape(_:)` (`SUICore:14046`, `_ContainerShapeModifier` `SUICore:14065`), inset to fit. If no container declares one, it falls back to a rectangle. The canonical use is a Home-Screen widget: the OS sets the container shape to the widget's rounded-rect, and `ContainerRelativeShape()` inside the widget nests concentrically inside the device/widget corner radius.

### 7.2 Web mapping (DESIGNED)
Same `--sui-container-radius` contract as ConcentricRectangle but single-radius. A `<ContainerRelativeShape>` reads the inherited CSS var; a parent that wants to declare the container shape uses `<ContainerShape radius={…}>` which sets `--sui-container-radius` on its subtree.
```tsx
// border-radius: calc(var(--sui-container-radius, 0px) - var(--sui-inset, 0px));
```

---

## 8. `Circle`, `Ellipse`, `Capsule` — KNOWN

### 8.1 Circle (`SUICore:10342-10353`, sizeThatFits `:10360`)
```swift
@frozen public struct Circle : Shape {            // SUICore:10342
  func path(in rect: CGRect) -> Path               // :10343
  public init() {}                                 // :10344
  func sizeThatFits(_ proposal) -> CGSize          // :10360 — forces a SQUARE (min side), then centers
}
extension Shape where Self == Circle { static var circle: Circle { .init() } }  // :10333
```
**Hidden logic:** Circle's `sizeThatFits` collapses the offered rect to a square of side `min(w,h)` and centers the circle in the offered rect. So a `Circle()` in a non-square box is a centered circle of diameter `min(w,h)`, NOT an ellipse. Path = `M cx-r,cy A r r 0 1 0 cx+r,cy A r r 0 1 0 cx-r,cy Z` with `r = min(w,h)/2`, `cx=w/2, cy=h/2`.

### 8.2 Ellipse (`SUICore:10315-10326`)
```swift
@frozen public struct Ellipse : Shape {           // SUICore:10315
  func path(in rect: CGRect) -> Path               // :10316
  public init() {}                                 // :10317
}
extension Shape where Self == Ellipse { static var ellipse: Ellipse { .init() } }  // :10306
```
Ellipse inscribes the FULL offered rect (no squaring). Path = two SVG `A` half-arcs with `rx=w/2, ry=h/2`.

### 8.3 Capsule (`SUICore:10285-10299`)
```swift
@frozen public struct Capsule : Shape {           // SUICore:10285
  public var style: RoundedCornerStyle             // :10286
  public init(style: RoundedCornerStyle = .continuous)  // :10287
  func path(in r: CGRect) -> Path                  // :10290
}
extension Shape where Self == Capsule {            // SUICore:10272
  static var capsule: Capsule { .init() }          // :10273
  static func capsule(style: RoundedCornerStyle) -> Self  // :10276
}
```
**Hidden logic (KNOWN):** a Capsule is a RoundedRectangle whose corner radius = **half the shorter side** (`min(w,h)/2`). For a wide pill, the ends are full semicircles. Default style `.continuous`. Note Capsule's `_Inset` packs the corner-style bit into the LSB of the inset float (`SUICore:10573-10582`, `_makeInset`/`_extractInset` via `unsafeBitCast`) — pure storage trick; web replica ignores it and tracks style as a normal field.

### 8.4 Web mapping
```tsx
// Circle: square-and-center, then border-radius:50%
export const Circle = (p: ShapeStyleProps) => {
  const pathIn = (w:number,h:number) => { const r=Math.min(w,h)/2, cx=w/2, cy=h/2;
    return `M${cx-r} ${cy}A${r} ${r} 0 1 0 ${cx+r} ${cy}A${r} ${r} 0 1 0 ${cx-r} ${cy}Z`; };
  return <Shape pathIn={pathIn} {...p}/>;
};
// CSS shortcut for a square box: .sui-circle{border-radius:50%;background:var(--sui-color-label)}
// (only matches Circle exactly when the box is already square — else use the SVG which centers)

// Ellipse CSS shortcut: border-radius:50% on a non-square box. SVG-exact:
const ellipsePath = (w:number,h:number)=>`M0 ${h/2}A${w/2} ${h/2} 0 1 0 ${w} ${h/2}A${w/2} ${h/2} 0 1 0 0 ${h/2}Z`;

// Capsule: border-radius = min(w,h)/2  →  border-radius: 9999px (pill). style continuous → figma-squircle full-round.
// .sui-capsule { border-radius: 9999px; }   // circular is visually identical to continuous at full-round
interface CapsuleProps extends ShapeStyleProps { style?: 'continuous' | 'circular'; }
```
> At full-round (radius = half-side) `.continuous` and `.circular` are nearly indistinguishable, so the `border-radius:9999px` pill is an acceptable Capsule shortcut. Reserve figma-squircle for partial radii (RoundedRectangle).

---

## 9. `AnyShape` — type-erased shape — KNOWN

### 9.1 Exact API (`SUICore:9898-9910`)
```swift
@frozen public struct AnyShape : Shape, @unchecked Sendable {     // SUICore:9898
  public init<S>(_ shape: S) where S : Shape                       // :9900 — wrap any shape
  func path(in rect: CGRect) -> Path                               // :9901
  func sizeThatFits(_ proposal) -> CGSize                          // :9902
  typealias AnimatableData = _AnyAnimatableData                    // :9903 — type-erased animation
}
```
Erases a concrete `Shape` to a single type so you can store heterogeneous shapes in one property or switch shape at runtime without generics. Animation still works via `_AnyAnimatableData`.

### 9.2 Web mapping
A union prop / a `pathIn` callback is already type-erased in TS — `AnyShape` collapses to just passing a different `pathIn` function. Provide a helper:
```tsx
type AnyShapeDef = { pathIn: (w:number,h:number)=>string };
export const AnyShape = (s: AnyShapeDef & ShapeStyleProps) => <Shape pathIn={s.pathIn} {...s}/>;
// runtime switch: const shape = cond ? CapsuleDef : RoundedRectDef(12);
```

---

## 10. `InsettableShape` + `strokeBorder` — KNOWN (the inside-stroke trick)

### 10.1 Exact API (`SUICore:10367-10370`)
```swift
public protocol InsettableShape : Shape {                          // SUICore:10367
  associatedtype InsetShape : InsettableShape
  func inset(by amount: CGFloat) -> Self.InsetShape                 // :10369
}
```
Conformers: `Rectangle` (`:10405`), `RoundedRectangle` (`:10452`), `UnevenRoundedRectangle` (`:10501`), `Capsule` (`:10545`), `Circle`, `ContainerRelativeShape` (`:13994`), `OffsetShape`/`RotatedShape` (conditionally). Each defines a private `_Inset` that shrinks the path inward by `amount`.

### 10.2 `strokeBorder` — the key behavior difference vs `stroke` (`SUICore:10377-10397`)
```swift
extension InsettableShape {
  public func strokeBorder<S>(_ content: S, style: StrokeStyle, antialiased: Bool = true) -> some View {  // :10377
    return inset(by: style.lineWidth * 0.5).stroke(style: style).fill(content, style: FillStyle(antialiased: antialiased))
  }
  public func strokeBorder(style: StrokeStyle, antialiased: Bool = true) -> some View                      // :10383
  public func strokeBorder<S>(_ content: S, lineWidth: CGFloat = 1, antialiased: Bool = true) -> some View // :10389
  public func strokeBorder(lineWidth: CGFloat = 1, antialiased: Bool = true) -> some View                  // :10394
}
```
**Hidden logic (THE distinction):**
- `stroke(lineWidth: w)` centers the stroke ON the path edge → half the stroke (`w/2`) spills OUTSIDE the shape bounds. (SVG default; CSS `border` does NOT behave like this.)
- `strokeBorder(lineWidth: w)` first `inset(by: w/2)` THEN strokes → the entire stroke is INSIDE the shape bounds (`SUICore:10378`). This is what you want for buttons/cards so the border doesn't bleed past the layout frame.

### 10.3 Web mapping
```tsx
// stroke: SVG stroke centered on path (spills out by w/2). Use raw <Shape stroke=...>.
// strokeBorder: shrink the path by w/2 first, then stroke → fully inside.
//   SVG approach: inset the path geometry by w/2, then stroke.
//   CSS approach for box shapes: box-sizing:border-box + inset border, OR
//                                 box-shadow: inset 0 0 0 {w}px {color}  (always inside, no layout shift)
```
The cleanest CSS equivalent of `strokeBorder` is **`box-shadow: inset 0 0 0 {lineWidth}px {color}`** (inside-only, antialiased, no path math) for rect/rounded/capsule fills. For arbitrary shapes, inset the SVG path then stroke. `antialiased` default `true` → SVG `shape-rendering:geometricPrecision`.

---

## 11. Transformed shapes — `OffsetShape` / `ScaledShape` / `RotatedShape` / `TransformedShape` — KNOWN

All four wrap a `Content : Shape`, override `path(in:)` to apply a transform to the wrapped path, and forward `role`. Created via fluent `Shape` extension methods (`SUICore:17159-17182`).

### 11.1 OffsetShape (`SUICore:17015-17038`)
```swift
@frozen public struct OffsetShape<Content> : Shape where Content : Shape {  // SUICore:17015
  public var shape: Content; public var offset: CGSize                       // :17016-:17017
  public init(shape: Content, offset: CGSize)                                // :17018
}
extension Shape {
  func offset(_ offset: CGSize) -> OffsetShape<Self>          // :17160
  func offset(_ offset: CGPoint) -> OffsetShape<Self>         // :17163
  func offset(x: CGFloat = 0, y: CGFloat = 0) -> OffsetShape<Self>  // :17167
}
```
Translates the path. Web: `transform: translate(x,y)` on the `<path>` / `<g>`, or pre-translate the `d` coords.

### 11.2 ScaledShape (`SUICore:17056-17081`)
```swift
@frozen public struct ScaledShape<Content> : Shape … {        // SUICore:17056
  public var shape: Content; public var scale: CGSize; public var anchor: UnitPoint  // :17057-:17059
  public init(shape: Content, scale: CGSize, anchor: UnitPoint = .center)  // :17060
}
extension Shape {
  func scale(x: CGFloat = 1, y: CGFloat = 1, anchor: UnitPoint = .center) -> ScaledShape<Self>  // :17170
  func scale(_ scale: CGFloat, anchor: UnitPoint = .center) -> ScaledShape<Self>                // :17174
}
```
Web: `transform: scale(sx,sy); transform-origin: {anchor.x*100}% {anchor.y*100}%`.

### 11.3 RotatedShape (`SUICore:17087-17112`)
```swift
@frozen public struct RotatedShape<Content> : Shape … {       // SUICore:17087
  public var shape: Content; public var angle: Angle; public var anchor: UnitPoint  // :17088-:17090
  public init(shape: Content, angle: Angle, anchor: UnitPoint = .center)  // :17091
}
extension Shape { func rotation(_ angle: Angle, anchor: UnitPoint = .center) -> RotatedShape<Self> }  // :17177
```
Web: `transform: rotate({angle}rad); transform-origin: {anchor}`.

### 11.4 TransformedShape (`SUICore:17130-17153`)
```swift
@frozen public struct TransformedShape<Content> : Shape … {   // SUICore:17130
  public var shape: Content; public var transform: CGAffineTransform   // :17131-:17132
  public init(shape: Content, transform: CGAffineTransform)            // :17133
}
extension Shape { func transform(_ transform: CGAffineTransform) -> TransformedShape<Self> }  // :17180
```
Web: `transform: matrix(a,b,c,d,tx,ty)` — CGAffineTransform `[a b c d tx ty]` maps directly to CSS `matrix()`.

**Anchor → transform-origin:** `UnitPoint` (`SUICore:9720`) has `.center`(0.5,0.5), `.topLeading`(0,0), `.bottomTrailing`(1,1), etc. → CSS `transform-origin: {x*100}% {y*100}%`.

### 11.5 Web mapping (unified)
```tsx
// Wrap the inner shape's <svg>/<path> in a <g transform=...> OR set CSS transform on the host div.
interface TransformProps { offset?:{x:number;y:number}; scale?:{x:number;y:number}|number;
  rotation?:number /*rad*/; matrix?:[number,number,number,number,number,number]; anchor?:{x:number;y:number}; }
function transformCSS({offset,scale,rotation,matrix,anchor={x:.5,y:.5}}:TransformProps){
  const t:string[]=[];
  if(offset) t.push(`translate(${offset.x}px,${offset.y}px)`);
  if(typeof scale==='number') t.push(`scale(${scale})`); else if(scale) t.push(`scale(${scale.x},${scale.y})`);
  if(rotation) t.push(`rotate(${rotation}rad)`);
  if(matrix) t.push(`matrix(${matrix.join(',')})`);
  return { transform: t.join(' '), transformOrigin:`${anchor.x*100}% ${anchor.y*100}%` };
}
```

---

## 12. `stroke` / `_StrokedShape` and `trim` / `_TrimmedShape` — KNOWN

### 12.1 `_StrokedShape` + `stroke` (`SUICore:9650-9690`)
```swift
@frozen public struct _StrokedShape<S> : Shape where S : Shape {  // SUICore:9650
  public var shape: S; public var style: StrokeStyle               // :9651-:9652
  public init(shape: S, style: StrokeStyle)                        // :9653
}
extension Shape {
  func stroke(style: StrokeStyle) -> some Shape { _StrokedShape(shape: self, style: style) }  // :9682
  func stroke(lineWidth: CGFloat = 1) -> some Shape { stroke(style: StrokeStyle(lineWidth: lineWidth)) }  // :9686
}
```
Returns a NEW shape whose path is the OUTLINE of the original's stroke (so it's then filled). Stroke is centered on the edge → spills `lineWidth/2` outside (contrast `strokeBorder`, §10.2).

### 12.2 `_TrimmedShape` + `trim` (`SUICore:5665-5704`)
```swift
@frozen public struct _TrimmedShape<S> : Shape where S : Shape {  // SUICore:5665
  public var shape: S; public var startFraction: CGFloat; public var endFraction: CGFloat  // :5666-:5668
  public init(shape: S, startFraction: CGFloat = 0, endFraction: CGFloat = 1)  // :5669
  var animatableData: AnimatablePair<S.AnimatableData, AnimatablePair<CGFloat,CGFloat>>  // :5683 — animate start/end
}
extension Shape {
  func trim(from startFraction: CGFloat = 0, to endFraction: CGFloat = 1) -> some Shape  // :5699
}
```
**Hidden logic:** `trim(from:to:)` keeps the sub-segment of the path between arc-length fractions `[start,end]` of total length. Animating `endFraction` 0→1 is THE canonical "draw-on" / progress-ring animation. `animatableData` interpolates start+end, so trims tween smoothly.

### 12.3 Web mapping — the two trim techniques
```tsx
// Technique A (stroked trim — progress rings, draw-on): use stroke-dasharray + stroke-dashoffset.
//   const L = pathRef.current.getTotalLength();
//   strokeDasharray = `${(end-start)*L} ${L}`; strokeDashoffset = `${-start*L}`;
//   animate by transitioning stroke-dashoffset (matches trim animation exactly).
// Technique B (filled trim — rare): re-emit a sub-path via getPointAtLength sampling between start*L and end*L.
interface TrimProps { from?: number; to?: number; }   // fractions 0..1, defaults 0 and 1
```
A `Circle().trim(from:0,to:progress).stroke(lineWidth:8)` ⇒ `<circle>` with `pathLength=1`, `stroke-dasharray="{progress} 1"`, rotated -90° so it starts at 12 o'clock — the standard CSS progress ring.

---

## 13. `StrokeStyle` & `FillStyle` — KNOWN

### 13.1 StrokeStyle (`SUICore:8630-8638`)
```swift
@frozen public struct StrokeStyle : Equatable {   // SUICore:8630
  public var lineWidth: CGFloat                    // :8631
  public var lineCap: CGLineCap                    // :8632  (.butt | .round | .square)
  public var lineJoin: CGLineJoin                  // :8633  (.miter | .round | .bevel)
  public var miterLimit: CGFloat                   // :8634
  public var dash: [CGFloat]                        // :8635
  public var dashPhase: CGFloat                    // :8636
  public init(lineWidth: CGFloat = 1, lineCap: CGLineCap = .butt, lineJoin: CGLineJoin = .miter,
              miterLimit: CGFloat = 10, dash: [CGFloat] = [], dashPhase: CGFloat = 0)  // :8637
}
```
Animatable (`:8645`) over lineWidth + first-two-dash via `AnimatablePair`.

**Exact constant defaults (KNOWN):** `lineWidth=1`, `lineCap=.butt`, `lineJoin=.miter`, `miterLimit=10`, `dash=[]`, `dashPhase=0`.

### 13.2 FillStyle (`SUICore:6218-6225`)
```swift
@frozen public struct FillStyle : Equatable {     // SUICore:6218
  public var isEOFilled: Bool                       // :6219 — even-odd vs nonzero winding
  public var isAntialiased: Bool                    // :6220
  public init(eoFill: Bool = false, antialiased: Bool = true)  // :6221
}
```
Defaults: nonzero winding, antialiased on.

### 13.3 Web mapping (CGLineCap/Join → SVG)
```tsx
interface StrokeStyleProps {
  lineWidth?: number;        // default 1
  lineCap?: 'butt'|'round'|'square';   // default 'butt'  → SVG stroke-linecap
  lineJoin?: 'miter'|'round'|'bevel';  // default 'miter' → SVG stroke-linejoin
  miterLimit?: number;       // default 10  → SVG stroke-miterlimit
  dash?: number[];           // default []  → SVG stroke-dasharray
  dashPhase?: number;        // default 0   → SVG stroke-dashoffset (negate: phase advances opposite to offset)
}
function strokeAttrs(s?: StrokeStyleProps) {
  if (!s) return {};
  return {
    strokeWidth: s.lineWidth ?? 1,
    strokeLinecap: s.lineCap ?? 'butt',
    strokeLinejoin: s.lineJoin ?? 'miter',
    strokeMiterlimit: s.miterLimit ?? 10,
    strokeDasharray: s.dash?.length ? s.dash.join(' ') : undefined,
    strokeDashoffset: s.dashPhase != null ? -s.dashPhase : undefined,
  };
}
```
`FillStyle.isEOFilled` → SVG `fill-rule="evenodd"`; `isAntialiased:false` → `shape-rendering:crispEdges`.

### 13.4 `fill` on a Shape (`SUICore:17577`, `:17661`)
```swift
extension Shape { func fill<S>(_ content: S = .foreground, style: FillStyle = FillStyle()) -> _ShapeView<Self,S> }  // :17661
```
`Shape.fill(_ style)` produces the `_ShapeView` that pairs path+paint. Default content `.foreground` (the foreground style). Web: that's just our `<Shape fill=…>`.

---

## 14. Gradients — KNOWN — map every one to a CSS gradient

### 14.1 `Gradient` + `Stop` + `ColorSpace` (`SUICore:2167-2178`, `:16921`)
```swift
@frozen public struct Gradient : Equatable {       // SUICore:2167
  @frozen public struct Stop : Equatable {          // :2168
    public var color: Color; public var location: CGFloat   // :2169-:2170 (location 0..1)
    public init(color: Color, location: CGFloat)            // :2171
  }
  public var stops: [Stop]                                   // :2174
  public init(stops: [Stop])                                 // :2175
  public init(colors: [Color])                               // :2176 — evenly spaced 0..1
}
extension Gradient {
  public struct ColorSpace : Hashable, Sendable {            // SUICore:16922
    public static let device: ColorSpace                      // :16923 (default — interpolate in device RGB)
    public static let perceptual: ColorSpace                  // :16924 (interpolate in perceptual/OKLab-ish space)
  }
  public func colorSpace(_ space: ColorSpace) -> AnyGradient  // :16931
}
```
**`init(colors:)` default stop placement (INFERRED):** N colors → locations `i/(N-1)` (first at 0, last at 1, evenly spaced). `.device` ≈ CSS default `in srgb`; `.perceptual` ≈ CSS `in oklab`/`in lab`.

### 14.2 LinearGradient (`SUICore:506-527`)
```swift
@frozen public struct LinearGradient : ShapeStyle, View, Sendable {   // SUICore:506
  public init(gradient: Gradient, startPoint: UnitPoint, endPoint: UnitPoint)  // :510
  public init(colors: [Color], startPoint: UnitPoint, endPoint: UnitPoint)     // :511
  public init(stops: [Gradient.Stop], startPoint: UnitPoint, endPoint: UnitPoint)  // :515
}
```
`UnitPoint` (`SUICore:9720`): `.top`(0.5,0) `.bottom`(0.5,1) `.leading`(0,0.5) `.trailing`(1,0.5) `.topLeading`(0,0) … `.center`(0.5,0.5).
**Web:** CSS `linear-gradient`. The angle = direction from start→end. SwiftUI y is down, so `startPoint:.top, endPoint:.bottom` ⇒ `linear-gradient(to bottom, …)`. General: `angle_deg = atan2(end.x-start.x, start.y-end.y) * 180/π` (CSS 0deg points up; verify against reference).
```css
/* LinearGradient(colors:[a,b], .top, .bottom) */ background: linear-gradient(to bottom, a 0%, b 100%);
```

### 14.3 RadialGradient (`SUICore:533-555`)
```swift
@frozen public struct RadialGradient : ShapeStyle, View, Sendable {   // SUICore:533
  public init(gradient: Gradient, center: UnitPoint, startRadius: CGFloat, endRadius: CGFloat)  // :538
  public init(colors:…, center:…, startRadius:…, endRadius:…)  // :539
  public init(stops:…, center:…, startRadius:…, endRadius:…)   // :543
}
```
**Web:** CSS `radial-gradient(circle at {cx}% {cy}%, …)`. `startRadius` maps to the first stop's offset = `startRadius/endRadius`; `endRadius` is the gradient's outer extent. Use `radial-gradient(circle {endRadius}px at {cx}% {cy}%, c0 {startRadius/endRadius*100}%, c1 100%)`.

### 14.4 AngularGradient (conic) (`SUICore:579-610`)
```swift
@frozen public struct AngularGradient : ShapeStyle, View, Sendable {  // SUICore:579
  public init(gradient: Gradient, center: UnitPoint, startAngle: Angle = .zero, endAngle: Angle = .zero)  // :584
  public init(gradient: Gradient, center: UnitPoint, angle: Angle = .zero)   // :593 — full 360° "color wheel"
  // + colors:/stops: convenience inits :585-:601
}
```
**Web:** CSS `conic-gradient(from {startAngle} at {cx}% {cy}%, …)`. The `angle:`-only init is a full sweep starting at `angle`. SwiftUI 0° = 3 o'clock (+x), CSS conic 0deg = 12 o'clock → add 90°: `from calc({startAngle}deg + 90deg)`.

### 14.5 EllipticalGradient (`SUICore:561-573`)
```swift
@frozen public struct EllipticalGradient : ShapeStyle, View, Sendable {  // SUICore:561
  public init(gradient: Gradient, center: UnitPoint = .center,
              startRadiusFraction: CGFloat = 0, endRadiusFraction: CGFloat = 0.5)  // :566
  public init(colors:…, center: .center, startRadiusFraction: 0, endRadiusFraction: 0.5)  // :567
  public init(stops:…, …)  // :568
}
```
Radii are FRACTIONS of the shape's size (so it stretches with a non-square box → an ellipse). **Web:** CSS `radial-gradient(ellipse {endFrac*100}% {endFrac*100}% at {cx}% {cy}%, c0 {startFrac/endFrac*100}%, c1 100%)`. Defaults: center, 0→0.5 (fills to half-extent = touches edges at the mid-points).

### 14.6 AnyGradient (`SUICore:1637-1648`)
```swift
@frozen public struct AnyGradient : Hashable, ShapeStyle, Sendable {  // SUICore:1637
  public init(_ gradient: Gradient)   // :1639
  public func colorSpace(_ space: Gradient.ColorSpace) -> AnyGradient  // :16939
}
```
Type-erased gradient that adapts to context (e.g. `Color.blue.gradient` returns an `AnyGradient` — a subtle light-to-dark of the base color). Web: a token that, given a base color, emits `linear-gradient(to bottom, color-mix(in oklab, {c} 88%, white) , {c})` (DESIGNED, the Apple auto-gradient look).

### 14.7 MeshGradient (`SUICore:14902-14964`)
```swift
public struct MeshGradient : ShapeStyle, Equatable, Sendable {   // SUICore:14902
  public var width: Int; public var height: Int                   // :14928-:14929 — grid dims
  public var locations: Locations                                 // :14930 — .points([SIMD2<Float>]) | .bezierPoints([BezierPoint])
  public var colors: Colors                                       // :14931 — .colors([Color]) | .resolvedColors([Color.Resolved])
  public var background: Color                                    // :14932 default .clear
  public var smoothsColors: Bool                                  // :14933 default true
  public var colorSpace: Gradient.ColorSpace                      // :14934 default .device
  public init(width:Int, height:Int, locations:Locations, colors:Colors,
              background: Color = .clear, smoothsColors: Bool = true, colorSpace: .device)  // :14935
  public init(width:Int, height:Int, points:[SIMD2<Float>], colors:[Color], …)  // :14936
  // BezierPoint (:14913): position + leading/top/trailing/bottom control points (SIMD2<Float>)
}
```
A `width×height` grid of control points each with a color, bilinearly/bicubically interpolated. **Web (DESIGNED):** no native CSS. Render to a `<canvas>` via a fragment-shader-style bilinear interpolation (or stack multiple radial-gradients per vertex as an approximation). For a 2×2 mesh, four overlapping `radial-gradient`s at the corner UnitPoints is a passable fallback; for true fidelity use WebGL.

### 14.8 Gradient web prop API (unified)
```tsx
type GradientStop = { color: string; location: number };
interface GradientProps { stops?: GradientStop[]; colors?: string[]; colorSpace?: 'device'|'perceptual'; }
// → buildStops(colors) spaces evenly; colorSpace 'perceptual' → CSS 'in oklab'
function cssLinear(g: GradientProps, start:UnitPoint, end:UnitPoint) {
  const interp = g.colorSpace==='perceptual' ? 'in oklab, ' : '';
  return `linear-gradient(${interp}${angleFromPoints(start,end)}deg, ${stopStr(g)})`;
}
// Each gradient is BOTH a ShapeStyle (fill) and a View (full-bleed Rectangle filled with it) — its Body is _ShapeView<Rectangle, Self> (SUICore:524/552/570/607).
// So <LinearGradient .../> with no shape renders as a filled rectangle; as a fill it's the `fill` value.
```

---

## 15. `Canvas` + `GraphicsContext` — immediate-mode drawing — KNOWN

### 15.1 Canvas (`SUICore:17245-17275`)
```swift
public struct Canvas<Symbols> where Symbols : View {              // SUICore:17245
  public var symbols: Symbols
  public var renderer: (inout GraphicsContext, CGSize) -> Void     // :17247 — the draw callback
  public var isOpaque: Bool; public var colorMode: ColorRenderingMode; public var rendersAsynchronously: Bool
  public init(opaque: Bool = false, colorMode: ColorRenderingMode = .nonLinear,
              rendersAsynchronously: Bool = false,
              renderer: @escaping (inout GraphicsContext, CGSize) -> Void,
              @ViewBuilder symbols: () -> Symbols)                 // :17260
}
extension Canvas where Symbols == EmptyView {                     // :17273
  public init(opaque: Bool = false, colorMode: .nonLinear, rendersAsynchronously: Bool = false,
              renderer: @escaping (inout GraphicsContext, CGSize) -> Void)  // :17274
}
```
```swift
public enum ColorRenderingMode { case nonLinear; case linear; case extendedLinear }  // SUICore:4359
```
**Hidden logic:** `Canvas` gives you a retained-mode-free `GraphicsContext` + the view's size; you draw imperatively each frame. `symbols` are pre-rendered SwiftUI views you reference by id inside the renderer (`resolveSymbol`). This is the direct analog of an HTML `<canvas>` 2D context.

### 15.2 GraphicsContext (`SUICore:7001-7347`) — the immediate API
Selected members (full list cited):
- State: `var opacity: Double` (`:7153`), `var blendMode: BlendMode` (`:7157`), `var transform: CGAffineTransform` (`:7164`), `var environment` (`:7161`), `var clipBoundingRect` (`:7185`).
- Transform: `scaleBy(x:y:)` `:7168`, `translateBy(x:y:)` `:7169`, `rotate(by: Angle)` `:7170`, `concatenate(_ matrix)` `:7171`.
- Clip: `clip(to: Path, style: FillStyle = …, options: ClipOptions = …)` `:7188`; `clipToLayer(opacity:options:content:)` `:7189`. `ClipOptions.inverse` (`:7175`).
- Draw: `fill(_ path, with shading, style: FillStyle = …)` `:7313`; `stroke(_ path, with shading, style: StrokeStyle)` `:7314`; `stroke(_ path, with shading, lineWidth: CGFloat = 1)` `:7315`; `drawLayer(content:)` `:7312`.
- Images/text/symbols: `draw(_ image, in rect/at point, …)` `:7324-:7327`; `resolve(_ text) -> ResolvedText` `:7334`, `draw(_ text, …)` `:7335-:7338`; `resolveSymbol(id:)` `:7344`, `draw(_ symbol, …)` `:7345-:7346`.
- `Shading` (the paint, `:7270-7291`): `.foreground` `:7274`, `.backdrop` `:7271`, `.color(Color)` `:7278`, `.color(_ space, red:green:blue:opacity:)` `:7279`, `.style(_ ShapeStyle)` `:7286`, `.linearGradient(_ gradient, startPoint:endPoint:options:)` `:7287`, `.radialGradient(…)` `:7288`, `.conicGradient(…)` `:7289`, `.tiledImage(…)` `:7290`, `.meshGradient(_)` `:7285`, `.shader(_)` `:7283`.
- `Filter` (`:7190-7215`): `.shadow(color: Color = Color(.sRGBLinear, white:0, opacity:0.33), radius:, x:0, y:0, blendMode:.normal, options:)` `:7192`, `.blur(radius:options:)` `:7204`, `.colorMatrix`, `.hueRotation`, `.saturation`, `.brightness`, `.contrast`, `.grayscale`, `.colorInvert`, `.alphaThreshold`, shader filters. `addFilter(_:options:)` `:7269`.
- `BlendMode` (`:7007-7152`): a `RawRepresentable<Int32>` wrapping every `CGBlendMode` (normal/multiply/screen/overlay/darken/lighten/colorDodge/colorBurn/softLight/hardLight/difference/exclusion/hue/saturation/color/luminosity/clear/copy/sourceIn/sourceOut/sourceAtop/destinationOver/destinationIn/destinationOut/destinationAtop/xor/plusDarker/plusLighter).

**Default shadow constant (KNOWN, `:7192`):** color `sRGBLinear white 0 opacity 0.33`, offset (0,0), radius required. That's the Apple soft shadow seed.

### 15.3 Web mapping — Canvas2D
```tsx
interface CanvasProps {
  opaque?: boolean; colorMode?: 'nonLinear'|'linear'|'extendedLinear'; rendersAsynchronously?: boolean;
  renderer: (ctx: GraphicsContext2D, size: {width:number;height:number}) => void;
  symbols?: Record<string, ReactNode>;   // pre-rendered, referenced by id
}
// Implementation: a <canvas> with devicePixelRatio scaling. Wrap CanvasRenderingContext2D in a GraphicsContext2D
// adapter that mirrors the SwiftUI API 1:1:
class GraphicsContext2D {
  constructor(private c: CanvasRenderingContext2D) {}
  get opacity(){return this.c.globalAlpha} set opacity(v){this.c.globalAlpha=v}
  set blendMode(m){this.c.globalCompositeOperation = BLEND_MAP[m]}   // 'multiply','screen','overlay',...
  translateBy(x:number,y:number){this.c.translate(x,y)}
  scaleBy(x:number,y:number){this.c.scale(x,y)}
  rotate(rad:number){this.c.rotate(rad)}
  fill(d:string, shading:Shading, evenOdd=false){ this.c.fillStyle=resolveShading(this.c,shading);
    this.c.fill(new Path2D(d), evenOdd?'evenodd':'nonzero'); }
  stroke(d:string, shading:Shading, style:StrokeStyleProps){ applyStroke(this.c,style);
    this.c.strokeStyle=resolveShading(this.c,shading); this.c.stroke(new Path2D(d)); }
  clip(d:string){ this.c.clip(new Path2D(d)); }
  shadow(color:string, blur:number, x=0, y=0){ this.c.shadowColor=color; this.c.shadowBlur=blur; this.c.shadowOffsetX=x; this.c.shadowOffsetY=y; }
}
// resolveShading: .color → string; .linearGradient → ctx.createLinearGradient(...); .radialGradient → createRadialGradient;
//                 .conicGradient → createConicGradient; .tiledImage → createPattern.
// BlendMode → canvas globalCompositeOperation (normal=source-over, plusLighter=lighter, etc.)
```
`GraphicsContext.Filter.shadow` default → `ctx.shadowColor='rgba(0,0,0,0.33)'`. `Path` `d` strings feed `new Path2D(d)` directly — the §2 builder is reused verbatim.

---

## 16. `ButtonBorderShape` — KNOWN (SwiftUI module)

### 16.1 Exact API (`SUI:14675-14685` + Shape conformance below it)
```swift
public struct ButtonBorderShape : Equatable, Sendable {   // SUI:14675
  public static let automatic: ButtonBorderShape            // resolves to the platform default per control size
  public static let capsule: ButtonBorderShape
  public static let roundedRectangle: ButtonBorderShape
  public static func roundedRectangle(radius: CGFloat) -> ButtonBorderShape
  public static let circle: ButtonBorderShape
}
extension ButtonBorderShape : Shape { func path(in rect: CGRect) -> Path }   // SUI (conformance block)
extension Shape where Self == ButtonBorderShape { static var buttonBorder: ButtonBorderShape { get } }
```
**Hidden logic:** the shape used by `.buttonBorderShape(_:)` and bordered button styles. `.automatic` resolves at render time from the control size / platform (small buttons → ~6px rounded rect; bordered-prominent → continuous rounded rect; `.capsule` for pill buttons). This is the shape a button's background/border is clipped to.

### 16.2 Web mapping
```tsx
type ButtonBorderShape = 'automatic' | 'capsule' | 'roundedRectangle' | { roundedRectangle: { radius: number } } | 'circle';
// automatic → continuous RoundedRectangle with the control's default radius (≈ var(--sui-radius-control, 6–8px));
// capsule → border-radius:9999px; roundedRectangle → var(--sui-radius-control); circle → 50%.
```
Cross-ref C2 (action-controls) for the button-size→radius table; here it's just the shape token.

---

## 17. The `ShapeView` family — how a styled shape becomes a View — KNOWN

These are the concrete view types `fill`/`stroke`/`strokeBorder` return. A web kit collapses all of them into our single `<Shape>` plus a `background` slot, but documenting them pins the exact composition semantics.

### 17.1 `_ShapeView<Content, Style>` (`SUICore:17630-17642`)
```swift
@frozen public struct _ShapeView<Content, Style> : View where Content : Shape, Style : ShapeStyle {  // :17630
  public var shape: Content; public var style: Style; public var fillStyle: FillStyle   // :17631-:17633
  public init(shape: Content, style: Style, fillStyle: FillStyle = FillStyle())          // :17634
}
```
The base: path + paint + fill rule. This is the `Body` of every primitive shape.

### 17.2 `ShapeView` protocol + `FillShapeView` / `StrokeShapeView` / `StrokeBorderShapeView` (`SUICore:17651-17814`)
```swift
public protocol ShapeView<Content> : View { associatedtype Content : Shape; var shape: Content { get } }  // :17651
@frozen public struct FillShapeView<Content,Style,Background> : ShapeView … { var shape; var style; var fillStyle; var background }  // :17699
@frozen public struct StrokeShapeView<Content,Style,Background> : ShapeView … { var shape; var style; var strokeStyle; var isAntialiased; var background }  // :17737
@frozen public struct StrokeBorderShapeView<Content,Style,Background> : ShapeView … { var shape; var style; var strokeStyle; var isAntialiased; var background }  // :17780
```
**Key composition (KNOWN):** these carry a `Background` view so you can chain `.fill(...).stroke(...)` or `.stroke(...).fill(...)` and SwiftUI layers them (the earlier call becomes the `background` of the later). e.g. `Circle().fill(.blue).stroke(.white, lineWidth:2)` → a `StrokeShapeView` whose `background` is the `FillShapeView`. `StrokeBorderShapeView.init` (`:17802`) literally does `shape.inset(by: strokeStyle.lineWidth*0.5)` before stroking — confirming the inside-border behavior from §10.2.

### 17.3 Web mapping
```tsx
// Our <Shape> takes optional `background` to mirror the layering:
<Shape pathIn={p} fill="blue">            {/* FillShapeView */}
  <Shape pathIn={p} stroke="white" strokeStyle={{lineWidth:2}}/>   {/* layered on top via the same <svg>, stacked <path>s */}
</Shape>
// In practice: render a single <svg> with TWO <path> elements (fill path, then stroke path) — equivalent to the layered ShapeViews,
// and for strokeBorder the second path is the w/2-inset geometry.
```

---

## 18. `ContentShapeKinds` — KNOWN (hit-test / preview shape selector)

`SUICore:3902-3929` — `OptionSet`: `.interaction` (hit testing), `.dragPreview`, `.contextMenuPreview`, `.hoverEffect`, `.focusEffect`, `.accessibility`. Used by `.contentShape(_:_: )` to declare the region for taps / drag previews / hover effects independently of the visible shape. **Web mapping:** the visible shape is one element; the *interaction* shape maps to a sibling overlay with `clip-path` + `pointer-events`. `.hoverEffect` → the iPad pointer-hover lift (CSS `:hover` transform on the clipped region). Not a drawable; it's a hit-region declaration.

---

## 19. Tabulated long tail (covered for completeness — not deep)

These are (a) named semantic ShapeStyle tokens (their COLORS live in the W1 `colors.md` token file — here they're just "a fill that resolves to token X"), (b) private `_`-prefixed implementation wrappers a web kit folds into a prop, or (c) Charts-only symbol shapes. None is a novel drawable; each maps to an already-specified mechanism.

### 19.1 Named `ShapeStyle` tokens (color resolution → W1 `colors.md`)
| Type | line | purpose | web-equiv |
|---|---|---|---|
| `ForegroundStyle` | `SUICore:9263` | the default content paint (`.foreground`) | `var(--sui-color-label)` |
| `BackgroundStyle` | `SUICore:9116` | the env background fill (`.background`) | `var(--sui-color-background)` |
| `HierarchicalShapeStyle` | `SUICore:6685` | `.primary/.secondary/.tertiary/.quaternary` opacity ramp of the base | `color-mix` / opacity 1 / 0.55 / 0.25 / 0.10 of label |
| `HierarchicalShapeStyleModifier` | `SUICore:6736` | applies a hierarchy level to another style | wrapper → multiply opacity |
| `SeparatorShapeStyle` | `SUICore:7774` | hairline separator color | `var(--sui-color-separator)` |
| `SelectionShapeStyle` | `SUI:14382` | selection highlight fill | `var(--sui-color-accent)` @ ~0.2 |
| `TintShapeStyle` | `SUICore:19297` | the env tint (`.tint`) | `var(--sui-color-accent)` |
| `LinkShapeStyle` | `SUI:5928` | link text color | `var(--sui-color-link)` |
| `PlaceholderTextShapeStyle` | `SUI:4094` | placeholder gray | `var(--sui-color-placeholder)` |
| `FillShapeStyle` | `SUI:2004` | the system "fill" material set (`.fill`) | `var(--sui-color-fill)` |
| `WindowBackgroundShapeStyle` | `SUI:22809` | window bg | `var(--sui-color-window-bg)` |
| `_SystemShapeStyle` | `SUI:6227` | base impl for the system styles | n/a (internal) |
| `_EnvironmentBackgroundStyleModifier` `:9158`, `_ForegroundStyleModifier` `:9196`, `_ForegroundStyleModifier2` `:9213`, `_ForegroundStyleModifier3` `:9232` | — | apply 1–3 layered styles (the 2/3 variants carry extra `ShapeStyle` type params `S2`/`S3` for `.foregroundStyle(a,b,c)` primary/secondary/tertiary) | up to 3 stacked `<path>`/text layers each at its hierarchy opacity |
| `ImagePaint` | `SUICore:1989` | a `ShapeStyle` that tiles an `Image` (`sourceRect` default `(0,0,1,1)`, `scale` default `1`, `:1993`) as the fill paint | CSS `background-image`+`background-repeat:repeat`, or SVG `<pattern>` fed the image, scaled by `scale` |
| `AnyShapeStyle` | `SUICore:5527` | type-erased style | a `string` CSS paint |
| `_AnchoredShapeStyle` `:8594`, `_BlendModeShapeStyle` `:6288`, `_OpacityShapeStyle` `:4254`, `_ShadowShapeStyle` `:8575`, `_ImplicitShapeStyle` `:9283` | — | wrappers: anchor a gradient, apply blend/opacity/shadow to a style | CSS `mix-blend-mode` / `opacity` / `filter:drop-shadow` / inherited paint |
| `_AnyLinearGradient` `:1718`, `_AnyRadialGradient` `:1738`, `_AnyEllipticalGradient` `:1761`, `_AnyAngularGradient` `:1784` | — | erased gradient variants returned by `.linearGradient(_ AnyGradient,…)` etc. | same CSS gradient as §14, fed an `AnyGradient` base |

### 19.2 Boolean-op result shapes (private; produced by Path/Shape set ops, iOS 17+)
| Type | line | purpose | web-equiv |
|---|---|---|---|
| `_ShapeUnion` | `SUICore:11863` | union of two shapes | `Path.union` → CSS none; precompute combined `d` |
| `_ShapeIntersection` | `SUICore:11838` | intersection | precompute `d` (or nest `clip-path`s) |
| `_ShapeSubtraction` | `SUICore:11888` | subtract | precompute `d` (even-odd) |
| `_ShapeSymmetricDifference` | `SUICore:11913` | XOR | precompute `d` |
| `_ShapeLineIntersection` | `SUICore:11938` | line∩ | open sub-paths |
| `_ShapeLineSubtraction` | `SUICore:11963` | line− | open sub-paths |
> Web: do the boolean op at build time with a polygon-clipping lib (e.g. `polygon-clipping`/`martinez`) on flattened paths, emit one `d`. SwiftUI's `eoFill` flag → `fill-rule:evenodd`.

### 19.3 Other internal Shape/clip/size wrappers
| Type | line | purpose | web-equiv |
|---|---|---|---|
| `_ClipEffect<ClipShape>` | `SUICore:17318` | backs `.clipShape(_:style:)` / `.clipped()` | CSS `clip-path: path('{d}')` |
| `_SizedShape` | `SUICore:15042` | a shape forced to a fixed size | wrap in a sized box, evaluate `pathIn(w,h)` at that size |
| `_StrokedShape` | `SUICore:9650` | (deep-covered §12.1) | — |
| `_TrimmedShape` | `SUICore:5665` | (deep-covered §12.2) | — |
| `DefaultGlassEffectShape` | `SUICore:2534` | default shape for Liquid-Glass (`.glassEffect`) — a continuous capsule-ish rounded shape | `border-radius:9999px` continuous (cross-ref W1 `materials.md` glass) |
| `RoundedRectangularShape` (protocol) | `SUICore:13338` | unifies Rectangle/RoundedRect/UnevenRoundedRect/Circle/Capsule under `corners(in:)` for `containerShape` | the `--sui-container-radius` contract (§6/§7) |
| `RoundedRectangularShapeCorners` | `SUICore:13343` | per-corner `Edge.Corner.Style` for the above (`.fixed`/`.concentric`) | the `CornerStyle` union (§6.2) |
| `_ContainerRoundedRectangularShapeModifier` `:13388`, `_ContainerShapeModifier` `:14065` | — | set the container shape for descendants | a provider that sets `--sui-container-radius` |
| `_BackgroundShapeModifier` `:15407`, `_InsettableBackgroundShapeModifier` `:15428`, `_OverlayShapeModifier` `:3267` | — | `.background(shape)` / `.overlay(shape)` plumbing | render the shape as an absolutely-positioned bg/overlay layer |
| `_ContentShapeModifier` `:13030`, `_ContentShapeKindModifier` `:13146` | — | back `.contentShape(_:)` | hit-region overlay (§18) |
| `_ShapeStyle_Shape` `:9339`, `_ShapeStyle_ShapeType` `:9349` | — | internal apply-targets for ShapeStyle resolution | n/a |

### 19.4 Charts symbol shapes (Charts module — point-mark glyphs)
| Type | line | purpose | web-equiv |
|---|---|---|---|
| `ChartSymbolShape` (protocol) | `Charts:1760` | a `Shape` + `perceptualUnitRect` for scatter/line point marks | an SVG symbol `<path>` with a unit viewBox |
| `BasicChartSymbolShape` | `Charts:1790` | the built-in glyphs: `.circle .square .triangle .diamond .pentagon .plus .cross .asterisk` (`Charts:1810-1828`) | a lookup of 8 fixed `d`-strings |
| `AnyChartSymbolShape` | `Charts:1771` | type-erased symbol | a `pathIn` callback |
| `BasicChart3DSymbolShape` | `Charts:430` | 3D chart point glyph (sphere/cube/cone) | WebGL/3D — out of 2D scope |
> `Circle` itself conforms to `ChartSymbolShape` (`Charts:1796`) with `perceptualUnitRect` adjusting so a circle and a square look the same visual weight. Web: when rendering point marks, scale each glyph by its `perceptualUnitRect` so areas match.

---

## 20. Replica build checklist (what "web_ready" means for C9)

1. **`<Shape>`** universal renderer (measured SVG + `pathIn` callback) — §1.3. ✔ HTML+CSS+props given.
2. **`PathBuilder`** emitting SVG `d` — §2.4. ✔
3. **Primitives**: `Rectangle`, `Circle`, `Ellipse`, `Capsule` — each with a CSS shortcut AND exact SVG path — §3,§8. ✔
4. **`RoundedRectangle` + figma-squircle** (`cornerSmoothing:0.6`) as the default continuous-corner renderer; circular fallback to `border-radius` — §4. ✔ (the Apple look)
5. **`UnevenRoundedRectangle` / `ConcentricRectangle` / `ContainerRelativeShape`** via per-corner radii + the `--sui-container-radius` contract — §5,§6,§7. ✔
6. **`InsettableShape.strokeBorder`** → `box-shadow: inset` (inside border) vs `stroke` (centered) — §10. ✔
7. **Transforms** (`offset/scale/rotation/transform`) → CSS `transform` + `transform-origin` — §11. ✔
8. **`stroke` / `trim`** → SVG stroke + `stroke-dasharray`/`dashoffset` (progress rings) — §12. ✔
9. **`StrokeStyle` / `FillStyle`** → SVG stroke-* attrs + `fill-rule` — §13. ✔ (exact defaults: lineWidth 1, butt, miter, miterLimit 10)
10. **Gradients** (linear/radial/angular/elliptical/any/mesh) → CSS `linear/radial/conic-gradient` (+ canvas/WebGL for mesh) — §14. ✔
11. **`Canvas` + `GraphicsContext`** → `<canvas>` 2D adapter mirroring the API 1:1 — §15. ✔
12. **`ButtonBorderShape`** → shape token for buttons — §16. ✔
13. Named style tokens resolve to W1 `colors.md` vars; boolean ops precomputed at build time; Charts symbols = 8 fixed `d`-strings — §19. ✔ (tabulated)

**web_ready = true** — every deep-covered component (§1–§17) has its HTML element structure + exact CSS + React prop API. The one irreducible gap is `.continuous` corner fidelity, filled by the DESIGNED figma-squircle renderer (`cornerSmoothing 0.6`) since the interface only names the style and never defines its spline; the circular fallback (`border-radius`) is acceptable where pixel-fidelity is non-critical (W1 `shapes-effects.md` §3.1 records the same decision).

### Sources (runtime-visual / squircle research)
- [The Math Behind Squircles — squircle.js](https://squircle.js.org/blog/math-behind-squircles)
- [How Apple Uses Squircles in iOS Design — squircle.js](https://squircle.js.org/blog/squircles-in-apple-design)
- [My Quest for the Apple Icon Shape — liamrosenfeld.com](https://liamrosenfeld.com/posts/apple_icon_quest/)
- [CSS corner-shape: Squircle, Scoop, and Notch — modern-css.com](https://modern-css.com/corner-shapes-beyond-rounded-borders/)
