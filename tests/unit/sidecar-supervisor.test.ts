import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SidecarSupervisor, type SidecarProcess } from '@main/sidecar/supervisor';
import { encodeLine } from '@main/sidecar/protocol';

/** The child announces its browser as a frame like any other. */
const READY = (endpoint: string) => encodeLine({ t: 'ready', endpoint }).trim();

/**
 * The supervisor is the pure half of the sidecar: it owns the state machine and
 * the restart policy and knows nothing about `child_process`. A fake process is
 * injected, so every branch here runs with no spawning and no timers.
 *
 * Spec: docs/spec/studio/README.md — `studio.sidecar`.
 */

/** A process the test drives by hand. */
function fakeProcess() {
  let onLine: ((l: string) => void) | undefined;
  let onExit: ((code: number | null, signal: string | null) => void) | undefined;
  const proc: SidecarProcess & {
    emitLine: (l: string) => void;
    emitExit: (code?: number | null, signal?: string | null) => void;
    killed: boolean;
    written: string[];
  } = {
    pid: 4242,
    killed: false,
    written: [],
    onStdoutLine: (cb) => { onLine = cb; },
    onExit: (cb) => { onExit = cb; },
    write: (line) => { proc.written.push(line); },
    kill: () => { proc.killed = true; },
    emitLine: (l) => onLine?.(l),
    emitExit: (code = 1, signal = null) => onExit?.(code, signal),
  };
  return proc;
}

function makeSupervisor(over: Partial<{ maxRestarts: number }> = {}) {
  const spawned: ReturnType<typeof fakeProcess>[] = [];
  const spawnedWith: { headless: boolean }[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const sup = new SidecarSupervisor({
    spawn: (opts) => {
      spawnedWith.push(opts);
      const p = fakeProcess();
      spawned.push(p);
      return p;
    },
    // Deterministic: no real clock, no real timers.
    schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length - 1; },
    cancel: () => {},
    backoffMs: (attempt) => attempt * 1000,
    maxRestarts: over.maxRestarts ?? 3,
  });
  return { sup, spawned, spawnedWith, timers, runTimer: (i = 0) => timers[i]!.fn() };
}

describe('SidecarSupervisor — reaching ready', () => {
  it('starts stopped, with nothing spawned', () => {
    const { sup, spawned } = makeSupervisor();
    expect(sup.status().phase).toBe('stopped');
    expect(spawned).toHaveLength(0);
  });

  it('goes starting on start(), then ready when the child reports its endpoint', () => {
    const { sup, spawned } = makeSupervisor();
    sup.start();
    expect(sup.status().phase).toBe('starting');
    expect(sup.status().pid).toBe(4242);

    spawned[0]!.emitLine(READY('ws://127.0.0.1:5111/abc'));
    expect(sup.status().phase).toBe('ready');
    expect(sup.status().endpoint).toBe('ws://127.0.0.1:5111/abc');
  });

  it('ignores chatter that is not an endpoint line', () => {
    const { sup, spawned } = makeSupervisor();
    sup.start();
    spawned[0]!.emitLine('downloading camoufox...');
    spawned[0]!.emitLine('');
    expect(sup.status().phase).toBe('starting');
    expect(sup.status().endpoint).toBeNull();
  });

  it('start() while already running does not spawn a second child', () => {
    const { sup, spawned } = makeSupervisor();
    sup.start();
    sup.start();
    expect(spawned).toHaveLength(1);
  });

  it('emits a status update on every transition', () => {
    const { sup, spawned } = makeSupervisor();
    const seen: string[] = [];
    sup.on('status', (s) => seen.push(s.phase));
    sup.start();
    spawned[0]!.emitLine(READY('ws://x/1'));
    expect(seen).toEqual(['starting', 'ready']);
  });
});

describe('SidecarSupervisor — watching and restarting', () => {
  it('marks crashed when the child dies on its own, and says why', () => {
    const { sup, spawned } = makeSupervisor();
    sup.start();
    spawned[0]!.emitLine(READY('ws://x/1'));
    spawned[0]!.emitExit(139, 'SIGSEGV');

    const s = sup.status();
    expect(s.phase).toBe('crashed');
    expect(s.endpoint).toBeNull(); // the endpoint died with it
    expect(s.lastError).toMatch(/SIGSEGV|139/);
  });

  it('schedules a restart with growing backoff', () => {
    const { sup, spawned, timers, runTimer } = makeSupervisor();
    sup.start();
    spawned[0]!.emitExit(1);
    expect(timers[0]!.ms).toBe(1000);
    expect(sup.status().retryInMs).toBe(1000);

    runTimer(0);
    expect(spawned).toHaveLength(2);
    spawned[1]!.emitExit(1);
    expect(timers[1]!.ms).toBe(2000); // 2번째 시도는 더 기다린다
  });

  it('counts restarts and resets the count once it reaches ready again', () => {
    const { sup, spawned, runTimer } = makeSupervisor();
    sup.start();
    spawned[0]!.emitExit(1);
    runTimer(0);
    expect(sup.status().restarts).toBe(1);

    spawned[1]!.emitLine(READY('ws://x/2'));
    expect(sup.status().phase).toBe('ready');
    expect(sup.status().restarts).toBe(0);
  });

  it('gives up after maxRestarts instead of looping forever', () => {
    const { sup, spawned, timers } = makeSupervisor({ maxRestarts: 2 });
    sup.start();
    spawned[0]!.emitExit(1);
    timers[0]!.fn();
    spawned[1]!.emitExit(1);
    timers[1]!.fn();
    spawned[2]!.emitExit(1);

    expect(spawned).toHaveLength(3);
    expect(timers).toHaveLength(2); // 3번째 죽음에는 예약이 없다
    expect(sup.status().phase).toBe('crashed');
    expect(sup.status().retryInMs).toBeNull();
  });
});

describe('SidecarSupervisor — stopping is deliberate', () => {
  it('stop() kills the child and lands on stopped, not crashed', () => {
    const { sup, spawned } = makeSupervisor();
    sup.start();
    spawned[0]!.emitLine(READY('ws://x/1'));
    sup.stop();

    expect(spawned[0]!.killed).toBe(true);
    spawned[0]!.emitExit(null, 'SIGTERM'); // 죽었다는 통보가 뒤따른다
    expect(sup.status().phase).toBe('stopped');
    expect(sup.status().endpoint).toBeNull();
  });

  it('does not restart what a person stopped', () => {
    const { sup, spawned, timers } = makeSupervisor();
    sup.start();
    sup.stop();
    spawned[0]!.emitExit(null, 'SIGTERM');
    expect(timers).toHaveLength(0);
  });

  it('stop() on an already stopped supervisor is harmless', () => {
    const { sup } = makeSupervisor();
    expect(() => sup.stop()).not.toThrow();
    expect(sup.status().phase).toBe('stopped');
  });

  it('start() after stop() runs again with a clean restart count', () => {
    const { sup, spawned } = makeSupervisor();
    sup.start();
    spawned[0]!.emitExit(1);
    sup.stop();
    sup.start();
    expect(sup.status().phase).toBe('starting');
    expect(sup.status().restarts).toBe(0);
  });
});

describe('SidecarSupervisor — the wire to the child', () => {
  it('sends a request as one encoded line', () => {
    const { sup, spawned } = makeSupervisor();
    sup.start();
    expect(sup.send({ id: 1, op: 'pages' })).toBe(true);
    expect(spawned[0]!.written).toEqual(['{"id":1,"op":"pages"}\n']);
  });

  it('refuses to send when there is no child, rather than throwing', () => {
    // A screen can ask for tabs at any moment, including while the sidecar is
    // down. That is an answer ("no"), not an exception to handle everywhere.
    const { sup } = makeSupervisor();
    expect(sup.send({ id: 1, op: 'pages' })).toBe(false);
  });

  it('forwards replies and log frames, and keeps ready to itself', () => {
    const { sup, spawned } = makeSupervisor();
    const frames: unknown[] = [];
    sup.on('frame', (f) => frames.push(f));
    sup.start();

    spawned[0]!.emitLine(READY('ws://x/1'));
    spawned[0]!.emitLine('{"t":"reply","id":1,"ok":true,"value":[]}');
    spawned[0]!.emitLine('{"t":"log","runId":"r1","at":3,"level":"log","text":"hi"}');
    spawned[0]!.emitLine('[sidecar] chatter');

    // `ready` is the supervisor's own business — it is the phase change. The
    // rest belongs to whoever asked.
    expect(frames).toEqual([
      { t: 'reply', id: 1, ok: true, value: [] },
      { t: 'log', runId: 'r1', at: 3, level: 'log', text: 'hi' },
    ]);
  });
});

describe('SidecarSupervisor — headed is a choice the launch has to carry', () => {
  it('is headless unless asked otherwise, and says which it is', () => {
    const { sup, spawnedWith } = makeSupervisor();
    sup.start();
    expect(spawnedWith[0]).toEqual({ headless: true });
    expect(sup.status().headless).toBe(true);
  });

  it('spawns headed when asked, and reports that', () => {
    const { sup, spawnedWith } = makeSupervisor();
    sup.start({ headless: false });
    expect(spawnedWith[0]).toEqual({ headless: false });
    expect(sup.status().headless).toBe(false);
  });

  it('restarts in the mode it was started in', () => {
    // A crash that quietly brings the browser back invisible is a browser the
    // user thinks they are watching and is not.
    const { sup, spawned, spawnedWith, runTimer } = makeSupervisor();
    sup.start({ headless: false });
    spawned[0]!.emitExit(1);
    runTimer(0);

    expect(spawnedWith[1]).toEqual({ headless: false });
    expect(sup.status().headless).toBe(false);
  });

  it('keeps the chosen mode across a deliberate stop', () => {
    // The toggle is the person's setting, not the run's — stopping must not
    // silently move it back.
    const { sup, spawned } = makeSupervisor();
    sup.start({ headless: false });
    sup.stop();
    spawned[0]!.emitExit(null, 'SIGTERM');
    expect(sup.status().phase).toBe('stopped');
    expect(sup.status().headless).toBe(false);
  });
});

beforeEach(() => vi.restoreAllMocks());
