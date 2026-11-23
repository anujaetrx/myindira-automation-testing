import { test, expect } from '@fixtures';
import { Tags } from '@utils/constants';

test.describe(`Smoke ${Tags.smoke}`, () => {
  test('home page responds and renders', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/.+/);
  });
});
