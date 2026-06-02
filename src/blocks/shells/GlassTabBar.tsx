"use client";
/**
 * GlassTabBar — a standalone floating glass bottom tab-bar template.
 *
 * The iOS-26 floating tab capsule: icon-over-label tabs, a single morphing
 * glass HIGHLIGHT that slides/sizes to the selected tab (the
 * matchedGeometry / glassEffectUnion look), and per-tab badges. Built over the
 * kit's glass surface (`glassBarClass` / `glassBarStyle` from
 * ../../components/navigation, so it shares rim/sheen/glow with the rest of the
 * kit) plus the floating-pill geometry from shells.module.css.
 *
 * The highlight is positioned by measuring the selected tab button with a
 * `useLayoutEffect` guarded for SSR (no DOM reads during server render; the
 * highlight starts `data-ready="false"` → invisible until the first measure, so
 * there is no flash at 0,0).
 *
 * Controlled (`selection` + `onSelect`). `"use client"` for the measure +
 * selection callback.
 */
import * as React from "react";
import {
  useLiquidGlassMode,
  resolveBarSurface,
  glassBarClass,
  glassBarStyle,
} from "../../components/navigation";
import type { Glass, GlassVariant } from "../../system/effects";
import { SymbolGlyph } from "../../components/controls/SymbolGlyph";
import styles from "./shells.module.css";

/** A bottom-tab descriptor. */
export interface TabBarItem {
  /** Stable id used for selection + key. */
  id: string;
  /** Tab label (under the icon). */
  label: string;
  /** SF Symbol for the unselected state. */
  systemImage: string;
  /** SF Symbol for the selected state (e.g. the `.fill` variant). */
  selectedSystemImage?: string;
  /** Badge: count (number) or short text (string). */
  badge?: number | string;
  /** Disable the tab. */
  disabled?: boolean;
}

export interface GlassTabBarProps {
  /** The tabs. */
  items: TabBarItem[];
  /** Controlled selected tab id. */
  selection: string;
  /** Selection change callback. */
  onSelect?: (id: string) => void;

  /** Max capsule width (px) before it stops growing. Default 520. */
  maxWidth?: number;
  /** Force classic frosted material instead of glass. */
  material?: boolean;
  /** Force/configure glass. */
  glass?: boolean | Glass | GlassVariant;
  /** Float absolutely inside a positioned parent (default `true`). When
   *  `false`, the bar lays out in flow (e.g. for a static showcase row). */
  floating?: boolean;

  className?: string;
  style?: React.CSSProperties;
}

interface HighlightRect {
  x: number;
  w: number;
  ready: boolean;
}

export const GlassTabBar = React.forwardRef<HTMLDivElement, GlassTabBarProps>(
  function GlassTabBar(
    {
      items,
      selection,
      onSelect,
      maxWidth = 520,
      material,
      glass,
      floating = true,
      className,
      style,
    },
    ref,
  ) {
    const liquidGlassMode = useLiquidGlassMode();
    const surface = resolveBarSurface({ glass, material, liquidGlassMode });
    const isGlass = surface.kind === "glass";

    const barRef = React.useRef<HTMLDivElement | null>(null);
    const itemRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
    const [hl, setHl] = React.useState<HighlightRect>({ x: 0, w: 0, ready: false });

    // Measure the selected tab and place the morphing highlight under it.
    const measure = React.useCallback(() => {
      const bar = barRef.current;
      const el = itemRefs.current[selection];
      if (!bar || !el) return;
      const barRect = bar.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setHl({ x: r.left - barRect.left, w: r.width, ready: true });
    }, [selection]);

    // useLayoutEffect only runs in the browser → SSR-safe (no server reads).
    React.useLayoutEffect(() => {
      measure();
    }, [measure, items.length]);

    React.useEffect(() => {
      if (typeof window === "undefined") return;
      const onResize = () => measure();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [measure]);

    const surfaceClass = isGlass
      ? glassBarClass("sui-tabbar", surface.glass)
      : "sui-material sui-material-bar";
    const surfaceStyle = isGlass ? glassBarStyle(surface.glass) : undefined;

    const cls = [styles.tabbar, surfaceClass, className].filter(Boolean).join(" ");

    const mergedStyle: React.CSSProperties = {
      ["--tabbar-max-w" as string]: `${maxWidth}px`,
      ["--hl-x" as string]: `${hl.x}px`,
      ["--hl-w" as string]: `${hl.w}px`,
      ...(floating ? null : { position: "relative", left: "auto", bottom: "auto", transform: "none" }),
      ...surfaceStyle,
      ...style,
    };

    const setBarRef = (node: HTMLDivElement | null) => {
      barRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };

    return (
      <div
        ref={setBarRef}
        className={cls}
        style={mergedStyle}
        role="tablist"
        aria-label="Tabs"
      >
        {isGlass ? (
          <span
            className={styles.tabbarHighlight}
            data-ready={hl.ready ? "true" : "false"}
            aria-hidden
          />
        ) : null}

        {items.map((it) => {
          const selected = it.id === selection;
          const icon =
            selected && it.selectedSystemImage
              ? it.selectedSystemImage
              : it.systemImage;
          return (
            <button
              key={it.id}
              type="button"
              ref={(n) => {
                itemRefs.current[it.id] = n;
              }}
              className={styles.tabbarItem}
              role="tab"
              aria-selected={selected}
              data-selected={selected ? "true" : undefined}
              disabled={it.disabled}
              onClick={() => !it.disabled && onSelect?.(it.id)}
            >
              <span className={styles.tabbarIcon}>
                <SymbolGlyph
                  name={icon}
                  size={26}
                  weight={selected ? "semibold" : "regular"}
                />
              </span>
              <span className={styles.tabbarLabel}>{it.label}</span>
              {it.badge != null && it.badge !== "" ? (
                <span className={styles.tabbarBadge}>{it.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  },
);

GlassTabBar.displayName = "GlassTabBar";
