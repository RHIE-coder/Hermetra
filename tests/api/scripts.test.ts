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

describe('scripts service — the studio slot', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-scripts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('seeds a starter script of its own', async () => {
    const { scriptsService } = await importFresh();
    const items = scriptsService.list('studio');
    expect(items.some((i) => i.type === 'file')).toBe(true);
  });

  it('seeds a function, not a bare snippet — the stage calls what it stores', async () => {
    // A stage picks a script by the function it exports. A file that runs
    // top-level statements has nothing for a stage to reference.
    const { scriptsService } = await importFresh();
    const [first] = scriptsService.list('studio').filter((i) => i.type === 'file');
    const body = scriptsService.read('studio', first!.path);
    expect(body.source).toMatch(/export async function extract/);
  });

  it('keeps its files away from the web and mobile slots', async () => {
    // Three folders, three lists. A shared folder would put a mobile driver
    // script in the list a browser stage picks from.
    const { scriptsService } = await importFresh();
    scriptsService.save('studio', { path: 'amazon.ts', source: '// pipeline' });
    expect(scriptsService.list('web').some((i) => i.path === 'amazon.ts')).toBe(false);
    expect(scriptsService.list('mobile').some((i) => i.path === 'amazon.ts')).toBe(false);
    expect(scriptsService.list('studio').some((i) => i.path === 'amazon.ts')).toBe(true);
  });

  it('holds shared helpers in subfolders, so a script can import one', async () => {
    const { scriptsService } = await importFresh();
    scriptsService.save('studio', { path: 'lib/auth.ts', source: 'export const login = 1;' });
    const items = scriptsService.list('studio');
    expect(items.map((i) => `${i.type}:${i.path}`)).toContain('folder:lib');
    expect(items.map((i) => i.path)).toContain('lib/auth.ts');
  });

  it('rejects an escaping path here too', async () => {
    const { scriptsService } = await importFresh();
    expect(() => scriptsService.save('studio', { path: '../leak.ts', source: '' })).toThrow(
      /Invalid path/,
    );
  });
});

describe('scripts service — the slot was called `pipeline` until 2026-08-12', () => {
  // The slot is a directory on disk holding files a person wrote. Renaming it
  // without moving them would not rename anything — it would hide their work
  // and then seed a fresh starter script on top, which reads as "my scripts are
  // gone".
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-scripts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const legacy = (rel: string, source: string) => {
    const abs = path.join(tmpDir, 'scripts', 'pipeline', rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, source, 'utf-8');
  };

  it('carries the old folder over, subfolders and all', async () => {
    legacy('amazon.ts', '// mine');
    legacy('lib/auth.ts', 'export const login = 1;');

    const { scriptsService } = await importFresh();
    const items = scriptsService.list('studio');

    expect(items.map((i) => i.path)).toContain('amazon.ts');
    expect(items.map((i) => i.path)).toContain('lib/auth.ts');
    expect(scriptsService.read('studio', 'amazon.ts').source).toBe('// mine');
  });

  it('leaves nothing behind at the old name', async () => {
    legacy('amazon.ts', '// mine');
    const { scriptsService } = await importFresh();
    scriptsService.list('studio');
    expect(fs.existsSync(path.join(tmpDir, 'scripts', 'pipeline'))).toBe(false);
  });

  it('does not seed over files it just carried over', async () => {
    // The seed only fires into an empty slot. If the move ran late the folder
    // would look empty, get a starter script, and the person's own files would
    // arrive next to a file they never wrote.
    legacy('amazon.ts', '// mine');
    const { scriptsService } = await importFresh();
    const files = scriptsService.list('studio').filter((i) => i.type === 'file');
    expect(files.map((i) => i.path)).toEqual(['amazon.ts']);
  });

  it('keeps what is already in the new folder when both exist', async () => {
    // Two folders means a half-finished move, or an older app version writing
    // again after a newer one migrated. The newer folder is the live one.
    legacy('old.ts', '// old');
    const nu = path.join(tmpDir, 'scripts', 'studio');
    fs.mkdirSync(nu, { recursive: true });
    fs.writeFileSync(path.join(nu, 'new.ts'), '// new', 'utf-8');

    const { scriptsService } = await importFresh();
    const paths = scriptsService.list('studio').map((i) => i.path);
    expect(paths).toContain('new.ts');
    expect(paths).not.toContain('old.ts');
  });
});
