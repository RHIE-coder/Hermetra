import type {
  RemoteBrowserStatus,
  BrowserPage,
  WebScriptRunResult,
} from '@shared/types/web';
import type {
  AppiumServerStatus,
  Capability,
  CapabilityTestResult,
  InstalledApp,
  MobileDevice,
  MobileSessionStatus,
  ToolingStatus,
} from '@shared/types/mobile';

export interface WebDriver {
  status(): Promise<RemoteBrowserStatus>;
  start(port: number): Promise<RemoteBrowserStatus>;
  stop(): Promise<RemoteBrowserStatus>;
  listPages(): Promise<BrowserPage[]>;
  navigate(url: string): Promise<BrowserPage[]>;
  newTab(url?: string): Promise<BrowserPage[]>;
  closePage(index: number): Promise<BrowserPage[]>;
  setActive(index: number): Promise<BrowserPage[]>;
  runScript(source: string): Promise<WebScriptRunResult>;
  onChange(handler: () => void): () => void;
}

export interface MobileDriverApi {
  toolingStatus(): Promise<ToolingStatus>;
  appiumStatus(): Promise<AppiumServerStatus>;
  startAppium(port?: number): Promise<AppiumServerStatus>;
  stopAppium(): Promise<AppiumServerStatus>;
  connectExternal(url: string): Promise<AppiumServerStatus>;
  disconnectExternal(): Promise<AppiumServerStatus>;
  listDevices(): Promise<MobileDevice[]>;
  listInstalledApps(deviceId: string): Promise<InstalledApp[]>;
  testCapability(cap: Capability): Promise<CapabilityTestResult>;
  sessionStatus(): Promise<MobileSessionStatus>;
  startSession(cap: Capability): Promise<MobileSessionStatus>;
  stopSession(): Promise<MobileSessionStatus>;
  screenshot(): Promise<{ dataUrl: string }>;
  startRecording(): Promise<MobileSessionStatus>;
  stopRecording(): Promise<{ dataUrl: string; status: MobileSessionStatus }>;
  runScript(
    input: { source: string; capabilityId: string },
    caps: Capability | null,
  ): Promise<WebScriptRunResult>;
  onSession(handler: (status: MobileSessionStatus) => void): () => void;
  onAppium(handler: (status: AppiumServerStatus) => void): () => void;
}
