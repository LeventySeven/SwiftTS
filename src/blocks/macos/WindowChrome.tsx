"use client";
/**
 * WindowChrome — a macOS window FRAME.
 *
 * The desktop window shell: rounded ~10px corners, a hairline rim + a big soft
 * desktop drop shadow, and a UNIFIED TITLEBAR/TOOLBAR row at the top with:
 *   - the TRAFFIC LIGHTS (close / minimize / zoom, reveal-on-hover glyphs),
 *   - a leading toolbar area (icon buttons, segmented controls),
 *   - a CENTERED title (absolutely centered over the bar so toolbar items on
 *     either side never push it off-center — the macOS centered-title behavior),
 *   - a trailing toolbar area (search field, trailing icon buttons).
 * Below the bar is the window body, which hosts a sidebar + content (or any
 * children — typically a <MacSplitView>).
 *
 * The chrome forces the macOS PLATFORM look LOCALLY by setting
 * `data-platform="macOS"` on its own root, so the vibrancy/selection/traffic-
 * light/toolbar classes (system/macos.global.css) resolve even on an iOS page.
 * `designMode` ("liquidGlass" default | "classic") is mirrored too so the
 * macOS-26 Liquid-Glass rim/sheen layers on the vibrancy (or rolls back).
 *
 * The titlebar row is BOTH a `.sui-mac-toolbar` (drag region + no-drag controls)
 * AND a vibrancy titlebar surface (`macVibrancyClass("titlebar")`), so the bar
 * reads as frosted desktop chrome.
 *
 * Stateful (window-control callbacks) → `"use client"`. SSR-safe.
 */
import * as React from "react";
import {
  MAC_TOOLBAR_CLASS,
  macVibrancyClass,
  type MacVibrancyMaterial,
} from "../../system/platform";
import type { DesignMode } from "../../system/environment";
import { TrafficLights } from "./TrafficLights";
import styles from "./macos.module.css";

export interface WindowChromeProps {
  /** Centered window title. */
  title?: React.ReactNode;
  /** Secondary text after the title (e.g. an unsaved-doc "— Edited"). */
  subtitle?: React.ReactNode;

  /** Leading toolbar items (after the traffic lights). */
  toolbarLeading?: React.ReactNode;
  /** Trailing toolbar items (search field, right-aligned controls). */
  toolbarTrailing?: React.ReactNode;

  /** Window-active state — `false` grays the traffic lights (unfocused window). */
  active?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onZoom?: () => void;
  /** Hide the traffic-light cluster entirely (a borderless / panel window). */
  hideTrafficLights?: boolean;

  /** The titlebar vibrancy material. Defaults to `"titlebar"`. */
  titlebarMaterial?: MacVibrancyMaterial;
  /** Force the design language on the window root. Defaults to `"liquidGlass"`. */
  designMode?: DesignMode;
  /** Drop the big desktop shadow + outer ring (window already inside a frame). */
  embedded?: boolean;

  /** The window body (sidebar + content — typically a <MacSplitView>). */
  children?: React.ReactNode;

  className?: string;
  style?: React.CSSProperties;
}

export const WindowChrome = React.forwardRef<HTMLDivElement, WindowChromeProps>(
  function WindowChrome(
    {
      title,
      subtitle,
      toolbarLeading,
      toolbarTrailing,
      active = true,
      onClose,
      onMinimize,
      onZoom,
      hideTrafficLights,
      titlebarMaterial = "titlebar",
      designMode = "liquidGlass",
      embedded,
      children,
      className,
      style,
    },
    ref,
  ) {
    const cls = [styles.window, className].filter(Boolean).join(" ");
    // The titlebar carries BOTH the toolbar strip behavior AND the vibrancy.
    const titlebarCls = [
      styles.titlebar,
      MAC_TOOLBAR_CLASS,
      macVibrancyClass(titlebarMaterial),
    ].join(" ");

    return (
      <div
        ref={ref}
        className={cls}
        style={style}
        // Force the macOS look locally (resolves the vibrancy/selection/traffic
        // /toolbar classes even when the page itself is an iOS subtree).
        data-platform="macOS"
        data-design-mode={designMode}
        data-embedded={embedded ? "true" : undefined}
        data-window-active={active ? "true" : "false"}
      >
        <div className={titlebarCls}>
          <div className={styles.titlebarLeading}>
            {hideTrafficLights ? null : (
              <TrafficLights
                active={active}
                onClose={onClose}
                onMinimize={onMinimize}
                onZoom={onZoom}
              />
            )}
            {toolbarLeading}
          </div>

          {title != null ? (
            <div className={styles.titlebarTitle}>
              {title}
              {subtitle != null ? (
                <span className={styles.titlebarSubtitle}>{subtitle}</span>
              ) : null}
            </div>
          ) : null}

          <div className={styles.titlebarTrailing}>{toolbarTrailing}</div>
        </div>

        <div className={styles.windowBody}>{children}</div>
      </div>
    );
  },
);

WindowChrome.displayName = "WindowChrome";
