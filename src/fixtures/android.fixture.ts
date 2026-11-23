import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { androidConfig } from '@config/android.config';
import { env } from '@config/environment';
import { AdbClient } from '@android/AdbClient';
import { AndroidDevices, type AndroidSession } from '@android/AndroidDevices';
import { PwaApp } from '@android/PwaApp';
import { baseTest } from './base.fixture';

type DeviceFixtures = {
  adb: AdbClient;
  /** Chrome on the device, driven by Playwright (a real Android browser, not emulation). */
  chromeContext: BrowserContext;
  chromePage: Page;
  /** Auto: on failure attaches a device screenshot, UI hierarchy and logcat; optionally records the screen. */
  deviceDiagnostics: void;
};

type DeviceWorkerFixtures = {
  androidSession: AndroidSession;
  /**
   * The PWA as an installed app. Worker-scoped so the package learned during the install test is
   * remembered by later tests and by afterAll. Uses ANDROID_PWA_PACKAGE if set.
   */
  pwa: PwaApp;
};

export const test = baseTest.extend<DeviceFixtures, DeviceWorkerFixtures>({
  androidSession: [
    async ({}, use) => {
      const session = await AndroidDevices.connect();
      await use(session);
      await session.device.close();
    },
    { scope: 'worker' },
  ],

  adb: async ({ androidSession }, use) => use(androidSession.adb),

  chromeContext: async ({ androidSession }, use) => {
    const context = await AndroidDevices.launchChrome(androidSession, { baseURL: env.baseUrl });
    await use(context);
    await context.close();
  },

  chromePage: async ({ chromeContext }, use) => {
    await use(await chromeContext.newPage());
  },

  pwa: [
    async ({ androidSession }, use) => {
      await use(new PwaApp(androidSession));
    },
    { scope: 'worker' },
  ],

  deviceDiagnostics: [
    async ({ androidSession }, use, testInfo) => {
      const { adb, serial } = androidSession;
      const recording = androidConfig.recordScreen
        ? adb.startScreenRecord(serial, path.join(testInfo.outputDir, 'device-screen.mp4'))
        : undefined;

      await use();

      const failed = testInfo.status !== testInfo.expectedStatus;
      if (recording) {
        const file = await recording.stop().catch(() => undefined);
        if (file) await testInfo.attach('device-screen-recording', { path: file, contentType: 'video/mp4' });
      }
      if (failed) {
        // Best-effort: diagnostics must never hide the real failure.
        await adb.screenshot(serial).then((b) => testInfo.attach('device-screenshot', { body: b, contentType: 'image/png' })).catch(() => undefined);
        await adb.uiHierarchy(serial).then((x) => testInfo.attach('ui-hierarchy.xml', { body: x, contentType: 'application/xml' })).catch(() => undefined);
        await adb.logcat(serial).then((l) => testInfo.attach('logcat.txt', { body: l, contentType: 'text/plain' })).catch(() => undefined);
      }
    },
    { auto: true },
  ],
});

export { expect } from '@utils/assertions';
