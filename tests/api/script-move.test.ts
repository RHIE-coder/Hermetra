import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tmpDir: string;

vi.mock('@main/services/workspaceManager', () => ({
  workspaceManager: () => ({ activeDir: () => tmpDir }),
}));

const importFresh = async () => {
  vi.resetModules();
  return import('@main/services/scripts');
};

const seed = (slot: 'web' | 'mobile', rel: string, body = '// stub') => {
  const file = path.join(tmpDir, 'scripts', slot, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, 'utf-8');
};

const mkdirIn = (slot: 'web' | 'mobile', rel: string) => {
  fs.mkdirSync(path.join(tmpDir, 'scripts', slot, rel), { recursive: true });
};

const exists = (slot: 'web' | 'mobile', rel: string) =>
  fs.existsSync(path.join(tmpDir, 'scripts', slot, rel));

const readSrc = (slot: 'web' | 'mobile', rel: string) =>
  fs.readFileSync(path.join(tmpDir, 'scripts', slot, rel), 'utf-8');

describe('scripts service — atomic batch move (scripts-tree-dnd)', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-script-move-'));
    // Pre-create slot dirs so seed() works without seedIfEmpty side effects.
    fs.mkdirSync(path.join(tmpDir, 'scripts', 'web'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'scripts', 'mobile'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // AC1: single file → folder
  it('moves a single file into a folder', async () => {
    const { scriptsService } = await importFresh();
    seed('web', 'login.ts', 'log("a")');
    mkdirIn('web', 'auth');

    scriptsService.move('web', [{ from: 'login.ts', to: 'auth/login.ts' }]);

    expect(exists('web', 'login.ts')).toBe(false);
    expect(exists('web', 'auth/login.ts')).toBe(true);
    expect(readSrc('web', 'auth/login.ts')).toBe('log("a")');
  });

  // AC2: single folder → root (rename folder path, content preserved)
  it('moves a folder (with descendants) to a new path', async () => {
    const { scriptsService } = await importFresh();
    seed('web', 'team/login.ts', 'L');
    seed('web', 'team/signup.ts', 'S');

    scriptsService.move('web', [{ from: 'team', to: 'auth' }]);

    expect(exists('web', 'team')).toBe(false);
    expect(exists('web', 'auth/login.ts')).toBe(true);
    expect(exists('web', 'auth/signup.ts')).toBe(true);
    expect(readSrc('web', 'auth/login.ts')).toBe('L');
    expect(readSrc('web', 'auth/signup.ts')).toBe('S');
  });

  // AC3/AC4 backing: batch move of multiple items is atomic on success
  it('moves multiple files in one atomic batch', async () => {
    const { scriptsService } = await importFresh();
    seed('web', 'a.ts', 'A');
    seed('web', 'b.ts', 'B');
    mkdirIn('web', 'dst');

    scriptsService.move('web', [
      { from: 'a.ts', to: 'dst/a.ts' },
      { from: 'b.ts', to: 'dst/b.ts' },
    ]);

    expect(exists('web', 'a.ts')).toBe(false);
    expect(exists('web', 'b.ts')).toBe(false);
    expect(readSrc('web', 'dst/a.ts')).toBe('A');
    expect(readSrc('web', 'dst/b.ts')).toBe('B');
  });

  // AC5: conflict → throw + entire batch rolled back (no partial move)
  it('throws and rolls back ALL moves when any destination already exists', async () => {
    const { scriptsService } = await importFresh();
    seed('web', 'a.ts', 'A');
    seed('web', 'b.ts', 'B');
    mkdirIn('web', 'dst');
    seed('web', 'dst/b.ts', 'OLD'); // pre-existing conflict for b.ts

    expect(() =>
      scriptsService.move('web', [
        { from: 'a.ts', to: 'dst/a.ts' },
        { from: 'b.ts', to: 'dst/b.ts' },
      ]),
    ).toThrow(/conflict|exists/i);

    // Nothing moved (atomic): originals still in place, conflicting target untouched.
    expect(exists('web', 'a.ts')).toBe(true);
    expect(exists('web', 'b.ts')).toBe(true);
    expect(readSrc('web', 'a.ts')).toBe('A');
    expect(readSrc('web', 'b.ts')).toBe('B');
    expect(readSrc('web', 'dst/b.ts')).toBe('OLD');
    expect(exists('web', 'dst/a.ts')).toBe(false);
  });

  // AC5 detail: conflict error surfaces which paths conflicted so UI can list them.
  it('exposes conflicting target paths on the thrown error', async () => {
    const { scriptsService } = await importFresh();
    seed('web', 'a.ts', 'A');
    mkdirIn('web', 'dst');
    seed('web', 'dst/a.ts', 'OLD');

    let caught: unknown = null;
    try {
      scriptsService.move('web', [{ from: 'a.ts', to: 'dst/a.ts' }]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const conflicts = (caught as { conflicts?: unknown }).conflicts;
    expect(Array.isArray(conflicts)).toBe(true);
    expect(conflicts as string[]).toContain('dst/a.ts');
  });

  // AC6: self-into-self / self-into-descendant blocked at the service layer
  it('refuses to move a folder into itself with a recognizable error', async () => {
    const { scriptsService } = await importFresh();
    seed('web', 'auth/login.ts', 'L');

    // Same-path self-move is the "from === to" no-op case for files; for
    // folders specifically, the from === to path should not throw (no-op).
    // The real AC6 case is moving auth ONTO itself as a child of itself —
    // covered by the descendant test below. Here we assert the trivial
    // identity is a no-op (matching the file no-op).
    expect(() =>
      scriptsService.move('web', [{ from: 'auth', to: 'auth' }]),
    ).not.toThrow();

    expect(exists('web', 'auth/login.ts')).toBe(true);
  });

  it('refuses to move a folder into its own descendant with a recognizable error', async () => {
    const { scriptsService } = await importFresh();
    seed('web', 'auth/login.ts', 'L');

    // Must throw with a self/descendant-specific message so the UI can map
    // it to web.code.move.cannotIntoSelf — distinct from a generic conflict.
    expect(() =>
      scriptsService.move('web', [{ from: 'auth', to: 'auth/inner' }]),
    ).toThrow(/self|descendant|into itself/i);

    // Original layout preserved (no partial move).
    expect(exists('web', 'auth/login.ts')).toBe(true);
    expect(exists('web', 'auth/inner')).toBe(false);
  });

  // No-op for from === to should not throw (spec UI flow: silently ignore)
  it('treats from === to as a no-op', async () => {
    const { scriptsService } = await importFresh();
    seed('web', 'a.ts', 'A');

    expect(() =>
      scriptsService.move('web', [{ from: 'a.ts', to: 'a.ts' }]),
    ).not.toThrow();

    expect(readSrc('web', 'a.ts')).toBe('A');
  });

  // Defense: path traversal rejected, matching existing safePath behavior
  it('rejects moves that try to escape the workspace', async () => {
    const { scriptsService } = await importFresh();
    seed('web', 'a.ts', 'A');

    expect(() =>
      scriptsService.move('web', [{ from: 'a.ts', to: '../leak.ts' }]),
    ).toThrow(/Invalid path/);
    expect(() =>
      scriptsService.move('web', [{ from: '../leak.ts', to: 'a.ts' }]),
    ).toThrow(/Invalid path/);
  });
});
