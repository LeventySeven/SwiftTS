"use client";
/**
 * `<ColorPicker>` — SwiftUI C3 value-input.
 * Mirrors `SwiftUI.ColorPicker` (SwiftUI:23334): a labeled swatch that opens the
 * system color picker. Spec: teardowns/SWIFTUI_C3_value-input.md §6.
 *
 *   ColorPicker("Accent", selection: $c)  ⇄  <ColorPicker label="Accent" color={c} onChange={setC} />
 *
 * The system picker chrome is NOT replicable on web (§6.3); the DESIGNED path is
 * the native `<input type="color">` as the picker surface, styled so its trigger
 * is our circular swatch. Native `<input type=color>` returns only opaque hex —
 * when `supportsOpacity` is true we preserve the incoming alpha, drive the input
 * with the opaque component, and recombine on change so the binding round-trips
 * `rgba()`. `supportsOpacity={false}` coerces every value to full alpha (the
 * SwiftUI contract that strips the picker's alpha slider).
 */
import * as React from "react";
import { View, type ViewProps } from "../View";
import type { ViewModifierProps } from "../../system/modifiers";
import styles from "./ColorPicker.module.css";

export interface ColorPickerProps extends ViewModifierProps {
  /** ⇄ `selection: Binding<Color>` (hex `#rrggbb`/`#rrggbbaa` or `rgba()`) */
  color: string;
  onChange: (color: string) => void;
  /** ⇄ `titleKey` / `label` */
  label?: string;
  /** ⇄ `supportsOpacity` (default true). false → strip alpha to full opacity */
  supportsOpacity?: boolean;
  /** swatch shape: circle (iOS) vs rounded well (macOS) */
  variant?: "ios" | "mac";
  /** ⇄ `.disabled(_:)` */
  disabled?: boolean;
}

/** Parse any CSS-ish color string into {hex6 (opaque), alpha 0..1}. */
function parseColor(input: string): { hex6: string; alpha: number } {
  const s = input.trim();
  // #rrggbbaa or #rrggbb or #rgb
  const hexMatch = /^#([0-9a-fA-F]{3,8})$/.exec(s);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const hex6 = `#${h.slice(0, 6).padEnd(6, "0")}`.toLowerCase();
    const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { hex6, alpha };
  }
  // rgb()/rgba()
  const rgbMatch =
    /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+%?))?\s*\)$/.exec(s);
  if (rgbMatch) {
    const r = clampByte(+rgbMatch[1]);
    const g = clampByte(+rgbMatch[2]);
    const b = clampByte(+rgbMatch[3]);
    let a = 1;
    if (rgbMatch[4] != null) {
      a = rgbMatch[4].endsWith("%")
        ? parseFloat(rgbMatch[4]) / 100
        : parseFloat(rgbMatch[4]);
    }
    return { hex6: `#${toHex(r)}${toHex(g)}${toHex(b)}`, alpha: clamp01(a) };
  }
  // fallback — let the browser default to black
  return { hex6: "#000000", alpha: 1 };
}

const clampByte = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const toHex = (n: number) => clampByte(n).toString(16).padStart(2, "0");

function hexToRgb(hex6: string): [number, number, number] {
  const h = hex6.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Compose the binding output: rgba() when alpha<1 (and opacity supported), else hex6. */
function composeColor(
  hex6: string,
  alpha: number,
  supportsOpacity: boolean,
): string {
  if (!supportsOpacity || alpha >= 1) return hex6;
  const [r, g, b] = hexToRgb(hex6);
  return `rgba(${r}, ${g}, ${b}, ${round3(alpha)})`;
}
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export const ColorPicker = React.forwardRef<HTMLDivElement, ColorPickerProps>(
  function ColorPicker(props, ref) {
    const {
      color,
      onChange,
      label,
      supportsOpacity = true,
      variant = "ios",
      disabled,
      ...modifierProps
    } = props;

    const { hex6, alpha } = parseColor(color);
    // when opacity is unsupported, the rendered swatch is always full-opacity
    const effectiveAlpha = supportsOpacity ? alpha : 1;
    // the full CSS color shown in the swatch (incl. alpha for the checkerboard)
    const swatchColor =
      supportsOpacity && effectiveAlpha < 1
        ? `rgba(${hexToRgb(hex6).join(", ")}, ${round3(effectiveAlpha)})`
        : hex6;

    const viewProps = modifierProps as ViewProps;
    const rowClass = [styles.row, variant === "mac" ? styles.mac : ""]
      .filter(Boolean)
      .join(" ");

    return (
      <View
        ref={ref as never}
        as="div"
        className={rowClass}
        data-disabled={!!disabled}
        {...viewProps}
      >
        {label != null ? <span className={styles.label}>{label}</span> : null}
        <label
          className={styles.swatch}
          style={{ ["--swatch" as never]: swatchColor }}
        >
          <input
            type="color"
            className={styles.input}
            value={hex6}
            aria-label={label ?? "Color"}
            disabled={disabled}
            onChange={(e) =>
              // preserve the current alpha (input only carries the opaque hex)
              onChange(
                composeColor(e.target.value, effectiveAlpha, supportsOpacity),
              )
            }
          />
        </label>
      </View>
    );
  },
);

ColorPicker.displayName = "ColorPicker";
