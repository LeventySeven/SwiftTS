"use client";
/**
 * `ConfirmationDialog` — SwiftUI's action sheet from the bottom (C8 §5).
 *
 * Mirrors `confirmationDialog(_:isPresented:titleVisibility:actions:message:)` and
 * the legacy `ActionSheet(title:message:buttons:)` value type. The signature trait:
 * a `.cancel` button is HOISTED into its own separated card below the action group
 * (the iOS action-sheet convention). `.destructive` → red. Scrim tap = cancel.
 *
 * On regular/wide width (≥768px) it adapts to a `<Popover>` anchored to the trigger
 * (iPad behavior), mirroring `presentationCompactAdaptation`.
 */
import * as React from "react";
import {
  PresentationPortal,
  PRESENTATION_Z,
  usePresentation,
  Scrim,
  useFocusTrap,
} from "./PresentationRoot";
import { Popover, type PopoverProps } from "./Popover";
import { springCss } from "../../system/animation";
import type { PresentationAdaptation } from "./Sheet";
import styles from "./ConfirmationDialog.module.css";

export type DialogButtonRole = "default" | "cancel" | "destructive";
export type DialogTitleVisibility = "automatic" | "visible" | "hidden";

export interface DialogButtonProps {
  role?: DialogButtonRole;
  onAction?: () => void;
  children: React.ReactNode;
}

/** `<Dialog.Button>` marker — the `<ConfirmationDialog>` parent reads its props. */
export function DialogButton(_props: DialogButtonProps): React.JSX.Element | null {
  return null;
}
DialogButton.displayName = "Dialog.Button";

interface ParsedDialogButton {
  role: DialogButtonRole;
  onAction?: () => void;
  label: React.ReactNode;
}

function parseDialogButtons(children: React.ReactNode): ParsedDialogButton[] {
  const out: ParsedDialogButton[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const t = child.type as { displayName?: string };
    if (t?.displayName !== "Dialog.Button") return;
    const p = child.props as DialogButtonProps;
    out.push({ role: p.role ?? "default", onAction: p.onAction, label: p.children });
  });
  return out;
}

export interface ConfirmationDialogProps {
  isPresented: boolean;
  onIsPresentedChange?: (next: boolean) => void;
  onDismiss?: () => void;
  title: React.ReactNode;
  message?: React.ReactNode;
  /** `.automatic` (show iff message exists) | `.visible` | `.hidden`. */
  titleVisibility?: DialogTitleVisibility;
  /** `presentationCompactAdaptation` — popover on regular width. */
  compactAdaptation?: PresentationAdaptation;
  /** Anchor for the wide-width popover adaptation (optional). */
  anchorRef?: PopoverProps["anchorRef"];
  /** Above this width, render as a popover (DESIGNED, default 768). */
  regularBreakpoint?: number;
  children?: React.ReactNode;
}

export function ConfirmationDialog(
  props: ConfirmationDialogProps,
): React.JSX.Element {
  const {
    isPresented,
    onIsPresentedChange,
    onDismiss,
    title,
    message,
    titleVisibility = "automatic",
    compactAdaptation = "automatic",
    anchorRef,
    regularBreakpoint = 768,
    children,
  } = props;

  const { mounted, dataState, reduceMotion, surfaceProps } = usePresentation({
    isPresented,
    onDismiss,
    animation: "smooth",
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [regular, setRegular] = React.useState(false);

  const dismiss = React.useCallback(
    () => onIsPresentedChange?.(false),
    [onIsPresentedChange],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () =>
      setRegular(
        compactAdaptation !== "sheet" &&
          compactAdaptation !== "none" &&
          Boolean(anchorRef) &&
          window.innerWidth >= regularBreakpoint,
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [compactAdaptation, anchorRef, regularBreakpoint]);

  const parsed = parseDialogButtons(children);
  const actionButtons = parsed.filter((b) => b.role !== "cancel");
  const cancelButton = parsed.find((b) => b.role === "cancel");

  const runButton = React.useCallback(
    (b: ParsedDialogButton) => {
      b.onAction?.();
      dismiss();
    },
    [dismiss],
  );

  const showTitle =
    titleVisibility === "visible" ||
    (titleVisibility === "automatic" && message != null);

  // Esc = cancel.
  useFocusTrap(containerRef, mounted && isPresented && !regular, {
    onEscape: () => (cancelButton ? runButton(cancelButton) : dismiss()),
    autoFocus: true,
  });

  if (!mounted) return <></>;

  // Wide-width popover adaptation (iPad).
  if (regular && anchorRef) {
    return (
      <Popover
        isPresented={isPresented}
        onIsPresentedChange={onIsPresentedChange}
        onDismiss={onDismiss}
        anchorRef={anchorRef}
        arrowEdge={null}
        compactAdaptation="popover"
      >
        <div style={{ minWidth: 220, padding: 6 }}>
          {(showTitle || message) && (
            <div className={styles.header}>
              {showTitle && <div className={styles.title}>{title}</div>}
              {message != null && <div className={styles.msg}>{message}</div>}
            </div>
          )}
          {parsed.map((b, i) => (
            <button
              key={i}
              type="button"
              className={styles.btn}
              data-role={b.role}
              style={{ minHeight: 44, fontSize: 17 }}
              onClick={() => runButton(b)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </Popover>
    );
  }

  const presented = dataState === "presented";
  const stackTransition = reduceMotion
    ? "opacity 0.2s linear"
    : springCss("smooth", { property: "transform" });
  const scrimTransition = reduceMotion
    ? "opacity 0.2s linear"
    : springCss("smooth", { property: "opacity" });

  return (
    <PresentationPortal zIndex={PRESENTATION_Z.confirmationDialog}>
      <div
        ref={containerRef}
        className={styles.host}
        role="dialog"
        aria-modal={true}
        aria-label={typeof title === "string" ? title : "Confirmation dialog"}
      >
        <Scrim
          opacity={0.3}
          presented={presented}
          interactive={false}
          onTap={() => (cancelButton ? runButton(cancelButton) : dismiss())}
          transition={scrimTransition}
          className={styles.scrim}
        />
        <div
          className={styles.stack}
          data-state={dataState}
          onTransitionEnd={surfaceProps.onTransitionEnd}
          style={{ transition: stackTransition }}
        >
          <div className={styles.group}>
            {(showTitle || message) && (
              <div className={styles.header}>
                {showTitle && <div className={styles.title}>{title}</div>}
                {message != null && <div className={styles.msg}>{message}</div>}
              </div>
            )}
            {actionButtons.map((b, i) => (
              <button
                key={i}
                type="button"
                className={styles.btn}
                data-role={b.role}
                onClick={() => runButton(b)}
              >
                {b.label}
              </button>
            ))}
          </div>
          {cancelButton && (
            <div className={styles.cancel}>
              <button
                type="button"
                className={styles.btn}
                data-role="cancel"
                onClick={() => runButton(cancelButton)}
              >
                {cancelButton.label}
              </button>
            </div>
          )}
        </div>
      </div>
    </PresentationPortal>
  );
}

ConfirmationDialog.Button = DialogButton;

/* ===========================================================================
 * Legacy ActionSheet value type sugar (§5.2).
 * ======================================================================== */

export interface ActionSheetButton {
  role: DialogButtonRole;
  label: React.ReactNode;
  action?: () => void;
}

export const ActionSheetButtonFactory = {
  default: (label: React.ReactNode, action?: () => void): ActionSheetButton => ({
    role: "default",
    label,
    action,
  }),
  cancel: (label: React.ReactNode = "Cancel", action?: () => void): ActionSheetButton => ({
    role: "cancel",
    label,
    action,
  }),
  destructive: (label: React.ReactNode, action?: () => void): ActionSheetButton => ({
    role: "destructive",
    label,
    action,
  }),
};

export interface ActionSheetProps {
  isPresented: boolean;
  onIsPresentedChange?: (next: boolean) => void;
  onDismiss?: () => void;
  title: React.ReactNode;
  message?: React.ReactNode;
  buttons?: ActionSheetButton[];
  anchorRef?: PopoverProps["anchorRef"];
}

/** `ActionSheet(title:message:buttons:)` mapped onto `<ConfirmationDialog>`. */
export function ActionSheet(props: ActionSheetProps): React.JSX.Element {
  const { buttons = [ActionSheetButtonFactory.cancel()], title, message, ...rest } = props;
  return (
    <ConfirmationDialog {...rest} title={title} message={message} titleVisibility="automatic">
      {buttons.map((b, i) => (
        <DialogButton key={i} role={b.role} onAction={b.action}>
          {b.label}
        </DialogButton>
      ))}
    </ConfirmationDialog>
  );
}

/* ===========================================================================
 * useConfirmationDialog hook.
 * ======================================================================== */

export interface UseConfirmationDialogResult {
  isPresented: boolean;
  present: () => void;
  dismiss: () => void;
  bind: { isPresented: boolean; onIsPresentedChange: (next: boolean) => void };
}

export function useConfirmationDialog(initial = false): UseConfirmationDialogResult {
  const [isPresented, setPresented] = React.useState(initial);
  return {
    isPresented,
    present: React.useCallback(() => setPresented(true), []),
    dismiss: React.useCallback(() => setPresented(false), []),
    bind: { isPresented, onIsPresentedChange: setPresented },
  };
}
