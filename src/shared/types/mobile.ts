export type MobilePlatform = 'android' | 'ios';

export interface ToolingStatus {
  appium: boolean;
  adb: boolean;
  libimobiledevice: boolean;
  appiumVersion?: string;
}

export type MobileDeviceStatus = 'connected' | 'disconnected';

export interface MobileDevice {
  id: string;
  name: string;
  platform: MobilePlatform;
  alias?: string;
  status: MobileDeviceStatus;
  /** Real device, emulator/simulator */
  kind?: 'real' | 'emulator' | 'simulator';
  lastSeenAt?: number;
}

export interface Capability {
  id: string;
  name: string;
  deviceId: string;
  platform: MobilePlatform;
  /** Appium automation engine, e.g. UiAutomator2 / XCUITest */
  automationName?: string;
  appPackage?: string;
  appActivity?: string;
  bundleId?: string;
  /** Free-form extra W3C capabilities (key/value strings). */
  extraJson?: string;
}

export interface AppiumServerStatus {
  isRunning: boolean;
  mode: 'local' | 'external' | null;
  url: string;
  version?: string;
}

export interface MobileScriptRunRequest {
  scriptId: string;
  source: string;
  capabilityId: string;
}

export interface MobileSessionStatus {
  active: boolean;
  capabilityId?: string;
  sessionId?: string;
  recording: boolean;
  startedAt?: number;
}

export interface CapabilityTestResult {
  ok: boolean;
  message: string;
  durationMs: number;
}

/**
 * An app installed on a connected device. Returned by
 * `MobileDriverApi.listInstalledApps(deviceId)`. Not persisted — fetched live
 * every time the user opens the Apps tab.
 */
export interface InstalledApp {
  name: string;
  bundleId: string;
  version: string;
}

/**
 * A per-workspace connection configuration.
 *
 * Stored in `<workspaceDir>/store.json` under `connections[]`. References a
 * `SavedDevice.id`. At most one connection per workspace may be active
 * (tracked by sibling `activeConnectionId` on store.json).
 */
export interface Connection {
  id: string;
  name: string;
  /** Reference to `SavedDevice.id`. */
  deviceId: string;
  platform: MobilePlatform;
  /** Bundle id (iOS) or app package (Android) of the selected app, if any. */
  bundleId?: string;
  /** iOS-only Team ID (xcodeOrgId). */
  xcodeOrgId?: string;
  /** iOS-only signing identity hash from the macOS keychain. */
  xcodeSigningId?: string;
  /** Extra Appium capability key/value pairs (spread into the capability dict). */
  extra: Record<string, string>;
}

/**
 * One signing identity reported by `security find-identity -v -p codesigning`
 * on macOS. `hash` is the leading SHA, `label` is the quoted descriptor, and
 * `fullLine` is the raw line preserved for use as the dropdown label.
 */
export interface AppleSigningIdentity {
  hash: string;
  label: string;
  fullLine: string;
}

/**
 * Result of `CONN_TEST` — an Appium dry-run for a given connection.
 */
export interface ConnectionTestResult {
  ok: boolean;
  durationMs: number;
  message: string;
}

/**
 * One node in the inspector element tree, returned by the native or webview
 * page-source parser. Used both by the IPC handler (`INSPECTOR_GET_ELEMENTS`)
 * and by the renderer to power the hit-test overlay and the detail panel.
 *
 * - `id` is hierarchical: `native:<i>:<j>:...` or `webview:<i>:<j>:...`. The
 *   root prefix lets the renderer keep both trees in one selectedElementId
 *   slot without collisions.
 * - `bounds` is `null` when the source has no rect attributes (e.g. the
 *   `<hierarchy>` root wrapper). The hit-test ignores those nodes.
 */
export interface InspectorElement {
  id: string;
  tag: string;
  attributes: Record<string, string>;
  bounds: { x: number; y: number; w: number; h: number } | null;
  children: InspectorElement[];
}

/**
 * Live state of the inspector session. Held in the mobile store. Never
 * persisted — restarting the app empties it (matches the session lifecycle).
 */
export interface InspectorSessionState {
  active: boolean;
  recording: boolean;
  /** 'native' or 'WEBVIEW_<bundle>' or null when inactive. */
  context: 'native' | string | null;
}

/**
 * A device the user has explicitly saved to their "My Devices" list.
 *
 * Stored in `<userData>/devices.json` (global, not per-workspace). Separate
 * from the live-detected `MobileDevice` so entries survive disconnect.
 */
export interface SavedDevice {
  /** Normalized key: `${platform}:${udid}`. */
  id: string;
  platform: MobilePlatform;
  /** Raw UDID/serial as reported by the OS. */
  udid: string;
  /** Device name at the time of first save. */
  name: string;
  /** Optional user-supplied alias (free-form). */
  alias?: string;
  kind?: 'real' | 'sim' | 'emu';
  /** ISO 8601 timestamp of the most recent detection. */
  lastConnectedAt: string;
}
