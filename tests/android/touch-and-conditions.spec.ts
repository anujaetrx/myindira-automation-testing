import { test, expect } from '@fixtures';
import { DeviceEmulation } from '@mobile/DeviceEmulation';
import { TouchActions } from '@mobile/TouchActions';
import { ServiceWorkerHelper } from '@pwa/ServiceWorkerHelper';

test.describe('Android touch and device conditions @android', () => {
  test('swiping up scrolls the page like a finger would', async ({ page }) => {
    await page.goto('/');
    const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 50);
    test.skip(!scrollable, 'Home page is not taller than the screen');

    await new TouchActions(page).swipeViewport('up', 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('rotating to landscape changes orientation media queries', async ({ page }) => {
    await page.goto('/');
    const emulation = new DeviceEmulation(page);
    const before = await emulation.orientation();
    await emulation.rotate();
    expect(await emulation.orientation()).not.toBe(before);
  });

  test('app shell still opens on a slow 3G connection', async ({ page }) => {
    await new DeviceEmulation(page).setNetwork('slow3g');
    const response = await page.goto('/', { timeout: 60_000 });
    expect(response?.ok()).toBe(true);
  });

  test('app works offline after the service worker has cached it', async ({ page, context }) => {
    const sw = new ServiceWorkerHelper(page);
    await page.goto('/');
    await sw.waitUntilActive();
    await page.reload(); // now controlled by the service worker

    await new DeviceEmulation(page).setOffline(true);
    const failure = await page.reload().then(
      () => null,
      (e: Error) => e.message.split('\n')[0],
    );
    expect(failure, 'offline reload must be answered by the service worker, not fail with a network error').toBeNull();
    await expect(page.locator('body')).not.toBeEmpty();
    await context.setOffline(false);
  });

  test('dark mode and reduced motion preferences are honoured without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const emulation = new DeviceEmulation(page);
    await emulation.setColorScheme('dark');
    await emulation.setReducedMotion(true);
    await page.goto('/');
    expect(errors).toEqual([]);
  });
});
