import type { InstalledApp } from '@shared/types/mobile';

/**
 * Pure parsers for the raw stdout of the platform CLIs. Isolated from the
 * driver so they can be unit-tested without spawning subprocesses.
 *
 * Each function returns `InstalledApp[]` (never throws on malformed input —
 * skips unparseable rows).
 */

/**
 * Parse `ideviceinstaller -l -o list_user` output (iOS real devices).
 *
 * Typical format (CSV with header):
 *
 *   CFBundleIdentifier, CFBundleVersion, CFBundleDisplayName
 *   com.example.app, 1.2.3, Example
 *   com.acme.thing, 4.5, Acme Thing
 *
 * The header line is dropped. Empty / malformed lines are skipped.
 */
export function parseIdeviceinstallerOutput(_stdout: string): InstalledApp[] {
  // Stub — implementer fills in.
  return [];
}

/**
 * Parse `adb shell cmd package list packages -3 --show-versioncode` output
 * (Android, third-party only). For app names we accept either an additional
 * stream parsed alongside or treat the bundleId as the name fallback.
 *
 * Typical input lines:
 *
 *   package:com.example.app versionCode:42
 *   package:com.acme.thing versionCode:1
 *
 * For now the parser returns the bundleId as the name (UI can override later).
 */
export function parseAdbPackagesOutput(_stdout: string): InstalledApp[] {
  // Stub — implementer fills in.
  return [];
}
