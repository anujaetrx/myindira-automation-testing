import { test, expect } from '@fixtures';
import { ServiceWorkerHelper } from '@pwa/ServiceWorkerHelper';
import { CacheInspector } from '@pwa/CacheInspector';

/** Offline in WebKit: service worker + Cache API + network off. (Real iOS adds cache eviction: see docs/ios.md.) */
test.describe('iOS offline @ios @pwa', () => {
  test('service worker activates in WebKit', async ({ page }) => {
    await page.goto('/');
    const sw = new ServiceWorkerHelper(page);
    expect(await sw.isSupported()).toBe(true);
    await sw.waitUntilActive();
  });

  test('app shell is cached', async ({ page }) => {
    await page.goto('/');
    await new ServiceWorkerHelper(page).waitUntilActive();
    // Runtime caching can fill the cache a moment after activation, so wait instead of sampling once.
    await expect.poll(async () => (await new CacheInspector(page).cacheNames()).length, { timeout: 15_000 }).toBeGreaterThan(0);
  });

  test('app shell loads with the network off', async ({ page, context }) => {
    await page.goto('/');
    await new ServiceWorkerHelper(page).waitUntilActive();
    await page.reload(); // now controlled by the service worker

    await context.setOffline(true);
    const failure = await page.reload().then(
      () => null,
      (e: Error) => e.message.split('\n')[0],
    );
    await context.setOffline(false);
    expect(failure, 'offline reload must be answered by the service worker, not fail with a network error').toBeNull();
  });
});
