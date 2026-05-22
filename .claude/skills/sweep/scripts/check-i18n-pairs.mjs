#!/usr/bin/env node
/**
 * check-i18n-pairs.mjs — UNIVERSAL DRIVER.
 *
 * Reads .claude/harness.config.json → checks.i18n-pairs, loads the
 * extractor at .claude/extractors/i18n/<name>.mjs, asks it for per-locale
 * key sets, and reports any key missing from a locale (or extra in one
 * locale relative to the union).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { getCheck, root as cfgRoot } from '../../../lib/config.mjs';

const ROOT = cfgRoot();

async function loadExtractor(name) {
  const file = path.join(ROOT, `.claude/extractors/i18n/${name}.mjs`);
  if (!fs.existsSync(file)) {
    throw new Error(`i18n-pairs: extractor "${name}" not found at ${file}`);
  }
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod.getLocaleKeys !== 'function') {
    throw new Error(`i18n-pairs: extractor "${name}" must export getLocaleKeys()`);
  }
  return mod.getLocaleKeys;
}

async function main() {
  const cfg = getCheck('i18n-pairs');
  if (!cfg.enabled) {
    process.stdout.write('check-i18n-pairs: disabled in harness.config.json\n');
    process.exit(0);
  }
  if (!cfg.extractor || !cfg.file || !Array.isArray(cfg.locales) || cfg.locales.length < 2) {
    process.stderr.write(
      'check-i18n-pairs: extractor/file/locales[≥2] required in harness.config.json\n',
    );
    process.exit(2);
  }
  const getLocaleKeys = await loadExtractor(cfg.extractor);
  const keyMap = await getLocaleKeys({ file: cfg.file, locales: cfg.locales, root: ROOT });

  const unionSet = new Set();
  for (const set of keyMap.values()) for (const k of set) unionSet.add(k);

  const findings = [];
  for (const [locale, set] of keyMap) {
    for (const k of unionSet) {
      if (!set.has(k)) findings.push({ locale, key: k, kind: 'missing' });
    }
  }

  if (findings.length === 0) {
    process.stdout.write(
      `check-i18n-pairs: OK (extractor=${cfg.extractor}, ${unionSet.size} keys across ${cfg.locales.length} locales)\n`,
    );
    process.exit(0);
  }
  process.stderr.write(`check-i18n-pairs: ${findings.length} mismatch(es)\n`);
  for (const f of findings) {
    process.stderr.write(`  • missing in ${f.locale}: ${f.key}\n`);
  }
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`check-i18n-pairs: ${err.message}\n`);
  process.exit(2);
});
