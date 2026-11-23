import { test, expect } from '@fixtures';
import { ServiceWorkerHelper } from '@pwa/ServiceWorkerHelper';
import { OfflineController } from '@pwa/OfflineController';
import { OfflineBannerComponent } from '@components/pwa/OfflineBanner.component';
import { Tags } from '@utils/constants';

test.describe(`Offline support ${Tags.pwa}`, () => {
  test('app shell loads offline and shows the offline banner', async ({ page, context }) => {
    const sw = new ServiceWorkerHelper(page);
    const offline = new OfflineController(context);
    const banner = new OfflineBannerComponent(page);

    await page.goto('/');
    await sw.waitUntilActive();
    await page.reload(); // ensure the SW controls the page and the shell is cached

    await offline.goOffline();
    await page.reload();

    await expect(page.locator('body')).not.toBeEmpty();
    await expect(banner.locator).toBeVisible();

    await offline.goOnline();
    await expect(banner.locator).toBeHidden();
  });
});
