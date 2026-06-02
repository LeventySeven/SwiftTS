"use client";
import * as React from "react";
import {
  Button,
  Sheet,
  Detents,
  Alert,
  AlertButton,
  ConfirmationDialog,
  DialogButton,
  Popover,
  ContextMenu,
  MenuButton,
  MenuDivider,
  Text,
  VStack,
} from "@sui";
import { GallerySection, Card, Cell } from "./chrome";

export function SectionPresentation(): React.ReactElement {
  const [sheet, setSheet] = React.useState(false);
  const [alert, setAlert] = React.useState(false);
  const [dialog, setDialog] = React.useState(false);
  const [popover, setPopover] = React.useState(false);
  const [lastAction, setLastAction] = React.useState<string>("—");
  const popAnchor = React.useRef<HTMLButtonElement>(null);

  return (
    <GallerySection
      id="presentation"
      title="Presentation"
      subtitle="Sheet (detents), Alert, ConfirmationDialog, Popover, ContextMenu"
    >
      <Card title="Modal surfaces">
        <Cell align="center">
          <Button buttonStyle="borderedProminent" action={() => setSheet(true)}>
            Open Sheet
          </Button>
          <Button buttonStyle="bordered" action={() => setAlert(true)}>
            Show Alert
          </Button>
          <Button buttonStyle="bordered" role="destructive" action={() => setDialog(true)}>
            Confirmation Dialog
          </Button>
          <Button
            ref={popAnchor as unknown as React.Ref<HTMLButtonElement>}
            buttonStyle="bordered"
            action={() => setPopover((p) => !p)}
          >
            Popover
          </Button>
        </Cell>
        <div style={{ marginTop: 12 }}>
          <Text font="footnote" foregroundStyle="secondaryLabel">
            Last action: {lastAction}
          </Text>
        </div>
      </Card>

      <Card title="ContextMenu (long-press / right-click the card)">
        <ContextMenu
          menu={
            <>
              <MenuButton onAction={() => setLastAction("Copy")}>Copy</MenuButton>
              <MenuButton onAction={() => setLastAction("Duplicate")}>Duplicate</MenuButton>
              <MenuDivider />
              <MenuButton role="destructive" onAction={() => setLastAction("Delete")}>
                Delete
              </MenuButton>
            </>
          }
        >
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              background: "var(--sui-color-tertiary-system-fill)",
              textAlign: "center",
              userSelect: "none",
            }}
          >
            <Text font="headline">Long-press me</Text>
            <Text font="footnote" foregroundStyle="secondaryLabel" style={{ display: "block", marginTop: 4 }}>
              Reveals Copy · Duplicate · Delete
            </Text>
          </div>
        </ContextMenu>
      </Card>

      {/* ---- portaled surfaces ---- */}
      <Sheet
        isPresented={sheet}
        onIsPresentedChange={setSheet}
        detents={[Detents.medium, Detents.large]}
        dragIndicator="visible"
      >
        <VStack alignment="leading" spacing={12} style={{ padding: 20 }}>
          <Text font="title2">Sheet</Text>
          <Text font="body" foregroundStyle="secondaryLabel">
            Drag the grabber to resize between the .medium and .large detents, or
            swipe down to dismiss.
          </Text>
          <Button buttonStyle="borderedProminent" action={() => setSheet(false)}>
            Done
          </Button>
        </VStack>
      </Sheet>

      <Alert
        isPresented={alert}
        onIsPresentedChange={setAlert}
        title="Delete Photo?"
        message="This photo will be permanently removed from all devices."
      >
        <AlertButton role="destructive" onAction={() => setLastAction("Alert: Delete")}>
          Delete
        </AlertButton>
        <AlertButton role="cancel" onAction={() => setLastAction("Alert: Cancel")}>
          Cancel
        </AlertButton>
      </Alert>

      <ConfirmationDialog
        isPresented={dialog}
        onIsPresentedChange={setDialog}
        title="Are you sure?"
        message="You can’t undo this."
        titleVisibility="visible"
      >
        <DialogButton role="destructive" onAction={() => setLastAction("Dialog: Delete All")}>
          Delete All
        </DialogButton>
        <DialogButton onAction={() => setLastAction("Dialog: Archive")}>Archive</DialogButton>
        <DialogButton role="cancel" onAction={() => setLastAction("Dialog: Cancel")}>
          Cancel
        </DialogButton>
      </ConfirmationDialog>

      <Popover
        isPresented={popover}
        onIsPresentedChange={setPopover}
        anchorRef={popAnchor}
        arrowEdge="top"
      >
        <div style={{ padding: 16, maxWidth: 240 }}>
          <Text font="headline">Popover</Text>
          <Text font="footnote" foregroundStyle="secondaryLabel" style={{ display: "block", marginTop: 6 }}>
            Anchored to the button with an arrow. On narrow viewports it adapts to a
            sheet.
          </Text>
        </div>
      </Popover>
    </GallerySection>
  );
}
