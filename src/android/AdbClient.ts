import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { androidConfig } from '@config/android.config';
import { Logger } from '@utils/logger/Logger';
import { pollUntil } from '@utils/retry';
import {
  extractHierarchyXml,
  parseDevices,
  parsePackages,
  parseResumedActivity,
  parseVersionName,
  parseWmSize,
  type AdbDevice,
  type ForegroundActivity,
} from './AdbParsers';

const execFileAsync = promisify(execFile);

/** Quotes a value for the Android (POSIX) shell. */
export const shQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/**
 * Thin wrapper over the `adb` binary. Used for everything Playwright's Android API does not cover:
 * port forwarding, package management, activity inspection, logcat, screen recording.
 */
export class AdbClient {
  private readonly log = Logger.for('AdbClient');

  constructor(private readonly adbPath: string = androidConfig.adbPath) {}

  // ---------- low level ----------

  async run(args: string[], timeoutMs = 30_000): Promise<string> {
    this.log.debug(`adb ${args.join(' ')}`);
    const { stdout } = await execFileAsync(this.adbPath, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  }

  async runBinary(args: string[], timeoutMs = 30_000): Promise<Buffer> {
    const { stdout } = await execFileAsync(this.adbPath, args, {
      timeout: timeoutMs,
      maxBuffer: 128 * 1024 * 1024,
      encoding: 'buffer',
    });
    return stdout;
  }

  shell(serial: string, command: string, timeoutMs?: number): Promise<string> {
    return this.run(['-s', serial, 'shell', command], timeoutMs);
  }

  // ---------- devices ----------

  async devices(): Promise<AdbDevice[]> {
    return parseDevices(await this.run(['devices', '-l']));
  }

  /** Booted, authorised devices only. */
  async readyDevices(): Promise<AdbDevice[]> {
    return (await this.devices()).filter((d) => d.state === 'device');
  }

  async waitForBoot(serial: string, timeoutMs = 180_000): Promise<void> {
    await this.run(['-s', serial, 'wait-for-device'], timeoutMs);
    await pollUntil(async () => (await this.shell(serial, 'getprop sys.boot_completed')).trim() === '1', {
      timeoutMs,
      intervalMs: 2_000,
      description: `${serial} to finish booting`,
    });
  }

  async getProp(serial: string, prop: string): Promise<string> {
    return (await this.shell(serial, `getprop ${prop}`)).trim();
  }

  async screenSize(serial: string): Promise<{ width: number; height: number } | null> {
    return parseWmSize(await this.shell(serial, 'wm size'));
  }

  // ---------- packages ----------

  async listPackages(serial: string, filter = ''): Promise<string[]> {
    return parsePackages(await this.shell(serial, `pm list packages ${filter}`.trim()));
  }

  async isInstalled(serial: string, pkg: string): Promise<boolean> {
    return (await this.listPackages(serial, pkg)).includes(pkg);
  }

  async packageVersion(serial: string, pkg: string): Promise<string | null> {
    return parseVersionName(await this.shell(serial, `dumpsys package ${pkg}`));
  }

  /** Chrome "WebAPK" packages: one is minted per installed PWA. */
  listWebApks(serial: string): Promise<string[]> {
    return this.listPackages(serial, 'org.chromium.webapk');
  }

  async uninstall(serial: string, pkg: string): Promise<void> {
    await this.run(['-s', serial, 'uninstall', pkg]);
  }

  async dumpPackage(serial: string, pkg: string): Promise<string> {
    return this.shell(serial, `dumpsys package ${pkg}`);
  }

  // ---------- app control ----------

  async startUrl(serial: string, url: string, pkg: string): Promise<void> {
    await this.shell(serial, `am start -a android.intent.action.VIEW -d ${shQuote(url)} -p ${pkg}`);
  }

  async launchApp(serial: string, pkg: string): Promise<void> {
    await this.shell(serial, `monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`);
  }

  async forceStop(serial: string, pkg: string): Promise<void> {
    await this.shell(serial, `am force-stop ${pkg}`);
  }

  async pressKey(serial: string, keycode: 'KEYCODE_BACK' | 'KEYCODE_HOME' | 'KEYCODE_APP_SWITCH' | string): Promise<void> {
    await this.shell(serial, `input keyevent ${keycode}`);
  }

  async foregroundActivity(serial: string): Promise<ForegroundActivity | null> {
    const out = await this.shell(serial, 'dumpsys activity activities | grep -E "ResumedActivity"');
    return parseResumedActivity(out);
  }

  // ---------- networking ----------

  /** Forwards a local TCP port to Chrome's DevTools socket, so Playwright can attach over CDP. */
  async forwardDevTools(serial: string, localPort: number): Promise<void> {
    await this.run(['-s', serial, 'forward', `tcp:${localPort}`, 'localabstract:chrome_devtools_remote']);
  }

  async removeForward(serial: string, localPort: number): Promise<void> {
    await this.run(['-s', serial, 'forward', '--remove', `tcp:${localPort}`]).catch(() => undefined);
  }

  /** Lets the device reach a dev server on this machine at localhost:<port> (physical devices). */
  async reverse(serial: string, port: number): Promise<void> {
    await this.run(['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
  }

  // ---------- debugging artefacts ----------

  screenshot(serial: string): Promise<Buffer> {
    return this.runBinary(['-s', serial, 'exec-out', 'screencap', '-p'], 60_000);
  }

  async uiHierarchy(serial: string): Promise<string> {
    return extractHierarchyXml(await this.run(['-s', serial, 'exec-out', 'uiautomator', 'dump', '/dev/tty'], 60_000));
  }

  async logcat(serial: string, lines = 300): Promise<string> {
    return this.run(['-s', serial, 'logcat', '-d', '-t', String(lines)], 60_000);
  }

  async clearLogcat(serial: string): Promise<void> {
    await this.run(['-s', serial, 'logcat', '-c']);
  }

  async pull(serial: string, remote: string, local: string): Promise<void> {
    fs.mkdirSync(path.dirname(local), { recursive: true });
    await this.run(['-s', serial, 'pull', remote, local], 120_000);
  }

  /** Starts `screenrecord` (max 180s per file on Android). Call `stop()` to finish and pull the file. */
  startScreenRecord(serial: string, localFile: string): ScreenRecording {
    const remote = `/sdcard/pw-${Date.now()}.mp4`;
    const child = spawn(this.adbPath, ['-s', serial, 'shell', 'screenrecord', '--time-limit', '180', remote], {
      stdio: 'ignore',
    });
    return new ScreenRecording(this, serial, child, remote, localFile);
  }
}

export class ScreenRecording {
  constructor(
    private readonly adb: AdbClient,
    private readonly serial: string,
    private readonly child: ChildProcess,
    private readonly remote: string,
    private readonly localFile: string,
  ) {}

  /** Sends SIGINT so the mp4 is finalised, then pulls it. Returns the local path. */
  async stop(): Promise<string> {
    const exited = new Promise<void>((resolve) => this.child.once('exit', () => resolve()));
    await this.adb.shell(this.serial, 'pkill -l SIGINT screenrecord').catch(() => undefined);
    await Promise.race([exited, new Promise<void>((r) => setTimeout(r, 10_000))]);
    await this.adb.pull(this.serial, this.remote, this.localFile);
    await this.adb.shell(this.serial, `rm -f ${this.remote}`).catch(() => undefined);
    return this.localFile;
  }
}
