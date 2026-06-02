"use client";
/**
 * `NavigationStack` — SwiftUI's push/pop drill-down container.
 *
 * RE'd from `teardowns/SWIFTUI_C7_navigation.md` §1. Mirrors the three SwiftUI
 * inits: uncontrolled (`NavigationStack { root }`), controlled by an erased
 * `NavigationPath` binding, and controlled by a typed array binding — all three
 * collapse to the `path` / `onPathChange` prop pair here.
 *
 * What it owns (the spec's "chrome layer"):
 *   - the ~44pt nav bar with the frosted `.bar` material (effects.ts) that is
 *     transparent at the top and cross-fades in on scroll (§1.2);
 *   - the large-title row (+52pt) that scrubs to the inline 17pt centered title
 *     as the active page scrolls 0→52 (§6.2), driven by `--lt-progress`;
 *   - the `‹ Back` chevron + previous title, popping one level on tap (§1.3);
 *   - the push/pop horizontal slide (0.35s `cubic-bezier(0.33,0,0.13,1)`,
 *     outgoing parallax −30% + dim) via the keyframes in navigation.global.css;
 *   - the interactive left-edge swipe-back (hot zone 20px, completes past 50%
 *     width or with velocity) (§1.3);
 *   - the `useNavigation()` / `useNavigationBar()` / `useToolbar()` contexts.
 */
import * as React from "react";
import { View, type ViewProps } from "../../View";
import { materialClass } from "../../../system/effects";
import { ChevronBackward } from "../glyphs";
import {
  NavigationContext,
  NavigationBarContext,
  ToolbarContext,
  canonicalPlacement,
  type NavPathEntry,
  type NavBarConfig,
  type NavigationContextValue,
  type ToolbarEntry,
} from "../NavigationContext";
import "../navigation.global.css";

/** Edge-swipe-back hot zone (px) and completion threshold — §14 constants. */
const EDGE_ZONE = 20;
const VELOCITY_THRESHOLD = 0.45; // px/ms — a flick completes the pop
/** Large-title collapse distance (px) — the +52pt row height (§6.2). */
const COLLAPSE_DISTANCE = 52;

export interface NavigationStackProps extends Omit<ViewProps, "as" | "title"> {
  /** Controlled stack path (mirrors the `path:` binding inits). Omit ⇒ uncontrolled. */
  path?: NavPathEntry[];
  /** Fired whenever the stack pushes/pops (controlled mode). */
  onPathChange?: (path: NavPathEntry[]) => void;
  /** The root view (SwiftUI's `@ViewBuilder root`). */
  children: React.ReactNode;
  /** Title for the root screen when no child sets one via `navigationTitle`. */
  rootTitle?: string;
}

type AnimState = { depth: number; kind: "push" | "pop" } | null;

export const NavigationStack = React.forwardRef<HTMLDivElement, NavigationStackProps>(
  function NavigationStack(
    { path: controlledPath, onPathChange, children, rootTitle, style, className, ...rest },
    ref,
  ) {
    const isControlled = controlledPath !== undefined;
    const [internalPath, setInternalPath] = React.useState<NavPathEntry[]>([]);
    const path = isControlled ? controlledPath! : internalPath;

    const setPath = React.useCallback(
      (next: NavPathEntry[]) => {
        if (!isControlled) setInternalPath(next);
        onPathChange?.(next);
      },
      [isControlled, onPathChange],
    );

    // Destination registry: type-tag → builder (navigationDestination(for:)).
    const registryRef = React.useRef(new Map<string, (value: unknown) => React.ReactNode>());

    // The bar config contributed by the *active* (top) screen, per depth.
    const [barByDepth, setBarByDepth] = React.useState<Record<number, NavBarConfig>>({});
    const [toolbarByDepth, setToolbarByDepth] = React.useState<Record<number, ToolbarEntry[]>>({});

    // Animation bookkeeping for the slide.
    const [anim, setAnim] = React.useState<AnimState>(null);
    const prevDepthRef = React.useRef(0);

    const depth = path.length;

    React.useEffect(() => {
      const prev = prevDepthRef.current;
      if (depth > prev) setAnim({ depth, kind: "push" });
      else if (depth < prev) setAnim({ depth: prev, kind: "pop" });
      prevDepthRef.current = depth;
      // clear the anim flag once the slide is done
      if (depth !== prev) {
        const t = setTimeout(() => setAnim(null), 360);
        return () => clearTimeout(t);
      }
    }, [depth]);

    /* ---- navigation context ---- */
    const resolve = React.useCallback((entry: NavPathEntry): React.ReactNode => {
      if (entry.view !== undefined) return entry.view;
      if (entry.tag) {
        const build = registryRef.current.get(entry.tag);
        if (build) return build(entry.value);
      }
      return null;
    }, []);

    const nav = React.useMemo<NavigationContextValue>(
      () => ({
        path,
        push: (value, tag) => setPath([...path, { value, tag, title: undefined }]),
        pushView: (view, title) => setPath([...path, { view, title }]),
        pop: () => {
          if (path.length > 0) setPath(path.slice(0, -1));
        },
        popToRoot: () => setPath([]),
        canPop: path.length > 0,
        registerDestination: (tag, build) => {
          registryRef.current.set(tag, build);
        },
        resolve,
      }),
      [path, setPath, resolve],
    );

    /* ---- bar + toolbar contexts (the active depth contributes) ---- */
    const barCtx = React.useMemo(
      () => ({
        setBar: (config: NavBarConfig) =>
          setBarByDepth((m) => ({ ...m, [depth]: { ...m[depth], ...config } })),
      }),
      [depth],
    );
    const toolbarCtx = React.useMemo(
      () => ({
        setToolbar: (items: ToolbarEntry[]) =>
          setToolbarByDepth((m) => ({ ...m, [depth]: items })),
      }),
      [depth],
    );

    const activeBar: NavBarConfig = barByDepth[depth] ?? {};
    const activeToolbar: ToolbarEntry[] = toolbarByDepth[depth] ?? [];

    // Resolve the bar title + display mode (automatic = large at root, inline pushed).
    const title =
      activeBar.title ?? (depth === 0 ? rootTitle : path[depth - 1]?.title) ?? "";
    const subtitle = activeBar.subtitle;
    // toolbarTitleDisplayMode(_:) refines `displayMode` when set (title-only chrome).
    const ttdm = activeBar.toolbarTitleDisplayMode;
    const effectiveDisplay =
      ttdm === "inline"
        ? "inline"
        : ttdm === "large" || ttdm === "inlineLarge"
          ? "large"
          : activeBar.displayMode;
    const displayMode =
      effectiveDisplay === "automatic" || effectiveDisplay === undefined
        ? depth === 0
          ? "large"
          : "inline"
        : effectiveDisplay;
    const prevTitle =
      depth === 0 ? undefined : depth === 1 ? rootTitle : (path[depth - 2]?.title ?? "Back");

    /* ---- scroll-linked large-title collapse (§6.3) ---- */
    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const stackElRef = React.useRef<HTMLDivElement | null>(null);
    const [collapsed, setCollapsed] = React.useState(false);

    const onScroll = React.useCallback(() => {
      const el = scrollRef.current;
      const host = stackElRef.current;
      if (!el || !host) return;
      const t = Math.min(1, Math.max(0, el.scrollTop / COLLAPSE_DISTANCE));
      host.style.setProperty("--lt-progress", String(t));
      setCollapsed(el.scrollTop >= COLLAPSE_DISTANCE);
    }, []);

    // Reset collapse when the active screen changes (each page scrolls independently).
    React.useEffect(() => {
      const host = stackElRef.current;
      host?.style.setProperty("--lt-progress", "0");
      setCollapsed(false);
    }, [depth]);

    /* ---- interactive edge-swipe-back (§1.3) ---- */
    const dragRef = React.useRef<{
      active: boolean;
      startX: number;
      lastX: number;
      lastT: number;
      width: number;
    } | null>(null);

    const topPageRef = React.useRef<HTMLDivElement | null>(null);
    const underPageRef = React.useRef<HTMLDivElement | null>(null);

    const onPointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        if (depth === 0 || activeBar.backButtonHidden) return;
        if (e.clientX > EDGE_ZONE) return;
        const host = stackElRef.current;
        if (!host) return;
        dragRef.current = {
          active: true,
          startX: e.clientX,
          lastX: e.clientX,
          lastT: performance.now(),
          width: host.clientWidth || 1,
        };
        if (topPageRef.current) topPageRef.current.dataset.dragging = "true";
        if (underPageRef.current) underPageRef.current.dataset.dragging = "true";
        (e.target as Element).setPointerCapture?.(e.pointerId);
      },
      [depth, activeBar.backButtonHidden],
    );

    const onPointerMove = React.useCallback((e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active) return;
      const dx = Math.max(0, e.clientX - d.startX);
      d.lastX = e.clientX;
      d.lastT = performance.now();
      const frac = dx / d.width;
      if (topPageRef.current) topPageRef.current.style.transform = `translateX(${dx}px)`;
      if (underPageRef.current)
        underPageRef.current.style.transform = `translateX(${-30 + 30 * frac}%)`;
    }, []);

    const endDrag = React.useCallback(
      (e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d?.active) return;
        d.active = false;
        const dx = Math.max(0, e.clientX - d.startX);
        const dt = Math.max(1, performance.now() - d.lastT);
        const velocity = dx / dt;
        const complete = dx > d.width / 2 || velocity > VELOCITY_THRESHOLD;
        // clear inline transforms; CSS / pop takes over
        const clear = (el: HTMLDivElement | null) => {
          if (!el) return;
          delete el.dataset.dragging;
          el.style.transform = "";
        };
        clear(topPageRef.current);
        clear(underPageRef.current);
        if (complete) nav.pop();
        dragRef.current = null;
      },
      [nav],
    );

    /* ---- render the page stack ---- */
    const animFor = (pageDepth: number): string | undefined => {
      if (!anim) return undefined;
      if (anim.kind === "push") {
        if (pageDepth === anim.depth) return "push-in";
        if (pageDepth === anim.depth - 1) return "push-out";
      } else {
        // pop: the leaving page (anim.depth) slides out; the one under pops back in
        if (pageDepth === anim.depth) return "pop-out";
        if (pageDepth === anim.depth - 1) return "pop-in";
      }
      return undefined;
    };

    // During a pop we keep the leaving page mounted for the slide-out.
    const renderDepth = anim?.kind === "pop" ? anim.depth : depth;
    const pages: React.ReactNode[] = [];
    for (let d = 0; d <= renderDepth; d++) {
      const isTop = d === depth;
      const isLeaving = anim?.kind === "pop" && d === anim.depth;
      const content = d === 0 ? children : resolve(path[d - 1]);
      const setRef = (el: HTMLDivElement | null) => {
        if (d === depth) topPageRef.current = el;
        else if (d === depth - 1) underPageRef.current = el;
      };
      pages.push(
        <div
          key={d}
          ref={setRef}
          className="sui-navstack-page"
          data-depth={d}
          data-anim={animFor(d)}
          aria-hidden={!isTop && !isLeaving ? true : undefined}
        >
          {/* each page owns its own scroll container so the large title collapses
              against that page's scroll offset */}
          <div
            className="sui-navstack-scroll"
            ref={isTop ? scrollRef : undefined}
            onScroll={isTop ? onScroll : undefined}
          >
            {content}
          </div>
        </div>,
      );
    }

    const barClasses = [
      "sui-navbar",
      // frosted .bar material when collapsed OR forced-visible
      collapsed || activeBar.toolbarBackground?.visibility === "visible"
        ? `${materialClass("bar")} sui-material-no-rim`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    const leadingItems = activeToolbar.filter((i) => canonicalPlacement(i.placement) === "leading");
    const principalItems = activeToolbar.filter((i) => canonicalPlacement(i.placement) === "principal");
    const trailingItems = activeToolbar.filter((i) => canonicalPlacement(i.placement) === "trailing");
    const bottomItems = activeToolbar.filter((i) => canonicalPlacement(i.placement) === "bottomBar");

    const stackStyle: React.CSSProperties = { ...style };
    if (activeBar.toolbarBackground?.style) {
      (stackStyle as Record<string, string>)["--bar-bg"] = activeBar.toolbarBackground.style;
    }
    if (activeBar.toolbarForegroundStyle) {
      (stackStyle as Record<string, string>)["--bar-fg"] = activeBar.toolbarForegroundStyle;
    }

    return (
      <NavigationContext.Provider value={nav}>
        <NavigationBarContext.Provider value={barCtx}>
          <ToolbarContext.Provider value={toolbarCtx}>
            <View
              ref={(el) => {
                stackElRef.current = el as HTMLDivElement | null;
                if (typeof ref === "function") ref(el as HTMLDivElement | null);
                else if (ref) ref.current = el as HTMLDivElement | null;
              }}
              className={["sui-navstack", className].filter(Boolean).join(" ")}
              data-collapsed={String(collapsed)}
              data-display-mode={displayMode}
              data-toolbar-role={
                activeBar.toolbarRole && activeBar.toolbarRole !== "automatic"
                  ? activeBar.toolbarRole
                  : undefined
              }
              data-bar-fg={activeBar.toolbarForegroundStyle ? "true" : undefined}
              data-hide-back={String(!!activeBar.backButtonHidden)}
              style={stackStyle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              {...rest}
            >
              {/* nav bar chrome */}
              <header
                className={barClasses}
                role="navigation"
                data-bg={
                  activeBar.toolbarBackground?.visibility === "visible" ? "visible" : undefined
                }
                data-bg-style={activeBar.toolbarBackground?.style ? "" : undefined}
                data-scheme={activeBar.toolbarColorScheme}
                data-hidden={activeBar.barHidden ? "true" : undefined}
              >
                <div className="sui-navbar-inline">
                  <div className="sui-navbar-leading">
                    {depth > 0 && (
                      <button
                        type="button"
                        className="sui-navbar-back"
                        aria-label="Back"
                        onClick={() => nav.pop()}
                      >
                        <ChevronBackward />
                        {prevTitle ? (
                          <span className="sui-navbar-back-label">{prevTitle}</span>
                        ) : null}
                      </button>
                    )}
                    {leadingItems.map((it, i) => (
                      <React.Fragment key={`l${i}`}>{it.content}</React.Fragment>
                    ))}
                  </div>
                  <div className="sui-navbar-center">
                    {principalItems.length > 0 ? (
                      principalItems.map((it, i) => (
                        <React.Fragment key={`p${i}`}>{it.content}</React.Fragment>
                      ))
                    ) : (
                      <span className="sui-navbar-title-stack">
                        <span className="sui-navbar-title-inline">{title}</span>
                        {subtitle ? (
                          <span className="sui-navbar-subtitle-inline">{subtitle}</span>
                        ) : null}
                      </span>
                    )}
                  </div>
                  <div className="sui-navbar-trailing">
                    {trailingItems.map((it, i) => (
                      <React.Fragment key={`t${i}`}>{it.content}</React.Fragment>
                    ))}
                  </div>
                </div>

                {/* large-title row — only in .large display mode, no principal override */}
                {displayMode === "large" && principalItems.length === 0 ? (
                  activeBar.editableTitle ? (
                    <h1 className="sui-navbar-largetitle">
                      <input
                        className="sui-navbar-largetitle-field"
                        value={activeBar.editableTitle.value}
                        onChange={(e) => activeBar.editableTitle!.onChange(e.target.value)}
                        aria-label="Title"
                      />
                    </h1>
                  ) : (
                    <h1 className="sui-navbar-largetitle">
                      {title}
                      {subtitle ? (
                        <span className="sui-navbar-subtitle-large">{subtitle}</span>
                      ) : null}
                    </h1>
                  )
                ) : null}
              </header>

              {/* page stack */}
              <div className="sui-navstack-pages">{pages}</div>

              {/* bottom bar (toolbar items placed in .bottomBar) */}
              {bottomItems.length > 0 ? (
                <div className={`sui-bottombar ${materialClass("bar")} sui-material-no-rim`}>
                  {bottomItems.map((it, i) => (
                    <React.Fragment key={`b${i}`}>{it.content}</React.Fragment>
                  ))}
                </div>
              ) : null}
            </View>
          </ToolbarContext.Provider>
        </NavigationBarContext.Provider>
      </NavigationContext.Provider>
    );
  },
);

NavigationStack.displayName = "NavigationStack";
