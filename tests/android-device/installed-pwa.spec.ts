import { test, expect } from '@fixtures/android.fixture';
import { androidConfig } from '@config/android.config';

/**
 * The installed-PWA lifecycle. Serial on purpose: each step builds on the previous one
 * (install -> launch -> background/resume -> back button -> uninstall).
 * Installing needs a device with Google Play services (that is what mints the WebAPK).
 */
test.describe.configure({ mode: 'serial' });

test.describe('Installed PWA on Android @android-device', () => {
  test.beforeAll(async ({ androidSession }) => {
    // Chrome must not be attached to a Playwright context while we drive its native UI.
    await androidSession.adb.forceStop(androidSession.serial, androidConfig.chromePackage);
  });

  test('installs from Chrome as a WebAPK', async ({ pwa, adb, androidSession }) => {
    test.skip(!!androidConfig.pwaPackage, 'ANDROID_PWA_PACKAGE set: using an already-installed app');

    const pkg = await pwa.install();
    expect(pkg).toMatch(/^org\.chromium\.webapk\./);
    expect(await adb.listWebApks(androidSession.serial)).toContain(pkg);
  });

  test('launches from the launcher in standalone mode (no browser UI)', async ({ pwa }) => {
    await pwa.ensurePackage();
    await pwa.stop();

    const launchMs = await pwa.launch();

    expect(await pwa.isStandalone()).toBe(true);
    test.info().annotations.push({ type: 'cold-launch-ms', description: String(launchMs) });
    expect(launchMs, 'cold launch budget').toBeLessThan(15_000);
  });

  test('web content reports display-mode: standalone and a service worker', async ({ pwa }) => {
    await pwa.ensurePackage();
    await pwa.launch();

    const attached = await pwa.attach();
    try {
      const { page } = attached;
      expect(await page.evaluate(() => window.matchMedia('(display-mode: standalone)').matches)).toBe(true);
      expect(await page.evaluate(() => window.matchMedia('(display-mode: browser)').matches)).toBe(false);
      expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active)).toBe(true);
    } finally {
      await attached.detach();
    }
  });

  test('survives background and resume', async ({ pwa }) => {
    await pwa.ensurePackage();
    await pwa.launch();

    await pwa.sendToBackground();
    await expect.poll(() => pwa.isForeground(), { timeout: 10_000 }).toBe(false);

    await pwa.launch(); // brings the existing task back
    expect(await pwa.isStandalone()).toBe(true);
  });

  test('back button leaves the app instead of opening a browser tab', async ({ pwa }) => {
    await pwa.ensurePackage();
    await pwa.launch();

    await pwa.pressBack();
    await expect.poll(() => pwa.isForeground(), { timeout: 10_000 }).toBe(false);
  });

  test.afterAll(async ({ pwa }) => {
    if (androidConfig.pwaPackage) {
      await pwa.stop(); // pre-installed app: leave it installed
    } else {
      await pwa.uninstall(); // we installed it: leave the device as we found it
    }
  });
});
