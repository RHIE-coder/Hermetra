/**
 * tokens/tailwind.mjs — Token extractor for Tailwind CSS projects.
 *
 * Contract:
 *   export async function getTokens({ configFile, root }): Promise<Set<string>>
 *
 * Reads a `tailwind.config.{ts,js,mjs}` source file and returns the flat set
 * of color/token names (including nested keys flattened as `parent-child`).
 *
 * This is a "best-effort" parser — it pulls the literal `colors:` block out
 * of the source and walks keys. It does NOT import/eval the config; that
 * keeps it dependency-free and safe across project setups.
 */
import fs from 'node:fs';
import path from 'node:path';

const COLOR_KEYWORDS = new Set([
  'transparent', 'current', 'inherit', 'unset', 'initial', 'revert',
  'white', 'black', 'none',
]);

export async function getTokens({ configFile, root }) {
  const abs = path.resolve(root ?? process.cwd(), configFile);
  if (!fs.existsSync(abs)) {
    throw new Error(`tailwind extractor: config file not found: ${abs}`);
  }
  const src = fs.readFileSync(abs, 'utf-8');
  const tokens = new Set(COLOR_KEYWORDS);

  const colorsIdx = src.indexOf('colors:');
  if (colorsIdx < 0) return tokens;
  let i = src.indexOf('{', colorsIdx);
  if (i < 0) return tokens;
  let depth = 0;
  const start = i;
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

  const stack = [];
  const re = /([A-Za-z_$][\w$-]*)\s*:\s*([{`'"]?)|([{}])/g;
  let m;
  while ((m = re.exec(block))) {
    if (m[3] === '}') {
      stack.pop();
    } else if (m[1]) {
      const key = m[1];
      const opener = m[2];
      const fullPath = stack.length ? `${stack.join('-')}-${key}` : key;
      if (key !== 'DEFAULT') tokens.add(fullPath);
      if (opener === '{') stack.push(key);
    }
  }
  return tokens;
}
