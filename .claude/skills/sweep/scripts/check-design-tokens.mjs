#!/usr/bin/env node
/**
 * check-design-tokens.mjs — UNIVERSAL DRIVER.
 *
 * Reads .claude/harness.config.json → checks.design-tokens, dynamically
 * loads the matching extractor at .claude/extractors/tokens/<name>.mjs,
 * builds a token set, then scans configured files for utility classes that
 * reference an unknown token.
 *
 * Project-specific extraction logic lives in the extractor — this driver
 * is portable.
 *
 * Usage:
 *   node check-design-tokens.mjs                        # full repo scan
 *   node check-design-tokens.mjs path/to/file.tsx       # single file
 *   node check-design-tokens.mjs --stdin --file-path P  # PreToolUse hook
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { getCheck, root as cfgRoot } from '../../../lib/config.mjs';

const ROOT = cfgRoot();

const BUILTIN_HUES = new Set([
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]);

const COLOR_KEYWORDS = new Set([
  'transparent', 'current', 'inherit', 'unset', 'initial', 'revert',
  'white', 'black', 'none',
]);

const NON_COLOR_SUFFIXES = {
  text: new Set([
    'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
    'left', 'right', 'center', 'justify', 'start', 'end',
    'pretty', 'balance', 'auto', 'wrap', 'nowrap',
    'ellipsis', 'clip',
  ]),
  border: new Set([
    '0', '2', '4', '8',
    'x', 'y', 'l', 'r', 't', 'b', 's', 'e',
    'solid', 'dashed', 'dotted', 'double', 'hidden',
    'collapse', 'separate', 'spacing',
  ]),
  ring: new Set(['0', '1', '2', '4', '8', 'inset', 'offset']),
  shadow: new Set(['sm', 'md', 'lg', 'xl', '2xl', 'inner', 'none']),
  divide: new Set([
    '0', '2', '4', '8',
    'x', 'y',
    'solid', 'dashed', 'dotted', 'double', 'none',
  ]),
  outline: new Set(['0', '1', '2', '4', '8', 'none', 'solid', 'dashed', 'dotted', 'double', 'offset']),
  decoration: new Set([
    'solid', 'dashed', 'dotted', 'double', 'wavy', 'none',
    'auto', 'from-font', '0', '1', '2', '4', '8',
    'slice', 'clone',
  ]),
  placeholder: new Set(['shown']),
};

const STRICT_COLOR_PREFIXES = new Set([
  'bg', 'from', 'via', 'to', 'fill', 'stroke', 'caret', 'accent',
]);

const ALL_PREFIXES = new Set([
  ...STRICT_COLOR_PREFIXES,
  ...Object.keys(NON_COLOR_SUFFIXES),
]);

const CLASS_RE = new RegExp(
  `(?:^|[\\s'"\`{(\\[,/])` +
    `((?:[a-z][a-z0-9-]*:)*)` +
    `([a-z]+)-` +
    `([a-z][a-z0-9-]*)` +
    `(?=$|[\\s'"\`}\\)\\],/])`,
  'g',
);

function classify(prefix, suffix, tokens) {
  const dash = suffix.indexOf('-');
  if (dash > 0) {
    const hue = suffix.slice(0, dash);
    const shade = suffix.slice(dash + 1);
    if (BUILTIN_HUES.has(hue) && /^\d{2,3}$/.test(shade)) return 'ok';
  }
  if (COLOR_KEYWORDS.has(suffix)) return 'ok';
  if (tokens.has(suffix)) return 'ok';
  const nonColor = NON_COLOR_SUFFIXES[prefix];
  if (nonColor) {
    const first = suffix.split('-')[0];
    if (nonColor.has(suffix) || nonColor.has(first)) return 'ok';
  }
  if (STRICT_COLOR_PREFIXES.has(prefix) || NON_COLOR_SUFFIXES[prefix]) return 'bad';
  return 'skip';
}

function scanContent(content, tokens, filePath) {
  const findings = [];
  for (const m of content.matchAll(CLASS_RE)) {
    const [, , prefix, suffix] = m;
    if (!ALL_PREFIXES.has(prefix)) continue;
    if (classify(prefix, suffix, tokens) !== 'bad') continue;
    const line = (content.slice(0, m.index ?? 0).split('\n')).length;
    findings.push({ file: filePath, line, klass: `${prefix}-${suffix}` });
  }
  return findings;
}

function walkByGlob(globs) {
  // Tiny glob support: only the patterns we issue, e.g. "src/**/*.tsx".
  // For full glob, swap to a library — we keep dependency-free here.
  const acc = [];
  const skipDirs = new Set(['node_modules', 'out', 'dist', '.git', 'coverage']);
  function walk(dir, predicate) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skipDirs.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs, predicate);
      else if (entry.isFile() && predicate(entry.name)) acc.push(abs);
    }
  }
  for (const g of globs) {
    // Map "src/**/*.tsx" → walk src/, predicate ends with .tsx
    const m = g.match(/^([^*]+)\/\*\*\/\*\.([a-z]+)$/i);
    if (!m) {
      // Fallback: literal file
      const abs = path.join(ROOT, g);
      if (fs.existsSync(abs)) acc.push(abs);
      continue;
    }
    const base = path.join(ROOT, m[1]);
    const ext = '.' + m[2].toLowerCase();
    if (!fs.existsSync(base)) continue;
    walk(base, (name) => name.toLowerCase().endsWith(ext));
  }
  return acc;
}

async function loadExtractor(name) {
  const file = path.join(ROOT, `.claude/extractors/tokens/${name}.mjs`);
  if (!fs.existsSync(file)) {
    throw new Error(`design-tokens: extractor "${name}" not found at ${file}`);
  }
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod.getTokens !== 'function') {
    throw new Error(`design-tokens: extractor "${name}" must export getTokens()`);
  }
  return mod.getTokens;
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const stdinFlag = args.includes('--stdin');
  const fpIdx = args.indexOf('--file-path');
  const filePathArg = fpIdx >= 0 ? args[fpIdx + 1] : null;
  const explicit = args.filter((a, i) => !a.startsWith('--') && i !== fpIdx);

  const cfg = getCheck('design-tokens');
  if (!cfg.enabled) {
    process.stdout.write('check-design-tokens: disabled in harness.config.json\n');
    process.exit(0);
  }
  const extractorName = cfg.extractor;
  const configFile = cfg.configFile;
  const scanGlobs = cfg.scanGlobs ?? ['src/**/*.tsx'];

  if (!extractorName || !configFile) {
    process.stderr.write(
      'check-design-tokens: design-tokens check enabled but extractor or configFile missing in harness.config.json\n',
    );
    process.exit(2);
  }

  const getTokens = await loadExtractor(extractorName);
  const tokens = await getTokens({ configFile, root: ROOT });

  let findings = [];
  if (stdinFlag) {
    const content = await readStdin();
    if (!filePathArg) process.exit(0);
    // Only check files matching the configured scan globs.
    const rel = path.relative(ROOT, path.resolve(filePathArg)).split(path.sep).join('/');
    const matches = scanGlobs.some((g) => {
      const m = g.match(/^([^*]+)\/\*\*\/\*\.([a-z]+)$/i);
      if (!m) return rel === g;
      return rel.startsWith(m[1] + '/') && rel.toLowerCase().endsWith('.' + m[2].toLowerCase());
    });
    if (!matches) process.exit(0);
    findings = scanContent(content, tokens, filePathArg);
  } else {
    const files = explicit.length
      ? explicit.map((f) => path.resolve(f))
      : walkByGlob(scanGlobs);
    for (const f of files) {
      try {
        const content = fs.readFileSync(f, 'utf-8');
        findings.push(...scanContent(content, tokens, path.relative(ROOT, f)));
      } catch (err) {
        process.stderr.write(`check-design-tokens: cannot read ${f}: ${err.message}\n`);
      }
    }
  }

  if (findings.length === 0) {
    process.stdout.write(
      `check-design-tokens: OK (extractor=${extractorName}, ${tokens.size} tokens)\n`,
    );
    process.exit(0);
  }
  process.stderr.write(`check-design-tokens: ${findings.length} violation(s)\n`);
  for (const f of findings) {
    process.stderr.write(`  • ${f.file}:${f.line}  ${f.klass}\n`);
  }
  process.stderr.write(
    `\nFix: register the token via your design system (${extractorName}), ` +
      `or use one already registered.\n`,
  );
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`check-design-tokens: ${err.message}\n`);
  process.exit(2);
});
