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
export function parseIdeviceinstallerOutput(stdout: string): InstalledApp[] {
  const lines = stdout.split('\n');
  const result: InstalledApp[] = [];
  let headerDropped = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;
    if (!headerDropped) {
      headerDropped = true;
      continue;
    }
    const cells = line.split(',').map((c) => c.trim());
    if (cells.length < 3) continue;
    const [bundleId, version, name] = cells;
    if (!bundleId || !version || !name) continue;
    result.push({ name, bundleId, version });
  }
  return result;
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
export function parseAdbPackagesOutput(stdout: string): InstalledApp[] {
  const lines = stdout.split('\n');
  const result: InstalledApp[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('package:')) continue;
    const match = /^package:(\S+?)(?:\s+versionCode:(\d+))?$/.exec(line);
    if (!match) continue;
    const bundleId = match[1];
    const version = match[2] ?? '';
    if (!bundleId) continue;
    result.push({ name: bundleId, bundleId, version });
  }
  return result;
}
