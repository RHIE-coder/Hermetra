import { EventEmitter } from 'node:events';
import type { Capability, MobileSessionStatus } from '@shared/types/mobile';
import type { WebScriptRunResult } from '@shared/types/web';

interface WebdriverIOModule {
  remote: (opts: Record<string, unknown>) => Promise<WdioBrowser>;
}

interface WdioBrowser {
  sessionId: string;
  capabilities: Record<string, unknown>;
  deleteSession: () => Promise<void>;
  takeScreenshot: () => Promise<string>;
  getPageSource: () => Promise<string>;
  startRecordingScreen: (opts?: Record<string, unknown>) => Promise<unknown>;
  stopRecordingScreen: () => Promise<string>;
  getContexts?: () => Promise<string[]>;
  switchContext?: (name: string) => Promise<void>;
  getSession?: () => Promise<unknown>;
  $: (selector: string) => Promise<unknown>;
  pause: (ms: number) => Promise<void>;
}

const tryLoadWdio = async (): Promise<WebdriverIOModule | null> => {
  try {
    const mod = (await import('webdriverio')) as unknown as WebdriverIOModule;
    return mod;
  } catch {
    return null;
  }
};

const buildAppiumCaps = (cap: Capability) => {
  const out: Record<string, unknown> = {
    platformName: cap.platform === 'android' ? 'Android' : 'iOS',
    'appium:deviceName': cap.deviceId,
    'appium:udid': cap.deviceId,
  };
  if (cap.automationName) {
    out['appium:automationName'] = cap.automationName;
  } else if (cap.platform === 'android') {
    out['appium:automationName'] = 'UiAutomator2';
  } else {
    out['appium:automationName'] = 'XCUITest';
  }
  if (cap.platform === 'android') {
    if (cap.appPackage) out['appium:appPackage'] = cap.appPackage;
    if (cap.appActivity) out['appium:appActivity'] = cap.appActivity;
  } else if (cap.bundleId) {
    out['appium:bundleId'] = cap.bundleId;
  }
  if (cap.extraJson) {
    try {
      const extra = JSON.parse(cap.extraJson) as Record<string, unknown>;
      for (const [k, v] of Object.entries(extra)) {
        out[k.includes(':') ? k : `appium:${k}`] = v;
      }
    } catch {
      /* ignore invalid JSON, the user sees a separate validation error */
    }
  }
  return out;
};

export class MobileSessionManager extends EventEmitter {
  private client: WdioBrowser | null = null;
  private capabilityId: string | null = null;
  private recording = false;
  private startedAt: number | null = null;

  status(): MobileSessionStatus {
    return {
      active: !!this.client,
      capabilityId: this.capabilityId || undefined,
      sessionId: this.client?.sessionId,
      recording: this.recording,
      startedAt: this.startedAt || undefined,
    };
  }

  private broadcast() {
    this.emit('change', this.status());
  }

  async start(serverUrl: string, cap: Capability): Promise<MobileSessionStatus> {
    if (this.client) await this.stop();
    const wdio = await tryLoadWdio();
    if (!wdio) {
      throw new Error('webdriverio가 설치되어 있지 않습니다. `npm install webdriverio` 를 실행해 주세요.');
    }
    const url = new URL(serverUrl);
    const capabilities = buildAppiumCaps(cap);
    const client = await wdio.remote({
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      port: Number(url.port || 4723),
      path: url.pathname === '' ? '/' : url.pathname,
      logLevel: 'silent',
      capabilities,
    });
    this.client = client;
    void serverUrl;
    this.capabilityId = cap.id;
    this.startedAt = Date.now();
    this.recording = false;
    this.broadcast();
    return this.status();
  }

  async stop(): Promise<MobileSessionStatus> {
    if (this.client) {
      try {
        await this.client.deleteSession();
      } catch {
        /* ignore */
      }
    }
    this.client = null;
    this.capabilityId = null;
    this.recording = false;
    this.startedAt = null;
    this.broadcast();
    return this.status();
  }

  async screenshot(): Promise<{ dataUrl: string }> {
    if (!this.client) throw new Error('활성 세션이 없습니다. 먼저 세션을 시작하세요.');
    const b64 = await this.client.takeScreenshot();
    return { dataUrl: `data:image/png;base64,${b64}` };
  }

  async startRecording(): Promise<MobileSessionStatus> {
    if (!this.client) throw new Error('활성 세션이 없습니다. 먼저 세션을 시작하세요.');
    await this.client.startRecordingScreen();
    this.recording = true;
    this.broadcast();
    return this.status();
  }

  async stopRecording(): Promise<{ dataUrl: string; status: MobileSessionStatus }> {
    if (!this.client) throw new Error('활성 세션이 없습니다.');
    const b64 = await this.client.stopRecordingScreen();
    this.recording = false;
    this.broadcast();
    return { dataUrl: `data:video/mp4;base64,${b64}`, status: this.status() };
  }

  async getContexts(): Promise<string[]> {
    if (!this.client) throw new Error('활성 세션이 없습니다. 먼저 세션을 시작하세요.');
    const fn = this.client.getContexts;
    if (typeof fn !== 'function') return ['NATIVE_APP'];
    return fn.call(this.client);
  }

  async setContext(name: string): Promise<{ ok: true }> {
    if (!this.client) throw new Error('활성 세션이 없습니다. 먼저 세션을 시작하세요.');
    const fn = this.client.switchContext;
    if (typeof fn === 'function') {
      await fn.call(this.client, name);
    }
    return { ok: true };
  }

  async getPageSource(): Promise<string> {
    if (!this.client) throw new Error('활성 세션이 없습니다. 먼저 세션을 시작하세요.');
    return this.client.getPageSource();
  }

  async runScript(source: string): Promise<WebScriptRunResult> {
    const started = Date.now();
    const id = `mobile-${started}`;
    if (!this.client) {
      return {
        scriptId: id,
        ok: false,
        durationMs: Date.now() - started,
        output: '활성 세션이 없습니다. 먼저 모바일 세션을 시작하세요.',
      };
    }
    const logs: string[] = [];
    try {
      const fn = new Function(
        'driver',
        'env',
        'bus',
        'log',
        `return (async () => { ${source} \n })();`,
      );
      const env = process.env;
      const bus = {
        set: (k: string, v: string) => logs.push(`bus.set(${k}=${v})`),
        get: () => undefined,
      };
      const log = (...args: unknown[]) => logs.push(args.map((a) => String(a)).join(' '));
      await fn(this.client, env, bus, log);
      return {
        scriptId: id,
        ok: true,
        durationMs: Date.now() - started,
        output: logs.length ? logs.join('\n') : '스크립트가 성공적으로 실행되었습니다.',
      };
    } catch (err) {
      return {
        scriptId: id,
        ok: false,
        durationMs: Date.now() - started,
        output: `실행 중 오류: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Try to establish a session with the given capability and immediately close it.
   * Used as a "test connection" probe.
   */
  static async probe(serverUrl: string, cap: Capability): Promise<{ ok: boolean; message: string; durationMs: number }> {
    const started = Date.now();
    const wdio = await tryLoadWdio();
    if (!wdio) {
      return {
        ok: false,
        message: 'webdriverio가 설치되어 있지 않습니다.',
        durationMs: Date.now() - started,
      };
    }
    try {
      const url = new URL(serverUrl);
      const client = await wdio.remote({
        protocol: url.protocol.replace(':', ''),
        hostname: url.hostname,
        port: Number(url.port || 4723),
        path: url.pathname === '' ? '/' : url.pathname,
        logLevel: 'silent',
        capabilities: buildAppiumCaps(cap),
      });
      try {
        await client.deleteSession();
      } catch {
        /* noop */
      }
      return {
        ok: true,
        message: '연결에 성공했습니다.',
        durationMs: Date.now() - started,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - started,
      };
    }
  }
}
