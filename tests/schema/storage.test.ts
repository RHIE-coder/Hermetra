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
  return import('@main/services/storage');
};

describe('storage.ts (DB schema)', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-storage-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('seeds defaults when store.json does not exist', async () => {
    const { memoryStore } = await importFresh();

    expect(memoryStore.bookmarks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'bm-1', name: 'Example' }),
        expect.objectContaining({ id: 'bm-2', name: 'Playwright Docs' }),
      ]),
    );
    expect(memoryStore.capabilities).toEqual([]);
    expect(memoryStore.scenarios[0]).toMatchObject({ id: 'sample-handoff' });
  });

  it('writes store.json on assignment and re-reads it next access', async () => {
    const { memoryStore } = await importFresh();

    memoryStore.bookmarks = [{ id: 'x', name: 'X', url: 'https://x.example' }];

    const fp = path.join(tmpDir, 'store.json');
    expect(fs.existsSync(fp)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    expect(parsed.bookmarks).toHaveLength(1);
    expect(parsed.bookmarks[0]).toMatchObject({ id: 'x' });

    expect(memoryStore.bookmarks).toEqual([
      expect.objectContaining({ id: 'x', name: 'X', url: 'https://x.example' }),
    ]);
  });

  it('falls back to defaults when store.json is corrupt JSON', async () => {
    fs.writeFileSync(path.join(tmpDir, 'store.json'), '{ not json');
    const { memoryStore } = await importFresh();

    expect(memoryStore.bookmarks.length).toBeGreaterThan(0);
    expect(memoryStore.scenarios.length).toBeGreaterThan(0);
  });

  it('persists scenarios round-trip with steps intact', async () => {
    const { memoryStore } = await importFresh();

    memoryStore.scenarios = [
      {
        id: 'roundtrip',
        name: 'r',
        steps: [
          { id: 's1', platform: 'web', name: 'a', scriptPath: 'a.ts', emits: 'a.done' },
          { id: 's2', platform: 'mobile', name: 'b', scriptPath: 'b.ts', waitFor: 'a.done' },
        ],
      },
    ];

    const reread = memoryStore.scenarios;
    expect(reread).toHaveLength(1);
    expect(reread[0]!.steps).toHaveLength(2);
    expect(reread[0]!.steps[1]).toMatchObject({ waitFor: 'a.done' });
  });

  it('removeScenario(id) deletes from list and persists', async () => {
    const { memoryStore } = await importFresh();

    memoryStore.scenarios = [
      { id: 'a', name: 'a', steps: [] },
      { id: 'b', name: 'b', steps: [] },
      { id: 'c', name: 'c', steps: [] },
    ];

    const after = memoryStore.removeScenario('b');

    expect(after.map((s) => s.id)).toEqual(['a', 'c']);

    const parsed = JSON.parse(fs.readFileSync(path.join(tmpDir, 'store.json'), 'utf-8'));
    expect(parsed.scenarios.map((s: { id: string }) => s.id)).toEqual(['a', 'c']);
  });

  it('removeScenario(id) is a no-op for unknown ids', async () => {
    const { memoryStore } = await importFresh();

    memoryStore.scenarios = [{ id: 'only', name: 'only', steps: [] }];
    const after = memoryStore.removeScenario('not-there');

    expect(after.map((s) => s.id)).toEqual(['only']);
  });

  it('partial files keep missing keys at defaults', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'store.json'),
      JSON.stringify({ scenarios: [{ id: 'only', name: 'only', steps: [] }] }),
    );
    const { memoryStore } = await importFresh();

    expect(memoryStore.scenarios).toEqual([{ id: 'only', name: 'only', steps: [] }]);
    // bookmarks/capabilities were missing — defaults must kick in.
    expect(memoryStore.bookmarks.length).toBeGreaterThan(0);
    expect(memoryStore.capabilities).toEqual([]);
  });
});
