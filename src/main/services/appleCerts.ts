import type { AppleSigningIdentity } from '@shared/types/mobile';

/**
 * macOS-only Apple signing-identity reader. Calls `security find-identity -v
 * -p codesigning`, parses the result via `apple-certs-parser`, and returns
 * the identities. On non-macOS, returns `{ identities: [] }` without spawning
 * any subprocess.
 *
 * The `spawn` collaborator is injected so tests can substitute a deterministic
 * fixture instead of relying on the real `security` CLI.
 */
export interface AppleCertsService {
  list(): Promise<{ identities: AppleSigningIdentity[] }>;
}

export interface AppleCertsDeps {
  /** Platform identifier (e.g. `process.platform`). Tests inject `'darwin'`
   *  or `'linux'` to drive the os branch. */
  platform: NodeJS.Platform;
  /** Runs `security find-identity -v -p codesigning` and returns stdout. */
  runSecurity: () => Promise<string>;
}

export function createAppleCertsService(_deps: AppleCertsDeps): AppleCertsService {
  return {
    async list() {
      throw new Error('not implemented: AppleCertsService.list');
    },
  };
}
