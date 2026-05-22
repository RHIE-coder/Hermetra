import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  AppiumServerStatus,
  Capability,
  CapabilityTestResult,
  InstalledApp,
  MobileDevice,
  MobileSessionStatus,
  ToolingStatus,
} from '@shared/types/mobile';
import type { WebScriptRunResult } from '@shared/types/web';
import type { MobileDriverApi } from '../types';
import { AppiumManager } from './appium';
import { MobileSessionManager } from './session';
import { detectTooling, listConnectedDevices } from './devices';
import { parseAdbPackagesOutput, parseIdeviceinstallerOutput } from './apps-parser';

const execFileAsync = promisify(execFile);

/**
 * Hard-coded mock app list (spec AC9 — 13 dummy apps, returned immediately).
 * Matches the spec's reference screenshot ("image 2").
 */
const MOCK_INSTALLED_APPS: readonly InstalledApp[] = [
  { name: 'WebDriverAgentRunner-Runner', bundleId: 'com.mhrhie.WebDriverAgentRunner.xctrunner', version: '1.0' },
  { name: 'bleepy test', bundleId: 'com.bleepy.test', version: '0.1.0' },
  { name: 'Connect', bundleId: 'com.medisound.connect', version: '2.4.1' },
  { name: 'Medisound Dev', bundleId: 'com.medisound.app.dev', version: '3.0.0-dev' },
  { name: 'Chrome', bundleId: 'com.google.chrome.ios', version: '148.7778.100' },
  { name: 'Q-Check', bundleId: 'com.medisound.qcheck', version: '1.2.0' },
  { name: '모아', bundleId: 'com.moa.app', version: '4.5.2' },
  { name: 'bleepy test real', bundleId: 'com.bleepy.test.real', version: '0.2.0' },
  { name: 'TestFlight', bundleId: 'com.apple.TestFlight', version: '3.5.1' },
  { name: 'Drive', bundleId: 'com.google.Drive', version: '5.2025.0' },
  { name: 'Moa 캘린더', bundleId: 'com.moa.calendar', version: '1.8.0' },
  { name: 'Moa 캘린더(DEV)', bundleId: 'com.moa.calendar.dev', version: '1.8.0-dev' },
  { name: 'Mock Sample', bundleId: 'com.hermetra.mock.sample', version: '1.0.0' },
];

function isMockMode(): boolean {
  return process.env.HERMETRA_DRIVERS === 'mock';
}

function parseDeviceId(deviceId: string): { platform: string; udid: string } {
  const idx = deviceId.indexOf(':');
  if (idx < 0) return { platform: '', udid: deviceId };
  return { platform: deviceId.slice(0, idx), udid: deviceId.slice(idx + 1) };
}

async function realListInstalledApps(deviceId: string): Promise<InstalledApp[]> {
  const { platform, udid } = parseDeviceId(deviceId);
  if (!udid) throw new Error(`Invalid deviceId: "${deviceId}". Expected "<platform>:<udid>".`);

  if (platform === 'ios') {
    try {
      const { stdout } = await execFileAsync('ideviceinstaller', ['-u', udid, '-l'], {
        maxBuffer: 10 * 1024 * 1024,
      });
      return parseIdeviceinstallerOutput(stdout);
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      const tail = (e.stderr || e.message || '').trim().slice(-256);
      throw new Error(`ideviceinstaller failed: ${tail}`);
    }
  }

  if (platform === 'android') {
    try {
      const { stdout } = await execFileAsync(
        'adb',
        ['-s', udid, 'shell', 'cmd', 'package', 'list', 'packages', '-3', '--show-versioncode'],
        { maxBuffer: 10 * 1024 * 1024 },
      );
      return parseAdbPackagesOutput(stdout);
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      const tail = (e.stderr || e.message || '').trim().slice(-256);
      throw new Error(`adb shell pm list packages failed: ${tail}`);
    }
  }

  throw new Error(`Unsupported platform "${platform}" for deviceId "${deviceId}".`);
}

export function createMobileDriver(): MobileDriverApi {
  const appium = new AppiumManager();
  const session = new MobileSessionManager();

  const requireServer = async (): Promise<string> => {
    const s = await appium.status();
    if (!s.isRunning || !s.url) {
      throw new Error('Appium 서버가 실행 중이 아닙니다. 먼저 서버를 시작하거나 외부 서버에 연결하세요.');
    }
    return s.url;
  };

  return {
    async toolingStatus(): Promise<ToolingStatus> {
      return detectTooling();
    },
    async appiumStatus(): Promise<AppiumServerStatus> {
      return appium.status();
    },
    async startAppium(port?: number) {
      return appium.startLocal(port ?? 4723);
    },
    async stopAppium() {
      return appium.stopLocal();
    },
    async connectExternal(url: string) {
      return appium.connectExternal(url);
    },
    async disconnectExternal() {
      return appium.disconnectExternal();
    },
    async listDevices(): Promise<MobileDevice[]> {
      return listConnectedDevices();
    },
    async listInstalledApps(deviceId: string): Promise<InstalledApp[]> {
      if (isMockMode()) return MOCK_INSTALLED_APPS.map((a) => ({ ...a }));
      return realListInstalledApps(deviceId);
    },
    async testCapability(cap: Capability): Promise<CapabilityTestResult> {
      const url = await requireServer();
      return MobileSessionManager.probe(url, cap);
    },
    async sessionStatus(): Promise<MobileSessionStatus> {
      return session.status();
    },
    async startSession(cap: Capability) {
      const url = await requireServer();
      return session.start(url, cap);
    },
    async stopSession() {
      return session.stop();
    },
    async screenshot() {
      return session.screenshot();
    },
    async startRecording() {
      return session.startRecording();
    },
    async stopRecording() {
      return session.stopRecording();
    },
    async runScript(input, _caps): Promise<WebScriptRunResult> {
      return session.runScript(input.source);
    },
    onSession(handler) {
      session.on('change', handler);
      return () => session.off('change', handler);
    },
    onAppium(handler) {
      appium.on('change', handler);
      return () => appium.off('change', handler);
    },
  };
}
