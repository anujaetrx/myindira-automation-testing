import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Reusable, web-first verifications (they auto-retry until the timeout).
 * Pages expose these as `this.verify`. Business expectations ("order is confirmed")
 * still belong in specs; these only check generic UI state.
 */
export class PageAssertions {
  constructor(private readonly page: Page) {}

  async visible(target: Locator, message?: string): Promise<void> {
    await expect(target, message).toBeVisible();
  }

  async hidden(target: Locator, message?: string): Promise<void> {
    await expect(target, message).toBeHidden();
  }

  async enabled(target: Locator, message?: string): Promise<void> {
    await expect(target, message).toBeEnabled();
  }

  async disabled(target: Locator, message?: string): Promise<void> {
    await expect(target, message).toBeDisabled();
  }

  async hasText(target: Locator, text: string | RegExp, message?: string): Promise<void> {
    await expect(target, message).toHaveText(text);
  }

  async containsText(target: Locator, text: string | RegExp, message?: string): Promise<void> {
    await expect(target, message).toContainText(text);
  }

  async hasValue(target: Locator, value: string | RegExp, message?: string): Promise<void> {
    await expect(target, message).toHaveValue(value);
  }

  async count(target: Locator, expected: number, message?: string): Promise<void> {
    await expect(target, message).toHaveCount(expected);
  }

  async url(expected: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(expected);
  }

  async title(expected: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(expected);
  }
}
