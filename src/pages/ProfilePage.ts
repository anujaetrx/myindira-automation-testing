import type { Locator, Page } from '@playwright/test';
import { ToastComponent } from '@components/common/Toast.component';
import { BasePage } from './BasePage';

export class ProfilePage extends BasePage {
  protected readonly path = '/profile';

  readonly toast: ToastComponent;
  private readonly firstNameInput: Locator;
  private readonly lastNameInput: Locator;
  private readonly countrySelect: Locator;
  private readonly avatarInput: Locator;
  private readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.toast = new ToastComponent(page);
    this.firstNameInput = this.locators.input(/first name/i);
    this.lastNameInput = this.locators.input(/last name/i);
    this.countrySelect = this.locators.input(/country/i);
    this.avatarInput = this.locators.testId('avatar-upload'); // <input type="file">, often visually hidden
    this.saveButton = this.locators.button(/save/i);
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.firstNameInput);
  }

  async setName(first: string, last: string): Promise<void> {
    await this.actions.fill(this.firstNameInput, first, 'first name');
    await this.actions.fill(this.lastNameInput, last, 'last name');
  }

  async chooseCountry(label: string): Promise<void> {
    await this.actions.selectOption(this.countrySelect, { label }, 'country');
  }

  async uploadAvatar(filePath: string): Promise<void> {
    await this.actions.upload(this.avatarInput, filePath, 'avatar upload');
  }

  /**
   * Click Save and wait for the save request to finish, so the next step never races the backend.
   * Adjust the URL fragment/status to the real endpoint.
   */
  async save(): Promise<void> {
    await this.waits.forResponseAfter(
      () => this.actions.click(this.saveButton, 'save button'),
      /\/users\/|\/profile/,
    );
  }

  /** Convenience for the common flow. Composes the primitives above. */
  async updateName(first: string, last: string): Promise<void> {
    await this.setName(first, last);
    await this.save();
  }

  async expectSavedName(first: string, last: string): Promise<void> {
    await this.verify.hasValue(this.firstNameInput, first);
    await this.verify.hasValue(this.lastNameInput, last);
  }

  async currentName(): Promise<{ first: string; last: string }> {
    return {
      first: await this.actions.value(this.firstNameInput, 'first name'),
      last: await this.actions.value(this.lastNameInput, 'last name'),
    };
  }

  get firstNameLocator(): Locator {
    return this.firstNameInput;
  }
  get lastNameLocator(): Locator {
    return this.lastNameInput;
  }
}
