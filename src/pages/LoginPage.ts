import type { Locator, Page } from '@playwright/test';
import type { Credentials } from '@api/models/common.model';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  protected readonly path = '/login';

  // Locators are private: tests talk to intent methods, not to the DOM.
  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly errorBanner: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = this.locators.input(/username|email/i);
    this.passwordInput = this.locators.input(/password/i);
    this.submitButton = this.locators.button(/log\s?in|sign\s?in/i);
    this.errorBanner = this.locators.alert;
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.submitButton);
  }

  /** One user interaction: fill the form and submit. What happens next is the test's concern. */
  async login({ username, password }: Credentials): Promise<void> {
    this.log.info(`Logging in as ${username}`);
    await this.actions.fill(this.usernameInput, username, 'username');
    await this.actions.fill(this.passwordInput, password, 'password');
    await this.actions.click(this.submitButton, 'login button');
  }

  async errorMessage(): Promise<string> {
    return this.actions.text(this.errorBanner, 'login error');
  }

  async expectErrorShown(text?: string | RegExp): Promise<void> {
    await this.verify.visible(this.errorBanner, 'login error should be shown');
    if (text) await this.verify.containsText(this.errorBanner, text);
  }

  /** Locator access for specs that need Playwright's own assertions (e.g. screenshots). */
  get errorLocator(): Locator {
    return this.errorBanner;
  }
}
