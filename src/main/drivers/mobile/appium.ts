import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import type { AppiumServerStatus } from '@shared/types/mobile';
import { detectTooling } from './devices';

const httpJson = (target: string, timeoutMs = 1500) =>
  new Promise<{ ok: boolean; status?: number; body?: unknown }>((resolve) => {
    try {
      const url = new URL(target);
      const req = http.request(
        {
          host: url.hostname,
          port: url.port || 80,
          path: url.pathname || '/',
          method: 'GET',
          timeout: timeoutMs,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve({ ok: (res.statusCode || 0) < 400, status: res.statusCode, body: JSON.parse(data) });
            } catch {
              resolve({ ok: (res.statusCode || 0) < 400, status: res.statusCode });
            }
          });
        },
      );
      req.on('error', () => resolve({ ok: false }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false });
      });
      req.end();
    } catch {
      resolve({ ok: false });
    }
  });

export class AppiumManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private mode: 'local' | 'external' | null = null;
  private url: string | null = null;
  private port = 4723;

  async status(): Promise<AppiumServerStatus> {
    if (this.mode && this.url) {
      const probe = await httpJson(`${this.url}/status`);
      if (!probe.ok) {
        // external server disappeared
        if (this.mode === 'external') {
          this.mode = null;
          this.url = null;
        }
      }
    }
    const tooling = await detectTooling();
    return {
      isRunning: !!this.process || this.mode === 'external',
      mode: this.mode,
      url: this.url || `http://127.0.0.1:${this.port}`,
      version: tooling.appiumVersion,
    };
  }

  async startLocal(port = 4723): Promise<AppiumServerStatus> {
    this.port = port;
    if (this.process) return this.status();

    // First check if a server already responds on this port — adopt it as external.
    const existing = await httpJson(`http://127.0.0.1:${port}/status`);
    if (existing.ok) {
      this.mode = 'external';
      this.url = `http://127.0.0.1:${port}`;
      const s = await this.status();
      this.emit('change', s);
      return s;
    }

    try {
      const proc = spawn('appium', ['--port', String(port)], {
        shell: true,
        env: process.env,
      });
      this.process = proc;
      proc.on('exit', () => {
        this.process = null;
        if (this.mode === 'local') {
          this.mode = null;
          this.url = null;
        }
        void this.status().then((s) => this.emit('change', s));
      });
      proc.on('error', () => {
        this.process = null;
      });

      // Wait for ready
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const r = await httpJson(`http://127.0.0.1:${port}/status`);
        if (r.ok) {
          this.mode = 'local';
          this.url = `http://127.0.0.1:${port}`;
          const s = await this.status();
          this.emit('change', s);
          return s;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      // Did not become ready
      try {
        proc.kill('SIGTERM');
      } catch {
        /* noop */
      }
      this.process = null;
      const s = await this.status();
      this.emit('change', s);
      return s;
    } catch {
      this.process = null;
      const s = await this.status();
      this.emit('change', s);
      return s;
    }
  }

  async stopLocal(): Promise<AppiumServerStatus> {
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch {
        /* noop */
      }
      this.process = null;
    }
    if (this.mode === 'local') {
      this.mode = null;
      this.url = null;
    }
    const s = await this.status();
    this.emit('change', s);
    return s;
  }

  async connectExternal(url: string): Promise<AppiumServerStatus> {
    const cleaned = url.replace(/\/$/, '');
    const probe = await httpJson(`${cleaned}/status`);
    if (!probe.ok) {
      const s = await this.status();
      this.emit('change', s);
      return s;
    }
    this.mode = 'external';
    this.url = cleaned;
    const s = await this.status();
    this.emit('change', s);
    return s;
  }

  async disconnectExternal(): Promise<AppiumServerStatus> {
    if (this.mode === 'external') {
      this.mode = null;
      this.url = null;
    }
    const s = await this.status();
    this.emit('change', s);
    return s;
  }

  getServerUrl(): string | null {
    return this.url;
  }
}
