import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CHANNELS } from '@shared/ipc/channels';
import { createStudioSession } from '@main/services/studioSession.connect';

let workspaceDir = '';
vi.mock('@main/services/workspaceManager', () => ({
  workspaceManager: () => ({ activeDir: () => workspaceDir }),
}));

/**
 * The infrastructure half of the pipeline session, plus its IPC contract.
 *
 * Everything here runs on the mock browser (`HERMETRA_DRIVERS=mock`) — the same
 * one e2e and the screenshot adapter get — so no Camoufox, no socket, no
 * sidecar. The real branch is one `firefox.connect` and is exercised by hand.
 *
 * Spec: docs/spec/pipeline/jobs.md — `pipeline.session`.
 */

describe('pipeline session IPC contract', () => {
  it('registers its channels under one namespace', () => {
    expect(CHANNELS.STUDIO_SESSION_STATUS).toBe('studio:session:status');
    expect(CHANNELS.STUDIO_SESSION_NAVIGATE).toBe('studio:session:navigate');
    expect(CHANNELS.STUDIO_SESSION_NEW_TAB).toBe('studio:session:new-tab');
    expect(CHANNELS.STUDIO_SESSION_CLOSE_PAGE).toBe('studio:session:close-page');
    expect(CHANNELS.STUDIO_SESSION_SET_ACTIVE).toBe('studio:session:set-active');
    expect(CHANNELS.STUDIO_SESSION_RUN).toBe('studio:session:run');
  });

  it('gives the pipeline its own script channels, separate from web and mobile', () => {
    expect(CHANNELS.STUDIO_SCRIPTS_LIST).toBe('studio:scripts:list');
    expect(CHANNELS.STUDIO_SCRIPTS_LIST).not.toBe(CHANNELS.WEB_SCRIPTS_LIST);
    expect(CHANNELS.STUDIO_SCRIPTS_LIST).not.toBe(CHANNELS.MOBILE_SCRIPTS_LIST);
  });

  it('streams status and output on two separate event channels', () => {
    expect(CHANNELS.EVT_STUDIO_SESSION).toBe('evt:studio:session');
    expect(CHANNELS.EVT_STUDIO_LOG).toBe('evt:studio:log');
  });

  it('keeps every channel string unique', () => {
    const all = Object.values(CHANNELS);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('pipeline session on the mock browser', () => {
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env.HERMETRA_DRIVERS;
    process.env.HERMETRA_DRIVERS = 'mock';
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.HERMETRA_DRIVERS;
    else process.env.HERMETRA_DRIVERS = previous;
  });

  it('attaches without a sidecar, so the screen is clickable under mock drivers', async () => {
    const session = createStudioSession();
    await session.attach('ws://mock/1');
    expect(session.status().phase).toBe('attached');
    expect(session.status().pages).toHaveLength(1);
    await session.detach();
  });

  it('drives a tab through the same calls the handlers make', async () => {
    const session = createStudioSession();
    await session.attach('ws://mock/1');

    const pages = await session.navigate('example.com');
    expect(pages[0]!.url).toBe('https://example.com');

    const two = await session.newTab('second.test');
    expect(two).toHaveLength(2);
    expect(two[1]!.isActive).toBe(true);

    await session.detach();
  });

  it('runs the script the app actually ships', async () => {
    // The seed exports `extract`, and the workbench used to wrap every source in
    // a statement body — so the one script every new workspace opens with was
    // the one script that could not be run (`Unexpected token 'export'`). The
    // two halves are written in different files, so only a test that crosses
    // them catches it.
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetra-seed-'));
    try {
      const { scriptsService } = await import('@main/services/scripts');
      const [seed] = scriptsService.list('studio').filter((f) => f.type === 'file');
      const { source } = scriptsService.read('studio', seed!.path);

      const session = createStudioSession();
      await session.attach('ws://mock/1');
      const lines: string[] = [];
      session.on('log', (l) => lines.push(`${l.level}:${l.text}`));

      const result = await session.runStep(source, { url: 'https://seed.test' });

      expect(result.ok).toBe(true);
      expect(lines.filter((l) => l.startsWith('error:'))).toEqual([]);
      expect(session.status().pages[0]!.url).toBe('https://seed.test');
      await session.detach();
    } finally {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('runs a step and streams its output before returning a verdict', async () => {
    const session = createStudioSession();
    await session.attach('ws://mock/1');

    const lines: string[] = [];
    session.on('log', (l) => lines.push(l.text));
    const result = await session.runStep(`log('step ran'); await page.goto('https://x.test');`);

    expect(lines).toEqual(['step ran']);
    expect(result.ok).toBe(true);
    expect(session.status().pages[0]!.url).toBe('https://x.test');

    await session.detach();
  });
});
