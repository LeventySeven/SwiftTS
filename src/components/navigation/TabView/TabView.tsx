"use client";
/**
 * `TabView` — the top-level container that switches between sibling screens.
 *
 * RE'd from `teardowns/SWIFTUI_C7_navigation.md` §4. Two presentations:
 *   - bottom tab bar (default `style="bar"`): a 49pt frosted `.bar` row of
 *     icon-over-label items; selected item tinted accent, unselected
 *     secondary-label; +34pt home-indicator safe-area inset; red count badge
 *     (§4.2/§4.4). Tapping swaps content instantly (no slide); non-selected
 *     tabs stay mounted so scroll position is preserved (§4.3).
 *   - paged carousel (`style="page"`, `.tabViewStyle(.page)`): a horizontal
 *     scroll-snap track with a centered page-dot indicator; an
 *     IntersectionObserver syncs the active dot + selection (§4.5).
 *
 * Tabs come from `<Tab>` descriptor children (iOS 18 modern form, §5) OR from
 * any child carrying `tabItem` + `tag` metadata (legacy `.tabItem`, §9). Both
 * are normalized to the same internal `TabSpec`.
 */
import * as React from "react";
import { SymbolGlyph } from "../../controls/SymbolGlyph";
import { materialClass } from "../../../system/effects";
import type { TabViewStyleName } from "../../../system/styles";
import { Tab, type TabProps } from "../Tab/Tab";
import "../navigation.global.css";

/** Normalized per-tab spec, built from either a `<Tab>` or a legacy `tabItem` child. */
interface TabSpec {
  title?: string;
  systemImage?: string;
  image?: string;
  value: unknown;
  role?: "search";
  badge?: number | string;
  label?: React.ReactNode;
  content: React.ReactNode;
}

export type TabViewStyle = "bar" | "page" | TabViewStyleName;

export interface TabViewProps {
  /** The selected tab's `value` (controlled). */
  selection: unknown;
  /** Fired when a tab is chosen (or a page is swiped to). */
  onSelectionChange: (value: unknown) => void;
  /**
   * `bar` (bottom bar, default) | `page` / `verticalPage` (swipeable carousel + dots)
   * | `sidebarAdaptable` (bottom bar in compact width, leading sidebar in regular).
   */
  style?: TabViewStyle;
  /** Page-dot visibility for `style="page"` (`.page(indexDisplayMode:)`). */
  indexDisplayMode?: "automatic" | "always" | "never";
  /** sidebarAdaptable: width (px) below which the bar shows instead of the sidebar. */
  sidebarBreakpoint?: number;
  /** `<Tab>` descriptors or legacy `tabItem`-carrying children. */
  children: React.ReactNode;
  className?: string;
  style2?: React.CSSProperties;
}

export function TabView({
  selection,
  onSelectionChange,
  style = "bar",
  indexDisplayMode = "automatic",
  sidebarBreakpoint = 768,
  children,
  className,
  style2,
}: TabViewProps) {
  const tabs = React.useMemo(() => collectTabs(children), [children]);
  const isPage = style === "page" || style === "verticalPage";

  if (isPage) {
    return (
      <PageTabView
        tabs={tabs}
        selection={selection}
        onSelectionChange={onSelectionChange}
        indexDisplayMode={indexDisplayMode}
        className={className}
        style={style2}
      />
    );
  }

  // .tabViewStyle(.sidebarAdaptable) — sidebar in regular width, bottom bar in compact.
  const adaptive = style === "sidebarAdaptable";

  return (
    <BarTabView
      tabs={tabs}
      selection={selection}
      onSelectionChange={onSelectionChange}
      className={className}
      style={style2}
      adaptive={adaptive}
      sidebarBreakpoint={sidebarBreakpoint}
    />
  );
}

TabView.displayName = "TabView";

/* ===========================================================================
 * Bottom-bar presentation (§4.4)
 * ======================================================================== */

function BarTabView({
  tabs,
  selection,
  onSelectionChange,
  className,
  style,
  adaptive = false,
  sidebarBreakpoint = 768,
}: {
  tabs: TabSpec[];
  selection: unknown;
  onSelectionChange: (v: unknown) => void;
  className?: string;
  style?: React.CSSProperties;
  adaptive?: boolean;
  sidebarBreakpoint?: number;
}) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  // sidebarAdaptable: measure width → "sidebar" (regular) vs "bar" (compact).
  const [layout, setLayout] = React.useState<"bar" | "sidebar">("bar");
  React.useEffect(() => {
    if (!adaptive) {
      setLayout("bar");
      return;
    }
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setLayout(e.contentRect.width >= sidebarBreakpoint ? "sidebar" : "bar");
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [adaptive, sidebarBreakpoint]);

  const showSidebar = adaptive && layout === "sidebar";

  const pages = (
    <div className="sui-tab-pages">
      {tabs.map((t, i) => {
        const selected = sameValue(t.value, selection);
        return (
          <div
            key={tabKey(t, i)}
            className="sui-tab-page"
            role="tabpanel"
            data-selected={String(selected)}
            hidden={!selected}
          >
            {t.content}
          </div>
        );
      })}
    </div>
  );

  if (showSidebar) {
    return (
      <div
        ref={hostRef}
        className={["sui-tabview", className].filter(Boolean).join(" ")}
        data-style="sidebarAdaptable"
        data-layout="sidebar"
        style={style}
      >
        <nav className="sui-tab-sidebar" role="tablist">
          {tabs.map((t, i) => {
            const selected = sameValue(t.value, selection);
            return (
              <button
                key={tabKey(t, i)}
                type="button"
                className="sui-tab-sidebar-item"
                role="tab"
                aria-selected={selected}
                data-selected={String(selected)}
                onClick={() => onSelectionChange(t.value)}
              >
                <span className="sui-tab-sidebar-icon">
                  <TabIcon spec={t} />
                </span>
                {t.title ? <span className="sui-tab-sidebar-label">{t.title}</span> : null}
                {t.badge != null ? (
                  <span className="sui-tab-sidebar-badge">{t.badge}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
        {pages}
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className={["sui-tabview", className].filter(Boolean).join(" ")}
      data-style={adaptive ? "sidebarAdaptable" : "bar"}
      data-layout="bar"
      style={style}
    >
      {pages}
      <nav className={`sui-tabbar ${materialClass("bar")} sui-material-no-rim`} role="tablist">
        {tabs.map((t, i) => {
          const selected = sameValue(t.value, selection);
          return (
            <button
              key={tabKey(t, i)}
              type="button"
              className="sui-tabbar-item"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelectionChange(t.value)}
            >
              <TabIcon spec={t} />
              {t.title ? <span className="sui-tabbar-label">{t.title}</span> : null}
              {t.badge != null ? <span className="sui-tabbar-badge">{t.badge}</span> : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/** Render a tab's icon: custom label > SF Symbol via SymbolGlyph (search role →
 *  magnifyingglass) > image. The 25×25 box + currentColor (selected/unselected
 *  tint) come from `.sui-tabbar-icon`; SymbolGlyph fills it at `size={25}`. */
function TabIcon({ spec }: { spec: TabSpec }) {
  if (spec.label) return <span className="sui-tabbar-icon">{spec.label}</span>;
  const symbol = spec.systemImage ?? (spec.role === "search" ? "magnifyingglass" : undefined);
  if (symbol) {
    return (
      <span className="sui-tabbar-icon">
        <SymbolGlyph name={normalizeSymbol(symbol)} size={25} />
      </span>
    );
  }
  if (spec.image) {
    return (
      <span className="sui-tabbar-icon">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={spec.image} alt="" />
      </span>
    );
  }
  return <span className="sui-tabbar-icon" />;
}

/** Map a full SF Symbol name to the base glyph SymbolGlyph provides — drop the
 *  `.fill` / `.crop.circle` decorations so `house.fill` → `house`,
 *  `person.crop.circle` → `person`, `bell.fill` → `bell`. */
function normalizeSymbol(name: string): string {
  const base = name.replace(/\.(fill|crop\.circle|circle|square|slash)$/g, "");
  return base || name;
}

/* ===========================================================================
 * Page presentation (§4.5)
 * ======================================================================== */

function PageTabView({
  tabs,
  selection,
  onSelectionChange,
  indexDisplayMode,
  className,
  style,
}: {
  tabs: TabSpec[];
  selection: unknown;
  onSelectionChange: (v: unknown) => void;
  indexDisplayMode: "automatic" | "always" | "never";
  className?: string;
  style?: React.CSSProperties;
}) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const pageRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    tabs.findIndex((t) => sameValue(t.value, selection)),
  );

  // Sync the active page (and selection) as the user swipes — IntersectionObserver.
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const idx = pageRefs.current.indexOf(e.target as HTMLDivElement);
            if (idx >= 0 && !sameValue(tabs[idx]?.value, selection)) {
              onSelectionChange(tabs[idx].value);
            }
          }
        }
      },
      { root: track, threshold: [0.6] },
    );
    pageRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length, selection]);

  // When `selection` is driven externally, scroll the track to that page.
  React.useEffect(() => {
    const el = pageRefs.current[selectedIndex];
    el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, [selectedIndex]);

  const dots = indexDisplayMode === "never" ? "never" : indexDisplayMode;
  const showDots = indexDisplayMode === "always" || (indexDisplayMode === "automatic" && tabs.length > 1);

  return (
    <div
      className={["sui-tabview", className].filter(Boolean).join(" ")}
      data-style="page"
      style={style}
    >
      <div className="sui-pageview" ref={trackRef}>
        {tabs.map((t, i) => (
          <div
            key={tabKey(t, i)}
            className="sui-page"
            ref={(el) => {
              pageRefs.current[i] = el;
            }}
          >
            {t.content}
          </div>
        ))}
      </div>
      {showDots ? (
        <div className="sui-page-dots" data-dots={dots}>
          {tabs.map((t, i) => (
            <span key={tabKey(t, i)} className="sui-dot" data-on={String(i === selectedIndex)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ===========================================================================
 * Child normalization
 * ======================================================================== */

/** Collect `<Tab>` descriptors and legacy `tabItem`-carrying children into specs. */
function collectTabs(children: React.ReactNode): TabSpec[] {
  const out: TabSpec[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const type = child.type as unknown as { __suiTab?: boolean };
    if (type && type.__suiTab) {
      const p = child.props as TabProps;
      out.push({
        title: p.title,
        systemImage: p.systemImage,
        image: p.image,
        value: p.value,
        role: p.role,
        badge: p.badge,
        label: p.label,
        content: p.children,
      });
      return;
    }
    // legacy form: a child view carrying `tabItem` + `tag`
    const props = child.props as {
      tabItem?: { title?: string; systemImage?: string; image?: string; label?: React.ReactNode };
      tag?: unknown;
      children?: React.ReactNode;
      badge?: number | string;
    };
    if (props.tabItem) {
      out.push({
        title: props.tabItem.title,
        systemImage: props.tabItem.systemImage,
        image: props.tabItem.image,
        label: props.tabItem.label,
        value: props.tag ?? out.length,
        badge: props.badge,
        content: child,
      });
    }
  });
  return out;
}

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || (Number.isNaN(a as number) && Number.isNaN(b as number));
}

function tabKey(t: TabSpec, i: number): string {
  return typeof t.value === "string" || typeof t.value === "number"
    ? String(t.value)
    : `tab-${i}`;
}

// Keep a reference so the descriptor type is part of the module graph.
void Tab;
