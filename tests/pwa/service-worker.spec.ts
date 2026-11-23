import { test, expect } from '@fixtures';
import { ServiceWorkerHelper } from '@pwa/ServiceWorkerHelper';
import { CacheInspector } from '@pwa/CacheInspector';
import { Tags } from '@utils/constants';

test.describe(`Service worker ${Tags.pwa}`, () => {
  test('registers, activates and controls the page after reload', async ({ page }) => {
    const sw = new ServiceWorkerHelper(page);
    await page.goto('/');

    expect(await sw.isSupported()).toBe(true);
    await sw.waitUntilActive();

    await page.reload(); // first load is uncontrolled by design
    expect(await sw.isControlling()).toBe(true);
    expect(await sw.scope()).toContain(new URL(page.url()).origin);
  });

  test('precaches the app shell', async ({ page }) => {
    const sw = new ServiceWorkerHelper(page);
    await page.goto('/');
    await sw.waitUntilActive();

    const cache = new CacheInspector(page);
    expect((await cache.cacheNames()).length).toBeGreaterThan(0);
  });
});
