import { describe, it, expect } from 'vitest';
import {
  parseIdeviceinstallerOutput,
  parseAdbPackagesOutput,
} from '@main/drivers/mobile/apps-parser';

/**
 * Spec acceptance criteria covered here:
 *   AC4 (driver layer): MobileDriver.listInstalledApps must surface real app
 *     records on Android & iOS. The driver itself spawns subprocesses; these
 *     pure parsers translate raw stdout into InstalledApp[] and are the only
 *     piece worth unit-testing in isolation (per spec §Affected layers).
 *
 * These tests pin the contract of the parser util so the driver can be wired
 * up without re-asserting CLI text formats elsewhere.
 */

describe('parseIdeviceinstallerOutput — iOS', () => {
  it('drops the CSV header line and parses each row as InstalledApp', () => {
    const sample = [
      'CFBundleIdentifier, CFBundleVersion, CFBundleDisplayName',
      'com.example.app, 1.2.3, Example',
      'com.acme.thing, 4.5, Acme Thing',
    ].join('\n');

    const result = parseIdeviceinstallerOutput(sample);

    expect(result).toEqual([
      { name: 'Example', bundleId: 'com.example.app', version: '1.2.3' },
      { name: 'Acme Thing', bundleId: 'com.acme.thing', version: '4.5' },
    ]);
  });

  it('returns empty array for empty stdout', () => {
    expect(parseIdeviceinstallerOutput('')).toEqual([]);
  });

  it('skips malformed lines (fewer than 3 csv fields) without throwing', () => {
    const sample = [
      'CFBundleIdentifier, CFBundleVersion, CFBundleDisplayName',
      'com.bad.row',
      'com.good.row, 1.0, Good',
      '',
      ', , ',
    ].join('\n');

    const result = parseIdeviceinstallerOutput(sample);

    // Only the well-formed row survives. Pure-empty / single-token rows skipped.
    expect(result).toEqual([{ name: 'Good', bundleId: 'com.good.row', version: '1.0' }]);
  });

  it('trims whitespace around each CSV field', () => {
    const sample = [
      'CFBundleIdentifier, CFBundleVersion, CFBundleDisplayName',
      '   com.example.app  ,   1.2.3  ,   Padded Name   ',
    ].join('\n');

    expect(parseIdeviceinstallerOutput(sample)).toEqual([
      { name: 'Padded Name', bundleId: 'com.example.app', version: '1.2.3' },
    ]);
  });
});

describe('parseAdbPackagesOutput — Android', () => {
  it('parses `package:<id> versionCode:<n>` lines', () => {
    const sample = [
      'package:com.example.app versionCode:42',
      'package:com.acme.thing versionCode:1',
    ].join('\n');

    const result = parseAdbPackagesOutput(sample);

    // Spec note: with `cmd package list packages -3 --show-versioncode` only,
    // we don't have a human display name — fall back to the bundleId.
    expect(result).toEqual([
      { name: 'com.example.app', bundleId: 'com.example.app', version: '42' },
      { name: 'com.acme.thing', bundleId: 'com.acme.thing', version: '1' },
    ]);
  });

  it('returns empty array for empty stdout', () => {
    expect(parseAdbPackagesOutput('')).toEqual([]);
  });

  it('skips lines that do not start with "package:"', () => {
    const sample = [
      '',
      'Listing packages...',
      'package:com.real.one versionCode:9',
      'garbage line',
    ].join('\n');

    expect(parseAdbPackagesOutput(sample)).toEqual([
      { name: 'com.real.one', bundleId: 'com.real.one', version: '9' },
    ]);
  });

  it('parses lines without versionCode (just `package:<id>`) as version=""', () => {
    const sample = 'package:com.no.versioncode';

    expect(parseAdbPackagesOutput(sample)).toEqual([
      { name: 'com.no.versioncode', bundleId: 'com.no.versioncode', version: '' },
    ]);
  });
});
