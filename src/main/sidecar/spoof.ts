/**
 * Which OS the pipeline browser claims to be.
 *
 * Camoufox spoofs a different OS on every launch and swaps the whole font set to
 * match, hiding the host's real fonts so a page cannot fingerprint the machine
 * by asking what is installed. The cost lands on CJK: a mac claiming Windows has
 * no face that can draw Hangul, so naver.com rendered as rows of boxes. Because
 * the pick is random it looked fixed on roughly one launch in three, which reads
 * as flaky rather than broken.
 *
 * Supplying fonts does not fix it. What was measured here:
 *
 *   - `font.name-list.<generic>.<lang>` is not honoured per document language.
 *     A `lang="ja"` page drew Hangul and boxed kanji — the Korean face, chosen
 *     by the browser's locale rather than by the page.
 *   - the list picks the first face that exists and stops. No per-glyph
 *     fallthrough, in either order.
 *   - no bundled face covers CJK. Hangul is in Noto Sans KR alone (38.9% of CJK
 *     Unified); full Han is in Noto Sans SC alone (0% Hangul).
 *   - a pan-CJK face copied into Camoufox's font directory is never registered.
 *     Its font set is fixed when Camoufox is built.
 *
 * So the OS is the lever. Matching the host renders every CJK script, because
 * the host's own fonts are the ones in play — verified on macOS against
 * Japanese, Simplified and Traditional pages as well as Korean.
 *
 * What it costs is the OS axis of the disguise, and only that: screen, canvas,
 * WebGL, audio, UA version and the rest stay random per launch. It also removes
 * a contradiction rather than adding one — a browser claiming Windows while it
 * rasterises, measures and composites like a mac is itself worth noticing, and
 * the boxes were that mismatch made visible.
 */

/** What Camoufox calls each platform. Its own `SUPPORTED_OS`. */
const SPOOF_BY_PLATFORM: Record<string, string> = {
  darwin: 'macos',
  win32: 'windows',
  linux: 'linux',
};

/**
 * The OS to claim, or null on a platform Camoufox has no font set for.
 *
 * Null leaves Camoufox to its random pick — the old behaviour, and the honest
 * answer: claiming an OS whose fonts this machine does not have is how the boxes
 * happened in the first place.
 */
export function hostSpoofOs(platform: string = process.platform): string | null {
  return SPOOF_BY_PLATFORM[platform] ?? null;
}
