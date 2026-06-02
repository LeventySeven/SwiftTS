"use client";
/**
 * `NavigationDestination` — registers a screen builder inside a `NavigationStack`.
 *
 * RE'd from `teardowns/SWIFTUI_C7_navigation.md` §10. Mirrors the three
 * `navigationDestination` overloads:
 *   - type form: `<NavigationDestination for="Recipe">{(r) => <RecipeDetail …/>}</…>`
 *     registers a builder in the stack's `Map<typeTag, (value)=>node>`; a
 *     matching `NavigationLink(value:)` push renders it.
 *   - isPresented form: `<NavigationDestination isPresented={b} onChange={set}>`
 *     pushes when `b` flips true and sets it false on pop.
 *   - item form: `<NavigationDestination item={x} onChange={set}>` pushes when
 *     `x` becomes non-null and nulls it on pop.
 *
 * Renders nothing — it is a registrar. Place it inside the stack (typically on
 * the root).
 */
import * as React from "react";
import { useNavigation } from "../NavigationContext";

export interface NavigationDestinationProps {
  /** Type form: the destination-type tag this builder serves. */
  for?: string;
  /** The builder. For the `for`/`item` forms it receives the pushed value. */
  children: ((value: any) => React.ReactNode) | React.ReactNode;
  /** isPresented form: push while true. */
  isPresented?: boolean;
  /** item form: push while non-null. */
  item?: unknown | null;
  /** Two-way binding setter for the isPresented/item forms (reset on pop). */
  onChange?: (next: any) => void;
  /** A title carried into the pushed bar (isPresented/item forms). */
  title?: string;
}

export function NavigationDestination({
  for: tag,
  children,
  isPresented,
  item,
  onChange,
  title,
}: NavigationDestinationProps) {
  const nav = useNavigation();

  /* type form — register the builder once (and on identity change). */
  React.useEffect(() => {
    if (tag && typeof children === "function") {
      nav.registerDestination(tag, (value) => (children as (v: any) => React.ReactNode)(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag, children]);

  /* isPresented form — push on true, the stack pop clears it via onChange. */
  const pushedRef = React.useRef(false);
  React.useEffect(() => {
    if (isPresented === undefined) return;
    if (isPresented && !pushedRef.current) {
      pushedRef.current = true;
      const view = typeof children === "function" ? (children as () => React.ReactNode)() : children;
      nav.pushView(view, title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresented]);

  // Reflect a pop back into the binding (path shrank ⇒ reset).
  React.useEffect(() => {
    if (isPresented === undefined) return;
    if (pushedRef.current && !nav.canPop) {
      pushedRef.current = false;
      if (isPresented) onChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.canPop]);

  /* item form — push when item becomes non-null. */
  const itemPushedRef = React.useRef(false);
  React.useEffect(() => {
    if (item === undefined) return;
    if (item != null && !itemPushedRef.current) {
      itemPushedRef.current = true;
      const view = typeof children === "function" ? (children as (v: any) => React.ReactNode)(item) : children;
      nav.pushView(view, title);
    } else if (item == null && itemPushedRef.current) {
      itemPushedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  React.useEffect(() => {
    if (item === undefined) return;
    if (itemPushedRef.current && !nav.canPop) {
      itemPushedRef.current = false;
      onChange?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.canPop]);

  return null;
}

NavigationDestination.displayName = "NavigationDestination";
