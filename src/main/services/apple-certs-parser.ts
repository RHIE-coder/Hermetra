import type { AppleSigningIdentity } from '@shared/types/mobile';

/**
 * Pure parser for the output of `security find-identity -v -p codesigning`.
 *
 * Each identity line looks like:
 *   `  1) 4NC5GBGM93 "Apple Development: foo@bar.com (XYZ123)"`
 *
 * The trailing `N valid identities found` footer is ignored. Returns `[]`
 * when no identities are found.
 */
// Hash characters may include digits and uppercase letters (Apple uses
// alphanumeric SHA fingerprints, not strict hex).
const IDENTITY_RE = /^\s*\d+\)\s+([A-Z0-9]+)\s+"([^"]+)"\s*$/;

export function parseAppleCertsOutput(stdout: string): AppleSigningIdentity[] {
  if (!stdout) return [];
  const identities: AppleSigningIdentity[] = [];
  for (const rawLine of stdout.split(/\r?\n/)) {
    const match = IDENTITY_RE.exec(rawLine);
    if (!match) continue;
    const hash = match[1]!;
    const label = match[2]!;
    identities.push({ hash, label, fullLine: rawLine.trim() });
  }
  return identities;
}
