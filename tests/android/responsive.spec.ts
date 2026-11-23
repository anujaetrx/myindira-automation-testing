import { test, expect } from '@fixtures';
import { ResponsiveChecks, Viewports } from '@mobile/ResponsiveChecks';

/**
 * Responsive layout on Android viewports. Runs in the android-* projects (Chromium emulation).
 * Each device project already has its own viewport; the matrix below adds the in-between widths.
 */
test.describe('Android responsive layout @android', () => {
  test('page declares a mobile viewport and fits the device width', async ({ page }) => {
    await page.goto('/');
    expect(await ResponsiveChecks.hasViewportMeta(page), 'meta viewport with width=device-width').toBe(true);
    expect(await ResponsiveChecks.hasHorizontalOverflow(page), `overflowing: ${(await ResponsiveChecks.overflowingElements(page)).join(', ')}`).toBe(false);
  });

  test('device is treated as touch-first', async ({ page }) => {
    await page.goto('/');
    expect(await ResponsiveChecks.isTouchPrimary(page)).toBe(true);
  });

  for (const vp of Object.values(Viewports)) {
    test(`no horizontal scroll at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      expect(await ResponsiveChecks.hasHorizontalOverflow(page), `overflowing: ${(await ResponsiveChecks.overflowingElements(page)).join(', ')}`).toBe(false);
    });
  }

  test('interactive elements are large enough to tap (44px)', async ({ page }) => {
    await page.goto('/');
    const small = await ResponsiveChecks.smallTapTargets(page, 44);
    expect(small, `Too-small tap targets: ${JSON.stringify(small.slice(0, 5))}`).toHaveLength(0);
  });

  test('layout survives rotation', async ({ page }) => {
    await page.goto('/');
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: size.height, height: size.width });
    expect(await ResponsiveChecks.hasHorizontalOverflow(page)).toBe(false);
  });
});
