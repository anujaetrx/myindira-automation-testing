import type { Page } from '@playwright/test';
import { Logger } from '@utils/logger/Logger';
import { CommonLocators } from './core/CommonLocators';
import { PageAssertions } from './core/PageAssertions';
import { UiActions } from './core/UiActions';
import { WaitStrategies } from './core/WaitStrategies';

/**
 * Base class for every page object.
 *
 * INHERITANCE is used for the page lifecycle only (path, goto, waitForReady): the part
 * every page genuinely IS-A. Capabilities (actions, waits, verifications, locators) are
 * COMPOSED as collaborators, so they can evolve and be tested independently.
 *
 * Page classes contain UI interactions only. Business scenarios live in specs.
 */
export abstract class BasePage {
  protected readonly log: Logger;
  protected readonly actions: UiActions;
  protected readonly waits: WaitStrategies;
  protected readonly locators: CommonLocators;
  /** Generic UI-state verifications. Business assertions belong in specs. */
  readonly verify: PageAssertions;

  /** Path relative to baseURL. */
  protected abstract readonly path: string;

  constructor(protected readonly page: Page) {
    const name = this.constructor.name;
    this.log = Logger.for(name);
    this.locators = new CommonLocators(page);
    this.actions = new UiActions(page, name);
    this.waits = new WaitStrategies(page, this.locators);
    this.verify = new PageAssertions(page);
  }

  /** Template method: each page defines what "ready" means (a key element, a loader gone...). */
  abstract waitForReady(): Promise<void>;

  // ---------- Navigation ----------

  async goto(): Promise<void> {
    this.log.info(`Navigating to ${this.path}`);
    await this.page.goto(this.path);
    await this.waitForReady();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitForReady();
  }

  async goBack(): Promise<void> {
    await this.page.goBack();
  }

  async goForward(): Promise<void> {
    await this.page.goForward();
  }

  async navigateTo(path: string): Promise<void> {
    await this.page.goto(path);
  }

  // ---------- Page info ----------

  url(): string {
    return this.page.url();
  }

  currentPath(): string {
    return new URL(this.page.url()).pathname;
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  async isCurrentPage(): Promise<boolean> {
    return this.currentPath() === this.path;
  }
}
