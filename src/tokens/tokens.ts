/**
 * SwiftUI Web — typed, tree-shakeable design-token mirror.
 *
 * Mirrors the exact same values as variables.css (compiled 1:1 from the RE'd
 * SwiftUI token specs under swiftui/tokens/*.md). Values are strings with
 * px/units so they can be dropped straight into inline styles or compared
 * against the CSS layer. Color values here are the LIGHT-mode resolved values;
 * dark mode is handled at the CSS-variable layer (variables.css). For
 * theme-reactive consumption, reference the CSS var via `cssVar(...)`.
 */

export const tokens = {
  /* ===========================================================================
   * COLORS (light-mode resolved values)
   * ======================================================================== */
  color: {
    /* Label hierarchy */
    label: "#000000",
    secondaryLabel: "rgba(60, 60, 67, 0.6)",
    tertiaryLabel: "rgba(60, 60, 67, 0.3)",
    quaternaryLabel: "rgba(60, 60, 67, 0.18)",
    placeholderText: "rgba(60, 60, 67, 0.3)",
    quinaryLabel: "rgba(60, 60, 67, 0.1)",

    /* Backgrounds — base family */
    systemBackground: "#ffffff",
    secondarySystemBackground: "#f2f2f7",
    tertiarySystemBackground: "#ffffff",

    /* Backgrounds — grouped family */
    systemGroupedBackground: "#f2f2f7",
    secondarySystemGroupedBackground: "#ffffff",
    tertiarySystemGroupedBackground: "#f2f2f7",

    /* Fills */
    systemFill: "rgba(120, 120, 128, 0.2)",
    secondarySystemFill: "rgba(120, 120, 128, 0.16)",
    tertiarySystemFill: "rgba(118, 118, 128, 0.12)",
    quaternarySystemFill: "rgba(116, 116, 128, 0.08)",

    /* Separators & link */
    separator: "rgba(60, 60, 67, 0.29)",
    opaqueSeparator: "#c6c6c8",
    link: "#007aff",

    /* System color palette */
    systemRed: "#ff3b30",
    systemOrange: "#ff9500",
    systemYellow: "#ffcc00",
    systemGreen: "#34c759",
    systemMint: "#00c7be",
    systemTeal: "#30b0c7",
    systemCyan: "#32ade6",
    systemBlue: "#007aff",
    systemIndigo: "#5856d6",
    systemPurple: "#af52de",
    systemPink: "#ff2d55",
    systemBrown: "#a2845e",

    /* Gray ramp */
    systemGray: "#8e8e93",
    systemGray2: "#aeaeb2",
    systemGray3: "#c7c7cc",
    systemGray4: "#d1d1d6",
    systemGray5: "#e5e5ea",
    systemGray6: "#f2f2f7",

    /* Tint / accent */
    tint: "#007aff",

    /* Fixed colors */
    fixedWhite: "#ffffff",
    fixedBlack: "#000000",
    fixedClear: "rgba(0, 0, 0, 0)",
  },

  /* Hierarchy multipliers (ShapeStyle level cascade) */
  hierarchy: {
    primary: "1",
    secondary: "0.5",
    tertiary: "0.25",
    quaternary: "0.18",
    quinary: "0.1",
  },

  /* ===========================================================================
   * TYPOGRAPHY
   * ======================================================================== */
  font: {
    default:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    rounded:
      '"SF Pro Rounded", ui-rounded, system-ui, "Helvetica Neue", Arial, sans-serif',
    monospaced:
      'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Monaco, monospace',
    serif: 'ui-serif, "New York", Georgia, "Times New Roman", serif',
    stack:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    opticalCrossover: "20px",
  },

  weight: {
    ultraLight: "100",
    thin: "200",
    light: "300",
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    heavy: "800",
    black: "900",
  },

  /* Per-text-style metrics: size / weight / lineHeight / tracking */
  text: {
    largeTitle: {
      size: "34px",
      weight: "400",
      lineHeight: "41px",
      tracking: "0.37px",
    },
    title: {
      size: "28px",
      weight: "400",
      lineHeight: "34px",
      tracking: "0.36px",
    },
    title2: {
      size: "22px",
      weight: "400",
      lineHeight: "28px",
      tracking: "0.35px",
    },
    title3: {
      size: "20px",
      weight: "400",
      lineHeight: "25px",
      tracking: "0.38px",
    },
    headline: {
      size: "17px",
      weight: "600",
      lineHeight: "22px",
      tracking: "-0.41px",
    },
    subheadline: {
      size: "15px",
      weight: "400",
      lineHeight: "20px",
      tracking: "-0.24px",
    },
    body: {
      size: "17px",
      weight: "400",
      lineHeight: "22px",
      tracking: "-0.41px",
    },
    callout: {
      size: "16px",
      weight: "400",
      lineHeight: "21px",
      tracking: "-0.32px",
    },
    footnote: {
      size: "13px",
      weight: "400",
      lineHeight: "18px",
      tracking: "-0.08px",
    },
    caption: {
      size: "12px",
      weight: "400",
      lineHeight: "16px",
      tracking: "0px",
    },
    caption2: {
      size: "11px",
      weight: "400",
      lineHeight: "13px",
      tracking: "0.07px",
    },
  },

  /* ===========================================================================
   * SPACING
   * ======================================================================== */
  space: {
    stackDefault: "8px",
    paddingDefault: "16px",
    s2: "2px",
    s4: "4px",
    s8: "8px",
    s12: "12px",
    s16: "16px",
    s20: "20px",
    s24: "24px",
    s32: "32px",
    s40: "40px",
    s48: "48px",
    s64: "64px",
    listSectionSpacingDefault: "35px",
    listSectionSpacingCompact: "10px",
  },

  /* ===========================================================================
   * METRICS (sizes / hit targets / control deltas)
   * ======================================================================== */
  metric: {
    /* List / Form / Section */
    listRowMinHeight: "44px",
    listRowHeightSubtitle: "60px",
    listSeparatorInsetLeading: "16px",
    listSeparatorInsetTrailing: "0px",
    listSeparatorThickness: "0.5px",
    listRowContentInsetLeading: "16px",
    listRowContentInsetTrailing: "16px",
    listRowContentInsetVertical: "11px",
    formSectionHeaderTopInset: "16px",
    listGroupedHorizontalMargin: "16px",

    /* Tap target & hit */
    tapTarget: "44px",
    tapTargetMacOS: "28px",
    minControlHeight: "44px",

    /* Per-ControlSize (bordered / borderedProminent, iOS) */
    controlMiniHeight: "24px",
    controlMiniPaddingH: "8px",
    controlMiniPaddingV: "3px",
    controlMiniFont: "11px",
    controlMiniRadius: "5px",
    controlSmallHeight: "28px",
    controlSmallPaddingH: "10px",
    controlSmallPaddingV: "4px",
    controlSmallFont: "13px",
    controlSmallRadius: "6px",
    controlRegularHeight: "34px",
    controlRegularPaddingH: "14px",
    controlRegularPaddingV: "7px",
    controlRegularFont: "15px",
    controlRegularRadius: "8px",
    controlLargeHeight: "50px",
    controlLargePaddingH: "20px",
    controlLargePaddingV: "12px",
    controlLargeFont: "17px",
    controlLargeRadius: "12px",
    controlExtraLargeHeight: "56px",
    controlExtraLargePaddingH: "24px",
    controlExtraLargePaddingV: "15px",
    controlExtraLargeFont: "17px",
    controlExtraLargeRadius: "12px",

    /* Button-style default paddings (.regular) */
    buttonPaddingH: "14px",
    buttonPaddingV: "7px",

    /* Other control defaults */
    controlDefaultHeight: "34px",
    textFieldHeight: "34px",
    textFieldContentInsetH: "8px",
    toggleWidth: "51px",
    toggleHeight: "31px",
    toggleKnobDiameter: "27px",
    sliderTrackHeight: "4px",
    sliderThumbDiameter: "28px",
    navBarHeight: "44px",
    navBarLargeTitleHeight: "96px",
    tabBarHeight: "49px",
    sheetDetentGrabberInset: "8px",
  },

  /* ===========================================================================
   * RADII (continuous / squircle by default; values in px or %)
   * ======================================================================== */
  radius: {
    buttonSmall: "6px",
    button: "8px",
    buttonLarge: "12px",
    buttonCapsule: "9999px",
    card: "12px",
    listRowGrouped: "10px",
    textField: "8px",
    sheet: "10px",
    sheetLarge: "16px",
    alert: "14px",
    menu: "13px",
    iconApp: "22.37%",
    circle: "50%",
    continuousSmoothing: "0.6",
    continuousExponent: "5",
  },

  /* ===========================================================================
   * ANIMATION — { duration, css } pairs + legacy curves
   * ======================================================================== */
  anim: {
    smooth: {
      duration: "0.735s",
      css: "linear(0, 0.0575 4.2%, 0.1804 8.3%, 0.3209 12.5%, 0.4553 16.7%, 0.5731 20.8%, 0.6712 25%, 0.7502 29.2%, 0.8123 33.3%, 0.8602 37.5%, 0.8967 41.7%, 0.9241 45.8%, 0.9445 50%, 0.9597 54.2%, 0.9708 58.3%, 0.9789 62.5%, 0.9848 66.7%, 0.9891 70.8%, 0.9922 75%, 0.9945 79.2%, 0.9960 83.3%, 0.9972 87.5%, 0.9980 91.7%, 0.9986 95.8%, 1)",
      fallback: "cubic-bezier(0.33, 0, 0.13, 1)",
    },
    snappy: {
      duration: "0.697s",
      css: "linear(0, 0.0541 4.2%, 0.1761 8.3%, 0.3225 12.5%, 0.4678 16.7%, 0.5981 20.8%, 0.7076 25%, 0.7952 29.2%, 0.8624 33.3%, 0.9121 37.5%, 0.9474 41.7%, 0.9715 45.8%, 0.9873 50%, 0.9971 54.2%, 1.0026 58.3%, 1.0053 62.5%, 1.0062 66.7%, 1.0061 70.8%, 1.0055 75%, 1.0046 79.2%, 1.0037 83.3%, 1.0028 87.5%, 1.0021 91.7%, 1.0015 95.8%, 1)",
      fallback: "cubic-bezier(0.34, 1.3, 0.64, 1)",
    },
    bouncy: {
      duration: "0.819s",
      css: "linear(0, 0.0749 4.2%, 0.2420 8.3%, 0.4368 12.5%, 0.6204 16.7%, 0.7728 20.8%, 0.8874 25%, 0.9656 29.2%, 1.0131 33.3%, 1.0375 37.5%, 1.0457 41.7%, 1.0440 45.8%, 1.0371 50%, 1.0282 54.2%, 1.0195 58.3%, 1.0121 62.5%, 1.0064 66.7%, 1.0024 70.8%, 0.9998 75%, 0.9985 79.2%, 0.9979 83.3%, 0.9979 87.5%, 0.9982 91.7%, 0.9986 95.8%, 1)",
      fallback: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
    spring: {
      duration: "0.689s",
      css: "linear(0, 0.0738 5%, 0.2320 10%, 0.4108 15%, 0.5760 20%, 0.7128 25%, 0.8176 30%, 0.8930 35%, 0.9440 40%, 0.9763 45%, 0.9953 50%, 1.0052 55%, 1.0094 60%, 1.0102 65%, 1.0092 70%, 1.0075 75%, 1.0057 80%, 1.0041 85%, 1.0027 90%, 1.0017 95%, 1)",
    },
    interactiveSpring: {
      duration: "0.21s",
      css: "linear(0, 0.0752 5%, 0.2340 10%, 0.4108 15%, 0.5725 20%, 0.7054 25%, 0.8072 30%, 0.8807 35%, 0.9311 40%, 0.9640 45%, 0.9842 50%, 0.9958 55%, 1.0018 60%, 1.0044 65%, 1.0050 70%, 1.0046 75%, 1.0038 80%, 1.0030 85%, 1.0021 90%, 1.0015 95%, 1)",
    },
    default: {
      duration: "0.735s",
      css: "linear(0, 0.0575 4.2%, 0.1804 8.3%, 0.3209 12.5%, 0.4553 16.7%, 0.5731 20.8%, 0.6712 25%, 0.7502 29.2%, 0.8123 33.3%, 0.8602 37.5%, 0.8967 41.7%, 0.9241 45.8%, 0.9445 50%, 0.9597 54.2%, 0.9708 58.3%, 0.9789 62.5%, 0.9848 66.7%, 0.9891 70.8%, 0.9922 75%, 0.9945 79.2%, 0.9960 83.3%, 0.9972 87.5%, 0.9980 91.7%, 0.9986 95.8%, 1)",
    },
    /* Legacy timing curves (fixed 0.35s) */
    curveDuration: "0.35s",
    easeInOut: "cubic-bezier(0.42, 0, 0.58, 1)",
    easeIn: "cubic-bezier(0.42, 0, 1, 1)",
    easeOut: "cubic-bezier(0, 0, 0.58, 1)",
    linear: "linear",
    /* Modern circular UnitCurve approximations */
    circularEaseIn: "cubic-bezier(0.55, 0, 1, 0.45)",
    circularEaseOut: "cubic-bezier(0, 0.55, 0.45, 1)",
    circularEaseInOut: "cubic-bezier(0.85, 0, 0.15, 1)",
  },

  /* ===========================================================================
   * SHADOWS / STROKES / FOCUS / GRADIENTS
   * ======================================================================== */
  shadow: {
    defaultColor: "rgba(0, 0, 0, 0.33)",
    card: "0 1px 8px rgba(0, 0, 0, 0.12)",
    cardRaised: "0 4px 16px rgba(0, 0, 0, 0.16)",
    menu: "0 6px 24px rgba(0, 0, 0, 0.18)",
    sheet: "0 10px 40px rgba(0, 0, 0, 0.22)",
    alert: "0 12px 48px rgba(0, 0, 0, 0.25)",
  },

  stroke: {
    hairline: "0.5px",
    default: "1px",
    thick: "2px",
  },

  focusRing: {
    color: "#007aff",
    width: "3px",
    offset: "2px",
    opacity: "0.5",
  },

  gradient: {
    linearDefaultAngle: "180deg",
    linearHorizontalAngle: "90deg",
    linearDiagonalAngle: "135deg",
  },

  /* ===========================================================================
   * MATERIALS (frosted glass recipes — light tints; dark via CSS layer)
   * ======================================================================== */
  material: {
    saturate: "1.8",
    ultraThin: {
      blur: "20px",
      saturate: "1.8",
      tint: "rgba(255, 255, 255, 0.44)",
      tintDark: "rgba(37, 37, 37, 0.55)",
    },
    thin: {
      blur: "25px",
      saturate: "1.8",
      tint: "rgba(255, 255, 255, 0.55)",
      tintDark: "rgba(37, 37, 37, 0.66)",
    },
    regular: {
      blur: "30px",
      saturate: "1.8",
      tint: "rgba(245, 245, 245, 0.72)",
      tintDark: "rgba(30, 30, 30, 0.76)",
    },
    thick: {
      blur: "40px",
      saturate: "1.8",
      tint: "rgba(245, 245, 245, 0.82)",
      tintDark: "rgba(24, 24, 24, 0.84)",
    },
    ultraThick: {
      blur: "50px",
      saturate: "1.8",
      tint: "rgba(245, 245, 245, 0.9)",
      tintDark: "rgba(20, 20, 20, 0.92)",
    },
    bar: {
      blur: "30px",
      saturate: "1.8",
      tint: "rgba(245, 245, 245, 0.8)",
      tintDark: "rgba(30, 30, 30, 0.82)",
    },
    rim: "rgba(255, 255, 255, 0.18)",
    rimDark: "rgba(255, 255, 255, 0.1)",
  },

  /* Vibrancy (foreground-on-material) alphas */
  vibrancy: {
    primary: "1",
    secondary: "0.5",
    secondaryDark: "0.55",
    tertiary: "0.25",
    quaternary: "0.18",
    quaternaryDark: "0.16",
    quinary: "0.1",
  },
} as const;

/* =============================================================================
 * Helper types
 * ========================================================================== */
export type Tokens = typeof tokens;
export type ColorToken = keyof typeof tokens.color;
export type FontTextStyle = keyof typeof tokens.text;
export type SpaceToken = keyof typeof tokens.space;
export type RadiusToken = keyof typeof tokens.radius;
export type AnimToken = keyof typeof tokens.anim;
export type ShadowToken = keyof typeof tokens.shadow;
export type MaterialToken = keyof typeof tokens.material;

/**
 * Returns a `var(--sui-...)` reference for a token name. Pass the suffix after
 * the `--sui-` prefix (e.g. `cssVar("color-system-blue")` →
 * `"var(--sui-color-system-blue)"`). Accepts an optional fallback.
 */
export function cssVar(name: string, fallback?: string): string {
  const prefixed = name.startsWith("--sui-")
    ? name
    : name.startsWith("--")
      ? name
      : `--sui-${name}`;
  return fallback !== undefined
    ? `var(${prefixed}, ${fallback})`
    : `var(${prefixed})`;
}
