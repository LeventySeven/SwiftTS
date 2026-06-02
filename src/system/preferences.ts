"use client";
/* =============================================================================
 * preferences.ts — SwiftUI's PreferenceKey system, ported to React.
 *
 * SwiftUI authoritative API (SwiftUICore.swiftinterface:17541):
 *   protocol PreferenceKey {
 *     associatedtype Value
 *     static var defaultValue: Value { get }
 *     static func reduce(value: inout Value, nextValue: () -> Value)
 *   }
 *   View.preference(key:value:)        — a leaf publishes a value up the tree
 *   View.transformPreference(key:_:)   — transform the bubbling value
 *   View.onPreferenceChange(key:_:)    — an ancestor observes the reduced value
 *   View.anchorPreference(key:value:transform:) — bubble a geometry Anchor
 *   View.backgroundPreferenceValue / overlayPreferenceValue — read it for layout
 *
 * The hard part this models.
 *   SwiftUI preferences flow UP the view tree (child → ancestor), the OPPOSITE of
 *   `@Environment` (which flows down). React context only flows DOWN, so we invert
 *   it with a REGISTRATION CONTEXT: an ancestor reader publishes (via context) a
 *   `register(value)` function; every descendant writer calls it to register its
 *   value and gets a `deregister`. The reader keeps the live ordered list of all
 *   descendant values and folds them with the key's `reduce` into one combined
 *   value — exactly SwiftUI's `reduce(value:nextValue:)` fold over siblings.
 *
 *   Ordering matters (reduce is not always commutative — e.g. "first non-nil",
 *   "concatenate"), so writers register with a monotonically increasing sequence
 *   and the reader folds them in registration order. SwiftUI folds in tree (pre-)
 *   order; registration order under React's mount order is the closest stable
 *   analog and matches for the common top-to-bottom layouts.
 *
 * The pieces.
 *   makePreferenceKey(defaultValue, reduce)  — the PreferenceKey definition.
 *   <PreferenceReader key>                   — the up-tree collector + provider
 *                                              (what onPreferenceChange installs).
 *   usePreference(key)                        — read the reduced value at a reader.
 *   <PreferenceWriter key value>             — `.preference(key:value:)` leaf.
 *   usePreferenceValue(key, value)            — the hook form of PreferenceWriter.
 *   useOnPreferenceChange(key, action)        — `.onPreferenceChange` callback.
 *   useAnchorPreference / <AnchorPreferenceWriter> — bubble an element's frame.
 *
 * SSR-safe: registration happens in effects (client only); reading falls back to
 * the key's default on the server. "use client".
 * ========================================================================== */
import * as React from "react";

/* =============================================================================
 * 1. PreferenceKey — the definition (default + reduce)
 * ========================================================================== */

/**
 * A `PreferenceKey` definition. `defaultValue` is the value when no descendant
 * writes; `reduce(value, nextValue)` folds each descendant's value into the
 * accumulator, mirroring SwiftUI's `static func reduce(value:nextValue:)`. The
 * `__brand` carries the value type so `usePreference` infers it.
 */
export interface PreferenceKey<Value> {
  /** Stable identity used to scope the registration context. */
  readonly id: symbol;
  /** Human label for debugging / `data-` attributes. */
  readonly name: string;
  /** The value when no descendant publishes one. */
  readonly defaultValue: Value;
  /**
   * Fold a descendant value into the accumulator. `value` is the running result
   * (starts at `defaultValue`); `nextValue()` lazily yields the next descendant's
   * value. Mutate `value.current` to combine (SwiftUI's `inout` semantics).
   */
  readonly reduce: (value: { current: Value }, nextValue: () => Value) => void;
  /** phantom — carries `Value` for inference. */
  readonly __value?: Value;
}

let preferenceKeySeq = 0;

/**
 * Define a `PreferenceKey`. `reduce` defaults to "last writer wins" (the common
 * single-writer case). For "first non-nil" / "max" / "concatenate" semantics,
 * supply your own — it receives the accumulator box and a lazy next-value getter,
 * exactly like SwiftUI's `reduce(value: inout Value, nextValue: () -> Value)`.
 *
 * @param defaultValue  the value when nothing publishes.
 * @param reduce        fold a descendant value into the accumulator (default: overwrite).
 * @param name          optional debug label.
 */
export function makePreferenceKey<Value>(
  defaultValue: Value,
  reduce: (value: { current: Value }, nextValue: () => Value) => void = (v, next) => {
    v.current = next();
  },
  name: string = `PreferenceKey#${++preferenceKeySeq}`,
): PreferenceKey<Value> {
  return { id: Symbol(name), name, defaultValue, reduce };
}

/* =============================================================================
 * 2. Registration context — the inverted (up-tree) channel
 * ========================================================================== */

/** One descendant's live registration with the nearest ancestor reader. */
interface Registration<Value> {
  seq: number;
  value: Value;
}

/** What a reader publishes downward so descendants can register their values. */
interface ReaderChannel<Value> {
  register(initial: Value): {
    update(value: Value): void;
    deregister(): void;
  };
}

/**
 * A per-key map of channels. We can't make a generic React context keyed by a
 * runtime symbol, so we keep ONE context whose value is a `Map<symbol, channel>`;
 * each reader installs its channel under its key's id, shadowing any outer reader
 * for the same key (nearest-ancestor wins, matching SwiftUI).
 */
type ChannelMap = Map<symbol, ReaderChannel<unknown>>;

const PreferenceChannelContext = React.createContext<ChannelMap>(new Map());

/* =============================================================================
 * 3. PreferenceReader — the up-tree collector (installs onPreferenceChange)
 * ========================================================================== */

/** Fold an ordered list of descendant values with the key's `reduce`. */
function foldPreference<Value>(
  key: PreferenceKey<Value>,
  regs: ReadonlyArray<Registration<Value>>,
): Value {
  const box = { current: key.defaultValue };
  for (const r of regs) {
    key.reduce(box, () => r.value);
  }
  return box.current;
}

export interface PreferenceReaderProps<Value> {
  /** The key to collect. */
  preferenceKey: PreferenceKey<Value>;
  /** Fired (after commit) whenever the reduced value changes (`.onPreferenceChange`). */
  onChange?: (value: Value) => void;
  /** Render-prop form: receive the live reduced value. */
  children?: React.ReactNode | ((value: Value) => React.ReactNode);
}

/**
 * Installs an ancestor collector for `preferenceKey`: every descendant
 * `PreferenceWriter`/`usePreferenceValue` for the SAME key registers here, and the
 * reader folds them with `reduce` into one value, exposed to descendants via
 * `usePreference(key)` and to `onChange` (the `.onPreferenceChange` callback).
 *
 * The reader RE-PUBLISHES the parent channel map with its own channel layered on
 * top, so nested readers for different keys coexist and a nested reader for the
 * SAME key shadows this one for its subtree (nearest-ancestor wins).
 */
export function PreferenceReader<Value>({
  preferenceKey,
  onChange,
  children,
}: PreferenceReaderProps<Value>): React.ReactElement {
  const parentMap = React.useContext(PreferenceChannelContext);
  const [reduced, setReduced] = React.useState<Value>(preferenceKey.defaultValue);

  // Live registrations, keyed by seq. A ref (not state) so register/update from a
  // child effect doesn't tear during render; we recompute + setState on each change.
  const regsRef = React.useRef(new Map<number, Registration<Value>>());
  const seqRef = React.useRef(0);
  const reducedRef = React.useRef<Value>(preferenceKey.defaultValue);

  const recompute = React.useCallback(() => {
    const ordered = Array.from(regsRef.current.values()).sort((a, b) => a.seq - b.seq);
    const next = foldPreference(preferenceKey, ordered);
    if (!Object.is(next, reducedRef.current)) {
      reducedRef.current = next;
      setReduced(next);
    }
  }, [preferenceKey]);

  const channel = React.useMemo<ReaderChannel<Value>>(
    () => ({
      register(initial: Value) {
        const seq = ++seqRef.current;
        regsRef.current.set(seq, { seq, value: initial });
        // Defer the recompute out of the child's commit phase.
        queueMicrotask(recompute);
        return {
          update(value: Value) {
            const r = regsRef.current.get(seq);
            if (r && !Object.is(r.value, value)) {
              r.value = value;
              queueMicrotask(recompute);
            }
          },
          deregister() {
            regsRef.current.delete(seq);
            queueMicrotask(recompute);
          },
        };
      },
    }),
    [recompute],
  );

  // Layer this channel onto the parent map under the key's id.
  const childMap = React.useMemo<ChannelMap>(() => {
    const m = new Map(parentMap);
    m.set(preferenceKey.id, channel as ReaderChannel<unknown>);
    return m;
  }, [parentMap, preferenceKey.id, channel]);

  // `.onPreferenceChange` — fire after the reduced value commits.
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  React.useEffect(() => {
    onChangeRef.current?.(reduced);
  }, [reduced]);

  const content =
    typeof children === "function"
      ? (children as (value: Value) => React.ReactNode)(reduced)
      : children;

  return React.createElement(PreferenceChannelContext.Provider, { value: childMap }, content);
}

/* =============================================================================
 * 4. usePreference — read the reduced value at/under a reader
 * ========================================================================== */

/** A small context so a reader can also expose its reduced value to `usePreference`. */
const PreferenceValueContext = React.createContext<Map<symbol, unknown>>(new Map());

/**
 * Read the reduced value of `key` as collected by the nearest ancestor
 * `PreferenceReader`. Outside any reader (or before children register) it returns
 * the key's `defaultValue`. This is the value `.onPreferenceChange` would observe.
 *
 * NOTE: to keep React's render purity, the canonical live value is what the
 * nearest `PreferenceReader` holds — use the reader's render-prop or `onChange`
 * for the authoritative value; `usePreference` reads the last committed snapshot.
 */
export function usePreference<Value>(key: PreferenceKey<Value>): Value {
  const map = React.useContext(PreferenceValueContext);
  return (map.has(key.id) ? (map.get(key.id) as Value) : key.defaultValue);
}

/* =============================================================================
 * 5. PreferenceWriter / usePreferenceValue — `.preference(key:value:)`
 * ========================================================================== */

/**
 * `.preference(key:value:)` as a hook. Registers `value` with the nearest
 * ancestor `PreferenceReader` for `key`, updating it on change and deregistering
 * on unmount. The leaf side of the up-tree flow.
 *
 * @param key    the PreferenceKey.
 * @param value  this leaf's contribution; folded with siblings via `key.reduce`.
 */
export function usePreferenceValue<Value>(key: PreferenceKey<Value>, value: Value): void {
  const map = React.useContext(PreferenceChannelContext);
  const channel = map.get(key.id) as ReaderChannel<Value> | undefined;

  // Hold the handle across renders; (re)register only when the reader channel changes.
  const handleRef = React.useRef<{ update(v: Value): void; deregister(): void } | null>(null);

  React.useEffect(() => {
    if (!channel) {
      handleRef.current = null;
      return;
    }
    const handle = channel.register(value);
    handleRef.current = handle;
    return () => {
      handle.deregister();
      handleRef.current = null;
    };
    // Re-register if the ancestor reader changes; value updates go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  // Push value changes without re-registering.
  React.useEffect(() => {
    handleRef.current?.update(value);
  }, [value]);
}

export interface PreferenceWriterProps<Value> {
  /** The key to publish under. */
  preferenceKey: PreferenceKey<Value>;
  /** This leaf's value. */
  value: Value;
  /** Optional children (the writer adds no DOM node). */
  children?: React.ReactNode;
}

/**
 * `.preference(key:value:)` as a component. Publishes `value` up to the nearest
 * `PreferenceReader` for `preferenceKey`, then renders `children` unchanged.
 */
export function PreferenceWriter<Value>({
  preferenceKey,
  value,
  children,
}: PreferenceWriterProps<Value>): React.ReactElement {
  usePreferenceValue(preferenceKey, value);
  return React.createElement(React.Fragment, null, children);
}

/* =============================================================================
 * 6. useOnPreferenceChange — `.onPreferenceChange(key:_:)` standalone hook
 * ========================================================================== */

/**
 * The hook form of `.onPreferenceChange`, for when you'd rather not nest a
 * `<PreferenceReader>`. Internally it still needs a reader to collect from, so it
 * returns the `<PreferenceReader>` you wrap your subtree in PLUS wires the
 * callback — call it like:
 *
 *   const Reader = useOnPreferenceChange(MyKey, v => setX(v));
 *   return <Reader>{subtree}</Reader>;
 *
 * (SwiftUI fuses collection + callback into one modifier; on the web the collector
 * must wrap the subtree, so we hand you the wrapper.)
 */
export function useOnPreferenceChange<Value>(
  key: PreferenceKey<Value>,
  action: (value: Value) => void,
): React.FC<{ children?: React.ReactNode }> {
  const actionRef = React.useRef(action);
  actionRef.current = action;
  return React.useMemo(() => {
    const Wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
      React.createElement(
        PreferenceReader<Value>,
        { preferenceKey: key, onChange: (v) => actionRef.current(v) },
        children,
      );
    Wrapper.displayName = `OnPreferenceChange(${key.name})`;
    return Wrapper;
  }, [key]);
}

/* =============================================================================
 * 7. anchorPreference — bubble a geometry anchor up the tree
 * ========================================================================== */

/** The geometry an `.anchorPreference` bubbles — an element's frame in a chosen space. */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** Read an element's `AnchorRect` (page coordinates). */
function readAnchorRect(el: HTMLElement): AnchorRect {
  const r = el.getBoundingClientRect();
  const sx = typeof window !== "undefined" ? window.scrollX : 0;
  const sy = typeof window !== "undefined" ? window.scrollY : 0;
  return {
    x: r.left + sx,
    y: r.top + sy,
    width: r.width,
    height: r.height,
    top: r.top + sy,
    left: r.left + sx,
    right: r.right + sx,
    bottom: r.bottom + sy,
  };
}

/**
 * `.anchorPreference(key:value:transform:)` as a hook. Measures the element at
 * `ref` (its `AnchorRect`), maps it through `transform`, and publishes the result
 * up to the nearest `PreferenceReader` for `key` — re-measuring on resize/scroll.
 * The ancestor (e.g. an overlay) reads the reduced anchors to position chrome
 * relative to descendants, exactly like SwiftUI's `overlayPreferenceValue`.
 *
 * @param ref        the measured element.
 * @param key        the PreferenceKey to publish under.
 * @param transform  map the element's AnchorRect to the published value.
 */
export function useAnchorPreference<Value>(
  ref: React.RefObject<HTMLElement | null>,
  key: PreferenceKey<Value>,
  transform: (anchor: AnchorRect) => Value,
): void {
  const map = React.useContext(PreferenceChannelContext);
  const channel = map.get(key.id) as ReaderChannel<Value> | undefined;
  const transformRef = React.useRef(transform);
  transformRef.current = transform;

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !channel) return;
    const initial = transformRef.current(readAnchorRect(el));
    const handle = channel.register(initial);

    const measure = () => handle.update(transformRef.current(readAnchorRect(el)));

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("scroll", measure, { passive: true });
      window.addEventListener("resize", measure);
    }
    measure();

    return () => {
      handle.deregister();
      ro?.disconnect();
      if (typeof window !== "undefined") {
        window.removeEventListener("scroll", measure);
        window.removeEventListener("resize", measure);
      }
    };
  }, [ref, channel]);
}
