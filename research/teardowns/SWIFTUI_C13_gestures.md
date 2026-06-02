# SwiftUI Cluster C13 — Gestures (RE Teardown → Web Replica Spec)

**Goal:** a pixel/behavior-1:1 web replica of SwiftUI's gesture system as a TypeScript/React (Next.js) UI kit. This file is the **spec** a later agent uses to write the actual `useGesture` hook + recognizers. Every signature is quoted verbatim from the macOS SDK `.swiftinterface` with `file:line`. Labels: **KNOWN** = read from the interface; **INFERRED** = Apple docs / HIG / WWDC / reputable RE; **DESIGNED** = our engineering for the web port (no SwiftUI equivalent exists or the constant is private).

**Source files (Tier-1A):**
- `SwiftUICore` → `…/SwiftUICore.framework/…/arm64e-apple-macos.swiftinterface` (call it **CORE** below)
- `SwiftUI` → `…/SwiftUI.framework/…/arm64e-apple-macos.swiftinterface` (call it **SUI** below)

**Token references:** W1 tokens (`swiftui/tokens/*.md`) — `metric.tapTarget` (44 pt), the spring tokens `.smooth`/`.snappy`/`.bouncy`, `--sui-anim-*-css`. Used in the web-mapping sections.

---

## 0. The model you must internalize before writing any code

SwiftUI gestures are **not** DOM events. They are a **value-producing state machine** attached to a view. The whole system is three concepts:

1. **A `Gesture` is a recognizer that emits a `Value`** as it runs. `DragGesture.Value` is a struct of `{translation, location, …}`; `TapGesture.Value` is `Void`; `LongPressGesture.Value` is `Bool`. The gesture is generic over this `Value` type.
2. **Three callbacks consume the value at three lifecycle points:** `.updating($state){…}` (every change, writes to transient `GestureState`), `.onChanged{…}` (every change, your code), `.onEnded{…}` (recognition succeeded/finished). There is **no `onBegan`** — "began" is the first `onChanged`.
3. **Combinators build bigger gestures from smaller ones:** `.sequenced(before:)`, `.simultaneously(with:)`, `.exclusively(before:)`, plus `.map`. They produce wrapper gesture types (`SequenceGesture`, `SimultaneousGesture`, `ExclusiveGesture`, `_MapGesture`) whose `Value` is an enum/struct combining the children.

The **recognition thresholds** (minimumDistance, minimumDuration, maximumDistance, count, minimumScaleDelta, minimumAngleDelta) are the load-bearing constants — they are the entire reason a tap is not a drag. **These are the numbers the web hook must replicate exactly.**

### 0.1 The `Gesture` protocol — CORE:13729

```swift
@preconcurrency @_Concurrency.MainActor public protocol Gesture<Value> {
  associatedtype Value
  nonisolated static func _makeGesture(gesture: _GraphValue<Self>, inputs: _GestureInputs)
      -> _GestureOutputs<Self.Value>
  associatedtype Body : Gesture
  @MainActor var body: Self.Body { get }
}
```
(KNOWN.) Leaf gestures (`TapGesture`, `DragGesture`, …) set `typealias Body = Never` and implement `_makeGesture` directly; composite gestures (e.g. `WindowDragGesture`) supply a real `body`. `_GestureInputs`/`_GestureOutputs` (CORE:13756, CORE:13766) are opaque graph plumbing — empty public structs, the private recognizer state lives in the framework. We do **not** replicate the graph; we replicate the **observable recognition behavior**.

`Never : Gesture` (CORE, the `extension Swift.Never : Gesture`) is the "no body" terminator — irrelevant to the web port except that it tells you which types are leaves.

### 0.2 Web architecture — the recognizer core (DESIGNED)

We do **not** use DOM `click`/`dragstart`. We build everything on **Pointer Events** so mouse + touch + pen unify, and so we get `setPointerCapture` (the web analogue of SwiftUI grabbing the gesture). Core rules:

- **`touch-action: none`** on any element carrying a pan/drag/pinch/rotate gesture, so the browser does not steal the gesture for scrolling. (Equivalent to SwiftUI owning the touch.) For tap-only / long-press we keep `touch-action: manipulation` to preserve scroll.
- **`pointerdown`** → record `startLocation`, `startTime`, call `el.setPointerCapture(e.pointerId)`. **`pointermove`** → update `location`, compute `translation = location − startLocation`, run threshold checks. **`pointerup`/`pointercancel`** → finalize or fail.
- A **recognizer object** per gesture with a state enum: `possible → began → changed* → ended | failed | cancelled`. Thresholds decide the `possible→began` transition. This mirrors UIKit's `UIGestureRecognizer.State` (which SwiftUI wraps).
- **Value emission:** each recognizer produces the SwiftUI `Value` shape (see each section) and feeds three sinks: `onUpdate` (drives `GestureState` reset-on-end), `onChange`, `onEnded`.

The reference React surface for the whole cluster:

```ts
// useGesture(ref, gesture, { mask })  — gesture is a recognizer tree built by the combinators below
type GestureState = 'possible' | 'began' | 'changed' | 'ended' | 'failed' | 'cancelled';
interface Recognizer<V> {
  onPointerDown(e: PointerEvent): void;
  onPointerMove(e: PointerEvent): void;
  onPointerUp(e: PointerEvent): void;
  onPointerCancel(e: PointerEvent): void;
  // sinks set by combinators / modifiers:
  onChanged?: (v: V) => void;
  onEnded?: (v: V) => void;
  updating?: (v: V) => void;   // transient; auto-reset on end
}
```

The sections below give each gesture's exact `Value`, exact thresholds, and how the recognizer fills them.

---

## 1. TapGesture — CORE:14256

### 1.1 Exact API (KNOWN)
```swift
public struct TapGesture : Gesture {           // CORE:14256
  public var count: Swift.Int
  public init(count: Swift.Int = 1)            // default count = 1
  public typealias Value = Swift.Void          // emits Void — a tap carries no position
  public typealias Body = Swift.Never
}
```
View-modifier sugar — CORE:14274:
```swift
extension View {
  nonisolated public func onTapGesture(count: Int = 1, perform action: @escaping () -> Void) -> some View
}
```
`count` is the number of taps that must land **before recognition fires**. `count: 2` = double-tap; `count: 1` (default) = single tap.

### 1.2 Visual anatomy & states
TapGesture renders **nothing** itself — it's attached to a host view. It has **no visual.** But its recognition gates the host's pressed/highlight state when used via `Button`/`_ButtonGesture` (see §16). For replication: the *tap target* is the host element; W1 token `metric.tapTarget` = **44 pt** minimum hit area (INFERRED, HIG) on touch class, **28 pt** pointer-class on macOS.

States the recognizer exposes: `possible` (finger down, inside) → `ended` (lifted within the tap window, did not exceed slop) | `failed` (moved too far / lifted outside / wrong count). There is no "changed" — a tap is atomic; only `onEnded` (and the Button highlight) is observable.

### 1.3 Behavior (recognition rules — INFERRED from UIKit `UITapGestureRecognizer` parity)
- **Slop (movement tolerance):** UIKit allows ~10 pt of finger movement before a tap fails. SwiftUI inherits this; there is no public constant, so we adopt **10 pt** (matches DragGesture's default `minimumDistance`).
- **Multi-tap window:** consecutive taps must arrive within the system double-tap interval (~**0.3 s**, INFERRED — matches macOS default double-click and iOS `UITapGestureRecognizer`) and within a small spatial radius of the first tap.
- **No animation of its own.** Animations come from the host (Button scale, list-row highlight).

### 1.4 Web replication mapping
HTML: any element. CSS: `touch-action: manipulation` (preserve scroll — a tap should not block panning); `cursor: default` (taps don't change cursor). Add invisible hit padding to reach 44 px if the visual is smaller:
```css
.sui-tap-target { position: relative; }
.sui-tap-target::before { content:""; position:absolute; inset:50% 50% 50% 50%;
  width:44px; height:44px; transform:translate(-50%,-50%); } /* min hit box */
```
Recognizer (DESIGNED — replicates count + slop + window):
```ts
function tapRecognizer(count = 1, opts = { slop: 10, multiTapInterval: 300 }): Recognizer<void> {
  let taps = 0, lastTime = 0, startX = 0, startY = 0, failed = false;
  return {
    onPointerDown(e){ startX=e.clientX; startY=e.clientY; failed=false;
      if (e.timeStamp - lastTime > opts.multiTapInterval) taps = 0; },
    onPointerMove(e){ if (Math.hypot(e.clientX-startX, e.clientY-startY) > opts.slop) failed = true; },
    onPointerUp(e){
      if (failed) { taps = 0; return; }
      taps += 1; lastTime = e.timeStamp;
      if (taps >= count) { taps = 0; this.onEnded?.(); }   // fire only at required count
    },
    onPointerCancel(){ taps = 0; failed = true; }
  };
}
```
React API: `<Tappable count={2} onTap={() => …}>` or hook `useTapGesture(ref, {count, onEnded})`. Mirrors `.onTapGesture(count:perform:)`.

---

## 2. SpatialTapGesture — SUI:22836

### 2.1 Exact API (KNOWN)
```swift
public struct SpatialTapGesture : Gesture {     // SUI:22836
  public struct Value : Equatable, @unchecked Sendable {
    public var location: CGPoint                // the tap point — THIS is the difference vs TapGesture
  }
  public var count: Swift.Int
  public var coordinateSpace: CoordinateSpace
  @_disfavoredOverload public init(count: Int = 1, coordinateSpace: CoordinateSpace = .local)   // deprecated form
  public init(count: Int = 1, coordinateSpace: some CoordinateSpaceProtocol = .local)           // current form
  public typealias Body = Swift.Never
}
```
Modifier sugar — SUI:22866 (note: this overload of `onTapGesture` carries the location):
```swift
extension View {
  @_disfavoredOverload public func onTapGesture(count: Int = 1, coordinateSpace: CoordinateSpace = .local,
      perform action: @escaping (CGPoint) -> Void) -> some View        // SUI:22866
  public func onTapGesture(count: Int = 1, coordinateSpace: some CoordinateSpaceProtocol = .local,
      perform action: @escaping (CGPoint) -> Void) -> some View        // SUI:22872
}
```
**Difference from TapGesture:** identical recognition, but `Value` carries the **`location`** of the tap in the requested coordinate space (`.local` = within the view's own coordinate system; `.global` = window). Use it for "tap to drop a pin here."

### 2.2 Behavior & web mapping
Recognition rules identical to §1.3. Coordinate space: `.local` → use `e.offsetX/offsetY` (or `getBoundingClientRect` math); `.global` → `e.clientX/clientY`. Reuse `tapRecognizer` but emit `{location:{x,y}}` instead of `void`:
```ts
function spatialTapRecognizer(count=1, space:'local'|'global'='local'): Recognizer<{location:{x:number;y:number}}> {
  // identical gating to tapRecognizer; on success:
  // const r = el.getBoundingClientRect();
  // const loc = space==='local' ? {x:e.clientX-r.left, y:e.clientY-r.top} : {x:e.clientX, y:e.clientY};
  // this.onEnded?.({location: loc});
}
```
React: `<SpatialTappable count={1} coordinateSpace="local" onTap={(pt)=>…} />`.

---

## 3. DragGesture — SUI:3487 (the canonical drag, richest Value)

### 3.1 Exact API (KNOWN)
```swift
public struct DragGesture : Gesture {                 // SUI:3487
  public struct Value : Equatable, Sendable {
    public var time: Foundation.Date
    public var location: CGPoint                       // current point
    public var startLocation: CGPoint                  // point where the drag began
    public var translation: CGSize { get }             // location − startLocation (computed)
    @_alwaysEmitIntoClient public var velocity: CGSize { get {        // ← IMPLEMENTATION IS IN THE INTERFACE:
        let predicted = predictedEndLocation
        return CGSize(width: 4.0 * (predicted.x - location.x),
                      height: 4.0 * (predicted.y - location.y))
    }}
    public var predictedEndLocation: CGPoint { get }
    public var predictedEndTranslation: CGSize { get }
  }
  public var minimumDistance: CGFloat                   // default 10
  public var coordinateSpace: CoordinateSpace
  @_disfavoredOverload public init(minimumDistance: CGFloat = 10, coordinateSpace: CoordinateSpace = .local)   // SUI:3514 (deprecated)
  public init(minimumDistance: CGFloat = 10, coordinateSpace: some CoordinateSpaceProtocol = .local)          // SUI:3522 (current)
  public typealias Body = Swift.Never
}
```

**This is the single most important constant in the cluster.** The `velocity` getter is exposed *with its body* in the interface:
> `velocity = 4.0 * (predictedEndLocation − location)`

So if you know `predictedEndLocation`, velocity is derived by a factor of **4.0**. Conversely Apple's deceleration model means `predictedEndLocation` is computed from the instantaneous velocity by the inverse: **`predictedEndLocation = location + velocity/4.0`**, i.e. `predictedEndTranslation = translation + velocity/4.0`. The `/4` (≈ ×0.25) is UIKit's standard projection at the default deceleration rate — see §3.4.

### 3.2 Value fields — exact semantics (KNOWN field list, INFERRED math)
| field | meaning | how to compute on web |
|---|---|---|
| `time` | timestamp of this sample | `new Date(e.timeStamp)` / `performance.now()` |
| `startLocation` | where finger first touched (after `minimumDistance` is crossed, this is the **original** down point, not the threshold-cross point) | captured at `pointerdown` |
| `location` | current finger point | `e.clientX/Y` mapped to coordinate space |
| `translation` | `{width: location.x − startLocation.x, height: location.y − startLocation.y}` | subtract |
| `velocity` | points/second, ×4 of projected delta | finite-difference of last 2–3 samples (see §3.4) |
| `predictedEndLocation` | where the drag would land if released now (momentum) | `location + velocity/4` |
| `predictedEndTranslation` | `predictedEndLocation − startLocation` | `translation + velocity/4` |

Important RE note: `startLocation` is the **true initial touch**, so `translation` includes the `minimumDistance` you had to travel to start. The recognizer does **not** zero out the threshold.

### 3.3 Visual anatomy & states
DragGesture renders nothing; it drives the host view's offset/rotation/etc. via your `onChanged`. States: `possible` (down, < minimumDistance moved) → `began`/`changed` (first move past `minimumDistance`, every subsequent move) → `ended` (lifted) | `cancelled`. There is **no failed-on-distance** (any movement past threshold begins it); it fails only if a competing higher-priority gesture wins, or pointer is cancelled.

### 3.4 Behavior — thresholds, velocity, momentum (KNOWN default + INFERRED model)
- **`minimumDistance` default = 10 pt** (KNOWN, SUI:3514/3522). Set `minimumDistance: 0` for an immediate drag (begins on touch-down — used for sliders/knobs). Below threshold, no `onChanged` fires.
- **`coordinateSpace` default `.local`** (KNOWN). `.local` → relative to the gesture's view; `.global` → window/screen; `.named(_)` → a named coordinate space.
- **Velocity** (INFERRED): SwiftUI samples pointer deltas; `velocity = 4 × (predictedEnd − location)`. UIKit's projection uses decelerationRate `UIScrollView.DecelerationRate.normal = 0.998`, and the standard projection `projected = current + velocity·(decel/(1−decel))·(1/1000)`. The constant collapses to the ×0.25 you see in the interface (`velocity/4` recovers the projection), so on web we compute instantaneous velocity from samples and reproduce both fields with the same ×4 / ÷4 relationship — guaranteeing `velocity` and `predictedEndTranslation` are mutually consistent, exactly as the interface defines.

### 3.5 Web replication mapping
HTML: the draggable element. CSS **must** include `touch-action: none` (otherwise touch-drag scrolls the page) and during drag `user-select: none; cursor: grabbing`:
```css
.sui-drag { touch-action: none; cursor: grab; }
.sui-drag[data-dragging="true"] { cursor: grabbing; user-select: none; }
```
Recognizer (DESIGNED — replicates minimumDistance, full Value, ×4 velocity):
```ts
interface DragValue {
  time: number; location:{x:number;y:number}; startLocation:{x:number;y:number};
  translation:{width:number;height:number};
  velocity:{width:number;height:number};
  predictedEndLocation:{x:number;y:number}; predictedEndTranslation:{width:number;height:number};
}
function dragRecognizer(minimumDistance = 10, space:'local'|'global'='local'): Recognizer<DragValue> {
  let start={x:0,y:0}, began=false, samples:{t:number;x:number;y:number}[]=[];
  const toSpace=(e:PointerEvent,el:HTMLElement)=>{ const r=el.getBoundingClientRect();
    return space==='local' ? {x:e.clientX-r.left,y:e.clientY-r.top} : {x:e.clientX,y:e.clientY}; };
  const build=(loc:{x:number;y:number},t:number):DragValue=>{
    // velocity from last 2 samples (points/sec)
    let vx=0, vy=0;
    if (samples.length>=2){ const a=samples.at(-2)!, b=samples.at(-1)!; const dt=(b.t-a.t)/1000 || 1e-3;
      vx=(b.x-a.x)/dt; vy=(b.y-a.y)/dt; }
    const velocity={width:vx,height:vy};
    const predictedEndLocation={x:loc.x+vx/4, y:loc.y+vy/4};   // interface: velocity = 4·(predicted−loc)
    return { time:t, location:loc, startLocation:start,
      translation:{width:loc.x-start.x, height:loc.y-start.y},
      velocity,
      predictedEndLocation,
      predictedEndTranslation:{width:predictedEndLocation.x-start.x, height:predictedEndLocation.y-start.y} };
  };
  return {
    onPointerDown(e){ const el=e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId);
      start=toSpace(e,el); began=(minimumDistance===0); samples=[{t:e.timeStamp,x:start.x,y:start.y}];
      if (began) this.onChanged?.(build(start,e.timeStamp)); },
    onPointerMove(e){ const el=e.currentTarget as HTMLElement; const loc=toSpace(e,el);
      samples.push({t:e.timeStamp,x:loc.x,y:loc.y}); if (samples.length>4) samples.shift();
      if (!began && Math.hypot(loc.x-start.x, loc.y-start.y) >= minimumDistance) began=true;
      if (began) this.onChanged?.(build(loc,e.timeStamp)); },
    onPointerUp(e){ const el=e.currentTarget as HTMLElement; const loc=toSpace(e,el);
      if (began) this.onEnded?.(build(loc,e.timeStamp)); began=false; },
    onPointerCancel(){ began=false; }
  };
}
```
React API mirrors SwiftUI: `<Draggable minimumDistance={10} coordinateSpace="local" onChanged={(v)=>…} onEnded={(v)=>…} />`, or composed via the combinators (§9–11).

---

## 4. LongPressGesture — SUI:16994

### 4.1 Exact API (KNOWN)
```swift
public struct LongPressGesture : Gesture {            // SUI:16994
  public var minimumDuration: Swift.Double            // default 0.5
  @available(tvOS, unavailable) public var maximumDistance: CGFloat { get set }   // default 10
  public init(minimumDuration: Double = 0.5, maximumDistance: CGFloat = 10)       // SUI:17003
  @available(iOS,macOS,watchOS,visionOS unavailable) public init(minimumDuration: Double = 0.5)  // tvOS-only
  public typealias Value = Swift.Bool                  // true once the press has been held long enough
  public typealias Body = Swift.Never
}
```
Modifier sugar — SUI:17019 / 17031 / 17046 / 17053 (4 overloads):
```swift
extension View {
  public func onLongPressGesture(minimumDuration: Double = 0.5, maximumDistance: CGFloat = 10,
      perform action: @escaping () -> Void, onPressingChanged: ((Bool) -> Void)? = nil) -> some View   // SUI:17019
  public func onLongPressGesture(minimumDuration: Double = 0.5,
      perform action: @escaping () -> Void, onPressingChanged: ((Bool) -> Void)? = nil) -> some View   // SUI:17031
  @_disfavoredOverload public func onLongPressGesture(minimumDuration: Double = 0.5, maximumDistance: CGFloat = 10,
      pressing: ((Bool) -> Void)? = nil, perform action: @escaping () -> Void) -> some View            // SUI:17046
  @_disfavoredOverload public func onLongPressGesture(minimumDuration: Double = 0.5,
      pressing: ((Bool) -> Void)? = nil, perform action: @escaping () -> Void) -> some View            // SUI:17053
}
```

### 4.2 Semantics & states (KNOWN constants)
- **`minimumDuration` default = 0.5 s** — the hold time before the gesture *succeeds*.
- **`maximumDistance` default = 10 pt** — if the finger moves farther than this during the hold, the gesture **fails** (it is not a long-press if you wander). Same 10 pt slop as drag/tap.
- **`Value = Bool`:** `onChanged(true)` fires the instant `minimumDuration` elapses while still pressed; `onEnded` fires when you release **after** success. `onPressingChanged`/`pressing:` callback fires `true` at touch-down (pressing begins) and `false` at release/cancel — this is how you drive a "pressed" highlight while waiting.

State machine: `possible` (down) → after `minimumDuration` held within `maximumDistance` → `succeeded`(Value=true) → `ended` on release. Moving > `maximumDistance` or releasing early → `failed`.

### 4.3 Web replication mapping
CSS: `touch-action: manipulation` (long-press shouldn't necessarily kill scroll, but on iOS you usually want `none` to suppress the callout) + suppress the native context menu/callout: `-webkit-touch-callout: none; user-select: none;`.
```ts
function longPressRecognizer(minimumDuration=0.5, maximumDistance=10): Recognizer<boolean> {
  let timer:number|undefined, start={x:0,y:0}, succeeded=false;
  return {
    onPointerDown(e){ const el=e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId);
      start={x:e.clientX,y:e.clientY}; succeeded=false;
      (this as any).pressing?.(true);                       // onPressingChanged(true)
      timer=window.setTimeout(()=>{ succeeded=true; this.onChanged?.(true); }, minimumDuration*1000); },
    onPointerMove(e){ if (Math.hypot(e.clientX-start.x, e.clientY-start.y) > maximumDistance) {
      clearTimeout(timer); (this as any).pressing?.(false); } },     // wandered → fail
    onPointerUp(){ clearTimeout(timer); (this as any).pressing?.(false);
      if (succeeded) this.onEnded?.(true); },
    onPointerCancel(){ clearTimeout(timer); (this as any).pressing?.(false); }
  };
}
```
React: `<LongPressable minimumDuration={0.5} maximumDistance={10} onPressingChanged={(b)=>setPressed(b)} onEnded={()=>…} />`. The `onLongTouchGesture` modifier (SUI:8851 — `minimumDuration:perform:onTouchingChanged:`) is the iOS-table variant; same recognizer, alias the `onTouchingChanged` to `pressing`.

---

## 5. MagnifyGesture — SUI:9791 (pinch-to-zoom; replaces MagnificationGesture)

### 5.1 Exact API (KNOWN)
```swift
public struct MagnifyGesture : Gesture {              // SUI:9791
  public struct Value : Equatable, Sendable {
    public var time: Foundation.Date
    public var magnification: CGFloat                  // 1.0 = no change, 2.0 = doubled
    public var velocity: CGFloat                       // scale change per second
    public var startAnchor: UnitPoint                  // pinch center as a unit point (0…1)
    public var startLocation: CGPoint                  // pinch center in points
  }
  public var minimumScaleDelta: CGFloat                 // default 0.01
  public init(minimumScaleDelta: CGFloat = 0.01)        // SUI:9801
  public typealias Body = Swift.Never
}                                                       // iOS 17 / macOS 14
```
**Deprecated predecessor — MagnificationGesture (SUI:9773):**
```swift
public struct MagnificationGesture : Gesture {        // SUI:9773  (renamed to MagnifyGesture)
  public var minimumScaleDelta: CGFloat
  public init(minimumScaleDelta: CGFloat = 0.01)
  public typealias Value = CGFloat                      // ← OLD: Value was just the bare CGFloat scale
}
```
The rename added the rich `Value` struct (anchor/location/velocity); the old one's `Value` was a bare `CGFloat`. Same **0.01** threshold.

### 5.2 Semantics (KNOWN constants)
- **`minimumScaleDelta` default = 0.01** — the gesture begins only once the scale has changed by ≥1% from 1.0. Prevents jitter from firing a zoom.
- **`magnification`** is a *ratio* relative to the start (multiply your base scale by it). **`startAnchor`** (UnitPoint, e.g. `.center` = (0.5,0.5)) is where to anchor the zoom — apply `transform-origin` there.

### 5.3 Web replication mapping (Pointer Events — two-finger pinch)
The web has no native pinch gesture object; you track **two active pointers** and compute distance ratio. CSS: `touch-action: none`.
```ts
interface MagnifyValue { time:number; magnification:number; velocity:number;
  startAnchor:{x:number;y:number}; startLocation:{x:number;y:number}; }
function magnifyRecognizer(minimumScaleDelta=0.01): Recognizer<MagnifyValue> {
  const pts=new Map<number,{x:number;y:number}>(); let startDist=0, anchor={x:0,y:0}, anchorPt={x:0,y:0};
  let began=false, lastMag=1, lastT=0;
  const dist=()=>{ const [a,b]=[...pts.values()]; return Math.hypot(a.x-b.x,a.y-b.y); };
  return {
    onPointerDown(e){ pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if (pts.size===2){ const el=e.currentTarget as HTMLElement; const r=el.getBoundingClientRect();
        const [a,b]=[...pts.values()]; const cx=(a.x+b.x)/2, cy=(a.y+b.y)/2;
        startDist=dist(); anchorPt={x:cx,y:cy}; anchor={x:(cx-r.left)/r.width,y:(cy-r.top)/r.height};
        began=false; lastMag=1; lastT=e.timeStamp; } },
    onPointerMove(e){ if (!pts.has(e.pointerId)) return; pts.get(e.pointerId)!.x=e.clientX; pts.get(e.pointerId)!.y=e.clientY;
      if (pts.size<2) return; const mag=dist()/startDist;
      if (!began && Math.abs(mag-1) >= minimumScaleDelta) began=true;
      if (began){ const dt=(e.timeStamp-lastT)/1000||1e-3; const vel=(mag-lastMag)/dt;
        this.onChanged?.({time:e.timeStamp, magnification:mag, velocity:vel, startAnchor:anchor, startLocation:anchorPt});
        lastMag=mag; lastT=e.timeStamp; } },
    onPointerUp(e){ pts.delete(e.pointerId);
      if (began && pts.size<2){ this.onEnded?.({time:e.timeStamp, magnification:lastMag, velocity:0, startAnchor:anchor, startLocation:anchorPt}); began=false; } },
    onPointerCancel(e){ pts.delete(e.pointerId); began=false; }
  };
}
```
Mouse fallback (DESIGNED): on desktop, map `wheel` with `ctrlKey` (trackpad pinch surfaces as ctrl+wheel) to `magnification *= 1 - e.deltaY*0.01`. React: `<Magnifiable minimumScaleDelta={0.01} onChanged={(v)=>setScale(base*v.magnification)} />`. Apply `transform: scale(); transform-origin: calc(anchor.x*100%) calc(anchor.y*100%);`.

---

## 6. RotateGesture — SUI:5172 (two-finger rotation; replaces RotationGesture)

### 6.1 Exact API (KNOWN)
```swift
public struct RotateGesture : Gesture {              // SUI:5172
  public struct Value : Equatable, Sendable {
    public var time: Foundation.Date
    public var rotation: SwiftUICore.Angle            // accumulated rotation (Angle, degrees/radians)
    public var velocity: SwiftUICore.Angle            // angular velocity (Angle per second)
    public var startAnchor: UnitPoint
    public var startLocation: CGPoint
  }
  public var minimumAngleDelta: SwiftUICore.Angle      // default .degrees(1)
  public init(minimumAngleDelta: Angle = .degrees(1))  // SUI:5183
  public typealias Body = Swift.Never
}                                                      // iOS 17 / macOS 14
```
**Deprecated predecessor — RotationGesture (SUI:5154):** `Value = Angle` (bare), same `minimumAngleDelta: Angle = .degrees(1)`.

### 6.2 Semantics (KNOWN)
- **`minimumAngleDelta` default = `.degrees(1)`** — rotation must exceed 1° before the gesture begins.
- **`rotation`** is the accumulated angle of the two-finger twist; apply as `rotate()` around `startAnchor`.

### 6.3 Web replication mapping
Two-pointer angle tracking. `Angle` → store radians/degrees; SwiftUI `Angle.degrees(1)` = 1°.
```ts
interface RotateValue { time:number; rotation:number /*deg*/; velocity:number; startAnchor:{x:number;y:number}; startLocation:{x:number;y:number}; }
function rotateRecognizer(minimumAngleDeltaDeg=1): Recognizer<RotateValue> {
  const pts=new Map<number,{x:number;y:number}>(); let startAngle=0, anchor={x:0,y:0}, anchorPt={x:0,y:0};
  let began=false, lastRot=0, lastT=0;
  const angle=()=>{ const [a,b]=[...pts.values()]; return Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI; };
  return {
    onPointerDown(e){ pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if (pts.size===2){ const el=e.currentTarget as HTMLElement, r=el.getBoundingClientRect();
        const [a,b]=[...pts.values()]; const cx=(a.x+b.x)/2, cy=(a.y+b.y)/2;
        startAngle=angle(); anchorPt={x:cx,y:cy}; anchor={x:(cx-r.left)/r.width,y:(cy-r.top)/r.height};
        began=false; lastRot=0; lastT=e.timeStamp; } },
    onPointerMove(e){ if(!pts.has(e.pointerId))return; const p=pts.get(e.pointerId)!; p.x=e.clientX;p.y=e.clientY;
      if (pts.size<2) return; let rot=angle()-startAngle;
      while(rot>180)rot-=360; while(rot<-180)rot+=360;       // shortest-arc unwrap
      if (!began && Math.abs(rot) >= minimumAngleDeltaDeg) began=true;
      if (began){ const dt=(e.timeStamp-lastT)/1000||1e-3; const vel=(rot-lastRot)/dt;
        this.onChanged?.({time:e.timeStamp, rotation:rot, velocity:vel, startAnchor:anchor, startLocation:anchorPt});
        lastRot=rot; lastT=e.timeStamp; } },
    onPointerUp(e){ pts.delete(e.pointerId);
      if (began && pts.size<2){ this.onEnded?.({time:e.timeStamp, rotation:lastRot, velocity:0, startAnchor:anchor, startLocation:anchorPt}); began=false; } },
    onPointerCancel(e){ pts.delete(e.pointerId); began=false; }
  };
}
```
Often composed with MagnifyGesture via `.simultaneously` (§10) for "pinch + rotate a photo." React: `<Rotatable minimumAngleDelta={1} onChanged={(v)=>setAngle(base+v.rotation)} />`. Apply `transform: rotate(${rotation}deg); transform-origin: anchor`.

---

## 7. GestureState + .updating + GestureStateGesture — SUI:3599 / 3631 / 3636

This is the **transient-state mechanism**: a property that holds gesture-in-progress data and **auto-resets to its initial value the instant the gesture ends/cancels**. The killer feature: you never have to manually reset drag offset on release.

### 7.1 Exact API (KNOWN)
```swift
@propertyWrapper @frozen public struct GestureState<Value> : DynamicProperty {   // SUI:3599
  public init(wrappedValue: Value)
  public init(initialValue: Value)                                   // alias
  public init(wrappedValue: Value, resetTransaction: Transaction)    // reset with a transaction (animate the snap-back)
  public init(initialValue: Value, resetTransaction: Transaction)
  public init(wrappedValue: Value, reset: @escaping (Value, inout Transaction) -> Void)  // custom reset
  public init(initialValue: Value, reset: @escaping (Value, inout Transaction) -> Void)
  public var wrappedValue: Value { get }                             // READ-ONLY outside .updating
  public var projectedValue: GestureState<Value> { get }            // the $ binding passed to .updating
}
// For ExpressibleByNilLiteral (Optional) — SUI:3627:
extension GestureState where Value : ExpressibleByNilLiteral {
  public init(resetTransaction: Transaction = Transaction())
  public init(reset: @escaping (Value, inout Transaction) -> Void)
}
```
The `.updating` operator — SUI:3631:
```swift
extension Gesture {
  @inlinable public func updating<State>(_ state: GestureState<State>,
      body: @escaping (Self.Value, inout State, inout Transaction) -> Void)
      -> GestureStateGesture<Self, State> {
        return .init(base: self, state: state, body: body)        // ← body IS in the interface
  }
}
```
The wrapper gesture it produces — SUI:3636:
```swift
@frozen public struct GestureStateGesture<Base, State> : Gesture where Base : Gesture {  // SUI:3636
  public typealias Value = Base.Value
  public var base: Base
  public var state: GestureState<State>
  public var body: (Value, inout State, inout Transaction) -> Void
  public init(base: Base, state: GestureState<State>, body: @escaping (Value, inout State, inout Transaction) -> Void)
}
```

### 7.2 Behavior (KNOWN mechanism)
1. You declare `@GestureState private var drag: CGSize = .zero`.
2. `.updating($drag) { value, state, transaction in state = value.translation }` — runs on **every** value change while the gesture is active; writes into the *transient* `state`.
3. The framework **automatically resets** `drag` to its `initialValue` (`.zero`) the moment the gesture ends or cancels — optionally via the `resetTransaction` (so the snap-back can animate). `wrappedValue` is read-only precisely because only `.updating` may mutate it.
4. **Contrast with `@State` + `.onChanged`:** with `@State` you keep the final value (and must reset manually in `onEnded`). With `@GestureState` it always reverts. That's the whole semantic.

### 7.3 Web replication mapping (DESIGNED — React hook)
React equivalent: a `useGestureState(initial)` that returns `[value, bind]` where `bind` is the `.updating` body, and the value **resets to `initial` automatically on gesture end** (optionally animated):
```ts
function useGestureState<T>(initial: T, resetAnimation?: SpringToken) {
  const [value, setValue] = React.useState<T>(initial);
  const updating = React.useCallback((v:T) => setValue(v), []);
  const reset = React.useCallback(() => {
    if (resetAnimation) animateTo(setValue, value, initial, resetAnimation);  // snap-back via §W1 spring
    else setValue(initial);
  }, [resetAnimation, value]);
  return { value, updating, reset } as const;
}
// usage: const drag = useGestureState({width:0,height:0});
// dragRecognizer.updating = (v)=>drag.updating(v.translation);
// dragRecognizer.onEnded   = ()=>drag.reset();   // ← the auto-reset wired in
```
The `resetTransaction` maps to a W1 spring token (`.smooth`/`.snappy`) used by `animateTo` so the element springs back home on release — exactly SwiftUI's animated reset. React API sugar: `useDragGesture(ref, { onUpdating, onEnded })` plus `useGestureState`.

---

## 8. Value operators — .onChanged / .onEnded / .map (_ChangedGesture / _EndedGesture / _MapGesture)

These wrap a gesture to attach a callback or transform its `Value`. They produce internal wrapper gesture types.

### 8.1 Exact API (KNOWN)
```swift
extension Gesture {                                               // CORE:5711
  public func onEnded(_ action: @escaping (Self.Value) -> Void) -> _EndedGesture<Self>
}
extension Gesture where Self.Value : Equatable {                  // CORE:5719  (onChanged needs Equatable!)
  public func onChanged(_ action: @escaping (Self.Value) -> Void) -> _ChangedGesture<Self>
}
extension Gesture {                                               // CORE:9930
  public func map<T>(_ body: @escaping (Self.Value) -> T) -> _MapGesture<Self, T>
}
public struct _EndedGesture<Content>   where Content : Gesture { typealias Value = Content.Value }     // CORE:5726
public struct _ChangedGesture<Content> where Content : Gesture, Content.Value : Equatable {            // CORE:5741
  typealias Value = Content.Value }
public struct _MapGesture<Content, Value> where Content : Gesture { … }                                // CORE:9937
```

### 8.2 Notes (KNOWN)
- **`onChanged` requires `Value : Equatable`** — it only fires when the value *actually changed* (it dedups). `onEnded` has no such constraint (it fires once at the end regardless).
- **`.map`** transforms the emitted value type (e.g. map a `DragGesture.Value` to a custom enum). Pure value transform, no recognition change.

### 8.3 Web mapping (DESIGNED)
These are pure wiring on the recognizer sinks — no new DOM:
```ts
function onChanged<V>(rec: Recognizer<V>, fn:(v:V)=>void, eq:(a:V,b:V)=>boolean = Object.is): Recognizer<V> {
  let last: V | undefined; const prev = rec.onChanged;
  rec.onChanged = (v)=>{ prev?.(v); if (last===undefined || !eq(last,v)){ last=v; fn(v); } }; return rec;
}
function onEnded<V>(rec: Recognizer<V>, fn:(v:V)=>void): Recognizer<V> {
  const prev = rec.onEnded; rec.onEnded = (v)=>{ prev?.(v); fn(v); }; return rec;
}
function mapGesture<V,T>(rec: Recognizer<V>, body:(v:V)=>T): Recognizer<T> {
  const out = {...rec} as unknown as Recognizer<T>;
  rec.onChanged = (v)=>out.onChanged?.(body(v)); rec.onEnded = (v)=>out.onEnded?.(body(v)); return out;
}
```

---

## 9. SequenceGesture + .sequenced(before:) — SUI:2209 / 2204

One gesture must **succeed first**, then the second runs. Canonical use: long-press, then drag (press-and-drag to reorder).

### 9.1 Exact API (KNOWN)
```swift
@frozen public struct SequenceGesture<First, Second> : Gesture where First:Gesture, Second:Gesture {  // SUI:2209
  @frozen public enum Value {
    case first(First.Value)                       // first gesture still running
    case second(First.Value, Second.Value?)       // first done; second running (Second.Value may be nil until it begins)
  }
  public var first: First
  public var second: Second
  @inlinable public init(_ first: First, _ second: Second)
}
extension Gesture {                                                                                    // SUI:2204
  @inlinable public func sequenced<Other>(before other: Other) -> SequenceGesture<Self, Other>
      where Other : Gesture { return SequenceGesture(self, other) }                                    // body in interface
}
```

### 9.2 Behavior (KNOWN)
`a.sequenced(before: b)`: `b` cannot begin until `a` has **succeeded**. While in `.first`, only `a`'s value flows; once `a` ends successfully, state moves to `.second`, and `b` recognizes from there. If `a` fails, the whole sequence fails.

### 9.3 Web mapping (DESIGNED — state machine)
```ts
type SeqValue<A,B> = {phase:'first'; first:A} | {phase:'second'; first:A; second:B|null};
function sequenced<A,B>(a: Recognizer<A>, b: Recognizer<B>): Recognizer<SeqValue<A,B>> {
  let phase:'first'|'second'='first'; let firstVal:A; const out: any = {};
  a.onEnded = (v)=>{ firstVal=v; phase='second'; out.onChanged?.({phase:'second',first:v,second:null}); };
  a.onChanged = (v)=>{ if(phase==='first') out.onChanged?.({phase:'first',first:v}); };
  b.onChanged = (v)=>{ if(phase==='second') out.onChanged?.({phase:'second',first:firstVal,second:v}); };
  b.onEnded   = (v)=>{ if(phase==='second') out.onEnded?.({phase:'second',first:firstVal,second:v}); };
  // route pointer events to `a` until phase==='second', then to `b`:
  return { onPointerDown:(e)=> (phase==='first'?a:b).onPointerDown(e),
           onPointerMove:(e)=>{ a.onPointerMove(e); if(phase==='second') b.onPointerMove(e); },
           onPointerUp:(e)=> (phase==='first'?a:b).onPointerUp(e),
           onPointerCancel:(e)=>{a.onPointerCancel(e);b.onPointerCancel(e);},
           ...out } as Recognizer<SeqValue<A,B>>;
}
```
React: `longPress.sequenced(before: drag)` → `sequenced(longPressRecognizer(), dragRecognizer(0))`.

---

## 10. SimultaneousGesture + .simultaneously(with:) — CORE:1080 / 1071

Both gestures recognize **at the same time** from the same touches. Canonical: pinch + rotate together.

### 10.1 Exact API (KNOWN)
```swift
@frozen public struct SimultaneousGesture<First, Second> : Gesture where First:Gesture, Second:Gesture { // CORE:1080
  @frozen public struct Value {
    public var first: First.Value?                 // both optional — either may not have begun yet
    public var second: Second.Value?
  }
  public var first: First
  public var second: Second
  @inlinable public init(_ first: First, _ second: Second)
}
extension Gesture {                                                                                       // CORE:1071
  @inlinable public func simultaneously<Other>(with other: Other) -> SimultaneousGesture<Self, Other>
      where Other : Gesture { return SimultaneousGesture(self, other) }
}
```
`Value` is a **struct with two optionals** (vs Sequence/Exclusive which are enums) — because both can be active concurrently and either may be nil before it begins.

### 10.2 Web mapping (DESIGNED)
Both recognizers receive **every** pointer event; merge their values into `{first, second}`:
```ts
function simultaneously<A,B>(a: Recognizer<A>, b: Recognizer<B>): Recognizer<{first:A|null; second:B|null}> {
  let fa:A|null=null, fb:B|null=null; const out:any={};
  a.onChanged=(v)=>{fa=v; out.onChanged?.({first:fa,second:fb});}; a.onEnded=(v)=>{fa=v; out.onChanged?.({first:fa,second:fb});};
  b.onChanged=(v)=>{fb=v; out.onChanged?.({first:fa,second:fb});}; b.onEnded=(v)=>{fb=v; out.onChanged?.({first:fa,second:fb});};
  return { onPointerDown:(e)=>{a.onPointerDown(e);b.onPointerDown(e);},
           onPointerMove:(e)=>{a.onPointerMove(e);b.onPointerMove(e);},
           onPointerUp:(e)=>{a.onPointerUp(e);b.onPointerUp(e);},
           onPointerCancel:(e)=>{a.onPointerCancel(e);b.onPointerCancel(e);}, ...out };
}
```
React: `MagnifyGesture().simultaneously(with: RotateGesture())` → `simultaneously(magnifyRecognizer(), rotateRecognizer())`. The view-level `.simultaneousGesture(_:)` modifier (§13) is the same idea applied against the host's other gestures.

---

## 11. ExclusiveGesture + .exclusively(before:) — CORE:1549 / 1540

Only **one** of the two recognizes — the first one to succeed wins, the other is cancelled. Canonical: double-tap **or** single-tap (double wins if both could match).

### 11.1 Exact API (KNOWN)
```swift
@frozen public struct ExclusiveGesture<First, Second> : Gesture where First:Gesture, Second:Gesture {  // CORE:1549
  @frozen public enum Value {
    case first(First.Value)                        // first won
    case second(Second.Value)                      // first failed, second won
  }
  public var first: First
  public var second: Second
  @inlinable public init(_ first: First, _ second: Second)
}
extension Gesture {                                                                                     // CORE:1540
  @inlinable public func exclusively<Other>(before other: Other) -> ExclusiveGesture<Self, Other>
      where Other : Gesture { return ExclusiveGesture(self, other) }
}
```
**Priority:** `first` has priority. `second` is only given a chance if `first` **fails**.

### 11.2 Web mapping (DESIGNED)
```ts
type ExclValue<A,B> = {which:'first';value:A} | {which:'second';value:B};
function exclusively<A,B>(a: Recognizer<A>, b: Recognizer<B>): Recognizer<ExclValue<A,B>> {
  let decided:'first'|'second'|null=null; const out:any={};
  a.onEnded=(v)=>{ if(decided!==('second')){decided='first'; out.onEnded?.({which:'first',value:v});} };
  // if `a` fails, fall through to b:
  b.onEnded=(v)=>{ if(decided==null){decided='second'; out.onEnded?.({which:'second',value:v});} };
  return { onPointerDown:(e)=>{a.onPointerDown(e);b.onPointerDown(e);},
           onPointerMove:(e)=>{a.onPointerMove(e);b.onPointerMove(e);},
           onPointerUp:(e)=>{a.onPointerUp(e);b.onPointerUp(e);},
           onPointerCancel:(e)=>{a.onPointerCancel(e);b.onPointerCancel(e);}, ...out };
}
```
React: `TapGesture(count:2).exclusively(before: TapGesture(count:1))`. For the classic tap/double-tap, a cleaner DESIGNED implementation runs a single multi-tap recognizer with a debounce so a double-tap suppresses the queued single (browsers do this for `dblclick`).

---

## 12. View attachment: .gesture / .highPriorityGesture / .simultaneousGesture + GestureMask — CORE:18662 / 18695

How a gesture gets attached to a view, and how it interacts with the view's **subviews'** gestures.

### 12.1 Exact API (KNOWN)
```swift
extension View {                                                                              // CORE:18662
  public func gesture<T>(_ gesture: T, including mask: GestureMask = .all) -> some View where T:Gesture
  public func highPriorityGesture<T>(_ gesture: T, including mask: GestureMask = .all) -> some View where T:Gesture
  public func simultaneousGesture<T>(_ gesture: T, including mask: GestureMask = .all) -> some View where T:Gesture
  // isEnabled convenience (CORE:18668/18672/18676):
  public func gesture<T>(_ gesture: T, isEnabled: Bool) -> some View where T:Gesture   // = .gesture(g, including: isEnabled ? .all : .subviews)
  // named, iOS18+ (CORE:18683):
  public func gesture<T>(_ gesture: T, name: String, isEnabled: Bool = true) -> some View where T:Gesture
}
@frozen public struct GestureMask : OptionSet {     // CORE:18695
  public let rawValue: Swift.UInt32
  public static let none:     GestureMask           // disable all gestures (this + subviews)
  public static let gesture:  GestureMask           // only THIS gesture, subviews' gestures disabled
  public static let subviews: GestureMask           // only subviews' gestures, this one disabled
  public static let all:      GestureMask           // both (default)
}
```

### 12.2 Priority semantics (KNOWN names + INFERRED resolution)
- **`.gesture`** — normal priority. Subviews' gestures win over the parent's (the parent's gesture only fires if no child claims the touch).
- **`.highPriorityGesture`** — the parent's gesture **wins over** subviews'. (e.g. a parent double-tap that should beat a child's button tap.)
- **`.simultaneousGesture`** — runs **alongside** child gestures, neither suppresses the other.
- **`GestureMask`** decides *whose* gestures are eligible: `.gesture` = only this view's, `.subviews` = only children's, `.all` = both (default), `.none` = none. The `isEnabled:false` convenience maps to `.subviews` (i.e. disables this view's own gesture, keeps subviews').

The `.isEnabled` overload body is in the interface: `isEnabled ? .all : .subviews` (CORE:18668).

### 12.3 Web mapping (DESIGNED — pointer-capture priority)
The DOM equivalent of priority is **event ordering + `setPointerCapture` + stopPropagation**:
- **`.gesture` (normal):** attach the listener in the **bubble** phase. A child that captures the pointer (`setPointerCapture`) wins — analogous to subview priority.
- **`.highPriorityGesture`:** attach in the **capture** phase (`addEventListener(..., {capture:true})`) and call `e.stopPropagation()` once recognized → the parent claims the pointer before the child sees it.
- **`.simultaneousGesture`:** attach without stopping propagation; both parent and child recognizers receive every event (use §10's `simultaneously` merge).
- **`GestureMask`:** a recognizer-tree flag — `mask='subviews'` skips this node's recognizer but still forwards events down; `mask='gesture'` stops forwarding to children; `mask='none'` swallows; `mask='all'` (default) does both.
```ts
type GestureMask = 'none'|'gesture'|'subviews'|'all';
useGesture(ref, rec, { priority:'high'|'normal'|'simultaneous', mask:GestureMask });
// 'high' → {capture:true}+stopPropagation; 'normal' → bubble; 'simultaneous' → bubble, no stop
```
React: `<View highPriorityGesture={dragRecognizer()} />`, `<View simultaneousGesture={magnify} />`.

---

## 13. AnyGesture — CORE:9950 (type-erased gesture box)

### 13.1 Exact API (KNOWN)
```swift
@frozen public struct AnyGesture<Value> : Gesture {                        // CORE:9950
  public init<T>(_ gesture: T) where Value == T.Value, T : Gesture          // erase any concrete gesture to AnyGesture<Value>
  public typealias Body = Swift.Never
}
```
Wraps any concrete `Gesture` whose `Value` matches, hiding the concrete type (so you can store heterogeneous gestures in a variable / return different gestures from a function). No behavior change — pure type erasure.

### 13.2 Web mapping (DESIGNED)
TypeScript erasure is just `Recognizer<V>` (our interface is already the erased form). `AnyGesture` is a no-op wrapper at runtime: `const anyGesture = <V>(r: Recognizer<V>): Recognizer<V> => r;`. Useful only for typing a `Recognizer<V>` variable that may hold different concrete recognizers.

---

## 14. Hover family — onHover / onContinuousHover / hoverEffect (and HoverPhase) — SUI:6321 / 4271 / 9215

Pointer-only (no touch). `onHover` is a boolean enter/leave; `onContinuousHover` streams the cursor position; `hoverEffect` is a system visual lift used on iPadOS/visionOS pointer.

### 14.1 Exact API (KNOWN)
```swift
extension View {
  @inlinable public func onHover(perform action: @escaping (Bool) -> Void) -> some View       // SUI:6321
  // continuous — streams HoverPhase:
  @_disfavoredOverload public func onContinuousHover(coordinateSpace: CoordinateSpace = .local,
      perform action: @escaping (HoverPhase) -> Void) -> some View                            // SUI:4271
  public func onContinuousHover(coordinateSpace: some CoordinateSpaceProtocol = .local,
      perform action: @escaping (HoverPhase) -> Void) -> some View                            // SUI:4277
}
@frozen public enum HoverPhase : Equatable {                                                   // SUI:4282
  case active(CGPoint)     // hovering, with current point
  case ended               // cursor left
}
// system hover effect (iPadOS/visionOS pointer lift):
extension View {
  public func hoverEffect(_ effect: some CustomHoverEffect = .automatic, isEnabled: Bool = true) -> some View    // SUI:9215
  public func hoverEffect(_ effect: some CustomHoverEffect, in group: HoverEffectGroup?, isEnabled: Bool = true) -> some View // SUI:9224
  @_disfavoredOverload public func hoverEffect(_ effect: HoverEffect = .automatic) -> some View                  // SUI:9234
  @_disfavoredOverload public func hoverEffect(_ effect: HoverEffect = .automatic, isEnabled: Bool = true) -> some View // SUI:9241
  public func defaultHoverEffect(_ effect: HoverEffect?) -> some View                          // SUI:9243
  public func hoverEffectDisabled(_ disabled: Bool = true) -> some View                        // SUI:9245
}
public struct HoverEffect { … }   // SUI:9260 — .automatic / .highlight / .lift (INFERRED cases below)
```
`HoverEffect` cases (INFERRED, docs): **`.automatic`** (system picks), **`.highlight`** (content morphs to fill its container with a soft highlight), **`.lift`** (content lifts above the surface with a shadow + slight scale). iPadOS pointer / visionOS gaze.

### 14.2 Visual anatomy & metrics (INFERRED — HIG/RE)
- **`.lift`:** the view scales up ~**1.0→~1.05–1.08**, gains a drop shadow (`~y 4–10 px, blur 12–24 px, ~25% black`), and the pointer "sticks" to it. Spring on enter/exit (~0.3 s). visionOS adds a subtle specular highlight.
- **`.highlight`:** a translucent fill (`~system fill, ~8–12% label`) expands to the view's bounds with a small corner radius; the cursor itself disappears into the highlight.
- **`onHover` states:** `true` on enter, `false` on leave — drives custom hover styling (e.g. macOS toolbar buttons lighten on hover).

### 14.3 Web mapping
- **`onHover`** → `onPointerEnter`/`onPointerLeave` (pointer-only; ignore touch by checking `e.pointerType !== 'touch'`):
```ts
function useOnHover(ref, fn:(hovering:boolean)=>void){
  // pointerenter → fn(true); pointerleave/pointercancel → fn(false); skip pointerType==='touch'
}
```
- **`onContinuousHover`** → `onPointerMove` while inside emits `{active:{x,y}}`, `onPointerLeave` emits `{ended:true}` (HoverPhase). Coordinate space via `getBoundingClientRect` (local) or client coords (global).
- **`hoverEffect(.lift)`** (CSS):
```css
.sui-hover-lift { transition: transform .3s var(--sui-anim-smooth-css), box-shadow .3s var(--sui-anim-smooth-css);
  transform: scale(1); }
@media (hover:hover) and (pointer:fine) {
  .sui-hover-lift:hover { transform: scale(1.06); box-shadow: 0 6px 18px rgba(0,0,0,.25); }
}
.sui-hover-highlight:hover { background: var(--sui-color-quaternary-system-fill, #78788033); border-radius: 8px; } /* W1 colors.md → quaternarySystemFill */
```
React: `<View onHover={(h)=>…} hoverEffect="lift" />`. Gate with `@media (hover:hover)` so touch devices never trigger it (matches SwiftUI's pointer-only behavior).

---

## 15. Drag-and-drop: draggable / onDrag / dropDestination (+ containers, config) — SUI:23969 / 23917 / 2026

This is **data transfer** drag-and-drop (move an item between views/apps), distinct from `DragGesture` (which just tracks finger movement). Built on `Transferable` (the typed payload protocol).

### 15.1 Exact API (KNOWN)
```swift
extension View {
  // modern, Transferable-based:
  public func draggable<T>(_ payload: @autoclosure @escaping () -> T) -> some View where T : Transferable    // SUI:23969
  public func draggable<V,T>(_ payload: @autoclosure @escaping () -> T, @ViewBuilder preview: () -> V) -> some View
      where V : View, T : Transferable                                                                        // SUI:23971
  // legacy NSItemProvider-based:
  public func onDrag(_ data: @escaping () -> NSItemProvider) -> some View                                     // SUI:23917
  public func onDrag<V>(_ data: @escaping () -> NSItemProvider, @ViewBuilder preview: () -> V) -> some View where V:View // SUI:23924
  // drop targets:
  @_disfavoredOverload public func dropDestination<T>(for payloadType: T.Type = T.self,
      action: @escaping (_ items: [T], _ location: CGPoint) -> Bool,
      isTargeted: @escaping (Bool) -> Void = { _ in }) -> some View where T : Transferable                    // SUI:2026
  public func dropDestination<T>(for type: T.Type = T.self, isEnabled: Bool = true,
      action: @escaping (_ items: [T], _ session: DropSession) -> Void) -> some View where T : Transferable   // SUI:2033
  // drag previews shaping & containers (iOS18+ multi-select drag):
  public func dragPreviewsFormation(_ formation: DragDropPreviewsFormation) -> some View                      // SUI:18793
  public func draggable<ItemID>(containerItemID: ItemID, containerNamespace: Namespace.ID? = nil) -> some View
      where ItemID : Hashable, ItemID : Sendable                                                              // SUI:23933
  public func dragContainerSelection<ItemID>(_ selection: @autoclosure @escaping () -> [ItemID],
      containerNamespace: Namespace.ID? = nil) -> some View where ItemID : Hashable, ItemID : Sendable        // SUI:23939
  public func dragContainer<…>(for itemType:…, in namespace:…, _ payload:…) -> some View                      // SUI:23945-23951 (6 overloads)
  public func onDragSessionUpdated(_ onUpdate: @escaping (DragSession) -> Void) -> some View                  // SUI:23960
  public func dragConfiguration(_ configuration: DragConfiguration) -> some View                              // SUI:23962
}
```

### 15.2 Behavior (KNOWN signature semantics + INFERRED visuals)
- **`draggable(_:)`** marks a view as a drag source carrying a `Transferable` payload. A **drag preview** (a snapshot of the view, or your custom `preview:` view) lifts under the finger/cursor.
- **`dropDestination(for:action:isTargeted:)`** marks a drop zone for payload type `T`; `action` returns `Bool` (accepted?) and receives the drop **location**; `isTargeted` toggles `true` while a compatible drag hovers (drive the highlight).
- **`dragContainer` / `dragContainerSelection` / `dragPreviewsFormation`** (iOS 18) support **multi-item drag** — dragging a selection produces a stacked/fanned preview (the `DragDropPreviewsFormation`).
- Visual (INFERRED): drag preview lifts with a shadow and slight scale (~1.05), follows the pointer; drop target shows an `isTargeted` highlight (translucent accent fill / inset stroke).

### 15.3 Web mapping (DESIGNED — HTML5 DnD or Pointer-based)
Two valid web strategies; **Pointer-based** gives pixel-1:1 control of the preview (recommended), HTML5 DnD is the fallback for cross-window:
```ts
// Pointer-based draggable (full control of preview & spring):
function useDraggable<T>(ref, getPayload:()=>T, opts?:{preview?:HTMLElement}) {
  // pointerdown → create a fixed-position clone (the preview) with box-shadow + transform:scale(1.05);
  // pointermove → preview.style.transform = `translate(${x}px,${y}px) scale(1.05)`;  setPointerCapture
  // on enter a registered dropDestination whose type matches T → call its setTargeted(true)
  // pointerup over a target → target.action(payload, {x,y}); animate preview to target or back (spring)
}
function useDropDestination<T>(ref, type, action:(items:T[], loc:{x:number;y:number})=>boolean,
  isTargeted?:(b:boolean)=>void) { /* register in a global DnD registry keyed by `type` */ }
```
CSS for the lifted preview + targeted zone:
```css
.sui-drag-preview { position:fixed; pointer-events:none; transform:scale(1.05);
  box-shadow:0 8px 24px rgba(0,0,0,.3); transition:transform .25s var(--sui-anim-snappy-css); }
.sui-drop-target[data-targeted="true"] { background:var(--sui-color-tint, #007aff)22; outline:2px solid var(--sui-color-tint, #007aff); outline-offset:-2px; }
```
HTML5 fallback: `draggable={true}` + `onDragStart`(set `dataTransfer`), `onDragOver`(`preventDefault` + set targeted), `onDrop`(read payload). React: `<Draggable payload={item} preview={<Card/>} />`, `<DropZone for={Photo} onDrop={(items,loc)=>true} isTargeted={(b)=>setHi(b)} />`.

---

## 16. _ButtonGesture / _onButtonGesture — SUI:21377 / 21392 (the engine behind Button highlight)

The private gesture that powers `Button`'s press/highlight. Exposed underscore-prefixed; this is what makes a button feel pressed.

### 16.1 Exact API (KNOWN)
```swift
public struct _ButtonGesture : Gesture {                                       // SUI:21377
  @preconcurrency public var action: @MainActor () -> Void                      // fires on successful tap-up inside
  @preconcurrency public var pressingAction: (@MainActor (Bool) -> Void)?       // true on press-in, false on release/cancel
  public init(action: @escaping @MainActor () -> Void, pressing: (@MainActor (Bool) -> Void)? = nil)
  public typealias Value = Swift.Void
}
extension View {
  public func _onButtonGesture(pressing: ((Bool) -> Void)? = nil, perform action: @escaping () -> Void) -> some View  // SUI:21392
}
```

### 16.2 Behavior (KNOWN + INFERRED)
- `pressingAction(true)` the instant the finger goes down inside the view; `pressingAction(false)` on release **or** if the finger slides out beyond slop / is cancelled. `action()` fires only on a release **inside** the bounds — i.e. a tap that wasn't cancelled.
- This is exactly the "press-in highlight, release-out cancels, release-in commits" UIButton behavior. Used to drive the standard button pressed appearance (opacity ~0.7 / scale on press for some styles). The slop/cancel uses the same ~10 pt tolerance.

### 16.3 Web mapping (DESIGNED)
```ts
function buttonGestureRecognizer(action:()=>void, pressing?:(b:boolean)=>void, slop=10): Recognizer<void> {
  let inside=false, start={x:0,y:0};
  return {
    onPointerDown(e){ (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      start={x:e.clientX,y:e.clientY}; inside=true; pressing?.(true); },
    onPointerMove(e){ const el=e.currentTarget as HTMLElement; const r=el.getBoundingClientRect();
      const within = e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
      if (within!==inside){ inside=within; pressing?.(within); } },     // press highlight follows in/out
    onPointerUp(){ pressing?.(false); if (inside) action(); },
    onPointerCancel(){ inside=false; pressing?.(false); }
  };
}
```
This is the recognizer the C-? Button component should consume. CSS press feedback (e.g. `.borderedProminent`): `:active { filter: brightness(0.92); }` or driven by `pressing` → `data-pressed` attribute with the W1 button opacity. React: internal to `<Button>`; exposed as `<View onButtonGesture={{pressing, action}} />` for parity.

---

## 17. Keyboard / move / pencil input modifiers — SUI:18950 / 12818 / 13320

These are "gesture-adjacent" input modifiers in the cluster: physical-key, arrow-key navigation, and Apple Pencil events.

### 17.1 onKeyPress — SUI:18950 (KNOWN)
```swift
extension View {
  public func onKeyPress(_ key: KeyEquivalent, action: @escaping () -> KeyPress.Result) -> some View         // SUI:18950
  public func onKeyPress(_ key: KeyEquivalent, phases: KeyPress.Phases, action: @escaping (KeyPress) -> KeyPress.Result) -> some View  // SUI:18952
  public func onKeyPress(keys: Set<KeyEquivalent>, phases: KeyPress.Phases = [.down, .repeat], action: …) -> some View  // SUI:18954
  public func onKeyPress(characters: CharacterSet, phases: KeyPress.Phases = [.down, .repeat], action: …) -> some View  // SUI:18956
  public func onKeyPress(phases: KeyPress.Phases = [.down, .repeat], action: …) -> some View                  // SUI:18958 (any key)
}
public struct KeyPress : Sendable {                                         // SUI:18963
  public let phase: KeyPress.Phases; public let key: KeyEquivalent
  public let characters: Swift.String; public let modifiers: EventModifiers
}
public struct KeyPress.Phases : OptionSet { static let down, `repeat`, up, all }    // SUI:18972
public enum KeyPress.Result { case handled; case ignored }                          // SUI:18992 (return .handled to stop propagation)
```
**Default `phases` = `[.down, .repeat]`** (KNOWN). Return `.handled` to consume (stops bubbling), `.ignored` to let it propagate.

Web mapping (DESIGNED): `onKeyDown`/`onKeyUp` on a focusable element (`tabIndex=0`). `phase` → `keydown` (down) / `keydown` with `e.repeat===true` (repeat) / `keyup` (up). `.handled` → `e.preventDefault(); e.stopPropagation()`. `modifiers` → `e.metaKey/ctrlKey/altKey/shiftKey`. React: `<View onKeyPress={(k)=> k.key==='return' ? 'handled':'ignored'} phases={['down','repeat']} />`.

### 17.2 onMoveCommand — SUI:12818 (KNOWN, macOS/tvOS arrow-key focus nav)
```swift
extension View { public func onMoveCommand(perform action: ((MoveCommandDirection) -> Void)?) -> some View }   // SUI:12818
public enum MoveCommandDirection { case up; case down; case left; case right }                                 // SUI:12799
```
Fires on arrow keys / remote swipes for directional focus moves. Web: `onKeyDown` mapping `ArrowUp/Down/Left/Right` → the four directions. React: `<View onMoveCommand={(dir)=>…} />`.

### 17.3 onPencilDoubleTap / onPencilSqueeze — SUI:13320 / 13341 (KNOWN, Apple Pencil)
```swift
extension View {
  public func onPencilDoubleTap(perform action: @escaping (PencilDoubleTapGestureValue) -> Void) -> some View  // SUI:13320
  public func onPencilSqueeze(perform action: @escaping (PencilSqueezeGesturePhase) -> Void) -> some View       // SUI:13341
}
public struct PencilDoubleTapGestureValue : Hashable { public let hoverPose: PencilHoverPose? }                // SUI:13326
public struct PencilSqueezeGestureValue : Hashable { public let hoverPose: PencilHoverPose? }                  // SUI:13359
@frozen public enum PencilSqueezeGesturePhase : Equatable {                                                    // SUI:13347
  case active(PencilSqueezeGestureValue); case ended(PencilSqueezeGestureValue); case failed }
```
Apple-Pencil-only hardware events (no pointer/touch equivalent). **Web: not replicable** — no browser API exposes Pencil double-tap/squeeze. Tabulate as NO-OP stubs (`onPencilDoubleTap`/`onPencilSqueeze` accept handlers but never fire on web); document as platform-gap.

### 17.4 handGestureShortcut — SUI:419 (visionOS pinch shortcut)
```swift
extension View { public func handGestureShortcut(_ shortcut: HandGestureShortcut, isEnabled: Bool = true) -> some View }  // SUI:419
public struct HandGestureShortcut : Sendable, Equatable { public static let primaryAction: HandGestureShortcut }         // SUI:424
```
visionOS: lets a hand pinch trigger a control's primary action. **Web: not replicable** (no hand-tracking). Stub.

### 17.5 defersSystemGestures — SUI:18294 (KNOWN)
```swift
extension View { public func defersSystemGestures(on edges: Edge.Set) -> some View }    // SUI:18294
```
Delays system edge gestures (e.g. swipe-up home indicator, control-center pull) on the given screen edges so your app's edge gesture gets first crack. Web analogue (DESIGNED): set `touch-action`/`overscroll-behavior: none` and capture pointers near the named edges to suppress browser edge-swipe/overscroll. Partial parity only.

### 17.6 _ModifiersGesture — SUI:17381 (KNOWN, internal)
```swift
public struct _ModifiersGesture<Content> : Gesture where Content : Gesture { typealias Value = Content.Value }   // SUI:17381 (macOS-only)
```
Internal wrapper that gates a gesture on keyboard **modifier keys** being held (macOS). `Value = Content.Value` (pass-through). Web (DESIGNED): wrap a recognizer and only forward events when `e.getModifierState('Shift'|'Alt'|…)` matches. Not a public API; replicate only if the modifier-gated gesture pattern is needed.

---

## 18. Long-tail — tabulated (platform-specific, internal plumbing, or non-replicable on web)

Every remaining work-list type, with line cite, one-line purpose, and web equivalent. None are silently dropped; these are either internal graph plumbing (no observable behavior), platform-exclusive hardware (visionOS/macOS-window/Pencil — no browser API), or thin deprecated aliases already covered above.

| Type | Module:line | Purpose | Web equivalent |
|---|---|---|---|
| `MagnificationGesture` | SUI:9773 | **Deprecated** predecessor of MagnifyGesture; `Value = CGFloat` (bare scale). | Covered §5; alias `magnifyRecognizer`, emit bare `magnification`. |
| `RotationGesture` | SUI:5154 | **Deprecated** predecessor of RotateGesture; `Value = Angle` (bare). | Covered §6; alias `rotateRecognizer`, emit bare `rotation`. |
| `WindowDragGesture` | SUI:22956 | macOS-only: drag to move the **window** (has a real `body`, not a leaf). `Value` is empty. | No web window to move; for an in-page draggable window/panel, reuse `dragRecognizer` to set the panel's CSS `left/top`. |
| `SpatialEventGesture` | SUI:23697 | visionOS multi-touch **spatial event collection** (`Value = SpatialEventCollection`); `init(coordinateSpace:)`. | No browser spatial-event API; partial parity = multi-pointer set (Pointer Events `pointerId` map). Stub on non-XR. |
| `AccessibilityZoomGestureAction` | SUI:23157 | Payload for an accessibility "zoom" action; `direction: .zoomIn/.zoomOut`, `location`, `point`. | Map to a custom `onAccessibilityZoom` handler wired to keyboard `+`/`-` or AT events; not a pointer gesture. |
| `PencilDoubleTapGestureValue` | SUI:13326 | Value for `onPencilDoubleTap` (`hoverPose`). | Pencil-only; no web API. Stub (§17.3). |
| `PencilSqueezeGestureValue` | SUI:13359 | Value for `onPencilSqueeze` (`hoverPose`). | Pencil-only; no web API. Stub (§17.3). |
| `PencilSqueezeGesturePhase` | SUI:13347 | `.active/.ended/.failed` phase enum for squeeze. | Stub. |
| `HandGestureShortcut` | SUI:424 | visionOS pinch→primaryAction shortcut token. | No hand-tracking on web. Stub (§17.4). |
| `_GestureInputs` | CORE:13756 | Opaque graph-input plumbing for `_makeGesture`. | Internal — our `Recognizer` interface replaces it; no port. |
| `_GestureOutputs` | CORE:13766 | Opaque graph-output plumbing. | Internal — replaced by recognizer sinks; no port. |
| `_MapGesture` | CORE:9937 | Wrapper produced by `.map`. | Covered §8.3 (`mapGesture`). |
| `_ChangedGesture` | CORE:5741 | Wrapper produced by `.onChanged` (needs `Value:Equatable`). | Covered §8.3 (`onChanged`). |
| `_EndedGesture` | CORE:5726 | Wrapper produced by `.onEnded`. | Covered §8.3 (`onEnded`). |
| `_ModifiersGesture` | SUI:17381 | macOS modifier-key-gated gesture wrapper. | Covered §17.6. |
| `NSGestureRecognizerRepresentable` | SUI:20808 | Protocol to bridge an AppKit `NSGestureRecognizer` into SwiftUI (macOS). | No AppKit on web; bridge = write a native `Recognizer`. No port. |
| `NSGestureRecognizerRepresentableContext` | SUI:20840 | Context struct for the above (coordinator/environment). | No port. |
| `NSGestureRecognizerRepresentableCoordinateSpaceConverter` | SUI:20852 | Converts points between coordinate spaces for the AppKit bridge. | Replaced by our `getBoundingClientRect` local/global math. |
| `UIGestureRecognizerRepresentable` | SUI:21407 | Protocol to bridge a UIKit `UIGestureRecognizer` into SwiftUI (iOS). | No UIKit on web; bridge = native `Recognizer`. No port. |
| `UIGestureRecognizerRepresentableContext` | SUI:21414 | Context struct for the UIKit bridge. | No port. |
| `UIGestureRecognizerRepresentableCoordinateSpaceConverter` | SUI:21424 | Coordinate conversion for the UIKit bridge. | Replaced by rect math. |
| `_ScrollViewGestureProvider` | SUI:11284 | Internal protocol letting a ScrollView publish its pan gesture for coordination. | Internal; web ScrollView uses native scroll + `touch-action`. No port. |
| `listRowHoverEffect(_:)` | SUI:2321 | Per-list-row hover effect override (`HoverEffect?`). | `tr:hover`/`li:hover` style on the row (§14 CSS). |
| `listRowHoverEffectDisabled(_:)` | SUI:2323 | Disable list-row hover effect. | Remove the `:hover` rule on that row. |
| `defaultHoverEffect(_:)` | SUI:9243 | Set the default hover effect for descendants. | CSS custom prop cascaded to children. |
| `hoverEffectDisabled(_:)` | SUI:9245 | Turn off hover effect for a subtree. | Drop `:hover` rules / set `pointer-events`/class off. |
| `hoverEffectGroup(...)` | SUI:20455-20503 | Coordinate a hover effect across a **group** of views (lift the whole group together). | A shared `:hover` parent selector or a JS group-hover controller toggling a class on all members. |
| `dragPreviewsFormation(_:)` | SUI:18793 | Shape multi-item drag preview stack (`DragDropPreviewsFormation`). | CSS-stacked preview clones with small offset/rotation (§15.3 preview). |
| `dragContainer(...)` | SUI:23945-23951 | iOS18 multi-select drag source over a collection. | DnD registry tracking a selection set (§15.3). |
| `dragContainerSelection(_:)` | SUI:23939 | Declare the selected item IDs for a drag container. | The selection set passed to the registry. |
| `dragConfiguration(_:)` | SUI:23962 | Configure a drag session (allowed ops, etc.). | DnD options object (`effectAllowed`). |
| `onDragSessionUpdated(_:)` | SUI:23960 | Observe drag-session progress (`DragSession`). | `pointermove` during an active drag → session callback. |
| `onLongTouchGesture(...)` | SUI:8851 | iOS table long-touch variant of long-press. | Covered §4 (`longPressRecognizer`, alias `onTouchingChanged`→`pressing`). |
| `chartGesture(_:)` | Charts:2870 | Attach a gesture to a Swift Chart, handing the closure a `ChartProxy` (so the gesture can map points↔data). `func chartGesture(_ gesture: @escaping (ChartProxy) -> some Gesture) -> some View`. | Reuse any §1–11 recognizer; pass a `chartProxy`-like object that exposes `value(atX:)`/`position(forX:)` so handlers convert pixel↔domain. Belongs to the Charts cluster; recognizer engine is this cluster's. |
| `presentationDragIndicator(_:)` | SUI:21222 | **Not a gesture** — shows/hides the sheet "grabber" pill (`Visibility`). The drag itself is the sheet's built-in pan. | Render a `<div class="sui-sheet-grabber">` (36×5 px capsule, `quaternaryLabel`); the sheet's own drag uses `dragRecognizer`. Out-of-cluster (presentation/sheets). |
| `dialogSuppressionToggle(...)` | SUI:7141 | **Not a gesture** — the "Do not ask again" checkbox in a confirmation dialog (`isSuppressed: Binding<Bool>`). | A checkbox bound to state inside the dialog. Out-of-cluster (dialogs). Listed so it is not silently dropped. |
| `defaultAppStorage(_:)` | SUI:7475 | **Not a gesture** — sets the default `UserDefaults` store for `@AppStorage` in a subtree. | `localStorage` namespace/provider for the storage hook. Out-of-cluster (persistence). Listed so it is not silently dropped. |

### Not in this cluster (cross-references)
- The W1 spring tokens (`.smooth`/`.snappy`/`.bouncy`, `--sui-anim-*-css`) used for gesture-end snap-back and hover transitions live in `swiftui/tokens/animation.md`.
- `metric.tapTarget` (44 pt) and pointer-class 28 pt live in `swiftui/tokens/spacing.md`.
- Color fills for drop-target / hover-highlight (`quaternarySystemFill`, `tint`) live in `swiftui/tokens/colors.md`.

---

## 19. Coverage summary

**Deep-covered (full HTML+CSS+prop-API mapping):** Gesture protocol + recognizer core (§0), TapGesture (§1), SpatialTapGesture (§2), DragGesture + Value (§3), LongPressGesture (§4), MagnifyGesture/MagnificationGesture (§5), RotateGesture/RotationGesture (§6), GestureState + .updating + GestureStateGesture (§7), .onChanged/.onEnded/.map + _ChangedGesture/_EndedGesture/_MapGesture (§8), SequenceGesture + .sequenced (§9), SimultaneousGesture + .simultaneously (§10), ExclusiveGesture + .exclusively (§11), .gesture/.highPriorityGesture/.simultaneousGesture + GestureMask (§12), AnyGesture (§13), onHover/onContinuousHover/hoverEffect + HoverPhase/HoverEffect (§14), draggable/onDrag/dropDestination + containers/config (§15), _ButtonGesture/_onButtonGesture (§16), onKeyPress/onMoveCommand/onPencil*/handGestureShortcut/defersSystemGestures/_ModifiersGesture (§17).

**Tabulated (long tail, §18):** MagnificationGesture·RotationGesture (deprecated aliases), WindowDragGesture, SpatialEventGesture, AccessibilityZoomGestureAction, PencilDoubleTapGestureValue, PencilSqueezeGestureValue, PencilSqueezeGesturePhase, HandGestureShortcut, _GestureInputs, _GestureOutputs, NSGestureRecognizerRepresentable(+Context+Converter), UIGestureRecognizerRepresentable(+Context+Converter), _ScrollViewGestureProvider, listRowHoverEffect(+Disabled), defaultHoverEffect, hoverEffectDisabled, hoverEffectGroup, dragPreviewsFormation, dragContainer(+Selection), dragConfiguration, onDragSessionUpdated, onLongTouchGesture.

**Recognition constants the web hook MUST hit exactly (KNOWN from interface):** DragGesture `minimumDistance = 10`, velocity factor `×4` (`velocity = 4·(predictedEnd − location)`); LongPressGesture `minimumDuration = 0.5`, `maximumDistance = 10`; MagnifyGesture `minimumScaleDelta = 0.01`; RotateGesture `minimumAngleDelta = 1°`; TapGesture/SpatialTapGesture `count = 1` default; GestureMask default `.all`; coordinateSpace default `.local`; KeyPress.Phases default `[.down, .repeat]`.
