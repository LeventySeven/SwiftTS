"use client";
/**
 * SwiftUI's @Environment, ported to React context.
 * A SwiftUIProvider sets the theming substrate (color scheme, tint, control size,
 * Dynamic Type scale, layout direction) that every component reads — the web
 * equivalent of EnvironmentValues. Components call `useEnvironment()`.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ColorScheme,
  ColorSchemePreference,
  ControlSize,
  LayoutDirection,
} from "./types";

export interface SwiftUIEnvironment {
  colorScheme: ColorScheme;
  controlSize: ControlSize;
  /** Dynamic Type multiplier applied to font sizes (1 = default "Large"). */
  dynamicTypeScale: number;
  layoutDirection: LayoutDirection;
  /** Accent/tint color token or CSS color. */
  tint: string;
  isEnabled: boolean;
  reduceMotion: boolean;
}

const DEFAULTS: SwiftUIEnvironment = {
  colorScheme: "light",
  controlSize: "regular",
  dynamicTypeScale: 1,
  layoutDirection: "leftToRight",
  tint: "var(--sui-color-tint)",
  isEnabled: true,
  reduceMotion: false,
};

const EnvironmentContext = createContext<SwiftUIEnvironment>(DEFAULTS);

export function useEnvironment(): SwiftUIEnvironment {
  return useContext(EnvironmentContext);
}

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return dark;
}

export interface SwiftUIProviderProps extends Partial<Omit<SwiftUIEnvironment, "colorScheme">> {
  /** "system" follows the OS; "light"/"dark" force a scheme. */
  colorScheme?: ColorSchemePreference;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /**
   * When true (default), the resolved scheme is also written to <html> as
   * `data-theme` + `color-scheme`, so page chrome (body background, native
   * scrollbars/controls) follows the forced theme and overrides the OS
   * `@media (prefers-color-scheme)` fallback. Set false for a scheme-scoped
   * provider nested inside another.
   */
  applyToDocument?: boolean;
}

const CONTROL_DIR: Record<LayoutDirection, "ltr" | "rtl"> = {
  leftToRight: "ltr",
  rightToLeft: "rtl",
};

/**
 * Wraps an app/subtree. Resolves the scheme, exposes the environment via context,
 * and projects scheme/tint/control-size onto a wrapper element as data-attributes +
 * CSS variables so token overrides (e.g. dark mode, custom tint) cascade in CSS.
 */
export function SwiftUIProvider({
  colorScheme = "system",
  controlSize,
  dynamicTypeScale,
  layoutDirection,
  tint,
  isEnabled,
  reduceMotion,
  children,
  className,
  style,
  applyToDocument = true,
}: SwiftUIProviderProps) {
  const prefersDark = usePrefersDark();
  const resolvedScheme: ColorScheme =
    colorScheme === "system" ? (prefersDark ? "dark" : "light") : colorScheme;

  // Project the resolved scheme onto <html> so the whole document (body bg,
  // native scrollbars/controls) follows it and overrides the OS @media fallback.
  useEffect(() => {
    if (!applyToDocument || typeof document === "undefined") return;
    const html = document.documentElement;
    const prevTheme = html.getAttribute("data-theme");
    const prevScheme = html.style.colorScheme;
    html.setAttribute("data-theme", resolvedScheme);
    html.style.colorScheme = resolvedScheme;
    return () => {
      if (prevTheme === null) html.removeAttribute("data-theme");
      else html.setAttribute("data-theme", prevTheme);
      html.style.colorScheme = prevScheme;
    };
  }, [applyToDocument, resolvedScheme]);

  const env = useMemo<SwiftUIEnvironment>(
    () => ({
      colorScheme: resolvedScheme,
      controlSize: controlSize ?? DEFAULTS.controlSize,
      dynamicTypeScale: dynamicTypeScale ?? DEFAULTS.dynamicTypeScale,
      layoutDirection: layoutDirection ?? DEFAULTS.layoutDirection,
      tint: tint ?? DEFAULTS.tint,
      isEnabled: isEnabled ?? DEFAULTS.isEnabled,
      reduceMotion: reduceMotion ?? DEFAULTS.reduceMotion,
    }),
    [resolvedScheme, controlSize, dynamicTypeScale, layoutDirection, tint, isEnabled, reduceMotion],
  );

  const cssVars: React.CSSProperties = {
    // dynamic type scales every rem-based size off this multiplier
    ["--sui-dynamic-type-scale" as any]: String(env.dynamicTypeScale),
    ...(tint ? ({ ["--sui-color-tint" as any]: tint } as React.CSSProperties) : {}),
    ...style,
  };

  return (
    <EnvironmentContext.Provider value={env}>
      <div
        className={className ? `sui-root ${className}` : "sui-root"}
        data-theme={env.colorScheme}
        data-control-size={env.controlSize}
        dir={CONTROL_DIR[env.layoutDirection]}
        style={cssVars}
      >
        {children}
      </div>
    </EnvironmentContext.Provider>
  );
}

/** Programmatic override of a slice of the environment (SwiftUI `.environment(\\.x, y)`). */
export function EnvironmentOverride({
  children,
  ...overrides
}: Partial<SwiftUIEnvironment> & { children: React.ReactNode }) {
  const parent = useEnvironment();
  const value = useMemo(() => ({ ...parent, ...overrides }), [parent, JSON.stringify(overrides)]);
  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>;
}
