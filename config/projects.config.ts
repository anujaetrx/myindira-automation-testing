import { devices, type Project } from '@playwright/test';
import path from 'node:path';
import { androidConfig } from './android.config';

/** Session files live here, one sub-folder per environment (see SessionStore). */
export const STORAGE_DIR = path.resolve(__dirname, '..', 'src', 'auth', 'storage-state');

/** Folders that must never run in the general browser projects. */
const NON_BROWSER = ['api', 'setup', 'unit', 'android', 'android-device', 'ios'];
const ignore = (...extra: string[]): RegExp =>
  new RegExp(`tests[\\\\/](${[...NON_BROWSER, ...extra].join('|')})[\\\\/]`);

const androidTests = /tests[\\/]android[\\/].*\.spec\.ts/;
const iosTests = /tests[\\/]ios[\\/].*\.spec\.ts/;

/**
 * Playwright projects.
 *  - Browser projects depend on `setup` (one login per role) and run tests/e2e, pwa, smoke, visual.
 *  - `android-*` projects EMULATE Android in desktop Chromium (tests/android). No device needed.
 *  - `android-device` drives a REAL phone/emulator over ADB (tests/android-device). Opt-in:
 *    RUN_ANDROID_DEVICE=true, and always with --workers=1 (one device, one test at a time).
 */
export const projects: Project[] = [
  {
    name: 'setup',
    testMatch: /tests[\\/]setup[\\/].*\.setup\.ts/,
    teardown: 'teardown',
  },
  {
    name: 'teardown',
    testMatch: /tests[\\/]setup[\\/].*\.teardown\.ts/,
  },
  {
    name: 'unit',
    testMatch: /tests[\\/]unit[\\/].*\.spec\.ts/,
    use: { baseURL: undefined },
  },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
    dependencies: ['setup'],
    testIgnore: ignore(),
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
    dependencies: ['setup'],
    testIgnore: ignore(), // WebKit supports service workers, Cache API and offline mode (verified)
  },
  {
    name: 'mobile-chrome',
    use: { ...devices['Pixel 7'] },
    dependencies: ['setup'],
    testIgnore: ignore('visual'),
  },
  {
    name: 'mobile-safari',
    use: { ...devices['iPhone 14'] },
    dependencies: ['setup'],
    testIgnore: ignore('visual'),
  },

  // ---- Android browser emulation (Chromium + device profile) ----
  { name: 'android-pixel7', testMatch: androidTests, use: { ...devices['Pixel 7'] } },
  { name: 'android-galaxy-s9', testMatch: androidTests, use: { ...devices['Galaxy S9+'] } },
  { name: 'android-small-pixel2', testMatch: androidTests, use: { ...devices['Pixel 2'] } },
  { name: 'android-tablet', testMatch: androidTests, use: { ...devices['Galaxy Tab S4'] } },

  // ---- iOS Safari emulation (WebKit + iPhone/iPad profile). Not real iOS: see docs/ios.md ----
  { name: 'ios-iphone-se', testMatch: iosTests, use: { ...devices['iPhone SE (3rd gen)'] } },
  { name: 'ios-iphone-14', testMatch: iosTests, use: { ...devices['iPhone 14'] } },
  { name: 'ios-iphone-15-pro-max', testMatch: iosTests, use: { ...devices['iPhone 15 Pro Max'] } },
  { name: 'ios-ipad', testMatch: iosTests, use: { ...devices['iPad Pro 11'] } },

  {
    name: 'api',
    testMatch: /tests[\\/]api[\\/].*\.spec\.ts/,
    dependencies: ['setup'],
  },

  // ---- Real Android device / emulator over ADB (opt-in) ----
  ...(androidConfig.deviceProjectEnabled
    ? [
        {
          name: 'android-device',
          testMatch: /tests[\\/]android-device[\\/].*\.spec\.ts/,
          timeout: 180_000,
          retries: 0,
          fullyParallel: false,
        } satisfies Project,
      ]
    : []),
];
