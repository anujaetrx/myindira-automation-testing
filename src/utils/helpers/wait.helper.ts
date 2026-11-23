import type { Page, Response } from '@playwright/test';

/** Event-based waits. Never use fixed sleeps. */
export const WaitHelper = {
  forResponse(page: Page, urlPart: string | RegExp, status = 200): Promise<Response> {
    return page.waitForResponse(
      (r) =>
        (typeof urlPart === 'string' ? r.url().includes(urlPart) : urlPart.test(r.url())) &&
        r.status() === status,
    );
  },
  async forNetworkIdle(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle');
  },
};
