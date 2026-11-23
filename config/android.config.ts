import fs from 'node:fs';
import path from 'node:path';

/**
 * Android settings. Everything is optional: with one device attached nothing needs configuring.
 *   ANDROID_SERIAL           pick a device when several are attached (`adb devices`)
 *   ANDROID_PWA_PACKAGE      WebAPK package of an already-installed PWA (skips installing)
 *   ANDROID_CHROME_PACKAGE   com.android.chrome (default), com.chrome.beta, ...
 *   ANDROID_DEVTOOLS_PORT    local port used to forward Chrome's DevTools socket
 *   ANDROID_RECORD=true      record the device screen (screenrecord) for every test
 *   RUN_ANDROID_DEVICE=true  include the real-device Playwright project
 */
function resolveAdb(): string {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (sdk) {
    const candidate = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'adb'; // fall back to PATH
}

export const androidConfig = {
  serial: process.env.ANDROID_SERIAL || undefined,
  chromePackage: process.env.ANDROID_CHROME_PACKAGE ?? 'com.android.chrome',
  pwaPackage: process.env.ANDROID_PWA_PACKAGE || undefined,
  adbPath: resolveAdb(),
  devtoolsPort: Number(process.env.ANDROID_DEVTOOLS_PORT ?? 9222),
  recordScreen: process.env.ANDROID_RECORD === 'true',
  deviceProjectEnabled: process.env.RUN_ANDROID_DEVICE === 'true',
  /** Android emulators reach the host machine at this address (use it instead of localhost). */
  emulatorHostAlias: '10.0.2.2',
} as const;
