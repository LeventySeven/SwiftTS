"use client";
/**
 * TrafficLights — the macOS close / minimize / zoom dot cluster.
 *
 * Three 12px dots (red / yellow / green) wired to the platform layer's
 * `.sui-mac-traffic-lights` class (system/platform.ts → macos.global.css), which
 * supplies the dot geometry, the per-dot hues, the unfocused-gray state and the
 * reveal-on-hover behavior. This component only adds the GLYPHS (×, −, +) via the
 * per-dot module classes (`.trafficClose/.trafficMinimize/.trafficZoom`, whose
 * ::after content is the glyph the platform CSS reveals on cluster hover) and the
 * click handlers.
 *
 * Stateful via callbacks → `"use client"`. SSR-safe (no window/document reads).
 */
import * as React from "react";
import { MAC_TRAFFIC_LIGHTS_CLASS } from "../../system/platform";
import styles from "./macos.module.css";

export interface TrafficLightsProps {
  /** Window-active state — `false` grays all three dots (unfocused window). */
  active?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onZoom?: () => void;
  /** Disable the minimize / zoom dots (e.g. a sheet that can't be minimized). */
  disableMinimize?: boolean;
  disableZoom?: boolean;
  className?: string;
}

/** A single traffic-light dot — a button so it's keyboard-reachable + labeled. */
function Dot({
  glyphClass,
  label,
  onClick,
  disabled,
}: {
  glyphClass: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      className={glyphClass}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    />
  );
}

export function TrafficLights({
  active = true,
  onClose,
  onMinimize,
  onZoom,
  disableMinimize,
  disableZoom,
  className,
}: TrafficLightsProps): React.ReactElement {
  const cls = [MAC_TRAFFIC_LIGHTS_CLASS, className].filter(Boolean).join(" ");
  return (
    <div
      className={cls}
      data-window-active={active ? undefined : "false"}
      role="group"
      aria-label="Window controls"
    >
      <Dot glyphClass={styles.trafficClose} label="Close" onClick={onClose} />
      <Dot
        glyphClass={styles.trafficMinimize}
        label="Minimize"
        onClick={onMinimize}
        disabled={disableMinimize}
      />
      <Dot
        glyphClass={styles.trafficZoom}
        label="Zoom"
        onClick={onZoom}
        disabled={disableZoom}
      />
    </div>
  );
}

TrafficLights.displayName = "TrafficLights";
