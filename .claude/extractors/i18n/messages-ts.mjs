/**
 * i18n/messages-ts.mjs — i18n extractor for projects using a single TS file
 * with one dictionary per locale: `const en = { ... }; const ko = { ... };`.
 *
 * Contract:
 *   export async function getLocaleKeys({ file, locales, root })
 *     returns: Map<string locale, Set<string keyName>>
 */
import fs from 'node:fs';
import path from 'node:path';

export async function getLocaleKeys({ file, locales, root }) {
  const abs = path.resolve(root ?? process.cwd(), file);
  if (!fs.existsSync(abs)) {
    throw new Error(`messages-ts extractor: file not found: ${abs}`);
  }
  const src = fs.readFileSync(abs, 'utf-8');
  const out = new Map();
  for (const loc of locales) {
    const keys = extractBlockKeys(src, loc);
    if (!keys) {
      throw new Error(`messages-ts extractor: could not find "const ${loc} =" block in ${file}`);
    }
    out.set(loc, keys);
  }
  return out;
}

function extractBlockKeys(src, locale) {
  // Match either `const <locale> =` or `const <locale>: SomeType =`
  const anchor = new RegExp(`const\\s+${locale}\\b[^=]*=`);
  const m = anchor.exec(src);
  if (!m) return null;
  let i = src.indexOf('{', m.index + m[0].length);
  if (i < 0) return null;
  const start = i;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const block = src.slice(start, i);
  const keys = new Set();
  for (const km of block.matchAll(/(?:^|\n)\s*['"]([^'"]+)['"]\s*:/g)) {
    keys.add(km[1]);
  }
  return keys;
}
