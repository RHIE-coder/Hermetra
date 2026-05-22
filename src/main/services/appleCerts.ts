import { spawn } from 'node:child_process';
import type { AppleSigningIdentity } from '@shared/types/mobile';
import { parseAppleCertsOutput } from './apple-certs-parser';

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

export function createAppleCertsService(deps: AppleCertsDeps): AppleCertsService {
  return {
    async list() {
      if (deps.platform !== 'darwin') return { identities: [] };
      try {
        const stdout = await deps.runSecurity();
        return { identities: parseAppleCertsOutput(stdout) };
      } catch {
        return { identities: [] };
      }
    },
  };
}

function defaultRunSecurity(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn('security', ['find-identity', '-v', '-p', 'codesigning']);
    let stdout = '';
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf-8');
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`security exited with code ${code ?? 'unknown'}`));
    });
  });
}

let inst: AppleCertsService | null = null;

/**
 * Lazy singleton accessor for production wiring. Uses `process.platform` and
 * the real `security` CLI by default. Tests use `createAppleCertsService`
 * directly with injected deps.
 */
export function appleCertsService(): AppleCertsService {
  if (!inst) {
    inst = createAppleCertsService({
      platform: process.platform,
      runSecurity: defaultRunSecurity,
    });
  }
  return inst;
}
