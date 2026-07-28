// surface-checks.mjs 의 타입 선언. 판정기 자체는 훅이 node 로 직접 실행하므로
// 빌드 단계를 못 끼운다 — 그래서 구현은 .mjs 로 두고 계약만 여기 적는다.

export type Rgb = [number, number, number];

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 정규화 모델의 요소. `textSize` 는 계약의 `profile.largeTextRule` 이 "size" 인 표면만
 * 채운다 — 단일 크기 표면(TUI 등)은 비우고, 그 경우 항상 본문 임계값이 쓰인다.
 */
export interface Element {
  role: string;
  text: string | null;
  fg: Rgb | null;
  bg: Rgb | null;
  bounds: Bounds;
  states: string[];
  interactive: boolean;
  truncated: boolean;
  essential: boolean;
  textSize?: { px: number; bold: boolean };
}

export interface FormFactor {
  label: string;
  w: number;
  h: number;
  unit: string;
  theme?: string;
}

export interface CaptureResult {
  surface: string;
  target: string;
  formFactor: FormFactor;
  status: 'ok' | 'cannot-verify';
  capture: string;
  errors: string[];
  elements: Element[];
  meta: { adapter: string; adapterVersion: string; caveats: string[] };
}

export interface SurfaceProfile {
  hasColor: boolean;
  boundsUnit: string;
  /** 이 표면이 스크롤되는 축. 그 축으로 넘치는 것은 결함이 아니다. */
  scrollAxis: 'x' | 'y' | 'both' | 'none';
  hasPointer: boolean;
  hasTouch: boolean;
  hasFocus: boolean;
  largeTextRule: 'size' | 'none';
  minTarget: number;
}

export interface Finding {
  check: 'contrast' | 'overlap' | 'truncation' | 'fits' | 'render-ok' | 'hit-target';
  severity: 'block' | 'observe';
  surface: string;
  formFactor: string;
  theme: string | null;
  subject: string;
  detail: string;
}

export interface Verdict {
  blockingCount: number;
  observationCount: number;
  cannotVerify: boolean;
  findings: Finding[];
}

export interface JudgeOptions {
  baseline?: { findings: { check: string; key: string }[] };
  profiles?: Record<string, SurfaceProfile>;
}

export const PROFILES: Record<string, SurfaceProfile>;
export function relativeLuminance(rgb: Rgb): number;
export function contrastRatio(a: Rgb, b: Rgb): number;
export function fingerprint(finding: Finding): string;
export function judge(results: CaptureResult[], options?: JudgeOptions): Verdict;
