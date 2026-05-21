import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import type { MobileDevice, ToolingStatus } from '@shared/types/mobile';

const execFileAsync = promisify(execFile);

const PATH_DELIM = path.delimiter;
const PATH_ENTRIES = (process.env.PATH || '').split(PATH_DELIM).filter(Boolean);
const EXT_LIST = process.platform === 'win32'
  ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
  : [''];

async function which(cmd: string): Promise<string | null> {
  for (const dir of PATH_ENTRIES) {
    for (const ext of EXT_LIST) {
      const candidate = path.join(dir, cmd + ext);
      try {
        await fs.promises.access(
          candidate,
          process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK,
        );
        return candidate;
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

async function safeExec(cmd: string, args: string[], timeoutMs = 5000) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { timeout: timeoutMs });
    return { ok: true, stdout, stderr };
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    return { ok: false, stdout: '', stderr: e.stderr || e.message || '' };
  }
}

export async function detectTooling(): Promise<ToolingStatus> {
  const [appiumPath, adbPath, ideviceIdPath] = await Promise.all([
    which('appium'),
    which('adb'),
    which('idevice_id'),
  ]);
  let appiumVersion: string | undefined;
  if (appiumPath) {
    const v = await safeExec(appiumPath, ['--version'], 4000);
    if (v.ok) appiumVersion = v.stdout.trim();
  }
  return {
    appium: !!appiumPath,
    adb: !!adbPath,
    libimobiledevice: !!ideviceIdPath,
    appiumVersion,
  };
}

function parseAdbDevices(output: string): MobileDevice[] {
  const lines = output.split('\n').map((l) => l.trim()).filter(Boolean);
  const result: MobileDevice[] = [];
  for (const line of lines) {
    if (line.startsWith('List of devices')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const id = parts[0];
    const state = parts[1];
    const model = parts.find((p) => p.startsWith('model:'))?.replace('model:', '');
    result.push({
      id,
      name: model || id,
      platform: 'android',
      status: state === 'device' ? 'connected' : 'disconnected',
      kind: /^emulator-/i.test(id) ? 'emulator' : 'real',
      lastSeenAt: Date.now(),
    });
  }
  return result;
}

async function listIosRealDevices(): Promise<MobileDevice[]> {
  const idev = await which('idevice_id');
  if (!idev) return [];
  const list = await safeExec(idev, ['-l']);
  if (!list.ok) return [];
  const ids = list.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  const ideviceinfo = await which('ideviceinfo');
  const result: MobileDevice[] = [];
  for (const id of ids) {
    let name = id;
    if (ideviceinfo) {
      const r = await safeExec(ideviceinfo, ['-u', id, '-k', 'DeviceName']);
      if (r.ok && r.stdout.trim()) name = r.stdout.trim();
    }
    result.push({
      id,
      name,
      platform: 'ios',
      status: 'connected',
      kind: 'real',
      lastSeenAt: Date.now(),
    });
  }
  return result;
}

async function listIosSimulators(): Promise<MobileDevice[]> {
  const xcrun = await which('xcrun');
  if (!xcrun) return [];
  const r = await safeExec(xcrun, ['simctl', 'list', 'devices', 'booted', '--json']);
  if (!r.ok) return [];
  try {
    const data = JSON.parse(r.stdout) as { devices: Record<string, Array<{ udid: string; name: string; state: string }>> };
    const result: MobileDevice[] = [];
    for (const group of Object.values(data.devices ?? {})) {
      for (const d of group) {
        if (d.state === 'Booted') {
          result.push({
            id: d.udid,
            name: d.name,
            platform: 'ios',
            status: 'connected',
            kind: 'simulator',
            lastSeenAt: Date.now(),
          });
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

export async function listConnectedDevices(): Promise<MobileDevice[]> {
  const devices: MobileDevice[] = [];

  const adb = await which('adb');
  if (adb) {
    const r = await safeExec(adb, ['devices', '-l']);
    if (r.ok) devices.push(...parseAdbDevices(r.stdout));
  }

  if (process.platform === 'darwin') {
    const [real, sim] = await Promise.all([listIosRealDevices(), listIosSimulators()]);
    devices.push(...real, ...sim);
  } else {
    const real = await listIosRealDevices();
    devices.push(...real);
  }

  return devices;
}
