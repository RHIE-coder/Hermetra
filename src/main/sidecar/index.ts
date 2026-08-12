import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SidecarSupervisor, type SidecarLaunchOptions, type SidecarProcess } from './supervisor';
import { hostSpoofOs } from './spoof';

/**
 * The infrastructure half: turns a real child process into the handle the
 * supervisor understands, and finds a Node runtime to run it with.
 */

/**
 * Node, not Electron. `process.execPath` is the Electron binary and its V8
 * segfaults on the sidecar's native dependency — see `launcher.mjs`. Resolution
 * walks candidates rather than pinning one, because dev, a built app and a
 * packaged app all start from different places:
 *
 *   HERMETRA_NODE   an explicit override, checked first and trusted
 *   bundled         the runtime shipped beside the app (packaging's job)
 *   PATH            whatever `node` the developer has
 *
 * Returns null when there is none. That is a reportable state, not a crash —
 * the screen says "no runtime" instead of the app dying on a spawn error.
 */
export function resolveNodeRuntime(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.HERMETRA_NODE;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const bundled = path.join(process.resourcesPath ?? '', 'node', process.platform === 'win32' ? 'node.exe' : 'node');
  if (process.resourcesPath && fs.existsSync(bundled)) return bundled;

  for (const dir of (env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, process.platform === 'win32' ? 'node.exe' : 'node');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Where `launcher.mjs` sits. Built output and source tree put it in different places. */
export function resolveLauncher(dirname: string): string | null {
  for (const p of [
    path.join(dirname, 'launcher.mjs'),
    path.join(dirname, 'sidecar', 'launcher.mjs'),
    path.join(process.resourcesPath ?? '', 'sidecar', 'launcher.mjs'),
  ]) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Where the Camoufox browser lives.
 *
 * `camoufox-js` defaults to a per-user cache directory and downloads into it on
 * first use — a 700 MB stall the first time someone presses start, and nothing
 * at all on a machine with no network. A packaged app therefore ships its own
 * copy under `resources/camoufox/`, staged by `scripts/bundle-camoufox.mjs`,
 * and points the child at it with `CAMOUFOX_INSTALL_DIR`.
 *
 * Order matches `resolveNodeRuntime()`: an explicit override is trusted first,
 * then the bundled copy. Returning null is the third answer and a good one —
 * with the variable unset, `camoufox-js` uses its own cache, which is what a
 * `npm run dev` checkout wants.
 *
 * `version.json` is what makes a directory count. A packaging step that died
 * midway leaves the folder there but unusable, and pointing at that is worse
 * than pointing at nothing: it reads as installed and then fails to launch.
 */
export function resolveCamoufoxDir(
  env: NodeJS.ProcessEnv = process.env,
  resourcesPath: string | undefined = process.resourcesPath,
): string | null {
  const staged = (dir: string) => (fs.existsSync(path.join(dir, 'version.json')) ? dir : null);

  const explicit = env.CAMOUFOX_INSTALL_DIR;
  if (explicit) return fs.existsSync(explicit) ? explicit : null;

  if (!resourcesPath) return null;
  return staged(path.join(resourcesPath, 'camoufox'));
}

/**
 * The launch mode travels to the child as one environment variable, because a
 * child that is a different runtime cannot be handed an object.
 *
 * `launcher.mjs` treats `'0'` as the only value meaning "give it a window", so
 * the headless case is written explicitly rather than left unset — an inherited
 * value from the developer's shell must not decide this.
 *
 * The OS the browser claims rides along the same way — see `spoof.ts` for why it
 * is decided here rather than left to Camoufox.
 */
export function sidecarEnv(
  base: NodeJS.ProcessEnv,
  opts: SidecarLaunchOptions,
  resourcesPath: string | undefined = process.resourcesPath,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...base,
    HERMETRA_SIDECAR_HEADLESS: opts.headless ? '1' : '0',
  };

  // Written or deleted, never left to whatever the shell had: an inherited value
  // would decide what the browser claims to be, and an empty string would reach
  // Camoufox as an OS it rejects.
  const spoofOs = hostSpoofOs();
  if (spoofOs) env.HERMETRA_SIDECAR_OS = spoofOs;
  else delete env.HERMETRA_SIDECAR_OS;
  // Only when there is one. `camoufox-js` reads this at module load and an
  // empty or wrong value is not the same as an absent one.
  const camoufox = resolveCamoufoxDir(base, resourcesPath);
  if (camoufox) env.CAMOUFOX_INSTALL_DIR = camoufox;
  else delete env.CAMOUFOX_INSTALL_DIR;
  return env;
}

/**
 * Wraps a child so the supervisor sees whole lines.
 *
 * stdout arrives in arbitrary chunks — an endpoint can be split across two of
 * them, and two lines can share one. Buffering here means the supervisor's
 * matcher only ever sees complete lines.
 */
export function toSidecarProcess(child: {
  pid?: number;
  stdout: NodeJS.ReadableStream | null;
  on(event: 'exit', cb: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  on(event: 'error', cb: (err: Error) => void): unknown;
  kill(signal?: NodeJS.Signals): unknown;
}): SidecarProcess {
  let onLine: ((line: string) => void) | undefined;
  let onExit: ((code: number | null, signal: string | null) => void) | undefined;
  let buffered = '';

  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    buffered += chunk;
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    for (const line of lines) onLine?.(line.trim());
  });

  // A spawn that never started still has to reach the supervisor as a death,
  // otherwise it waits for an endpoint that is never coming.
  child.on('error', (err) => onExit?.(null, err.message));
  child.on('exit', (code, signal) => onExit?.(code, signal));

  return {
    pid: child.pid ?? null,
    onStdoutLine: (cb) => { onLine = cb; },
    onExit: (cb) => { onExit = cb; },
    kill: () => { child.kill('SIGTERM'); },
  };
}

export function createSidecarSupervisor(dirname: string): SidecarSupervisor {
  return new SidecarSupervisor({
    spawn: (launch) => {
      const node = resolveNodeRuntime();
      const launcher = resolveLauncher(dirname);
      if (!node || !launcher) {
        // Report the missing piece through the normal death path so the phase
        // and message land on the screen like any other failure.
        const why = !node ? 'no Node runtime found (set HERMETRA_NODE)' : 'launcher.mjs not found';
        return {
          pid: null,
          onStdoutLine: () => {},
          onExit: (cb) => { setTimeout(() => cb(null, why), 0); },
          kill: () => {},
        };
      }
      const child = spawn(node, [launcher], {
        cwd: path.dirname(launcher),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: sidecarEnv(process.env, launch),
      });
      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (d: string) => process.stderr.write(d));
      return toSidecarProcess(child);
    },
  });
}

export { SidecarSupervisor };
