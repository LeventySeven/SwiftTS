"use client";
/**
 * <Transition> — the React presence wrapper for SwiftUI's `.transition` (§4.5).
 *
 * SwiftUI animates a view's insert/remove when it appears/disappears under an
 * animation (typically an `if`/`ForEach`). CSS can't run an exit animation on an
 * already-unmounted element, so this wrapper keeps a removed child mounted until its
 * removal transition ends (the hand-rolled Framer-Motion presence pattern), driven by
 * `useMountTransition`.
 *
 * Usage mirrors SwiftUI:
 *   <Transition present={isOn} transition="scale" animation="bouncy">…</Transition>
 *   ≈  if isOn { View().transition(.scale) }   driven by  withAnimation(.bouncy)
 */
import { createElement, useEffect, useState } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import {
  useMountTransition,
  type AnimationToken,
  type TransitionPresetName,
  type TransitionStylesOptions,
} from "./animation";

export interface TransitionProps {
  /** Whether the child should be present (mounted + at identity). */
  present: boolean;
  /** The preset transition to play. Default `"opacity"` (SwiftUI's default). */
  transition?: TransitionPresetName;
  /** The driving animation. Default `"default"` (.smooth spring on iOS17+). */
  animation?: AnimationToken | null;
  /** Forwarded to `transitionStyles` (edge for move/push, scale, blurConfig). */
  transitionOptions?: TransitionStylesOptions;
  /** Element/tag (or component) to render as the host. Default `"div"`. */
  as?: ElementType;
  /** Extra class on the host. */
  className?: string;
  /** Extra inline style merged BELOW the transition-driven style. */
  style?: CSSProperties;
  /** Fired once the exit transition completes (node has unmounted). */
  onExited?: () => void;
  /** Fired once the enter transition completes. */
  onEntered?: () => void;
  children: ReactNode;
}

export function Transition({
  present,
  transition = "opacity",
  animation = "default",
  transitionOptions,
  as = "div",
  className,
  style,
  onExited,
  onEntered,
  children,
}: TransitionProps) {
  const { mounted, transition: transitionStr, style: phaseStyle } =
    useMountTransition(present, {
      transition,
      animation,
      transitionOptions,
      onExited,
      onEntered,
    });

  // Defer un-rendering by one tick so the exit transition's first frame paints.
  const [renderable, setRenderable] = useState(mounted);
  useEffect(() => {
    setRenderable(mounted);
  }, [mounted]);

  if (!mounted && !renderable) return null;

  return createElement(
    as,
    {
      className,
      style: {
        transition: transitionStr,
        ...phaseStyle,
        ...style,
      } as CSSProperties,
    },
    children,
  );
}
