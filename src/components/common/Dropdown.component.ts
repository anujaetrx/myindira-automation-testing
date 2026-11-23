import type { Locator } from '@playwright/test';
import type { Page } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class DropdownComponent extends BaseComponent {
  constructor(page: Page, root: Locator) {
    super(page, root);
  }

  async select(option: string | RegExp): Promise<void> {
    await this.root.click();
    await this.page.getByRole('option', { name: option }).click();
  }
}
