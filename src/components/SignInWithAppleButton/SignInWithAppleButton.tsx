"use client";
/**
 * `SignInWithAppleButton` — from `AuthenticationServices.framework` (NOT in the
 * SwiftUI interface). Covered from Apple docs + RE (INFERRED).
 *
 * RE'd from `teardowns/SWIFTUI_C2_action-controls.md` §6.
 *
 *   SignInWithAppleButton(_ label:.signIn, onRequest:, onCompletion:)
 *   .signInWithAppleButtonStyle(.black | .white | .whiteOutline)
 *
 * Apple-mandated visuals (fixed proportions; do not restyle the logo/text unit).
 * Web equivalent of the auth flow = "Sign in with Apple JS" (`AppleID.auth`); here
 * the click just invokes `onRequest` then resolves `onCompletion`.
 */
import * as React from "react";
import { useIsDisabled } from "../controls/controlMachinery";
import styles from "./SignInWithAppleButton.module.css";

export type SIWALabel = "signIn" | "signUp" | "continue";
export type SIWAStyle = "black" | "white" | "whiteOutline";

const LABEL_TEXT: Record<SIWALabel, string> = {
  signIn: "Sign in with Apple",
  signUp: "Sign up with Apple",
  continue: "Continue with Apple",
};

export interface SignInWithAppleButtonProps {
  /** `.signIn` (default) / `.signUp` / `.continue`. */
  label?: SIWALabel;
  /** `.signInWithAppleButtonStyle(_:)`. */
  signInStyle?: SIWAStyle;
  /** Configure the ASAuthorization request (web: kick off AppleID.auth). */
  onRequest?: () => void;
  /** Auth result. */
  onCompletion?: (result: { ok: boolean }) => void;
  disabled?: boolean;
}

/** The Apple logo glyph as an inline SVG at fixed proportion. */
function AppleLogo() {
  return (
    <svg className={styles.appleLogo} viewBox="0 0 14 17" aria-hidden="true">
      <path d="M11.6 12.9c-.2.5-.5 1-.8 1.4-.4.6-.8 1-1 1.2-.4.4-.9.6-1.4.6-.4 0-.8-.1-1.3-.3-.5-.2-1-.3-1.4-.3-.4 0-.9.1-1.4.3-.5.2-.9.3-1.2.3-.5 0-1-.2-1.4-.6-.2-.2-.6-.6-1-1.2-.5-.7-.9-1.5-1.2-2.4C.4 11 .2 9.9.2 8.9c0-1.2.3-2.2.8-3 .4-.7.9-1.2 1.6-1.6.6-.4 1.3-.6 2.1-.6.4 0 1 .1 1.6.4.6.2 1 .4 1.2.4.1 0 .6-.2 1.4-.5.7-.2 1.4-.3 1.9-.3 1.4.1 2.5.7 3.2 1.7-1.3.8-1.9 1.9-1.9 3.3 0 1.1.4 2 1.2 2.7.4.3.8.6 1.2.7-.1.3-.2.6-.3.8zM9.4 1.2c0 .9-.3 1.7-1 2.5-.7.9-1.6 1.4-2.6 1.3 0-.1 0-.2 0-.3 0-.8.4-1.7 1-2.4.3-.4.8-.7 1.3-.9.5-.2 1-.3 1.4-.3 0 .1 0 .2 0 .3z" />
    </svg>
  );
}

export const SignInWithAppleButton = React.forwardRef<
  HTMLButtonElement,
  SignInWithAppleButtonProps
>(function SignInWithAppleButton(
  { label = "signIn", signInStyle = "black", onRequest, onCompletion, disabled },
  ref,
) {
  const isDisabled = useIsDisabled(disabled);
  const handleClick = () => {
    onRequest?.();
    onCompletion?.({ ok: true });
  };
  return (
    <button
      ref={ref}
      type="button"
      className={styles.siwa}
      data-style={signInStyle}
      disabled={isDisabled}
      onClick={handleClick}
    >
      <AppleLogo />
      {LABEL_TEXT[label]}
    </button>
  );
});

SignInWithAppleButton.displayName = "SignInWithAppleButton";
