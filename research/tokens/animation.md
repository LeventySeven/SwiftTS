# SwiftUI Animation & Transitions — RE Token Spec

**Domain:** `anim.*` — spring presets, legacy curves, transition presets, interactive/interpolating springs, matchedGeometry timing.
**Target:** canonical iOS 17 / macOS 14 SwiftUI ("SwiftUI look"). iOS 26 "Liquid Glass" deltas are labeled, never substituted.
**Authoritative sources read (Tier-1A):**

- `SwiftUICore.framework/.../arm64e-apple-macos.swiftinterface` (the macOS 26 SDK ships the iOS17/macOS14 symbols with `@_originallyDefinedIn(... iOS 18.0)`). Spring presets, the spring conversion helpers, and all default-arg values are **inlined** in this file via `@_alwaysEmitIntoClient`, so they are KNOWN, not inferred.
- WWDC23 #10158 *Animate with springs*, WWDC23 #10157, Apple Developer docs — for the duration/bounce↔mass/stiffness/damping framing and legacy curve defaults.

**Source labels:** `KNOWN` = verbatim from swiftinterface body or baked dylib constant · `INFERRED` = from Apple docs / WWDC / reputable RE · `DESIGNED` = my CSS engineering to reproduce the runtime behavior on the web.

---

## 0. The exact spring math (baked, KNOWN)

The swiftinterface inlines the three internal conversion functions verbatim. These ARE the spring engine — every preset compiles down to them. `mass` is always implicitly `1.0` for the duration/bounce path.

```swift
// SwiftUICore swiftinterface, lines 13055–13083 — @_alwaysEmitIntoClient (KNOWN verbatim)
internal func springStiffness(response: Double) -> Double {
    if response <= 0 { return .infinity }
    let freq = (2.0 * Double.pi) / response
    return freq * freq                       //  k = (2π / response)²
}
internal func springDamping(fraction: Double, stiffness: Double) -> Double {
    let criticalDamping = 2 * stiffness.squareRoot()
    return criticalDamping * fraction        //  c = 2√k · ζ
}
internal func springDampingFraction(bounce: Double) -> Double {
    if bounce <= -1.0 { return .infinity }
    else if bounce < 0.0 { return 1.0 / (bounce + 1.0) }
    else if bounce == 0.0 { return 1.0 }
    else { return 1.0 - min(bounce, 1.0) }   //  ζ = 1 − bounce   (for bounce ∈ [0,1])
}
```

And the `Spring(duration:bounce:)` / `.spring(duration:bounce:blendDuration:)` path (lines 13091–13096, KNOWN verbatim):

```swift
spring(response: duration,
       dampingFraction: springDampingFraction(bounce: bounce),   // = 1 − bounce
       blendDuration: blendDuration)
```

So for the duration/bounce family with **mass = 1**:

| quantity | formula | identity |
|---|---|---|
| `response` | `= duration` | the spring's "response" param **equals** the duration param |
| `dampingFraction (ζ)` | `1 − bounce` (bounce ≥ 0) | bounce 0 → critically damped ζ=1 |
| `stiffness (k)` | `(2π / duration)²` | |
| `damping (c)` | `2√k · ζ = (4π / duration)·(1 − bounce)` | because `2√k = 2·(2π/dur) = 4π/dur` |

> **WWDC23 wording vs. baked truth:** WWDC23 stated `damping = 1 − 4π·bounce/duration`. That published line is a simplification/transcription slip — the real inlined formula is `damping = (4π/duration)·(1 − bounce)`. Use the swiftinterface formula; it is authoritative. (The two only agree when `4π/duration = 1`.)

---

## 1. Spring presets (iOS 17+) — `anim.smooth / snappy / bouncy`

**KNOWN verbatim** from swiftinterface (Spring ext. lines 3188–3206; Animation ext. lines 13110–13130). All three share `duration = 0.5`; they differ only by a baked bounce offset added to the caller's `extraBounce`:

```swift
static func smooth(duration = 0.5, extraBounce = 0.0) = Spring(duration:, bounce: extraBounce)        // bounce 0.0
static func snappy(duration = 0.5, extraBounce = 0.0) = Spring(duration:, bounce: 0.15 + extraBounce)  // bounce 0.15
static func bouncy(duration = 0.5, extraBounce = 0.0) = Spring(duration:, bounce: 0.3  + extraBounce)  // bounce 0.30
```

Derived constants (computed from §0 math, mass = 1, duration = 0.5 ⇒ `k = (4π)² = 157.9137`):

| preset | duration | bounce | ζ (dampingFraction) | mass | stiffness k | damping c | settling T (2‰)¹ |
|---|---|---|---|---|---|---|---|
| `smooth` | 0.5 | 0.00 | 1.000 | 1.0 | 157.9137 | 25.1327 | ≈0.735 s |
| `snappy` | 0.5 | 0.15 | 0.850 | 1.0 | 157.9137 | 21.3628 | ≈0.697 s |
| `bouncy` | 0.5 | 0.30 | 0.700 | 1.0 | 157.9137 | 17.5929 | ≈0.819 s |

¹ settling T = time the unit-step response stays permanently within ±0.001 of target; this is the real on-screen run length and the duration our CSS animation must use (the `duration: 0.5` param is **perceptual**, not the wall-clock length).

### CSS approximation (DESIGNED) — `linear()` easing points

Web springs need `animation: … <settlingT> linear(<points>)`. Each table below is the unit-step position `x(t)` of the exact ODE `ẍ + c·ẋ + k·x = k`, mass 1, sampled uniformly over the settling window. Overshoot >1 in snappy/bouncy is real (that's the bounce) and `linear()` reproduces it. CSS `linear()` clamps nothing, so overshoot animates correctly.

```
anim.smooth.css   →  duration 0.735s
  linear(0, 0.0575 4.2%, 0.1804 8.3%, 0.3209 12.5%, 0.4553 16.7%, 0.5731 20.8%,
         0.6712 25%, 0.7502 29.2%, 0.8123 33.3%, 0.8602 37.5%, 0.8967 41.7%,
         0.9241 45.8%, 0.9445 50%, 0.9597 54.2%, 0.9708 58.3%, 0.9789 62.5%,
         0.9848 66.7%, 0.9891 70.8%, 0.9922 75%, 0.9945 79.2%, 0.9960 83.3%,
         0.9972 87.5%, 0.9980 91.7%, 0.9986 95.8%, 1)

anim.snappy.css   →  duration 0.697s   (peak ≈1.006 overshoot)
  linear(0, 0.0541 4.2%, 0.1761 8.3%, 0.3225 12.5%, 0.4678 16.7%, 0.5981 20.8%,
         0.7076 25%, 0.7952 29.2%, 0.8624 33.3%, 0.9121 37.5%, 0.9474 41.7%,
         0.9715 45.8%, 0.9873 50%, 0.9971 54.2%, 1.0026 58.3%, 1.0053 62.5%,
         1.0062 66.7%, 1.0061 70.8%, 1.0055 75%, 1.0046 79.2%, 1.0037 83.3%,
         1.0028 87.5%, 1.0021 91.7%, 1.0015 95.8%, 1)

anim.bouncy.css   →  duration 0.819s   (peak ≈1.046 overshoot)
  linear(0, 0.0749 4.2%, 0.2420 8.3%, 0.4368 12.5%, 0.6204 16.7%, 0.7728 20.8%,
         0.8874 25%, 0.9656 29.2%, 1.0131 33.3%, 1.0375 37.5%, 1.0457 41.7%,
         1.0440 45.8%, 1.0371 50%, 1.0282 54.2%, 1.0195 58.3%, 1.0121 62.5%,
         1.0064 66.7%, 1.0024 70.8%, 0.9998 75%, 0.9985 79.2%, 0.9979 83.3%,
         0.9979 87.5%, 0.9982 91.7%, 0.9986 95.8%, 1)
```

**Fallback cubic-bezier (DESIGNED, when `linear()` unsupported):** monotone springs only — `smooth ≈ cubic-bezier(0.33, 0, 0.13, 1)`. Overshooting springs (snappy/bouncy) cannot be a single cubic-bezier; degrade to `cubic-bezier(0.34, 1.3, 0.64, 1)` (snappy-ish) / `cubic-bezier(0.34, 1.56, 0.64, 1)` (bouncy-ish, the classic "back" overshoot) — visually close, not exact.

---

## 2. `.default` animation — `anim.default`

- **KNOWN:** `Animation.default` exists as `public static let` (line 1400); its literal is baked in the dylib (opaque in swiftinterface).
- **INFERRED (Apple docs / WWDC23):** on iOS 17+/macOS 14+, `.default` **is a spring** — equivalent to `.smooth` (`spring(duration: 0.5, bounce: 0)`, ζ=1). Pre-iOS17 it was `easeInOut(duration: 0.35)`. This is the single most important behavioral change: implicit `withAnimation { }` with no arg now springs.
- **Web mapping (DESIGNED):** `anim.default.css = anim.smooth.css` (duration 0.735 s, smooth `linear()` table). Provide a build flag to switch to the legacy `easeInOut 0.35s` for "iOS 16 compatibility" mode.

---

## 3. Legacy timing curves — `anim.easeInOut / easeIn / easeOut / linear`

- **KNOWN (swiftinterface lines 14709–14726):** all four exist as `func(duration:)` + zero-arg `var`. The `timingCurve(p1x,p1y,p2x,p2y, duration:)` overload has **`duration: TimeInterval = 0.35`** baked as the default — this fixes the legacy default duration at **0.35 s** for the whole easing family. Modern `UnitCurve` presets (`easeInOut/easeIn/easeOut/linear/circularEaseIn/Out/InOut`, lines 2925–2935) carry the curve shape (control points baked in dylib, opaque in swiftinterface).
- **INFERRED:** SwiftUI's ease curves are the CoreAnimation / CSS-standard cubic-beziers (identical to `CAMediaTimingFunction` named curves and the CSS `ease-*` keywords). Control points below are the industry-standard values.

| token | cubic-bezier (p1x,p1y,p2x,p2y) | default duration | CSS keyword |
|---|---|---|---|
| `anim.easeInOut` | `0.42, 0, 0.58, 1` | 0.35 s | `ease-in-out` |
| `anim.easeIn` | `0.42, 0, 1, 1` | 0.35 s | `ease-in` |
| `anim.easeOut` | `0, 0, 0.58, 1` | 0.35 s | `ease-out` |
| `anim.linear` | `0, 0, 1, 1` | 0.35 s | `linear` |

> Note: CSS's `ease` keyword (`0.25,0.1,0.25,1`) is **not** SwiftUI's default — SwiftUI's default is `ease-in-out` (`0.42,0,0.58,1`) at 0.35 s, or a spring on iOS17+. Don't use the CSS `ease` keyword.

Modern circular UnitCurve presets (iOS17+, used only via `timingCurve(_:duration:)`), **INFERRED** approximations:

| token | meaning | cubic-bezier approx |
|---|---|---|
| `anim.circularEaseIn` | quarter-circle ease in | `0.55, 0, 1, 0.45` |
| `anim.circularEaseOut` | quarter-circle ease out | `0, 0.55, 0.45, 1` |
| `anim.circularEaseInOut` | S of two quarter-circles | `0.85, 0, 0.15, 1` |

**Web mapping (DESIGNED):** `transition: <prop> 0.35s cubic-bezier(<p1x>,<p1y>,<p2x>,<p2y>)`. CSS y-values for ease can go outside [0,1] only for over/undershoot curves; the ease family stays in-range so plain `transition` works.

---

## 4. `interactiveSpring` & `interpolatingSpring`

### 4a. `interactiveSpring` — `anim.interactiveSpring`

Two overloads, both **KNOWN verbatim**:

```swift
// line 13101 — response/dampingFraction form (the canonical one)
interactiveSpring(response: 0.15, dampingFraction: 0.86, blendDuration: 0.25)
// line 13105 — duration/bounce form, delegates to spring(): bounce = 0.15 + extraBounce
interactiveSpring(duration: 0.15, extraBounce: 0.0, blendDuration: 0.25)
   = spring(duration: 0.15, bounce: 0.15, blendDuration: 0.25)
```

The two forms describe (almost) the same spring: response 0.15, ζ ≈ 0.85–0.86. It is a **fast, lightly-damped** spring tuned for gesture-tracking (`blendDuration 0.25` lets it re-blend when the gesture value changes mid-flight). Derived (response 0.15, ζ 0.86): `k = (2π/0.15)² = 1754.60`, `c = 2√k·0.86 = 72.05`, settling T ≈ 0.21 s.

```
anim.interactiveSpring.css → duration 0.21s
  linear(0, 0.0752 5%, 0.2340 10%, 0.4108 15%, 0.5725 20%, 0.7054 25%, 0.8072 30%,
         0.8807 35%, 0.9311 40%, 0.9640 45%, 0.9842 50%, 0.9958 55%, 1.0018 60%,
         1.0044 65%, 1.0050 70%, 1.0046 75%, 1.0038 80%, 1.0030 85%, 1.0021 90%,
         1.0015 95%, 1)
```

### 4b. `interpolatingSpring` — `anim.interpolatingSpring`

**KNOWN verbatim** (lines 10809–10817). Unlike the others, `interpolatingSpring` is **velocity-preserving / additive**: a new interpolatingSpring started mid-animation inherits the current velocity (no `blendDuration`; it has `initialVelocity` instead). Two overloads:

```swift
interpolatingSpring(mass: 1.0, stiffness:, damping:, initialVelocity: 0.0)        // raw physics
interpolatingSpring(duration: 0.5, bounce: 0.0, initialVelocity: 0.0) {            // duration/bounce
    let stiffness = springStiffness(response: duration)         // (2π/dur)²
    let fraction  = springDampingFraction(bounce: bounce)       // 1 − bounce
    let damping   = springDamping(fraction:, stiffness:)        // 2√k·ζ
    return interpolatingSpring(stiffness:, damping:, initialVelocity:)
}
```

Default `interpolatingSpring` (`duration 0.5, bounce 0`): identical k/c to `smooth` (k 157.91, c 25.13). Difference is **runtime semantics** (velocity carry-over), not the curve — its CSS curve equals `anim.smooth.css`. On the web, the "velocity-preserving" property is only reproducible with a JS spring (e.g. re-seeding velocity); the `linear()` table is the no-initial-velocity case.

> **Spring family summary:** `smooth/snappy/bouncy/spring/interactiveSpring` are **blendable** (re-target smoothly via `blendDuration`); `interpolatingSpring` is **additive** (carries velocity). Same ODE, different re-targeting behavior.

### 4c. `.spring()` default — `anim.spring`

**KNOWN (line 13097):** `spring(response: 0.5, dampingFraction: 0.825, blendDuration: 0)`.
- `response = 0.5` in this macOS SDK. **DELTA / historical:** the original iOS `.spring()` shipped `response = 0.55`; current SDK symbol is `0.5`. Record `0.5` as the live value, `0.55` as the legacy note.
- Derived: k = 157.91, ζ = 0.825, c = 20.73, settling T ≈ 0.689 s.

```
anim.spring.css → duration 0.689s   (peak ≈1.010 overshoot)
  linear(0, 0.0738 5%, 0.2320 10%, 0.4108 15%, 0.5760 20%, 0.7128 25%, 0.8176 30%,
         0.8930 35%, 0.9440 40%, 0.9763 45%, 0.9953 50%, 1.0052 55%, 1.0094 60%,
         1.0102 65%, 1.0092 70%, 1.0075 75%, 1.0057 80%, 1.0041 85%, 1.0027 90%,
         1.0017 95%, 1)
```

---

## 5. Transition presets — `anim.transition.*`

**KNOWN (swiftinterface):** the presets exist with these signatures. The `.body` of each `Transition` struct is opaque (`@_opaqueReturnTypeOf`, baked in dylib), so the *visual effect* is **INFERRED** from Apple docs; the *defaults / enum cases* are KNOWN.

| token | swift API | KNOWN default | effect (INFERRED) | Web mapping (DESIGNED) |
|---|---|---|---|---|
| `transition.opacity` | `OpacityTransition` / `.opacity` | — | fade 0↔1 | `opacity: 0 → 1` |
| `transition.slide` | `SlideTransition` / `.slide` | — | insert from **leading**, remove to **trailing** (asymmetric `move(.leading)`/`move(.trailing)`) | `translateX(-100% → 0)` in, `0 → +100%` out |
| `transition.scale` | `.scale` (zero-arg) | scale **0** | scale 0↔1 from `.center` | `scale(0 → 1)`, `transform-origin: center` |
| `transition.scaleValue` | `ScaleTransition(_ scale, anchor: .center)` | anchor `.center` | scale `s`↔1 about anchor | `scale(s → 1)`, origin = anchor |
| `transition.move` | `.move(edge:)` → `MoveTransition` | — | slide fully off the given `Edge` | `translate` 100% toward edge |
| `transition.offset` | `.offset(x:y:)` | x 0, y 0 | translate by CGSize | `translate(x, y)` |
| `transition.push` | `.push(from: Edge)` → `PushTransition` | — | new content pushes in from edge while old pushes out opposite (paired move+fade) | two-layer `translate` + `opacity` |
| `transition.blurReplace` | `BlurReplaceTransition` | config `.downUp` (also `.upUp`) | cross-fade + Gaussian blur + slight scale; iOS17+ | `opacity` + `filter: blur()` + `scale`, see §5a |
| `transition.identity` | `IdentityTransition` / `.identity` | — | no change (no animation) | none |
| `transition.asymmetric` | `.asymmetric(insertion:, removal:)` | — | different transition for insert vs remove | separate in/out keyframes |

**Default transition** when you write `.transition(...)` with nothing, or when a view appears/disappears with an animation but no explicit transition: **`.opacity`** (INFERRED — Apple's documented default insertion/removal transition is a fade).

### 5a. `blurReplace` detail (iOS17+)

`BlurReplaceTransition.Configuration` cases: `.downUp` (default) and `.upUp` (both KNOWN, lines 18160–18161). The effect blurs the outgoing view to transparency while the incoming view un-blurs in, with a small vertical offset (`downUp` = outgoing moves down / incoming comes up; `upUp` = both move up). **Web (DESIGNED):**

```
out: opacity 1→0, filter blur(0→6px), translateY(0→ +6px)   [downUp]
in:  opacity 0→1, filter blur(8px→0), translateY(-6px→0)
```

Pair with `anim.smooth` timing. This is an iOS17 canonical effect, not Liquid-Glass-specific.

### 5b. Transition timing

A transition has **no intrinsic duration** — it inherits the animation in scope (the `withAnimation`/`.animation` driving the state change). So `transition.*` tokens are *property sets*; the timing comes from §1–4. Default pairing: `.opacity`/`.scale` + `.default` (= `.smooth` spring on iOS17+). Provide `transition.defaultTiming = anim.smooth`.

---

## 6. matchedGeometryEffect — `anim.matchedGeometry`

**KNOWN (swiftinterface line ~2988):**
```swift
func matchedGeometryEffect<ID>(id:, in namespace:,
    properties: MatchedGeometryProperties = .frame,   // default .frame (position+size)
    anchor: UnitPoint = .center,
    isSource: Bool = true)
```
- `properties` default = `.frame` (= `.position ∪ .size`). `anchor` default = `.center`. `isSource` default = `true`. All KNOWN.
- **Timing (INFERRED):** matchedGeometry has **no own animation**; it interpolates frame/position/size using whatever animation is in scope at the moment the matched pair swaps (the enclosing `withAnimation`). With no explicit animation it uses `.default` (= `.smooth` spring iOS17+).
- **Web mapping (DESIGNED):** this is the FLIP technique. Measure source rect → measure dest rect → on swap, set the dest element's `transform` to the inverse (translate+scale to overlay the source), then animate `transform → none` with `anim.smooth.css` about `transform-origin: center` (the anchor). `properties=.frame` ⇒ animate both translate and scale; `.position` ⇒ translate only; `.size` ⇒ scale/width-height only.

---

## 7. iOS 26 "Liquid Glass" deltas (labeled, NOT substituted)

- Many of these symbols carry a **second** `@_originallyDefinedIn(... iOS 26.0)` annotation (e.g. `ScaleTransition`, `contentShape`, `UnitCurve.timingCurve`), meaning the API moved to a new module in iOS26 but the **values are unchanged** — the canonical spring/curve tokens above hold on iOS 26.
- New in iOS26: `GlassEffectTransition` (`.identity` + matched-glass morph), `Glass.identity`, `onOpenURL(prefersInApp:)`. The glass morph uses a spring close to `.smooth`/`.snappy` but adds a refractive blur+highlight pass — **not** part of the canonical motion tokens. Record as `anim.glass.*` only if/when building the Liquid Glass theme; do **not** let it overwrite `anim.smooth/snappy/bouncy`.

---

## 8. Web mapping cheat-sheet (how each token compiles)

```css
/* spring presets — settling-time duration + linear() */
.smooth   { animation-duration: .735s; animation-timing-function: var(--sui-anim-smooth-css); }
.snappy   { animation-duration: .697s; animation-timing-function: var(--sui-anim-snappy-css); }
.bouncy   { animation-duration: .819s; animation-timing-function: var(--sui-anim-bouncy-css); }
/* legacy curves — fixed 0.35s + cubic-bezier */
.easeInOut { transition-timing-function: cubic-bezier(.42,0,.58,1); transition-duration:.35s; }
.easeIn    { transition-timing-function: cubic-bezier(.42,0,1,1);   transition-duration:.35s; }
.easeOut   { transition-timing-function: cubic-bezier(0,0,.58,1);   transition-duration:.35s; }
.linear    { transition-timing-function: linear;                    transition-duration:.35s; }
```

Rules:
1. **Spring → `linear()`**, duration = settling T (NOT the 0.5 param). Overshoot points (>1) preserved.
2. **Curve → `cubic-bezier()`**, duration = 0.35 s default.
3. **`.default`** = `.smooth` on iOS17+ (spring), `.easeInOut 0.35s` in compat mode.
4. Transitions are property-sets; timing comes from the spring/curve in scope.
5. Respect `prefers-reduced-motion`: collapse all springs to `opacity` cross-fade ≤ 0.2 s.

---

## Source-label ledger

- **KNOWN (swiftinterface verbatim):** all spring preset bounce offsets (0/0.15/0.30), duration 0.5; the three conversion functions; `spring(response:0.5, dampingFraction:0.825)`; `interactiveSpring(response:0.15, dampingFraction:0.86, blendDuration:0.25)` and its 0.15/0.15/0.25 duration-form; `interpolatingSpring` duration 0.5/bounce 0; `timingCurve` default duration 0.35; transition signatures + defaults (`scale 0`, `anchor .center`, blurReplace `.downUp`, matchedGeometry `.frame`/`.center`/`isSource true`).
- **KNOWN (derived by formula from the above):** every k / c / ζ value in the tables (pure arithmetic on the verbatim formulas).
- **INFERRED:** legacy cubic-bezier control points (= CoreAnimation/CSS standard); circular UnitCurve approximations; transition *visual* semantics (bodies opaque); `.default` = smooth spring on iOS17+; default transition = opacity; matchedGeometry uses in-scope animation.
- **DESIGNED:** all `linear()` tables (numerically integrated unit-step responses, mass 1), settling-duration choices, cubic-bezier fallbacks for springs, blurReplace web recipe, FLIP recipe for matchedGeometry, reduced-motion policy.
