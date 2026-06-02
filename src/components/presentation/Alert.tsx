"use client";
/**
 * `Alert` — SwiftUI's centered modal card + buttons (C8 §4).
 *
 * Replicates BOTH alert systems with one component:
 *   - the modern builder API: `alert(_:isPresented:actions:message:)` with
 *     `Button(role:)` children, and
 *   - the legacy `Alert` value type: `Alert(title:message:dismissButton:)` /
 *     `(title:message:primaryButton:secondaryButton:)` — exposed as `legacyAlert(...)`.
 *
 * Button ROLES (KNOWN, from the factory names): `default` (tint blue), `cancel`
 * (bold, dismiss, wired to Esc), `destructive` (red). Layout: 1–2 buttons row
 * (vertical hairline between); ≥3 buttons OR long labels stack vertically. Present =
 * scale 1.15→1.0 + fade over ≈0.25s; scrim tap does NOT dismiss (alerts are deliberate).
 */
import * as React from "react";
import {
  PresentationPortal,
  PRESENTATION_Z,
  usePresentation,
  Scrim,
  useFocusTrap,
} from "./PresentationRoot";
import { glass, glassClass } from "../../system/effects";
import {
  useLiquidGlass,
  glassScrimClass,
  glassRowClass,
  concentricVars,
  chromeClasses,
} from "./glassChrome";
import styles from "./Alert.module.css";

/* ===========================================================================
 * 1. Button role + <Alert.Button>.
 * ======================================================================== */

export type AlertButtonRole = "default" | "cancel" | "destructive";

export interface AlertButtonProps {
  /** `.default` (tint) | `.cancel` (bold, Esc) | `.destructive` (red). */
  role?: AlertButtonRole;
  /** The button's action; runs before the alert dismisses. */
  onAction?: () => void;
  children: React.ReactNode;
}

/**
 * `<Alert.Button>` — a declarative marker. It renders nothing itself; the `<Alert>`
 * parent reads its props (role/onAction/label) to build the button row. Mirrors a
 * `Button(role:)` inside the `actions:` builder.
 */
export function AlertButton(_props: AlertButtonProps): React.JSX.Element | null {
  return null;
}
AlertButton.displayName = "Alert.Button";

interface ParsedButton {
  role: AlertButtonRole;
  onAction?: () => void;
  label: React.ReactNode;
}

/** Pull the role/action/label out of `<Alert.Button>` children (skip non-markers). */
function parseButtons(children: React.ReactNode): ParsedButton[] {
  const out: ParsedButton[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const t = child.type as { displayName?: string };
    if (t?.displayName !== "Alert.Button") return;
    const p = child.props as AlertButtonProps;
    out.push({
      role: p.role ?? "default",
      onAction: p.onAction,
      label: p.children,
    });
  });
  return out;
}

/** Estimate label length for the stack-vs-row decision. */
function labelLength(node: React.ReactNode): number {
  if (typeof node === "string" || typeof node === "number") {
    return String(node).length;
  }
  return 6;
}

/* ===========================================================================
 * 2. DialogSeverity / suppression toggle (§7).
 * ======================================================================== */

export type DialogSeverity = "automatic" | "standard" | "critical";

export interface SuppressionToggle {
  label: string;
  isSuppressed: boolean;
  onChange: (next: boolean) => void;
}

/* ===========================================================================
 * 3. <Alert> props.
 * ======================================================================== */

export interface AlertProps {
  isPresented: boolean;
  onIsPresentedChange?: (next: boolean) => void;
  onDismiss?: () => void;
  /** `LocalizedStringKey` / `Text` title. */
  title: React.ReactNode;
  /** Optional message line. */
  message?: React.ReactNode;
  /** `dialogIcon` — large icon above the title. */
  icon?: React.ReactNode;
  /** `dialogSeverity`. */
  severity?: DialogSeverity;
  /** `dialogSuppressionToggle` — "Don't ask again". */
  suppressionToggle?: SuppressionToggle;
  /**
   * Liquid-Glass card override. Unset ⇒ follow `useEnvironment().liquidGlass`
   * (default glass). `false` ⇒ classic frosted Material alert card.
   */
  glass?: boolean;
  /** `<Alert.Button>` children (the `actions:` builder). */
  children?: React.ReactNode;
}

export function Alert(props: AlertProps): React.JSX.Element {
  const {
    isPresented,
    onIsPresentedChange,
    onDismiss,
    title,
    message,
    icon,
    severity = "automatic",
    suppressionToggle,
    glass: glassProp,
    children,
  } = props;

  const glassy = useLiquidGlass(glassProp);

  const { mounted, dataState, reduceMotion, surfaceProps } = usePresentation({
    isPresented,
    onDismiss,
    // Alerts use a quick spring (≈0.25s) not the long sheet spring.
    animation: "interactiveSpring",
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const msgId = React.useId();

  const dismiss = React.useCallback(
    () => onIsPresentedChange?.(false),
    [onIsPresentedChange],
  );

  const buttons = React.useMemo(() => {
    const parsed = parseButtons(children);
    // SwiftUI shows a default "OK" when no buttons are supplied.
    if (parsed.length === 0) {
      return [{ role: "cancel" as AlertButtonRole, onAction: undefined, label: "OK" }];
    }
    return parsed;
  }, [children]);

  // Layout: ≥3 buttons OR any long label ⇒ stacked; else row.
  const anyLong = buttons.some((b) => labelLength(b.label) > 10);
  const layout: "row" | "stacked" =
    buttons.length >= 3 || (buttons.length === 2 && anyLong) ? "stacked" : "row";

  const cancelButton = buttons.find((b) => b.role === "cancel");
  const defaultButton =
    buttons.find((b) => b.role !== "cancel") ?? buttons[0];

  const runButton = React.useCallback(
    (b: ParsedButton) => {
      b.onAction?.();
      dismiss();
    },
    [dismiss],
  );

  // Keyboard: Return → default button, Esc → cancel button.
  useFocusTrap(containerRef, mounted && isPresented, { autoFocus: true });
  React.useEffect(() => {
    if (!mounted || !isPresented) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (defaultButton) runButton(defaultButton);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (cancelButton) runButton(cancelButton);
        else dismiss();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [mounted, isPresented, defaultButton, cancelButton, runButton, dismiss]);

  if (!mounted) return <></>;

  const presented = dataState === "presented";
  const scrimTransition = reduceMotion ? "opacity 0.2s linear" : "opacity 0.25s ease";
  const cardTransition = reduceMotion
    ? "opacity 0.2s linear"
    : "opacity 0.25s ease, transform 0.25s cubic-bezier(0.2,0.8,0.2,1)";

  const criticalIcon =
    severity === "critical" && !icon ? (
      <span aria-hidden="true" style={{ fontSize: 36, color: "var(--sui-color-system-red, #ff3b30)" }}>
        ⚠️
      </span>
    ) : (
      icon
    );

  return (
    <PresentationPortal zIndex={PRESENTATION_Z.alert}>
      <div
        ref={containerRef}
        className={styles.host}
        role="alertdialog"
        aria-modal={true}
        aria-labelledby={titleId}
        aria-describedby={message != null ? msgId : undefined}
      >
        <Scrim
          opacity={glassy ? 1 : 0.3}
          presented={presented}
          interactive={false}
          transition={scrimTransition}
          className={chromeClasses(styles.scrim, glassScrimClass(glassy))}
        />
        <div
          className={chromeClasses(
            styles.card,
            glassy && styles.cardGlass,
            glassy && `${glassClass(glass.regular)} sui-glass-chrome`,
          )}
          data-state={dataState}
          data-buttons={layout}
          data-severity={severity}
          data-glass={glassy ? "true" : undefined}
          onTransitionEnd={surfaceProps.onTransitionEnd}
          style={{
            transition: cardTransition,
            ...(glassy ? concentricVars(14) : {}),
          }}
        >
          {criticalIcon != null && <div className={styles.icon}>{criticalIcon}</div>}
          <div className={styles.text}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {message != null && (
              <p id={msgId} className={styles.message}>
                {message}
              </p>
            )}
          </div>
          {suppressionToggle && (
            <label className={styles.suppression}>
              <input
                type="checkbox"
                checked={suppressionToggle.isSuppressed}
                onChange={(e) => suppressionToggle.onChange(e.target.checked)}
              />
              {suppressionToggle.label}
            </label>
          )}
          <div className={styles.buttons}>
            {buttons.map((b, i) => (
              <button
                key={i}
                type="button"
                className={chromeClasses(styles.btn, glassRowClass(glassy))}
                data-role={b.role}
                onClick={() => runButton(b)}
                autoFocus={b === defaultButton}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PresentationPortal>
  );
}

Alert.Button = AlertButton;

/* ===========================================================================
 * 4. Legacy `Alert` value type sugar (§4.1).
 * ======================================================================== */

export interface LegacyAlertButton {
  role: AlertButtonRole;
  label: React.ReactNode;
  action?: () => void;
}

export const AlertButtonFactory = {
  default: (label: React.ReactNode, action?: () => void): LegacyAlertButton => ({
    role: "default",
    label,
    action,
  }),
  cancel: (label: React.ReactNode = "Cancel", action?: () => void): LegacyAlertButton => ({
    role: "cancel",
    label,
    action,
  }),
  destructive: (label: React.ReactNode, action?: () => void): LegacyAlertButton => ({
    role: "destructive",
    label,
    action,
  }),
};

export interface LegacyAlertProps {
  isPresented: boolean;
  onIsPresentedChange?: (next: boolean) => void;
  onDismiss?: () => void;
  title: React.ReactNode;
  message?: React.ReactNode;
  /** 1-button form. */
  dismissButton?: LegacyAlertButton;
  /** 2-button form. */
  primaryButton?: LegacyAlertButton;
  secondaryButton?: LegacyAlertButton;
}

/**
 * `LegacyAlert` — the `Alert(title:message:dismissButton:)` /
 * `(primaryButton:secondaryButton:)` value-type API mapped onto `<Alert>`.
 */
export function LegacyAlert(props: LegacyAlertProps): React.JSX.Element {
  const {
    dismissButton,
    primaryButton,
    secondaryButton,
    title,
    message,
    ...rest
  } = props;
  const btns: LegacyAlertButton[] = [];
  if (primaryButton) btns.push(primaryButton);
  if (secondaryButton) btns.push(secondaryButton);
  if (dismissButton) btns.push(dismissButton);
  if (btns.length === 0) btns.push(AlertButtonFactory.cancel("OK"));

  return (
    <Alert {...rest} title={title} message={message}>
      {btns.map((b, i) => (
        <AlertButton key={i} role={b.role} onAction={b.action}>
          {b.label}
        </AlertButton>
      ))}
    </Alert>
  );
}

/* ===========================================================================
 * 5. useAlert hook (§ task requirement).
 * ======================================================================== */

export interface UseAlertResult {
  isPresented: boolean;
  present: () => void;
  dismiss: () => void;
  bind: { isPresented: boolean; onIsPresentedChange: (next: boolean) => void };
}

/**
 * `useAlert()` — owns the open state. Spread `bind` onto `<Alert>`.
 *
 *   const alert = useAlert();
 *   <button onClick={alert.present}>Delete…</button>
 *   <Alert {...alert.bind} title="Delete?" message="…">
 *     <Alert.Button role="cancel">Cancel</Alert.Button>
 *     <Alert.Button role="destructive" onAction={del}>Delete</Alert.Button>
 *   </Alert>
 */
export function useAlert(initial = false): UseAlertResult {
  const [isPresented, setPresented] = React.useState(initial);
  return {
    isPresented,
    present: React.useCallback(() => setPresented(true), []),
    dismiss: React.useCallback(() => setPresented(false), []),
    bind: { isPresented, onIsPresentedChange: setPresented },
  };
}
