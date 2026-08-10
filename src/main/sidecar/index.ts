import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SidecarSupervisor, type SidecarProcess } from './supervisor';

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
    spawn: () => {
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
        env: { ...process.env },
      });
      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (d: string) => process.stderr.write(d));
      return toSidecarProcess(child);
    },
  });
}

export { SidecarSupervisor };
