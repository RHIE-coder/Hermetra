import { describe, it, expect } from 'vitest';
import { SUPPORTED_OS } from 'camoufox-js/dist/fingerprints.js';
import { hostSpoofOs } from '@main/sidecar/spoof';

/**
 * Which OS the pipeline browser claims to be.
 *
 * Camoufox picks one at random per launch and swaps the whole font set to match,
 * hiding the host's real fonts. On a mac claiming Windows there is no face that
 * can draw Hangul, so naver.com came out as rows of boxes — and because the pick
 * is random, it looked fixed on roughly one launch in three.
 *
 * Adding fonts does not solve it. Measured on this codebase:
 *   - `font.name-list.<generic>.<lang>` is not honoured per document language;
 *     a `lang="ja"` page drew Hangul and boxed kanji, i.e. it used the Korean
 *     face regardless of what the page declared.
 *   - the list picks the first face that exists and stops — no per-glyph
 *     fallthrough, in either order.
 *   - no bundled face covers CJK: Hangul lives only in Noto Sans KR (38.9% of
 *     CJK Unified), full Han only in Noto Sans SC (0% Hangul).
 *   - a pan-CJK face dropped into Camoufox's font directory is never registered;
 *     its font set is fixed at build time.
 *
 * Matching the host is what is left, and it renders every CJK script because the
 * host's own fonts are the ones in play. It costs the OS axis of the disguise
 * and nothing else — screen, canvas, WebGL, audio and UA version stay random.
 * It also removes a contradiction: a browser claiming Windows while rendering,
 * measuring and compositing like a mac is itself something to notice.
 *
 * Spec: docs/spec/studio/README.md — `studio.sidecar`.
 */

describe('spoofed OS follows the host', () => {
  it('claims the platform it is actually running on', () => {
    expect(hostSpoofOs('darwin')).toBe('macos');
    expect(hostSpoofOs('win32')).toBe('windows');
    expect(hostSpoofOs('linux')).toBe('linux');
  });

  it('names only OSes Camoufox accepts', () => {
    // Asserted against Camoufox's own list, not a copy of it: a rename there
    // would otherwise reach the launcher as a runtime throw.
    for (const platform of ['darwin', 'win32', 'linux']) {
      expect(SUPPORTED_OS).toContain(hostSpoofOs(platform));
    }
  });

  it('declines to guess on a platform Camoufox has no font set for', () => {
    // freebsd and friends. Returning null leaves the random pick in place, which
    // is the old behaviour — worse than matching, better than claiming an OS
    // whose fonts this machine does not have.
    expect(hostSpoofOs('freebsd')).toBeNull();
    expect(hostSpoofOs('aix')).toBeNull();
  });

  it('defaults to this process, so callers need not know the platform', () => {
    expect(hostSpoofOs()).toBe(hostSpoofOs(process.platform));
  });
});
