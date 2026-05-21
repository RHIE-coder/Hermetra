export type BridgeSide = 'web' | 'mobile' | 'bridge';

export interface BridgeEvent {
  id: string;
  channel: string;
  side: BridgeSide;
  payload: unknown;
  timestamp: number;
}

export interface BusVar {
  key: string;
  value: string;
  updatedAt: number;
  updatedBy: BridgeSide;
}

export type ScenarioStepPlatform = 'web' | 'mobile' | 'both';

export interface ScenarioStep {
  id: string;
  platform: ScenarioStepPlatform;
  name: string;
  scriptPath: string;
  emits?: string;
  waitFor?: string;
}

export interface Scenario {
  id: string;
  name: string;
  steps: ScenarioStep[];
}

export interface ScenarioRunUpdate {
  scenarioId: string;
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  endedAt?: number;
  message?: string;
}
