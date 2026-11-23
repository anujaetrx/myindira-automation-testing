/** Pure parsers for adb/dumpsys output. No I/O, so they are unit-testable without a device. */

export interface AdbDevice {
  serial: string;
  /** device | offline | unauthorized | ... */
  state: string;
  model?: string;
  product?: string;
  isEmulator: boolean;
}

/** `adb devices -l` */
export function parseDevices(output: string): AdbDevice[] {
  return output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('List of devices') && !l.startsWith('*'))
    .map((line) => {
      const [serial, state, ...rest] = line.split(/\s+/);
      const prop = (key: string) => rest.find((r) => r.startsWith(`${key}:`))?.slice(key.length + 1);
      return {
        serial,
        state,
        model: prop('model'),
        product: prop('product'),
        isEmulator: serial.startsWith('emulator-'),
      };
    });
}

/** `pm list packages` -> package names */
export function parsePackages(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('package:'))
    .map((l) => l.slice('package:'.length).trim());
}

export interface ForegroundActivity {
  pkg: string;
  activity: string;
}

/**
 * Extracts the resumed activity from `dumpsys activity activities`.
 * Works for both `mResumedActivity: ActivityRecord{... u0 pkg/cls t12}` (older)
 * and `topResumedActivity=ActivityRecord{...}` (Android 10+).
 */
export function parseResumedActivity(output: string): ForegroundActivity | null {
  const match = /ActivityRecord\{[^\s}]+ u\d+ ([\w.]+)\/([\w.$]+)/.exec(output);
  return match ? { pkg: match[1], activity: match[2] } : null;
}

/** `wm size` -> "Physical size: 1080x2400" (an "Override size" line wins when present). */
export function parseWmSize(output: string): { width: number; height: number } | null {
  const override = /Override size:\s*(\d+)x(\d+)/.exec(output);
  const physical = /Physical size:\s*(\d+)x(\d+)/.exec(output);
  const m = override ?? physical;
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

/** `dumpsys package <pkg>` -> versionName */
export function parseVersionName(output: string): string | null {
  return /versionName=([^\s]+)/.exec(output)?.[1] ?? null;
}

/** True when the uiautomator hierarchy contains the given resource id (e.g. Chrome's URL bar). */
export function hierarchyHasResource(xml: string, resourceId: string): boolean {
  return xml.includes(`resource-id="${resourceId}"`);
}

/** `uiautomator dump /dev/tty` appends a status line after the XML; keep only the XML. */
export function extractHierarchyXml(output: string): string {
  const end = output.indexOf('</hierarchy>');
  const start = output.indexOf('<?xml');
  if (start === -1 || end === -1) return '';
  return output.slice(start, end + '</hierarchy>'.length);
}
