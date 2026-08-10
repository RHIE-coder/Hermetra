import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { toSidecarProcess, resolveNodeRuntime } from '@main/sidecar';
import { CHANNELS } from '@shared/ipc/channels';

/**
 * The infrastructure half of the sidecar: turning a real child into the handle
 * the supervisor understands, and finding a runtime to run it with.
 *
 * Spec: docs/spec/pipeline/README.md — `pipeline.sidecar`.
 */

function fakeChild() {
  const stdout = new EventEmitter() as EventEmitter & { setEncoding: (e: string) => void };
  stdout.setEncoding = () => {};
  const child = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: typeof stdout;
    kill: (s?: string) => void;
    killedWith: string | null;
  };
  child.pid = 777;
  child.stdout = stdout;
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

describe('sidecar IPC contract', () => {
  it('registers its channels under one namespace', () => {
    expect(CHANNELS.PIPELINE_SIDECAR_STATUS).toBe('pipeline:sidecar:status');
    expect(CHANNELS.PIPELINE_SIDECAR_START).toBe('pipeline:sidecar:start');
    expect(CHANNELS.PIPELINE_SIDECAR_STOP).toBe('pipeline:sidecar:stop');
    expect(CHANNELS.EVT_SIDECAR_UPDATE).toBe('evt:pipeline:sidecar');
  });

  it('keeps every channel string unique', () => {
    const all = Object.values(CHANNELS);
    expect(new Set(all).size).toBe(all.length);
  });
});

vi.restoreAllMocks();
