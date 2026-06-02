"use client";
/**
 * SwiftUI view-lifecycle modifiers, ported to React hooks.
 *
 * Spec: teardowns/SWIFTUI_C16_environment-state.md (the reactive-graph runtime
 * §7M is "replaced wholesale by React" — these hooks ARE that replacement: they
 * map SwiftUI's `.onAppear` / `.onDisappear` / `.onChange(of:)` / `.task` onto
 * React's effect model with the exact SwiftUI semantics, not React's defaults.
 *
 * The mapping (and where it deliberately differs from a naive `useEffect`):
 *
 *   SwiftUI                         React equivalent (these hooks)
 *   ---------------------------------------------------------------------------
 *   .onAppear { … }                 useOnAppear(fn)  — fires ONCE on mount.
 *                                   (NOT every render. SwiftUI's onAppear runs
 *                                   when the view enters the hierarchy, not on
 *                                   every body recompute.)
 *   .onDisappear { … }              useOnDisappear(fn) — runs on unmount.
 *   .onChange(of: v) { old,new }    useOnChange(v, fn) — fires when `v` changes
 *                                   to a NEW value; does NOT fire on first
 *                                   appear (matches the iOS 17 two-param form).
 *   .task { await … }               useTask(fn, deps) — async work tied to the
 *                                   view's lifetime; CANCELLED (AbortController
 *                                   .abort()) on disappear or when `deps` change,
 *                                   exactly like SwiftUI cancels the task when
 *                                   the view leaves or `id:` changes.
 *
 * SSR note: every hook is a no-op until mount (effects don't run on the server),
 * so importing this file is SSR-safe. The `"use client"` directive marks the
 * module as client-only for the React Server Components boundary.
 */
import * as React from "react";

/* =============================================================================
 * useOnAppear — `.onAppear { … }`
 * ========================================================================== */

/**
 * Fires `fn` exactly ONCE, when the view appears (mounts). Subsequent renders do
 * NOT re-run it — this is the key difference from a bare `useEffect(fn)` with a
 * changing closure. The latest `fn` is captured via a ref so the callback can
 * close over fresh props/state without re-firing.
 *
 * SwiftUI `.onAppear` can technically fire again if a view leaves and re-enters
 * the hierarchy; in React that is a remount, which naturally re-runs this hook.
 */
export function useOnAppear(fn: () => void): void {
  const fnRef = React.useRef(fn);
  fnRef.current = fn;
  React.useEffect(() => {
    fnRef.current();
    // empty deps → mount-only, matching `.onAppear`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* =============================================================================
 * useOnDisappear — `.onDisappear { … }`
 * ========================================================================== */

/**
 * Runs `fn` once when the view disappears (unmounts). The latest `fn` is held in
 * a ref so the cleanup sees the final closure, not the one from first render.
 */
export function useOnDisappear(fn: () => void): void {
  const fnRef = React.useRef(fn);
  fnRef.current = fn;
  React.useEffect(() => {
    return () => {
      fnRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* =============================================================================
 * useOnChange — `.onChange(of: value) { oldValue, newValue in … }`
 * ========================================================================== */

export interface OnChangeOptions {
  /**
   * SwiftUI's `initial:` parameter. When `true`, `fn` ALSO fires once on the
   * first appear, with `oldValue === newValue`. Default `false` (the iOS 17
   * two-param default — fire only on subsequent changes).
   */
  initial?: boolean;
}

/**
 * Calls `fn(oldValue, newValue)` whenever `value` changes to a new value.
 *
 * Matches SwiftUI's `.onChange(of:)`:
 *   - does NOT fire on first appear (unless `{ initial: true }`),
 *   - compares by `Object.is` (the JS analog of SwiftUI's `Equatable`),
 *   - passes BOTH the previous and the next value to the closure.
 *
 * The effect depends only on `value`, so `fn` may close over other state freely
 * (held in a ref) without spuriously re-firing.
 */
export function useOnChange<T>(
  value: T,
  fn: (oldValue: T, newValue: T) => void,
  options?: OnChangeOptions,
): void {
  const fnRef = React.useRef(fn);
  fnRef.current = fn;
  const prevRef = React.useRef<T>(value);
  const isFirstRef = React.useRef(true);

  React.useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      if (options?.initial) {
        // SwiftUI `initial:true` → fire once with (value, value)
        fnRef.current(value, value);
      }
      prevRef.current = value;
      return;
    }
    const prev = prevRef.current;
    if (!Object.is(prev, value)) {
      fnRef.current(prev, value);
      prevRef.current = value;
    }
    // depend only on `value`; `options.initial` is read once on first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}

/* =============================================================================
 * useTask — `.task { await … }` and `.task(id:) { await … }`
 * ========================================================================== */

/**
 * Runs an async `fn` when the view appears, and AUTOMATICALLY CANCELS it (via an
 * `AbortController`) when the view disappears or when `deps` change — exactly
 * like SwiftUI's `.task` / `.task(id:)`, which ties the task to the view's
 * lifetime and restarts it when the `id` changes.
 *
 * `fn` receives an `AbortSignal`; pass it to `fetch`/streams and check
 * `signal.aborted` (or listen for the `abort` event) at suspension points, the
 * way SwiftUI code checks `Task.isCancelled` / `try Task.checkCancellation()`.
 *
 * The returned promise's rejection is swallowed IF it is an abort (a normal
 * cancellation, like SwiftUI's `CancellationError`); any other rejection is
 * re-thrown to the console so real errors aren't hidden.
 *
 * @param fn    async work; gets the lifetime `AbortSignal`.
 * @param deps  the `.task(id:)` identity — re-runs (after cancelling the prior
 *              run) when any dep changes. Omit/`[]` for run-once-on-appear.
 */
export function useTask(
  fn: (signal: AbortSignal) => void | Promise<void>,
  deps: React.DependencyList = [],
): void {
  const fnRef = React.useRef(fn);
  fnRef.current = fn;

  React.useEffect(() => {
    const controller = new AbortController();
    const result = fnRef.current(controller.signal);
    if (result && typeof (result as Promise<void>).then === "function") {
      (result as Promise<void>).catch((err: unknown) => {
        // a cancellation is expected (SwiftUI's CancellationError) — swallow it.
        if (controller.signal.aborted) return;
        if (isAbortError(err)) return;
        // surface genuine errors; don't let the task fail silently.
        // eslint-disable-next-line no-console
        console.error("[useTask] unhandled task error:", err);
      });
    }
    return () => {
      controller.abort();
    };
    // re-run when the `.task(id:)` identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** True for the standard DOMException thrown by aborted `fetch`/abortable APIs. */
function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: string }).name === "AbortError"
  );
}

/* =============================================================================
 * Wrapper components — declarative `.onAppear` / `.onDisappear` / `.task`
 *
 * Some call sites can't add a hook (they're rendering children, not authoring a
 * component). These thin wrappers attach the lifecycle to their own mount so you
 * can write `<OnAppear onAppear={…}>{children}</OnAppear>` JSX-style, mirroring
 * the SwiftUI modifier reading.
 * ========================================================================== */

export interface OnAppearProps {
  /** Fires once when this subtree appears (mounts). */
  onAppear?: () => void;
  /** Fires once when this subtree disappears (unmounts). */
  onDisappear?: () => void;
  children?: React.ReactNode;
}

/**
 * Declarative `.onAppear` / `.onDisappear`. Renders children inside a
 * `React.Fragment` (adds no DOM node), running the lifecycle callbacks on its
 * own mount/unmount.
 */
export function OnAppear({
  onAppear,
  onDisappear,
  children,
}: OnAppearProps): React.ReactElement {
  const appearRef = React.useRef(onAppear);
  appearRef.current = onAppear;
  const disappearRef = React.useRef(onDisappear);
  disappearRef.current = onDisappear;

  React.useEffect(() => {
    appearRef.current?.();
    return () => {
      disappearRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return React.createElement(React.Fragment, null, children);
}

export interface TaskProps {
  /** Async work tied to this subtree's lifetime; gets a lifetime AbortSignal. */
  task: (signal: AbortSignal) => void | Promise<void>;
  /** The `.task(id:)` identity — restarts the task when it changes. */
  id?: React.DependencyList;
  children?: React.ReactNode;
}

/**
 * Declarative `.task` / `.task(id:)`. Runs `task` on appear, cancels on
 * disappear or when `id` changes.
 */
export function Task({
  task,
  id = [],
  children,
}: TaskProps): React.ReactElement {
  useTask(task, id);
  return React.createElement(React.Fragment, null, children);
}
