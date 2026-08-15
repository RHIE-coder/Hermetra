import { EventEmitter } from 'node:events';
import { IDLE_SESSION, type StudioLogLine, type StudioSessionStatus } from '@shared/types/studio';
import type { PagesReply, RunOutcome, SidecarCall } from '../sidecar/protocol';
import type { BrowserPage, WebScriptRunResult } from '@shared/types/web';

/**
 * What the screen talks to: a state machine over one request channel.
 *
 * The browser is **not** here. It lives in the sidecar, and so does the script
 * that drives it — a second Playwright client connected to the same browser
 * server sees `contexts = 0`, so a script running in this process would be
 * handed an empty browser rather than the tab a person is looking at
 * (`docs/spec/studio/browser.md` — `studio.session`).
 *
 * What is left here is the part the screen needs: which phase we are in, what
 * tabs exist, and what went wrong last. The channel is injected, which is what
 * lets every branch (attach, re-attach onto a restarted sidecar, detach
 * mid-flight, a step that throws) be tested without a process.
 *
 * The session outlives a run on purpose. A run that opened and closed its own
 * browser would throw away the login, the cookies and the page you were looking
 * at between one step and the next, which is the thing this surface exists to
 * avoid.
 */

/** The sidecar, as this needs it: one request out, log lines back. */
export interface StudioRpc {
  /** Rejects when the sidecar refuses or is not there. */
  send(request: SidecarCall): Promise<unknown>;
  /** Returns an unsubscribe. Lines arrive while a step is still running. */
  onLog(cb: (line: StudioLogLine) => void): () => void;
}

export interface StudioSessionOptions {
  rpc: StudioRpc;
  /** Injected so log timestamps and run ids are deterministic under test. */
  now?: () => number;
}

/** Where a step's source is, and what it is called. Resolved by the caller. */
export interface StepRequest {
  source: string;
  dir: string;
  name: string;
  /** The address bar, which the script reads as `ctx.url`. */
  url?: string;
}

const asMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

export class StudioSession extends EventEmitter {
  private opts: Required<StudioSessionOptions>;
  private state: StudioSessionStatus = { ...IDLE_SESSION };
  /**
   * The endpoint we are supposed to be holding. A request takes time, and the
   * sidecar can die inside that window — without this, an answer arriving late
   * would install itself into a session someone already let go of.
   */
  private wanted: string | null = null;

  constructor(options: StudioSessionOptions) {
    super();
    this.opts = { now: () => Date.now(), ...options };
    // Streamed rather than collected: a step is allowed to take a minute, and
    // output that only arrives at the end leaves the panel blank for it.
    this.opts.rpc.onLog((line) => this.emit('log', line));
  }

  status(): StudioSessionStatus {
    return { ...this.state, pages: this.state.pages.map((p) => ({ ...p })) };
  }

  private set(patch: Partial<StudioSessionStatus>): void {
    this.state = { ...this.state, ...patch };
    this.emit('status', this.status());
  }

  /**
   * Take the browser the sidecar reported at `endpoint`.
   *
   * Attaching to the endpoint already held is a no-op — the sidecar re-announces
   * its status for reasons that have nothing to do with the browser, and each
   * one must not throw away the tabs. A *different* endpoint is a restarted
   * sidecar, and the old browser is gone whether or not we let go of it.
   */
  async attach(endpoint: string): Promise<StudioSessionStatus> {
    if (this.state.phase === 'attached' && this.state.endpoint === endpoint) return this.status();

    this.wanted = endpoint;
    this.set({ phase: 'attaching', endpoint, lastError: null });
    try {
      const reply = (await this.opts.rpc.send({ op: 'pages' })) as PagesReply;
      // Detached (or re-pointed) while we were asking. Drop what just arrived
      // rather than adopting it.
      if (this.wanted !== endpoint) return this.status();
      this.set({ phase: 'attached', endpoint, pages: reply.pages, lastError: null });
    } catch (err) {
      // Reported, not thrown: a refused attach is something the screen says.
      if (this.wanted !== endpoint) return this.status();
      this.set({ phase: 'error', endpoint: null, pages: [], lastError: asMessage(err) });
    }
    return this.status();
  }

  /**
   * Let go. Local only — the browser belongs to the sidecar's process and dies
   * with it, so there is nothing here to close.
   */
  async detach(): Promise<void> {
    this.wanted = null;
    if (this.state.phase !== 'detached') this.set({ ...IDLE_SESSION });
  }

  private async tabs(request: SidecarCall): Promise<BrowserPage[]> {
    // A control that is pressable but does nothing is worse than a dead one;
    // the screen disables these while detached, and this is the other half.
    if (this.state.phase !== 'attached') return [];
    try {
      const reply = (await this.opts.rpc.send(request)) as PagesReply;
      this.set({ pages: reply.pages, lastError: reply.error ?? null });
      return reply.pages;
    } catch (err) {
      this.set({ lastError: asMessage(err) });
      return this.state.pages;
    }
  }

  async listPages(): Promise<BrowserPage[]> {
    return this.tabs({ op: 'pages' });
  }

  async navigate(url: string): Promise<BrowserPage[]> {
    return this.tabs({ op: 'navigate', url });
  }

  async newTab(url?: string): Promise<BrowserPage[]> {
    return this.tabs({ op: 'new-tab', url });
  }

  async closePage(index: number): Promise<BrowserPage[]> {
    return this.tabs({ op: 'close-page', index });
  }

  async setActive(index: number): Promise<BrowserPage[]> {
    return this.tabs({ op: 'set-active', index });
  }

  /**
   * Run one script against the live page.
   *
   * The id is stamped here so the verdict and the log lines that already
   * streamed carry the same one — two runs must never read as one story.
   */
  async runStep(step: StepRequest): Promise<WebScriptRunResult> {
    const started = this.opts.now();
    const runId = `studio-${started}`;

    if (this.state.phase !== 'attached') {
      const output = 'No browser attached. Start the workbench browser first.';
      this.emit('log', { runId, at: started, level: 'error', text: output } satisfies StudioLogLine);
      return { scriptId: runId, ok: false, durationMs: 0, output };
    }

    try {
      const outcome = (await this.opts.rpc.send({
        op: 'run',
        runId,
        dir: step.dir,
        name: step.name,
        source: step.source,
        url: step.url,
      })) as RunOutcome;
      // The tabs may have moved: a script is allowed to navigate, open and
      // close. Awaited, so the screen never shows the list from before the run.
      await this.listPages();
      return {
        scriptId: runId,
        ok: outcome.ok,
        durationMs: outcome.durationMs,
        output: outcome.error,
      };
    } catch (err) {
      // A script that throws is that script's failure. The browser it ran
      // against is still standing, and so is this.
      const message = asMessage(err);
      this.emit('log', { runId, at: this.opts.now(), level: 'error', text: message } satisfies StudioLogLine);
      return { scriptId: runId, ok: false, durationMs: this.opts.now() - started, output: message };
    }
  }
}
