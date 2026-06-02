"use client";
/**
 * Drag & drop — SwiftUI's `.draggable` / `.dropDestination` / `.onDrag` / `.onDrop`,
 * ported onto the HTML Drag-and-Drop API (the `draggable` attribute + `dataTransfer`).
 *
 * SwiftUI authoritative API (arm64e-apple-macos.swiftinterface):
 *   View.draggable<T>(_ payload: @autoclosure () -> T)                      (SwiftUI:23969)
 *   View.draggable<V,T>(_ payload:, @ViewBuilder preview: () -> V)          (SwiftUI:23971)
 *   View.dropDestination<T>(for:action:isTargeted:)                         (SwiftUI:2026)
 *   View.onDrag(_ data: () -> NSItemProvider, preview: () -> V)             (legacy)
 *   View.onDrop(of:isTargeted:perform:)                                     (SwiftUI:2014)
 *   enum DropOperation { cancel, copy, move, forbidden, delete, alias }     (SwiftUI:2084)
 *
 * The web mapping. SwiftUI moves a `Transferable` payload between a source and a
 * destination; the browser moves a serialized payload through `DataTransfer`.
 *   - `useDraggable({ item })` → returns spreadable props that set `draggable`
 *     and serialize `item` (JSON) into `dataTransfer` on `dragstart`. A `preview`
 *     element is set via `setDragImage`.
 *   - `useDropDestination({ onDrop, isTargeted })` → returns spreadable props
 *     that `preventDefault` over the target (so a drop is allowed), parse the
 *     payload on `drop`, and toggle the `isTargeted` callback on enter/leave.
 *   - `onDrag(item)` / `onDrop({...})` are thin builders that return the same
 *     prop bags for call sites that prefer a function form.
 *
 * Payloads are matched by a `type` string (the web stand-in for `UTType` /
 * `Transferable`): a destination only accepts a drag whose `type` is in its
 * `acceptedTypes` (or accepts all when unspecified). Type identity is also carried
 * in a custom MIME (`application/x-swiftts+<type>`) so cross-element matching
 * works even before `drop` (when `dataTransfer.getData` is restricted by spec —
 * only the *types* list is readable during `dragover`).
 *
 * SSR-safe: returns plain prop objects; no DOM access at module scope. "use client".
 */
import * as React from "react";

/* =============================================================================
 * DropOperation — `enum DropOperation` (SwiftUI:2084)
 * ========================================================================== */

/** `SwiftUI.DropOperation`. Maps onto `DataTransfer.dropEffect`. */
export type DropOperation = "copy" | "move" | "cancel" | "forbidden" | "delete" | "alias";

/** DropOperation → the browser `dropEffect` it corresponds to. */
const DROP_EFFECT: Record<DropOperation, "copy" | "move" | "link" | "none"> = {
  copy: "copy",
  move: "move",
  alias: "link",
  delete: "move",
  cancel: "none",
  forbidden: "none",
};

/** The MIME prefix that carries SwiftTS payload type identity. */
const TYPE_MIME_PREFIX = "application/x-swiftts+";
/** The MIME that carries the JSON-serialized payload. */
const PAYLOAD_MIME = "application/x-swiftts-payload+json";

/* =============================================================================
 * Serialization
 * ========================================================================== */

/** Serialize a payload into `dataTransfer` under the payload MIME + a type MIME. */
function writePayload(dt: DataTransfer, type: string, item: unknown): void {
  let json: string;
  try {
    json = JSON.stringify({ type, item });
  } catch {
    json = JSON.stringify({ type, item: String(item) });
  }
  dt.setData(PAYLOAD_MIME, json);
  // empty value: the *presence* of this MIME in dt.types is what's readable in dragover
  dt.setData(TYPE_MIME_PREFIX + type, "");
  // also mirror to text/plain so dragging into native inputs degrades gracefully
  if (typeof item === "string") dt.setData("text/plain", item);
}

interface ParsedPayload<T> {
  type: string;
  item: T;
}

/** Read the SwiftTS payload back out on `drop`. */
function readPayload<T>(dt: DataTransfer): ParsedPayload<T> | null {
  const raw = dt.getData(PAYLOAD_MIME);
  if (!raw) {
    // fall back to plain text drags from outside the app
    const text = dt.getData("text/plain");
    if (text) return { type: "public.text", item: text as unknown as T };
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ParsedPayload<T>;
    return parsed;
  } catch {
    return null;
  }
}

/** During `dragover`/`dragenter` only the MIME *list* is readable; pull the type from it. */
function peekDragType(dt: DataTransfer): string | null {
  for (const t of Array.from(dt.types)) {
    if (t.startsWith(TYPE_MIME_PREFIX)) return t.slice(TYPE_MIME_PREFIX.length);
  }
  if (Array.from(dt.types).includes("text/plain")) return "public.text";
  return null;
}

/* =============================================================================
 * useDraggable — `.draggable(_:)` / `.onDrag` (SwiftUI:23969)
 * ========================================================================== */

export interface UseDraggableOptions<T = unknown> {
  /**
   * ⇄ the `Transferable` payload (`@autoclosure () -> T`). Pass the value or a
   * thunk that produces it lazily at `dragstart`.
   */
  item: T | (() => T);
  /**
   * The payload type identifier (the web `UTType` analog). A drop destination
   * matches on this. Defaults to `"public.data"`.
   */
  type?: string;
  /**
   * ⇄ `preview: () -> V` — a DOM element used as the drag image. Provide a ref,
   * an element, or `{ element, x, y }` for the hotspot offset.
   */
  preview?: HTMLElement | { element: HTMLElement; x?: number; y?: number } | null;
  /** Which operation this source advertises (default `"copy"`). */
  operation?: DropOperation;
  /** Disable dragging without removing the props. */
  disabled?: boolean;
  /** Fired on `dragstart`. */
  onDragStart?: (item: T) => void;
  /** Fired on `dragend`; `operation` is the drop effect the OS reported. */
  onDragEnd?: (item: T, operation: DropOperation) => void;
}

/** The spreadable prop bag a draggable element receives. */
export interface DraggableProps {
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  "data-draggable": "" | undefined;
}

/**
 * `.draggable(item)`. Returns props to spread on the draggable element. On
 * `dragstart` it serializes `item` into `dataTransfer`, sets the drag image from
 * `preview`, and advertises `operation` via `effectAllowed`.
 */
export function useDraggable<T = unknown>(options: UseDraggableOptions<T>): DraggableProps {
  const optsRef = React.useRef(options);
  optsRef.current = options;

  const resolveItem = React.useCallback((): T => {
    const it = optsRef.current.item;
    return typeof it === "function" ? (it as () => T)() : it;
  }, []);

  const onDragStart = React.useCallback(
    (e: React.DragEvent) => {
      const o = optsRef.current;
      if (o.disabled) {
        e.preventDefault();
        return;
      }
      const item = resolveItem();
      const type = o.type ?? "public.data";
      const op = o.operation ?? "copy";
      writePayload(e.dataTransfer, type, item);
      // effectAllowed gates what dropEffect the destination may pick
      e.dataTransfer.effectAllowed =
        op === "move" || op === "delete"
          ? "move"
          : op === "alias"
            ? "link"
            : "copy";
      // drag image from preview
      const pv = o.preview;
      if (pv) {
        const el = pv instanceof HTMLElement ? pv : pv.element;
        const x = pv instanceof HTMLElement ? 0 : (pv.x ?? 0);
        const y = pv instanceof HTMLElement ? 0 : (pv.y ?? 0);
        if (el) e.dataTransfer.setDragImage(el, x, y);
      }
      o.onDragStart?.(item);
    },
    [resolveItem],
  );

  const onDragEnd = React.useCallback((e: React.DragEvent) => {
    const o = optsRef.current;
    const effect = e.dataTransfer.dropEffect;
    const op: DropOperation =
      effect === "move" ? "move" : effect === "link" ? "alias" : effect === "copy" ? "copy" : "cancel";
    o.onDragEnd?.(resolveItem(), op);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    draggable: !options.disabled,
    onDragStart,
    onDragEnd,
    "data-draggable": options.disabled ? undefined : "",
  };
}

/* =============================================================================
 * useDropDestination — `.dropDestination(for:action:isTargeted:)` (SwiftUI:2026)
 * ========================================================================== */

export interface UseDropDestinationOptions<T = unknown> {
  /**
   * ⇄ `action: (items: [T], location: CGPoint) -> Bool`. Receives the dropped
   * payload(s) and the drop point (relative to the destination). Return `true`
   * when the drop is accepted (mirrors SwiftUI's `Bool` return). Async allowed.
   */
  onDrop: (items: T[], location: { x: number; y: number }) => boolean | void | Promise<boolean | void>;
  /**
   * ⇄ `isTargeted: (Bool) -> Void`. Fired `true` on drag-enter, `false` on
   * leave/drop — drive a highlight from it.
   */
  isTargeted?: (targeted: boolean) => void;
  /**
   * The payload types this destination accepts (the `for: T.Type` / `UTType`
   * analog). When omitted, accepts any SwiftTS drag.
   */
  acceptedTypes?: string[];
  /** Which operation to show the cursor (default `"copy"`). */
  operation?: DropOperation;
  /** Disable dropping without removing the props. */
  disabled?: boolean;
}

/** The spreadable prop bag a drop destination receives. */
export interface DropDestinationProps {
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  "data-drop-target": "" | undefined;
}

/**
 * `.dropDestination(for:action:isTargeted:)`. Returns props to spread on the drop
 * zone. It `preventDefault`s over the target (required so the browser permits a
 * drop), tracks enter/leave depth to fire `isTargeted` exactly once per hover,
 * parses the payload on `drop`, and calls `onDrop(items, location)`.
 */
export function useDropDestination<T = unknown>(
  options: UseDropDestinationOptions<T>,
): DropDestinationProps {
  const optsRef = React.useRef(options);
  optsRef.current = options;
  // enter/leave fire per descendant; count depth so isTargeted toggles once.
  const depthRef = React.useRef(0);

  const accepts = React.useCallback((dt: DataTransfer): boolean => {
    const o = optsRef.current;
    if (o.disabled) return false;
    if (!o.acceptedTypes || o.acceptedTypes.length === 0) return true;
    const type = peekDragType(dt);
    if (type == null) return false;
    return o.acceptedTypes.includes(type);
  }, []);

  const onDragEnter = React.useCallback(
    (e: React.DragEvent) => {
      if (!accepts(e.dataTransfer)) return;
      e.preventDefault();
      depthRef.current += 1;
      if (depthRef.current === 1) optsRef.current.isTargeted?.(true);
    },
    [accepts],
  );

  const onDragOver = React.useCallback(
    (e: React.DragEvent) => {
      if (!accepts(e.dataTransfer)) return;
      // must preventDefault on dragover or the browser rejects the drop
      e.preventDefault();
      const op = optsRef.current.operation ?? "copy";
      e.dataTransfer.dropEffect = DROP_EFFECT[op];
    },
    [accepts],
  );

  const onDragLeave = React.useCallback((e: React.DragEvent) => {
    if (optsRef.current.disabled) return;
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) optsRef.current.isTargeted?.(false);
  }, []);

  const onDrop = React.useCallback((e: React.DragEvent) => {
    const o = optsRef.current;
    if (o.disabled) return;
    if (!accepts(e.dataTransfer)) return;
    e.preventDefault();
    depthRef.current = 0;
    o.isTargeted?.(false);
    const parsed = readPayload<T>(e.dataTransfer);
    if (parsed == null) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const location = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    void o.onDrop([parsed.item], location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accepts]);

  return {
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    "data-drop-target": options.disabled ? undefined : "",
  };
}

/* =============================================================================
 * onDrag / onDrop — function-form builders (legacy `.onDrag` / `.onDrop`)
 * ========================================================================== */

/**
 * `.onDrag { NSItemProvider(...) }` builder form: returns the same `DraggableProps`
 * as `useDraggable`. NOTE: this is a plain function, not a hook — it must be called
 * during render (it allocates fresh handlers each call); prefer `useDraggable` for
 * memoized handlers. Provided for 1:1 call-site parity with `.onDrag`.
 */
export function onDrag<T = unknown>(
  item: T | (() => T),
  options?: Omit<UseDraggableOptions<T>, "item">,
): DraggableProps {
  const o: UseDraggableOptions<T> = { item, ...options };
  const resolve = (): T => (typeof item === "function" ? (item as () => T)() : item);
  return {
    draggable: !o.disabled,
    "data-draggable": o.disabled ? undefined : "",
    onDragStart: (e: React.DragEvent) => {
      if (o.disabled) {
        e.preventDefault();
        return;
      }
      const value = resolve();
      const type = o.type ?? "public.data";
      writePayload(e.dataTransfer, type, value);
      e.dataTransfer.effectAllowed =
        (o.operation ?? "copy") === "move" ? "move" : (o.operation ?? "copy") === "alias" ? "link" : "copy";
      if (o.preview) {
        const el = o.preview instanceof HTMLElement ? o.preview : o.preview.element;
        const x = o.preview instanceof HTMLElement ? 0 : (o.preview.x ?? 0);
        const y = o.preview instanceof HTMLElement ? 0 : (o.preview.y ?? 0);
        if (el) e.dataTransfer.setDragImage(el, x, y);
      }
      o.onDragStart?.(value);
    },
    onDragEnd: (e: React.DragEvent) => {
      const effect = e.dataTransfer.dropEffect;
      const op: DropOperation =
        effect === "move" ? "move" : effect === "link" ? "alias" : effect === "copy" ? "copy" : "cancel";
      o.onDragEnd?.(resolve(), op);
    },
  };
}

/**
 * `.onDrop(of:isTargeted:perform:)` builder form: returns the same
 * `DropDestinationProps` as `useDropDestination`. Plain function (call in render);
 * prefer `useDropDestination` for memoized handlers + correct enter/leave depth.
 */
export function onDrop<T = unknown>(options: UseDropDestinationOptions<T>): DropDestinationProps {
  let depth = 0;
  const accepts = (dt: DataTransfer): boolean => {
    if (options.disabled) return false;
    if (!options.acceptedTypes || options.acceptedTypes.length === 0) return true;
    const type = peekDragType(dt);
    return type != null && options.acceptedTypes.includes(type);
  };
  return {
    "data-drop-target": options.disabled ? undefined : "",
    onDragEnter: (e: React.DragEvent) => {
      if (!accepts(e.dataTransfer)) return;
      e.preventDefault();
      depth += 1;
      if (depth === 1) options.isTargeted?.(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!accepts(e.dataTransfer)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = DROP_EFFECT[options.operation ?? "copy"];
    },
    onDragLeave: () => {
      if (options.disabled) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) options.isTargeted?.(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (options.disabled || !accepts(e.dataTransfer)) return;
      e.preventDefault();
      depth = 0;
      options.isTargeted?.(false);
      const parsed = readPayload<T>(e.dataTransfer);
      if (parsed == null) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      void options.onDrop([parsed.item], { x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
  };
}

/** Low-level escape hatches for callers writing their own handlers. */
export const dragDropCodec = {
  writePayload,
  readPayload,
  peekDragType,
  PAYLOAD_MIME,
  TYPE_MIME_PREFIX,
};
