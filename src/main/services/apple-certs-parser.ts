import type { AppleSigningIdentity } from '@shared/types/mobile';

/**
 * Pure parser for the output of `security find-identity -v -p codesigning`.
 *
 * Each identity line looks like:
 *   `  1) 4NC5GBGM93 "Apple Development: foo@bar.com (XYZ123)"`
 *
 * Trailing/blank lines and the `N valid identities found` footer are ignored.
 * Returns `[]` when no identities are found (e.g. on non-macOS, where the
 * spawn is not even attempted — the caller passes an empty string).
 */
export function parseAppleCertsOutput(_stdout: string): AppleSigningIdentity[] {
  throw new Error('not implemented: parseAppleCertsOutput');
}
