/**
 * `blocks/screens` — full composed SCREEN templates.
 *
 * Each export is a self-contained, drop-in iOS-style screen built ONLY from the
 * SwiftTS kit (NavigationStack / TabView / List / Section / Toggle / Slider /
 * Chart / GlassEffect / SymbolGlyph + tokens). Every screen wraps in a
 * phone-frame-agnostic root (`styles.scene`) that fills whatever the showcase
 * frames it into — pass each component straight into a phone frame.
 */
export { SettingsScreen } from "./SettingsScreen";
export type { SettingsScreenProps } from "./SettingsScreen";

export { DashboardScreen } from "./DashboardScreen";
export type { DashboardScreenProps } from "./DashboardScreen";

export { ProfileScreen } from "./ProfileScreen";
export type { ProfileScreenProps } from "./ProfileScreen";

export { SearchScreen } from "./SearchScreen";
export type { SearchScreenProps } from "./SearchScreen";

export { MediaPlayerScreen, MusicScreen } from "./MediaPlayerScreen";
export type { MediaPlayerScreenProps } from "./MediaPlayerScreen";
