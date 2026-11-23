import type { AndroidDevice } from '@playwright/test';
import { androidConfig } from '@config/android.config';
import { Logger } from '@utils/logger/Logger';
import { pollUntil } from '@utils/retry';
import type { AndroidSession } from './AndroidDevices';

const log = Logger.for('ChromeSetup');

type Selector = Parameters<AndroidDevice['tap']>[0];

const DRIVER_HINT = "Android driver apk is missing: run 'npx playwright install android'";

/** Returns true if tapped, false if absent. A missing driver is a setup error and must not be swallowed. */
async function tapIfPresent(device: AndroidDevice, selector: Selector): Promise<boolean> {
  try {
    await device.tap(selector, { timeout: 1_500 });
    return true;
  } catch (error) {
    if (error instanceof Error && /install android driver apk/i.test(error.message)) throw new Error(DRIVER_HINT);
    return false;
  }
}

/** Screens that sit in front of Chrome on a fresh device and make Playwright wait forever. */
const BLOCKERS: { name: string; selector: Selector }[] = [
  // Slow or low-memory emulators raise ANR dialogs; "Wait" dismisses them without killing the app.
  { name: 'ANR dialog', selector: { res: 'android:id/aerr_wait' } },
  { name: 'first run: sign-in', selector: { text: /Use without an account/i } },
  { name: 'first run: terms', selector: { text: /Accept & continue|Accept and continue/i } },
  { name: 'first run: sync', selector: { text: /^(No thanks|Yes, I.m in|Got it)$/i } },
  { name: 'notifications permission', selector: { text: /^(Don.t allow)$/i } },
];

const SETTLED_POLLS = 3; // Chrome's entry activity flashes before redirecting to first-run: require stability

/**
 * Gets Chrome past its first-run experience and system dialogs, so later steps (Playwright's
 * launchBrowser or native-UI automation) start from a clean browser. Safe to call repeatedly:
 * once Chrome shows its normal tabbed UI for several consecutive polls it returns.
 */
export async function prepareChrome(session: AndroidSession, timeoutMs = 180_000): Promise<void> {
  const { adb, serial, device } = session;
  const pkg = androidConfig.chromePackage;

  // Stable test conditions: no animations, screen stays on.
  await adb
    .shell(serial, 'settings put global window_animation_scale 0; settings put global transition_animation_scale 0; settings put global animator_duration_scale 0; svc power stayon true')
    .catch(() => undefined);

  await adb.launchApp(serial, pkg);

  let stable = 0;
  await pollUntil(
    async () => {
      let dismissed = false;
      for (const blocker of BLOCKERS) {
        if (await tapIfPresent(device, blocker.selector)) {
          log.info(`Dismissed ${blocker.name}`);
          dismissed = true;
        }
      }
      const top = await adb.foregroundActivity(serial);
      const onBrowser = top?.pkg === pkg && !/FirstRun|Welcome|Signin|Main$/i.test(top.activity);
      stable = onBrowser && !dismissed ? stable + 1 : 0;
      return stable >= SETTLED_POLLS;
    },
    { timeoutMs, intervalMs: 1_000, description: 'Chrome to get past first-run screens' },
  );

  await adb.forceStop(serial, pkg); // hand over a stopped Chrome to whoever launches it next
}
