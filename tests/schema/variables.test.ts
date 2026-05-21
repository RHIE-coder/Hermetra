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
  return import('@main/services/variables');
};

describe('variables service (DB schema)', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-vars-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns seed document when no files exist', async () => {
    const { variablesService } = await importFresh();
    const doc = variablesService.load();

    expect(doc.profiles.map((p) => p.id)).toEqual(['default', 'staging']);
    expect(doc.sharedVariables.default).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'BASE_URL' }),
        expect.objectContaining({ key: 'ORDER_ID' }),
      ]),
    );
    expect(doc.privateVariables.default[0]).toEqual({ key: 'AUTH_TOKEN' });
  });

  it('save() writes variables.json with only key metadata for private vars (Git-safe split)', async () => {
    const { variablesService } = await importFresh();

    variablesService.save({
      profiles: [{ id: 'default', name: 'default' }],
      sharedVariables: { default: [{ key: 'BASE_URL', value: 'https://shared.example' }] },
      privateVariables: { default: [{ key: 'AUTH_TOKEN', value: 'hunter2' }] },
    });

    const sharedPath = path.join(tmpDir, 'variables.json');
    const privPath = path.join(tmpDir, 'variables.private.json');

    const sharedJson = JSON.parse(fs.readFileSync(sharedPath, 'utf-8'));
    const privJson = JSON.parse(fs.readFileSync(privPath, 'utf-8'));

    expect(sharedJson.sharedVariables.default[0].value).toBe('https://shared.example');
    // Public file must NOT contain private values.
    expect(sharedJson.privateVariables.default[0]).toEqual({ key: 'AUTH_TOKEN' });
    expect(JSON.stringify(sharedJson)).not.toContain('hunter2');

    // Private file holds the value, keyed by profile.
    expect(privJson.default.AUTH_TOKEN).toBe('hunter2');
  });

  it('load() merges private values back into private entries', async () => {
    const { variablesService } = await importFresh();

    variablesService.save({
      profiles: [{ id: 'default', name: 'default' }],
      sharedVariables: { default: [] },
      privateVariables: { default: [{ key: 'AUTH_TOKEN', value: 'secret' }] },
    });

    const reread = variablesService.load();
    expect(reread.privateVariables.default).toEqual([{ key: 'AUTH_TOKEN', value: 'secret' }]);
  });
});
