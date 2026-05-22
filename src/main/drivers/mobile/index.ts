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
    async listInstalledApps(_deviceId: string): Promise<InstalledApp[]> {
      // Stub: implementer fills in real (ideviceinstaller / adb) + mock (13 dummy) paths.
      return [];
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
