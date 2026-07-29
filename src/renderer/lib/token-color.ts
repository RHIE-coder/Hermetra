/**
 * Resolve a design token to a literal `#rrggbb`.
 *
 * Components must never carry raw hex — colour lives in `global.css` as
 * `--token: H S% L%`. Some embedded surfaces, though, refuse CSS variables and
 * demand a literal: the Monaco editor's theme API is one. Reading the token off
 * the document at runtime keeps `global.css` the single source of truth instead
 * of copying values into a component, where the two would silently drift apart.
 */

const HSL = /^\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*$/;

/** A token that is missing or malformed renders as this obvious grey. */
export const UNRESOLVED = '#808080';

export function hslTripletToHex(triplet: string): string | null {
  const m = HSL.exec(triplet);
  if (!m) return null;

  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return null;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m0 = l - c / 2;

  const sector = Math.floor(((h % 360) + 360) % 360 / 60);
  const rgb = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector];

  return (
    '#' +
    rgb
      .map((v) => Math.round((v + m0) * 255))
      .map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * @param name token name without the leading dashes, e.g. `card`
 * @param root element whose computed style carries the tokens
 */
export function tokenHex(name: string, root: Element = document.documentElement): string {
  const raw = getComputedStyle(root).getPropertyValue(`--${name}`);
  return hslTripletToHex(raw) ?? UNRESOLVED;
}
