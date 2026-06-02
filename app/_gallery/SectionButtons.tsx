"use client";
import * as React from "react";
import { Button } from "@sui";
import type { ButtonStyleName } from "@/system/styles";
import type { ControlSize } from "@/system/types";
import { GallerySection, Card, Cell } from "./chrome";

const STYLES: ButtonStyleName[] = [
  "automatic",
  "plain",
  "bordered",
  "borderedProminent",
  "borderless",
  "link",
  "glass",
  "glassProminent",
];

const SIZES: ControlSize[] = ["mini", "small", "regular", "large", "extraLarge"];

export function SectionButtons(): React.ReactElement {
  const [count, setCount] = React.useState(0);

  return (
    <GallerySection
      id="buttons"
      title="Buttons"
      subtitle="Every buttonStyle, role, disabled, and ControlSize"
    >
      <Card title="Button styles (.buttonStyle)">
        <Cell>
          {STYLES.map((s) => (
            <Button key={s} buttonStyle={s} action={() => setCount((c) => c + 1)}>
              {s}
            </Button>
          ))}
        </Cell>
      </Card>

      <Card title="With SF Symbol + interactive counter">
        <Cell align="center">
          <Button
            buttonStyle="borderedProminent"
            systemImage="plus"
            action={() => setCount((c) => c + 1)}
          >
            Add Item
          </Button>
          <Button buttonStyle="bordered" systemImage="minus" action={() => setCount((c) => Math.max(0, c - 1))}>
            Remove
          </Button>
          <span
            style={{
              fontSize: "var(--sui-text-body-size)",
              color: "var(--sui-color-secondary-label)",
            }}
          >
            Tapped {count} times
          </span>
        </Cell>
      </Card>

      <Card title="Roles — destructive / cancel / confirm">
        <Cell>
          <Button buttonStyle="bordered" role="destructive">
            Delete
          </Button>
          <Button buttonStyle="borderedProminent" role="destructive">
            Delete Account
          </Button>
          <Button buttonStyle="bordered" role="cancel">
            Cancel
          </Button>
          <Button buttonStyle="borderedProminent" role="confirm">
            OK
          </Button>
        </Cell>
      </Card>

      <Card title="Disabled state">
        <Cell>
          <Button buttonStyle="borderedProminent" disabled>
            Prominent
          </Button>
          <Button buttonStyle="bordered" disabled>
            Bordered
          </Button>
          <Button buttonStyle="automatic" disabled>
            Plain
          </Button>
          <Button buttonStyle="borderedProminent" role="destructive" disabled>
            Delete
          </Button>
        </Cell>
      </Card>

      <Card title="Control sizes (.controlSize)">
        <Cell align="center">
          {SIZES.map((size) => (
            <Button key={size} buttonStyle="borderedProminent" controlSize={size}>
              {size}
            </Button>
          ))}
        </Cell>
      </Card>

      <Card title="Border shapes (.buttonBorderShape)">
        <Cell align="center">
          <Button buttonStyle="bordered" borderShape="roundedRectangle">
            Rounded
          </Button>
          <Button buttonStyle="bordered" borderShape="capsule">
            Capsule
          </Button>
          <Button buttonStyle="borderedProminent" borderShape="capsule" systemImage="star.fill">
            Favorite
          </Button>
        </Cell>
      </Card>
    </GallerySection>
  );
}
