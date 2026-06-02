"use client";
/**
 * SectionExtras — showcase for the four C1/C15 content primitives that ship in
 * the kit but had no gallery slot yet: AsyncImage, GroupBox, LabeledContent,
 * and ContentUnavailableView. Each demo mirrors its SwiftUI init shape 1:1.
 */
import * as React from "react";
import {
  AsyncImage,
  GroupBox,
  LabeledContent,
  ContentUnavailableView,
  Button,
} from "@sui";
import { GallerySection, Card, Cell, CellGrid } from "./chrome";

export function SectionExtras(): React.ReactElement {
  return (
    <GallerySection
      id="extras"
      title="More"
      subtitle="AsyncImage · GroupBox · LabeledContent · ContentUnavailableView"
    >
      {/* ---- AsyncImage ---- */}
      <Card title="AsyncImage">
        <CellGrid min={200}>
          <Cell label="loads from URL">
            <AsyncImage
              url="https://picsum.photos/200"
              style={{ width: 120, height: 120, borderRadius: 16 }}
            />
          </Cell>
          <Cell label="empty → placeholder">
            <AsyncImage
              url={null}
              style={{ width: 120, height: 120, borderRadius: 16 }}
            />
          </Cell>
        </CellGrid>
      </Card>

      {/* ---- GroupBox ---- */}
      <Card title="GroupBox">
        <GroupBox title="End-User Agreement">
          <LabeledContent label="Version" value="2.4.1" />
          <LabeledContent label="Updated" value="Jun 2, 2026" />
          <div style={{ color: "var(--sui-color-secondary-label)" }}>
            You agree to the terms by continuing. A titled rounded panel groups
            related content under a headline-weight label.
          </div>
        </GroupBox>
      </Card>

      {/* ---- LabeledContent ---- */}
      <Card title="LabeledContent">
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <LabeledContent label="Name" value="Craig Federighi" />
          <LabeledContent label="Title" value="SVP, Software" />
          <LabeledContent label="Location" value="Cupertino, CA" />
          <LabeledContent label="Status">
            <span style={{ color: "var(--sui-color-system-green)" }}>Active</span>
          </LabeledContent>
        </div>
      </Card>

      {/* ---- ContentUnavailableView ---- */}
      <Card title="ContentUnavailableView">
        <CellGrid min={260}>
          <Cell label="custom (icon + title + description + action)">
            <ContentUnavailableView
              title="No Mailboxes"
              systemImage="tray.fill"
              description="New mail you receive will appear here."
              actions={<Button title="Refresh" buttonStyle="borderedProminent" />}
            />
          </Cell>
          <Cell label=".search(text:)">
            <ContentUnavailableView.search text="swiftui" />
          </Cell>
        </CellGrid>
      </Card>
    </GallerySection>
  );
}
