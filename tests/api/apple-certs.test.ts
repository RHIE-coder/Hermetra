import { describe, it, expect, vi } from 'vitest';
import { parseAppleCertsOutput } from '@main/services/apple-certs-parser';
import { createAppleCertsService } from '@main/services/appleCerts';

/**
 * Spec acceptance criteria covered here (devices-connection-config):
 *   AC5: APPLE_CERTS_LIST returns parsed identities on macOS (spawn mocked).
 *        Returns an empty list on non-macOS platforms without spawning.
 *
 * Boundary (CLAUDE.md §3.4): the parser is a pure util (no fs / no spawn);
 * the service is exercised with an injected `runSecurity` collaborator so
 * the real `security` CLI is never invoked.
 */

const SAMPLE_OUTPUT = `  1) 4NC5GBGM93AA1122334455667788 "Apple Development: foo@bar.com (XYZ123)"
  2) ABCDE12345DEADBEEFCAFEDEADBEEF "Apple Distribution: Acme Co. (ABC987)"
     2 valid identities found
`;

describe('parseAppleCertsOutput — pure parser (AC5)', () => {
  // AC5 — parser turns the sample output into structured identities.
  it('AC5: parses each numbered line into hash + label + fullLine', () => {
    const identities = parseAppleCertsOutput(SAMPLE_OUTPUT);

    expect(identities).toHaveLength(2);
    expect(identities[0]).toMatchObject({
      hash: '4NC5GBGM93AA1122334455667788',
      label: 'Apple Development: foo@bar.com (XYZ123)',
    });
    expect(identities[1]).toMatchObject({
      hash: 'ABCDE12345DEADBEEFCAFEDEADBEEF',
      label: 'Apple Distribution: Acme Co. (ABC987)',
    });
  });

  // AC5 — fullLine preserves the original raw line (trimmed) for dropdown labels.
  it('AC5: fullLine on each identity preserves the original line text', () => {
    const identities = parseAppleCertsOutput(SAMPLE_OUTPUT);

    expect(identities[0]!.fullLine).toContain('4NC5GBGM93AA1122334455667788');
    expect(identities[0]!.fullLine).toContain('Apple Development: foo@bar.com (XYZ123)');
    expect(identities[1]!.fullLine).toContain('Apple Distribution: Acme Co. (ABC987)');
  });

  // AC5 — empty output yields [].
  it('AC5: empty stdout yields []', () => {
    expect(parseAppleCertsOutput('')).toEqual([]);
  });

  // AC5 — "0 valid identities found" yields [].
  it('AC5: "0 valid identities found" output yields []', () => {
    const out = '     0 valid identities found\n';
    expect(parseAppleCertsOutput(out)).toEqual([]);
  });

  // AC5 — footer line ("N valid identities found") is not mistaken for an identity.
  it('AC5: the footer line is not parsed as an identity', () => {
    const identities = parseAppleCertsOutput(SAMPLE_OUTPUT);
    // Sanity: no identity has "valid identities" as its label.
    for (const id of identities) {
      expect(id.label).not.toMatch(/valid identities/i);
    }
  });
});

describe('appleCertsService.list — os-gated (AC5)', () => {
  // AC5 — macOS path runs the security spawn and returns parsed identities.
  it('AC5: on darwin, list() spawns `security` and returns parsed identities', async () => {
    const runSecurity = vi.fn().mockResolvedValue(SAMPLE_OUTPUT);
    const svc = createAppleCertsService({ platform: 'darwin', runSecurity });

    const result = await svc.list();

    expect(runSecurity).toHaveBeenCalledTimes(1);
    expect(result.identities).toHaveLength(2);
    expect(result.identities[0]!.hash).toBe('4NC5GBGM93AA1122334455667788');
  });

  // AC5 — non-macOS returns empty without spawning.
  it('AC5: on linux, list() returns { identities: [] } without spawning', async () => {
    const runSecurity = vi.fn();
    const svc = createAppleCertsService({ platform: 'linux', runSecurity });

    const result = await svc.list();

    expect(runSecurity).not.toHaveBeenCalled();
    expect(result.identities).toEqual([]);
  });

  // AC5 — windows also fails quiet.
  it('AC5: on win32, list() returns { identities: [] } without spawning', async () => {
    const runSecurity = vi.fn();
    const svc = createAppleCertsService({ platform: 'win32', runSecurity });

    const result = await svc.list();

    expect(runSecurity).not.toHaveBeenCalled();
    expect(result.identities).toEqual([]);
  });

  // AC5 — if spawn rejects (e.g., `security` not on PATH), return empty rather than crash.
  it('AC5: on darwin, a spawn failure yields { identities: [] } without throwing', async () => {
    const runSecurity = vi.fn().mockRejectedValue(new Error('security not found'));
    const svc = createAppleCertsService({ platform: 'darwin', runSecurity });

    const result = await svc.list();

    expect(result.identities).toEqual([]);
  });
});
