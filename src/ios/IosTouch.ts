import type { Locator, Page } from '@playwright/test';

/**
 * What touch automation is possible in Playwright's WebKit.
 * Available: tap (real touch emulation) and wheel scrolling.
 * NOT available: multi-touch, swipe/drag gestures, long-press with native callouts, edge-swipe back, pinch,
 * the iOS keyboard. Playwright's CDP-based gestures (src/mobile/TouchActions.ts) are Chromium-only.
 * Those gestures need a real device or Appium.
 */
export class IosTouch {
  constructor(private readonly page: Page) {}

  async tap(target: Locator): Promise<void> {
    await target.tap();
  }

  /** Scrolls like a finger flick would, using the mouse wheel (the only scroll primitive WebKit offers). */
  async scrollBy(pixels: number): Promise<void> {
    await this.page.mouse.move(100, 200);
    await this.page.mouse.wheel(0, pixels);
  }

  async scrollY(): Promise<number> {
    return this.page.evaluate(() => window.scrollY);
  }

  /** True when the page is taller than the screen, so scrolling is meaningful. */
  async isScrollable(): Promise<boolean> {
    return this.page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 50);
  }
}
