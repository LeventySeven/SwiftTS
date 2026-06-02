"use client";
/**
 * MacWindow — a ready-to-drop macOS desktop APP WINDOW.
 *
 * Composes the whole desktop chrome: <WindowChrome> (frame + traffic lights +
 * unified toolbar) wrapping a <MacSplitView> that lays out a <MacSidebar>
 * (data-driven source list) | content | optional inspector. This is the
 * "everything-layer" for macOS — pass a title, sidebar sections, toolbar items,
 * and children, and you get a real Tahoe/26 Liquid-Glass app window.
 *
 * For finer control, compose the parts directly:
 *   <WindowChrome title=…><MacSplitView sidebar={<MacSidebar …/>}>…</MacSplitView></WindowChrome>
 *
 * Selection is controlled (`selection` + `onSelect`) and threads straight to the
 * sidebar. Toolbar slots accept any nodes (use the MacToolbar item components).
 *
 * Stateful (selection + window callbacks) → `"use client"`. SSR-safe.
 */
import * as React from "react";
import type { DesignMode } from "../../system/environment";
import type { MacVibrancyMaterial } from "../../system/platform";
import { WindowChrome } from "./WindowChrome";
import { MacSplitView } from "./MacSplitView";
import {
  MacSidebar,
  type MacSidebarSectionData,
} from "./MacSidebar";
import styles from "./macos.module.css";

export interface MacWindowProps {
  /** Centered title in the unified toolbar. */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;

  /** Sidebar source-list sections (data-driven). Omit + use `sidebar` for a node. */
  sidebarSections?: MacSidebarSectionData[];
  /** Custom sidebar node (overrides `sidebarSections`). Pass `null` for no sidebar. */
  sidebar?: React.ReactNode;
  /** Sidebar footer slot (account chip / settings). */
  sidebarFooter?: React.ReactNode;
  /** Sidebar width (px). Default 220. */
  sidebarWidth?: number;

  /** Selected sidebar row id (threads to the sidebar). */
  selection?: string;
  onSelect?: (id: string) => void;

  /** Leading / trailing unified-toolbar items (MacToolbar components). */
  toolbarLeading?: React.ReactNode;
  toolbarTrailing?: React.ReactNode;

  /** Optional 3rd inspector column. */
  inspector?: React.ReactNode;
  inspectorWidth?: number;

  /** Window-control callbacks + active state. */
  active?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onZoom?: () => void;

  /** Design language (default "liquidGlass") + embedded (drops the big shadow). */
  designMode?: DesignMode;
  embedded?: boolean;
  /** Titlebar vibrancy material (default "titlebar"). */
  titlebarMaterial?: MacVibrancyMaterial;
  /** Allow dragging the split dividers. Default true. */
  resizable?: boolean;

  /** Wrap content in the default 16/20 padding region. Default true. */
  padContent?: boolean;

  /** The main content. */
  children?: React.ReactNode;

  className?: string;
  style?: React.CSSProperties;
}

export const MacWindow = React.forwardRef<HTMLDivElement, MacWindowProps>(
  function MacWindow(
    {
      title,
      subtitle,
      sidebarSections,
      sidebar,
      sidebarFooter,
      sidebarWidth = 220,
      selection,
      onSelect,
      toolbarLeading,
      toolbarTrailing,
      inspector,
      inspectorWidth,
      active = true,
      onClose,
      onMinimize,
      onZoom,
      designMode = "liquidGlass",
      embedded,
      titlebarMaterial = "titlebar",
      resizable = true,
      padContent = true,
      children,
      className,
      style,
    },
    ref,
  ) {
    // Resolve the sidebar node: explicit `sidebar` wins; else build from sections;
    // else (sidebar === null OR no sections) render no sidebar pane.
    const sidebarNode =
      sidebar !== undefined
        ? sidebar
        : sidebarSections
          ? (
            <MacSidebar
              sections={sidebarSections}
              selection={selection}
              onSelect={onSelect}
              windowActive={active}
              width={sidebarWidth}
              footer={sidebarFooter}
            />
          )
          : null;

    const content = padContent ? (
      <div className={styles.contentPad}>{children}</div>
    ) : (
      children
    );

    return (
      <WindowChrome
        ref={ref}
        title={title}
        subtitle={subtitle}
        toolbarLeading={toolbarLeading}
        toolbarTrailing={toolbarTrailing}
        active={active}
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        designMode={designMode}
        embedded={embedded}
        titlebarMaterial={titlebarMaterial}
        className={className}
        style={style}
      >
        <MacSplitView
          sidebar={sidebarNode}
          inspector={inspector}
          defaultSidebarWidth={sidebarWidth}
          defaultInspectorWidth={inspectorWidth}
          resizable={resizable}
        >
          {content}
        </MacSplitView>
      </WindowChrome>
    );
  },
);

MacWindow.displayName = "MacWindow";
