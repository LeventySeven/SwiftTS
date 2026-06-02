/**
 * `AnyLayout` — `SwiftUICore.AnyLayout` (SwiftUICore :8072).
 *
 *   @frozen public struct AnyLayout : Layout, Sendable {
 *     public init<L>(_ layout: L) where L : Layout
 *   }
 *
 * `AnyLayout` type-erases a `Layout` so you can SWITCH the layout algorithm at
 * runtime while keeping child identity stable across the switch:
 *
 *   let layout = useWide ? AnyLayout(HStackLayout()) : AnyLayout(VStackLayout())
 *   layout { childA; childB }   // same children, different arrangement
 *
 * Because the children keep identity, SwiftUI animates the transition between the
 * two arrangements. On the web we get the same child-identity preservation for
 * free: React keeps the same elements mounted as long as their `key`s are stable,
 * so flipping the container element animates layout-driven CSS transitions.
 *
 * This implementation picks the matching layout primitive by a `layout` discriminant
 * (`'vstack' | 'hstack' | 'zstack' | 'grid'`) and forwards the rest of the props
 * to it. Modifier/styling props flow through the chosen primitive (each renders
 * through `<View>`), so `<AnyLayout layout="hstack" padding={8}>` works.
 *
 * Purely presentational; no client directive (the *caller* owns the state that
 * decides `layout`).
 */
import * as React from "react";
import { VStack, type VStackProps } from "../layout/VStack";
import { HStack, type HStackProps } from "../layout/HStack";
import { ZStack, type ZStackProps } from "../layout/ZStack";
import { Grid, type GridProps } from "../layout/Grid";

/** The runtime-selectable layout kinds. */
export type AnyLayoutKind = "vstack" | "hstack" | "zstack" | "grid";

/**
 * Discriminated union so each `layout` value accepts exactly that primitive's
 * props (e.g. `grid` requires `columns`, `hstack` accepts `spacing`).
 */
export type AnyLayoutProps =
  | ({ layout: "vstack" } & VStackProps)
  | ({ layout: "hstack" } & HStackProps)
  | ({ layout: "zstack" } & ZStackProps)
  | ({ layout: "grid" } & GridProps);

export function AnyLayout(props: AnyLayoutProps): React.ReactElement {
  switch (props.layout) {
    case "hstack": {
      const { layout: _l, ...rest } = props;
      return <HStack {...rest} />;
    }
    case "zstack": {
      const { layout: _l, ...rest } = props;
      return <ZStack {...rest} />;
    }
    case "grid": {
      const { layout: _l, ...rest } = props;
      return <Grid {...rest} />;
    }
    case "vstack":
    default: {
      const { layout: _l, ...rest } = props as { layout: "vstack" } & VStackProps;
      return <VStack {...rest} />;
    }
  }
}

AnyLayout.displayName = "AnyLayout";
