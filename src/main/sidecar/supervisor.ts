import { EventEmitter } from 'node:events';
import { IDLE_SIDECAR, type SidecarStatus } from '@shared/types/studio';

/**
 * The pure half of the fetch sidecar: a state machine plus a restart policy.
 *
 * It knows nothing about `child_process`, timers or the filesystem — a process
 * handle and a scheduler are injected. That is what makes every branch below
 * (crash, backoff, give-up, deliberate stop) testable without spawning
 * anything, and it is the same reason `bridge/` is shaped this way.
 */

/** What the supervisor needs from a running child. */
export interface SidecarProcess {
  pid: number | null;
  onStdoutLine(cb: (line: string) => void): void;
  onExit(cb: (code: number | null, signal: string | null) => void): void;
  kill(): void;
}

/** What a launch needs to know. Carried across restarts, not re-decided per try. */
export interface SidecarLaunchOptions {
  headless: boolean;
}

export interface SupervisorOptions {
  spawn: (opts: SidecarLaunchOptions) => SidecarProcess;
  /** Returns a handle the supervisor can cancel. Defaults to real timers. */
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
  /** Wait before restart attempt N (1-based). Defaults to 1s, 2s, 4s, capped at 30s. */
  backoffMs?: (attempt: number) => number;
  /** Consecutive automatic restarts before giving up and waiting for a person. */
  maxRestarts?: number;
}

/** The child announces its endpoint on stdout as `WS ws://…` and nothing else. */
const ENDPOINT_LINE = /^WS\s+(ws:\/\/\S+)\s*$/;

const defaultBackoff = (attempt: number) => Math.min(2 ** (attempt - 1) * 1000, 30_000);

export class SidecarSupervisor extends EventEmitter {
  private opts: Required<SupervisorOptions>;
  private state: SidecarStatus = { ...IDLE_SIDECAR };
  private child: SidecarProcess | null = null;
  private retry: unknown = null;
  /**
   * Set while a stop is deliberate. The exit callback fires either way, and this
   * is what tells "a person stopped it" apart from "it died" — without it, every
   * quit would look like a crash and trigger a restart.
   */
  private stopping = false;

  constructor(options: SupervisorOptions) {
    super();
    this.opts = {
      schedule: (fn, ms) => setTimeout(fn, ms),
      cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      backoffMs: defaultBackoff,
      maxRestarts: 5,
      ...options,
    };
  }

  status(): SidecarStatus {
    return { ...this.state };
  }

  private set(patch: Partial<SidecarStatus>): void {
    this.state = { ...this.state, ...patch };
    this.emit('status', this.status());
  }

  /** Idempotent: starting something already running is not an error, it is a no-op. */
  start(opts: Partial<SidecarLaunchOptions> = {}): void {
    if (this.state.phase === 'starting' || this.state.phase === 'ready') return;
    this.clearRetry();
    this.stopping = false;
    // Bookkeeping, not a transition — `launch()` emits the one event this is.
    const headless = opts.headless ?? this.state.headless;
    this.state = { ...this.state, headless, restarts: 0, lastError: null };
    this.launch();
  }

  private launch(): void {
    // The mode comes from state, not from the caller, so an automatic restart
    // reproduces the launch a person asked for rather than the default.
    const child = this.opts.spawn({ headless: this.state.headless });
    this.child = child;
    this.set({ phase: 'starting', pid: child.pid, endpoint: null, retryInMs: null });

    child.onStdoutLine((line) => {
      const hit = ENDPOINT_LINE.exec(line);
      if (!hit) return; // progress chatter and blank lines are not our business
      // Reaching ready is what "the last start worked" means, so the restart
      // budget resets here — a sidecar that recovers must not stay one crash
      // away from being given up on forever.
      this.set({ phase: 'ready', endpoint: hit[1]!, restarts: 0, lastError: null });
    });

    child.onExit((code, signal) => {
      if (child !== this.child) return; // a stale child from a previous life
      this.child = null;

      if (this.stopping) {
        this.stopping = false;
        this.set({ ...IDLE_SIDECAR, headless: this.state.headless });
        return;
      }

      const why = signal ? `died on ${signal}` : `exited with code ${code}`;
      this.set({ phase: 'crashed', endpoint: null, pid: null, lastError: why });

      const attempt = this.state.restarts + 1;
      if (attempt > this.opts.maxRestarts) {
        // Giving up is a state, not a failure to handle. A crash loop that keeps
        // respawning burns the machine and hides the real error.
        this.set({ retryInMs: null });
        return;
      }
      const wait = this.opts.backoffMs(attempt);
      this.set({ retryInMs: wait });
      this.retry = this.opts.schedule(() => {
        this.retry = null;
        this.set({ restarts: attempt });
        this.launch();
      }, wait);
    });
  }

  /** Deliberate. Cancels any pending restart — a person's decision outranks the policy. */
  stop(): void {
    this.clearRetry();
    if (!this.child) {
      this.stopping = false;
      if (this.state.phase !== 'stopped') this.set({ ...IDLE_SIDECAR, headless: this.state.headless });
      return;
    }
    this.stopping = true;
    this.child.kill();
  }

  private clearRetry(): void {
    if (this.retry !== null) {
      this.opts.cancel(this.retry);
      this.retry = null;
    }
  }
}
