/**
 * Presentation / Modal cluster barrel — SwiftUI Cluster C8.
 * RE'd from `teardowns/SWIFTUI_C8_presentation-modal.md`.
 *
 * Sheets, full-screen covers, popovers, alerts, confirmation dialogs, and context
 * menus — all implemented as React portals (createPortal) into a single
 * `#sui-presentation-root` host. Each surface ships BOTH a declarative component
 * (`<Sheet isPresented detents>`) and an imperative hook (`useSheet`, `useAlert`, …).
 */

// Shared infrastructure (§9).
export * from "./PresentationRoot";

// Liquid-Glass chrome switch + class helpers (iOS-26 design language).
export * from "./glassChrome";

// The six presentation surfaces.
export * from "./Sheet";
export * from "./FullScreenCover";
export * from "./Popover";
export * from "./Alert";
export * from "./ConfirmationDialog";
export * from "./ContextMenu";
