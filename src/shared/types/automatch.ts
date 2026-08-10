/**
 * Adaptive element relocation — the app's answer to "the selector stopped working".
 *
 * Two phases, the same shape Scrapling uses: on a **successful** extraction the
 * element's identity is recorded; later, when the selector matches nothing, every
 * candidate on the page is scored against that record and the best one wins.
 *
 * The difference is what happens at the end. Scoring always produces a winner,
 * so "return the highest score" quietly swaps in a wrong element when the right
 * one is gone — and in a pipeline that persists rows, wrong-and-silent is worse
 * than broken-and-loud. Here a relocation must clear a threshold *and* beat its
 * runner-up by a margin; otherwise it is reported as needing a human, never
 * substituted behind your back.
 */

/** An element reduced to what survives a redesign. Produced in the page, compared here. */
export interface ElementSnapshot {
  /** Lowercase tag name. */
  tag: string;
  /** Attribute map. Volatile ones (style, generated hashes) are dropped upstream. */
  attrs: Record<string, string>;
  /** The element's own text, whitespace-normalised. Not its descendants'. */
  text: string;
  /** Ancestor tag chain, outermost first. Depth matters less than its tail. */
  path: string[];
  /** Position among same-tag siblings. A tiebreaker, never evidence on its own. */
  index: number;
}

/** What a stored fingerprint carries beyond the snapshot itself. */
export interface ElementFingerprint {
  snapshot: ElementSnapshot;
  /** The selector that produced it, so a still-working selector can short-circuit. */
  selector: string;
  /** When it was recorded. Lets a stale fingerprint be reported as stale. */
  savedAt: string;
}

export type RelocateOutcome =
  /** The stored selector still matches. Nothing was relocated. */
  | 'exact'
  /** Cleared the threshold and beat its runner-up. Safe to use, score reported. */
  | 'relocated'
  /** Something scored well, but not well enough — or two candidates tie. A person decides. */
  | 'uncertain'
  /** Nothing on the page resembles it. */
  | 'lost';

export interface RelocateResult {
  outcome: RelocateOutcome;
  /** Index into the candidates given, or null when nothing was chosen. */
  index: number | null;
  /** 0..1 similarity of the best candidate. 0 when there were none. */
  score: number;
  /** Second-best score — the reason `uncertain` exists. */
  runnerUp: number;
  /** Plain-language why, for the screen. */
  reason: string;
}

export interface RelocateThresholds {
  /** Minimum score to accept a relocation at all. */
  accept: number;
  /** Below this, nothing resembles it closely enough to be worth a person's time. */
  floor: number;
  /** The best must beat the runner-up by at least this, or the match is ambiguous. */
  margin: number;
}

export const DEFAULT_THRESHOLDS: RelocateThresholds = {
  accept: 0.75,
  floor: 0.4,
  margin: 0.08,
};
