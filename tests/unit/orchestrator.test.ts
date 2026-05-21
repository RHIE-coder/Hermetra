import { describe, it, expect, vi } from 'vitest';
import { ScenarioOrchestrator } from '@main/bridge/orchestrator';
import { BridgeEventBus } from '@main/bridge/eventBus';
import type { Scenario, ScenarioRunUpdate } from '@shared/types/bridge';
import type { WebDriver, MobileDriverApi } from '@main/drivers/types';

function fakeWeb(overrides: Partial<WebDriver> = {}): WebDriver {
  return {
    status: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    listPages: vi.fn(),
    navigate: vi.fn(),
    newTab: vi.fn(),
    closePage: vi.fn(),
    setActive: vi.fn(),
    runScript: vi.fn().mockResolvedValue({ output: 'web ok' }),
    onChange: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  } as WebDriver;
}

function fakeMobile(overrides: Partial<MobileDriverApi> = {}): MobileDriverApi {
  return {
    toolingStatus: vi.fn(),
    appiumStatus: vi.fn(),
    startAppium: vi.fn(),
    stopAppium: vi.fn(),
    connectExternal: vi.fn(),
    disconnectExternal: vi.fn(),
    listDevices: vi.fn(),
    testCapability: vi.fn(),
    sessionStatus: vi.fn(),
    startSession: vi.fn(),
    stopSession: vi.fn(),
    screenshot: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    runScript: vi.fn().mockResolvedValue({ output: 'mobile ok' }),
    onSession: vi.fn().mockReturnValue(() => {}),
    onAppium: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  } as MobileDriverApi;
}

function collectUpdates(orch: ScenarioOrchestrator): ScenarioRunUpdate[] {
  const log: ScenarioRunUpdate[] = [];
  orch.on('update', (u) => log.push(u));
  return log;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const waitForUpdate = async (
  log: ScenarioRunUpdate[],
  match: (u: ScenarioRunUpdate) => boolean,
  iterations = 50,
) => {
  for (let i = 0; i < iterations; i++) {
    if (log.some(match)) return;
    await tick();
  }
  throw new Error('expected update never arrived');
};

describe('ScenarioOrchestrator (biz logic)', () => {
  it('runs web → mobile steps in order, emitting status updates', async () => {
    const web = fakeWeb();
    const mobile = fakeMobile();
    const events = new BridgeEventBus();
    const orch = new ScenarioOrchestrator({ web, mobile, events });
    const log = collectUpdates(orch);

    const scenario: Scenario = {
      id: 's1',
      name: 'order',
      steps: [
        { id: 'a', platform: 'web', name: 'login', scriptPath: 'login.ts' },
        { id: 'b', platform: 'mobile', name: 'otp', scriptPath: 'otp.ts' },
      ],
    };

    orch.start(scenario);
    await waitForUpdate(log, (u) => u.stepId === 'b' && u.status === 'completed');

    const aRunning = log.findIndex((u) => u.stepId === 'a' && u.status === 'running');
    const aDone = log.findIndex((u) => u.stepId === 'a' && u.status === 'completed');
    const bRunning = log.findIndex((u) => u.stepId === 'b' && u.status === 'running');
    const bDone = log.findIndex((u) => u.stepId === 'b' && u.status === 'completed');

    expect(aRunning).toBeLessThan(aDone);
    expect(aDone).toBeLessThan(bRunning);
    expect(bRunning).toBeLessThan(bDone);

    expect(web.runScript).toHaveBeenCalledOnce();
    expect(mobile.runScript).toHaveBeenCalledOnce();
  });

  it('records failure and short-circuits remaining steps', async () => {
    const web = fakeWeb({ runScript: vi.fn().mockRejectedValue(new Error('boom')) });
    const mobile = fakeMobile();
    const events = new BridgeEventBus();
    const orch = new ScenarioOrchestrator({ web, mobile, events });
    const log = collectUpdates(orch);

    const scenario: Scenario = {
      id: 's',
      name: 'x',
      steps: [
        { id: 'a', platform: 'web', name: '', scriptPath: 'a.ts' },
        { id: 'b', platform: 'mobile', name: '', scriptPath: 'b.ts' },
      ],
    };

    orch.start(scenario);
    await waitForUpdate(log, (u) => u.stepId === 'a' && u.status === 'failed');

    expect(mobile.runScript).not.toHaveBeenCalled();
    expect(log.find((u) => u.stepId === 'a' && u.status === 'failed')?.message).toMatch(/boom/);
  });

  it('emits the configured event after a step completes', async () => {
    const events = new BridgeEventBus();
    const onEvent = vi.fn();
    events.on('event', onEvent);

    const orch = new ScenarioOrchestrator({ web: fakeWeb(), mobile: fakeMobile(), events });
    const log = collectUpdates(orch);

    orch.start({
      id: 's',
      name: 'x',
      steps: [{ id: 'a', platform: 'web', name: '', scriptPath: 'a.ts', emits: 'login.done' }],
    });

    await waitForUpdate(log, (u) => u.status === 'completed');
    expect(onEvent).toHaveBeenCalled();
    expect(onEvent.mock.calls[0]?.[0]).toMatchObject({ channel: 'login.done', side: 'bridge' });
  });

  it('stop() aborts in-flight scenarios', async () => {
    const events = new BridgeEventBus();
    const orch = new ScenarioOrchestrator({ web: fakeWeb(), mobile: fakeMobile(), events });
    const log = collectUpdates(orch);

    const runId = orch.start({
      id: 's',
      name: 'x',
      steps: [
        {
          id: 'wait',
          platform: 'web',
          name: '',
          scriptPath: 'a.ts',
          waitFor: 'never.fires',
        },
      ],
    });

    await tick();
    const stopped = orch.stop(runId);

    expect(stopped).toBe(true);
    // After abort, the controller is removed so a second stop is a no-op.
    expect(orch.stop(runId)).toBe(false);
    expect(log.some((u) => u.status === 'running')).toBe(true);
  });
});
