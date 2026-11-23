import path from 'node:path';
import { test, expect } from '@fixtures/android.fixture';
import { androidConfig } from '@config/android.config';
import { ServiceWorkerHelper } from '@pwa/ServiceWorkerHelper';
import { ManifestValidator } from '@pwa/ManifestValidator';

test.describe('Android device and Chrome @android-device', () => {
  test('device is connected and Chrome is installed', async ({ androidSession, adb }) => {
    const { serial, device } = androidSession;
    const sdk = await adb.getProp(serial, 'ro.build.version.sdk');
    const release = await adb.getProp(serial, 'ro.build.version.release');

    test.info().annotations.push({ type: 'device', description: `${device.model()} Android ${release} (API ${sdk})` });
    expect(Number(sdk)).toBeGreaterThanOrEqual(26);
    expect(await adb.isInstalled(serial, androidConfig.chromePackage)).toBe(true);
    expect(await adb.packageVersion(serial, androidConfig.chromePackage)).toMatch(/^\d+\./);
  });

  test('real Chrome loads the PWA with touch and a mobile user agent', async ({ chromePage }) => {
    await chromePage.goto('/');

    expect(await chromePage.evaluate(() => navigator.userAgent)).toMatch(/Android.*Chrome/);
    expect(await chromePage.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    expect(await chromePage.evaluate(() => window.matchMedia('(display-mode: browser)').matches)).toBe(true);
  });

  test('PWA is installable: valid manifest and active service worker', async ({ chromePage }) => {
    await chromePage.goto('/');
    const manifest = await new ManifestValidator(chromePage).validate();
    expect(ManifestValidator.hasRequiredIcons(manifest)).toBe(true);

    await new ServiceWorkerHelper(chromePage).waitUntilActive();
  });

  test('screenshots: web content and the whole device screen', async ({ chromePage, androidSession }, testInfo) => {
    await chromePage.goto('/');

    // 1) The page only (CSS pixels, no browser chrome): good for visual comparison.
    await testInfo.attach('page.png', { body: await chromePage.screenshot(), contentType: 'image/png' });
    // 2) The entire device (status bar, Chrome UI, dialogs): shows what a user sees.
    const devicePng = path.join(testInfo.outputDir, 'device.png');
    await androidSession.device.screenshot({ path: devicePng });
    await testInfo.attach('device.png', { path: devicePng, contentType: 'image/png' });
  });
});
