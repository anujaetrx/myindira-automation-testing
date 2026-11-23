import { defineConfig } from '@playwright/test';
import { env } from './config/environment';
import { projects } from './config/projects.config';
import { reporters } from './config/reporter.config';
import { timeouts } from './config/timeouts.config';

/**
 * Corporate/private CAs live in the OS trust store, not in Node's bundled list, so Node-side requests
 * (API tests, auth setup) can fail with "self-signed certificate" while the browser works fine.
 * Workers inherit NODE_OPTIONS, so enabling the system store here fixes them without disabling TLS checks.
 * `--use-system-ca` exists from Node 22.15 / 23.8; older versions would crash on it, hence the guard.
 */
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
const supportsSystemCa = nodeMajor > 23 || (nodeMajor === 23 && nodeMinor >= 8) || (nodeMajor === 22 && nodeMinor >= 15);
if (supportsSystemCa && process.env.USE_SYSTEM_CA !== 'false' && !process.env.NODE_OPTIONS?.includes('--use-system-ca')) {
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--use-system-ca'].filter(Boolean).join(' ');
}

export default defineConfig({
  testDir: './tests',
  outputDir: './artifacts/test-output',
  timeout: timeouts.test,
  expect: {
    timeout: timeouts.expect,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  fullyParallel: true,
  forbidOnly: env.isCI,
  retries: env.isCI ? 2 : 0,
  workers: env.isCI ? 4 : undefined,
  reporter: reporters,

  use: {
    baseURL: env.baseUrl,
    headless: env.headless,
    actionTimeout: timeouts.action,
    navigationTimeout: timeouts.navigation,
    testIdAttribute: 'data-testid',
    // Evidence: kept only when it is useful
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    // PWA: service workers must be allowed for offline/caching tests
    serviceWorkers: 'allow',
  },

  projects,
});
