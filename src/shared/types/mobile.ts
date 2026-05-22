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
