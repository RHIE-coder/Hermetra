import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { BrowserInstallLog, BrowserInstallState } from '@shared/types/workspace';

async function getExpectedPath(): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pw = (await import('playwright')) as any;
    if (pw?.chromium?.executablePath) {
      try {
        const p = pw.chromium.executablePath();
        if (typeof p === 'string' && p.length > 0) return p;
      } catch {
        /* Playwright throws if browser hasn't been downloaded — fall through */
      }
    }
  } catch {
    /* playwright not installed at all */
  }
  return '';
}

async function detectInstalled(): Promise<{ installed: boolean; executablePath: string }> {
  const executablePath = await getExpectedPath();
  if (!executablePath) return { installed: false, executablePath: '' };
  return { installed: fs.existsSync(executablePath), executablePath };
}

export class BrowserInstaller extends EventEmitter {
  private running = false;
  private cached: BrowserInstallState | null = null;

  async state(): Promise<BrowserInstallState> {
    const fresh = await detectInstalled();
    this.cached = fresh;
    return fresh;
  }

  cachedState(): BrowserInstallState {
    return this.cached ?? { installed: false, executablePath: '' };
  }

  isRunning(): boolean {
    return this.running;
  }

  install(): boolean {
    if (this.running) return false;
    this.running = true;

    const emit = (line: string, level: 'info' | 'error' = 'info', done?: boolean, ok?: boolean) => {
      const evt: BrowserInstallLog = { line, level, done, ok };
      this.emit('log', evt);
    };

    emit('▸ npx playwright install chromium');
    const proc = spawn('npx', ['--yes', 'playwright', 'install', 'chromium'], {
      shell: true,
      env: { ...process.env, PW_TEST_HTML_REPORT_OPEN: 'never' },
    });

    proc.stdout.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (line.trim()) emit(line);
      }
    });
    proc.stderr.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (line.trim()) emit(line, 'error');
      }
    });
    proc.on('error', (err) => {
      emit(err.message, 'error', true, false);
      this.running = false;
    });
    proc.on('exit', (code) => {
      const ok = code === 0;
      emit(ok ? '✔ done' : `✘ exited with code ${code}`, ok ? 'info' : 'error', true, ok);
      this.running = false;
    });
    return true;
  }
}
