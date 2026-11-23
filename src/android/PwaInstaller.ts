import type { AndroidDevice } from '@playwright/test';
import { androidConfig } from '@config/android.config';
import { Logger } from '@utils/logger/Logger';
import { pollUntil } from '@utils/retry';
import type { AndroidSession } from './AndroidDevices';

const log = Logger.for('PwaInstaller');
const CHROME_ID = (name: string) => `${androidConfig.chromePackage}:id/${name}`;

/** Taps an element if it shows up within a short window. For optional dialogs that vary by Chrome/launcher. */
async function tapIfPresent(device: AndroidDevice, selector: Parameters<AndroidDevice['tap']>[0], timeout = 4_000): Promise<boolean> {
  try {
    await device.tap(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Installs a PWA the way a user does: open the URL in Chrome, use the menu's "Install app" entry.
 * This drives NATIVE Android UI (Chrome's menu and system dialogs), which Playwright's browser
 * emulation cannot reach. Selectors target Chrome's UI and may need adjusting between Chrome versions.
 *
 * Requirements for a real install: the PWA is installable (manifest + service worker + HTTPS) and the
 * device has Google Play services; without them Chrome only creates a plain shortcut, not a WebAPK.
 * Returns the new WebAPK package name.
 */
export async function installPwaViaChrome(session: AndroidSession, url: string): Promise<string> {
  const { device, adb, serial } = session;
  const before = new Set(await adb.listWebApks(serial));

  log.info(`Opening ${url} in Chrome`);
  await adb.forceStop(serial, androidConfig.chromePackage);
  await adb.startUrl(serial, url, androidConfig.chromePackage);
  await device.wait({ res: CHROME_ID('url_bar') }, { timeout: 30_000 });

  // First-run screens, if Chrome has never been opened on this device.
  await tapIfPresent(device, { text: /Use without an account|No thanks|Accept & continue/i }, 3_000);
  await tapIfPresent(device, { text: /No thanks/i }, 2_000);

  await device.tap({ res: CHROME_ID('menu_button') }, { timeout: 15_000 });
  const clicked = await tapIfPresent(device, { text: /^(Install app|Add to Home screen)$/i }, 8_000);
  if (!clicked) {
    throw new Error('Chrome menu has no "Install app" / "Add to Home screen". The PWA is probably not installable (check manifest, service worker, HTTPS).');
  }

  // Chrome's confirmation dialog, then the launcher's "add to home screen" prompt (varies by device).
  await tapIfPresent(device, { text: /^Install$/i }, 8_000);
  await tapIfPresent(device, { text: /^(Add|Add automatically)$/i }, 5_000);

  const added = await pollUntil(
    async () => (await adb.listWebApks(serial)).find((p) => !before.has(p)),
    { timeoutMs: 90_000, intervalMs: 2_000, description: 'a new WebAPK to appear (needs Google Play services and network)' },
  );
  log.info(`Installed WebAPK ${added}`);
  return added;
}
