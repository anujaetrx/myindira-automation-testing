import type { Locator, Page } from '@playwright/test';

/**
 * Reusable, accessibility-first locator factories shared by every page.
 * Prefer role/label/test-id locators; they survive CSS and layout changes.
 */
export class CommonLocators {
  constructor(private readonly page: Page) {}

  button(name: string | RegExp): Locator {
    return this.page.getByRole('button', { name });
  }
  link(name: string | RegExp): Locator {
    return this.page.getByRole('link', { name });
  }
  input(label: string | RegExp): Locator {
    return this.page.getByLabel(label);
  }
  heading(name?: string | RegExp, level?: number): Locator {
    return this.page.getByRole('heading', { name, level });
  }
  testId(id: string): Locator {
    return this.page.getByTestId(id);
  }
  option(name: string | RegExp): Locator {
    return this.page.getByRole('option', { name });
  }
  get dialog(): Locator {
    return this.page.getByRole('dialog');
  }
  get alert(): Locator {
    return this.page.getByRole('alert');
  }
  /** Generic busy indicators. Align with the app's real loader markup. */
  get loaders(): Locator {
    return this.page.locator('[aria-busy="true"], [role="progressbar"], [data-testid="loading"]');
  }
}
