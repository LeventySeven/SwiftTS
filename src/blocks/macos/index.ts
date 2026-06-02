/**
 * macos — macOS WINDOW CHROME blocks.
 *
 * Polished, drop-in macOS (Tahoe/26 Liquid-Glass) desktop window surfaces built
 * on the kit's macOS PLATFORM layer (system/platform.ts + system/macos.global.css:
 * NSVisualEffectView vibrancy materials, traffic-light cluster, unified-toolbar
 * strip, accent selection pill, source-list row densities).
 *
 * Drop a whole desktop app window:
 *   <MacWindow title="Mail" sidebarSections={…} selection={id} onSelect={…}
 *              toolbarTrailing={<ToolbarSearchField …/>}>…</MacWindow>
 *
 * Or compose the parts:
 *   <WindowChrome title=… toolbarTrailing={…}>
 *     <MacSplitView sidebar={<MacSidebar sections={…}/>} inspector={…}>…</MacSplitView>
 *   </WindowChrome>
 *
 * Pieces:
 *   - WindowChrome    — the window frame (corners + shadow + unified toolbar row
 *                       with traffic lights + centered title + leading/trailing slots)
 *   - TrafficLights   — the close/minimize/zoom dot cluster (reveal-on-hover glyphs)
 *   - MacToolbar      — toolbar item set: ToolbarIconButton / ToolbarSegmented /
 *                       ToolbarSearchField / ToolbarDivider / ToolbarSpacer
 *   - MacSidebar      — translucent vibrant source list (sections + selectable
 *                       rows + count badges + collapsible sections)
 *   - MacSplitView    — sidebar | content (| inspector) with draggable dividers
 *   - MacWindow       — the composed, ready-to-use desktop app window
 */

/* ── window frame + chrome ── */
export { WindowChrome } from "./WindowChrome";
export type { WindowChromeProps } from "./WindowChrome";

export { TrafficLights } from "./TrafficLights";
export type { TrafficLightsProps } from "./TrafficLights";

/* ── unified-toolbar items ── */
export {
  MacToolbar,
  ToolbarIconButton,
  ToolbarSegmented,
  ToolbarSearchField,
  ToolbarDivider,
  ToolbarSpacer,
} from "./MacToolbar";
export type {
  MacToolbarProps,
  MacToolbarEntry,
  ToolbarIconButtonProps,
  ToolbarSegmentedProps,
  ToolbarSegmentOption,
  ToolbarSearchFieldProps,
} from "./MacToolbar";

/* ── sidebar (source list) ── */
export { MacSidebar, MacSidebarSection, MacSidebarRow } from "./MacSidebar";
export type {
  MacSidebarProps,
  MacSidebarSectionData,
  MacSidebarSectionProps,
  MacSidebarItem,
  MacSidebarRowProps,
} from "./MacSidebar";

/* ── split view ── */
export { MacSplitView } from "./MacSplitView";
export type { MacSplitViewProps } from "./MacSplitView";

/* ── composed window ── */
export { MacWindow } from "./MacWindow";
export type { MacWindowProps } from "./MacWindow";
