"use client";
/**
 * `Picker` — SwiftUI Cluster C4 selection control.
 *
 * RE'd from `teardowns/SWIFTUI_C4_selection.md` §1.
 *
 *   Picker<Label, SelectionValue, Content>(selection:content:label:)
 *     .pickerStyle(.menu | .segmented | .wheel | .inline | .palette
 *                 | .navigationLink | .radioGroup | .automatic)
 *
 * Architecture (the central fact, spec §0): ONE headless React control + a `style`
 * prop that swaps the presentation layer — exactly mirroring SwiftUI's PickerStyle
 * protocol. Options are declared as `<PickerOption value=…>` children (== SwiftUI
 * `.tag(_:)`); the control collects them, matches each against `selection` by value
 * equality (Hashable → JS `===`), and the chosen sub-renderer paints the widget.
 *
 * High-fidelity piece: `.segmented` (§1.3) — equal-width grid, an absolutely-
 * positioned pill translated by selected index, spring slide via `springCss`,
 * semibold-on-select, fading inter-segment dividers.
 *
 * Styling modifier props pass through to <View> on the host element.
 */
import * as React from "react";
import { View, mergeStyles, type ViewProps } from "../View";
import { springCss } from "../../system/animation";
import { useResolvedStyle, type PickerStyleName } from "../../system/styles";
import { materialClass } from "../../system/effects";
import styles from "./Picker.module.css";

/** The Picker styles this kit renders (all 8 from the spec §1.2 table). */
export type PickerStyle = PickerStyleName;

/* ===========================================================================
 * PickerOption — the tagged option (== SwiftUI `.tag(value)` on a content view)
 * ======================================================================== */

export interface PickerOptionProps<T = unknown> {
  /** The tag — `selection === value` marks this option selected. */
  value: T;
  /** Optional swatch/icon color for `.palette` chips and leading glyphs. */
  color?: string;
  children?: React.ReactNode;
}

/**
 * `<PickerOption value>` is a declarative marker only — the parent `<Picker>`
 * reads its props via `React.Children`, so it never renders on its own.
 */
export function PickerOption<T = unknown>(_props: PickerOptionProps<T>): null {
  return null;
}
PickerOption.displayName = "PickerOption";

/** Internal: a normalized option extracted from the children. */
interface NormalizedOption<T> {
  value: T;
  label: React.ReactNode;
  color?: string;
}

function collectOptions<T>(children: React.ReactNode): NormalizedOption<T>[] {
  const out: NormalizedOption<T>[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as PickerOptionProps<T>;
    if (props == null || !("value" in props)) return;
    out.push({ value: props.value, label: props.children, color: props.color });
  });
  return out;
}

/* ===========================================================================
 * SF-symbol-ish inline glyphs (chevrons / checkmark) — no asset dependency
 * ======================================================================== */

const ChevronUpDown: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 11 14" fill="none" aria-hidden="true">
    <path d="M2 5.2 5.5 1.5 9 5.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 8.8 5.5 12.5 9 8.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 8 13" fill="none" aria-hidden="true">
    <path d="M1.5 1.5 6 6.5 1.5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Checkmark: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 17 17" fill="none" aria-hidden="true">
    <path d="M3 9.2 6.6 12.8 14 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ===========================================================================
 * Picker — the unified prop API (spec §1.11)
 * ======================================================================== */

export interface PickerProps<T = unknown> extends Omit<ViewProps, "onChange"> {
  /** Bound value (mirrors `Binding<SelectionValue>`). */
  selection: T;
  /** Selection write-back (mirrors the Binding setter). */
  onChange: (value: T) => void;
  /** Title; a string becomes Text. Pass `systemImage` for the Label form. */
  label?: React.ReactNode;
  /** SF Symbol name for the Label form (decorative here — name kept for parity). */
  systemImage?: string;
  /** iOS-18 collapsed-value override for `.menu`/`.navigationLink`. */
  currentValueLabel?: React.ReactNode;
  /** `.pickerStyle(_:)`. Falls back to inherited style → "automatic". */
  pickerStyle?: PickerStyle;
  disabled?: boolean;
  /** Models the `sources:` mixed-value state (collapsed control shows a dash). */
  indeterminate?: boolean;
  /** `<PickerOption value=…>` list (== the `.tag` content). */
  children?: React.ReactNode;
}

export function Picker<T = unknown>(props: PickerProps<T>): React.ReactElement {
  const {
    selection,
    onChange,
    label,
    systemImage: _systemImage,
    currentValueLabel,
    pickerStyle,
    disabled = false,
    indeterminate = false,
    children,
    style,
    ...viewRest
  } = props;

  // explicit prop > inherited .pickerStyle() container > "automatic"
  const resolved = useResolvedStyle("picker", pickerStyle);
  // web kit default for .automatic = menu (spec §1.10)
  const renderStyle: PickerStyle = resolved === "automatic" ? "menu" : resolved;

  const options = React.useMemo(() => collectOptions<T>(children), [children]);
  const selectedIndex = options.findIndex((o) => o.value === selection);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const collapsedValue = indeterminate
    ? "—"
    : (currentValueLabel ?? selectedOption?.label ?? "");

  const commonProps = {
    options,
    selection,
    selectedIndex,
    onChange,
    disabled,
  };

  let body: React.ReactNode;
  switch (renderStyle) {
    case "segmented":
      body = <SegmentedRenderer {...commonProps} />;
      break;
    case "wheel":
      body = <WheelRenderer {...commonProps} />;
      break;
    case "inline":
      body = <InlineRenderer {...commonProps} />;
      break;
    case "palette":
      body = <PaletteRenderer {...commonProps} />;
      break;
    case "navigationLink":
      body = <NavigationLinkRenderer {...commonProps} label={label} collapsedValue={collapsedValue} />;
      break;
    case "radioGroup":
      body = <RadioGroupRenderer {...commonProps} />;
      break;
    case "menu":
    default:
      body = <MenuRenderer {...commonProps} collapsedValue={collapsedValue} />;
      break;
  }

  return (
    <View style={style} {...viewRest}>
      {body}
    </View>
  );
}
Picker.displayName = "Picker";

/* ===========================================================================
 * Shared sub-renderer prop shape
 * ======================================================================== */

interface RendererProps<T> {
  options: NormalizedOption<T>[];
  selection: T;
  selectedIndex: number;
  onChange: (value: T) => void;
  disabled: boolean;
}

/* ===========================================================================
 * .segmented — the high-fidelity sliding-pill control (§1.3)
 * ======================================================================== */

function SegmentedRenderer<T>({
  options,
  selectedIndex,
  onChange,
  disabled,
}: RendererProps<T>): React.ReactElement {
  const count = Math.max(options.length, 1);
  const index = selectedIndex >= 0 ? selectedIndex : 0;

  const trackStyle: React.CSSProperties = {
    // drives the pill width/slot count + position (spec §1.3 web mapping)
    ["--seg-count" as string]: String(count),
    ["--seg-index" as string]: String(index),
  };

  // Apple "smooth-spring" slide — the response 0.35 / damping 0.8 interactive
  // spring (spec §1.3). Use the kit's spring token, scoped to transform.
  const pillStyle: React.CSSProperties = {
    transition: springCss("smooth", { property: "transform" }),
  };

  return (
    <div
      className={styles.seg}
      style={trackStyle}
      role="tablist"
      aria-orientation="horizontal"
      data-disabled={disabled || undefined}
    >
      <div className={styles.segPill} style={pillStyle} aria-hidden="true" />
      {options.map((opt, i) => {
        const isSelected = i === index;
        // dividers fade adjacent to the pill: hide the divider right after the
        // selected segment (the one BEFORE it is hidden by the selected rule).
        const adjacentPill = i === index + 1;
        return (
          <button
            key={i}
            type="button"
            className={styles.segOpt}
            role="tab"
            aria-selected={isSelected}
            data-adjacent-pill={adjacentPill || undefined}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ===========================================================================
 * .menu — button + popup listbox (§1.4)
 * ======================================================================== */

function MenuRenderer<T>({
  options,
  selection,
  onChange,
  disabled,
  collapsedValue,
}: RendererProps<T> & { collapsedValue: React.ReactNode }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // dismiss on outside click / Escape (spec §1.4 close behaviors)
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.menuPicker} ref={rootRef}>
      <button
        type="button"
        className={styles.menuBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{collapsedValue}</span>
        <ChevronUpDown className={styles.menuChev} />
      </button>
      {open && (
        <ul className={`${styles.menuPopover} ${materialClass("regular")}`} role="listbox">
          {options.map((opt, i) => {
            const isSelected = opt.value === selection;
            return (
              <li
                key={i}
                role="option"
                aria-selected={isSelected}
                className={styles.menuRow}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Checkmark className={styles.menuCheck} />
                <span>{opt.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ===========================================================================
 * .wheel — scroll-snap drum with barrel fade (§1.5)
 * ======================================================================== */

const WHEEL_ROW_H = 34; // §1.5 standard iOS row height

function WheelRenderer<T>({
  options,
  selectedIndex,
  onChange,
  disabled,
}: RendererProps<T>): React.ReactElement {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const rowRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const snapTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // per-row barrel transform: foreshorten + fade by distance from the center band
  const paint = React.useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const center = sc.scrollTop + sc.clientHeight / 2;
    rowRefs.current.forEach((row) => {
      if (!row) return;
      const rowCenter = row.offsetTop + row.offsetHeight / 2;
      const d = (rowCenter - center) / WHEEL_ROW_H;
      row.style.transform = `rotateX(${d * 20}deg) translateZ(-${Math.abs(d) * 10}px)`;
      row.style.opacity = String(1 - Math.min(0.85, Math.abs(d) * 0.28));
    });
  }, []);

  // center the selected row on mount / when selection changes externally
  React.useEffect(() => {
    const sc = scrollRef.current;
    if (!sc || selectedIndex < 0) return;
    sc.scrollTop = selectedIndex * WHEEL_ROW_H;
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const onScroll = React.useCallback(() => {
    paint();
    if (snapTimer.current) clearTimeout(snapTimer.current);
    // settle → select the nearest row (spec §1.5 snap + selection update)
    snapTimer.current = setTimeout(() => {
      const sc = scrollRef.current;
      if (!sc) return;
      const idx = Math.round(sc.scrollTop / WHEEL_ROW_H);
      const clamped = Math.max(0, Math.min(options.length - 1, idx));
      const opt = options[clamped];
      if (opt && opt.value !== options[selectedIndex]?.value) onChange(opt.value);
    }, 120);
  }, [options, onChange, selectedIndex, paint]);

  return (
    <div
      className={styles.wheel}
      ref={scrollRef}
      onScroll={disabled ? undefined : onScroll}
      data-disabled={disabled || undefined}
      role="listbox"
      aria-orientation="vertical"
    >
      <div className={styles.wheelBand} aria-hidden="true" />
      <div className={styles.wheelPad} aria-hidden="true" />
      {options.map((opt, i) => (
        <div
          key={i}
          ref={(el) => {
            rowRefs.current[i] = el;
          }}
          className={styles.wheelRow}
          role="option"
          aria-selected={i === selectedIndex}
        >
          {opt.label}
        </div>
      ))}
      <div className={styles.wheelPad} aria-hidden="true" />
    </div>
  );
}

/* ===========================================================================
 * .inline — flat checklist rows (§1.6)
 * ======================================================================== */

function InlineRenderer<T>({
  options,
  selection,
  onChange,
  disabled,
}: RendererProps<T>): React.ReactElement {
  return (
    <ul className={styles.inline} role="listbox" data-disabled={disabled || undefined}>
      {options.map((opt, i) => {
        const isSelected = opt.value === selection;
        return (
          <li key={i} role="presentation">
            <button
              type="button"
              className={styles.inlineRow}
              role="option"
              aria-selected={isSelected}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
            >
              <span>{opt.label}</span>
              <Checkmark className={styles.inlineCheck} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ===========================================================================
 * .palette — compact swatch/icon chips (§1.7)
 * ======================================================================== */

/** Plain-text accessible name for an option (used as the swatch's aria-label). */
function optionText(label: React.ReactNode): string | undefined {
  if (typeof label === "string") return label;
  if (typeof label === "number") return String(label);
  return undefined;
}

function PaletteRenderer<T>({
  options,
  selection,
  onChange,
  disabled,
}: RendererProps<T>): React.ReactElement {
  return (
    <div className={styles.palette} role="radiogroup" data-disabled={disabled || undefined}>
      {options.map((opt, i) => {
        const isSelected = opt.value === selection;
        // A color swatch: the chip IS the color — the ring goes in the swatch's
        // own color, and the label becomes the accessible name (no overlapping
        // text inside the tiny circle). A label-only chip renders readable text
        // in a pill that sizes to its content, selected ring in the tint.
        const isSwatch = opt.color != null;
        const name = optionText(opt.label);
        const swatchStyle = isSwatch
          ? ({
              ["--sui-palette-swatch" as string]: opt.color as string,
              // ring/highlight uses the swatch's own color (spec §1.7)
              ["--sui-color-tint" as string]: opt.color as string,
            } as React.CSSProperties)
          : undefined;
        return (
          <button
            key={i}
            type="button"
            className={isSwatch ? styles.paletteSwatch : styles.paletteChip}
            role="radio"
            aria-checked={isSelected}
            aria-selected={isSelected}
            aria-label={isSwatch ? name : undefined}
            title={isSwatch ? name : undefined}
            style={swatchStyle}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
          >
            {isSwatch ? null : <span className={styles.paletteChipLabel}>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ===========================================================================
 * .navigationLink — drill-in row → pushed option panel (§1.8)
 * ======================================================================== */

function NavigationLinkRenderer<T>({
  options,
  selection,
  onChange,
  disabled,
  label,
  collapsedValue,
}: RendererProps<T> & {
  label?: React.ReactNode;
  collapsedValue: React.ReactNode;
}): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className={styles.navRow}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className={styles.navLabel}>{label}</span>
        <span className={styles.navTrailing}>
          <span className={styles.navValue}>{collapsedValue}</span>
          <ChevronRight className={styles.navChev} />
        </span>
      </button>
      {open && (
        <ul className={styles.navPanel} role="listbox">
          {options.map((opt, i) => {
            const isSelected = opt.value === selection;
            return (
              <li key={i} role="presentation">
                <button
                  type="button"
                  className={styles.inlineRow}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  <Checkmark className={styles.inlineCheck} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ===========================================================================
 * .radioGroup (macOS) — vertical radios (§1.9)
 * ======================================================================== */

function RadioGroupRenderer<T>({
  options,
  selection,
  onChange,
  disabled,
}: RendererProps<T>): React.ReactElement {
  return (
    <div className={styles.radioGroup} role="radiogroup" data-disabled={disabled || undefined}>
      {options.map((opt, i) => {
        const isChecked = opt.value === selection;
        return (
          <div
            key={i}
            className={styles.radioRow}
            role="radio"
            aria-checked={isChecked}
            tabIndex={disabled ? -1 : 0}
            onClick={() => !disabled && onChange(opt.value)}
            onKeyDown={(e) => {
              if (!disabled && (e.key === " " || e.key === "Enter")) {
                e.preventDefault();
                onChange(opt.value);
              }
            }}
          >
            <span className={styles.radioRing}>
              <span className={styles.radioDot} />
            </span>
            <span>{opt.label}</span>
          </div>
        );
      })}
    </div>
  );
}
