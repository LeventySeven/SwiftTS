# SwiftUI Cluster C11 — Animation & Transitions (RE → Web Replication Spec)

**Goal:** pixel/motion-1:1 web replica of SwiftUI's animation + transition system as a TS/React (Next.js) UI kit. This file is the SPEC the implementation agent uses to write the actual `useAnimation` hook, the `<Transition>` wrappers, and the CSS easing tables. Every signature below is quoted verbatim with a `file:line` cite from the macOS 26 SDK swiftinterface; the spring math is **inlined** (`@_alwaysEmitIntoClient`) so it is KNOWN, not guessed.

**Source labels:** `KNOWN` = verbatim from swiftinterface body / baked dylib constant · `INFERRED` = Apple docs / WWDC / reputable RE (opaque `@_opaqueReturnTypeOf` bodies) · `DESIGNED` = my CSS/JS engineering to reproduce runtime behavior on the web.

**Paths (Tier-1A):**
- `SC` = `SwiftUICore.framework/.../arm64e-apple-macos.swiftinterface`
- `SUI` = `SwiftUI.framework/.../arm64e-apple-macos.swiftinterface`

**Companion token file (already authoritative — READ IT):** `swiftui/tokens/animation.md`. It bakes the spring ODE, the three conversion functions, every preset's `k`/`c`/`ζ`, and the `linear()` easing tables. This teardown cites those tables by name (`anim.smooth.css`, etc.) rather than re-deriving them. Where this file and the token file overlap, the token file's `linear()` numbers are the canonical web output.

**Target baseline:** canonical iOS 17 / macOS 14 ("the SwiftUI look"). iOS 26 "Liquid Glass" symbols (`GlassEffectTransition`, double `@_originallyDefinedIn(... iOS 26.0)` tags) are labeled, never substituted.

**Coverage map:**
- **Deep-covered (full HTML+CSS+prop-API):** `withAnimation`, `.animation(_:value:)` / `.animation(_:)`, `Transaction` + `withTransaction` + `.transaction`, `Animation` (all presets: spring/interactiveSpring/interpolatingSpring/smooth/snappy/bouncy/easeInOut/easeIn/easeOut/linear/timingCurve + `.delay`/`.speed`/`.repeatCount`/`.repeatForever`), `Spring`, `AnyTransition` + `.transition`, all transition presets (opacity/slide/scale/move/offset/push/blurReplace/identity/asymmetric/combined), `contentTransition` (numericText/interpolate/opacity), `matchedGeometryEffect` + `matchedTransitionSource`, `PhaseAnimator`, `KeyframeAnimator` + all 4 keyframe types, `TransitionPhase`.
- **Tabulated (signature + purpose + web-equivalent, no full recipe):** the `Transition`/`Keyframes`/`CustomAnimation`/`AnimationStateKey`/`KeyframeTrackContent` protocols, the internal `_*` plumbing structs (`_AnimationModifier`, `_AnimationView`, `_ResolvedKeyframes`, `_Transition_ContentTransition`, `_NavigationTransition*`, etc.), `AnimationContext`/`AnimationState`/`AnimationCompletionCriteria`, `navigationTransition` (+ Automatic/Zoom), `scrollTransition` + `ScrollTransitionConfiguration`/`Phase`, `onScrollPhaseChange`, `springLoadingBehavior`, `glassEffectTransition` + `GlassEffectTransition`, `AnimationTimelineSchedule`, `SymbolEffectTransition`, `KeyframeTimeline`/`KeyframeTrack`.

---

# 1. The driving mechanism — how state changes become animations

In SwiftUI, components don't carry an animation. **State changes** carry an animation. There are three ways to attach one; all three resolve to a single internal concept: a **Transaction** (a property bag, default-keyed on `.animation`) that rides along with the dependency-graph invalidation that a state mutation triggers. Understanding this is the whole architecture: an animation is "the `Animation` value present in the current `Transaction` when a value the view depends on changes."

## 1.1 `withAnimation(_:_:)` — KNOWN

```swift
// SC:17281
public func withAnimation<Result>(_ animation: SwiftUICore.Animation? = .default,
    _ body: () throws -> Result) rethrows -> Result
// SC:10132  — completion-handler form
public func withAnimation<Result>(_ animation: SwiftUICore.Animation? = .default,
    completionCriteria: SwiftUICore.AnimationCompletionCriteria = .logicallyComplete,
    _ body: () throws -> Result, completion: @escaping () -> Swift.Void) rethrows -> Result
```

- **Semantics (KNOWN/INFERRED):** sets `Transaction.animation = animation` for the duration of `body()`. Any `@State`/`@Binding` mutated inside `body` propagates that transaction; every view that re-renders because of that mutation animates the diff of its animatable values with `animation`. Passing `nil` explicitly **disables** animation for those mutations (escape hatch).
- **Default arg `.default`** — the single most important behavioral fact: on iOS 17+/macOS 14+ `.default` IS a spring (`smooth`, ζ=1). See §3.1.
- `completionCriteria`: `.logicallyComplete` (fires when the animation is "logically" done — for a spring, when it crosses the target, *before* settling ripples finish) vs `.removed` (fires when the animation is fully removed from the render tree). KNOWN from `AnimationCompletionCriteria` (SC:10146): `static let logicallyComplete`, `static let removed`.

**Web replication (`useAnimation` hook + `withAnimation`):** there is no global transaction in React, so we make it explicit. The pattern is: a context-provided "animation register" that the next state flush reads.

```tsx
// DESIGNED — withAnimation as a React primitive
import { AnimationToken, resolveAnim } from "./anim";

// A module-level "current transaction" mirroring SwiftUI's thread-local transaction.
let CURRENT_TXN: { animation: AnimationToken | null } | null = null;

export function withAnimation<T>(animation: AnimationToken | null = "default", body: () => T): T {
  const prev = CURRENT_TXN;
  CURRENT_TXN = { animation };
  try {
    return body();          // setState calls inside read CURRENT_TXN synchronously
  } finally {
    // restore AFTER React has captured the flag in the same synchronous tick
    queueMicrotask(() => { CURRENT_TXN = prev; });
  }
}

export function currentTxnAnimation(): AnimationToken | null {
  return CURRENT_TXN ? CURRENT_TXN.animation : null;
}
```

Because React batches `setState`, the animatable hook (`useAnimatable`, §3.6) reads `currentTxnAnimation()` at the moment its value changes and stamps that token onto the CSS transition it emits. The `completion` callback maps to a `transitionend`/`animationend` listener (`.logicallyComplete` ≈ fire at `duration` for curves, at first target-crossing for springs; `.removed` ≈ fire at `settlingDuration`).

## 1.2 `.animation(_:value:)` and `.animation(_:)` — KNOWN

```swift
// SC:13217  — the modern, value-scoped form (preferred)
@inlinable nonisolated public func animation<V>(_ animation: SwiftUICore.Animation?, value: V)
    -> some SwiftUICore.View where V : Swift.Equatable
// SC:13229  — implicit form (animates ALL animatable changes under this view)
@inlinable nonisolated public func animation(_ animation: SwiftUICore.Animation?) -> some SwiftUICore.View
// SC:17395  — @_disfavoredOverload duplicate of the implicit form
// SC:17431  — scoped form: .animation(_, body:) applies the animation only to the
//             modifiers built inside `body`, leaving siblings unaffected
nonisolated public func animation<V>(_ animation: SwiftUICore.Animation?,
    @ViewBuilder body: (PlaceholderContentView<Self>) -> V) -> some View where V : View
```

- `.animation(anim, value: x)` is the **declarative** equivalent of wrapping every mutation of `x` in `withAnimation(anim)`: whenever `x` changes (by `Equatable`), the subtree animates with `anim`. This is the form to replicate for component-internal motion (e.g. a Toggle animating its knob when `isOn` flips).
- The bare `.animation(anim)` (no `value:`) is **deprecated since iOS 15** (it over-animates: any inherited change animates). It still exists in the interface (SC:13229) for source-compat. Replicate the `value:` form as the primary API.

**Web replication:** a `useAnimatedValue` hook keyed on a dependency.

```tsx
// DESIGNED — .animation(_, value:) → animate a style prop whenever `value` changes
function useAnimatedStyle<T>(value: T, animation: AnimationToken, mapToStyle: (v: T) => React.CSSProperties) {
  // emit the target style + the transition derived from `animation`
  const css = resolveAnim(animation);          // {duration, easing, kind} — see §3
  return {
    ...mapToStyle(value),
    transition: css.kind === "spring"
      ? `all ${css.settling}s ${css.linear}`   // springs → settling time + linear()
      : `all ${css.duration}s ${css.bezier}`,  // curves → 0.35s + cubic-bezier()
  };
}
// React diffs `value`; when it changes, the new style + the SAME transition fires.
```

## 1.3 `Transaction` + `withTransaction` + `.transaction` — KNOWN

```swift
// SC:5978
@frozen public struct Transaction {
  @inlinable public init()                                    // empty bag
  public subscript<K>(key: K.Type) -> K.Value where K : TransactionKey { get set }   // SC:5989
}
// SC:6006
public func withTransaction<Result>(_ transaction: Transaction, _ body: () throws -> Result) rethrows -> Result
// SC:6008  — keypath sugar (inlined): build a 1-key transaction
@_alwaysEmitIntoClient public func withTransaction<R, V>(_ keyPath: WritableKeyPath<Transaction, V>,
    _ value: V, _ body: () throws -> R) rethrows -> R {
    var transaction = Transaction()
    transaction[keyPath: keyPath] = value
    // … withTransaction(transaction, body)
}
// view modifiers — SC:17381
@inlinable nonisolated public func transaction(_ transform: @escaping (inout Transaction) -> Void) -> some View
// SC:17386 — value-scoped transaction (the modern form)
@_alwaysEmitIntoClient nonisolated public func transaction(value: some Equatable,
    _ transform: @escaping (inout Transaction) -> Void) -> some View
```

- `Transaction` is the property bag; `.animation` is one well-known key on it (accessed via `transaction.animation`). `withAnimation(a){…}` is literally `withTransaction(\.animation, a){…}`.
- `.transaction { $0.animation = .none }` is the canonical way to **strip** animation from a subtree even though an ancestor set one, or to override it (`$0.animation = .linear`). Also `$0.disablesAnimations = true`.

**Web replication:** `Transaction` = the `{ animation, disablesAnimations }` object carried by `CURRENT_TXN`. `.transaction(transform)` = a context provider that runs `transform` on the inherited transaction and re-provides it to children:

```tsx
// DESIGNED
const TxnContext = React.createContext<Txn>({ animation: "default", disablesAnimations: false });
function Transaction({ transform, children }: { transform: (t: Txn) => Txn; children: React.ReactNode }) {
  const inherited = React.useContext(TxnContext);
  const next = React.useMemo(() => transform({ ...inherited }), [inherited, transform]);
  return <TxnContext.Provider value={next}>{children}</TxnContext.Provider>;
}
// useAnimatedStyle reads useContext(TxnContext).animation if no explicit token given.
```

---

# 2. `Spring` — the physics engine behind every spring preset

```swift
// SC:3096
public struct Spring : Swift.Hashable, Swift.Sendable { … }
// SC:3105 — duration/bounce constructor (the perceptual one)
extension Spring {
  public init(duration: TimeInterval = 0.5, bounce: Double = 0.0)
  public var duration: TimeInterval { get }
  public var bounce: Double { get }
}
// SC:3127 — response/dampingRatio constructor (the "classic" UIKit-style one)
extension Spring {
  public init(response: Double, dampingRatio: Double)
  public var response: Double { get }; public var dampingRatio: Double { get }
}
// SC:3145 — raw physics constructor
extension Spring {
  public init(mass: Double = 1.0, stiffness: Double, damping: Double, allowOverDamping: Bool = false)
  public var mass: Double { get }; public var stiffness: Double { get }; public var damping: Double { get }
}
// SC:3170 — solve-for-stiffness-from-settling constructor
extension Spring {
  public init(settlingDuration: TimeInterval, dampingRatio: Double, epsilon: Double = 0.001)
}
// SC:3178 — the sampling API: this is the per-frame solver we port to JS
extension Spring {
  public var settlingDuration: TimeInterval { get }
  public func value<V>(target: V, initialVelocity: V = .zero, time: TimeInterval) -> V where V : VectorArithmetic
  public func velocity<V>(target: V, initialVelocity: V = .zero, time: TimeInterval) -> V where V : VectorArithmetic
  public func update<V>(value: inout V, velocity: inout V, target: V, deltaTime: TimeInterval)   // semi-implicit Euler step
  public func force<V>(target: V, position: V, velocity: V) -> V where V : VectorArithmetic
}
// SC:3188 — Spring presets (mirror the Animation presets)
extension Spring {
  static var smooth / func smooth(duration = 0.5, extraBounce = 0.0) = Spring(duration:, bounce: extraBounce)        // bounce 0
  static var snappy / func snappy(duration = 0.5, extraBounce = 0.0) = Spring(duration:, bounce: 0.15 + extraBounce)  // bounce 0.15
  static var bouncy / func bouncy(duration = 0.5, extraBounce = 0.0) = Spring(duration:, bounce: 0.3 + extraBounce)   // bounce 0.30
}
```

**The exact spring ODE (KNOWN — inlined in `animation.md` §0, lines SC:13055–13083).** `mass = 1` for the duration/bounce path. Repeated here as the engine spec:

```
springStiffness(response)        = (2π / response)²                      // k
springDampingFraction(bounce)    = 1 − bounce            (bounce ∈ [0,1]) // ζ
springDamping(fraction, k)       = 2·√k · fraction                       // c
ODE:  ẍ + c·ẋ + k·x = k        (unit step from 0 → 1, mass 1)
```

`Spring(duration:bounce:)` ⇒ `response = duration`, `ζ = 1 − bounce`, `k = (2π/duration)²`, `c = (4π/duration)·(1−bounce)`.

**Web replication — the JS spring solver (this is THE core utility; everything else calls it):**

```ts
// DESIGNED — port of Spring.value/update via semi-implicit Euler (matches SwiftUI's Spring.update)
export interface SpringParams { mass: number; stiffness: number; damping: number; }

export function springFromDurationBounce(duration = 0.5, bounce = 0): SpringParams {
  const k = Math.pow((2 * Math.PI) / duration, 2);     // (2π/dur)²
  const zeta = 1 - bounce;                              // damping fraction
  const c = 2 * Math.sqrt(k) * zeta;                   // 2√k·ζ
  return { mass: 1, stiffness: k, damping: c };
}
export function springFromResponseDamping(response: number, dampingFraction: number): SpringParams {
  const k = Math.pow((2 * Math.PI) / response, 2);
  return { mass: 1, stiffness: k, damping: 2 * Math.sqrt(k) * dampingFraction };
}

// settling time: when |x−1| AND |v| stay < epsilon. Closed form for under/critically damped.
export function settlingDuration({ mass, stiffness, damping }: SpringParams, epsilon = 0.001): number {
  const wn = Math.sqrt(stiffness / mass);              // natural freq
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta >= 1) return -Math.log(epsilon) / (wn * (zeta - Math.sqrt(Math.max(zeta*zeta-1,0)) || 1)) || 4 / (zeta*wn);
  return -Math.log(epsilon) / (zeta * wn);             // envelope decays as e^(−ζ·wn·t)
}

// Generate a CSS linear() timing function by sampling the unit-step response.
export function springToLinear(p: SpringParams, settling: number, samples = 24): string {
  const dt = 1 / 240; // integrate fine
  let x = 0, v = 0;   // position, velocity ; target = 1
  const pts: string[] = ["0"];
  const sampleTimes = Array.from({ length: samples - 1 }, (_, i) => ((i + 1) / (samples - 1)) * settling);
  let si = 0;
  for (let t = 0; t <= settling + dt; t += dt) {
    // semi-implicit Euler — SwiftUI's Spring.update(value:velocity:target:deltaTime:)
    const a = (p.stiffness * (1 - x) - p.damping * v) / p.mass;
    v += a * dt; x += v * dt;
    while (si < sampleTimes.length && t >= sampleTimes[si]) {
      const pct = ((sampleTimes[si] / settling) * 100).toFixed(1);
      pts.push(si === sampleTimes.length - 1 ? "1" : `${x.toFixed(4)} ${pct}%`);
      si++;
    }
  }
  return `linear(${pts.join(", ")})`;
}
```

The token file `animation.md` already gives the **precomputed `linear()` strings** for smooth/snappy/bouncy/spring/interactiveSpring (use those verbatim — they were integrated at higher precision). Use `springToLinear` only for arbitrary `Spring(duration:bounce:)` values the user constructs at runtime.

---

# 3. `Animation` — the value, the presets, the modifiers

```swift
// SC:19088
@frozen public struct Animation : Swift.Equatable, Swift.Sendable {
  public init<A>(_ base: A) where A : CustomAnimation          // wrap a custom timing curve
}
```

`Animation` is an opaque wrapper around a timing function (curve OR spring OR custom). It conforms to `Equatable`/`Hashable`/`CustomStringConvertible`. Below: every static factory + chainable modifier, grouped.

## 3.1 `.default` — KNOWN value, INFERRED behavior

```swift
// SC:1399
extension Animation { public static let `default`: Animation }   // opaque dylib literal
```
- **iOS 17+/macOS 14+: `.default` is a spring** equal to `.smooth` = `spring(duration: 0.5, bounce: 0)`, ζ=1. (INFERRED — Apple docs/WWDC23.) Pre-iOS17 it was `easeInOut(duration: 0.35)`.
- **Web:** `anim.default.css = anim.smooth.css` (duration 0.735 s, smooth `linear()` table). Build flag `legacyDefault` → `easeInOut 0.35s` for "iOS 16 compat".

## 3.2 Spring family — KNOWN verbatim (SC:13090 block, fully inlined)

```swift
extension Animation {
  // SC:13091 — duration/bounce form (inlined → spring(response:dampingFraction:))
  @_alwaysEmitIntoClient static func spring(duration: TimeInterval = 0.5, bounce: Double = 0.0,
      blendDuration: Double = 0) -> Animation {
      spring(response: duration, dampingFraction: springDampingFraction(bounce: bounce), blendDuration: blendDuration)
  }
  // SC:13097 — the canonical response/dampingFraction form  ← .spring() default
  @_disfavoredOverload static func spring(response: Double = 0.5, dampingFraction: Double = 0.825,
      blendDuration: TimeInterval = 0) -> Animation
  @_alwaysEmitIntoClient static var spring: Animation { spring() }          // SC:13098
  // SC:13101 — interactiveSpring (fast, gesture-tracking)
  @_disfavoredOverload static func interactiveSpring(response: Double = 0.15, dampingFraction: Double = 0.86,
      blendDuration: TimeInterval = 0.25) -> Animation
  // SC:13105 — interactiveSpring duration form (inlined → bounce 0.15 + extraBounce)
  @_alwaysEmitIntoClient static func interactiveSpring(duration: TimeInterval = 0.15, extraBounce: Double = 0.0,
      blendDuration: TimeInterval = 0.25) -> Animation { spring(duration: duration, bounce: 0.15 + extraBounce, blendDuration: blendDuration) }
  // SC:13110/13117/13124 — smooth/snappy/bouncy (inlined → spring(duration:bounce:))
  @_alwaysEmitIntoClient static func smooth(duration = 0.5, extraBounce = 0.0) = spring(duration:, bounce: extraBounce)        // bounce 0
  @_alwaysEmitIntoClient static func snappy(duration = 0.5, extraBounce = 0.0) = spring(duration:, bounce: 0.15 + extraBounce) // bounce 0.15
  @_alwaysEmitIntoClient static func bouncy(duration = 0.5, extraBounce = 0.0) = spring(duration:, bounce: 0.3 + extraBounce)  // bounce 0.30
}
// SC:3212 — Spring-value forms
extension Animation {
  static func spring(_ spring: Spring, blendDuration: TimeInterval = 0.0) -> Animation
  static func interpolatingSpring(_ spring: Spring, initialVelocity: Double = 0.0) -> Animation
}
// SC:10809 (animation.md §4b) — interpolatingSpring physics forms (velocity-preserving / additive)
//   interpolatingSpring(mass: 1.0, stiffness:, damping:, initialVelocity: 0.0)
//   interpolatingSpring(duration: 0.5, bounce: 0.0, initialVelocity: 0.0)
```

**Derived constants + `linear()` (KNOWN-by-formula; full tables in `animation.md` §1/§4):**

| token | params (KNOWN) | k | c | ζ | settling T | CSS output |
|---|---|---|---|---|---|---|
| `.smooth`/`.default` | dur 0.5, bounce 0 | 157.914 | 25.133 | 1.000 | 0.735 s | `var(--sui-anim-smooth-css)` |
| `.snappy` | dur 0.5, bounce 0.15 | 157.914 | 21.363 | 0.850 | 0.697 s | `var(--sui-anim-snappy-css)` (peak ≈1.006) |
| `.bouncy` | dur 0.5, bounce 0.30 | 157.914 | 17.593 | 0.700 | 0.819 s | `var(--sui-anim-bouncy-css)` (peak ≈1.046) |
| `.spring()` | resp 0.5, ζ 0.825 | 157.914 | 20.732 | 0.825 | 0.689 s | `var(--sui-anim-spring-css)` (peak ≈1.010) |
| `.interactiveSpring()` | resp 0.15, ζ 0.86 | 1754.60 | 72.05 | 0.860 | 0.21 s | `var(--sui-anim-interactiveSpring-css)` |
| `.interpolatingSpring()` | dur 0.5, bounce 0 | 157.914 | 25.133 | 1.000 | 0.735 s | = smooth curve; velocity carry only in JS spring |

> `blendDuration` (0 for smooth/snappy/bouncy/spring; 0.25 for interactiveSpring) = how long a *re-target mid-flight* blends the old & new spring. CSS `transition` re-targets natively (interrupting a transition starts a new one from the current computed value), so `blendDuration` is approximated by CSS's built-in interruption — good enough for blendable springs. `interpolatingSpring` is **additive** (carries velocity); to reproduce that you must run the JS solver and re-seed `v` (CSS can't carry velocity).

## 3.3 Legacy timing curves — KNOWN (SC:14709)

```swift
extension Animation {
  static func easeInOut(duration: TimeInterval) -> Animation ; static var easeInOut: Animation
  static func easeIn(duration: TimeInterval)   -> Animation ; static var easeIn:   Animation
  static func easeOut(duration: TimeInterval)  -> Animation ; static var easeOut:  Animation
  static func linear(duration: TimeInterval)   -> Animation ; static var linear:   Animation
  // SC:14726 — note the BAKED default duration = 0.35 s
  static func timingCurve(_ p1x: Double, _ p1y: Double, _ p2x: Double, _ p2y: Double,
      duration: TimeInterval = 0.35) -> Animation
  // SC:2942 — modern UnitCurve form
  static func timingCurve(_ curve: UnitCurve, duration: TimeInterval) -> Animation
}
```

| token | cubic-bezier | default dur | CSS |
|---|---|---|---|
| `.easeInOut` | `0.42,0,0.58,1` | 0.35 s | `cubic-bezier(.42,0,.58,1)` |
| `.easeIn` | `0.42,0,1,1` | 0.35 s | `cubic-bezier(.42,0,1,1)` |
| `.easeOut` | `0,0,.58,1` | 0.35 s | `cubic-bezier(0,0,.58,1)` |
| `.linear` | `0,0,1,1` | 0.35 s | `linear` |

> SwiftUI's default curve is `ease-in-out`, NOT CSS's `ease` keyword (`.25,.1,.25,1`). Never emit the `ease` keyword.

## 3.4 Chainable modifiers — KNOWN

```swift
extension Animation {
  public func speed(_ speed: Double) -> Animation                                   // SC:1850
  public func delay(_ delay: TimeInterval) -> Animation                             // SC:11758
  public func repeatCount(_ repeatCount: Int, autoreverses: Bool = true) -> Animation   // SC:15866
  public func repeatForever(autoreverses: Bool = true) -> Animation                 // SC:15867
  public func logicallyComplete(after duration: TimeInterval) -> Animation          // SC:8102
}
```

- `.speed(s)` divides duration by `s` (2× → half the time). `.delay(d)` prepends `d` seconds of hold.
- `.repeatCount(n, autoreverses:)` / `.repeatForever(autoreverses:)`: `autoreverses` default `true` → ping-pongs (forward then reverse). `false` → restart from 0 each cycle.

**Web mapping for the whole Animation type — the resolver:**

```ts
// DESIGNED — Animation token → CSS, the single source of truth for §3
export type AnimationToken =
  | "default" | "smooth" | "snappy" | "bouncy" | "spring" | "interactiveSpring"
  | "easeInOut" | "easeIn" | "easeOut" | "linear"
  | { kind: "spring"; duration: number; bounce: number; blend?: number }
  | { kind: "interpolatingSpring"; duration?: number; bounce?: number; mass?: number; stiffness?: number; damping?: number; initialVelocity?: number }
  | { kind: "timingCurve"; p1x: number; p1y: number; p2x: number; p2y: number; duration?: number }
  | { kind: "easeInOut" | "easeIn" | "easeOut" | "linear"; duration: number }
  // modifiers wrap any of the above:
  | { base: AnimationToken; speed?: number; delay?: number; repeat?: number | "forever"; autoreverses?: boolean };

export interface ResolvedAnim {
  kind: "spring" | "curve";
  duration: number;      // wall-clock seconds (settling for springs, dur for curves)
  easing: string;        // linear(...) or cubic-bezier(...)
  delay: number;
  iteration: number | "infinite";
  direction: "normal" | "alternate";
}

const PRESETS: Record<string, ResolvedAnim> = {
  default:   { kind:"spring", duration:0.735, easing:"var(--sui-anim-smooth-css)", delay:0, iteration:1, direction:"normal" },
  smooth:    { kind:"spring", duration:0.735, easing:"var(--sui-anim-smooth-css)", delay:0, iteration:1, direction:"normal" },
  snappy:    { kind:"spring", duration:0.697, easing:"var(--sui-anim-snappy-css)", delay:0, iteration:1, direction:"normal" },
  bouncy:    { kind:"spring", duration:0.819, easing:"var(--sui-anim-bouncy-css)", delay:0, iteration:1, direction:"normal" },
  spring:    { kind:"spring", duration:0.689, easing:"var(--sui-anim-spring-css)", delay:0, iteration:1, direction:"normal" },
  interactiveSpring: { kind:"spring", duration:0.21, easing:"var(--sui-anim-interactiveSpring-css)", delay:0, iteration:1, direction:"normal" },
  easeInOut: { kind:"curve", duration:0.35, easing:"cubic-bezier(.42,0,.58,1)", delay:0, iteration:1, direction:"normal" },
  easeIn:    { kind:"curve", duration:0.35, easing:"cubic-bezier(.42,0,1,1)",   delay:0, iteration:1, direction:"normal" },
  easeOut:   { kind:"curve", duration:0.35, easing:"cubic-bezier(0,0,.58,1)",   delay:0, iteration:1, direction:"normal" },
  linear:    { kind:"curve", duration:0.35, easing:"linear",                    delay:0, iteration:1, direction:"normal" },
};

export function resolveAnim(tok: AnimationToken): ResolvedAnim {
  if (typeof tok === "string") return { ...PRESETS[tok] };
  if ("base" in tok) {
    const r = resolveAnim(tok.base);
    if (tok.speed) r.duration /= tok.speed;
    if (tok.delay) r.delay = tok.delay;
    if (tok.repeat === "forever") { r.iteration = "infinite"; r.direction = tok.autoreverses === false ? "normal":"alternate"; }
    else if (typeof tok.repeat === "number") { r.iteration = tok.repeat; r.direction = tok.autoreverses === false ? "normal":"alternate"; }
    return r;
  }
  if (tok.kind === "spring") {
    const p = springFromDurationBounce(tok.duration, tok.bounce);
    const s = settlingDuration(p);
    return { kind:"spring", duration:s, easing:springToLinear(p, s), delay:0, iteration:1, direction:"normal" };
  }
  if (tok.kind === "interpolatingSpring") {
    const p = tok.stiffness != null
      ? { mass: tok.mass ?? 1, stiffness: tok.stiffness, damping: tok.damping! }
      : springFromDurationBounce(tok.duration ?? 0.5, tok.bounce ?? 0);
    const s = settlingDuration(p);
    return { kind:"spring", duration:s, easing:springToLinear(p, s), delay:0, iteration:1, direction:"normal" };
  }
  if (tok.kind === "timingCurve")
    return { kind:"curve", duration:tok.duration ?? 0.35, easing:`cubic-bezier(${tok.p1x},${tok.p1y},${tok.p2x},${tok.p2y})`, delay:0, iteration:1, direction:"normal" };
  // easeInOut/easeIn/easeOut/linear with explicit duration
  return { ...PRESETS[tok.kind], duration: tok.duration };
}
```

CSS emit: springs use `animation` (`@keyframes` + `linear()` + settling duration); curves use `transition` (`cubic-bezier` + 0.35 s). For property interpolation (the common case), both emit a `transition` shorthand; only `repeatForever`/`PhaseAnimator`/`KeyframeAnimator` need `animation` + `@keyframes`.

## 3.6 `useAnimatable` — the React analog of an animatable view value

```tsx
// DESIGNED — bind a style value so it animates with the in-scope transaction / explicit token
function useAnimatable<T extends number | string>(value: T, prop: string, explicit?: AnimationToken) {
  const txn = React.useContext(TxnContext);
  const tok = explicit ?? currentTxnAnimation() ?? txn.animation;   // explicit > withAnimation > inherited
  const ref = React.useRef<HTMLElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el || tok == null) return;
    const r = resolveAnim(tok);
    el.style.transition = `${prop} ${r.duration}s ${r.easing} ${r.delay}s`;
    // set the property on the next frame so the transition is observed
    requestAnimationFrame(() => { (el.style as any)[prop] = String(value); });
  }, [value, prop, tok]);
  return ref;
}
```

---

# 4. Transitions — `AnyTransition`, the `Transition` protocol, and `.transition`

A **transition** controls how a view appears (insertion) / disappears (removal) when it is added to / removed from the view tree (typically inside an `if`, `ForEach`, or conditional). A transition has **NO intrinsic duration** — it inherits the animation in scope (the `withAnimation`/`.animation` driving the `if`). Transition tokens are *property sets*; timing comes from §3.

## 4.1 The `Transition` protocol + phases — KNOWN

```swift
// SC:15907
@preconcurrency @MainActor public protocol Transition {
  associatedtype Body : View
  @ViewBuilder func body(content: Self.Content, phase: TransitionPhase) -> Self.Body
  static var properties: TransitionProperties { get }                       // default: hasMotion=true
  typealias Content = PlaceholderContentView<Self>
  func _makeContentTransition(transition: inout _Transition_ContentTransition)
}
// SC:15942
@frozen public enum TransitionPhase {
  case willAppear      // before insertion (the "active/from" state)
  case identity        // settled, on-screen, no effect applied
  case didDisappear    // after removal  (the "active/to" state)
  public var isIdentity: Bool { get }
}
// SC:15962 — TransitionPhase.value: -1 (willAppear), 0 (identity), +1 (didDisappear)
extension TransitionPhase { public var value: Double { get } }
// SC:15970
public struct TransitionProperties : Sendable { public init(hasMotion: Bool = true); public var hasMotion: Bool }
```

**Mental model (KNOWN from the enum):** `body(content:phase:)` is called for each phase; you return `content` modified to express that phase. `willAppear` is the off-screen "incoming" state, `identity` is the neutral on-screen state, `didDisappear` is the off-screen "outgoing" state. SwiftUI interpolates between `willAppear → identity` on insert and `identity → didDisappear` on remove, using the in-scope animation. `phase.value` gives `-1 / 0 / +1` — exactly the "from / neutral / to" we map to two CSS keyframes.

## 4.2 `.transition` view modifiers + `AnyTransition` — KNOWN

```swift
// SC:19513 — legacy AnyTransition form (type-erased)
@inlinable @_disfavoredOverload nonisolated public func transition(_ t: AnyTransition) -> some View
// SC:19518 — modern protocol form (iOS 17+)
@_alwaysEmitIntoClient nonisolated public func transition<T>(_ transition: T) -> some View where T : Transition
// AnyTransition combinators
extension AnyTransition {
  public func combined(with other: AnyTransition) -> AnyTransition           // SC:15819
  public func animation(_ animation: Animation?) -> AnyTransition            // SC:15783 — pin a specific animation to THIS transition
  public static func asymmetric(insertion: AnyTransition, removal: AnyTransition) -> AnyTransition  // SC:4482
  public static func modifier<E>(active: E, identity: E) -> AnyTransition where E : ViewModifier      // SC:842 — custom
}
```

## 4.3 The preset transitions — KNOWN signatures, INFERRED visuals, DESIGNED CSS

Every preset exists in two spellings: the old `AnyTransition` static (e.g. `.opacity`) and the new `Transition`-conforming struct (e.g. `OpacityTransition`). Both produce the same effect.

| token | Swift API (cite) | `willAppear` / `didDisappear` state (INFERRED) | CSS keyframes (DESIGNED) |
|---|---|---|---|
| **opacity** | `AnyTransition.opacity` SC:4225 · `OpacityTransition()` SC:4271 | opacity 0 | `opacity: 0 → 1` (in), `1 → 0` (out) |
| **slide** | `AnyTransition.slide` SC:8398 · `SlideTransition()` SC:8417 | asym: insert from leading edge, remove to trailing | in: `translateX(-100% → 0)`; out: `0 → +100%` |
| **scale** (zero-arg) | `AnyTransition.scale` SC:18757 · `.scale` ⇒ `ScaleTransition(1e-5)` SC:18768 | scale ≈ 0 (literally `1e-5`) about center | `scale(0 → 1)`, `transform-origin:center` |
| **scale(value)** | `.scale(scale:anchor:)` SC:18760 · `ScaleTransition(_ scale, anchor: .center)` SC:18780 | scale `s` about `anchor` | `scale(s → 1)`, origin = anchor |
| **move(edge)** | `.move(edge:)` SC:3528 · `MoveTransition(edge:)` SC:3543 | fully off-screen toward `edge` | `translate` 100% toward edge |
| **offset** | `.offset(_:)`/`.offset(x:y:)` SC:911 · `OffsetTransition(_ offset:)` SC:937 | translated by `CGSize` | `translate(x, y) → translate(0,0)` |
| **push(from)** | `.push(from:)` SC:11355 · `PushTransition(edge:)` SC:11370 | paired: new pushes in from edge, old pushes out opposite + fade | two-layer `translate` + `opacity` |
| **blurReplace** | `BlurReplaceTransition(configuration:)` SC:18158 | cross-fade + Gaussian blur + slight vertical offset | see §4.4 |
| **identity** | `AnyTransition.identity` · `IdentityTransition` SC:15999 | no change | none (instant) |
| **asymmetric** | `.asymmetric(insertion:removal:)` SC:4482 · `AsymmetricTransition<I,R>` SC:4489 | different transition in vs out | separate in/out keyframes |
| **combined** | `.combined(with:)` SC:15819 | both effects simultaneously | merge transforms (e.g. `opacity`+`scale`) |

**Key exact constants (KNOWN):**
- `.scale` zero-arg = `ScaleTransition(1e-5)` — scales from `0.00001`, NOT exactly 0 (avoids a zero-determinant transform). Web: use `scale(0.00001)` or just `scale(0)`.
- `ScaleTransition.anchor` default `.center`; `OffsetTransition` default x 0 y 0; `MoveTransition`/`PushTransition` take an `Edge` (`.top/.bottom/.leading/.trailing`).
- **Default transition** (when a view appears/disappears under an animation but no `.transition(...)` is set): **`.opacity`** fade (INFERRED — Apple's documented default).

`SlideTransition` is internally `asymmetric(insertion: move(.leading), removal: move(.trailing))` (INFERRED from docs). `PushTransition` couples the incoming and outgoing views so they appear to push each other off — a single-layer CSS transition can't fully reproduce the coupling; use the two-layer recipe.

## 4.4 `blurReplace` detail (iOS 17+) — KNOWN config, DESIGNED CSS

```swift
// SC:18158
public struct BlurReplaceTransition : Transition {
  public struct Configuration : Equatable, Sendable {
    public static let downUp: Configuration   // default: outgoing moves down / incoming comes up
    public static let upUp:   Configuration   // both move up
  }
  public var configuration: Configuration
  public init(configuration: Configuration)
}
```

```css
/* DESIGNED — blurReplace .downUp, paired with anim.smooth */
@keyframes sui-blurReplace-out-downUp { from { opacity:1; filter:blur(0);   transform:translateY(0); }
                                        to   { opacity:0; filter:blur(6px); transform:translateY(6px); } }
@keyframes sui-blurReplace-in-downUp  { from { opacity:0; filter:blur(8px); transform:translateY(-6px); }
                                        to   { opacity:1; filter:blur(0);   transform:translateY(0); } }
```

## 4.5 React API for transitions — the `<Transition>` / `useTransition` design

CSS can't natively run an exit animation on an unmounted element, so we drive insert/remove with a presence wrapper (the FLIP/Framer-Motion pattern, hand-rolled).

```tsx
// DESIGNED — transition prop model mirroring SwiftUI
export type SUITransition =
  | "opacity" | "slide" | "scale" | "identity"
  | { kind: "scale"; value: number; anchor?: UnitPoint }
  | { kind: "move"; edge: "top" | "bottom" | "leading" | "trailing" }
  | { kind: "offset"; x?: number; y?: number }
  | { kind: "push"; edge: "top" | "bottom" | "leading" | "trailing" }
  | { kind: "blurReplace"; config?: "downUp" | "upUp" }
  | { kind: "asymmetric"; insertion: SUITransition; removal: SUITransition }
  | { kind: "combined"; a: SUITransition; b: SUITransition };

// maps a transition + phase to a CSS style object (phase: "from" | "identity")
function transitionStyle(t: SUITransition, phase: "from" | "identity"): React.CSSProperties {
  const from = phase === "from";
  if (t === "opacity") return { opacity: from ? 0 : 1 };
  if (t === "scale")   return { transform: from ? "scale(0.00001)" : "scale(1)", transformOrigin: "center" };
  if (t === "slide")   return { transform: from ? "translateX(-100%)" : "translateX(0)" };
  if (t === "identity") return {};
  if (typeof t === "object") {
    switch (t.kind) {
      case "scale":  return { transform: from ? `scale(${t.value})` : "scale(1)", transformOrigin: anchorToOrigin(t.anchor) };
      case "move":   return { transform: from ? edgeTranslate(t.edge, "100%") : "translate(0,0)" };
      case "offset": return { transform: from ? `translate(${t.x ?? 0}px,${t.y ?? 0}px)` : "translate(0,0)" };
      case "blurReplace": return from
        ? { opacity: 0, filter: "blur(8px)", transform: "translateY(-6px)" }
        : { opacity: 1, filter: "blur(0)",   transform: "translateY(0)" };
      // asymmetric/combined handled by the wrapper (picks insertion vs removal style)
    }
  }
  return {};
}

// <AnimatedPresence> — keeps a removed child mounted until its removal transition ends.
export function AnimatedPresence({ show, transition = "opacity", animation = "default", children }: {
  show: boolean; transition?: SUITransition; animation?: AnimationToken; children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(show);
  const ref = React.useRef<HTMLDivElement>(null);
  const r = resolveAnim(animation);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ins = isAsym(transition) ? (transition as any).insertion : transition;
    const rem = isAsym(transition) ? (transition as any).removal  : transition;
    el.style.transition = `all ${r.duration}s ${r.easing}`;
    if (show) {
      setMounted(true);
      Object.assign(el.style, transitionStyle(ins, "from"));
      requestAnimationFrame(() => Object.assign(el.style, transitionStyle(ins, "identity")));
    } else if (mounted) {
      Object.assign(el.style, transitionStyle(rem, "identity"));
      requestAnimationFrame(() => Object.assign(el.style, transitionStyle(rem, "from")));
      const done = () => { setMounted(false); el.removeEventListener("transitionend", done); };
      el.addEventListener("transitionend", done);
    }
  }, [show]);
  return mounted ? <div ref={ref}>{children}</div> : null;
}
```

Usage mirrors SwiftUI: `<AnimatedPresence show={isOn} transition={{kind:"scale", value:0}} animation="bouncy">…</AnimatedPresence>` ≈ `if isOn { View().transition(.scale) }` driven by `withAnimation(.bouncy)`.

---

# 5. `contentTransition` — animating a view's CONTENT change in place

Where `.transition` animates insert/remove, `.contentTransition` animates a view whose *content* changes but which **stays mounted** (e.g. a `Text` whose number changes, an SF Symbol that swaps). It's the in-place morph.

```swift
// SC:15825
public struct ContentTransition : Equatable, Sendable {
  public static let identity: ContentTransition        // no animation, instant swap
  public static let opacity: ContentTransition         // cross-fade old→new
  public static let interpolate: ContentTransition     // interpolate vector shapes (symbol paths, etc.)
  public static func numericText(countsDown: Bool = false) -> ContentTransition   // odometer roll for digits
  @available(iOS 17+) public static func numericText(value: Double) -> ContentTransition  // direction inferred from value delta
}
// SC:15840
@_alwaysEmitIntoClient nonisolated public func contentTransition(_ transition: ContentTransition) -> some View
```

**Behavior (INFERRED from Apple docs / WWDC):**
- `.opacity` — old content fades out, new fades in (the default for most content).
- `.interpolate` — interpolates the vector geometry between old and new (used for SF Symbols whose glyphs share topology, and for shape morphs). Needs path-level interpolation.
- `.numericText(countsDown:)` — the **odometer**: each digit column rolls vertically. `countsDown=false` → digits roll up (increment); `true` → roll down. `numericText(value:)` infers direction from whether `value` rose or fell. This is what `Text(score, format:…).contentTransition(.numericText())` animates inside `withAnimation`.

**Web replication:**

| token | HTML | CSS / technique |
|---|---|---|
| `.identity` | single text node, swap text | none |
| `.opacity` | two stacked spans (old absolute, new) | cross-fade `opacity` over the in-scope animation |
| `.interpolate` | inline `<svg>` with morphable `<path>` | animate `d` via SMIL or a JS path interpolator (flubber-style); for symbols, share path point count |
| `.numericText` | per-digit `<span>` columns, each a vertical strip of 0–9 | `transform: translateY(-digit·1em)`; roll direction = countsDown |

```tsx
// DESIGNED — NumericText odometer
function NumericText({ value, countsDown = false, animation = "default" }: {
  value: number; countsDown?: boolean; animation?: AnimationToken;
}) {
  const digits = String(value).split("");
  const r = resolveAnim(animation);
  return (
    <span style={{ display: "inline-flex", overflow: "hidden", fontVariantNumeric: "tabular-nums" }}>
      {digits.map((d, i) => (
        <span key={i} style={{ display: "inline-block", height: "1em", overflow: "hidden" }}>
          <span style={{
            display: "block",
            transform: /^\d$/.test(d) ? `translateY(${-Number(d)}em)` : "translateY(0)",
            transition: `transform ${r.duration}s ${r.easing}`,
          }}>
            {/^\d$/.test(d) ? "0123456789".split("").map(n => <span key={n} style={{ display:"block", height:"1em" }}>{n}</span>) : d}
          </span>
        </span>
      ))}
    </span>
  );
}
```
`countsDown` flips the strip order (9→0) so the roll direction matches. Wrap the whole thing in tabular-nums so column widths don't jump.

---

# 6. `matchedGeometryEffect` + `matchedTransitionSource` — shared-element morph

The hero / shared-element transition: a view "in namespace `ns` with id `X`" smoothly morphs from its old position+size to its new one when the layout that holds it changes (e.g. a thumbnail expanding into a full card). Two views share an `(id, namespace)`; SwiftUI animates the geometry of whichever is `isSource`.

```swift
// SC:2955
@frozen public struct MatchedGeometryProperties : OptionSet {
  public static let position: MatchedGeometryProperties   // animate position (center) only
  public static let size:     MatchedGeometryProperties   // animate size only
  public static let frame:    MatchedGeometryProperties   // position ∪ size (the default)
}
// SC:2974
@inlinable nonisolated public func matchedGeometryEffect<ID>(id: ID, in namespace: Namespace.ID,
    properties: MatchedGeometryProperties = .frame,
    anchor: UnitPoint = .center,
    isSource: Bool = true) -> some View where ID : Hashable
// SUI:14537 — modern navigation-zoom source marker (iOS 18+)
nonisolated public func matchedTransitionSource(id: some Hashable, in namespace: Namespace.ID) -> some View
nonisolated public func matchedTransitionSource(id: some Hashable, in namespace: Namespace.ID,
    configuration: (EmptyMatchedTransitionSourceConfiguration) -> some MatchedTransitionSourceConfiguration) -> some View
```

- Defaults (KNOWN): `properties = .frame`, `anchor = .center`, `isSource = true`.
- **Timing (INFERRED):** matchedGeometry has NO own animation; it interpolates frame/position/size with whatever animation is in scope when the matched pair swaps. No explicit animation → `.default` (= `.smooth` spring on iOS17+).

**Web replication — the FLIP technique (DESIGNED):**

```ts
// DESIGNED — matchedGeometryEffect via FLIP (First-Last-Invert-Play)
// 1. record the source element's rect BEFORE the swap (First)
// 2. mount the destination element, measure its rect (Last)
// 3. set the dest's transform to the INVERSE (translate+scale to overlay the source)
// 4. animate transform → none with the in-scope spring (Play)
function flipMorph(srcRect: DOMRect, destEl: HTMLElement, props: "frame"|"position"|"size", anim: ResolvedAnim) {
  const last = destEl.getBoundingClientRect();
  const dx = srcRect.left - last.left, dy = srcRect.top - last.top;
  const sx = srcRect.width / last.width, sy = srcRect.height / last.height;
  const tParts: string[] = [];
  if (props !== "size")     tParts.push(`translate(${dx}px, ${dy}px)`);
  if (props !== "position") tParts.push(`scale(${sx}, ${sy})`);
  destEl.style.transformOrigin = "0 0";                 // top-left so translate+scale compose cleanly
  destEl.style.transform = tParts.join(" ");            // Invert
  destEl.style.transition = "none";
  requestAnimationFrame(() => {
    destEl.style.transition = `transform ${anim.duration}s ${anim.easing}`;
    destEl.style.transform = "none";                    // Play
  });
}
```

`properties=.frame` ⇒ animate translate+scale; `.position` ⇒ translate only; `.size` ⇒ scale only. `anchor` maps to `transform-origin` (but FLIP uses `0 0` and bakes the anchor into the dx/dy math). React API: a `useMatchedGeometry(id, namespace, {properties, isSource})` hook that registers the element's rect in a shared `Map` keyed `${namespace}:${id}`, and on the swap runs `flipMorph`. `matchedTransitionSource` (the iOS 18 navigation-zoom form) maps to the same machinery wired to a route push.

---

# 7. `PhaseAnimator` — cycle a view through discrete phases

Drives a view repeatedly (or once per trigger) through a sequence of discrete `Phase` values, animating the transition between consecutive phases. Each phase can use a different animation. The canonical "pulse / wiggle / shake on tap" primitive.

```swift
// SC:14178
public struct PhaseAnimator<Phase, Content> : View where Phase : Equatable, Content : View {
  // trigger form: cycles once through phases each time `trigger` changes
  public init(_ phases: some Sequence<Phase>, trigger: some Equatable,
      @ViewBuilder content: @escaping (Phase) -> Content,
      animation: @escaping (Phase) -> Animation? = { _ in .default })
  // self-running form: loops phases forever
  public init(_ phases: some Sequence<Phase>,
      @ViewBuilder content: @escaping (Phase) -> Content,
      animation: @escaping (Phase) -> Animation? = { _ in .default })
}
// SC:14196 — view-modifier sugar (PlaceholderContentView form)
nonisolated public func phaseAnimator<Phase>(_ phases: some Sequence<Phase>, trigger: some Equatable,
    @ViewBuilder content: …, animation: @escaping (Phase) -> Animation? = { _ in .default }) -> some View
nonisolated public func phaseAnimator<Phase>(_ phases: some Sequence<Phase>,
    @ViewBuilder content: …, animation: @escaping (Phase) -> Animation? = { _ in .default }) -> some View
```

- **Default animation per phase:** `.default` (KNOWN — `{ _ in .default }`).
- **Self-running form** loops the phase sequence forever; **trigger form** advances through the sequence once per `trigger` change, then rests on the last phase (which is usually the same as the first → returns to rest).
- The `animation(phase)` closure picks which animation to use *entering* that phase. Return `nil` → snap instantly.

**Web replication (DESIGNED):** a state machine that steps `phaseIndex` and applies the per-phase animation, plus a `content(phase)` render prop.

```tsx
// DESIGNED
function PhaseAnimator<P>({ phases, trigger, loop = false, content, animation = () => "default" }: {
  phases: P[]; trigger?: unknown; loop?: boolean;
  content: (p: P) => React.ReactNode; animation?: (p: P) => AnimationToken | null;
}) {
  const [i, setI] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const advance = React.useCallback((idx: number) => {
    const p = phases[idx]; const tok = animation(p);
    const el = ref.current!;
    if (tok == null) { el.style.transition = "none"; }
    else { const r = resolveAnim(tok); el.style.transition = `all ${r.duration}s ${r.easing}`; }
    setI(idx);
  }, [phases]);
  React.useEffect(() => {                  // trigger form: run 0→last once
    if (trigger === undefined) return;
    let idx = 0, cancelled = false;
    const tick = () => { if (cancelled || idx >= phases.length - 1) return;
      const tok = animation(phases[idx + 1]); const r = tok ? resolveAnim(tok) : { duration: 0 };
      advance(idx + 1); idx++; setTimeout(tick, r.duration * 1000); };
    tick(); return () => { cancelled = true; };
  }, [trigger]);
  React.useEffect(() => {                  // self-running loop
    if (!loop) return;
    let idx = i, cancelled = false;
    const tick = () => { if (cancelled) return; const next = (idx + 1) % phases.length;
      const tok = animation(phases[next]); const r = tok ? resolveAnim(tok) : { duration: 0 };
      advance(next); idx = next; setTimeout(tick, r.duration * 1000); };
    const t = setTimeout(tick, 0); return () => { cancelled = true; clearTimeout(t); };
  }, [loop]);
  return <div ref={ref}>{content(phases[i])}</div>;
}
```
The `content(phase)` closure typically returns the same view with phase-dependent modifiers (`.scaleEffect(phase == .big ? 1.2 : 1)`); on the web that's phase-dependent inline styles, and the wrapper's `transition` carries the per-phase animation.

---

# 8. `KeyframeAnimator` + keyframe types — multi-track timeline animation

Where `PhaseAnimator` animates between *discrete* states, `KeyframeAnimator` animates a *continuous value* along an explicit timeline of keyframes, with independent timing per keyframe. Multiple tracks (one per property) run in parallel over a shared timeline. This is SwiftUI's CSS-`@keyframes` analog, but with per-segment spring/cubic/linear timing.

```swift
// SC:2379
public struct KeyframeAnimator<Value, KeyframePath, Content> : View
    where Value == KeyframePath.Value, KeyframePath : Keyframes, Content : View {
  // trigger form: replays the timeline each time `trigger` changes
  public init(initialValue: Value, trigger: some Equatable,
      @ViewBuilder content: @escaping (Value) -> Content,
      @KeyframesBuilder<Value> keyframes: @escaping (Value) -> KeyframePath)
  // repeating form: loops the timeline (repeating default true)
  public init(initialValue: Value, repeating: Bool = true,
      @ViewBuilder content: @escaping (Value) -> Content,
      @KeyframesBuilder<Value> keyframes: @escaping (Value) -> KeyframePath)
}
// SC:14210 — view-modifier sugar: .keyframeAnimator(initialValue:trigger:content:keyframes:)
```

The 4 keyframe content types (KNOWN — each animates FROM the previous keyframe's value TO `to` over `duration`, differing only in HOW):

```swift
// SC:14114 — cubic Hermite spline through the points; smoothest, can specify tangents
public struct CubicKeyframe<Value> : KeyframeTrackContent where Value : Animatable {
  public init(_ to: Value, duration: TimeInterval, startVelocity: Value? = nil, endVelocity: Value? = nil)
}
// SC:14128 — physical spring settling on `to`; duration optional (uses spring's natural settling)
public struct SpringKeyframe<Value> : KeyframeTrackContent where Value : Animatable {
  public init(_ to: Value, duration: TimeInterval? = nil, spring: Spring = Spring(), startVelocity: Value? = nil)
}
// SC:14142 — straight-line interp with a per-segment UnitCurve (default .linear)
public struct LinearKeyframe<Value> : KeyframeTrackContent where Value : Animatable {
  public init(_ to: Value, duration: TimeInterval, timingCurve: UnitCurve = .linear)
}
// SC:14156 — instant jump to `to` (no interpolation); zero-duration step
public struct MoveKeyframe<Value> : KeyframeTrackContent where Value : Animatable {
  public init(_ to: Value)
}
```

Tracks are grouped with `KeyframeTrack(\.keyPath) { … }` (SC:1857) inside a `KeyframeTimeline`. The builder (`KeyframesBuilder` SC:3471, `KeyframeTrackContentBuilder` SC:14282) assembles them.

- `SpringKeyframe` default `spring = Spring()` = `Spring(duration:0.5,bounce:0)` = smooth (KNOWN — `Spring()` default args). `duration: nil` → use the spring's natural settling time.
- `CubicKeyframe` `startVelocity`/`endVelocity` `nil` → SwiftUI auto-computes C¹-continuous tangents from neighbors (Catmull-Rom-like).
- `LinearKeyframe.timingCurve` default `.linear`.

**Web replication (DESIGNED):** because each keyframe has its own duration AND its own easing, a single CSS `@keyframes` (which uses one global timing or per-stop `animation-timing-function`) ALMOST works — CSS does support per-keyframe-stop `animation-timing-function`. So we compile a `KeyframeTrack` to a CSS `@keyframes` block where each stop carries its segment easing; `MoveKeyframe` → `step-start`; `LinearKeyframe` → its `cubic-bezier`/`linear`; `CubicKeyframe`/`SpringKeyframe` → a sampled `linear()` for that segment. For exact spring segments, run the JS solver instead.

```ts
// DESIGNED — compile a track of keyframes to a CSS @keyframes string
type KF<V> =
  | { type:"cubic"; to:V; duration:number; sv?:V; ev?:V }
  | { type:"spring"; to:V; duration?:number; spring?:SpringParams; sv?:V }
  | { type:"linear"; to:V; duration:number; curve?:string }
  | { type:"move"; to:V };                    // instant

function compileTrack<V extends number>(name: string, initial: V, kfs: KF<V>[], format:(v:V)=>string) {
  const total = kfs.reduce((s,k)=> s + ("duration" in k && k.duration ? k.duration :
      (k.type==="spring" ? settlingDuration(k.spring ?? springFromDurationBounce(0.5,0)) : 0)), 0);
  let t = 0; const stops: string[] = [`0% { ${name}: ${format(initial)}; }`];
  for (const k of kfs) {
    const segDur = ("duration" in k && k.duration) ? k.duration
      : (k.type==="spring" ? settlingDuration(k.spring ?? springFromDurationBounce(0.5,0)) : 0);
    const startPct = (t/total)*100; t += segDur; const endPct = (t/total)*100;
    let timing = "linear";
    if (k.type==="move")   timing = "step-start";
    if (k.type==="linear") timing = k.curve ?? "linear";
    if (k.type==="cubic")  timing = "cubic-bezier(0.4,0,0.2,1)"; // approx; or sampled linear()
    if (k.type==="spring") timing = springToLinear(k.spring ?? springFromDurationBounce(0.5,0), segDur);
    // emit the easing on the START stop (CSS applies a stop's timing to the segment AFTER it)
    stops[stops.length-1] = stops[stops.length-1].replace("; }", `; animation-timing-function: ${timing}; }`);
    stops.push(`${endPct.toFixed(2)}% { ${name}: ${format(k.to)}; }`);
  }
  return { css: `@keyframes ${name}-kf { ${stops.join(" ")} }`, totalDuration: total };
}
```
React API: `<KeyframeAnimator initialValue={…} trigger={tap} keyframes={[…]} content={v => <Box style={styleFromValue(v)}/>}/>` — but since the web compiles to `@keyframes`, the practical form is to compile each property track to its own `@keyframes` and apply them together via the `animation` shorthand list, replayed on `trigger` change by toggling `animation-name`.

---

# 9. Tabulated long-tail (signature + purpose + web-equivalent)

These types are either internal plumbing (`_` prefix, opaque, never user-facing), protocol scaffolding, or higher-level features that reuse the §1–8 engine. Each gets its cite + one-line purpose + web mapping. None needs a bespoke CSS recipe beyond what's above.

## 9.1 Protocols & scaffolding

| type | kind | cite | purpose | web-equivalent |
|---|---|---|---|---|
| `Transition` | protocol | SC:15907 | base protocol for all transitions (`body(content:phase:)`) | the `SUITransition` union + `transitionStyle()` (§4.5) |
| `Keyframes` | protocol | SC:5490 | base for keyframe path types | the `KF[]` track type (§8) |
| `KeyframeTrackContent` | protocol | SC:14080 | base for `Cubic/Spring/Linear/MoveKeyframe` | the `KF` union member |
| `CustomAnimation` | protocol | SC:15508 | implement a bespoke timing curve (`animate(value:time:context:)`) | a JS function `(t)→value` fed to `springToLinear`-style sampler |
| `AnimationStateKey` | protocol | SC:13623 | typed key for per-animation scratch state | a `Map` keyed by symbol in the JS solver |
| `MatchedTransitionSourceConfiguration` | protocol | SUI:14547 | configures nav-zoom source (corner radius, etc.) | options object on `useMatchedGeometry` |
| `_ResolvedMatchedTransitionSourceConfiguration` | struct | SUI:14544 | opaque resolved form of the above (`_update(configuration:)` target) | the concrete `{cornerRadius, …}` applied to the morph |
| `NavigationTransition` | protocol | SUI:8743 | base for navigation push/pop transitions | route-transition strategy object |

## 9.2 Spring/animation internals

| type | kind | cite | purpose | web-equivalent |
|---|---|---|---|---|
| `AnimationContext` | struct | SC:15677 | per-frame context passed to `CustomAnimation` (env, state) | the `{time, target, velocity}` arg to the JS solver |
| `AnimationState` | struct | SC:13608 | scratch state bag for a `CustomAnimation` | closure-captured mutable state in JS solver |
| `AnimationCompletionCriteria` | struct | SC:10146 | `.logicallyComplete` / `.removed` (see §1.1) | which DOM event ends the completion callback |
| `_AnimationModifier` | struct | SC:13167 | the `ViewModifier` behind `.animation(_:value:)` | `useAnimatable` (§3.6) |
| `_AnimationView` | struct | SC:13187 | internal host view driving an animation | the ref'd `<div>` carrying `transition` |

## 9.3 Transition internals & specialized transitions

| type | kind | cite | purpose | web-equivalent |
|---|---|---|---|---|
| `IdentityTransition` | struct | SC:15999 | the no-op transition | `transitionStyle` returns `{}` |
| `TransitionProperties` | struct | SC:15970 | `hasMotion` flag (false → skip under reduce-motion) | `prefers-reduced-motion` gate (§10) |
| `_Transition_ContentTransition` | struct | SC:15932 | bridge: a `Transition` advertising a `ContentTransition` | n/a (internal) |
| `SymbolEffectTransition` | struct | SUI:4433 | transition backed by an SF Symbol effect (appear/disappear) | SVG symbol cross-fade/draw-on |
| `GlassEffectTransition` | struct | SC:2847 | iOS 26 Liquid-Glass morph: `.matchedGeometry` / `.materialize` / `.identity` | **labeled, not built** — `anim.glass.*` only in Liquid-Glass theme |
| `AutomaticNavigationTransition` | struct | SUI:8758 | default nav push/pop (platform slide) | route slide: `translateX(100%→0)` push |
| `ZoomNavigationTransition` | struct | SUI:8772 | nav zoom morph from a `matchedTransitionSource` | FLIP morph (§6) wired to route change |
| `_NavigationTransitionInputs` | struct | SUI:8747 | opaque input bag passed to `NavigationTransition._outputs(for:)` (from/to view geometry + env) | n/a (internal) — the `{fromRect,toRect,env}` arg to a route-transition fn |
| `_NavigationTransitionOutputs` | struct | SUI:8750 | opaque output bag returned by `NavigationTransition._outputs(for:)` (the resolved push/pop effect) | n/a (internal) — the computed per-layer transforms for the route swap |

## 9.4 Keyframe & timeline internals

| type | kind | cite | purpose | web-equivalent |
|---|---|---|---|---|
| `KeyframeTimeline` | struct | SC:14240 | a multi-track timeline (`duration`, `value(time:)`) | the compiled `@keyframes` set + total duration |
| `KeyframeTrack` | struct | SC:1857 | one property's track within the timeline | one `@keyframes` block (§8) |
| `KeyframesBuilder` | struct | SC:3471 | result-builder assembling tracks | the `KF[]` array literal |
| `KeyframeTrackContentBuilder` | struct | SC:14282 | result-builder assembling keyframes in a track | array of `KF` |
| `_ResolvedKeyframes` / `_ResolvedKeyframeTrackContent` | struct | SC:5517 / SC:14099 | resolved (sampled) keyframe data | the sampled `linear()`/stop list |
| `AnimationTimelineSchedule` | struct | SUI:8651 | `TimelineSchedule` that ticks every frame while animating (used by `TimelineView(.animation)`) | a `requestAnimationFrame` loop driving re-render |

## 9.5 Scroll-driven transitions (reuse the engine, scroll-position-driven)

| type | kind | cite | purpose | web-equivalent |
|---|---|---|---|---|
| `.scrollTransition(_:axis:transition:)` | modifier | SUI:5973 | apply a `VisualEffect` to a row as a function of its scroll position phase | CSS scroll-driven animations (`animation-timeline: view()`) or IntersectionObserver |
| `ScrollTransitionConfiguration` | struct | SUI:5979 | `.animated` / `.interactive(timingCurve: .easeInOut)` / `.identity` + `.threshold(_)` | `animation-timeline: view()` (interactive) vs JS-eased (animated) |
| `ScrollTransitionPhase` | enum | SUI:6008 | `.topLeading` (-1) / `.identity` (0) / `.bottomTrailing` (+1); `.value: Double` | the scroll-progress value `-1…0…+1` fed to the effect |
| `ScrollTransitionConfiguration.Threshold` | struct | SUI:5989 | `.visible`/`.hidden`/`.centered`/`.visible(amount)` — when the phase flips | IntersectionObserver `threshold` / `rootMargin` |
| `.onScrollPhaseChange(_)` | modifier | SUI:13384 | callback on scroll-phase change (idle/tracking/decelerating/animating) | `scroll`/`scrollend` + a velocity-derived state machine |
| `_ScrollViewAnimationMode` | enum | SUI:20587 | internal scroll animation mode | n/a |

`.scrollTransition` web recipe (DESIGNED): use **CSS scroll-driven animations** when available —
```css
@supports (animation-timeline: view()) {
  .sui-scroll-row { animation: sui-scrollfade linear both; animation-timeline: view();
                    animation-range: entry 0% cover 30%; }   /* maps Threshold */
  @keyframes sui-scrollfade { from { opacity:.3; transform:scale(.8); } to { opacity:1; transform:scale(1); } }
}
```
Fallback: an IntersectionObserver computes `phase.value ∈ [-1,1]` from the row's position and sets a CSS var the effect reads. `.interactive` (scrubs with scroll) → `animation-timeline:view()`; `.animated` (plays an animation on threshold cross) → JS-triggered transition.

## 9.6 Spring-loading & misc

| type | kind | cite | purpose | web-equivalent |
|---|---|---|---|---|
| `SpringLoadingBehavior` | struct | SUI:5392 | `.automatic`/`.enabled`/`.disabled` — drag-hover "spring loads" a control (opens a folder on hover-during-drag) | `dragover` + dwell timer → trigger |
| `.springLoadingBehavior(_)` | modifier | SUI:5404 | enable/disable spring-loading on a control | prop on draggable targets |
| `.glassEffectTransition(_)` | modifier | SC:2861 | apply a `GlassEffectTransition` (iOS 26) | Liquid-Glass theme only (labeled) |

> **`SpringLoadingBehavior` is NOT a spring animation** — despite the name, it's the macOS/iPadOS "hover-during-drag to auto-activate" behavior (drag a file over a folder, it springs open). No motion-curve involvement; it's a dwell-timer interaction. Listed here so it isn't mistaken for the spring engine.

---

# 10. Reduced-motion, the CSS variable bundle, and calibration

## 10.1 `prefers-reduced-motion` policy (DESIGNED)

`TransitionProperties.hasMotion` (SC:15970) is SwiftUI's hook for this: a transition with `hasMotion=false` is exempt. Web policy: collapse all springs/moves/scales to a ≤0.2 s opacity cross-fade.

```css
@media (prefers-reduced-motion: reduce) {
  * { /* spring & move transitions → quick fade */ }
  .sui-animated { transition-duration: .15s !important; transition-timing-function: linear !important; }
  /* drop transforms; keep only opacity */
}
```

## 10.2 The CSS custom-property bundle (paste into `:root`)

```css
:root {
  /* spring presets — settling-time durations */
  --sui-anim-smooth-dur: .735s; --sui-anim-snappy-dur: .697s; --sui-anim-bouncy-dur: .819s;
  --sui-anim-spring-dur: .689s; --sui-anim-interactiveSpring-dur: .21s; --sui-anim-default-dur: .735s;
  /* spring linear() easings — from animation.md §1/§4 (canonical) */
  --sui-anim-smooth-css: linear(0,0.0575 4.2%,0.1804 8.3%,0.3209 12.5%,0.4553 16.7%,0.5731 20.8%,0.6712 25%,0.7502 29.2%,0.8123 33.3%,0.8602 37.5%,0.8967 41.7%,0.9241 45.8%,0.9445 50%,0.9597 54.2%,0.9708 58.3%,0.9789 62.5%,0.9848 66.7%,0.9891 70.8%,0.9922 75%,0.9945 79.2%,0.9960 83.3%,0.9972 87.5%,0.9980 91.7%,0.9986 95.8%,1);
  --sui-anim-snappy-css: linear(0,0.0541 4.2%,0.1761 8.3%,0.3225 12.5%,0.4678 16.7%,0.5981 20.8%,0.7076 25%,0.7952 29.2%,0.8624 33.3%,0.9121 37.5%,0.9474 41.7%,0.9715 45.8%,0.9873 50%,0.9971 54.2%,1.0026 58.3%,1.0053 62.5%,1.0062 66.7%,1.0061 70.8%,1.0055 75%,1.0046 79.2%,1.0037 83.3%,1.0028 87.5%,1.0021 91.7%,1.0015 95.8%,1);
  --sui-anim-bouncy-css: linear(0,0.0749 4.2%,0.2420 8.3%,0.4368 12.5%,0.6204 16.7%,0.7728 20.8%,0.8874 25%,0.9656 29.2%,1.0131 33.3%,1.0375 37.5%,1.0457 41.7%,1.0440 45.8%,1.0371 50%,1.0282 54.2%,1.0195 58.3%,1.0121 62.5%,1.0064 66.7%,1.0024 70.8%,0.9998 75%,0.9985 79.2%,0.9979 83.3%,0.9979 87.5%,0.9982 91.7%,0.9986 95.8%,1);
  --sui-anim-spring-css: linear(0,0.0738 5%,0.2320 10%,0.4108 15%,0.5760 20%,0.7128 25%,0.8176 30%,0.8930 35%,0.9440 40%,0.9763 45%,0.9953 50%,1.0052 55%,1.0094 60%,1.0102 65%,1.0092 70%,1.0075 75%,1.0057 80%,1.0041 85%,1.0027 90%,1.0017 95%,1);
  --sui-anim-interactiveSpring-css: linear(0,0.0752 5%,0.2340 10%,0.4108 15%,0.5725 20%,0.7054 25%,0.8072 30%,0.8807 35%,0.9311 40%,0.9640 45%,0.9842 50%,0.9958 55%,1.0018 60%,1.0044 65%,1.0050 70%,1.0046 75%,1.0038 80%,1.0030 85%,1.0021 90%,1.0015 95%,1);
  /* legacy curves */
  --sui-anim-easeInOut: cubic-bezier(.42,0,.58,1); --sui-anim-easeIn: cubic-bezier(.42,0,1,1);
  --sui-anim-easeOut: cubic-bezier(0,0,.58,1); --sui-anim-easeInOut-dur: .35s;
}
```

## 10.3 Calibration plan (how to verify motion 1:1)

1. **Static curve check:** render a SwiftUI Catalyst/macOS sample animating one CGFloat 0→1 with each preset; capture per-frame position via `Spring.value(target:time:)` ground truth; compare against the JS solver / `linear()` sampler. Target: max |Δposition| < 0.005 across the settling window.
2. **Visual diff:** screen-record the SwiftUI sample and the web replica side-by-side at 60fps; overlay; the overshoot peaks (snappy ≈1.006, bouncy ≈1.046, spring ≈1.010) must align within ±1 frame.
3. **Transition timing:** insert/remove a view with `.scale`/`.opacity`/`.blurReplace` under `withAnimation(.bouncy)`; confirm the transition runs for the bouncy settling time (0.819 s) and the overshoot is visible.
4. **numericText:** animate a counter 0→999; the digit-roll direction + per-column independence must match SwiftUI's odometer.
5. **matchedGeometry:** thumbnail→detail morph; the FLIP path must trace the same arc as SwiftUI's frame interpolation (both default to `.smooth`).

---

# 11. Source-label ledger

- **KNOWN (swiftinterface verbatim):** every signature + default arg in §1–9 (cites given); the spring conversion functions + preset bounce offsets (0/0.15/0.30, dur 0.5) inlined at SC:13090; `spring(response:0.5,dampingFraction:0.825)`; `interactiveSpring(response:0.15,dampingFraction:0.86,blendDuration:0.25)`; `timingCurve` default dur 0.35; `.scale` = `ScaleTransition(1e-5)`; all transition/keyframe/matchedGeometry defaults; `ContentTransition` cases; `TransitionPhase`/`ScrollTransitionPhase` cases + values; `PhaseAnimator`/`KeyframeAnimator` default `.default` animation; `SpringKeyframe` default `Spring()`.
- **KNOWN-by-formula:** every k/c/ζ/settling value (pure arithmetic on the inlined ODE).
- **INFERRED:** `.default` = smooth spring on iOS17+; default transition = `.opacity`; transition *visual* semantics (`body` is `@_opaqueReturnTypeOf`, opaque); `contentTransition` rendering behavior; matchedGeometry uses in-scope animation; legacy cubic-bezier control points (= CoreAnimation/CSS standard).
- **DESIGNED:** all React hooks/components (`withAnimation`, `useAnimatable`, `AnimatedPresence`, `NumericText`, `PhaseAnimator`, `KeyframeAnimator`, FLIP `matchedGeometry`); the JS spring solver + `springToLinear` + `settlingDuration`; the `@keyframes` compiler; blurReplace/scrollTransition web recipes; reduced-motion policy; CSS var bundle (the `linear()` tables originate in `animation.md`, reproduced here verbatim).
