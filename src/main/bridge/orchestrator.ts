import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { Scenario, ScenarioRunUpdate } from '@shared/types/bridge';
import type { BridgeEventBus } from './eventBus';
import type { WebDriver, MobileDriverApi } from '../drivers/types';

interface OrchestratorDeps {
  web: WebDriver;
  mobile: MobileDriverApi;
  events: BridgeEventBus;
}

export class ScenarioOrchestrator extends EventEmitter {
  private running = new Map<string, AbortController>();

  constructor(private deps: OrchestratorDeps) {
    super();
  }

  start(scenario: Scenario): string {
    const runId = randomUUID();
    const ctrl = new AbortController();
    this.running.set(runId, ctrl);
    void this.execute(runId, scenario, ctrl.signal);
    return runId;
  }

  stop(runId: string): boolean {
    const ctrl = this.running.get(runId);
    if (!ctrl) return false;
    ctrl.abort();
    this.running.delete(runId);
    return true;
  }

  private update(u: ScenarioRunUpdate) {
    this.emit('update', u);
  }

  private async execute(runId: string, scenario: Scenario, signal: AbortSignal) {
    for (const step of scenario.steps) {
      if (signal.aborted) {
        this.update({ scenarioId: scenario.id, stepId: step.id, status: 'skipped', message: 'aborted' });
        continue;
      }

      const startedAt = Date.now();
      this.update({ scenarioId: scenario.id, stepId: step.id, status: 'running', startedAt });

      try {
        if (step.waitFor) {
          await this.deps.events.waitFor(step.waitFor, 30_000);
        }

        // Stub: drivers receive a no-op `source` referencing the scriptPath.
        // A real impl would read scriptPath from disk and pass contents.
        const source = `// scenario step: ${step.scriptPath}`;
        if (step.platform === 'web') {
          await this.deps.web.runScript(source);
        } else if (step.platform === 'mobile') {
          await this.deps.mobile.runScript({ source, capabilityId: 'default' }, null);
        } else if (step.platform === 'both') {
          await Promise.all([
            this.deps.web.runScript(source),
            this.deps.mobile.runScript({ source, capabilityId: 'default' }, null),
          ]);
        }

        if (step.emits) {
          this.deps.events.emitEvent(step.emits, 'bridge', { stepId: step.id });
        }

        this.update({
          scenarioId: scenario.id,
          stepId: step.id,
          status: 'completed',
          startedAt,
          endedAt: Date.now(),
        });
      } catch (err) {
        this.update({
          scenarioId: scenario.id,
          stepId: step.id,
          status: 'failed',
          startedAt,
          endedAt: Date.now(),
          message: err instanceof Error ? err.message : String(err),
        });
        break;
      }
    }

    this.running.delete(runId);
  }
}
