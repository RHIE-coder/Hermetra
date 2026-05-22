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

describe('scripts service — tree & folders', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-scripts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('seeds a starter script on first list', async () => {
    const { scriptsService } = await importFresh();
    const items = scriptsService.list('web');
    expect(items.some((i) => i.type === 'file' && i.name === 'login.ts')).toBe(true);
  });

  it('mkdir creates nested folders and lists them as folder entries', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.list('web'); // seed first
    scriptsService.mkdir('web', 'auth/admin');
    const items = scriptsService.list('web');
    const paths = items.map((i) => `${i.type}:${i.path}`);
    expect(paths).toContain('folder:auth');
    expect(paths).toContain('folder:auth/admin');
  });

  it('save writes a nested file and creates parent folders', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.save('mobile', { path: 'flows/checkout/run.ts', source: 'log("hi")' });
    const items = scriptsService.list('mobile');
    expect(items.some((i) => i.type === 'folder' && i.path === 'flows')).toBe(true);
    expect(items.some((i) => i.type === 'folder' && i.path === 'flows/checkout')).toBe(true);
    expect(items.some((i) => i.type === 'file' && i.path === 'flows/checkout/run.ts')).toBe(true);

    const body = scriptsService.read('mobile', 'flows/checkout/run.ts');
    expect(body.source).toBe('log("hi")');
  });

  it('remove on a folder deletes it recursively', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.save('web', { path: 'team/login.ts', source: '' });
    scriptsService.save('web', { path: 'team/signup.ts', source: '' });
    scriptsService.remove('web', 'team');
    const items = scriptsService.list('web');
    expect(items.every((i) => !i.path.startsWith('team'))).toBe(true);
  });

  it('rejects paths that try to escape the workspace', async () => {
    const { scriptsService } = await importFresh();
    expect(() => scriptsService.mkdir('web', '../outside')).toThrow(/Invalid path/);
    expect(() => scriptsService.save('web', { path: '../leak.ts', source: '' })).toThrow(
      /Invalid path/,
    );
  });
});
