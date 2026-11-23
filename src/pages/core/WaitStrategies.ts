import type { Locator, Page, Response } from '@playwright/test';
import { timeouts } from '@config/timeouts.config';
import type { CommonLocators } from './CommonLocators';

/**
 * Event/condition-based waits only. There is deliberately no sleep() here:
 * fixed delays are the #1 cause of flaky UI tests.
 * Note: Playwright already auto-waits before every action; use these for page-level conditions.
 */
export class WaitStrategies {
  constructor(
    private readonly page: Page,
    private readonly locators: CommonLocators,
  ) {}

  async forVisible(target: Locator, timeout: number = timeouts.action): Promise<void> {
    await target.waitFor({ state: 'visible', timeout });
  }

  async forHidden(target: Locator, timeout: number = timeouts.action): Promise<void> {
    await target.waitFor({ state: 'hidden', timeout });
  }

  async forUrl(url: string | RegExp, timeout: number = timeouts.navigation): Promise<void> {
    await this.page.waitForURL(url, { timeout });
  }

  /** Waits for the DOM and the load event; use after navigation. */
  async forPageLoad(): Promise<void> {
    await this.page.waitForLoadState('load');
  }

  /** Use sparingly: apps with websockets or polling never go idle. Prefer forResponse or forVisible. */
  async forNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /** Waits until all known busy indicators have disappeared. */
  async forLoadersGone(timeout: number = timeouts.navigation): Promise<void> {
    await this.locators.loaders.first().waitFor({ state: 'hidden', timeout });
  }

  /**
   * Runs `trigger` and resolves with the matching response. Registering the listener
   * BEFORE the trigger avoids the classic missed-response race.
   */
  async forResponseAfter(
    trigger: () => Promise<unknown>,
    urlPart: string | RegExp,
    status = 200,
  ): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) =>
          (typeof urlPart === 'string' ? r.url().includes(urlPart) : urlPart.test(r.url())) &&
          r.status() === status,
        { timeout: timeouts.navigation },
      ),
      trigger(),
    ]);
    return response;
  }
}
