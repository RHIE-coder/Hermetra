import {
  DEFAULT_THRESHOLDS,
  type ElementFingerprint,
  type ElementSnapshot,
  type RelocateResult,
  type RelocateThresholds,
} from '@shared/types/automatch';

/**
 * Adaptive element relocation — pure scoring and one decision.
 *
 * Nothing here touches a DOM. Snapshots are produced in the page by an adapter
 * and compared here, which is what lets every branch be tested without a
 * browser — the same split `bridge/` uses.
 */

/**
 * What a score is made of. Declared in one place because a scoring function
 * built from magic numbers sprinkled through its branches cannot be argued
 * with, only tweaked until the one case you are looking at passes.
 *
 * The ordering is the claim, and it comes from what actually survives a
 * redesign:
 *
 *   identity  `id`, `data-testid`, `name`, `aria-label` — attributes whose whole
 *             job is to be stable. The strongest evidence there is.
 *   text      A button says "Buy" before and after. Content moves less than markup.
 *   tag       A link stays a link. Cheap, weak, almost always true.
 *   classes   Churn hardest — utility CSS and CSS-in-JS rewrite them wholesale —
 *             so they inform but never decide.
 *   path      Where it sat. Redesigns reparent things constantly; only the tail
 *             of the chain carries much.
 *   position  Index among siblings. A tiebreaker. On its own it is noise.
 */
export const WEIGHTS = {
  identity: 0.36,
  text: 0.24,
  tag: 0.1,
  classes: 0.14,
  path: 0.11,
  position: 0.05,
} as const;

/** Attributes that exist to be stable. Order is not significant. */
const IDENTITY_ATTRS = ['id', 'data-testid', 'data-test-id', 'data-qa', 'name', 'aria-label'];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * `null` means **no evidence**, which is not the same as disagreement.
 *
 * Two elements that both lack an `id` have told you nothing about whether they
 * are the same element. Scoring that as agreement inflates every sparse pairing;
 * scoring it as a neutral 0.5 is worse still — it makes a snapshot fail to match
 * *itself*, because the missing dimension quietly eats its weight. A dimension
 * with nothing to compare drops out and the rest renormalise.
 */
type Part = number | null;

/** Overlap of two sets, 0..1. Nothing on either side is no evidence. */
function jaccard(a: Set<string>, b: Set<string>): Part {
  if (a.size === 0 && b.size === 0) return null;
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const v of a) if (b.has(v)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** Dice coefficient over word tokens — forgiving about word order, unlike equality. */
function textScore(a: string, b: string): Part {
  const x = norm(a);
  const y = norm(b);
  if (!x && !y) return null; // 둘 다 빈 텍스트는 증거가 아니다
  if (!x || !y) return 0;
  if (x === y) return 1;
  const ta = new Set(x.split(' '));
  const tb = new Set(y.split(' '));
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return (2 * shared) / (ta.size + tb.size);
}

function classes(attrs: Record<string, string>): Set<string> {
  return new Set((attrs.class ?? '').split(/\s+/).filter(Boolean).map(norm));
}

/**
 * Identity agreement.
 *
 * Absence is not disagreement: an element that never had an `id` should not be
 * punished for still not having one. Only a value that **changed** counts
 * against, which is what keeps this from dominating on sparse markup.
 */
function identityScore(a: Record<string, string>, b: Record<string, string>): Part {
  let compared = 0;
  let agreed = 0;
  for (const key of IDENTITY_ATTRS) {
    const av = a[key];
    const bv = b[key];
    if (av === undefined && bv === undefined) continue;
    compared += 1;
    if (av !== undefined && bv !== undefined && norm(av) === norm(bv)) agreed += 1;
  }
  return compared === 0 ? null : agreed / compared;
}

/** Ancestry agreement, weighted toward the tail — the nearest ancestors say the most. */
function pathScore(a: string[], b: string[]): Part {
  if (a.length === 0 && b.length === 0) return null;
  if (a.length === 0 || b.length === 0) return 0;
  const depth = Math.min(a.length, b.length);
  let shared = 0;
  for (let i = 1; i <= depth; i += 1) {
    if (a[a.length - i] === b[b.length - i]) shared += 1;
    else break; // 꼬리에서부터 끊긴 지점까지만 센다
  }
  return shared / Math.max(a.length, b.length);
}

/** Sibling position, decaying fast — being 5 rows off is barely different from 50. */
function positionScore(a: number, b: number): number {
  return 1 / (1 + Math.abs(a - b));
}

/** 0..1 similarity of two snapshots. Symmetric. */
export function similarity(a: ElementSnapshot, b: ElementSnapshot): number {
  const parts: Record<keyof typeof WEIGHTS, Part> = {
    identity: identityScore(a.attrs, b.attrs),
    text: textScore(a.text, b.text),
    tag: norm(a.tag) === norm(b.tag) ? 1 : 0,
    classes: jaccard(classes(a.attrs), classes(b.attrs)),
    path: pathScore(a.path, b.path),
    position: positionScore(a.index, b.index),
  };

  let total = 0;
  let applied = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const part = parts[key as keyof typeof WEIGHTS];
    if (part === null) continue; // 증거 없음 — 이 차원은 빠지고 나머지가 재정규화된다
    total += weight * part;
    applied += weight;
  }
  if (applied === 0) return 0; // 비교할 것이 아무것도 없었다
  // Floating point can push a perfect match a hair past 1.
  return Math.min(1, Math.max(0, total / applied));
}

export interface RelocateOptions {
  /** When the stored selector still matches, there is nothing to decide. */
  selectorStillMatches?: boolean;
  thresholds?: RelocateThresholds;
}

/**
 * Pick the element the fingerprint refers to — or say plainly that you cannot.
 *
 * Two guards stand between a score and a substitution, and both exist because
 * "highest score wins" is how a scraper silently starts collecting the wrong
 * column:
 *
 *   threshold  a resemblance is not a match
 *   margin     if the runner-up is nearly as good, the page has two of these and
 *              picking either one is a coin flip
 */
export function relocate(
  fingerprint: ElementFingerprint,
  candidates: ElementSnapshot[],
  options: RelocateOptions = {},
): RelocateResult {
  const t = options.thresholds ?? DEFAULT_THRESHOLDS;

  if (options.selectorStillMatches) {
    return {
      outcome: 'exact',
      index: 0,
      score: 1,
      runnerUp: 0,
      reason: '저장된 셀렉터가 그대로 맞는다 — 재배치하지 않았다',
    };
  }

  if (candidates.length === 0) {
    return { outcome: 'lost', index: null, score: 0, runnerUp: 0, reason: '후보가 하나도 없다' };
  }

  const scored = candidates
    .map((snapshot, index) => ({ index, score: similarity(fingerprint.snapshot, snapshot) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]!;
  const runnerUp = scored[1]?.score ?? 0;

  if (best.score < t.floor) {
    return {
      outcome: 'lost',
      index: null,
      score: best.score,
      runnerUp,
      reason: `가장 비슷한 것도 ${best.score.toFixed(2)} 로, 같은 요소로 볼 수 없다`,
    };
  }

  if (best.score < t.accept) {
    return {
      outcome: 'uncertain',
      index: null,
      score: best.score,
      runnerUp,
      reason: `${best.score.toFixed(2)} 로 기준(${t.accept}) 에 못 미친다 — 사람이 확인해야 한다`,
    };
  }

  if (best.score - runnerUp < t.margin) {
    return {
      outcome: 'uncertain',
      index: null,
      score: best.score,
      runnerUp,
      reason: `1위 ${best.score.toFixed(2)} · 2위 ${runnerUp.toFixed(2)} — 둘을 구분할 수 없어 고르지 않았다`,
    };
  }

  return {
    outcome: 'relocated',
    index: best.index,
    score: best.score,
    runnerUp,
    reason: `${best.score.toFixed(2)} 로 재배치했다 (2위 ${runnerUp.toFixed(2)})`,
  };
}
