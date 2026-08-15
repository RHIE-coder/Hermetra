import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  toSidecarProcess,
  resolveNodeRuntime,
  resolveCamoufoxDir,
  sidecarEnv,
} from '@main/sidecar';
import { hostSpoofOs } from '@main/sidecar/spoof';
import { CHANNELS } from '@shared/ipc/channels';

/**
 * The infrastructure half of the sidecar: turning a real child into the handle
 * the supervisor understands, and finding a runtime to run it with.
 *
 * Spec: docs/spec/studio/README.md — `studio.sidecar`.
 */

function fakeChild() {
  const stdout = new EventEmitter() as EventEmitter & { setEncoding: (e: string) => void };
  stdout.setEncoding = () => {};
  const child = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: typeof stdout;
    stdin: { written: string[]; write: (s: string) => void } | null;
    kill: (s?: string) => void;
    killedWith: string | null;
  };
  child.pid = 777;
  child.stdout = stdout;
  const stdin = { written: [] as string[], write: (s: string) => stdin.written.push(s) };
  child.stdin = stdin;
  child.killedWith = null;
  child.kill = (s) => { child.killedWith = s ?? null; };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return child as any;
}

describe('sidecar adapter — stdout arrives in chunks, not lines', () => {
  it('reassembles an endpoint split across two chunks', () => {
    const child = fakeChild();
    const proc = toSidecarProcess(child);
    const lines: string[] = [];
    proc.onStdoutLine((l) => lines.push(l));

    child.stdout.emit('data', 'WS ws://127.0.0.1:');
    expect(lines).toEqual([]); // 반쪽 줄은 아직 줄이 아니다
    child.stdout.emit('data', '5111/abc\n');

    expect(lines).toEqual(['WS ws://127.0.0.1:5111/abc']);
  });

  it('splits two lines that arrived in one chunk', () => {
    const child = fakeChild();
    const proc = toSidecarProcess(child);
    const lines: string[] = [];
    proc.onStdoutLine((l) => lines.push(l));

    child.stdout.emit('data', 'noise\nWS ws://x/1\n');
    expect(lines).toEqual(['noise', 'WS ws://x/1']);
  });

  it('reports the pid it was given', () => {
    expect(toSidecarProcess(fakeChild()).pid).toBe(777);
  });

  it('writes requests onto the child stdin', () => {
    const child = fakeChild();
    toSidecarProcess(child).write('{"id":1,"op":"pages"}\n');
    expect(child.stdin.written).toEqual(['{"id":1,"op":"pages"}\n']);
  });

  it('survives a child with no stdin rather than throwing', () => {
    // The spawn-failed path builds a handle with no streams at all, and a
    // screen may still fire a request at it before the death lands.
    const child = fakeChild();
    child.stdin = null;
    expect(() => toSidecarProcess(child).write('{}\n')).not.toThrow();
  });

  it('kills with SIGTERM so the child can close the browser', () => {
    const child = fakeChild();
    toSidecarProcess(child).kill();
    expect(child.killedWith).toBe('SIGTERM');
  });
});

describe('sidecar adapter — a spawn that never starts is still a death', () => {
  it('turns a spawn error into an exit, so nothing waits forever', () => {
    const child = fakeChild();
    const proc = toSidecarProcess(child);
    const exits: (string | null)[] = [];
    proc.onExit((_code, signal) => exits.push(signal));

    child.emit('error', new Error('ENOENT'));
    expect(exits).toEqual(['ENOENT']);
  });

  it('passes a normal exit through with its code', () => {
    const child = fakeChild();
    const proc = toSidecarProcess(child);
    let seen: { code: number | null; signal: string | null } | null = null;
    proc.onExit((code, signal) => { seen = { code, signal }; });

    child.emit('exit', 3, null);
    expect(seen).toEqual({ code: 3, signal: null });
  });
});

describe('sidecar runtime resolution', () => {
  it('trusts an explicit override when it exists', () => {
    expect(resolveNodeRuntime({ HERMETRA_NODE: process.execPath })).toBe(process.execPath);
  });

  it('ignores an override that points at nothing', () => {
    const got = resolveNodeRuntime({ HERMETRA_NODE: '/nope/node', PATH: '' });
    expect(got).not.toBe('/nope/node');
  });

  it('returns null when there is no runtime — a reportable state, not a throw', () => {
    expect(resolveNodeRuntime({ PATH: '' })).toBeNull();
  });

  it('finds node on PATH', () => {
    const dir = process.execPath.replace(/[/\\][^/\\]+$/, '');
    // execPath here is the test runner's node, so its directory is a real hit.
    expect(resolveNodeRuntime({ PATH: dir })).toContain('node');
  });
});

describe('sidecar launch mode reaches the child as an env var', () => {
  it('asks for a window when headless is false', () => {
    // `launcher.mjs` reads this one variable; '0' is the only value that means
    // headed, so anything else must keep the browser invisible.
    expect(sidecarEnv({}, { headless: false }).HERMETRA_SIDECAR_HEADLESS).toBe('0');
  });

  it('asks for no window when headless is true', () => {
    expect(sidecarEnv({}, { headless: true }).HERMETRA_SIDECAR_HEADLESS).toBe('1');
  });

  it('keeps the rest of the environment — PATH is how the child finds anything', () => {
    const got = sidecarEnv({ PATH: '/usr/bin', HERMETRA_NODE: '/n' }, { headless: true });
    expect(got.PATH).toBe('/usr/bin');
    expect(got.HERMETRA_NODE).toBe('/n');
  });

  it('carries the OS to claim, so CJK text has fonts that can draw it', () => {
    // Same reason the headless flag travels as a string: the child is real Node,
    // not Electron, and is spawned rather than forked. See `spoof.ts`.
    expect(sidecarEnv({}, { headless: true }).HERMETRA_SIDECAR_OS).toBe(hostSpoofOs());
  });

  it('leaves the variable unset where there is nothing to claim', () => {
    // An empty string is not the same as absent: the child would pass it to
    // Camoufox, which rejects it. Absent means "pick one yourself".
    const env = sidecarEnv({}, { headless: true });
    if (hostSpoofOs() === null) expect('HERMETRA_SIDECAR_OS' in env).toBe(false);
    else expect(env.HERMETRA_SIDECAR_OS).toBeTruthy();
  });

  it('does not let an inherited value decide what the browser claims', () => {
    // A stale export in the developer's shell must not outrank the host.
    const env = sidecarEnv({ HERMETRA_SIDECAR_OS: 'windows' }, { headless: true });
    expect(env.HERMETRA_SIDECAR_OS).toBe(hostSpoofOs() ?? undefined);
  });
});

describe('finding the Camoufox that ships with the app', () => {
  let staged: string;

  beforeEach(() => {
    staged = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-camoufox-'));
  });

  afterEach(() => {
    fs.rmSync(staged, { recursive: true, force: true });
  });

  /** What `camoufox-js fetch` leaves behind: the app plus its version stamp. */
  const stage = (root: string) => {
    const dir = path.join(root, 'camoufox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'version.json'), '{"version":"1"}', 'utf-8');
    return dir;
  };

  it('uses the copy shipped beside the app', () => {
    const dir = stage(staged);
    expect(resolveCamoufoxDir({}, staged)).toBe(dir);
  });

  it('trusts an explicit override first, the way the Node runtime does', () => {
    const dir = stage(staged);
    stage(staged);
    expect(resolveCamoufoxDir({ CAMOUFOX_INSTALL_DIR: dir }, '/nowhere')).toBe(dir);
  });

  it('ignores an override that points at nothing', () => {
    expect(resolveCamoufoxDir({ CAMOUFOX_INSTALL_DIR: '/nope/camoufox' }, '/nowhere')).toBeNull();
  });

  it('does not trust a half-staged directory', () => {
    // A packaging step that died midway leaves the folder without its version
    // stamp. Pointing the browser at that is worse than pointing at nothing:
    // camoufox-js would treat it as installed and fail on launch instead of
    // falling back to a copy that works.
    fs.mkdirSync(path.join(staged, 'camoufox'), { recursive: true });
    expect(resolveCamoufoxDir({}, staged)).toBeNull();
  });

  it('returns null when nothing shipped — the per-user cache is the fallback', () => {
    expect(resolveCamoufoxDir({}, staged)).toBeNull();
    expect(resolveCamoufoxDir({}, undefined)).toBeNull();
  });

  it('hands the bundled path to the child, since only the child loads camoufox', () => {
    const dir = stage(staged);
    const env = sidecarEnv({}, { headless: true }, staged);
    expect(env.CAMOUFOX_INSTALL_DIR).toBe(dir);
  });

  it('leaves the variable unset when nothing shipped, rather than setting a bad path', () => {
    const env = sidecarEnv({}, { headless: true }, staged);
    expect('CAMOUFOX_INSTALL_DIR' in env).toBe(false);
  });
});

describe('sidecar IPC contract', () => {
  it('registers its channels under one namespace', () => {
    expect(CHANNELS.STUDIO_SIDECAR_STATUS).toBe('studio:sidecar:status');
    expect(CHANNELS.STUDIO_SIDECAR_START).toBe('studio:sidecar:start');
    expect(CHANNELS.STUDIO_SIDECAR_STOP).toBe('studio:sidecar:stop');
    expect(CHANNELS.EVT_SIDECAR_UPDATE).toBe('evt:studio:sidecar');
  });

  it('keeps every channel string unique', () => {
    const all = Object.values(CHANNELS);
    expect(new Set(all).size).toBe(all.length);
  });
});

vi.restoreAllMocks();
